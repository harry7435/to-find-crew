import { createServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

interface JoinSessionRequest {
  access_code: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // 사용자 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body: JoinSessionRequest = await request.json();

    // 입력 검증
    if (!body.access_code) {
      return NextResponse.json({ error: 'Access code is required' }, { status: 400 });
    }

    // 세션 조회
    const { data: session, error: sessionError } = await supabase
      .from('badminton_sessions')
      .select(
        `
        *,
        session_participants(id, user_id)
      `,
      )
      .eq('access_code', body.access_code.toUpperCase())
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 404 });
    }

    // 세션 상태 확인
    if (session.status === 'completed') {
      return NextResponse.json({ error: 'Session has ended' }, { status: 400 });
    }

    // 이미 참가했는지 확인
    const isAlreadyParticipant = session.session_participants.some(
      (participant: { user_id: string }) => participant.user_id === user.id,
    );

    if (isAlreadyParticipant) {
      // 이미 가입한 경우 해당 세션 정보 반환
      return NextResponse.json({
        success: true,
        already_joined: true,
        session: {
          id: session.id,
          name: session.name,
          venue_name: session.venue_name,
          session_date: session.session_date,
        },
      });
    }

    // 최대 참가자 수 확인
    if (session.session_participants.length >= session.max_participants) {
      return NextResponse.json({ error: 'Session is full' }, { status: 400 });
    }

    // 세션 참가
    const { error: joinError } = await supabase.from('session_participants').insert([
      {
        session_id: session.id,
        user_id: user.id,
      },
    ]);

    if (joinError) {
      console.error('Join session error:', joinError);
      return NextResponse.json({ error: 'Failed to join session' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        name: session.name,
        venue_name: session.venue_name,
        session_date: session.session_date,
      },
    });
  } catch (error) {
    console.error('Join session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
