import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../../../../lib/auth'
import fs from 'fs'
import path from 'path'

// ── Consent text (mirrors the intake form page) ────────────────────────────────

function buildConsentText(ownerName: string, animalName: string, doctorName: string): string[] {
  return [
    `I, ${ownerName}, hereby give my consent for ${animalName} to receive chiropractic care from ${doctorName}. I understand that chiropractic care involves the assessment and adjustment of the musculoskeletal system of animals to restore proper function and mobility.`,
    `I acknowledge that chiropractic care is a complementary therapy and is not a substitute for traditional veterinary medical care. I understand that while chiropractic adjustments are generally safe and well-tolerated, there are inherent risks associated with any manual therapy, including the risk of injury or exacerbation of pre-existing conditions.`,
    `I agree to provide accurate and complete information about ${animalName}'s medical history, current health status, and any relevant veterinary treatments or procedures. I understand that this information will be used by the chiropractor to assess ${animalName}'s condition and develop an appropriate treatment plan.`,
    `I understand that the chiropractor may need to perform a physical examination and/or diagnostic tests to evaluate ${animalName}'s condition and determine the appropriate course of chiropractic care. I agree to comply with any recommendations or instructions provided by the chiropractor regarding ${animalName}'s care, including follow-up appointments and home care exercises.`,
    `By signing below, I acknowledge that I have read and understood the information provided in this consent form, and I voluntarily consent to ${animalName} receiving chiropractic care from ${doctorName}.`,
  ]
}

// ── Supabase admin client ──────────────────────────────────────────────────────

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables.')
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

// ── Logo loader ────────────────────────────────────────────────────────────────

async function embedLogo(pdfDoc: PDFDocument) {
  const candidates = [
    'logo.png', 'logo.jpg', 'logo.jpeg',
    'short-go-logo.png', 'short-go-logo.jpg', 'short-go-logo.jpeg',
  ]
  for (const name of candidates) {
    const filePath = path.join(process.cwd(), 'public', name)
    if (fs.existsSync(filePath)) {
      try {
        const bytes = fs.readFileSync(filePath)
        const ext = path.extname(filePath).toLowerCase()
        return ext === '.jpg' || ext === '.jpeg'
          ? await pdfDoc.embedJpg(bytes)
          : await pdfDoc.embedPng(bytes)
      } catch { return null }
    }
  }
  return null
}

// ── Text wrap ──────────────────────────────────────────────────────────────────

