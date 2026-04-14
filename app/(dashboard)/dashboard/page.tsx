import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySession } from '@/lib/auth/session'

export default async function DashboardIndexPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (!token) {
    redirect('/dashboard/login')
  }

  const payload = await verifySession(token)

  if (!payload) {
    redirect('/dashboard/login')
  }

  if (payload.app_role === 'super_admin') {
    redirect('/dashboard/admin')
  }

  if (payload.app_role === 'owner' || payload.app_role === 'manager') {
    redirect('/dashboard/owner')
  }

  redirect('/dashboard/not-authorized')
}
