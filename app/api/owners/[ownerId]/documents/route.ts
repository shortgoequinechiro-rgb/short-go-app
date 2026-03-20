import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ── Admin Supabase ──────────────────────────────────────────────────────────

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── GET — list documents for an owner ───────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ownerId: string }> }
) {
  try {
    const { ownerId } = await params

    // Auth
    const authorization = req.headers.get('authorization')
    if (!authorization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authorization.replace('Bearer ', '')
    const supabase = getAdminSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch documents for this owner belonging to this practitioner
    const { data: docs, error } = await supabase
      .from('owner_documents')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('practitioner_id', user.id)
      .order('uploaded_at', { ascending: false })

    if (error) {
      console.error('[documents] list error:', error)
      return NextResponse.json({ error: 'Failed to list documents.' }, { status: 500 })
    }

    // Generate signed URLs for each document
    const docsWithUrls = await Promise.all(
      (docs || []).map(async (doc) => {
        const { data: urlData } = await supabase.storage
          .from('owner-documents')
          .createSignedUrl(doc.file_path, 3600) // 1 hour expiry

        return {
          ...doc,
          url: urlData?.signedUrl || null,
        }
      })
    )

    return NextResponse.json({ documents: docsWithUrls })
  } catch (err) {
    console.error('[documents] GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// ── POST — upload a new document ────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ownerId: string }> }
) {
  try {
    const { ownerId } = await params

    // Auth
    const authorization = req.headers.get('authorization')
    if (!authorization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authorization.replace('Bearer ', '')
    const supabase = getAdminSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    const note = (formData.get('note') as string) || null

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
    }

    // 20 MB limit
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be under 20 MB.' }, { status: 400 })
    }

    // Read file
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Build storage path: {practitionerId}/{ownerId}/{timestamp}_{filename}
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${user.id}/${ownerId}/${Date.now()}_${safeName}`

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('owner-documents')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('[documents] upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload file.' }, { status: 500 })
    }

    // Insert record
    const { data: doc, error: insertError } = await supabase
      .from('owner_documents')
      .insert({
        owner_id: ownerId,
        practitioner_id: user.id,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        category: 'upload',
        note,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[documents] insert error:', insertError)
      // Clean up uploaded file
      await supabase.storage.from('owner-documents').remove([filePath])
      return NextResponse.json({ error: 'Failed to save document record.' }, { status: 500 })
    }

    // Get signed URL
    const { data: urlData } = await supabase.storage
      .from('owner-documents')
      .createSignedUrl(filePath, 3600)

    return NextResponse.json({
      success: true,
      document: { ...doc, url: urlData?.signedUrl || null },
    })
  } catch (err) {
    console.error('[documents] POST error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
