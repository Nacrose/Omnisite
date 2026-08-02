import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportToCsv } from '@/lib/csv-export'

// Real tests for exportToCsv — mock URL.createObjectURL + the anchor's
// click() method so we can capture the blob content and verify the download.

interface CapturedDownload {
  blob: Blob
  download: string | null
  href: string | null
  clicked: boolean
}

describe('CSV Export', () => {
  let captured: CapturedDownload | null = null
  let originalCreateObjectUrl: typeof URL.createObjectURL
  let originalRevokeObjectUrl: typeof URL.revokeObjectURL

  beforeEach(() => {
    captured = null

    // jsdom doesn't implement URL.createObjectURL. Provide a stub that
    // stashes the Blob so the test can inspect its content.
    originalCreateObjectUrl = URL.createObjectURL
    originalRevokeObjectUrl = URL.revokeObjectURL
    URL.createObjectURL = vi.fn((blob: Blob) => 'blob:fake-url')

    // Stub HTMLAnchorElement.prototype.click so we don't try to navigate.
    // Capture the anchor's attributes at click time.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      captured = {
        blob: (URL.createObjectURL as unknown as ReturnType<typeof vi.fn>).mock
          .calls[0]?.[0] as Blob,
        download: this.getAttribute('download'),
        href: this.getAttribute('href'),
        clicked: true,
      }
    })
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectUrl
    URL.revokeObjectURL = originalRevokeObjectUrl
    vi.restoreAllMocks()
  })

  // Helper — read the captured blob's CSV text + raw bytes.
  async function readCsv(): Promise<{
    csv: string
    rawBytes: Uint8Array
    download: string | null
  }> {
    // exportToCsv runs synchronously, so the click handler has already fired
    // by the time it returns. The blob.text() call is async though.
    if (!captured) throw new Error('No download was captured')
    const csv = await captured.blob.text()
    const buf = await captured.blob.arrayBuffer()
    const rawBytes = new Uint8Array(buf)
    return { csv, rawBytes, download: captured.download }
  }

  it('exports a CSV with headers and rows', async () => {
    exportToCsv(
      'test.csv',
      ['Name', 'Qty', 'Rate'],
      [
        ['Sand', 10, 500],
        ['Cement', 5, 1200],
      ]
    )

    const { csv } = await readCsv()
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Name,Qty,Rate')
    expect(lines[1]).toBe('Sand,10,500')
    expect(lines[2]).toBe('Cement,5,1200')
    expect(lines.length).toBe(3)
  })

  it('wraps values containing commas in double quotes', async () => {
    exportToCsv('test.csv', ['Description'], [['Concrete, M25 grade']])
    const { csv } = await readCsv()
    expect(csv.split('\n')[1]).toBe('"Concrete, M25 grade"')
  })

  it('doubles any double quotes inside quoted values', async () => {
    exportToCsv('test.csv', ['Description'], [['He said "hello" to me']])
    const { csv } = await readCsv()
    // The value should be wrapped in quotes and inner quotes doubled.
    expect(csv.split('\n')[1]).toBe('"He said ""hello"" to me"')
  })

  it('wraps values containing newlines in double quotes', async () => {
    exportToCsv('test.csv', ['Description'], [['Line 1\nLine 2']])
    const { csv } = await readCsv()
    // The BOM may be present at the start of the string — strip it before
    // checking the cell content. The value spans two lines inside a single
    // quoted cell that starts after the header row.
    const stripped = csv.replace(/^\uFEFF/, '')
    // The first line is the header "Description", then the quoted cell starts.
    // A newline inside a quoted cell does NOT split rows — the CSV parser
    // sees it as a single record. Here we just verify the quoted multi-line
    // cell appears verbatim somewhere in the CSV body.
    expect(stripped).toContain('"Line 1\nLine 2"')
    // And the opening quote should immediately follow the header newline.
    expect(stripped).toContain('Description\n"Line 1\nLine 2"')
  })

  it('prepends a UTF-8 BOM to the raw bytes (Excel compatibility)', async () => {
    exportToCsv('test.csv', ['Name'], [['Test']])
    const { rawBytes } = await readCsv()
    // BOM is 0xEF 0xBB 0xBF (U+FEFF in UTF-8). Read raw bytes via
    // arrayBuffer() — blob.text() would strip the BOM during UTF-8 decoding.
    expect(rawBytes[0]).toBe(0xef)
    expect(rawBytes[1]).toBe(0xbb)
    expect(rawBytes[2]).toBe(0xbf)
  })

  it('calls URL.createObjectURL with a Blob of type text/csv', () => {
    exportToCsv('test.csv', ['Name'], [['Test']])
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    const blobArg = (URL.createObjectURL as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Blob
    expect(blobArg).toBeInstanceOf(Blob)
    expect(blobArg.type).toBe('text/csv;charset=utf-8;')
  })

  it('creates an anchor with the correct download attribute and clicks it', async () => {
    exportToCsv('report.csv', ['Name'], [['Test']])
    const { download } = await readCsv()
    expect(download).toBe('report.csv')
    expect(captured?.clicked).toBe(true)
    expect(captured?.href).toBe('blob:fake-url')
  })

  it('handles numbers, nullish, and string values uniformly', async () => {
    // null/undefined become empty strings via the String(val ?? '') coercion.
    exportToCsv(
      'test.csv',
      ['Str', 'Num', 'Undef'],
      [['hello' as string, 42 as number, undefined as unknown as string]]
    )
    const { csv } = await readCsv()
    expect(csv.split('\n')[1]).toBe('hello,42,')
  })

  it('neutralises CSV injection from values starting with = + - @', async () => {
    // OWASP CSV injection: values starting with =, +, -, or @ are
    // interpreted as formulas by Excel / Sheets when the file is opened.
    // exportToCsv prefixes a single quote to such values so the cell is
    // treated as text. Previously this test documented the gap; it now
    // guards the fix. All four dangerous characters are exercised in a
    // single exportToCsv call so the readCsv() helper (which captures the
    // first call's blob) sees all of them.
    exportToCsv('test.csv', ['Description'], [['=2+2'], ['+1+1'], ['-1+1'], ['@SUM(A1:A2)']])
    const { csv } = await readCsv()
    const stripped = csv.replace(/^\uFEFF/, '')
    const lines = stripped.split('\n')
    // Header, then four mitigated data lines.
    expect(lines[0]).toBe('Description')
    expect(lines[1]).toBe("'=2+2")
    expect(lines[2]).toBe("'+1+1")
    expect(lines[3]).toBe("'-1+1")
    expect(lines[4]).toBe("'@SUM(A1:A2)")
    // The dangerous leading character must NOT be at position 0 of the cell
    // — the single-quote prefix shifts it one position right on every row.
    for (let i = 1; i <= 4; i++) {
      expect(lines[i].charAt(0)).toBe("'")
    }
  })

  it('does not over-escape values that merely contain a hyphen mid-string', async () => {
    // Sanity check: the CSV-injection regex must only fire on a LEADING
    // dangerous character. A description like "River Sand - Trishuli" has a
    // hyphen but starts with "R" — it must be written verbatim, no quote
    // prefix.
    exportToCsv('test.csv', ['Description'], [['River Sand - Trishuli']])
    const { csv } = await readCsv()
    expect(csv.replace(/^\uFEFF/, '').split('\n')[1]).toBe('River Sand - Trishuli')
  })
})
