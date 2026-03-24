import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, type PDFImage } from 'pdf-lib'
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

const SPINE_SECTIONS_PDF = [
  {
    key: 'cranial',
    label: 'Cranial / Cervical',
    segments: [
      { key: 'tmj',    label: 'TMJ' },
      { key: 'poll',   label: 'Poll (C0-C1)' },
      { key: 'c1_c2', label: 'C1-C2 (Atlas / Axis)' },
      { key: 'c2_c3', label: 'C2-C3' },
      { key: 'c3_c4', label: 'C3-C4' },
      { key: 'c4_c5', label: 'C4-C5' },
      { key: 'c5_c6', label: 'C5-C6' },
      { key: 'c6_c7', label: 'C6-C7' },
    ],
  },
  {
    key: 'thoracic',
    label: 'Thoracic',
    segments: Array.from({ length: 17 }, (_, i) => ({
      key: `t${i + 1}_${i + 2}`,
      label: `T${i + 1}-T${i + 2}`,
    })),
  },
  {
    key: 'lumbar',
    label: 'Lumbar',
    segments: Array.from({ length: 6 }, (_, i) => ({
      key: `l${i + 1}_${i + 2}`,
      label: `L${i + 1}-L${i + 2}`,
    })),
  },
  {
    key: 'sacral',
    label: 'Sacral / Pelvic',
    segments: [
      { key: 'sacrum',    label: 'Sacrum' },
      { key: 'si_joint',  label: 'SI Joint' },
      { key: 'coccygeal', label: 'Coccygeal' },
    ],
  },
]

