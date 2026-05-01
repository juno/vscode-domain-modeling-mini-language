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
