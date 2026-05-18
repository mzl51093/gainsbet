import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'

export const revalidate = 0

export default async function DraftListPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Get all competitions where user is a participant
  const { data: myParticipations } = await supabase
    .from('draft_participants')
    .select('competition_id')
    .eq('user_id', user.id)

  const competitionIds = myParticipations?.map((p) => p.competition_id) || []

  let competitions: any[] = []
  if (competitionIds.length > 0) {
    const { data } = await supabase
      .from('draft_competitions')
      .select('id, name, status, point_goal, max_participants, created_at')
      .in('id', competitionIds)
      .order('created_at', { ascending: false })
    competitions = data || []
  }

  // Also get competitions created by user (may not be a participant yet in edge cases)
  const { data: createdComps } = await supabase
    .from('draft_competitions')
    .select('id, name, status, point_goal, max_participants, created_at')
    .eq('created_by', user.id)
    .not('id', 'in', competitionIds.length > 0 ? `(${competitionIds.join(',')})` : '(null)')
    .order('created_at', { ascending: false })

  const allComps = [
    ...competitions,
    ...(createdComps || []),
  ].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const statusLabel: Record<string, string> = {
    recruiting: 'Recruiting',
    voting: 'Voting',
    drafting: 'Drafting',
    configuring: 'Configuring',
    active: 'Active',
    completed: 'Completed',
  }

  const statusColor: Record<string, string> = {
    recruiting: 'bg-blue-900/40 text-blue-400',
    voting: 'bg-purple-900/40 text-purple-400',
    drafting: 'bg-yellow-900/40 text-yellow-400',
    configuring: 'bg-orange-900/40 text-orange-400',
    active: 'bg-green-900/40 text-green-400',
    completed: 'bg-gray-800 text-gray-500',
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Header */}
      <div className="bg-gray-900 px-4 pt-12 pb-5 border-b border-gray-800">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Team Draft</h1>
            <p className="text-gray-400 text-sm mt-0.5">Draft teams, race to the goal</p>
          </div>
          <Link
            href="/draft/new"
            className="bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            + New
          </Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-3">
        {allComps.length === 0 ? (
          <div className="bg-gray-900 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">🏆</div>
            <h2 className="text-white font-semibold text-lg mb-2">No competitions yet</h2>
            <p className="text-gray-500 text-sm mb-5">
              Create a draft competition and challenge your friends. Two teams, one goal, everyone
              must contribute.
            </p>
            <Link
              href="/draft/new"
              className="inline-block bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              Create Draft Competition
            </Link>
          </div>
        ) : (
          allComps.map((comp) => (
            <Link
              key={comp.id}
              href={`/draft/${comp.id}`}
              className="block bg-gray-900 rounded-2xl p-4 hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold truncate">{comp.name}</h3>
                  <p className="text-gray-500 text-xs mt-0.5">Goal: {comp.point_goal} pts</p>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ml-3 ${
                    statusColor[comp.status] || 'bg-gray-800 text-gray-500'
                  }`}
                >
                  {statusLabel[comp.status] || comp.status}
                </span>
              </div>
            </Link>
          ))
        )}

        <div className="pt-2">
          <Link
            href="/draft/new"
            className="block w-full text-center bg-gray-900 hover:bg-gray-800 border border-gray-700 text-green-400 font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            + Create New Competition
          </Link>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
