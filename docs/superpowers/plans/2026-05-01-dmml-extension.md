# Domain Modeling Mini Language VS Code Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `.dmml` ファイルに対して、シンタックスハイライト・コード補完・ホバー表示・構文エラー検出を提供する VS Code 拡張機能を構築する。

**Architecture:** TextMate grammar がトークンカラーリングを担当し、`src/parser.ts` が行単位の軽量パーサーとして唯一の解析ロジックを持つ。補完・ホバー・診断の 3 プロバイダーはすべてパーサーの結果のみに依存する。LSP なし、VS Code 標準 API のみ使用。

**Tech Stack:** TypeScript, VS Code Extension API (`vscode`), Jest + ts-jest（パーサーのユニットテスト用）

---

## ファイルマップ

| ファイル | 責務 |
|---|---|
| `package.json` | 拡張機能マニフェスト（言語定義・grammar 登録・スクリプト） |
| `tsconfig.json` | TypeScript コンパイル設定 |
| `.gitignore` | node_modules / out を除外 |
| `language-configuration.json` | コメントトグル・括弧補完 |
| `syntaxes/dmml.tmLanguage.json` | `.dmml` のトークンカラーリング |
| `syntaxes/dmml.markdown.tmLanguage.json` | Markdown コードブロック内の埋め込みハイライト |
| `src/parser.ts` | 行単位パーサー → symbols + syntax errors |
| `src/diagnosticsProvider.ts` | ParseError[] → vscode.Diagnostic[] 変換・発行 |
| `src/completionProvider.ts` | キーワード補完・シンボル補完 |
| `src/hoverProvider.ts` | ホバー時にシンボル定義を表示 |
| `src/extension.ts` | activate でプロバイダーを登録するエントリーポイント |
| `src/__tests__/parser.test.ts` | パーサーの Jest ユニットテスト |

---

## Task 1: プロジェクトスキャフォールド

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.vscodeignore`

- [ ] **Step 1: package.json を作成する**

```json
{
  "name": "vscode-domain-modeling-mini-language",
  "displayName": "Domain Modeling Mini Language",
  "description": "Syntax highlighting and language support for .dmml files",
  "version": "0.0.1",
  "engines": { "vscode": "^1.74.0" },
  "categories": ["Programming Languages"],
  "activationEvents": [],
  "main": "./out/extension.js",
  "contributes": {
    "languages": [
      {
        "id": "dmml",
        "aliases": ["Domain Modeling Mini Language", "dmml"],
        "extensions": [".dmml"],
        "configuration": "./language-configuration.json"
      }
    ],
    "grammars": [
      {
        "language": "dmml",
        "scopeName": "source.dmml",
        "path": "./syntaxes/dmml.tmLanguage.json"
      },
      {
        "scopeName": "markdown.dmml.codeblock",
        "path": "./syntaxes/dmml.markdown.tmLanguage.json",
        "injectTo": ["text.html.markdown"],
        "embeddedLanguages": {
          "meta.embedded.block.dmml": "dmml"
        }
      }
    ]
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "test": "jest"
  },
  "devDependencies": {
    "@types/vscode": "^1.74.0",
    "@types/jest": "^29.5.0",
    "@types/node": "^18.0.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.1.0"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testMatch": ["**/src/__tests__/**/*.test.ts"]
  }
}
```

- [ ] **Step 2: tsconfig.json を作成する**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "rootDir": "src",
    "lib": ["ES2020"],
    "sourceMap": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", ".vscode-test"]
}
```

- [ ] **Step 3: .gitignore を作成する**

```
node_modules/
out/
```

- [ ] **Step 4: .vscodeignore を作成する**

```
.vscode/**
.vscode-test/**
src/**
node_modules/**
.gitignore
tsconfig.json
```

- [ ] **Step 5: 依存パッケージをインストールする**

Run: `npm install`

Expected: `node_modules/` が作成され、エラーなし。

- [ ] **Step 6: コミット**

```bash
git add package.json tsconfig.json .gitignore .vscodeignore
git commit -m "chore: add project scaffold"
```

---

## Task 2: 言語設定ファイル

**Files:**
- Create: `language-configuration.json`
- Create: `syntaxes/` ディレクトリ

- [ ] **Step 1: language-configuration.json を作成する**

```json
{
  "comments": {
    "lineComment": "//"
  },
  "brackets": [
    ["<", ">"]
  ],
  "autoClosingPairs": [
    { "open": "<", "close": ">" }
  ]
}
```

- [ ] **Step 2: syntaxes ディレクトリを作成する**

