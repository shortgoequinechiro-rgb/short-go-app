import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── DELETE — remove a document ──────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ ownerId: string; documentId: string }> }
) {
  try {
    const { documentId } = await params

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

    // Fetch the document to get the file_path
    const { data: doc, error: fetchError } = await supabase
      .from('owner_documents')
      .select('id, file_path, practitioner_id')
      .eq('id', documentId)
      .eq('practitioner_id', user.id)
      .single()

    if (fetchError || !doc) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 })
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('owner-documents')
      .remove([doc.file_path])

    if (storageError) {
      console.error('[documents] storage delete error:', storageError)
      // Continue with DB delete anyway
    }

    // Delete DB record
    const { error: deleteError } = await supabase
      .from('owner_documents')
      .delete()
      .eq('id', documentId)
      .eq('practitioner_id', user.id)

    if (deleteError) {
      console.error('[documents] DB delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete document.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[documents] DELETE error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
