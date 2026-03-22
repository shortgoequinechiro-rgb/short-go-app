import { supabase } from './supabase'

type AuditAction = 'view' | 'create' | 'update' | 'delete' | 'generate' | 'export' | 'generate_portal_token' | 'complete' | 'scan' | 'send'
type ResourceType = 'human_patient' | 'human_visit' | 'human_appointment' | 'human_intake_form' | 'soap_note' | 'patient_portal' | 'portal_access_tokens' | 'care_plan' | 'care_plan_visit' | 'superbill' | 'booking_settings' | 'compliance_scan' | 'soap_template' | 'recall_message' | 'review_request'

export async function logAudit(params: {
  action: AuditAction
  resourceType: ResourceType
  resourceId?: string
  details?: Record<string, unknown>
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('audit_log').insert({
      practitioner_id: user.id,
      user_type: 'practitioner',
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId || null,
      details: params.details || null,
    })
  } catch (err) {
    // Don't block the UI if audit logging fails
    console.error('Audit log error:', err)
  }
}
