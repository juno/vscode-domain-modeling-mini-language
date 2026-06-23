import { parse, SymbolInfo, Range } from './parser'

export interface SymbolEntry {
  name: string
  kind: SymbolInfo['kind']
  range: Range
}

export function buildDocumentSymbols(text: string): SymbolEntry[] {
  const { symbols } = parse(text)
  return Array.from(symbols.values()).filter(
    s => s.kind === 'data' || s.kind === 'behavior'
  )
}

// vscode API に依存する部分は extension.ts から使うためここでは型だけ参照
import type * as vscode from 'vscode'

function toVscodeRange(vscodeModule: typeof vscode, range: Range): vscode.Range {
  return new vscodeModule.Range(
    range.start.line, range.start.character,
    range.end.line, range.end.character
  )
}

export function createDocumentSymbolProvider(vscodeModule: typeof vscode): vscode.DocumentSymbolProvider {
  return {
    provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
      return buildDocumentSymbols(document.getText()).map(entry => {
        const kind = entry.kind === 'data'
          ? vscodeModule.SymbolKind.Struct
          : vscodeModule.SymbolKind.Function
        const range = toVscodeRange(vscodeModule, entry.range)
        return new vscodeModule.DocumentSymbol(entry.name, entry.kind, kind, range, range)
      })
    }
  }
}
