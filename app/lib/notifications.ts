import { supabaseAdmin } from './auth'

export async function createNotification(
  practitionerId: string,
  type: string,
  title: string,
  message: string,
  link?: string
) {
  await supabaseAdmin.from('notifications').insert({
    practitioner_id: practitionerId,
    type,
    title,
    message,
    link,
  })
}
