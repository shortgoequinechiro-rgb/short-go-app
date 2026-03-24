import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, type PDFImage } from 'pdf-lib'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../../../../lib/auth'
import fs from 'fs'
import path from 'path'

const REGION_LABELS: Record<string, string> = {
  pollAtlas: 'Poll / Atlas',
  withers: 'Withers',
  thoracolumbar: 'Thoracolumbar',
  siJoint: 'SI Joint',
  hock: 'Hock',
}

const SPINE_SEGMENT_LABELS: Record<string, string> = {
  tmj: 'TMJ', poll: 'Poll (C0-C1)', c1_c2: 'C1-C2 (Atlas/Axis)',
  c2_c3: 'C2-C3', c3_c4: 'C3-C4', c4_c5: 'C4-C5', c5_c6: 'C5-C6', c6_c7: 'C6-C7',
  ...Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`t${i+1}_${i+2}`, `T${i+1}-T${i+2}`])),
  ...Object.fromEntries(Array.from({ length: 6 },  (_, i) => [`l${i+1}_${i+2}`, `L${i+1}-L${i+2}`])),
  sacrum: 'Sacrum', si_joint: 'SI Joint', coccygeal: 'Coccygeal',
}

type VisitPhotoRow = {
  id: string
  caption: string | null
  body_area: string | null
  taken_at: string | null
  image_path: string | null
}

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables.')
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

function wrapText(text: string, maxChars = 90) {
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

async function loadLogoFile() {
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
      const bytes = fs.readFileSync(filePath)
      const ext = path.extname(filePath).toLowerCase()
      return { bytes, ext, filePath }
    }
  }

  return null
}

async function embedLogo(pdfDoc: PDFDocument) {
  const logoFile = await loadLogoFile()
  if (!logoFile) return null

  try {
    if (logoFile.ext === '.jpg' || logoFile.ext === '.jpeg') {
      return await pdfDoc.embedJpg(logoFile.bytes)
    }

    return await pdfDoc.embedPng(logoFile.bytes)
  } catch (error) {
    console.error('Logo embed error:', error, 'file:', logoFile.filePath)
    return null
  }
}

async function downloadVisitPhotoBytes(supabase: any, imagePath: string) {
  try {
    const { data, error } = await supabase.storage
      .from('horse-photos')
      .download(imagePath)

    if (error || !data) {
      console.error('Photo download error:', error?.message, imagePath)
      return null
    }

    const bytes = Buffer.from(await data.arrayBuffer())
    const lower = imagePath.toLowerCase()

    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      return { bytes, kind: 'jpg' as const }
    }

    if (lower.endsWith('.png')) {
      return { bytes, kind: 'png' as const }
    }

    return null
  } catch (error) {
    console.error('Photo download exception:', error, imagePath)
    return null
  }
}

