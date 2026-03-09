import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

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

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ visitId: string }> }
) {
  try {
    const { visitId } = await params

    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.FROM_EMAIL
    const openAiKey = process.env.OPENAI_API_KEY

    if (!resendApiKey) return NextResponse.json({ error: 'Missing RESEND_API_KEY.' }, { status: 500 })
    if (!fromEmail)    return NextResponse.json({ error: 'Missing FROM_EMAIL.' }, { status: 500 })
    if (!openAiKey)    return NextResponse.json({ error: 'Missing OPENAI_API_KEY.' }, { status: 500 })

    const supabase = getAdminSupabase()

    // Load visit + horse + owner
    const { data: visit, error: visitError } = await supabase
      .from('visits')
      .select(`
        *,
        horses (
          name, breed, age, discipline,
          owners ( full_name, email )
        )
      `)
      .eq('id', visitId)
      .single()

    if (visitError || !visit) {
      return NextResponse.json({ error: 'Visit not found.' }, { status: 404 })
    }

    const horse = visit.horses as any
    const owner = horse?.owners as any

    if (!owner?.email) {
      return NextResponse.json({ error: 'Owner does not have an email address on file.' }, { status: 400 })
    }

    // Load anatomy region notes
    const { data: anatomyRows } = await supabase
      .from('visit_anatomy_regions')
      .select('region_key, notes')
      .eq('visit_id', visitId)

    // Load spine assessment
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
          if (f.left || f.right) {
            spineFindings.push({ label: SPINE_LABELS[key] || key, left: f.left, right: f.right })
          }
        }
      }
    } catch { /* spine table may not exist */ }

    // Build context for AI
    const anatomyContext = (anatomyRows || [])
      .filter(r => r.notes?.trim())
      .map(r => `${REGION_LABELS[r.region_key] || r.region_key}: ${r.notes}`)
      .join('\n')

    const spineContext = spineFindings.length > 0
      ? spineFindings.map(f => `${f.label}: ${[f.left && 'left', f.right && 'right'].filter(Boolean).join(' & ')}`).join(', ')
      : ''

    const soapContext = [
      visit.subjective && `Subjective: ${visit.subjective}`,
      visit.objective  && `Objective: ${visit.objective}`,
      visit.assessment && `Assessment: ${visit.assessment}`,
      visit.plan       && `Plan: ${visit.plan}`,
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

    const client = new OpenAI({ apiKey: openAiKey })
    const aiResponse = await client.responses.create({
      model: 'gpt-4o-mini',
      input: prompt,
    })

    const summaryText = aiResponse.output_text?.trim() || ''
    if (!summaryText) {
      return NextResponse.json({ error: 'AI did not generate a summary.' }, { status: 500 })
    }

    // Build HTML version
    const paragraphs = summaryText.split(/\n\n+/).filter(Boolean)
    const htmlParagraphs = paragraphs.map(p => `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">${p.replace(/\n/g, '<br>')}</p>`).join('')

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <div style="background:#0f172a;padding:28px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Short-Go Equine Chiropractic</h1>
      <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">Visit Summary — ${horse?.name || 'Your Horse'}</p>
    </div>
    <div style="padding:28px 32px;">
      ${htmlParagraphs}
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">Dr. Andrew Leo D.C., M.S., cAVCA · Short-Go Equine Chiropractic</p>
      <p style="margin:4px 0 0;color:#cbd5e1;font-size:11px;">This is a plain-language summary for the horse owner. A full clinical report is available separately.</p>
    </div>
  </div>
</body>
</html>`

    const subject = `Visit Summary — ${horse?.name || 'Your Horse'} on ${visit.visit_date || 'your recent visit'}`

    const resend = new Resend(resendApiKey)
    const result = await resend.emails.send({
      from: fromEmail,
      to: owner.email,
      subject,
      text: summaryText,
      html: htmlBody,
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
