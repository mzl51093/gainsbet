import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NotificationsClient from './NotificationsClient'

export const revalidate = 0

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <div className="bg-gray-900 px-4 pt-12 pb-4 border-b border-gray-800">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-white">Notifications</h1>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 pt-4">
        <NotificationsClient initialNotifications={notifications || []} currentUserId={user.id} />
      </div>
    </div>
  )
}