Run: `mkdir -p syntaxes`

- [ ] **Step 3: コミット**

```bash
git add language-configuration.json syntaxes/
git commit -m "feat: add language configuration"
```

---

## Task 3: TextMate grammar

**Files:**
- Create: `syntaxes/dmml.tmLanguage.json`
- Create: `syntaxes/dmml.markdown.tmLanguage.json`

- [ ] **Step 1: syntaxes/dmml.tmLanguage.json を作成する**

トークンの優先順位（上から順に適用）：コメント → コレクション → キーワード → 演算子 → 矢印 → オプショナル → 識別子

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
      "match": "\\b(data|behavior)\\b"
    },
    "operators": {
      "name": "keyword.operator.dmml",
      "match": "\\b(AND|OR)\\b"
    },
    "arrow": {
      "name": "keyword.operator.arrow.dmml",
      "match": "->"
    },
    "optional": {
      "name": "keyword.operator.optional.dmml",
      "match": "\\?"
    },
    "identifier": {
      "name": "entity.name.type.dmml",
      "match": "[\\p{L}\\p{N}_]+"
    }
  }
}
```

- [ ] **Step 2: syntaxes/dmml.markdown.tmLanguage.json を作成する**

Markdown の ` ```dmml ` フェンスコードブロックに source.dmml を注入する。

```json
{
  "fileTypes": [],
  "injectionSelector": "L:text.html.markdown",
  "patterns": [
    {
      "begin": "(^|\\G)(\\s*)(`{3,}|~{3,})\\s*(dmml)\\s*$",
      "beginCaptures": {
        "3": { "name": "punctuation.definition.markdown" },
        "4": { "name": "fenced_code.block.language" }
      },
      "end": "(^|\\G)(\\2|\\s{0,3})(\\3)\\s*$",
      "endCaptures": {
        "3": { "name": "punctuation.definition.markdown" }
      },
      "contentName": "meta.embedded.block.dmml",
      "patterns": [{ "include": "source.dmml" }]
    }
  ],
  "scopeName": "markdown.dmml.codeblock"
}
```

- [ ] **Step 3: コミット**

```bash
git add syntaxes/
git commit -m "feat: add TextMate grammar for .dmml and Markdown injection"
```

---

## Task 4: パーサー（TDD）

**Files:**
- Create: `src/__tests__/parser.test.ts`
- Create: `src/parser.ts`

- [ ] **Step 1: src/__tests__/parser.test.ts を作成する（失敗するテスト）**

```typescript
import { parse } from '../parser'

describe('parse - data 定義', () => {
  it('単純な data 定義をパースする', () => {
    const result = parse('data 名前 = 文字列')
    expect(result.errors).toHaveLength(0)
    expect(result.symbols.has('名前')).toBe(true)
    expect(result.symbols.get('名前')!.kind).toBe('data')
  })

  it('複数行の data 定義をパースする', () => {
    const text = 'data 注文 = 注文番号\n  AND 顧客\n  AND 配送先住所'
    const result = parse(text)
    expect(result.errors).toHaveLength(0)
    expect(result.symbols.has('注文')).toBe(true)
  })

  it('OR を含む data 定義をパースする', () => {
    const result = parse('data 連絡先 = メールアドレス OR 電話番号')
    expect(result.errors).toHaveLength(0)
    expect(result.symbols.has('連絡先')).toBe(true)
  })

  it('data の後に識別子がない場合はエラー', () => {
    const result = parse('data')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('識別子')
    expect(result.errors[0].range.start.line).toBe(0)
  })

  it('= がない場合はエラー', () => {
    const result = parse('data 名前')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('=')
  })

  it('= の後に式がない場合はエラー', () => {
    const result = parse('data 名前 =')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('式')
  })
})

describe('parse - behavior 定義', () => {
  it('単純な behavior 定義をパースする', () => {
    const result = parse('behavior 受注する = 注文者 AND 商品 -> 注文')
    expect(result.errors).toHaveLength(0)
    expect(result.symbols.has('受注する')).toBe(true)
    expect(result.symbols.get('受注する')!.kind).toBe('behavior')
  })

  it('behavior に -> がない場合はエラー', () => {
    const result = parse('behavior 受注する = 注文者 AND 商品')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('->')
  })

  it('behavior の後に識別子がない場合はエラー', () => {
    const result = parse('behavior')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('識別子')
  })

  it('-> の前に入力式がない場合はエラー', () => {
    const result = parse('behavior 受注する = -> 注文')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('入力')
  })

  it('-> の後に出力式がない場合はエラー', () => {
    const result = parse('behavior 受注する = 注文者 ->')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('出力')
  })
})

