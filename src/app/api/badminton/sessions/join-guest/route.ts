import { createServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

interface GuestJoinSessionRequest {
  access_code: string;
  name: string;
  gender: 'male' | 'female';
  skill_level: number;
  age_group: '10s' | '20s' | '30s' | '40s' | '50s' | '60s';
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body: GuestJoinSessionRequest = await request.json();

    // 입력 검증
    if (!body.access_code || !body.name || !body.gender || body.skill_level === undefined || !body.age_group) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 세션 조회
    const { data: session, error: sessionError } = await supabase
      .from('badminton_sessions')
      .select(
        `
        *,
        session_participants(id, user_id),
        guest_participants(id)
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

    // 최대 참가자 수 확인
    const totalParticipants = session.session_participants.length + session.guest_participants.length;
    if (totalParticipants >= session.max_participants) {
      return NextResponse.json({ error: 'Session is full' }, { status: 400 });
    }

    // 게스트 참가자 추가
    const { data: guestParticipant, error: joinError } = await supabase
      .from('guest_participants')
      .insert([
        {
          session_id: session.id,
          name: body.name,
          gender: body.gender,
          skill_level: body.skill_level,
          age_group: body.age_group,
        },
      ])
      .select()
      .single();

    if (joinError) {
      console.error('Guest join error:', joinError);
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
      participant: guestParticipant,
    });
  } catch (error) {
    console.error('Guest join session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
