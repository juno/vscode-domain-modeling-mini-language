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
