import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const GOOGLE_REVIEW_URL = 'https://g.page/r/CepSPoXWB-BaEAI/review'

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase env vars.')
  return createClient(supabaseUrl, serviceRoleKey)
}

const REGION_LABELS: Record<string, string> = {
  pollAtlas: 'Poll / Atlas',
  withers: 'Withers',
  thoracolumbar: 'Thoracolumbar Junction',
  siJoint: 'Sacroiliac Joint',
  hock: 'Hock',
}

// ── PDF generation ────────────────────────────────────────────────────────────

async function generateSummaryPDF(summaryText: string, horseName: string, visitDate: string, ownerName: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const PAGE_W = 612
  const PAGE_H = 792
  const MARGIN = 56
  const CONTENT_W = PAGE_W - MARGIN * 2

  function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    const words = text.split(/\s+/)
    const lines: string[] = []
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
    return lines.length ? lines : ['']
  }

  let page = doc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  // ── Header bar ──
  page.drawRectangle({ x: 0, y: PAGE_H - 80, width: PAGE_W, height: 80, color: rgb(0.059, 0.090, 0.165) })
  page.drawText('Short-Go Equine Chiropractic', { x: MARGIN, y: PAGE_H - 38, size: 16, font: fontBold, color: rgb(1, 1, 1) })
  page.drawText(`Visit Summary — ${horseName}`, { x: MARGIN, y: PAGE_H - 60, size: 11, font, color: rgb(0.58, 0.64, 0.75) })
  y = PAGE_H - 80 - 24

  // ── Meta row ──
  const metaLine = `Date: ${visitDate || 'Recent Visit'}   |   Owner: ${ownerName}`
  page.drawText(metaLine, { x: MARGIN, y, size: 10, font, color: rgb(0.4, 0.45, 0.55) })
  y -= 24

  // ── Divider ──
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: rgb(0.88, 0.90, 0.93) })
  y -= 20

  // ── Body paragraphs ──
  const paragraphs = summaryText.split(/\n\n+/).filter(Boolean)
  for (const para of paragraphs) {
    const lines = para.split('\n').flatMap(l => wrapText(l, CONTENT_W, 11))
    for (const line of lines) {
      if (y < MARGIN + 100) {
        page = doc.addPage([PAGE_W, PAGE_H])
        y = PAGE_H - MARGIN
      }
      page.drawText(line, { x: MARGIN, y, size: 11, font, color: rgb(0.13, 0.18, 0.25) })
      y -= 17
    }
    y -= 10 // paragraph spacing
  }

  // ── Review CTA ──
  if (y < MARGIN + 80) {
    page = doc.addPage([PAGE_W, PAGE_H])
    y = PAGE_H - MARGIN
  }
  y -= 10
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: rgb(0.88, 0.90, 0.93) })
  y -= 20
  page.drawText('We\'d love your feedback!', { x: MARGIN, y, size: 12, font: fontBold, color: rgb(0.13, 0.18, 0.25) })
  y -= 18
  page.drawText('If you were happy with today\'s visit, please consider leaving us a Google review:', { x: MARGIN, y, size: 10, font, color: rgb(0.4, 0.45, 0.55) })
  y -= 16
  page.drawText(GOOGLE_REVIEW_URL, { x: MARGIN, y, size: 10, font, color: rgb(0.13, 0.47, 0.94) })

  // ── Footer ──
  const footerY = MARGIN - 12
  page.drawText('Dr. Andrew Leo D.C., M.S., cAVCA · Short-Go Equine Chiropractic', { x: MARGIN, y: footerY, size: 9, font, color: rgb(0.6, 0.65, 0.70) })

  return doc.save()
}

// ── Shared: build summary text + HTML without sending ─────────────────────────

