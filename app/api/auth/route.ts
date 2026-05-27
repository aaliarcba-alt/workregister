import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 })
  }

  if (data.password !== password) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  return NextResponse.json({
    user: {
      id: data.id,
      name: data.name,
      email: data.email,
      designation: data.designation,
      isManager: data.designation?.toLowerCase() === 'cdo',
    }
  })
}
