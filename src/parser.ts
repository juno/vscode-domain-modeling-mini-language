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
