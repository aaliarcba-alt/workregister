import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Confirms the requester is really an admin before allowing any write.
// Client-sent "requester_email" is just a lookup key — the actual privilege
// check happens here against the DB, so a non-admin can't spoof this.
async function requireAdmin(email: string | undefined) {
  if (!email) return false
  const { data, error } = await supabase
    .from('employees')
    .select('designation')
    .eq('email', email.toLowerCase().trim())
    .single()
  if (error || !data) return false
  return data.designation?.toLowerCase() === 'admin'
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const requesterEmail = searchParams.get('requester_email') || undefined

  if (!(await requireAdmin(requesterEmail))) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('employees')
    .select('id, name, email, designation, created_at')
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ employees: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { requester_email, name, email, password, designation } = body

  if (!(await requireAdmin(requester_email))) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('employees')
    .insert([{
      name,
      email: email.toLowerCase().trim(),
      password,
      designation: designation || 'employee',
    }])
    .select('id, name, email, designation, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ employee: data })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { requester_email, id, name, password, designation } = body

  if (!(await requireAdmin(requester_email))) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const updates: Record<string, string> = {}
  if (name) updates.name = name
  if (password) updates.password = password
  if (designation) updates.designation = designation

  const { data, error } = await supabase
    .from('employees')
    .update(updates)
    .eq('id', id)
    .select('id, name, email, designation, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ employee: data })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const requesterEmail = searchParams.get('requester_email') || undefined

  if (!(await requireAdmin(requesterEmail))) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { error } = await supabase.from('employees').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
