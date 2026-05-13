import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import ProfileClient from './ProfileClient'
import { WORKOUT_TYPES, getWeekStart, getWeekEnd, WEEKLY_GOAL } from '@/lib/points'

export const revalidate = 0

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  // All-time stats
  const { data: allWorkouts } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', user.id)
    .order('logged_at', { ascending: false })

  const weekStart = getWeekStart()
  const weekEnd = getWeekEnd()

  const weekWorkouts = (allWorkouts || []).filter(w => {
    const d = new Date(w.logged_at)
    return d >= weekStart && d <= weekEnd
  })

  const totalPoints = (allWorkouts || []).reduce((sum: number, w: any) => sum + w.points, 0)
  const weekPoints = weekWorkouts.reduce((sum: number, w: any) => sum + w.points, 0)
  const totalWorkouts = (allWorkouts || []).length
  const withProof = (allWorkouts || []).filter((w: any) => w.proof_url).length

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <div className="bg-gray-900 px-4 pt-12 pb-6 border-b border-gray-800">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-white">Profile</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6">
        <ProfileClient
          profile={profile}
          stats={{ totalPoints, weekPoints, totalWorkouts, withProof, weekGoal: WEEKLY_GOAL }}
          recentWorkouts={allWorkouts?.slice(0, 20) || []}
          workoutTypes={WORKOUT_TYPES}
        />
      </div>

      <BottomNav />
    </div>
  )
}
