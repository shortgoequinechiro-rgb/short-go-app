import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const quickNotes = body.quickNotes?.trim() || ''
    const patientName = body.patientName?.trim() || 'Patient'
    const chiefComplaint = body.chiefComplaint?.trim() || ''
    const treatedAreas = body.treatedAreas?.trim() || ''
    const templateType = body.templateType?.trim() || ''

    if (!quickNotes) {
      return NextResponse.json(
        { error: 'Quick notes are required.' },
        { status: 400 }
      )
    }

    const templateContext = templateType
      ? `Common case type: ${templateType}. Use typical findings and treatment approaches for this presentation.\n`
      : ''

    const prompt = `
You are helping draft a human chiropractic SOAP note.

Patient: [REDACTED]
${chiefComplaint ? `Chief complaint: ${chiefComplaint}` : ''}
${treatedAreas ? `Areas to be treated: ${treatedAreas}` : ''}
${templateContext}
Quick notes from provider:
${quickNotes}

Return valid JSON with exactly these keys:
subjective
objective
assessment
plan
treated_areas
recommendations
follow_up

Rules:
- Keep it professional, concise, and clinically useful.
- Use standard human chiropractic terminology (subluxation, adjustment, ROM, palpation, etc.).
- Reference specific spinal segments (C1-C7, T1-T12, L1-L5, SI) when the notes mention them.
- Include relevant orthopedic/neurological test findings in the objective section when applicable.
- For the plan, include specific adjustment techniques used and any therapeutic modalities.
- recommendations should include home exercises, ergonomic advice, ice/heat instructions, etc.
- follow_up should suggest a return schedule.
- Do not invent diagnoses with excessive certainty.
- Do not include markdown fences.
- Output JSON only.
`.trim()

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a chiropractic documentation assistant specializing in human chiropractic care. You produce professional SOAP notes in valid JSON format following standard chiropractic documentation practices.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    })

    const text = response.choices[0]?.message?.content?.trim()

    if (!text) {
      return NextResponse.json(
        { error: 'No response generated.' },
        { status: 500 }
      )
    }

    let parsed: {
      subjective?: string
      objective?: string
      assessment?: string
      plan?: string
      treated_areas?: string
      recommendations?: string
      follow_up?: string
    }

    try {
      parsed = JSON.parse(text)
    } catch (parseError) {
      console.error('generate-soap-human JSON parse error:', parseError, text)
      return NextResponse.json(
        { error: 'Model returned invalid JSON.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      subjective: parsed.subjective || '',
      objective: parsed.objective || '',
      assessment: parsed.assessment || '',
      plan: parsed.plan || '',
      treated_areas: parsed.treated_areas || '',
      recommendations: parsed.recommendations || '',
      follow_up: parsed.follow_up || '',
    })
  } catch (error) {
    console.error('generate-soap-human error:', error)
    return NextResponse.json(
      { error: 'Failed to generate SOAP.' },
      { status: 500 }
    )
  }
}
