import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  try {
    const { visitId, superbillId, practitionerId } = await req.json()

    if (!practitionerId) {
      return NextResponse.json({ error: 'Practitioner ID required' }, { status: 400 })
    }

    // Fetch the visit SOAP note
    let visit: {
      id: string
      patient_id: string
      visit_date: string
      subjective: string | null
      objective: string | null
      assessment: string | null
      plan: string | null
      treated_areas: string | null
      reason_for_visit: string | null
    } | null = null

    if (visitId) {
      const { data } = await supabaseAdmin
        .from('human_visits')
        .select('id, patient_id, visit_date, subjective, objective, assessment, plan, treated_areas, reason_for_visit')
        .eq('id', visitId)
        .single()
      visit = data
    }

    // Fetch the superbill
    let superbill: {
      id: string
      diagnosis_codes: { code: string; description: string }[]
      procedure_codes: { code: string; description: string; units: number; fee: number }[]
      total_fee: number
      date_of_service: string
    } | null = null

    if (superbillId) {
      const { data } = await supabaseAdmin
        .from('superbills')
        .select('id, diagnosis_codes, procedure_codes, total_fee, date_of_service')
        .eq('id', superbillId)
        .single()
      superbill = data
    }

    if (!visit && !superbill) {
      return NextResponse.json({ error: 'Need at least a visit or superbill to scan' }, { status: 400 })
    }

    // Build the AI prompt
    const prompt = `
You are an expert healthcare compliance auditor specializing in chiropractic billing and documentation.

Analyze the following visit documentation and billing codes for compliance risks.

${visit ? `
=== SOAP NOTE ===
Visit Date: ${visit.visit_date}
Reason for Visit: ${visit.reason_for_visit || 'Not specified'}
Subjective: ${visit.subjective || 'EMPTY'}
Objective: ${visit.objective || 'EMPTY'}
Assessment: ${visit.assessment || 'EMPTY'}
Plan: ${visit.plan || 'EMPTY'}
Treated Areas: ${visit.treated_areas || 'Not specified'}
` : ''}

${superbill ? `
=== SUPERBILL / BILLING ===
Date of Service: ${superbill.date_of_service}
Diagnosis Codes (ICD-10): ${JSON.stringify(superbill.diagnosis_codes)}
Procedure Codes (CPT): ${JSON.stringify(superbill.procedure_codes)}
Total Fee: $${superbill.total_fee}
` : ''}

Check for these compliance issues:
1. Missing/incomplete SOAP sections (each section should have meaningful content)
2. Diagnosis codes not supported by documentation
3. Procedure codes not justified by the assessment
4. Medical necessity not clearly established
5. Missing treated areas or specificity
6. Upcoding risks (billing higher than documented complexity)
7. Unbundling risks (separately billing procedures that should be bundled)
8. Missing time-based documentation for time-based codes
9. Frequency/duration concerns
10. Missing patient consent or plan of care references

Return valid JSON with exactly these keys:
{
  "score": <number 0-100, where 100 is fully compliant>,
  "risk_level": "<low|medium|high|critical>",
  "summary": "<2-3 sentence overall assessment>",
  "issues": [
    {
      "type": "<missing_documentation|unsupported_code|medical_necessity|upcoding|unbundling|frequency|other>",
      "severity": "<info|warning|error|critical>",
      "message": "<specific finding>",
      "suggestion": "<actionable recommendation>"
    }
  ]
}

Rules:
- Be specific about which codes or sections have issues
- Provide actionable suggestions
- Score should reflect real audit risk
- Output JSON only, no markdown fences
`.trim()

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a healthcare compliance and billing auditor. Output valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    })

    const text = response.choices[0]?.message?.content?.trim()
    if (!text) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    let result: {
      score: number
      risk_level: string
      summary: string
      issues: { type: string; severity: string; message: string; suggestion: string }[]
    }

    try {
      result = JSON.parse(text)
    } catch {
      console.error('Compliance scan JSON parse error:', text)
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 })
    }

    // Save to database
    const { data: scan, error: insertError } = await supabaseAdmin
      .from('compliance_scans')
      .insert({
        practitioner_id: practitionerId,
        visit_id: visitId || null,
        superbill_id: superbillId || null,
        patient_id: visit?.patient_id || null,
        risk_level: result.risk_level,
        issues: result.issues,
        score: result.score,
        summary: result.summary,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to save compliance scan:', insertError)
    }

    return NextResponse.json({
      ...result,
      scanId: scan?.id || null,
    })
  } catch (error) {
    console.error('Compliance scan error:', error)
    return NextResponse.json({ error: 'Compliance scan failed' }, { status: 500 })
  }
}
