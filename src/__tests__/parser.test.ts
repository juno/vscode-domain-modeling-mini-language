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
