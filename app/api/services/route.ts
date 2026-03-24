import { NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '../../lib/auth'

/**
 * GET /api/services
 * Fetch all services for the authenticated practitioner, ordered by sort_order
 */
export async function GET(req: Request) {
  try {
    const { user, error } = await requireAuth(req)
    if (error) return error

    const { data: services, error: fetchError } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('practitioner_id', user.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
    }

    return NextResponse.json({ services })
  } catch (error) {
    console.error('services GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/services
 * Create a new service for the authenticated practitioner
 * Body: { name, description?, price_cents, sort_order? }
 */
export async function POST(req: Request) {
  try {
    const { user, error } = await requireAuth(req)
    if (error) return error

    const { name, description, price_cents, sort_order } = await req.json()

    // Validate required fields
    if (!name || typeof price_cents !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: name, price_cents' },
        { status: 400 }
      )
    }

    // Validate price is non-negative
    if (price_cents < 0) {
      return NextResponse.json(
        { error: 'price_cents must be non-negative' },
        { status: 400 }
      )
    }

    // Get next sort_order if not provided
    let finalSortOrder = sort_order
    if (finalSortOrder === undefined) {
      const { data: lastService } = await supabaseAdmin
        .from('services')
        .select('sort_order')
        .eq('practitioner_id', user.id)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single()

      finalSortOrder = lastService ? lastService.sort_order + 1 : 0
    }

    // Create the service
    const { data: newService, error: insertError } = await supabaseAdmin
      .from('services')
      .insert({
        practitioner_id: user.id,
        name,
        description: description || null,
        price_cents,
        sort_order: finalSortOrder,
        is_active: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('services POST insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create service' }, { status: 500 })
    }

    return NextResponse.json({ service: newService }, { status: 201 })
  } catch (error) {
    console.error('services POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
