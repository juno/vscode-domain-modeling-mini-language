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
