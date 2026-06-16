import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/push'
import { saveNotification } from '@/lib/notifications-db'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getWeekMonday(): string {
  const today = new Date()
  const dow = today.getDay() // 0=Sun
  const daysBack = dow === 0 ? 6 : dow - 1
  const monday = new Date(today)
  monday.setDate(today.getDate() - daysBack)
  return monday.toISOString().split('T')[0]
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()

  const { data: duel } = await admin
    .from('duel_challenges')
    .select('competitor_a_id, competitor_b_id, watcher_ids, name, status')
    .eq('id', id)
    .single()

  if (!duel) return NextResponse.json({ error: 'Duel not found' }, { status: 404 })
  if (duel.status !== 'active') return NextResponse.json({ error: 'Duel is not active' }, { status: 400 })

  const isCompetitor = user.id === duel.competitor_a_id || user.id === duel.competitor_b_id
  if (!isCompetitor) return NextResponse.json({ error: 'Only competitors can submit body check-ins' }, { status: 403 })

  const formData = await req.formData()
  const frontFile = formData.get('front') as File | null
  const sideFile = formData.get('side') as File | null
  const notes = formData.get('notes') as string | null

  if (!frontFile || !sideFile) {
    return NextResponse.json({ error: 'Both front and side photos are required' }, { status: 400 })
  }

  const weekKey = getWeekMonday()

  async function uploadPhoto(file: File, label: string): Promise<string | null> {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `body/${user!.id}/${id}/${weekKey}-${label}.${ext}`
    const buf = await file.arrayBuffer()
    const { error } = await admin.storage
      .from('duel-proofs')
      .upload(path, buf, { contentType: file.type, upsert: true })
    return error ? null : path
  }

  const [frontUrl, sideUrl] = await Promise.all([
    uploadPhoto(frontFile, 'front'),
    uploadPhoto(sideFile, 'side'),
  ])

  if (!frontUrl || !sideUrl) {
    return NextResponse.json({ error: 'Photo upload failed' }, { status: 500 })
  }

  const { data: record, error } = await admin
    .from('duel_weekly_photos')
    .upsert({
      duel_id: id,
      user_id: user.id,
      check_in_week: weekKey,
      front_photo_url: frontUrl,
      side_photo_url: sideUrl,
      notes: notes?.trim() || null,
    }, { onConflict: 'duel_id,user_id,check_in_week' })
    .select()
    .single()

  if (error || !record) {
    return NextResponse.json({ error: error?.message || 'Failed to save' }, { status: 500 })
  }

  // Notify all participants
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const name = profile?.display_name?.split(' ')[0] || 'Someone'
  const allParticipants = [duel.competitor_a_id, duel.competitor_b_id, ...(duel.watcher_ids || [])]

  await Promise.all(allParticipants
    .filter((pid: string) => pid !== user.id)
    .map(async (pid: string) => {
      const notif = {
        type: 'duel_body_checkin',
        title: `📸 ${name} submitted weekly body check-in`,
        body: `Front + side photos logged for week of ${weekKey}. Check it out.`,
        url: `/duel/${id}`,
      }
      await Promise.all([
        sendPushToUser(pid, notif).catch(() => null),
        saveNotification(pid, notif),
      ])
    })
  )

  return NextResponse.json({ id: record.id, week: weekKey })
}
