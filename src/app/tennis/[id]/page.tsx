import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import TennisClient from './TennisClient'

export const revalidate = 0

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function TennisChallengeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const admin = adminClient()

  const { data: challenge, error } = await admin
    .from('tennis_challenges')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !challenge) redirect('/tennis')

  const [
    { data: matches },
    { data: sessions },
    { data: comments },
    { data: participants },
  ] = await Promise.all([
    admin
      .from('tennis_matches')
      .select('*')
      .eq('challenge_id', id)
      .order('played_at', { ascending: false }),
    admin
      .from('tennis_sessions')
      .select('*')
      .eq('challenge_id', id)
      .order('session_date', { ascending: false }),
    admin
      .from('tennis_comments')
      .select('*, profiles!tennis_comments_user_id_fkey(id, display_name, username)')
      .eq('challenge_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    admin
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', challenge.participant_ids),
  ])

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <TennisClient
        challenge={challenge}
        matches={matches || []}
        sessions={sessions || []}
        comments={comments || []}
        participants={participants || []}
        currentUserId={user.id}
        challengeId={id}
      />
    </div>
  )
}
