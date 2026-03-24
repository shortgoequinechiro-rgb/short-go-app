import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '../../lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request)
    if (error) return error

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const ownerId = searchParams.get('owner_id')
    const channel = searchParams.get('channel') || 'all'
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // Build query
    let query = supabaseAdmin
      .from('communication_log')
      .select(
        `
        id,
        channel,
        message_type,
        recipient,
        subject,
        body_preview,
        status,
        created_at,
        owner_id,
        owners (
          full_name
        )
      `
      )
      .eq('practitioner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Apply channel filter
    if (channel !== 'all') {
      query = query.eq('channel', channel)
    }

    // Apply owner filter
    if (ownerId) {
      query = query.eq('owner_id', ownerId)
    }

    const { data, error: queryError } = await query

    if (queryError) {
      console.error('Query error:', queryError)
      return NextResponse.json({ error: 'Failed to fetch communications' }, { status: 500 })
    }

    // Flatten the owner data
    const flattenedData = (data || []).map((log: any) => ({
      ...log,
      owner_name: log.owners?.full_name || 'Unknown Owner',
    }))

    return NextResponse.json(flattenedData)
  } catch (error) {
    console.error('Communications route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
