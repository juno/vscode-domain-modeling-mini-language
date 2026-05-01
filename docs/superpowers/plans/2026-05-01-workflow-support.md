# Workflow Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `workflow` と `substep` 構文を DMML 拡張機能に追加する（ハイライト・補完・ホバー・構文エラー検出）。

**Architecture:** `src/parser.ts` に `workflow`/`substep` のパースロジックを追加し、継続行の検出をすべてのインデント行に拡張する。TextMate grammar に `workflow`/`substep` キーワード・ダブルクォート文字列・`input:`/`output:` ラベルのパターンを追加する。補完プロバイダーにキーワードを追加する。

**Tech Stack:** TypeScript, VS Code Extension API, Jest + ts-jest

---

## ファイルマップ

| ファイル | 変更内容 |
|---|---|
| `src/parser.ts` | `SymbolInfo.kind` 拡張、継続行検出を全インデント行に変更、workflow/substep パース追加 |
| `src/__tests__/parser.test.ts` | workflow/substep テスト 11 件追加 |
| `syntaxes/dmml.tmLanguage.json` | workflow/substep キーワード、文字列リテラル、ラベルパターン追加 |
| `src/completionProvider.ts` | workflow/substep を KEYWORD_ITEMS に追加 |

---

## Task 1: パーサー拡張（TDD）

**Files:**
- Modify: `src/parser.ts`
- Modify: `src/__tests__/parser.test.ts`

### 変更の全体像

`src/parser.ts` に以下の変更を加える：

1. `SymbolInfo.kind` を `'data' | 'behavior' | 'workflow' | 'substep'` に拡張
2. `groupLines` の継続行検出を `AND`/`OR` 限定から「すべてのインデント行」に変更
3. `workflow "名前" = ...` と `substep "名前" = ...` のパースを追加

- [ ] **Step 1: 失敗するテストを src/__tests__/parser.test.ts に追加する**

既存のテストファイルの末尾に以下を追記する：

```typescript
describe('parse - workflow 定義', () => {
  it('単純な workflow 定義をパースする', () => {
    const text = 'workflow "注文する" =\n  input: 注文書\n  output: 注文'
    const result = parse(text)
    expect(result.errors).toHaveLength(0)
    expect(result.symbols.has('注文する')).toBe(true)
    expect(result.symbols.get('注文する')!.kind).toBe('workflow')
  })

  it('複数行 output の workflow をパースする', () => {
    const text = 'workflow "注文する" =\n  input: 注文書\n  output:\n    受注\n    OR エラー'
    const result = parse(text)
    expect(result.errors).toHaveLength(0)
    expect(result.symbols.has('注文する')).toBe(true)
  })

  it('workflow に名前がない場合はエラー', () => {
    const result = parse('workflow =')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('名前')
  })

  it('workflow に = がない場合はエラー', () => {
    const text = 'workflow "注文する"\n  input: 注文書\n  output: 注文'
    const result = parse(text)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('=')
  })

  it('workflow に input: がない場合はエラー', () => {
    const text = 'workflow "注文する" =\n  output: 注文'
    const result = parse(text)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('input:')
  })

  it('workflow に output: がない場合はエラー', () => {
    const text = 'workflow "注文する" =\n  input: 注文書'
    const result = parse(text)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('output:')
  })
})

describe('parse - substep 定義', () => {
  it('単純な substep 定義をパースする', () => {
    const text = 'substep "注文を検証する" =\n  input: 未検証注文\n  output: 検証済み注文 OR 検証エラー'
    const result = parse(text)
    expect(result.errors).toHaveLength(0)
    expect(result.symbols.has('注文を検証する')).toBe(true)
    expect(result.symbols.get('注文を検証する')!.kind).toBe('substep')
  })

  it('substep に名前がない場合はエラー', () => {
    const result = parse('substep =')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('名前')
  })

  it('substep に = がない場合はエラー', () => {
    const text = 'substep "注文を検証する"\n  input: 未検証注文\n  output: 検証済み注文'
    const result = parse(text)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('=')
  })

  it('substep に input: がない場合はエラー', () => {
    const text = 'substep "注文を検証する" =\n  output: 検証済み注文'
    const result = parse(text)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('input:')
  })

  it('substep に output: がない場合はエラー', () => {
    const text = 'substep "注文を検証する" =\n  input: 未検証注文'
    const result = parse(text)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('output:')
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test`

Expected: 11 件失敗（FAIL）、既存の 17 件はすべて PASS のまま。

