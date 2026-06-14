import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { commentId, emoji } = await req.json()
  if (!commentId || !emoji) {
    return NextResponse.json({ error: 'Missing commentId or emoji' }, { status: 400 })
  }

  const admin = adminClient()

  // Toggle: try insert, if already exists then delete
  const { data: existing } = await admin
    .from('duel_reactions')
    .select('id')
    .eq('duel_id', id)
    .eq('user_id', user.id)
    .eq('comment_id', commentId)
    .eq('emoji', emoji)
    .single()

  if (existing) {
    await admin.from('duel_reactions').delete().eq('id', existing.id)
    return NextResponse.json({ removed: true })
  }

  const { error } = await admin.from('duel_reactions').insert({
    duel_id: id,
    user_id: user.id,
    comment_id: commentId,
    emoji,
  })

  if (error) return NextResponse.json({ error: 'Failed to react' }, { status: 500 })
  return NextResponse.json({ added: true })
}
