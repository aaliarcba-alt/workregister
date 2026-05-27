import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  const year = searchParams.get('year') || new Date().getFullYear().toString()

  let query = supabase.from('work_entries').select('*')

  if (month && month !== 'all') {
    const monthNum = parseInt(month)
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`
    const endDate = new Date(parseInt(year), monthNum, 0).toISOString().split('T')[0]
    query = query.gte('date', startDate).lte('date', endDate)
  }

  const { data, error } = await query.order('date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data })
}
