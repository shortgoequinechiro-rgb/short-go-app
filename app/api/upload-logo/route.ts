import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const authorization = req.headers.get('authorization')

    if (!authorization) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 })
    }

    // Extract token from Authorization header (Bearer <token>)
    const token = authorization.replace('Bearer ', '')

    // Verify JWT and get user identity
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse multipart form data
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file is an image
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Enforce 5 MB file size limit
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Logo must be under 5 MB' }, { status: 400 })
    }

    // Get file extension
    const ext = file.type.split('/')[1] || 'png'

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const filePath = `${user.id}/logo.${ext}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('logos')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true, // Overwrite if exists
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError.message, uploadError)

      // If the bucket doesn't exist, provide a clear message
      if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
        return NextResponse.json(
          { error: 'Logo storage is not configured. Please run migration 010_create_logos_bucket.sql.' },
          { status: 500 }
        )
      }

      return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 })
    }

    // Get public URL with cache-busting timestamp
    const { data } = supabaseAdmin.storage.from('logos').getPublicUrl(filePath)
    const publicUrl = `${data.publicUrl}?v=${Date.now()}`

    // Update practitioners table with logo_url via RPC (bypasses schema cache)
    const { error: updateError } = await supabaseAdmin
      .rpc('update_practitioner_logo', {
        p_id: user.id,
        p_logo_url: publicUrl,
      })

    if (updateError) {
      console.error('practitioners update error:', updateError)
      // Try to clean up the uploaded file
      await supabaseAdmin.storage.from('logos').remove([filePath])
      return NextResponse.json({ error: 'Failed to save logo URL' }, { status: 500 })
    }

    return NextResponse.json({ success: true, logo_url: publicUrl })
  } catch (error) {
    console.error('upload-logo error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const authorization = req.headers.get('authorization')

    if (!authorization) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 })
    }

    // Extract token from Authorization header (Bearer <token>)
    const token = authorization.replace('Bearer ', '')

    // Verify JWT and get user identity
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current logo_url to know what to delete
    const { data: practitioner, error: fetchError } = await supabaseAdmin
      .from('practitioners')
      .select('logo_url')
      .eq('id', user.id)
      .single()

    if (fetchError) {
      console.error('practitioners fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch practitioner' }, { status: 500 })
    }

    if (practitioner?.logo_url) {
      // Extract file path from public URL
      // URL format: https://<project>.supabase.co/storage/v1/object/public/logos/{user_id}/logo.{ext}
      const urlParts = practitioner.logo_url.split('/logos/')
      if (urlParts.length === 2) {
        const filePath = urlParts[1]

        // Delete from storage
        const { error: deleteError } = await supabaseAdmin.storage
          .from('logos')
          .remove([filePath])

        if (deleteError) {
          console.error('Storage delete error:', deleteError)
          // Continue with DB update anyway
        }
      }
    }

    // Set logo_url to null in database via RPC (bypasses schema cache)
    const { error: updateError } = await supabaseAdmin
      .rpc('update_practitioner_logo', {
        p_id: user.id,
        p_logo_url: null,
      })

    if (updateError) {
      console.error('practitioners update error:', updateError)
      return NextResponse.json({ error: 'Failed to remove logo' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('delete-logo error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
