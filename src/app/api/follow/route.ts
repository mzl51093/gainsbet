import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, id } = await req.json()
  if (!type || !id) return NextResponse.json({ error: 'Missing type or id' }, { status: 400 })

  if (type === 'wager') {
    const { data: existing } = await supabase
      .from('wager_followers')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('wager_id', id)
      .maybeSingle()

    if (existing) {
      await supabase.from('wager_followers').delete().eq('user_id', user.id).eq('wager_id', id)
      return NextResponse.json({ following: false })
    } else {
      await supabase.from('wager_followers').insert({ user_id: user.id, wager_id: id })
      return NextResponse.json({ following: true })
    }
  }

  if (type === 'draft') {
    const { data: existing } = await supabase
      .from('draft_followers')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('competition_id', id)
      .maybeSingle()

    if (existing) {
      await supabase.from('draft_followers').delete().eq('user_id', user.id).eq('competition_id', id)
      return NextResponse.json({ following: false })
    } else {
      await supabase.from('draft_followers').insert({ user_id: user.id, competition_id: id })
      return NextResponse.json({ following: true })
    }
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