type SpineFinding = { left: boolean; right: boolean }

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ visitId: string }> }
) {
  try {
    const { user, error: authError } = await requireAuth(_req)
    if (authError) return authError

    const { visitId } = await params
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
        ),
        practitioners (
          full_name,
          practice_name
        )
      `)
      .eq('id', visitId)
      .single()

    if (visitError || !visit) {
      console.error('Visit query error:', visitError)
      return NextResponse.json({ error: 'Visit not found.' }, { status: 404 })
    }

    const { data: anatomyRows, error: anatomyError } = await supabase
      .from('visit_anatomy_regions')
      .select('region_key, notes')
      .eq('visit_id', visitId)

    if (anatomyError) {
      return NextResponse.json(
        { error: `Error loading anatomy notes: ${anatomyError.message}` },
        { status: 500 }
      )
    }

    const { data: visitPhotos, error: photosError } = await supabase
      .from('photos')
      .select('id, caption, body_area, taken_at, image_path')
      .eq('visit_id', visitId)
      .order('taken_at', { ascending: true })

    if (photosError) {
      return NextResponse.json(
        { error: `Error loading visit photos: ${photosError.message}` },
        { status: 500 }
      )
    }

    // Spine assessment for this visit (null if table doesn't exist yet)
    let spineAssessment: { findings: Record<string, SpineFinding>; notes: string | null } | null = null
    try {
      const { data: spineData } = await supabase
        .from('spine_assessments')
        .select('findings, notes')
        .eq('visit_id', visitId)
        .order('assessed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (spineData) {
        spineAssessment = {
          findings: (spineData.findings as Record<string, SpineFinding>) ?? {},
          notes: spineData.notes ?? null,
        }
      }
    } catch {
      // Table may not exist; skip silently
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
    const practitioner = visit.practitioners as any
    const practiceName = practitioner?.practice_name || 'Your Care Provider'
    const doctorName = practitioner?.full_name || 'Your practitioner'

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
      y -= 14
      ensureSpace(40)
      drawTextLine(title, margin, y, 13, true, colors.dark)
      y -= 6
      page.drawLine({
        start: { x: margin, y },
        end: { x: pageWidth - margin, y },
        thickness: 0.5,
        color: colors.line,
      })
      y -= 16
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

      y -= 6
    }

    function drawInfoGrid(items: Array<{ label: string; value: string }>) {
      const colGap = 18
      const colWidth = (contentWidth - colGap) / 2

      for (let i = 0; i < items.length; i += 2) {
        const left = items[i]
        const right = items[i + 1]
        ensureSpace(40)

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
      const patientText = `${speciesLabel}: ${horse?.name || '—'}`
      drawTextLine(generatedText, pageWidth - margin - 120, y - 2, 9, false, colors.muted)
      drawTextLine(patientText, pageWidth - margin - 120, y - 18, 9, true, colors.text)

      y -= 58
      drawDivider(0, 18)
    }

    function truncate(text: string | null | undefined, maxChars: number): string {
      const t = text || '—'
      return t.length > maxChars ? t.slice(0, maxChars - 1) + '…' : t
    }

    function drawSummaryCard() {
      ensureSpace(114)

      const cardHeight = 98
      page.drawRectangle({
        x: margin,
        y: y - cardHeight,
        width: contentWidth,
        height: cardHeight,
        color: colors.soft,
        borderColor: colors.line,
        borderWidth: 1,
      })

      drawTextLine('VISIT SUMMARY', margin + 14, y - 13, 7.5, true, colors.muted)

      const colWidth = contentWidth / 2 - 14
      const leftX  = margin + 14
      const rightX = margin + contentWidth / 2 + 8
      const line1Y = y - 32
      const line2Y = y - 52
      const line3Y = y - 72

      // Left column — max ~36 chars each to stay within half the card
      drawTextLine(`Date:       ${truncate(visit.visit_date, 28)}`,      leftX, line1Y, 10, true)
      drawTextLine(`Provider:  ${truncate(visit.provider_name, 28)}`,    leftX, line2Y, 10, false)
      drawTextLine(`Follow Up: ${truncate(visit.follow_up, 28)}`,        leftX, line3Y, 10, false)

      // Right column
      drawTextLine(`Reason:    ${truncate(visit.reason_for_visit, 30)}`, rightX, line1Y, 10, true)
      drawTextLine(`Areas:     ${truncate(visit.treated_areas, 30)}`,    rightX, line2Y, 10, false)
      drawTextLine(`Location:  ${truncate(visit.location, 30)}`,         rightX, line3Y, 10, false)

      y -= cardHeight + 18
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
          return { imageHeight, scale }
        })

        const rowHeight = Math.max(...heights.map((h) => h.imageHeight + 34 + 18))
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

        y -= rowHeight + 10
      }
    }

    function drawSpineAssessment(
      findings: Record<string, SpineFinding>,
      notes: string | null
    ) {
      // Collect flagged segments grouped by section
      type FlaggedSeg = { label: string; left: boolean; right: boolean }
      type FlaggedSection = { label: string; segs: FlaggedSeg[] }

      const flaggedSections: FlaggedSection[] = []
      let totalFlagged = 0

      for (const section of SPINE_SECTIONS_PDF) {
        const segs: FlaggedSeg[] = []
        for (const seg of section.segments) {
          const f = findings[seg.key]
          if (f?.left || f?.right) {
            segs.push({ label: seg.label, left: f.left ?? false, right: f.right ?? false })
            totalFlagged++
          }
        }
        if (segs.length > 0) {
          flaggedSections.push({ label: section.label, segs })
        }
      }

      if (totalFlagged === 0) {
        drawTextLine('No fixations or subluxations noted.', margin, y, 10, false, colors.muted)
        y -= 18
      } else {
        // Column positions
        const nameColX  = margin
        const leftColX  = pageWidth - margin - 84
        const rightColX = pageWidth - margin - 34

        // Column headers
        ensureSpace(22)
        drawTextLine('SEGMENT', nameColX, y, 7.5, true, colors.muted)
        drawTextLine('LEFT', leftColX, y, 7.5, true, colors.muted)
        drawTextLine('RIGHT', rightColX, y, 7.5, true, colors.muted)
        y -= 6
        page.drawLine({
          start: { x: margin, y },
          end: { x: pageWidth - margin, y },
          thickness: 0.5,
          color: colors.line,
        })
        y -= 12

        for (const sec of flaggedSections) {
          ensureSpace(22 + sec.segs.length * 17)

          // Section sub-header — rect from y-18 to y, text baseline at y-12
          page.drawRectangle({
            x: margin,
            y: y - 18,
            width: contentWidth,
            height: 18,
            color: colors.soft,
          })
          drawTextLine(sec.label.toUpperCase(), nameColX + 4, y - 12, 8, true, colors.muted)
          y -= 24

          for (const seg of sec.segs) {
            ensureSpace(17)
            drawTextLine(seg.label, nameColX + 8, y, 10, false, colors.text)
            drawTextLine(
              seg.left  ? 'Yes' : '-',
              leftColX,  y, 10, seg.left,
              seg.left  ? rgb(0.80, 0.38, 0.0) : colors.muted
            )
            drawTextLine(
              seg.right ? 'Yes' : '-',
              rightColX, y, 10, seg.right,
              seg.right ? rgb(0.80, 0.38, 0.0) : colors.muted
            )
            y -= 17
          }
          y -= 6
        }
      }

      if (notes && notes.trim()) {
        y -= 4
        drawParagraph('Clinical Notes', notes)
      }
    }

    drawHeader()
    drawSummaryCard()

    const speciesFullMap: Record<string, string> = {
      equine: 'Equine',
      canine: 'Canine',
      feline: 'Feline',
      bovine: 'Bovine',
      porcine: 'Porcine',
      exotic: 'Exotic',
    }
    const patientSpecies = speciesFullMap[horse?.species as string] || 'Equine'
    drawSectionTitle('Patient Information')
    drawInfoGrid([
      { label: 'Patient Name', value: horse?.name || '—' },
      { label: 'Species', value: patientSpecies },
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

    if (spineAssessment) {
      drawSectionTitle('Spine Assessment')
      drawSpineAssessment(spineAssessment.findings, spineAssessment.notes)
    }

    await drawPhotos()

    // Anchor signature near the bottom of the last page instead of floating mid-page
    const sigBlockHeight = 130
    if (y - sigBlockHeight < margin) {
      // Not enough room — start a fresh page and anchor to its bottom
      newPage()
      y = margin + sigBlockHeight
    } else if (y > margin + sigBlockHeight) {
      // Plenty of room — pull signature down to a consistent bottom position
      y = margin + sigBlockHeight
    }
    // else: y is already close to the bottom — draw in place

    drawDivider(8, 18)

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

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('pdf route error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF.' }, { status: 500 })
  }
}