async function buildSummary(visitId: string) {
  const supabase = getAdminSupabase()

  const { data: visit, error: visitError } = await supabase
    .from('visits')
    .select(`*, horses ( name, breed, age, discipline, owners ( full_name, email ) )`)
    .eq('id', visitId)
    .single()

  if (visitError || !visit) throw new Error('Visit not found.')

  const horse = visit.horses as any
  const owner = horse?.owners as any

  const { data: anatomyRows } = await supabase
    .from('visit_anatomy_regions')
    .select('region_key, notes')
    .eq('visit_id', visitId)

  let spineFindings: Array<{ label: string; left: boolean; right: boolean }> = []
  try {
    const { data: spineData } = await supabase
      .from('spine_assessments')
      .select('findings')
      .eq('visit_id', visitId)
      .order('assessed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (spineData?.findings) {
      const SPINE_LABELS: Record<string, string> = {
        tmj: 'TMJ', poll: 'Poll (C0–C1)', c1_c2: 'C1–C2', c2_c3: 'C2–C3',
        c3_c4: 'C3–C4', c4_c5: 'C4–C5', c5_c6: 'C5–C6', c6_c7: 'C6–C7',
        sacrum: 'Sacrum', si_joint: 'SI Joint', coccygeal: 'Coccygeal',
      }
      for (let i = 1; i <= 17; i++) SPINE_LABELS[`t${i}_${i+1}`] = `T${i}–T${i+1}`
      for (let i = 1; i <= 6; i++) SPINE_LABELS[`l${i}_${i+1}`] = `L${i}–L${i+1}`
      for (const [key, f] of Object.entries(spineData.findings as Record<string, { left: boolean; right: boolean }>)) {
        if (f.left || f.right) spineFindings.push({ label: SPINE_LABELS[key] || key, left: f.left, right: f.right })
      }
    }
  } catch { /* spine table may not exist */ }

  const anatomyContext = (anatomyRows || [])
    .filter(r => r.notes?.trim())
    .map(r => `${REGION_LABELS[r.region_key] || r.region_key}: ${r.notes}`)
    .join('\n')

  const spineContext = spineFindings.length > 0
    ? spineFindings.map(f => `${f.label}: ${[f.left && 'left', f.right && 'right'].filter(Boolean).join(' & ')}`).join(', ')
    : ''

  const soapContext = [
    visit.subjective    && `Subjective: ${visit.subjective}`,
    visit.objective     && `Objective: ${visit.objective}`,
    visit.assessment    && `Assessment: ${visit.assessment}`,
    visit.plan          && `Plan: ${visit.plan}`,
    visit.recommendations && `Recommendations: ${visit.recommendations}`,
  ].filter(Boolean).join('\n')

  const prompt = `
You are writing a warm, plain-English visit summary email for a horse owner (not a veterinarian or chiropractor).
Translate clinical notes into easy-to-understand language. Be positive but honest. Keep it concise — 3 to 5 short paragraphs maximum.

Horse: ${horse?.name || 'the horse'}
Owner: ${owner?.full_name || ''}
Visit date: ${visit.visit_date || 'today'}
Reason: ${visit.reason_for_visit || 'routine adjustment'}
${soapContext ? `\nClinical notes:\n${soapContext}` : ''}
${anatomyContext ? `\nAnatomy region notes:\n${anatomyContext}` : ''}
${spineContext ? `\nSpine segments flagged: ${spineContext}` : ''}
${visit.follow_up ? `\nFollow-up recommendation: ${visit.follow_up}` : ''}

Write the email body only (no subject line). Start with a warm greeting using the owner's name.
Use plain language — avoid clinical jargon. Explain what was found, what was done, and what to watch for at home.
End with follow-up recommendations and a warm sign-off from Dr. Andrew Leo.
`.trim()

  const openAiKey = process.env.OPENAI_API_KEY
  if (!openAiKey) throw new Error('Missing OPENAI_API_KEY.')

  const client = new OpenAI({ apiKey: openAiKey })
  const aiResponse = await client.responses.create({ model: 'gpt-4o-mini', input: prompt })
  const summaryText = aiResponse.output_text?.trim() || ''
  if (!summaryText) throw new Error('AI did not generate a summary.')

  const paragraphs = summaryText.split(/\n\n+/).filter(Boolean)
  const htmlParagraphs = paragraphs.map(p => `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">${p.replace(/\n/g, '<br>')}</p>`).join('')
  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <div style="background:#0f172a;padding:28px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Short-Go Equine Chiropractic</h1>
      <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">Visit Summary — ${horse?.name || 'Your Horse'}</p>
    </div>
    <div style="padding:28px 32px;">${htmlParagraphs}</div>
    <div style="padding:0 32px 28px;">
      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:20px 24px;text-align:center;">
        <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#92400e;">⭐ Enjoyed today's visit?</p>
        <p style="margin:0 0 16px;font-size:13px;color:#78350f;">We'd love to hear your feedback — it helps other horse owners find us!</p>
        <a href="${GOOGLE_REVIEW_URL}" target="_blank" style="display:inline-block;background:#1a73e8;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:8px;">Leave a Google Review ★</a>
      </div>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">Dr. Andrew Leo D.C., M.S., cAVCA · Short-Go Equine Chiropractic</p>
      <p style="margin:4px 0 0;color:#cbd5e1;font-size:11px;">This is a plain-language summary for the horse owner. A full clinical report is available separately.</p>
    </div>
  </div>
</body>
</html>`

  const subject = `Visit Summary — ${horse?.name || 'Your Horse'} on ${visit.visit_date || 'your recent visit'}`

  return {
    summaryText,
    htmlBody,
    subject,
    ownerEmail: owner?.email || null,
    ownerName: owner?.full_name || '',
    horseName: horse?.name || 'Your Horse',
    visitDate: visit.visit_date || '',
  }
}

// ── GET: preview only (no email sent) ─────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ visitId: string }> }
) {
  try {
    const { visitId } = await params
    const { summaryText, subject, ownerEmail, ownerName } = await buildSummary(visitId)
    return NextResponse.json({ summaryText, subject, ownerEmail, ownerName })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to generate preview.' }, { status: 500 })
  }
}

// ── POST: generate + send ──────────────────────────────────────────────────────

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ visitId: string }> }
) {
  try {
    const { visitId } = await params

    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.FROM_EMAIL
    if (!resendApiKey) return NextResponse.json({ error: 'Missing RESEND_API_KEY.' }, { status: 500 })
    if (!fromEmail)    return NextResponse.json({ error: 'Missing FROM_EMAIL.' }, { status: 500 })

    const { summaryText, htmlBody, subject, ownerEmail, ownerName, horseName, visitDate } = await buildSummary(visitId)

    if (!ownerEmail) {
      return NextResponse.json({ error: 'Owner does not have an email address on file.' }, { status: 400 })
    }

    // Generate PDF summary attachment
    const pdfBytes = await generateSummaryPDF(summaryText, horseName, visitDate, ownerName)
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64')
    const pdfFilename = `visit-summary-${horseName.replace(/\s+/g, '-').toLowerCase()}-${visitDate || 'recent'}.pdf`

    const resend = new Resend(resendApiKey)
    const result = await resend.emails.send({
      from: fromEmail,
      to: ownerEmail,
      subject,
      text: summaryText + `\n\nWe'd love your feedback! Leave us a Google review: ${GOOGLE_REVIEW_URL}`,
      html: htmlBody,
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBase64,
        },
      ],
    })

    if ((result as any)?.error) {
      return NextResponse.json({ error: (result as any).error.message || 'Send failed.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('owner-summary route error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to send owner summary.' }, { status: 500 })
  }
}