- [ ] **Step 3: src/parser.ts を更新する**

ファイル全体を以下の内容に置き換える：

```typescript
export interface Position {
  line: number
  character: number
}

export interface Range {
  start: Position
  end: Position
}

export interface SymbolInfo {
  name: string
  kind: 'data' | 'behavior' | 'workflow' | 'substep'
  definition: string
  range: Range
}

export interface ParseError {
  message: string
  range: Range
}

export interface ParseResult {
  symbols: Map<string, SymbolInfo>
  errors: ParseError[]
}

function makeRange(line: number, start: number, end: number): Range {
  return { start: { line, character: start }, end: { line, character: end } }
}

function stripComment(line: string): string {
  const idx = line.indexOf('//')
  return idx >= 0 ? line.slice(0, idx) : line
}

interface StatementGroup {
  startLine: number
  lines: Array<{ lineNumber: number; text: string }>
}

function groupLines(rawLines: string[]): StatementGroup[] {
  const groups: StatementGroup[] = []
  let current: StatementGroup | null = null

  for (let i = 0; i < rawLines.length; i++) {
    const stripped = stripComment(rawLines[i]).trimEnd()
    const trimmed = stripped.trim()

    if (!trimmed) {
      if (current) { groups.push(current); current = null }
      continue
    }

    // すべてのインデント行を継続行として扱う（AND/OR だけでなく input:/output: なども含む）
    const isContinuation = /^\s+/.test(stripped) && current !== null

    if (isContinuation) {
      current!.lines.push({ lineNumber: i, text: stripped })
    } else {
      if (current) groups.push(current)
      current = { startLine: i, lines: [{ lineNumber: i, text: stripped }] }
    }
  }

  if (current) groups.push(current)
  return groups
}

function parseWorkflowLike(
  keyword: 'workflow' | 'substep',
  rest: string,
  range: Range,
  errors: ParseError[],
  symbols: Map<string, SymbolInfo>,
  fullText: string
): void {
  if (!rest.startsWith('"')) {
    errors.push({ message: `\`${keyword}\` の後に名前（\`"..."\`）がありません`, range })
    return
  }
  const nameMatch = /^"([^"]+)"\s*(.*)/.exec(rest)
  if (!nameMatch) {
    errors.push({ message: `\`${keyword}\` の後に名前（\`"..."\`）がありません`, range })
    return
  }
  const name = nameMatch[1]
  const afterName = nameMatch[2].trim()
  if (!afterName.startsWith('=')) {
    errors.push({ message: '`=` がありません', range })
    return
  }
  const body = afterName.slice(1).trim()
  let hasError = false
  if (!body.includes('input:')) {
    errors.push({ message: '`input:` がありません', range })
    hasError = true
  }
  if (!body.includes('output:')) {
    errors.push({ message: '`output:` がありません', range })
    hasError = true
  }
  if (!hasError) {
    symbols.set(name, { name, kind: keyword, definition: fullText.trim(), range })
  }
}

