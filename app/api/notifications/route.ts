import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '../../lib/auth'

export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth(request)
  if (error) return error

  const { data: notifications, error: notificationsError } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('practitioner_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (notificationsError) {
    return NextResponse.json({ error: notificationsError.message }, { status: 500 })
  }

  const { count, error: unreadError } = await supabaseAdmin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('practitioner_id', user!.id)
    .eq('is_read', false)

  if (unreadError) {
    return NextResponse.json({ error: unreadError.message }, { status: 500 })
  }

  return NextResponse.json({
    notifications: notifications || [],
    unread_count: count || 0,
  })
}

export async function PUT(request: NextRequest) {
  const { user, error } = await requireAuth(request)
  if (error) return error

  const body = await request.json()
  const { ids, all } = body

  if (all === true) {
    const { error: updateError } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('practitioner_id', user!.id)
      .eq('is_read', false)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  if (Array.isArray(ids) && ids.length > 0) {
    const { error: updateError } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .in('id', ids)
      .eq('practitioner_id', user!.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}
