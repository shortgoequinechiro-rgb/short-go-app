import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

interface LineItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  total: number
}

interface Invoice {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  status: string
  subtotal: number
  tax: number
  total: number
  notes?: string
}

interface Owner {
  full_name: string
  email: string
  phone?: string
  address?: string
}

interface Horse {
  name: string
}

interface Practitioner {
  full_name: string
  practice_name: string
  location: string
}

export async function generateInvoicePdf(
  invoice: Invoice,
  lineItems: LineItem[],
  owner: Owner,
  horse: Horse,
  practitioner: Practitioner
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const page = pdfDoc.addPage([612, 792])
  const { width, height } = page.getSize()

  let yPosition = height - 50

  // Header: Practice info
  page.drawText(practitioner.practice_name, {
    x: 50,
    y: yPosition,
    size: 20,
    font: timesRomanBoldFont,
    color: rgb(0, 0, 0),
  })
  yPosition -= 25

  page.drawText(practitioner.full_name, {
    x: 50,
    y: yPosition,
    size: 11,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  })
  yPosition -= 18

  page.drawText(practitioner.location, {
    x: 50,
    y: yPosition,
    size: 10,
    font: timesRomanFont,
    color: rgb(0.3, 0.3, 0.3),
  })
  yPosition -= 35

  // Invoice metadata section
  page.drawText('INVOICE', {
    x: 50,
    y: yPosition,
    size: 16,
    font: timesRomanBoldFont,
    color: rgb(0, 0, 0),
  })
  yPosition -= 25

  // Metadata in two columns
  const metadataLeft = 50
  const metadataRight = 350

  page.drawText('Invoice #:', {
    x: metadataLeft,
    y: yPosition,
    size: 10,
    font: timesRomanBoldFont,
    color: rgb(0, 0, 0),
  })
  page.drawText(invoice.invoice_number, {
    x: metadataLeft + 80,
    y: yPosition,
    size: 10,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  })

  page.drawText('Date:', {
    x: metadataRight,
    y: yPosition,
    size: 10,
    font: timesRomanBoldFont,
    color: rgb(0, 0, 0),
  })
  page.drawText(new Date(invoice.invoice_date).toLocaleDateString(), {
    x: metadataRight + 50,
    y: yPosition,
    size: 10,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  })
  yPosition -= 18

  page.drawText('Due Date:', {
    x: metadataLeft,
    y: yPosition,
    size: 10,
    font: timesRomanBoldFont,
    color: rgb(0, 0, 0),
  })
  page.drawText(new Date(invoice.due_date).toLocaleDateString(), {
    x: metadataLeft + 80,
    y: yPosition,
    size: 10,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  })

  page.drawText('Status:', {
    x: metadataRight,
    y: yPosition,
    size: 10,
    font: timesRomanBoldFont,
    color: rgb(0, 0, 0),
  })
  page.drawText(invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1), {
    x: metadataRight + 50,
    y: yPosition,
    size: 10,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  })
  yPosition -= 30

  // Bill To section
  page.drawText('BILL TO', {
    x: 50,
    y: yPosition,
    size: 11,
    font: timesRomanBoldFont,
    color: rgb(0, 0, 0),
  })
  yPosition -= 18

  page.drawText(owner.full_name, {
    x: 50,
    y: yPosition,
    size: 10,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  })
  yPosition -= 16

  if (owner.email) {
    page.drawText(owner.email, {
      x: 50,
      y: yPosition,
      size: 9,
      font: timesRomanFont,
      color: rgb(0.3, 0.3, 0.3),
    })
    yPosition -= 14
  }

  if (owner.phone) {
    page.drawText(owner.phone, {
      x: 50,
      y: yPosition,
      size: 9,
      font: timesRomanFont,
      color: rgb(0.3, 0.3, 0.3),
    })
    yPosition -= 14
  }

  if (owner.address) {
    page.drawText(owner.address, {
      x: 50,
      y: yPosition,
      size: 9,
      font: timesRomanFont,
      color: rgb(0.3, 0.3, 0.3),
    })
    yPosition -= 14
  }

  yPosition -= 10

  // Patient section
  page.drawText('PATIENT', {
    x: 50,
    y: yPosition,
    size: 11,
    font: timesRomanBoldFont,
    color: rgb(0, 0, 0),
  })
  yPosition -= 18

  page.drawText(horse.name, {
    x: 50,
    y: yPosition,
    size: 10,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  })
  yPosition -= 30

  // Line items table header
  const tableX = 50
  const col1 = tableX
  const col2 = tableX + 200
  const col3 = tableX + 320
  const col4 = tableX + 400
  const col5 = tableX + 480

  page.drawText('#', {
    x: col1,
    y: yPosition,
    size: 10,
    font: timesRomanBoldFont,
    color: rgb(0, 0, 0),
  })

  page.drawText('Description', {
    x: col2,
    y: yPosition,
    size: 10,
    font: timesRomanBoldFont,
    color: rgb(0, 0, 0),
  })

  page.drawText('Qty', {
    x: col3,
    y: yPosition,
    size: 10,
    font: timesRomanBoldFont,
    color: rgb(0, 0, 0),
  })

  page.drawText('Unit Price', {
    x: col4,
    y: yPosition,
    size: 10,
    font: timesRomanBoldFont,
    color: rgb(0, 0, 0),
  })

  page.drawText('Total', {
    x: col5,
    y: yPosition,
    size: 10,
    font: timesRomanBoldFont,
    color: rgb(0, 0, 0),
  })
  yPosition -= 18

  // Horizontal line
  page.drawLine({
    start: { x: 50, y: yPosition },
    end: { x: 562, y: yPosition },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  })
  yPosition -= 15

  // Line items
  lineItems.forEach((item, index) => {
    page.drawText(String(index + 1), {
      x: col1,
      y: yPosition,
      size: 9,
      font: timesRomanFont,
      color: rgb(0, 0, 0),
    })

    page.drawText(item.description, {
      x: col2,
      y: yPosition,
      size: 9,
      font: timesRomanFont,
      color: rgb(0, 0, 0),
    })

    page.drawText(String(item.quantity), {
      x: col3,
      y: yPosition,
      size: 9,
      font: timesRomanFont,
      color: rgb(0, 0, 0),
    })

    page.drawText(`$${item.unit_price.toFixed(2)}`, {
      x: col4,
      y: yPosition,
      size: 9,
      font: timesRomanFont,
      color: rgb(0, 0, 0),
    })

    page.drawText(`$${item.total.toFixed(2)}`, {
      x: col5,
      y: yPosition,
      size: 9,
      font: timesRomanFont,
      color: rgb(0, 0, 0),
    })

    yPosition -= 18
  })

  yPosition -= 10

  // Horizontal line before totals
  page.drawLine({
    start: { x: 50, y: yPosition },
    end: { x: 562, y: yPosition },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  })
  yPosition -= 20

  // Totals section (right-aligned)
  const totalsX = 400

  page.drawText('Subtotal:', {
    x: totalsX,
    y: yPosition,
    size: 10,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  })
  page.drawText(`$${invoice.subtotal.toFixed(2)}`, {
    x: 520,
    y: yPosition,
    size: 10,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  })
  yPosition -= 18

  if (invoice.tax > 0) {
    page.drawText('Tax:', {
      x: totalsX,
      y: yPosition,
      size: 10,
      font: timesRomanFont,
      color: rgb(0, 0, 0),
    })
    page.drawText(`$${invoice.tax.toFixed(2)}`, {
      x: 520,
      y: yPosition,
      size: 10,
      font: timesRomanFont,
      color: rgb(0, 0, 0),
    })
    yPosition -= 18
  }

  // Total due or paid
  const totalLabel = invoice.status === 'paid' ? 'TOTAL PAID' : 'TOTAL DUE'
  page.drawText(totalLabel, {
    x: totalsX,
    y: yPosition,
    size: 11,
    font: timesRomanBoldFont,
    color: rgb(0, 0, 0),
  })
  page.drawText(`$${invoice.total.toFixed(2)}`, {
    x: 520,
    y: yPosition,
    size: 11,
    font: timesRomanBoldFont,
    color: rgb(0, 0, 0),
  })

  yPosition -= 40

  // Notes section
  if (invoice.notes) {
    page.drawText('Notes:', {
      x: 50,
      y: yPosition,
      size: 10,
      font: timesRomanBoldFont,
      color: rgb(0, 0, 0),
    })
    yPosition -= 16

    // Word wrap notes
    const maxWidth = 512
    const words = invoice.notes.split(' ')
    let currentLine = ''

    words.forEach((word) => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word
      const width = timesRomanFont.widthOfTextAtSize(testLine, 9)

      if (width > maxWidth) {
        if (currentLine) {
          page.drawText(currentLine, {
            x: 50,
            y: yPosition,
            size: 9,
            font: timesRomanFont,
            color: rgb(0.3, 0.3, 0.3),
          })
          yPosition -= 14
        }
        currentLine = word
      } else {
        currentLine = testLine
      }
    })

    if (currentLine) {
      page.drawText(currentLine, {
        x: 50,
        y: yPosition,
        size: 9,
        font: timesRomanFont,
        color: rgb(0.3, 0.3, 0.3),
      })
    }
  }

  // Footer
  page.drawLine({
    start: { x: 50, y: 60 },
    end: { x: 562, y: 60 },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.9),
  })

  page.drawText('Thank you for your business.', {
    x: 50,
    y: 40,
    size: 9,
    font: timesRomanFont,
    color: rgb(0.5, 0.5, 0.5),
  })

  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}
