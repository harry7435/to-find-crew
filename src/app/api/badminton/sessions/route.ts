import { createServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

interface CreateSessionRequest {
  name: string;
  venue_name: string;
  session_date: string;
  max_participants: number;
  court_count: number;
}

function generateAccessCode(): string {
  // 4자리 숫자와 문자 조합으로 접근 코드 생성
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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
      console.log('Authentication failed:', { authError, hasUser: !!user });
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body: CreateSessionRequest = await request.json();

    // 입력 검증
    if (!body.name || !body.venue_name || !body.session_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 유니크한 접근 코드 생성 (중복 체크)
    let accessCode: string;
    let isUnique = false;
    let attempts = 0;

    do {
      accessCode = generateAccessCode();
      const { data: existingSession } = await supabase
        .from('badminton_sessions')
        .select('id')
        .eq('access_code', accessCode)
        .single();

      isUnique = !existingSession;
      attempts++;
    } while (!isUnique && attempts < 10);

    if (!isUnique) {
      return NextResponse.json({ error: 'Unable to generate unique access code' }, { status: 500 });
    }

    // 세션 생성
    const { data: session, error: sessionError } = await supabase
      .from('badminton_sessions')
      .insert([
        {
          name: body.name,
          venue_name: body.venue_name,
          session_date: body.session_date,
          max_participants: body.max_participants || 20,
          access_code: accessCode,
          creator_id: user.id,
          court_count: body.court_count || 1,
          status: 'open',
        },
      ])
      .select()
      .single();

    if (sessionError) {
      console.error('Session creation error:', sessionError);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    // 생성자를 자동으로 참가자로 추가
    const { error: participantError } = await supabase.from('session_participants').insert([
      {
        session_id: session.id,
        user_id: user.id,
      },
    ]);

    if (participantError) {
      console.error('Auto-join error:', participantError);
      // 세션은 생성되었지만 자동 참가 실패 - 경고만 표시
    }

    return NextResponse.json({
      success: true,
      session: {
        ...session,
        access_code: accessCode,
      },
    });
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get('creator_id');

    let query = supabase
      .from('badminton_sessions')
      .select(
        `
        *,
        creator:users!creator_id(id, name, email),
        session_participants(
          id,
          user:users(id, name, email, gender, skill_level)
        )
      `,
      )
      .order('created_at', { ascending: false });

    // 특정 사용자가 생성한 세션만 조회
    if (creatorId) {
      query = query.eq('creator_id', creatorId);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Sessions fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Sessions fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
