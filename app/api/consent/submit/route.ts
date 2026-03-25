import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const supabase = getAdminSupabase()

  let body: {
    ownerId: string
    signedName: string
    signatureData: string | null
    horsesAcknowledged: string | null
    notes: string | null
    smsConsent?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { ownerId, signedName, signatureData, horsesAcknowledged, notes, smsConsent } = body

  if (!ownerId || !signedName) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  // Fetch owner to get practitioner_id
  const { data: owner, error: ownerError } = await supabase
    .from('owners')
    .select('id, practitioner_id')
    .eq('id', ownerId)
    .single()

  if (ownerError || !owner) {
    return NextResponse.json({ error: 'Owner not found.' }, { status: 404 })
  }

  const { data: newConsent, error } = await supabase
    .from('consent_forms')
    .insert({
      owner_id: ownerId,
      signed_name: signedName,
      signed_at: new Date().toISOString(),
      form_version: '1.0',
      horses_acknowledged: horsesAcknowledged,
      notes: notes || null,
      signature_data: signatureData,
      practitioner_id: owner.practitioner_id,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to insert consent form:', error)
    return NextResponse.json({ error: 'Failed to save consent.' }, { status: 500 })
  }

  // If the client consented to SMS, update their opt-in status
  if (smsConsent) {
    await supabase
      .from('owners')
      .update({ sms_consent_status: 'opted_in' })
      .eq('id', ownerId)
  }

  return NextResponse.json({ success: true, id: newConsent?.id })
}
