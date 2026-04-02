import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { requireAuth } from '../../lib/auth'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await requireAuth(req)
    if (authError) return authError

    const body = await req.json()

    const quickNotes = body.quickNotes?.trim() || ''
    const horseName = body.horseName?.trim() || 'Patient'
    const species: 'equine' | 'canine' | 'feline' | 'bovine' | 'porcine' | 'exotic' =
      ['canine', 'feline', 'bovine', 'porcine', 'exotic'].includes(body.species) ? body.species : 'equine'
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

    const speciesLabels: Record<string, string> = {
      equine: 'Horse (Equine)',
      canine: 'Dog (Canine)',
      feline: 'Cat (Feline)',
      bovine: 'Bovine',
      porcine: 'Porcine',
      exotic: 'Exotic',
    }

    const prompt = `
You are helping draft a ${species} chiropractic SOAP note.

Patient name: ${horseName}
Species: ${speciesLabels[species]}
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
- Use ${species} chiropractic language and terminology when appropriate.
- If anatomy region notes are provided, incorporate them naturally into objective and assessment when relevant.
- Do not invent diagnoses with excessive certainty.
- Do not include markdown fences.
- Output JSON only.
`.trim()

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    })

    const text = response.choices?.[0]?.message?.content?.trim()

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