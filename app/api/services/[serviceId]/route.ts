import { NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '../../../lib/auth'

/**
 * PUT /api/services/[serviceId]
 * Update a service by ID
 * Body can include: name, description, price_cents, is_active, sort_order
 */
export async function PUT(
  req: Request,
  { params }: { params: { serviceId: string } }
) {
  try {
    const { user, error } = await requireAuth(req)
    if (error) return error

    const { serviceId } = params
    const updates = await req.json()

    // Verify the service belongs to the practitioner
    const { data: existingService, error: fetchError } = await supabaseAdmin
      .from('services')
      .select('id, practitioner_id')
      .eq('id', serviceId)
      .single()

    if (fetchError || !existingService) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    if (existingService.practitioner_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Validate price_cents if provided
    if ('price_cents' in updates && updates.price_cents !== null) {
      if (typeof updates.price_cents !== 'number' || updates.price_cents < 0) {
        return NextResponse.json(
          { error: 'price_cents must be a non-negative number' },
          { status: 400 }
        )
      }
    }

    // Build update object with only provided fields
    const updateData: any = {}
    if ('name' in updates) updateData.name = updates.name
    if ('description' in updates) updateData.description = updates.description
    if ('price_cents' in updates) updateData.price_cents = updates.price_cents
    if ('is_active' in updates) updateData.is_active = updates.is_active
    if ('sort_order' in updates) updateData.sort_order = updates.sort_order

    updateData.updated_at = new Date().toISOString()

    // Update the service
    const { data: updatedService, error: updateError } = await supabaseAdmin
      .from('services')
      .update(updateData)
      .eq('id', serviceId)
      .select()
      .single()

    if (updateError) {
      console.error('services PUT update error:', updateError)
      return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
    }

    return NextResponse.json({ service: updatedService })
  } catch (error) {
    console.error('services PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/services/[serviceId]
 * Soft-delete a service by setting is_active = false
 */
export async function DELETE(
  req: Request,
  { params }: { params: { serviceId: string } }
) {
  try {
    const { user, error } = await requireAuth(req)
    if (error) return error

    const { serviceId } = params

    // Verify the service belongs to the practitioner
    const { data: existingService, error: fetchError } = await supabaseAdmin
      .from('services')
      .select('id, practitioner_id')
      .eq('id', serviceId)
      .single()

    if (fetchError || !existingService) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    if (existingService.practitioner_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Soft-delete by setting is_active = false
    const { error: deleteError } = await supabaseAdmin
      .from('services')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', serviceId)

    if (deleteError) {
      console.error('services DELETE error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('services DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
