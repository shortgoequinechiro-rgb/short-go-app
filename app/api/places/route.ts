import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const input = searchParams.get('input')?.trim()

  if (!input || input.length < 2) {
    return NextResponse.json({ predictions: [] })
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Maps API key not configured.' }, { status: 500 })
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
  url.searchParams.set('input', input)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('language', 'en')

  const res = await fetch(url.toString())
  const data = await res.json()

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error('Google Places error:', data.status, data.error_message)
    return NextResponse.json({ predictions: [] })
  }

  const predictions = (data.predictions || []).map((p: any) => ({
    description: p.description,
    place_id: p.place_id,
  }))

  return NextResponse.json({ predictions })
}
