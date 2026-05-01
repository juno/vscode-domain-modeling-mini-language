# VS Code 拡張：ドメイン記述ミニ言語 Syntax Highlighting 設計

**日付:** 2026-05-01  
**スコープ:** `.dmml` ファイル向け VS Code 拡張機能（シンタックスハイライト・補完・ホバー・構文エラー検出）

---

## 概要

ドメイン記述ミニ言語（DMML）の `.dmml` ファイルに対して、VS Code 上でのエディター支援を提供する拡張機能を開発する。副次的に Markdown コードブロック内の `dmml` 言語識別子にも対応する。

---

## 対象 DSL の構文概要

```
data <識別子> = <式>
behavior <識別子> = <式> -> <式>
```

**式の構造：**
- `<識別子> AND <識別子> AND ...`（全要素必須）
- `<識別子> OR <識別子> OR ...`（いずれか1つ）
- `List<識別子>`（コレクション）
- `<識別子>?`（オプショナル）

**その他：**
- `//` 以降はコメント
- 識別子は日本語・英語どちらも使用可

---

## 機能スコープ

| 機能 | 内容 |
|---|---|
| シンタックスハイライト | TextMate grammar によるトークンカラーリング |
| コード補完 | キーワード補完・既存識別子からの補完 |
| ホバー表示 | 識別子の定義内容を Markdown で表示 |
| 構文エラー検出 | 構文レベルの不整合を波線・問題パネルに表示 |
| Markdown 埋め込み | コードブロック言語識別子 `dmml` でのハイライト |

意味レベルのエラー検出（未定義型の参照チェックなど）はスコープ外。

---

## アーキテクチャ

### アプローチ

Language Server Protocol（LSP）を使用せず、VS Code 標準 API（`vscode.languages`）を直接使用するシンプルな構成を採用する。VS Code 専用として割り切り、実装コストを最小化する。

### ファイル構成

```
vscode-domain-modeling-mini-language/
├── package.json                  # 拡張機能マニフェスト
├── tsconfig.json
├── src/
│   ├── extension.ts              # エントリーポイント（プロバイダー登録）
│   ├── parser.ts                 # 軽量パーサー（唯一の解析ロジック）
│   ├── completionProvider.ts     # コード補完プロバイダー
│   ├── hoverProvider.ts          # ホバー表示プロバイダー
│   └── diagnosticsProvider.ts   # 構文診断プロバイダー
└── syntaxes/
    └── dmml.tmLanguage.json      # TextMate grammar
```

---

## 各コンポーネントの設計

### TextMate Grammar（`dmml.tmLanguage.json`）

トークンの種類とスコープ名の対応：

| トークン | TextMate スコープ | 例 |
|---|---|---|
| キーワード | `keyword.control.dmml` | `data`、`behavior` |
| 論理演算子 | `keyword.operator.dmml` | `AND`、`OR` |
| 矢印演算子 | `keyword.operator.arrow.dmml` | `->` |
| オプショナル | `keyword.operator.optional.dmml` | `?` |
| コレクション | `support.type.collection.dmml` | `List<...>` |
| コメント | `comment.line.double-slash.dmml` | `// ...` |
| 識別子（型名） | `entity.name.type.dmml` | `注文`、`Order` |

### パーサー（`parser.ts`）

ドキュメント全体を行単位で解析し、シンボルテーブルと構文エラーのリストを返す。他のすべてのプロバイダーはこの結果のみに依存する。

```typescript
interface SymbolInfo {
  name: string
  kind: 'data' | 'behavior'
  definition: string   // 定義行全体のテキスト
  range: vscode.Range  // 定義位置
}

interface ParseResult {
  symbols: Map<string, SymbolInfo>
  errors: SyntaxError[]
}

interface SyntaxError {
  message: string
  range: vscode.Range
}
```

**検出する構文エラー：**
- `data` / `behavior` の後に識別子がない
- `=` の後に式がない
- `behavior` の式に `->` がない
- `AND` / `OR` の後に識別子がない

### 補完プロバイダー（`completionProvider.ts`）

- 行頭：`data`、`behavior` キーワードを提示
- `=` / `AND` / `OR` / `->` の後：`parser.symbols` から既存識別子を候補として提示

### ホバープロバイダー（`hoverProvider.ts`）

識別子にカーソルを当てると `parser.symbols` を参照し、定義内容を Markdown で表示する：

```markdown
**注文**
```
data 注文 = 注文番号 AND 顧客 AND List<注文明細>
```
```

### 診断プロバイダー（`diagnosticsProvider.ts`）

ドキュメントの変更・保存時にパーサーを呼び出し、`errors` を `vscode.Diagnostic` に変換して `DiagnosticCollection` に発行する。

---

## データフロー

```
ドキュメント変更
     ↓
 parser.ts（解析）
     ↓
 ┌───────────────────────┐
 │  ParseResult          │
 │  - symbols            │
 │  - errors             │
 └───────────────────────┘
     ↓               ↓               ↓
completionProvider  hoverProvider  diagnosticsProvider
```

---

## `package.json` の主要設定

- 言語 ID: `dmml`
- ファイル拡張子: `.dmml`
- Markdown コードブロック言語識別子: `dmml`
- アクティベーションイベント: `onLanguage:dmml`
- TextMate grammar の登録

---

## スコープ外

- Language Server Protocol（LSP）対応
- 意味レベルのエラー検出（未定義型参照など）
- フォーマッター
- コードアクション（クイックフィックス）
- VS Code 以外のエディターへの対応
