import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export { supabaseAdmin }

/**
 * Verify the Authorization header and return the authenticated user.
 * Returns { user, error } — if error is set, return it directly as the response.
 */
export async function requireAuth(req: Request) {
  const authorization = req.headers.get('authorization')
  if (!authorization) {
    return {
      user: null,
      error: NextResponse.json({ error: 'No authorization header' }, { status: 401 }),
    }
  }

  const token = authorization.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

  if (authError || !user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { user, error: null }
}
