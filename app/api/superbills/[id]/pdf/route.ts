import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: superbillId } = await params

    const { data: superbill, error } = await supabase
      .from('superbills')
      .select('*')
      .eq('id', superbillId)
      .single()

    if (error || !superbill) {
      return NextResponse.json(
        { error: 'Superbill not found' },
        { status: 404 }
      )
    }

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([612, 792]) // 8.5" x 11"
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const colors = {
      dark: rgb(0.05, 0.07, 0.13), // #081120
      darkCard: rgb(0.05, 0.11, 0.19), // #0d1b30
      border: rgb(0.1, 0.2, 0.33), // #1a3358
      accent: rgb(0.79, 0.64, 0.15), // #c9a227
      text: rgb(1, 1, 1),
      lightText: rgb(0.5, 0.5, 0.5),
    }

    let yPosition = 750

    // Header
    page.drawText('SUPERBILL', {
      x: 50,
      y: yPosition,
      size: 24,
      font: boldFont,
      color: colors.accent,
    })

    yPosition -= 30

    // Provider Block
    page.drawText('PROVIDER INFORMATION', {
      x: 50,
      y: yPosition,
      size: 10,
      font: boldFont,
      color: colors.accent,
    })
    yPosition -= 15

    page.drawText(superbill.provider_name || '', {
      x: 50,
      y: yPosition,
      size: 10,
      font,
      color: colors.text,
    })
    yPosition -= 12

    page.drawText(`NPI: ${superbill.provider_npi || ''}`, {
      x: 50,
      y: yPosition,
      size: 9,
      font,
      color: colors.lightText,
    })
    yPosition -= 12

    page.drawText(`Tax ID: ${superbill.provider_tax_id || ''}`, {
      x: 50,
      y: yPosition,
      size: 9,
      font,
      color: colors.lightText,
    })

    // Practice Block (right side)
    let practiceY = 750
    page.drawText('PRACTICE INFORMATION', {
      x: 350,
      y: practiceY,
      size: 10,
      font: boldFont,
      color: colors.accent,
    })
    practiceY -= 15

    page.drawText(superbill.practice_name || '', {
      x: 350,
      y: practiceY,
      size: 10,
      font,
      color: colors.text,
    })
    practiceY -= 12

    page.drawText(superbill.practice_address || '', {
      x: 350,
      y: practiceY,
      size: 9,
      font,
      color: colors.lightText,
    })
    practiceY -= 12

    page.drawText(superbill.practice_phone || '', {
      x: 350,
      y: practiceY,
      size: 9,
      font,
      color: colors.lightText,
    })

    yPosition = 650

    // Horizontal line
    page.drawLine({
      start: { x: 50, y: yPosition },
      end: { x: 562, y: yPosition },
      thickness: 1,
      color: colors.border,
    })

    yPosition -= 20

    // Patient Block
    page.drawText('PATIENT INFORMATION', {
      x: 50,
      y: yPosition,
      size: 10,
      font: boldFont,
      color: colors.accent,
    })
    yPosition -= 15

    page.drawText(`Name: ${superbill.patient_name || ''}`, {
      x: 50,
      y: yPosition,
      size: 9,
      font,
      color: colors.text,
    })
    yPosition -= 12

    page.drawText(`DOB: ${superbill.patient_dob || ''}`, {
      x: 50,
      y: yPosition,
      size: 9,
      font,
      color: colors.text,
    })
    yPosition -= 12

    page.drawText(`Address: ${superbill.patient_address || ''}`, {
      x: 50,
      y: yPosition,
      size: 9,
      font,
      color: colors.text,
    })
    yPosition -= 12

    page.drawText(`Phone: ${superbill.patient_phone || ''}`, {
      x: 50,
      y: yPosition,
      size: 9,
      font,
      color: colors.text,
    })

    // Insurance Block (right side)
    let insuranceY = 650 - 20
    page.drawText('INSURANCE INFORMATION', {
      x: 350,
      y: insuranceY,
      size: 10,
      font: boldFont,
      color: colors.accent,
    })
    insuranceY -= 15

    page.drawText(`Provider: ${superbill.insurance_provider || ''}`, {
      x: 350,
      y: insuranceY,
      size: 9,
      font,
      color: colors.text,
    })
    insuranceY -= 12

    page.drawText(`Policy #: ${superbill.insurance_id || ''}`, {
      x: 350,
      y: insuranceY,
      size: 9,
      font,
      color: colors.text,
    })
    insuranceY -= 12

    page.drawText(`Group #: ${superbill.insurance_group || ''}`, {
      x: 350,
      y: insuranceY,
      size: 9,
      font,
      color: colors.text,
    })

    yPosition -= 80

    // Horizontal line
    page.drawLine({
      start: { x: 50, y: yPosition },
      end: { x: 562, y: yPosition },
      thickness: 1,
      color: colors.border,
    })

    yPosition -= 20

    // Diagnosis Codes Table
    page.drawText('DIAGNOSIS CODES', {
      x: 50,
      y: yPosition,
      size: 10,
      font: boldFont,
      color: colors.accent,
    })
    yPosition -= 15

    const diagnosisCodes = Array.isArray(superbill.diagnosis_codes)
      ? superbill.diagnosis_codes
      : []

    diagnosisCodes.forEach((code: any) => {
      page.drawText(`${code.code} - ${code.description || ''}`, {
        x: 50,
        y: yPosition,
        size: 9,
        font,
        color: colors.text,
      })
      yPosition -= 12
    })

    yPosition -= 10

    // Horizontal line
    page.drawLine({
      start: { x: 50, y: yPosition },
      end: { x: 562, y: yPosition },
      thickness: 1,
      color: colors.border,
    })

    yPosition -= 20

    // Procedure Codes Table
    page.drawText('PROCEDURE CODES', {
      x: 50,
      y: yPosition,
      size: 10,
      font: boldFont,
      color: colors.accent,
    })
    yPosition -= 15

    // Table headers
    page.drawText('Code', {
      x: 50,
      y: yPosition,
      size: 9,
      font: boldFont,
      color: colors.accent,
    })
    page.drawText('Description', {
      x: 120,
      y: yPosition,
      size: 9,
      font: boldFont,
      color: colors.accent,
    })
    page.drawText('Units', {
      x: 350,
      y: yPosition,
      size: 9,
      font: boldFont,
      color: colors.accent,
    })
    page.drawText('Fee', {
      x: 420,
      y: yPosition,
      size: 9,
      font: boldFont,
      color: colors.accent,
    })
    page.drawText('Total', {
      x: 500,
      y: yPosition,
      size: 9,
      font: boldFont,
      color: colors.accent,
    })

    yPosition -= 12

    const procedureCodes = Array.isArray(superbill.procedure_codes)
      ? superbill.procedure_codes
      : []

    procedureCodes.forEach((code: any) => {
      const totalFee = (code.fee || 0) * (code.units || 1)

      page.drawText(code.code || '', {
        x: 50,
        y: yPosition,
        size: 9,
        font,
        color: colors.text,
      })
      page.drawText(code.description || '', {
        x: 120,
        y: yPosition,
        size: 9,
        font,
        color: colors.text,
      })
      page.drawText((code.units || '1').toString(), {
        x: 350,
        y: yPosition,
        size: 9,
        font,
        color: colors.text,
      })
      page.drawText(`$${(code.fee || 0).toFixed(2)}`, {
        x: 420,
        y: yPosition,
        size: 9,
        font,
        color: colors.text,
      })
      page.drawText(`$${totalFee.toFixed(2)}`, {
        x: 500,
        y: yPosition,
        size: 9,
        font,
        color: colors.text,
      })
      yPosition -= 12
    })

    yPosition -= 15

    // Horizontal line
    page.drawLine({
      start: { x: 50, y: yPosition },
      end: { x: 562, y: yPosition },
      thickness: 1,
      color: colors.border,
    })

    yPosition -= 15

    // Totals
    page.drawText('Total Fee:', {
      x: 400,
      y: yPosition,
      size: 10,
      font: boldFont,
      color: colors.text,
    })
    page.drawText(`$${(superbill.total_fee || 0).toFixed(2)}`, {
      x: 500,
      y: yPosition,
      size: 10,
      font: boldFont,
      color: colors.accent,
    })

    yPosition -= 15

    page.drawText('Amount Paid:', {
      x: 400,
      y: yPosition,
      size: 10,
      font: boldFont,
      color: colors.text,
    })
    page.drawText(`$${(superbill.amount_paid || 0).toFixed(2)}`, {
      x: 500,
      y: yPosition,
      size: 10,
      font: boldFont,
      color: colors.text,
    })

    yPosition -= 15

    page.drawText('Balance Due:', {
      x: 400,
      y: yPosition,
      size: 10,
      font: boldFont,
      color: colors.text,
    })
    page.drawText(`$${(superbill.balance_due || 0).toFixed(2)}`, {
      x: 500,
      y: yPosition,
      size: 10,
      font: boldFont,
      color: colors.accent,
    })

    yPosition -= 25

    // Signature line
    page.drawLine({
      start: { x: 50, y: yPosition },
      end: { x: 200, y: yPosition },
      thickness: 1,
      color: colors.border,
    })

    yPosition -= 10

    page.drawText('Provider Signature', {
      x: 50,
      y: yPosition,
      size: 8,
      font,
      color: colors.lightText,
    })

    // Generate PDF
    const pdfBytes = await pdfDoc.save()

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="superbill-${superbillId}.pdf"`,
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