describe('parse - コメントと空行', () => {
  it('コメント行を無視する', () => {
    const result = parse('// これはコメント\ndata 名前 = 文字列')
    expect(result.errors).toHaveLength(0)
    expect(result.symbols.size).toBe(1)
  })

  it('行末のインラインコメントを無視する', () => {
    const result = parse('data 名前 = 文字列 // 2〜100文字')
    expect(result.errors).toHaveLength(0)
    expect(result.symbols.has('名前')).toBe(true)
  })

  it('空行を無視する', () => {
    const result = parse('data 名前 = 文字列\n\ndata 年齢 = 整数')
    expect(result.errors).toHaveLength(0)
    expect(result.symbols.size).toBe(2)
  })
})

describe('parse - シンボル情報', () => {
  it('data のシンボル情報に定義テキストを記録する', () => {
    const result = parse('data 名前 = 文字列')
    const sym = result.symbols.get('名前')!
    expect(sym.definition).toContain('data 名前 = 文字列')
  })

  it('複数行の定義テキストを結合して記録する', () => {
    const text = 'data 注文 = 注文番号\n  AND 顧客'
    const result = parse(text)
    const sym = result.symbols.get('注文')!
    expect(sym.definition).toContain('AND 顧客')
  })

  it('定義の行番号を range に記録する', () => {
    const text = 'data 名前 = 文字列\ndata 年齢 = 整数'
    const result = parse(text)
    expect(result.symbols.get('名前')!.range.start.line).toBe(0)
    expect(result.symbols.get('年齢')!.range.start.line).toBe(1)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test`

Expected: FAIL — "Cannot find module '../parser'"

- [ ] **Step 3: src/parser.ts を作成する**

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
  kind: 'data' | 'behavior'
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

    const isContinuation = /^\s+(AND|OR)\b/.test(stripped) && current !== null

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

export function parse(text: string): ParseResult {
  const symbols = new Map<string, SymbolInfo>()
  const errors: ParseError[] = []
  const rawLines = text.split('\n')

  for (const group of groupLines(rawLines)) {
    const fullText = group.lines.map(l => l.text).join(' ')
    const startLine = group.startLine
    const range = makeRange(startLine, 0, rawLines[startLine].length)

    const dataMatch = /^\s*data(.*)/.exec(fullText)
    const behaviorMatch = /^\s*behavior(.*)/.exec(fullText)

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
    }
  }

  return { symbols, errors }
}
```

- [ ] **Step 4: テストを実行して全件パスを確認する**

Run: `npm test`

Expected: All tests PASS（16 件）

- [ ] **Step 5: コミット**

```bash
git add src/parser.ts src/__tests__/parser.test.ts
git commit -m "feat: add parser with TDD"
```

---

## Task 5: 診断プロバイダー

**Files:**
- Create: `src/diagnosticsProvider.ts`

- [ ] **Step 1: src/diagnosticsProvider.ts を作成する**

```typescript
import * as vscode from 'vscode'
import { parse } from './parser'

export class DmmlDiagnosticsProvider {
  private collection = vscode.languages.createDiagnosticCollection('dmml')

  update(document: vscode.TextDocument): void {
    if (document.languageId !== 'dmml') return

    const { errors } = parse(document.getText())
    const diagnostics = errors.map(err =>
      new vscode.Diagnostic(
        new vscode.Range(
          err.range.start.line, err.range.start.character,
          err.range.end.line, err.range.end.character
        ),
        err.message,
        vscode.DiagnosticSeverity.Error
      )
    )
    this.collection.set(document.uri, diagnostics)
  }

  dispose(): void {
    this.collection.dispose()
  }
}
```

- [ ] **Step 2: コンパイルして型エラーがないことを確認する**

Run: `npm run compile`

Expected: エラーなし。`out/` ディレクトリが生成される。

- [ ] **Step 3: コミット**

```bash
git add src/diagnosticsProvider.ts
git commit -m "feat: add diagnostics provider"
```

---

## Task 6: 補完プロバイダー

**Files:**
- Create: `src/completionProvider.ts`

- [ ] **Step 1: src/completionProvider.ts を作成する**

```typescript
import * as vscode from 'vscode'
import { parse } from './parser'

const KEYWORD_ITEMS = ['data', 'behavior'].map(kw => {
  const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword)
  item.detail = 'dmml keyword'
  return item
})

export class DmmlCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.CompletionItem[] {
    const linePrefix = document.lineAt(position).text.slice(0, position.character)

    // = AND OR -> の後: 既存シンボルを候補に出す
    if (/([=]|\bAND\b|\bOR\b|->)\s*\S*$/.test(linePrefix)) {
      const { symbols } = parse(document.getText())
      return Array.from(symbols.values()).map(sym => {
        const item = new vscode.CompletionItem(sym.name, vscode.CompletionItemKind.TypeParameter)
        item.detail = `${sym.kind}: ${sym.name}`
        return item
      })
    }

    // 行頭: data / behavior キーワードを候補に出す
    if (/^\s*\w*$/.test(linePrefix)) {
      return KEYWORD_ITEMS
    }

    return []
  }
}
```

- [ ] **Step 2: コンパイルして型エラーがないことを確認する**

Run: `npm run compile`

Expected: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add src/completionProvider.ts
git commit -m "feat: add completion provider"
```

---

## Task 7: ホバープロバイダー

**Files:**
- Create: `src/hoverProvider.ts`

- [ ] **Step 1: src/hoverProvider.ts を作成する**

```typescript
import * as vscode from 'vscode'
import { parse } from './parser'

export class DmmlHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | undefined {
    const range = document.getWordRangeAtPosition(position, /[\p{L}\p{N}_]+/u)
    if (!range) return undefined

    const word = document.getText(range)
    const { symbols } = parse(document.getText())
    const sym = symbols.get(word)
    if (!sym) return undefined

    const md = new vscode.MarkdownString()
    md.appendMarkdown(`**${sym.name}**\n\n`)
    md.appendCodeblock(sym.definition, 'dmml')

    return new vscode.Hover(md, range)
  }
}
```

- [ ] **Step 2: コンパイルして型エラーがないことを確認する**

Run: `npm run compile`

Expected: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add src/hoverProvider.ts
git commit -m "feat: add hover provider"
```

---

## Task 8: 拡張機能エントリーポイント

**Files:**
- Create: `src/extension.ts`

- [ ] **Step 1: src/extension.ts を作成する**

```typescript
import * as vscode from 'vscode'
import { DmmlCompletionProvider } from './completionProvider'
import { DmmlHoverProvider } from './hoverProvider'
import { DmmlDiagnosticsProvider } from './diagnosticsProvider'

const SELECTOR: vscode.DocumentSelector = { language: 'dmml' }

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = new DmmlDiagnosticsProvider()

  context.subscriptions.push(
    diagnostics,
    vscode.languages.registerCompletionItemProvider(
      SELECTOR,
      new DmmlCompletionProvider(),
      '=', ' '
    ),
    vscode.languages.registerHoverProvider(SELECTOR, new DmmlHoverProvider()),
    vscode.workspace.onDidChangeTextDocument(e => diagnostics.update(e.document)),
    vscode.workspace.onDidOpenTextDocument(doc => diagnostics.update(doc))
  )

  // すでに開かれているドキュメントにも診断を実行
  vscode.workspace.textDocuments.forEach(doc => diagnostics.update(doc))
}

export function deactivate(): void {}
```

- [ ] **Step 2: コンパイルして型エラーがないことを確認する**

Run: `npm run compile`

Expected: エラーなし。`out/extension.js` が存在する。

- [ ] **Step 3: テストを実行して全件パスを確認する**

Run: `npm test`

Expected: 全テスト PASS。

- [ ] **Step 4: VS Code で手動確認する**

VS Code で `F5` を押して Extension Development Host を起動し、次の内容で `test.dmml` を作成する：

```
// 注文管理ドメイン

data 注文番号 = 文字列

data 注文 = 注文番号
  AND 顧客名
  AND List<注文明細>

behavior 受注する = 注文者 AND 商品 -> 注文

data 壊れた定義 =
behavior 不完全 = 入力のみ
```

確認項目：
- `data`、`behavior` がキーワード色でハイライトされる
- `AND`、`OR` が演算子色でハイライトされる
- `->` が矢印演算子色でハイライトされる
- `// 注文管理ドメイン` がコメント色（グレー）になる
- `List<注文明細>` がコレクション型の色でハイライトされる
- `壊れた定義` と `不完全` の行に赤い波線が表示され、問題パネルにエラーが出る
- `注文番号` にカーソルを当てると定義内容がホバー表示される
- `= ` と入力すると既存シンボルが補完候補として表示される

- [ ] **Step 5: コミット**

```bash
git add src/extension.ts
git commit -m "feat: add extension entry point and wire up all providers"
```
