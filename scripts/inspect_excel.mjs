// Inspector rápido del Excel
import XLSX from 'xlsx'

const wb = XLSX.readFile('data/01_ESCANDALLO.xlsx', { cellDates: true })
console.log('Total sheets:', wb.SheetNames.length)
console.log('First 15:', wb.SheetNames.slice(0, 15))

const eps = wb.SheetNames.filter(n => n.startsWith('EPS'))
const recs = wb.SheetNames.filter(n => n.startsWith('REC'))
console.log(`EPS sheets: ${eps.length}, REC sheets: ${recs.length}`)

// Inspect first EPS sheet structure
if (eps.length) {
  const ws = wb.Sheets[eps[0]]
  console.log(`\n=== ${eps[0]} ===`)
  for (let r = 1; r <= 10; r++) {
    const row = []
    for (let c = 0; c < 8; c++) {
      const cell = XLSX.utils.encode_cell({ r: r - 1, c })
      const v = ws[cell]?.v
      row.push(v === undefined ? '·' : String(v).slice(0, 20))
    }
    console.log(`R${r}:`, row.join(' | '))
  }
}

if (recs.length) {
  const ws = wb.Sheets[recs[0]]
  console.log(`\n=== ${recs[0]} ===`)
  for (let r = 1; r <= 10; r++) {
    const row = []
    for (let c = 0; c < 8; c++) {
      const cell = XLSX.utils.encode_cell({ r: r - 1, c })
      const v = ws[cell]?.v
      row.push(v === undefined ? '·' : String(v).slice(0, 20))
    }
    console.log(`R${r}:`, row.join(' | '))
  }
}