async function buildVisitPdf(visitId: string) {
  const supabase = getAdminSupabase()

  const { data: visit, error: visitError } = await supabase
    .from('visits')
    .select(`
      *,
      horses (
        id,
        name,
        breed,
        sex,
        age,
        species,
        discipline,
        barn_location,
        owners (
          full_name,
          phone,
          email,
          address
        )
      )
    `)
    .eq('id', visitId)
    .single()

  if (visitError || !visit) {
    console.error('Email route visit query error:', visitError, 'visitId:', visitId)
    throw new Error('Visit not found.')
  }

  // Fetch practitioner data for dynamic practice name and doctor name
  let practiceName = 'Your Care Provider'
  let doctorName = 'Your practitioner'

  if (visit.practitioner_id) {
    const { data: practitioner, error: practitionerError } = await supabase
      .from('practitioners')
      .select('practice_name, full_name')
      .eq('id', visit.practitioner_id)
      .single()

    if (practitionerError) {
      console.error('Error fetching practitioner:', practitionerError)
    } else if (practitioner) {
      practiceName = practitioner.practice_name || 'Your Care Provider'
      doctorName = practitioner.full_name || 'Your practitioner'
    }
  }

  const { data: anatomyRows, error: anatomyError } = await supabase
    .from('visit_anatomy_regions')
    .select('region_key, notes')
    .eq('visit_id', visitId)

  if (anatomyError) {
    throw new Error(`Error loading anatomy notes: ${anatomyError.message}`)
  }

  const { data: spineData } = await supabase
    .from('spine_assessments')
    .select('findings, notes')
    .eq('visit_id', visitId)
    .order('assessed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: visitPhotos, error: photosError } = await supabase
    .from('photos')
    .select('id, caption, body_area, taken_at, image_path')
    .eq('visit_id', visitId)
    .order('taken_at', { ascending: true })

  if (photosError) {
    throw new Error(`Error loading visit photos: ${photosError.message}`)
  }

  const pdfDoc = await PDFDocument.create()
  let page = pdfDoc.addPage([612, 792])

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const logoImage = await embedLogo(pdfDoc)

  const pageWidth = 612
  const pageHeight = 792
  const margin = 44
  const contentWidth = pageWidth - margin * 2
  let y = pageHeight - margin

  const horse = visit.horses as any
  const owner = horse?.owners as any

  const colors = {
    text: rgb(0.14, 0.14, 0.14),
    muted: rgb(0.42, 0.42, 0.42),
    line: rgb(0.85, 0.86, 0.88),
    soft: rgb(0.95, 0.96, 0.97),
    dark: rgb(0.08, 0.08, 0.08),
  }

  function newPage() {
    page = pdfDoc.addPage([pageWidth, pageHeight])
    y = pageHeight - margin
  }

  function ensureSpace(heightNeeded: number) {
    if (y - heightNeeded < margin) newPage()
  }

  function drawTextLine(
    text: string,
    x: number,
    yy: number,
    size = 10,
    useBold = false,
    color = colors.text
  ) {
    page.drawText(text, {
      x,
      y: yy,
      size,
      font: useBold ? bold : font,
      color,
    })
  }

  function drawDivider(spacingTop = 8, spacingBottom = 14) {
    y -= spacingTop
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: colors.line,
    })
    y -= spacingBottom
  }

  function drawSectionTitle(title: string) {
    y -= 12
    ensureSpace(40)
    drawTextLine(title, margin, y, 13, true, colors.dark)
    y -= 28
  }

  function drawParagraph(label: string, value: string | null | undefined) {
    const lines = wrapText(value || '—', 88)
    ensureSpace(20 + lines.length * 14)

    drawTextLine(label, margin, y, 10, true, colors.muted)
    y -= 14

    for (const line of lines) {
      drawTextLine(line, margin, y, 10, false, colors.text)
      y -= 13
    }

    y -= 10
  }

  function drawInfoGrid(items: Array<{ label: string; value: string }>) {
    const colGap = 18
    const colWidth = (contentWidth - colGap) / 2

    for (let i = 0; i < items.length; i += 2) {
      const left = items[i]
      const right = items[i + 1]
      ensureSpace(44)

      page.drawRectangle({
        x: margin,
        y: y - 34,
        width: colWidth,
        height: 34,
        color: colors.soft,
        borderColor: colors.line,
        borderWidth: 0.75,
      })

      drawTextLine(left.label.toUpperCase(), margin + 10, y - 10, 7.5, true, colors.muted)
      drawTextLine(left.value || '—', margin + 10, y - 24, 10, false, colors.text)

      if (right) {
        const rightX = margin + colWidth + colGap

        page.drawRectangle({
          x: rightX,
          y: y - 34,
          width: colWidth,
          height: 34,
          color: colors.soft,
          borderColor: colors.line,
          borderWidth: 0.75,
        })

        drawTextLine(right.label.toUpperCase(), rightX + 10, y - 10, 7.5, true, colors.muted)
        drawTextLine(right.value || '—', rightX + 10, y - 24, 10, false, colors.text)
      }

      y -= 44
    }

    y -= 18
  }

  function drawHeader() {
    ensureSpace(90)

    if (logoImage) {
      const dims = logoImage.scale(1)
      const maxWidth = 84
      const maxHeight = 50
      const scale = Math.min(maxWidth / dims.width, maxHeight / dims.height)
      const drawWidth = dims.width * scale
      const drawHeight = dims.height * scale

      page.drawImage(logoImage, {
        x: margin,
        y: y - drawHeight + 8,
        width: drawWidth,
        height: drawHeight,
      })

      drawTextLine(practiceName, margin + drawWidth + 14, y - 2, 19, true, colors.dark)
      drawTextLine('Equine Chiropractic Visit Report', margin + drawWidth + 14, y - 22, 11, false, colors.muted)
    } else {
      drawTextLine(practiceName, margin, y - 2, 19, true, colors.dark)
      drawTextLine('Equine Chiropractic Visit Report', margin, y - 22, 11, false, colors.muted)
    }

    const generatedText = `Generated: ${new Date().toLocaleDateString()}`
    const speciesMap: Record<string, string> = {
      canine: 'Canine',
      feline: 'Feline',
      bovine: 'Bovine',
      porcine: 'Porcine',
      exotic: 'Exotic',
    }
    const speciesLabel = speciesMap[horse?.species as string] || 'Horse'
    const horseText = `${speciesLabel}: ${horse?.name || '—'}`
    drawTextLine(generatedText, pageWidth - margin - 120, y - 2, 9, false, colors.muted)
    drawTextLine(horseText, pageWidth - margin - 120, y - 18, 9, true, colors.text)

    y -= 58
    drawDivider(0, 18)
  }

  function drawSummaryCard() {
    ensureSpace(108)

    const cardHeight = 92
    page.drawRectangle({
      x: margin,
      y: y - cardHeight,
      width: contentWidth,
      height: cardHeight,
      color: colors.soft,
      borderColor: colors.line,
      borderWidth: 1,
    })

    drawTextLine('VISIT SUMMARY', margin + 14, y - 14, 8, true, colors.muted)

    const leftX = margin + 14
    const rightX = margin + contentWidth / 2 + 8
    const line1Y = y - 32
    const line2Y = y - 52
    const line3Y = y - 72

    drawTextLine(`Visit Date: ${visit.visit_date || '—'}`, leftX, line1Y, 10, true)
    drawTextLine(`Provider: ${visit.provider_name || doctorName}`, leftX, line2Y, 10, false)
    drawTextLine(`Follow Up: ${visit.follow_up || '—'}`, leftX, line3Y, 10, false)

    drawTextLine(`Reason: ${visit.reason_for_visit || '—'}`, rightX, line1Y, 10, true)
    drawTextLine(`Treated Areas: ${visit.treated_areas || '—'}`, rightX, line2Y, 10, false)
    drawTextLine(`Location: ${visit.location || '—'}`, rightX, line3Y, 10, false)

    y -= cardHeight + 22
  }

  async function embedImageForPhoto(photo: VisitPhotoRow): Promise<PDFImage | null> {
    if (!photo.image_path) return null
    const photoFile = await downloadVisitPhotoBytes(supabase, photo.image_path)
    if (!photoFile) return null

    try {
      return photoFile.kind === 'jpg'
        ? await pdfDoc.embedJpg(photoFile.bytes)
        : await pdfDoc.embedPng(photoFile.bytes)
    } catch (error) {
      console.error('Photo embed error:', error, photo.image_path)
      return null
    }
  }

  async function drawPhotos() {
    if (!visitPhotos || visitPhotos.length === 0) return

    drawSectionTitle('Visit Photos')

    const photoItems: Array<{
      embedded: PDFImage
      captionLines: string[]
    }> = []

    for (const photo of visitPhotos as VisitPhotoRow[]) {
      const embedded = await embedImageForPhoto(photo)
      if (!embedded) continue

      const captionParts = [
        photo.caption || null,
        photo.body_area ? `Area: ${photo.body_area}` : null,
        photo.taken_at ? `Date: ${photo.taken_at}` : null,
      ].filter(Boolean)

      photoItems.push({
        embedded,
        captionLines: captionParts.length ? wrapText(captionParts.join(' • '), 38) : [],
      })
    }

    if (photoItems.length === 0) {
      drawTextLine('No embeddable visit photos were found.', margin, y, 10, false, colors.muted)
      y -= 18
      return
    }

    const gap = 16
    const boxWidth = (contentWidth - gap) / 2

    for (let i = 0; i < photoItems.length; i += 2) {
      const row = photoItems.slice(i, i + 2)

      const heights = row.map((item) => {
        const dims = item.embedded.scale(1)
        const scale = Math.min(boxWidth / dims.width, 150 / dims.height)
        const imageHeight = dims.height * scale
        const captionHeight = Math.max(item.captionLines.length, 1) * 12 + 14
        return { imageHeight, scale, total: imageHeight + captionHeight + 10 }
      })

      const rowHeight = Math.max(...heights.map((h) => h.total))
      ensureSpace(rowHeight + 10)

      row.forEach((item, idx) => {
        const x = idx === 0 ? margin : margin + boxWidth + gap
        const dims = item.embedded.scale(1)
        const scale = heights[idx].scale
        const drawWidth = dims.width * scale
        const drawHeight = dims.height * scale

        page.drawRectangle({
          x,
          y: y - (drawHeight + 34),
          width: boxWidth,
          height: drawHeight + 34,
          color: rgb(1, 1, 1),
          borderColor: colors.line,
          borderWidth: 0.8,
        })

        page.drawImage(item.embedded, {
          x: x + (boxWidth - drawWidth) / 2,
          y: y - drawHeight - 8,
          width: drawWidth,
          height: drawHeight,
        })

        let captionY = y - drawHeight - 20
        if (item.captionLines.length === 0) {
          drawTextLine('Visit photo', x + 8, captionY, 9, false, colors.muted)
        } else {
          for (const line of item.captionLines.slice(0, 3)) {
            drawTextLine(line, x + 8, captionY, 8.5, false, colors.muted)
            captionY -= 10
          }
        }
      })

      y -= rowHeight + 12
    }
  }

  drawHeader()
  drawSummaryCard()

  drawSectionTitle('Horse Information')
  drawInfoGrid([
    { label: 'Horse Name', value: horse?.name || '—' },
    { label: 'Breed', value: horse?.breed || '—' },
    { label: 'Sex', value: horse?.sex || '—' },
    { label: 'Age', value: horse?.age || '—' },
    { label: 'Discipline', value: horse?.discipline || '—' },
    { label: 'Barn Location', value: horse?.barn_location || '—' },
  ])

  drawSectionTitle('Owner Information')
  drawInfoGrid([
    { label: 'Owner', value: owner?.full_name || '—' },
    { label: 'Phone', value: owner?.phone || '—' },
    { label: 'Email', value: owner?.email || '—' },
    { label: 'Address', value: owner?.address || '—' },
  ])

  drawSectionTitle('SOAP Notes')
  drawParagraph('Subjective', visit.subjective)
  drawParagraph('Objective', visit.objective)
  drawParagraph('Assessment', visit.assessment)
  drawParagraph('Plan', visit.plan)
  drawParagraph('Recommendations', visit.recommendations)

  drawSectionTitle('Anatomy Notes')
  if (!anatomyRows || anatomyRows.length === 0) {
    drawTextLine('No anatomy notes saved for this visit.', margin, y, 10, false, colors.muted)
    y -= 18
  } else {
    for (const row of anatomyRows) {
      const label = REGION_LABELS[row.region_key] || row.region_key
      drawParagraph(label, row.notes || '—')
    }
  }

  if (spineData?.findings) {
    const findings = spineData.findings as Record<string, { left: boolean; right: boolean }>
    const flagged = Object.entries(findings).filter(([, v]) => v.left || v.right)
    if (flagged.length > 0) {
      drawSectionTitle('Spine Assessment')
      for (const [segKey, val] of flagged) {
        const label = SPINE_SEGMENT_LABELS[segKey] || segKey
        const sides = [val.left && 'Left', val.right && 'Right'].filter(Boolean).join(' / ')
        drawParagraph(label, sides)
      }
      if (spineData.notes) {
        drawParagraph('Notes', spineData.notes)
      }
    }
  }

  await drawPhotos()

  drawDivider(8, 18)
  ensureSpace(70)

  drawTextLine('Provider Signature', margin, y, 10, true, colors.muted)
  y -= 24

  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + 230, y },
    thickness: 1,
    color: rgb(0.45, 0.45, 0.45),
  })

  y -= 16
  drawTextLine(doctorName, margin, y, 11, true, colors.text)
  y -= 14
  drawTextLine(practiceName, margin, y, 10, false, colors.muted)

  const pdfBytes = await pdfDoc.save()
  const fileName = `${horse?.name || 'horse'}-visit-${visit.visit_date || 'report'}.pdf`

  return {
    pdfBytes,
    visit,
    horse,
    owner,
    fileName,
    practiceName,
    doctorName,
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ visitId: string }> }
) {
  try {
    const { user, error: authError } = await requireAuth(_req)
    if (authError) return authError

    const { visitId } = await params

    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.FROM_EMAIL

    if (!resendApiKey) {
      return NextResponse.json(
        { error: 'Missing RESEND_API_KEY in environment variables' },
        { status: 500 }
      )
    }

    if (!fromEmail) {
      return NextResponse.json(
        { error: 'Missing FROM_EMAIL in environment variables' },
        { status: 500 }
      )
    }

    const resend = new Resend(resendApiKey)
    const { pdfBytes, horse, owner, visit, fileName, practiceName, doctorName } = await buildVisitPdf(visitId)

    if (!owner?.email) {
      return NextResponse.json(
        { error: 'This owner does not have an email address saved.' },
        { status: 400 }
      )
    }

    const result = await resend.emails.send({
      from: fromEmail,
      to: owner.email,
      subject: `Visit Report for ${horse?.name || 'your horse'}`,
      text: `Hello ${owner?.full_name || ''},

Attached is your visit report for ${horse?.name || 'your horse'} on ${visit.visit_date || 'your recent visit'}.

Thank you,
${doctorName}
${practiceName}`,
      attachments: [
        {
          filename: fileName,
          content: Buffer.from(pdfBytes).toString('base64'),
        },
      ],
    })

    if ((result as any)?.error) {
      console.error('Resend send error:', (result as any).error)
      return NextResponse.json(
        { error: (result as any).error.message || 'Resend failed to send email.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      id: (result as any)?.data?.id || null,
    })
  } catch (error: any) {
    console.error('email route error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to email PDF.' },
      { status: 500 }
    )
  }
}