import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET(req) {
  return NextResponse.json({
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_KEY
  })
}
