import { createServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

const SESSION_STATUS = {
  COMPLETED: 'completed',
} as const;

const ERROR_MESSAGES = {
  SESSION_COMPLETED: 'Cannot leave a completed session',
  GUEST_NOT_FOUND: 'Guest participant not found',
} as const;

interface LeaveGuestRequest {
  session_id: string;
  guest_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const body: LeaveGuestRequest = await request.json();

    // 입력 검증
    if (!body.session_id || !body.guest_id) {
      return NextResponse.json({ error: 'Session ID and Guest ID are required' }, { status: 400 });
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

    // 세션 상태 확인 (완료된 세션은 취소 불가)
    if (session.status === SESSION_STATUS.COMPLETED) {
      return NextResponse.json({ error: ERROR_MESSAGES.SESSION_COMPLETED }, { status: 400 });
    }

    // 게스트 참가자인지 확인
    const { data: guest, error: guestError } = await supabase
      .from('guest_participants')
      .select('*')
      .eq('id', body.guest_id)
      .eq('session_id', body.session_id)
      .single();

    if (guestError || !guest) {
      return NextResponse.json({ error: ERROR_MESSAGES.GUEST_NOT_FOUND }, { status: 400 });
    }

    // 게스트 참가 취소
    const { error: deleteError } = await supabase.from('guest_participants').delete().eq('id', body.guest_id);

    if (deleteError) {
      console.error('Leave guest session error:', deleteError);
      return NextResponse.json({ error: 'Failed to leave session' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully left the session',
    });
  } catch (error) {
    console.error('Leave guest session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