export function parse(text: string): ParseResult {
  const symbols = new Map<string, SymbolInfo>()
  const errors: ParseError[] = []
  const rawLines = text.split('\n')

  for (const group of groupLines(rawLines)) {
    const fullText = group.lines.map(l => l.text.trim()).join(' ')
    const startLine = group.startLine
    const range = makeRange(startLine, 0, rawLines[startLine].length)

    const dataMatch = /^\s*data\b(.*)/.exec(fullText)
    const behaviorMatch = /^\s*behavior\b(.*)/.exec(fullText)
    const workflowMatch = /^\s*workflow\b(.*)/.exec(fullText)
    const substepMatch = /^\s*substep\b(.*)/.exec(fullText)

    if (dataMatch) {
      const rest = dataMatch[1].trim()
      if (!rest) {
        errors.push({ message: '`data` の後に識別子がありません', range })
        continue
      }
      const eqIdx = rest.indexOf('=')
      if (eqIdx < 0) {
        errors.push({ message: '`=` がありません', range })
        continue
      }
      const name = rest.slice(0, eqIdx).trim()
      const expr = rest.slice(eqIdx + 1).trim()
      if (!name) {
        errors.push({ message: '`data` の後に識別子がありません', range })
        continue
      }
      if (!expr) {
        errors.push({ message: '`=` の後に式がありません', range })
        continue
      }
      symbols.set(name, { name, kind: 'data', definition: fullText.trim(), range })

    } else if (behaviorMatch) {
      const rest = behaviorMatch[1].trim()
      if (!rest) {
        errors.push({ message: '`behavior` の後に識別子がありません', range })
        continue
      }
      const eqIdx = rest.indexOf('=')
      if (eqIdx < 0) {
        errors.push({ message: '`=` がありません', range })
        continue
      }
      const name = rest.slice(0, eqIdx).trim()
      const expr = rest.slice(eqIdx + 1).trim()
      if (!name) {
        errors.push({ message: '`behavior` の後に識別子がありません', range })
        continue
      }
      if (!expr.includes('->')) {
        errors.push({ message: '`behavior` には `->` が必要です', range })
        continue
      }
      const arrowIdx = expr.indexOf('->')
      const inputExpr = expr.slice(0, arrowIdx).trim()
      const outputExpr = expr.slice(arrowIdx + 2).trim()
      if (!inputExpr) {
        errors.push({ message: '`->` の前に入力式がありません', range })
        continue
      }
      if (!outputExpr) {
        errors.push({ message: '`->` の後に出力式がありません', range })
        continue
      }
      symbols.set(name, { name, kind: 'behavior', definition: fullText.trim(), range })

    } else if (workflowMatch) {
      parseWorkflowLike('workflow', workflowMatch[1].trim(), range, errors, symbols, fullText)

    } else if (substepMatch) {
      parseWorkflowLike('substep', substepMatch[1].trim(), range, errors, symbols, fullText)
    }
  }

  return { symbols, errors }
}
```

- [ ] **Step 4: テストを実行して全件パスを確認する**

Run: `npm test`

Expected: 28 tests PASS（既存 17 件 + 新規 11 件）

- [ ] **Step 5: コミット**

```bash
git add src/parser.ts src/__tests__/parser.test.ts
git commit -m "feat: add workflow and substep parsing"
```

---

## Task 2: Grammar と補完プロバイダーの更新

**Files:**
- Modify: `syntaxes/dmml.tmLanguage.json`
- Modify: `src/completionProvider.ts`

- [ ] **Step 1: syntaxes/dmml.tmLanguage.json を更新する**

ファイル全体を以下の内容に置き換える：

```json
{
  "$schema": "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
  "name": "Domain Modeling Mini Language",
  "scopeName": "source.dmml",
  "patterns": [
    { "include": "#comment" },
    { "include": "#collection" },
    { "include": "#keywords" },
    { "include": "#operators" },
    { "include": "#arrow" },
    { "include": "#label" },
    { "include": "#string" },
    { "include": "#optional" },
    { "include": "#identifier" }
  ],
  "repository": {
    "comment": {
      "name": "comment.line.double-slash.dmml",
      "match": "//.*$"
    },
    "collection": {
      "name": "support.type.collection.dmml",
      "match": "List<[^>]+>"
    },
    "keywords": {
      "name": "keyword.control.dmml",
      "match": "\\b(data|behavior|workflow|substep)\\b"
    },
    "operators": {
      "name": "keyword.operator.dmml",
      "match": "\\b(AND|OR)\\b"
    },
    "arrow": {
      "name": "keyword.operator.arrow.dmml",
      "match": "->"
    },
    "label": {
      "name": "keyword.other.label.dmml",
      "match": "\\b(input|output|dependencies)\\s*:"
    },
    "string": {
      "name": "string.quoted.double.dmml",
      "match": "\"[^\"]*\""
    },
    "optional": {
      "name": "keyword.operator.optional.dmml",
      "match": "\\?"
    },
    "identifier": {
      "name": "entity.name.type.dmml",
      "match": "[\\p{L}_][\\p{L}\\p{N}_]*"
    }
  }
}
```

- [ ] **Step 2: src/completionProvider.ts を更新する**

1行だけ変更する。`KEYWORD_ITEMS` の配列に `'workflow'` と `'substep'` を追加する：

```typescript
const KEYWORD_ITEMS = ['data', 'behavior', 'workflow', 'substep'].map(kw => {
  const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword)
  item.detail = 'dmml keyword'
  return item
})
```

- [ ] **Step 3: コンパイルしてエラーがないことを確認する**

Run: `npm run compile`

Expected: エラーなし。

- [ ] **Step 4: テストを実行して全件パスを確認する**

Run: `npm test`

Expected: 28 tests PASS。

- [ ] **Step 5: コミット**

```bash
git add syntaxes/dmml.tmLanguage.json src/completionProvider.ts
git commit -m "feat: add workflow/substep highlighting and completion"
```
