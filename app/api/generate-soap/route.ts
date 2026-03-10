import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const quickNotes = body.quickNotes?.trim() || ''
    const horseName = body.horseName?.trim() || 'Patient'
    const species: 'equine' | 'canine' = body.species === 'canine' ? 'canine' : 'equine'
    const discipline = body.discipline?.trim() || (species === 'canine' ? 'Unknown activity' : 'Unknown discipline')
    const anatomyContext = body.anatomyContext?.trim() || ''

    if (!quickNotes) {
      return NextResponse.json(
        { error: 'Quick notes are required.' },
        { status: 400 }
      )
    }

    const anatomySection = anatomyContext
      ? `Saved anatomy region notes for this visit:
${anatomyContext}
`
      : 'No saved anatomy region notes were provided for this visit.\n'

    const prompt = `
You are helping draft a ${species === 'canine' ? 'canine' : 'equine'} chiropractic SOAP note.

Patient name: ${horseName}
Species: ${species === 'canine' ? 'Dog (Canine)' : 'Horse (Equine)'}
${species === 'canine' ? 'Activity / Sport' : 'Discipline'}: ${discipline}

Quick notes from provider:
${quickNotes}

${anatomySection}

Return valid JSON with exactly these keys:
subjective
objective
assessment
plan

Rules:
- Keep it professional, concise, and clinically useful.
- Use ${species === 'canine' ? 'canine' : 'equine'} chiropractic language when appropriate.
- If anatomy region notes are provided, incorporate them naturally into objective and assessment when relevant.
- Do not invent diagnoses with excessive certainty.
- Do not include markdown fences.
- Output JSON only.
`.trim()

    const response = await client.responses.create({
      model: 'gpt-4o-mini',
      input: prompt,
    })

    const text = response.output_text?.trim()

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
    }

    try {
      parsed = JSON.parse(text)
    } catch (parseError) {
      console.error('generate-soap JSON parse error:', parseError, text)
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
    })
  } catch (error) {
    console.error('generate-soap error:', error)
    return NextResponse.json(
      { error: 'Failed to generate SOAP.' },
      { status: 500 }
    )
  }
}