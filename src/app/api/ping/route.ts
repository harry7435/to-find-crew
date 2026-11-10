import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { reportError } from '@/lib/monitoring';

export const runtime = 'edge';

export async function GET() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const { error } = await supabase.from('users').select('id').limit(1);

  if (error) {
    reportError('[api] GET /api/ping: supabase ping failed', error, { route: '/api/ping' });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}
