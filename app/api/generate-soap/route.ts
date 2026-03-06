import OpenAI from 'openai'
import { NextResponse } from 'next/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const { quickNotes, horseName, discipline } = await req.json()

    if (!quickNotes || !String(quickNotes).trim()) {
      return NextResponse.json(
        { error: 'Quick notes are required.' },
        { status: 400 }
      )
    }

    const response = await openai.responses.create({
      model: 'gpt-5-mini',
      input: [
        {
          role: 'system',
          content:
            'You are assisting an equine chiropractor with internal charting. Write concise, clinically grounded SOAP notes. Do not invent extreme findings.',
        },
        {
          role: 'user',
          content: `
Horse Name: ${horseName || 'Unknown horse'}
Discipline: ${discipline || 'Unknown discipline'}

Quick Notes:
${quickNotes}
          `,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'soap_note',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              subjective: { type: 'string' },
              objective: { type: 'string' },
              assessment: { type: 'string' },
              plan: { type: 'string' },
            },
            required: ['subjective', 'objective', 'assessment', 'plan'],
          },
        },
      },
    })

    const content = response.output_text?.trim()

    if (!content) {
      return NextResponse.json(
        { error: 'Model returned no content.' },
        { status: 500 }
      )
    }

    const parsed = JSON.parse(content)
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('SOAP generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate SOAP' },
      { status: 500 }
    )
  }
}