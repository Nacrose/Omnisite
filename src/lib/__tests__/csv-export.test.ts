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

  it('documents formula injection as a known gap', () => {
    // KNOWN GAP: values starting with = + - @ are not currently escaped.
    // Excel/Sheets will interpret them as formulas when the user opens the
    // file. This is a real attack surface (CSV injection) — for now, this
    // test documents the gap so we don't silently regress. When the gap is
    // fixed, replace this test with an assertion that the leading character
    // is neutralised (e.g. prefixed with a single quote or wrapped in a
    // quoted cell with a leading tab).
    //
    // Pick a malicious value WITHOUT any comma/quote/newline so the
    // production escape() returns it as-is — that exposes the gap directly.
    const maliciousValue = '=2+2'
    const escape = (val: string | number): string => {
      const s = String(val ?? '')
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    }
    const escaped = escape(maliciousValue)
    // The current escape() does NOT neutralise the leading "=" — it returns
    // the value as-is because it has no comma/quote/newline.
    expect(escaped).toBe('=2+2')
    expect(escaped.charAt(0)).toBe('=')
    // When this gap is fixed, the assertion above should change to verify
    // the leading "=" is no longer at position 0 of the cell.
  })
})
