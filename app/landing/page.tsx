import { redirect } from 'next/navigation'

// The landing page now lives at the root (/). Redirect any old /landing links.
export default function LandingRedirect() {
  redirect('/')
}
