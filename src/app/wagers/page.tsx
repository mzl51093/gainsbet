import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import WagersClient from './WagersClient'
import { getWeekStart } from '@/lib/points'

export const revalidate = 0

export default async function WagersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: wagers } = await supabase
    .from('wagers')
    .select('*, profiles(display_name, username), wager_acceptances(*, profiles(display_name))')
    .order('created_at', { ascending: false })

  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('*')
    .order('display_name')

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <div className="bg-gray-900 px-4 pt-12 pb-6 border-b border-gray-800">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-white">Wagers 💰</h1>
          <p className="text-gray-400 text-sm mt-1">
            Make it interesting. Put something on the line.
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6">
        <WagersClient
          wagers={wagers || []}
          currentUserId={user.id}
          currentProfile={profile}
          allProfiles={allProfiles || []}
          weekStart={getWeekStart().toISOString()}
        />
      </div>

      <BottomNav />
    </div>
  )
}
