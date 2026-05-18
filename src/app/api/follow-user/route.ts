import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  if (userId === user.id) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })

  const { data: existing } = await supabase
    .from('user_follows')
    .select('follower_id')
    .eq('follower_id', user.id)
    .eq('following_id', userId)
    .maybeSingle()

  if (existing) {
    await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', userId)
    return NextResponse.json({ following: false })
  } else {
    await supabase.from('user_follows').insert({ follower_id: user.id, following_id: userId })
    return NextResponse.json({ following: true })
  }
}