function wrapText(text: string, maxChars = 86): string[] {
  if (!text) return ['—']
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word
    if (next.length > maxChars) { if (cur) lines.push(cur); cur = word }
    else cur = next
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['—']
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { user, error: authError } = await requireAuth(_req)
    if (authError) return authError

    const { formId } = await params
    const supabase = getAdminSupabase()

    const { data: form, error } = await supabase
      .from('intake_forms')
      .select(`
        *,
        owners ( full_name, phone, email, address, practitioner_id ),
        horses ( id, name, species ),
        practitioners ( practice_name, full_name )
      `)
      .eq('id', formId)
      .single()

    if (error || !form) {
      return NextResponse.json({ error: 'Intake form not found.' }, { status: 404 })
    }

    const owner = form.owners as { full_name: string; phone: string | null; email: string | null; address: string | null; practitioner_id: string | null } | null
    const practitioner = form.practitioners as { practice_name: string | null; full_name: string | null } | null
    const ownerName = owner?.full_name || form.signed_name || 'Owner'
    const animalName = form.animal_name || 'Patient'
    const practiceName = practitioner?.practice_name || 'Your Care Provider'
    const doctorName = practitioner?.full_name || 'the attending practitioner'

    // ── PDF setup ─────────────────────────────────────────────────────────────

    const pdfDoc   = await PDFDocument.create()
    const font     = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const bold     = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const logoImg  = await embedLogo(pdfDoc)

    const PW = 612, PH = 792, M = 44, CW = PW - M * 2
    let page = pdfDoc.addPage([PW, PH])
    let y = PH - M

    const C = {
      text:    rgb(0.12, 0.12, 0.12),
      muted:   rgb(0.42, 0.42, 0.42),
      line:    rgb(0.84, 0.86, 0.88),
      soft:    rgb(0.95, 0.96, 0.97),
      dark:    rgb(0.06, 0.12, 0.25),
      white:   rgb(1, 1, 1),
      green:   rgb(0.06, 0.53, 0.35),
      greenBg: rgb(0.92, 0.98, 0.95),
    }

    function np() { page = pdfDoc.addPage([PW, PH]); y = PH - M }
    function space(h: number) { if (y - h < M) np() }

    function T(text: string, x: number, yy: number, sz = 10, b = false, c = C.text) {
      page.drawText(text, { x, y: yy, size: sz, font: b ? bold : font, color: c })
    }

    function divider(top = 6, bot = 12) {
      y -= top
      page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.75, color: C.line })
      y -= bot
    }

    function sectionTitle(title: string) {
      y -= 12
      space(36)
      // Colored title bar
      page.drawRectangle({ x: M, y: y - 20, width: CW, height: 20, color: C.dark })
      T(title.toUpperCase(), M + 10, y - 13, 8.5, true, C.white)
      y -= 28
    }

    function infoGrid(items: Array<{ label: string; value: string }>) {
      const gap = 14, col = (CW - gap) / 2
      for (let i = 0; i < items.length; i += 2) {
        const l = items[i], r = items[i + 1]
        space(42)
        page.drawRectangle({ x: M,             y: y - 36, width: col,  height: 36, color: C.soft, borderColor: C.line, borderWidth: 0.6 })
        T(l.label.toUpperCase(), M + 9, y - 11, 7, true, C.muted)
        T(l.value || '—',        M + 9, y - 25, 9.5, false, C.text)
        if (r) {
          const rx = M + col + gap
          page.drawRectangle({ x: rx, y: y - 36, width: col, height: 36, color: C.soft, borderColor: C.line, borderWidth: 0.6 })
          T(r.label.toUpperCase(), rx + 9, y - 11, 7, true, C.muted)
          T(r.value || '—',        rx + 9, y - 25, 9.5, false, C.text)
        }
        y -= 44
      }
    }

    function blockField(label: string, value: string | null) {
      if (!value) return
      const lines = wrapText(value, 86)
      space(20 + lines.length * 13)
      T(label.toUpperCase(), M, y, 7.5, true, C.muted)
      y -= 13
      for (const ln of lines) { T(ln, M + 2, y, 9.5, false, C.text); y -= 13 }
      y -= 4
    }

    // ── Header banner ─────────────────────────────────────────────────────────

    space(80)
    page.drawRectangle({ x: M, y: y - 68, width: CW, height: 68, color: C.dark })

    if (logoImg) {
      const d = logoImg.scale(1), sc = Math.min(44 / d.width, 44 / d.height)
      const lw = d.width * sc, lh = d.height * sc
      page.drawImage(logoImg, { x: M + 12, y: y - 12 - lh, width: lw, height: lh })
      T(practiceName,                         M + 14 + lw + 10, y - 18, 16, true,  C.white)
      T('Chiropractic Intake Form',            M + 14 + lw + 10, y - 36, 9.5, false, rgb(0.65, 0.72, 0.85))
      T(doctorName,                            M + 14 + lw + 10, y - 50, 9,   false, rgb(0.55, 0.62, 0.75))
    } else {
      T(practiceName,                    M + 14, y - 20, 16, true,  C.white)
      T('Chiropractic Intake Form',      M + 14, y - 37, 9.5, false, rgb(0.65, 0.72, 0.85))
      T(doctorName,                      M + 14, y - 51, 9,   false, rgb(0.55, 0.62, 0.75))
    }

    const submittedAt = new Date(form.submitted_at)
    const dateStr = submittedAt.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
    const timeStr = submittedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    T(`Submitted: ${dateStr} at ${timeStr}`, PW - M - 180, y - 20, 8, false, rgb(0.6, 0.68, 0.8))

    y -= 82

    // ── Signed banner ─────────────────────────────────────────────────────────

    space(36)
    page.drawRectangle({ x: M, y: y - 30, width: CW, height: 30, color: C.greenBg, borderColor: rgb(0.18, 0.72, 0.5), borderWidth: 0.75 })
    T('✓  SIGNED & SUBMITTED', M + 14, y - 11, 9, true, C.green)
    T(`Signed by ${ownerName}  ·  ${dateStr} at ${timeStr}`, M + 14, y - 22, 8.5, false, C.green)
    y -= 42

    // ── Owner information ─────────────────────────────────────────────────────

    sectionTitle('Owner Information')
    infoGrid([
      { label: 'Owner Name', value: ownerName },
      { label: 'Phone',      value: owner?.phone || '—' },
      { label: 'Email',      value: owner?.email || '—' },
      { label: 'Address',    value: owner?.address || '—' },
    ])
    if (form.referral_source && (form.referral_source as string[]).length > 0) {
      space(42)
      page.drawRectangle({ x: M, y: y - 36, width: CW, height: 36, color: C.soft, borderColor: C.line, borderWidth: 0.6 })
      T('REFERRED BY', M + 9, y - 11, 7, true, C.muted)
      T((form.referral_source as string[]).join(', '), M + 9, y - 25, 9.5, false, C.text)
      y -= 44
    }

    // ── Animal information ────────────────────────────────────────────────────

    sectionTitle('Animal Information')
    infoGrid([
      { label: 'Animal Name', value: animalName },
      { label: 'Species',     value: form.animal_species === 'canine' ? 'Canine / Dog' : 'Equine / Horse' },
      { label: 'Age',         value: form.animal_age  || '—' },
      { label: 'Breed',       value: form.animal_breed || '—' },
      { label: 'Sex / Gender',value: form.animal_gender || '—' },
      { label: 'Height',      value: form.animal_height || '—' },
      { label: 'Color',       value: form.animal_color || '—' },
      { label: 'Date of Birth', value: form.animal_dob ? new Date(form.animal_dob).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' },
      { label: 'Previous Chiro Care', value: form.previous_chiro_care === true ? 'Yes' : form.previous_chiro_care === false ? 'No' : '—' },
      { label: 'Use / Job of Animal', value: form.use_of_animal || '—' },
    ])
    if (form.reason_for_care) { y -= 4; blockField('Reason for Seeking Chiropractic Care', form.reason_for_care) }

    // ── Medical history ───────────────────────────────────────────────────────

    sectionTitle('Medical History')
    blockField('Health Problems / Concerns',      form.health_problems)
    blockField('Recent Changes in Behavior',      form.behavior_changes)
    blockField('Conditions / Illnesses',          form.conditions_illnesses)
    blockField('Medications / Supplements',       form.medications_supplements)

    // ── Informed consent ──────────────────────────────────────────────────────

    sectionTitle('Informed Consent')

    const consentParagraphs = buildConsentText(ownerName, animalName, doctorName)
    for (const para of consentParagraphs) {
      const lines = wrapText(para, 84)
      space(lines.length * 12 + 12)
      for (const ln of lines) { T(ln, M + 2, y, 9, false, C.text); y -= 12 }
      y -= 8
    }

    // ── Signature ─────────────────────────────────────────────────────────────

    y -= 8
    divider(0, 14)
    T('Pet Owner\'s Signature', M, y, 10, true, C.muted)
    y -= 14

    if (form.signature_data) {
      const b64match = (form.signature_data as string).match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/)
      if (b64match) {
        try {
          const imgBytes = Buffer.from(b64match[2], 'base64')
          const sigImg = b64match[1] === 'png'
            ? await pdfDoc.embedPng(imgBytes)
            : await pdfDoc.embedJpg(imgBytes)

          const boxW = CW, boxH = 90
          space(boxH + 40)
          page.drawRectangle({ x: M, y: y - boxH, width: boxW, height: boxH, color: C.white, borderColor: C.line, borderWidth: 1 })

          const d = sigImg.scale(1), sc = Math.min((boxW - 16) / d.width, (boxH - 12) / d.height)
          page.drawImage(sigImg, {
            x: M + (boxW - d.width * sc) / 2,
            y: y - boxH + (boxH - d.height * sc) / 2,
            width: d.width * sc,
            height: d.height * sc,
          })
          y -= boxH + 10

        } catch (err) {
          console.error('Signature embed error:', err)
          T('[Signature image could not be rendered]', M, y, 9, false, C.muted)
          y -= 18
        }
      }
    } else {
      space(36)
      page.drawRectangle({ x: M, y: y - 32, width: CW, height: 32, color: C.soft, borderColor: C.line, borderWidth: 0.75 })
      T('No signature on file.', M + 12, y - 18, 9, false, C.muted)
      y -= 42
    }

    // Signature attribution line
    page.drawLine({ start: { x: M, y: y - 2 }, end: { x: M + 240, y: y - 2 }, thickness: 0.75, color: C.muted })
    T(ownerName, M, y - 14, 9.5, true, C.text)
    T(`Date: ${new Date(form.submitted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, M + 260, y - 14, 9.5, false, C.muted)
    y -= 30

    // ── Footer on every page ──────────────────────────────────────────────────

    const totalPages = pdfDoc.getPageCount()
    for (let i = 0; i < totalPages; i++) {
      const pg = pdfDoc.getPage(i)
      const fy = M - 10
      pg.drawLine({ start: { x: M, y: fy + 16 }, end: { x: PW - M, y: fy + 16 }, thickness: 0.5, color: C.line })
      pg.drawText(`${practiceName}  ·  Intake Form`, { x: M, y: fy + 6, size: 7.5, font, color: C.muted })
      pg.drawText(`Page ${i + 1} of ${totalPages}`, { x: PW - M - 50, y: fy + 6, size: 7.5, font, color: C.muted })
    }

    // ── Serialize ─────────────────────────────────────────────────────────────

    const pdfBytes = await pdfDoc.save()
    const safeName = animalName.replace(/\s+/g, '-').toLowerCase()
    const fileName = `intake-${safeName}-${form.form_date || new Date(form.submitted_at).toISOString().split('T')[0]}.pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
      },
    })
  } catch (err) {
    console.error('intake pdf route error:', err)
    return NextResponse.json({ error: 'Failed to generate PDF.' }, { status: 500 })
  }
}
