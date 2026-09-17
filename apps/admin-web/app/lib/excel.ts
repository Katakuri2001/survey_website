export interface ExcelColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
}

function escapeXml(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '<Cell/>'
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`
  }
  return `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`
}

export function exportToExcel<T>(
  filename: string,
  sheetName: string,
  columns: ExcelColumn<T>[],
  rows: T[],
): void {
  const header = `<Row>${columns.map(c => cell(c.header)).join('')}</Row>`
  const body = rows
    .map(row => `<Row>${columns.map(c => cell(c.value(row))).join('')}</Row>`)
    .join('')

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table>
   ${header}
   ${body}
  </Table>
 </Worksheet>
</Workbook>`

  const blob = new Blob(['\ufeff', xml], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
