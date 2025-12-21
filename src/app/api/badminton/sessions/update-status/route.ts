import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

type SessionStatus = 'open' | 'in_progress' | 'completed';

const VALID_STATUSES: SessionStatus[] = ['open', 'in_progress', 'completed'];

const ERROR_MESSAGES = {
  INVALID_STATUS: 'Invalid status value',
  NOT_CREATOR: 'Only the creator can update session status',
} as const;

const isValidStatus = (status: string): status is SessionStatus => {
  return VALID_STATUSES.includes(status as SessionStatus);
};

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { session_id, status } = body;

    if (!session_id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 유효한 상태값 체크
    if (!isValidStatus(status)) {
      return NextResponse.json({ error: ERROR_MESSAGES.INVALID_STATUS }, { status: 400 });
    }

    // 세션 정보 확인 (생성자인지 체크)
    const { data: session, error: sessionError } = await supabase
      .from('badminton_sessions')
      .select('creator_id, status')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 생성자만 상태를 변경할 수 있음
    if (session.creator_id !== user.id) {
      return NextResponse.json({ error: ERROR_MESSAGES.NOT_CREATOR }, { status: 403 });
    }

    // 세션 상태 업데이트
    const { error: updateError } = await supabase
      .from('badminton_sessions')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session_id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: 'Session status updated successfully',
      status,
    });
  } catch (error) {
    console.error('Update status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update status' },
      { status: 500 },
    );
  }
}
