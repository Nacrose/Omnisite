/**
 * CSV export utility — generates a CSV string and triggers a browser download.
 * No external dependencies — pure string manipulation.
 */

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  // Escape values: wrap in quotes if they contain commas, quotes, or newlines
  const escape = (val: string | number): string => {
    const s = String(val ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const csv = [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))].join(
    '\n'
  )

  // Add BOM for Excel UTF-8 compatibility
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
