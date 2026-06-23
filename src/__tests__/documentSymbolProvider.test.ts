import { buildDocumentSymbols } from '../documentSymbolProvider'

describe('buildDocumentSymbols - data 定義', () => {
  it('data 定義がシンボルとして返される', () => {
    const symbols = buildDocumentSymbols('data 名前 = 文字列')
    expect(symbols).toHaveLength(1)
    expect(symbols[0].name).toBe('名前')
    expect(symbols[0].kind).toBe('data')
  })

  it('複数の data 定義がすべて返される', () => {
    const symbols = buildDocumentSymbols('data 名前 = 文字列\ndata 年齢 = 整数')
    expect(symbols).toHaveLength(2)
    const names = symbols.map(s => s.name)
    expect(names).toContain('名前')
    expect(names).toContain('年齢')
  })
})

describe('buildDocumentSymbols - behavior 定義', () => {
  it('behavior 定義がシンボルとして返される', () => {
    const symbols = buildDocumentSymbols('behavior 受注する = 注文者 AND 商品 -> 注文')
    expect(symbols).toHaveLength(1)
    expect(symbols[0].name).toBe('受注する')
    expect(symbols[0].kind).toBe('behavior')
  })
})

describe('buildDocumentSymbols - data と behavior の混在', () => {
  it('data と behavior が両方返される', () => {
    const text = 'data 注文 = 注文番号 AND 顧客\nbehavior 受注する = 注文者 -> 注文'
    const symbols = buildDocumentSymbols(text)
    expect(symbols).toHaveLength(2)
    const kinds = symbols.map(s => s.kind)
    expect(kinds).toContain('data')
    expect(kinds).toContain('behavior')
  })
})

describe('buildDocumentSymbols - エラーのある定義', () => {
  it('パースエラーがあってもシンボルが返されない（エラー行は除外）', () => {
    const symbols = buildDocumentSymbols('data\ndata 名前 = 文字列')
    expect(symbols.some(s => s.name === '名前')).toBe(true)
  })
})

describe('buildDocumentSymbols - range', () => {
  it('シンボルの行番号が正しい', () => {
    const text = 'data 名前 = 文字列\ndata 年齢 = 整数'
    const symbols = buildDocumentSymbols(text)
    const 名前 = symbols.find(s => s.name === '名前')!
    const 年齢 = symbols.find(s => s.name === '年齢')!
    expect(名前.range.start.line).toBe(0)
    expect(年齢.range.start.line).toBe(1)
  })
})
