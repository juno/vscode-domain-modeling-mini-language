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
