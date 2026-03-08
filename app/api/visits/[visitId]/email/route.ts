import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const REGION_LABELS: Record<string, string> = {
  pollAtlas: 'Poll / Atlas',
  withers: 'Withers',
  thoracolumbar: 'Thoracolumbar',
  siJoint: 'SI Joint',
  hock: 'Hock',
}

type VisitPhotoRow = {
  id: string
  caption: string | null
  body_area: string | null
  taken_at: string | null
  image_path: string | null
}

function wrapText(text: string, maxChars = 95) {
  if (!text) return ['—']

  const words = text.split(' ')
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

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables.')
  }

  return createClient(supabaseUrl, serviceRoleKey)
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

async function downloadVisitPhotoBytes(
  supabase: any,
  imagePath: string
) {
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
    throw new Error('Visit not found.')
  }

  const { data: anatomyRows, error: anatomyError } = await supabase
    .from('visit_anatomy_regions')
    .select('region_key, notes')
    .eq('visit_id', visitId)

  if (anatomyError) {
    throw new Error(`Error loading anatomy notes: ${anatomyError.message}`)
  }

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

  const { width, height } = page.getSize()
  const margin = 48
  let y = height - margin

  function newPage() {
    page = pdfDoc.addPage([612, 792])
    y = height - margin
  }

  function ensureSpace(linesNeeded = 2) {
    if (y < margin + linesNeeded * 18) {
      newPage()
    }
  }

  function drawLine(text: string, x = margin, size = 11, isBold = false) {
    ensureSpace()
    page.drawText(text, {
      x,
      y,
      size,
      font: isBold ? bold : font,
      color: rgb(0.15, 0.15, 0.15),
    })
    y -= size + 6
  }

  function drawSectionTitle(title: string) {
    y -= 8
    ensureSpace()
    page.drawText(title, {
      x: margin,
      y,
      size: 14,
      font: bold,
      color: rgb(0.08, 0.08, 0.08),
    })
    y -= 22
  }

  function drawParagraph(label: string, value: string | null | undefined) {
    drawLine(label, margin, 11, true)
    const lines = wrapText(value || '—')
    for (const line of lines) {
      drawLine(line, margin + 12, 10, false)
    }
    y -= 6
  }

  const horse = visit.horses as any
  const owner = horse?.owners as any

  if (logoImage) {
    const dims = logoImage.scale(1)
    const maxWidth = 140
    const maxHeight = 60
    const scale = Math.min(maxWidth / dims.width, maxHeight / dims.height)
    const drawWidth = dims.width * scale
    const drawHeight = dims.height * scale

    page.drawImage(logoImage, {
      x: margin,
      y: y - drawHeight + 10,
      width: drawWidth,
      height: drawHeight,
    })

    page.drawText('Short-Go Equine Chiropractic', {
      x: margin + drawWidth + 16,
      y: y - 8,
      size: 18,
      font: bold,
      color: rgb(0.08, 0.08, 0.08),
    })

    page.drawText('Visit Report', {
      x: margin + drawWidth + 16,
      y: y - 30,
      size: 12,
      font,
      color: rgb(0.25, 0.25, 0.25),
    })

    y -= Math.max(drawHeight, 52) + 8
  } else {
    drawLine('Short-Go Equine Chiropractic', margin, 18, true)
    drawLine('Visit Report', margin, 12, false)
    y -= 8
  }

  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  })
  y -= 20

  drawSectionTitle('Horse Information')
  drawLine(`Horse: ${horse?.name || '—'}`)
  drawLine(`Breed: ${horse?.breed || '—'}`)
  drawLine(`Discipline: ${horse?.discipline || '—'}`)
  drawLine(`Barn Location: ${horse?.barn_location || '—'}`)

  drawSectionTitle('Owner Information')
  drawLine(`Owner: ${owner?.full_name || '—'}`)
  drawLine(`Phone: ${owner?.phone || '—'}`)
  drawLine(`Email: ${owner?.email || '—'}`)
  drawParagraph('Address', owner?.address || '—')

  drawSectionTitle('Visit Information')
  drawLine(`Visit Date: ${visit.visit_date || '—'}`)
  drawLine(`Location: ${visit.location || '—'}`)
  drawLine(`Provider: ${visit.provider_name || '—'}`)
  drawLine(`Reason for Visit: ${visit.reason_for_visit || '—'}`)
  drawLine(`Treated Areas: ${visit.treated_areas || '—'}`)
  drawLine(`Follow Up: ${visit.follow_up || '—'}`)

  drawSectionTitle('SOAP')
  drawParagraph('Subjective', visit.subjective)
  drawParagraph('Objective', visit.objective)
  drawParagraph('Assessment', visit.assessment)
  drawParagraph('Plan', visit.plan)
  drawParagraph('Recommendations', visit.recommendations)

  drawSectionTitle('Anatomy Notes')
  if (!anatomyRows || anatomyRows.length === 0) {
    drawLine('No anatomy notes saved for this visit.')
  } else {
    for (const row of anatomyRows) {
      const label = REGION_LABELS[row.region_key] || row.region_key
      drawParagraph(label, row.notes || '—')
    }
  }

  if (visitPhotos && visitPhotos.length > 0) {
    drawSectionTitle('Visit Photos')

    for (const photo of visitPhotos as VisitPhotoRow[]) {
      if (!photo.image_path) continue

      const photoFile = await downloadVisitPhotoBytes(supabase, photo.image_path)
      if (!photoFile) continue

      let embeddedImage
      try {
        embeddedImage =
          photoFile.kind === 'jpg'
            ? await pdfDoc.embedJpg(photoFile.bytes)
            : await pdfDoc.embedPng(photoFile.bytes)
      } catch (error) {
        console.error('Photo embed error:', error, photo.image_path)
        continue
      }

      const captionBits = [
        photo.caption || null,
        photo.body_area ? `Area: ${photo.body_area}` : null,
        photo.taken_at ? `Date: ${photo.taken_at}` : null,
      ].filter(Boolean)

      const imageMaxWidth = width - margin * 2
      const imageMaxHeight = 220
      const dims = embeddedImage.scale(1)
      const scale = Math.min(imageMaxWidth / dims.width, imageMaxHeight / dims.height)
      const drawWidth = dims.width * scale
      const drawHeight = dims.height * scale

      const captionLines = captionBits.length
        ? wrapText(captionBits.join(' • '), 90)
        : []

      const neededHeight = drawHeight + captionLines.length * 16 + 24
      if (y < margin + neededHeight) {
        newPage()
      }

      page.drawImage(embeddedImage, {
        x: margin,
        y: y - drawHeight,
        width: drawWidth,
        height: drawHeight,
      })

      y -= drawHeight + 8

      for (const line of captionLines) {
        page.drawText(line, {
          x: margin,
          y,
          size: 10,
          font,
          color: rgb(0.25, 0.25, 0.25),
        })
        y -= 14
      }

      y -= 10
    }
  }

  y -= 8
  ensureSpace(5)
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  })
  y -= 22

  page.drawText('Provider Signature', {
    x: margin,
    y,
    size: 11,
    font: bold,
    color: rgb(0.15, 0.15, 0.15),
  })
  y -= 28

  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + 220, y },
    thickness: 1,
    color: rgb(0.45, 0.45, 0.45),
  })
  y -= 16

  drawLine('Dr. Andrew Leo D.C., M.S., cAVCA', margin, 11, true)
  drawLine('Short-Go Equine Chiropractic', margin, 10, false)

  const pdfBytes = await pdfDoc.save()

  return {
    pdfBytes,
    visit,
    horse,
    owner,
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ visitId: string }> }
) {
  try {
    const { visitId } = await params

    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.FROM_EMAIL

    if (!resendApiKey) {
      return NextResponse.json(
        { error: 'Missing RESEND_API_KEY in .env.local' },
        { status: 500 }
      )
    }

    if (!fromEmail) {
      return NextResponse.json(
        { error: 'Missing FROM_EMAIL in .env.local' },
        { status: 500 }
      )
    }

    const resend = new Resend(resendApiKey)
    const { pdfBytes, visit, horse, owner } = await buildVisitPdf(visitId)

    if (!owner?.email) {
      return NextResponse.json(
        { error: 'This owner does not have an email address saved.' },
        { status: 400 }
      )
    }

    const fileName = `${horse?.name || 'horse'}-visit-${visit.visit_date || 'report'}.pdf`

    const result = await resend.emails.send({
      from: fromEmail,
      to: owner.email,
      subject: `Visit Report for ${horse?.name || 'your horse'}`,
      text: `Hello ${owner?.full_name || ''},

Attached is your visit report for ${horse?.name || 'your horse'}.

Thank you,
Dr. Andrew Leo D.C., M.S., cAVCA
Short-Go Equine Chiropractic`,
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