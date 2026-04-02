import { NextResponse } from 'next/server'

/**
 * Standardized API error response helper.
 * Returns consistent error format with optional error code.
 */
export function errorResponse(
  message: string,
  status: number,
  code?: string
): NextResponse {
  const body: Record<string, any> = { error: message }
  if (code) {
    body.code = code
  }
  return NextResponse.json(body, { status })
}
