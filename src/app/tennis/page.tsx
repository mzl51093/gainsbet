import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const revalidate = 0

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function TennisListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const admin = adminClient()

  const { data: challenges } = await admin
    .from('tennis_challenges')
    .select('*')
    .contains('participant_ids', [user.id])
    .order('created_at', { ascending: false })

  const allParticipantIds = [...new Set((challenges || []).flatMap((c: any) => c.participant_ids))]
  const { data: profiles } = allParticipantIds.length > 0
    ? await admin.from('profiles').select('id, display_name').in('id', allParticipantIds)
    : { data: [] }

  const profileMap: Record<string, string> = {}
  for (const p of profiles || []) profileMap[p.id] = p.display_name

  const active = (challenges || []).filter((c: any) => c.status === 'active')
  const completed = (challenges || []).filter((c: any) => c.status !== 'active')

  function ChallengeCard({ c }: { c: any }) {
    const others = (c.participant_ids as string[]).filter((id: string) => id !== user!.id)
    const names = others.map((id: string) => profileMap[id]?.split(' ')[0] || '?').join(', ')
    return (
      <Link href={`/tennis/${c.id}`}>
        <div className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 transition-colors">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-white font-semibold text-sm leading-tight">{c.name}</h3>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${
              c.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-gray-800 text-gray-400'
            }`}>
              {c.status === 'active' ? 'Active' : 'Done'}
            </span>
          </div>
          <p className="text-gray-400 text-xs mb-1">vs {names}</p>
          {c.wager && <p className="text-gray-500 text-xs truncate">💸 {c.wager}</p>}
          {c.description && <p className="text-gray-600 text-xs mt-1 truncate">{c.description}</p>}
        </div>
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <div className="bg-gray-900 px-4 pt-12 pb-5 border-b border-gray-800">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">🎾 Tennis</h1>
            <p className="text-gray-400 text-sm">Track matches, practice & trash talk</p>
          </div>
          <Link
            href="/tennis/new"
            className="bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            + New
          </Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {active.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-white font-semibold text-sm px-1">🔥 Active</h2>
            {active.map((c: any) => <ChallengeCard key={c.id} c={c} />)}
          </div>
        )}
        {completed.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-gray-500 font-semibold text-sm px-1">Completed</h2>
            {completed.map((c: any) => <ChallengeCard key={c.id} c={c} />)}
          </div>
        )}
        {(challenges || []).length === 0 && (
          <div className="bg-gray-900 rounded-2xl p-10 text-center border border-gray-800">
            <p className="text-5xl mb-3">🎾</p>
            <p className="text-white font-semibold mb-1">No challenges yet</p>
            <p className="text-gray-500 text-sm mb-5">
              Start a tennis challenge to track matches, practice, and talk trash.
            </p>
            <Link
              href="/tennis/new"
              className="inline-block bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-3 rounded-xl text-sm transition-colors"
            >
              Start a Challenge →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
