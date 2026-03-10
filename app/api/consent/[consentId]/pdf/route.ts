import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// ── Agreement items (mirrors the consent form page) ───────────────────────────

const AGREEMENT_ITEMS = [
  {
    key: 'scope',
    text: 'I understand that Short-Go Equine Chiropractic provides animal chiropractic care and that this service is complementary to, and not a replacement for, conventional veterinary care.',
  },
  {
    key: 'risks',
    text: 'I acknowledge that, as with any hands-on therapy, there are inherent risks associated with chiropractic treatment, and I consent to care being provided under these conditions.',
  },
  {
    key: 'records',
    text: 'I authorize Short-Go Equine Chiropractic to create and retain health records for my animal(s) and to contact me regarding follow-up care and scheduling.',
  },
  {
    key: 'photos',
    text: 'I understand that clinical photographs and notes may be taken during sessions for the purpose of record-keeping and treatment planning.',
  },
  {
    key: 'payment',
    text: 'I agree to be responsible for all fees associated with care provided to my animal(s) at the time of service.',
  },
]

// ── Supabase admin client ─────────────────────────────────────────────────────

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables.')
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

// ── Logo loader ───────────────────────────────────────────────────────────────

async function embedLogo(pdfDoc: PDFDocument) {
  const possibleFiles = [
    path.join(process.cwd(), 'public', 'logo.png'),
    path.join(process.cwd(), 'public', 'logo.jpg'),
    path.join(process.cwd(), 'public', 'logo.jpeg'),
    path.join(process.cwd(), 'public', 'short-go-logo.png'),
    path.join(process.cwd(), 'public', 'short-go-logo.jpg'),
    path.join(process.cwd(), 'public', 'short-go-logo.jpeg'),
  ]
  for (const filePath of possibleFiles) {
    if (fs.existsSync(filePath)) {
      try {
        const bytes = fs.readFileSync(filePath)
        const ext = path.extname(filePath).toLowerCase()
        return ext === '.jpg' || ext === '.jpeg'
          ? await pdfDoc.embedJpg(bytes)
          : await pdfDoc.embedPng(bytes)
      } catch {
        return null
      }
    }
  }
  return null
}

// ── Text wrapping ─────────────────────────────────────────────────────────────

