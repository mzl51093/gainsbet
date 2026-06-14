import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTodayEastern } from '@/lib/timezone'

export const revalidate = 0

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function DuelListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const admin = adminClient()
  const today = getTodayEastern()

  // All duels the user is involved in
  const { data: allDuels } = await admin
    .from('duel_challenges')
    .select('*, profileA:profiles!duel_challenges_competitor_a_id_fkey(display_name, username), profileB:profiles!duel_challenges_competitor_b_id_fkey(display_name, username)')
    .or(`competitor_a_id.eq.${user.id},competitor_b_id.eq.${user.id},watcher_ids.cs.{${user.id}}`)
    .order('created_at', { ascending: false })

  const active = (allDuels || []).filter((d: any) => d.status === 'active')
  const completed = (allDuels || []).filter((d: any) => d.status !== 'active')

  function DuelCard({ duel }: { duel: any }) {
    const isCompetitor = user!.id === duel.competitor_a_id || user!.id === duel.competitor_b_id
    const daysLeft = duel.end_date
      ? Math.max(0, Math.ceil((new Date(duel.end_date).getTime() - new Date(today).getTime()) / 86400000))
      : null
    const isEnded = duel.status !== 'active' || (daysLeft !== null && daysLeft <= 0)

    return (
      <Link href={`/duel/${duel.id}`}>
        <div className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 transition-colors">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-white font-semibold text-sm leading-tight">{duel.name}</h3>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${
              duel.status === 'completed'
                ? 'bg-gray-800 text-gray-400'
                : daysLeft !== null && daysLeft <= 2
                  ? 'bg-red-900/50 text-red-400'
                  : 'bg-green-900/30 text-green-400'
            }`}>
              {duel.status === 'completed' ? 'Done' : daysLeft !== null ? `${daysLeft}d left` : 'Active'}
            </span>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-gray-300 text-sm font-medium">
              {duel.profileA?.display_name?.split(' ')[0]}
            </span>
            <span className="text-gray-600 text-xs">⚔️</span>
            <span className="text-gray-300 text-sm font-medium">
              {duel.profileB?.display_name?.split(' ')[0]}
            </span>
            {!isCompetitor && (
              <span className="text-gray-600 text-xs ml-1">· watcher</span>
            )}
          </div>

          {duel.wager && (
            <p className="text-gray-500 text-xs truncate">💸 {duel.wager}</p>
          )}
        </div>
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <div className="bg-gray-900 px-4 pt-12 pb-5 border-b border-gray-800">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">⚔️ Duels</h1>
            <p className="text-gray-400 text-sm">Head-to-head challenges</p>
          </div>
          <Link
            href="/duel/new"
            className="bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            + New Duel
          </Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {active.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-white font-semibold text-sm px-1">🔥 Active</h2>
            {active.map((duel: any) => <DuelCard key={duel.id} duel={duel} />)}
          </div>
        )}

        {completed.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-gray-500 font-semibold text-sm px-1">Past Duels</h2>
            {completed.map((duel: any) => <DuelCard key={duel.id} duel={duel} />)}
          </div>
        )}

        {allDuels?.length === 0 && (
          <div className="bg-gray-900 rounded-2xl p-10 text-center border border-gray-800">
            <p className="text-4xl mb-3">⚔️</p>
            <p className="text-white font-semibold mb-1">No duels yet</p>
            <p className="text-gray-500 text-sm mb-5">
              Challenge someone to a head-to-head competition.
            </p>
            <Link
              href="/duel/new"
              className="inline-block bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              Start a Duel →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
