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

    // 내가 운영진으로 지정된 세션 id 목록 (생성자 본인 세션은 여기 들어있지 않음)
    const { data: organizerRows, error: organizerError } = await supabase
      .from('session_organizers')
      .select('session_id')
      .eq('user_id', user.id);

    if (organizerError) {
      throw organizerError;
    }

    const organizerSessionIds = (organizerRows ?? []).map((row) => row.session_id);

    // 내가 일반 참가자로 참여한 세션 id 목록 (생성자/운영진 본인 세션은 여기 들어있지 않음)
    const { data: participantRows, error: participantError } = await supabase
      .from('session_participants')
      .select('session_id')
      .eq('user_id', user.id);

    if (participantError) {
      throw participantError;
    }

    const participantSessionIds = (participantRows ?? []).map((row) => row.session_id);
    const nonCreatorSessionIds = Array.from(new Set([...organizerSessionIds, ...participantSessionIds]));

    // 내가 생성했거나, 운영진 또는 참가자로 참여 중인 세션 목록 조회
    let sessionsQuery = supabase
      .from('badminton_sessions')
      .select(
        `
        *,
        creator:users!creator_id(id, name, email),
        session_participants(id),
        guest_participants(id)
      `,
      )
      .order('session_date', { ascending: false });

    sessionsQuery =
      nonCreatorSessionIds.length > 0
        ? sessionsQuery.or(`creator_id.eq.${user.id},id.in.(${nonCreatorSessionIds.join(',')})`)
        : sessionsQuery.eq('creator_id', user.id);

    const { data: sessions, error: sessionsError } = await sessionsQuery;

    if (sessionsError) {
      throw sessionsError;
    }

    // 참가자 수 계산 + 내 역할(생성자/운영진/참가자) 표시
    const sessionsWithCounts = sessions.map((session) => ({
      ...session,
      participant_count: (session.session_participants?.length || 0) + (session.guest_participants?.length || 0),
      role:
        session.creator_id === user.id
          ? 'creator'
          : organizerSessionIds.includes(session.id)
            ? 'organizer'
            : 'participant',
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
