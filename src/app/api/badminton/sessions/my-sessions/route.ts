import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await createServerClient();

    // 요청한 사용자 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // 사용자가 생성한 세션 목록 조회
    const { data: sessions, error: sessionsError } = await supabase
      .from('badminton_sessions')
      .select(
        `
        *,
        creator:users!creator_id(id, name, email),
        session_participants(id),
        guest_participants(id)
      `,
      )
      .eq('creator_id', user.id)
      .order('session_date', { ascending: false });

    if (sessionsError) {
      throw sessionsError;
    }

    // 참가자 수 계산
    const sessionsWithCounts = sessions.map((session) => ({
      ...session,
      participant_count: (session.session_participants?.length || 0) + (session.guest_participants?.length || 0),
    }));

    return NextResponse.json({
      sessions: sessionsWithCounts,
    });
  } catch (error) {
    console.error('My sessions fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch sessions' },
      { status: 500 },
    );
  }
}