function wrapText(text: string, maxChars = 88): string[] {
  if (!text) return ['—']
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars) {
      if (current) lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['—']
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ consentId: string }> }
) {
  try {
    const { consentId } = await params
    const supabase = getAdminSupabase()

    // Fetch the consent form and join owner info
    const { data: consent, error: consentError } = await supabase
      .from('consent_forms')
      .select(`
        id,
        signed_name,
        signed_at,
        form_version,
        horses_acknowledged,
        notes,
        signature_data,
        owners (
          full_name,
          phone,
          email,
          address
        )
      `)
      .eq('id', consentId)
      .single()

    if (consentError || !consent) {
      return NextResponse.json({ error: 'Consent form not found.' }, { status: 404 })
    }

    const owner = consent.owners as { full_name: string; phone: string | null; email: string | null; address: string | null } | null

    // ── Build PDF ─────────────────────────────────────────────────────────────

    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const logoImage = await embedLogo(pdfDoc)

    const pageWidth = 612
    const pageHeight = 792
    const margin = 48
    const contentWidth = pageWidth - margin * 2

    let page = pdfDoc.addPage([pageWidth, pageHeight])
    let y = pageHeight - margin

    const colors = {
      text:      rgb(0.14, 0.14, 0.14),
      muted:     rgb(0.42, 0.42, 0.42),
      line:      rgb(0.85, 0.86, 0.88),
      soft:      rgb(0.95, 0.96, 0.97),
      dark:      rgb(0.08, 0.08, 0.08),
      emerald:   rgb(0.06, 0.53, 0.35),
      emeraldBg: rgb(0.92, 0.98, 0.95),
      darkBg:    rgb(0.06, 0.12, 0.25),
      white:     rgb(1, 1, 1),
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function newPage() {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }

    function ensureSpace(h: number) {
      if (y - h < margin) newPage()
    }

    function drawText(
      text: string,
      x: number,
      yy: number,
      size = 10,
      useBold = false,
      color = colors.text
    ) {
      page.drawText(text, { x, y: yy, size, font: useBold ? bold : font, color })
    }

    function drawDivider(topGap = 8, botGap = 14) {
      y -= topGap
      page.drawLine({
        start: { x: margin, y },
        end:   { x: pageWidth - margin, y },
        thickness: 1,
        color: colors.line,
      })
      y -= botGap
    }

    function drawSectionTitle(title: string) {
      y -= 14
      ensureSpace(40)
      drawText(title, margin, y, 12, true, colors.dark)
      y -= 6
      page.drawLine({
        start: { x: margin, y },
        end:   { x: pageWidth - margin, y },
        thickness: 0.5,
        color: colors.line,
      })
      y -= 14
    }

    function drawInfoGrid(items: Array<{ label: string; value: string }>) {
      const gap = 16
      const colWidth = (contentWidth - gap) / 2
      for (let i = 0; i < items.length; i += 2) {
        const left  = items[i]
        const right = items[i + 1]
        ensureSpace(44)
        // left cell
        page.drawRectangle({ x: margin,                    y: y - 36, width: colWidth, height: 36, color: colors.soft, borderColor: colors.line, borderWidth: 0.75 })
        drawText(left.label.toUpperCase(), margin + 10, y - 11, 7.5, true, colors.muted)
        drawText(left.value || '—',        margin + 10, y - 26, 10,  false, colors.text)
        // right cell
        if (right) {
          const rx = margin + colWidth + gap
          page.drawRectangle({ x: rx, y: y - 36, width: colWidth, height: 36, color: colors.soft, borderColor: colors.line, borderWidth: 0.75 })
          drawText(right.label.toUpperCase(), rx + 10, y - 11, 7.5, true, colors.muted)
          drawText(right.value || '—',        rx + 10, y - 26, 10,  false, colors.text)
        }
        y -= 46
      }
    }

    // ── Header ─────────────────────────────────────────────────────────────────

    ensureSpace(80)

    // Dark banner background
    page.drawRectangle({
      x: margin, y: y - 68, width: contentWidth, height: 68,
      color: colors.darkBg,
    })

    if (logoImage) {
      const dims  = logoImage.scale(1)
      const scale = Math.min(44 / dims.width, 44 / dims.height)
      const w = dims.width * scale
      const h = dims.height * scale
      page.drawImage(logoImage, { x: margin + 14, y: y - 14 - h, width: w, height: h })
      drawText('Short-Go Equine Chiropractic', margin + 14 + w + 12, y - 18, 17, true,  colors.white)
      drawText('Client Consent & Service Agreement',  margin + 14 + w + 12, y - 36, 10, false, rgb(0.7, 0.75, 0.85))
    } else {
      drawText('Short-Go Equine Chiropractic',       margin + 14, y - 20, 17, true,  colors.white)
      drawText('Client Consent & Service Agreement', margin + 14, y - 38, 10, false, rgb(0.7, 0.75, 0.85))
    }

    // Version + date top-right
    const versionText  = `Version ${consent.form_version || '1.0'}`
    const generatedText = `Generated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    drawText(versionText,   pageWidth - margin - 110, y - 20, 8.5, false, rgb(0.6, 0.65, 0.75))
    drawText(generatedText, pageWidth - margin - 110, y - 34, 8.5, false, rgb(0.6, 0.65, 0.75))

    y -= 80

    // ── Signed banner ──────────────────────────────────────────────────────────

    ensureSpace(36)
    page.drawRectangle({ x: margin, y: y - 30, width: contentWidth, height: 30, color: colors.emeraldBg, borderColor: rgb(0.18, 0.72, 0.5), borderWidth: 0.75 })
    drawText('✓  CONSENT ON FILE', margin + 14, y - 11, 9, true, colors.emerald)
    const signedDateStr = new Date(consent.signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    drawText(`Signed: ${signedDateStr}`, margin + 14, y - 22, 8.5, false, colors.emerald)
    y -= 42

    // ── Client information ─────────────────────────────────────────────────────

    drawSectionTitle('Client Information')
    drawInfoGrid([
      { label: 'Client Name',  value: owner?.full_name || consent.signed_name || '—' },
      { label: 'Phone',        value: owner?.phone     || '—' },
      { label: 'Email',        value: owner?.email     || '—' },
      { label: 'Address',      value: owner?.address   || '—' },
    ])

    if (consent.horses_acknowledged) {
      ensureSpace(44)
      page.drawRectangle({ x: margin, y: y - 36, width: contentWidth, height: 36, color: colors.soft, borderColor: colors.line, borderWidth: 0.75 })
      drawText('ANIMAL(S) IN CARE', margin + 10, y - 11, 7.5, true, colors.muted)
      drawText(consent.horses_acknowledged, margin + 10, y - 26, 10, false, colors.text)
      y -= 46
    }

    // ── Terms of care ──────────────────────────────────────────────────────────

    drawSectionTitle('Terms of Care — All Items Acknowledged')

    for (let i = 0; i < AGREEMENT_ITEMS.length; i++) {
      const item = AGREEMENT_ITEMS[i]
      const lines = wrapText(item.text, 82)
      const rowHeight = Math.max(36, lines.length * 13 + 22)
      ensureSpace(rowHeight + 6)

      // Row background
      page.drawRectangle({
        x: margin, y: y - rowHeight, width: contentWidth, height: rowHeight,
        color: i % 2 === 0 ? colors.soft : colors.white,
        borderColor: colors.line, borderWidth: 0.5,
      })

      // Checkmark circle
      page.drawCircle({ x: margin + 18, y: y - rowHeight / 2 + 1, size: 9, color: rgb(0.18, 0.72, 0.5) })
      drawText('✓', margin + 13, y - rowHeight / 2 - 4, 9, true, colors.white)

      // Item number
      drawText(`${i + 1}.`, margin + 32, y - 14, 8.5, true, colors.muted)

      // Text lines
      let textY = y - 14
      for (const line of lines) {
        drawText(line, margin + 44, textY, 9.5, false, colors.text)
        textY -= 13
      }

      y -= rowHeight + 4
    }

    // ── Signature ──────────────────────────────────────────────────────────────

    drawSectionTitle('Signature')

    if (consent.signature_data) {
      // signature_data is a data URL like "data:image/png;base64,..."
      const base64Match = consent.signature_data.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/)
      if (base64Match) {
        try {
          const imgKind = base64Match[1]
          const imgBytes = Buffer.from(base64Match[2], 'base64')
          const sigImage = imgKind === 'png'
            ? await pdfDoc.embedPng(imgBytes)
            : await pdfDoc.embedJpg(imgBytes)

          const sigBoxWidth  = contentWidth
          const sigBoxHeight = 100
          ensureSpace(sigBoxHeight + 50)

          // Signature box
          page.drawRectangle({
            x: margin, y: y - sigBoxHeight, width: sigBoxWidth, height: sigBoxHeight,
            color: colors.white, borderColor: colors.line, borderWidth: 1,
          })

          // Embed signature image centered in the box
          const dims  = sigImage.scale(1)
          const scale = Math.min((sigBoxWidth - 20) / dims.width, (sigBoxHeight - 16) / dims.height)
          const sigW  = dims.width  * scale
          const sigH  = dims.height * scale
          page.drawImage(sigImage, {
            x: margin + (sigBoxWidth - sigW) / 2,
            y: y - sigBoxHeight + (sigBoxHeight - sigH) / 2,
            width: sigW,
            height: sigH,
          })

          y -= sigBoxHeight + 8

          // Signature line label
          page.drawLine({
            start: { x: margin, y: y - 2 },
            end:   { x: margin + 240, y: y - 2 },
            thickness: 0.75,
            color: colors.muted,
          })
          drawText('Authorized Signature', margin, y - 14, 9, false, colors.muted)
          y -= 28

        } catch (err) {
          console.error('Signature embed error:', err)
          drawText('[Signature image could not be rendered]', margin, y, 10, false, colors.muted)
          y -= 18
        }
      }
    } else {
      ensureSpace(40)
      page.drawRectangle({ x: margin, y: y - 36, width: contentWidth, height: 36, color: colors.soft, borderColor: colors.line, borderWidth: 0.75 })
      drawText('No signature image on file.', margin + 14, y - 20, 10, false, colors.muted)
      y -= 46
    }

    // ── Notes ──────────────────────────────────────────────────────────────────

    if (consent.notes && consent.notes.trim()) {
      drawSectionTitle('Additional Notes')
      const noteLines = wrapText(consent.notes, 88)
      ensureSpace(noteLines.length * 14 + 16)
      page.drawRectangle({ x: margin, y: y - noteLines.length * 14 - 12, width: contentWidth, height: noteLines.length * 14 + 12, color: colors.soft, borderColor: colors.line, borderWidth: 0.75 })
      for (const line of noteLines) {
        drawText(line, margin + 14, y - 12, 10, false, colors.text)
        y -= 14
      }
      y -= 14
    }

    // ── Footer ─────────────────────────────────────────────────────────────────

    const footerY = margin - 8
    page.drawLine({ start: { x: margin, y: footerY + 18 }, end: { x: pageWidth - margin, y: footerY + 18 }, thickness: 0.5, color: colors.line })
    drawText('Short-Go Equine Chiropractic  ·  Client Consent & Service Agreement', margin, footerY + 8, 8, false, colors.muted)
    drawText(`Form Version ${consent.form_version || '1.0'}  ·  Signed ${new Date(consent.signed_at).toLocaleDateString()}`, pageWidth - margin - 180, footerY + 8, 8, false, colors.muted)

    // ── Serialize & return inline ──────────────────────────────────────────────

    const pdfBytes = await pdfDoc.save()
    const fileName = `consent-${(owner?.full_name || consent.signed_name || 'client').replace(/\s+/g, '-').toLowerCase()}.pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('consent pdf route error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF.' }, { status: 500 })
  }
}
