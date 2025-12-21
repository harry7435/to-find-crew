import { createServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

const SESSION_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;

const ERROR_MESSAGES = {
  SESSION_COMPLETED: 'Cannot leave a completed session',
  CREATOR_CANNOT_LEAVE: 'Creator cannot leave the session',
  NOT_PARTICIPANT: 'You are not a participant of this session',
} as const;

interface LeaveSessionRequest {
  session_id: string;
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

    const body: LeaveSessionRequest = await request.json();

    // 입력 검증
    if (!body.session_id) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // 세션 조회
    const { data: session, error: sessionError } = await supabase
      .from('badminton_sessions')
      .select('*')
      .eq('id', body.session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 생성자는 참가 취소 불가
    if (session.creator_id === user.id) {
      return NextResponse.json({ error: ERROR_MESSAGES.CREATOR_CANNOT_LEAVE }, { status: 400 });
    }

    // 세션 상태 확인 (완료된 세션은 취소 불가)
    if (session.status === SESSION_STATUS.COMPLETED) {
      return NextResponse.json({ error: ERROR_MESSAGES.SESSION_COMPLETED }, { status: 400 });
    }

    // 참가자인지 확인
    const { data: participant, error: participantError } = await supabase
      .from('session_participants')
      .select('*')
      .eq('session_id', body.session_id)
      .eq('user_id', user.id)
      .single();

    if (participantError || !participant) {
      return NextResponse.json({ error: ERROR_MESSAGES.NOT_PARTICIPANT }, { status: 400 });
    }

    // 참가 취소
    const { error: deleteError } = await supabase
      .from('session_participants')
      .delete()
      .eq('session_id', body.session_id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Leave session error:', deleteError);
      return NextResponse.json({ error: 'Failed to leave session' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully left the session',
    });
  } catch (error) {
    console.error('Leave session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
