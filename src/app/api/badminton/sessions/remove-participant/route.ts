import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

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
    const { session_id, participant_id, participant_type } = body;

    if (!session_id || !participant_id || !participant_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 세션 정보 확인 (생성자인지 체크)
    const { data: session, error: sessionError } = await supabase
      .from('badminton_sessions')
      .select('creator_id')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 생성자만 참가자를 제거할 수 있음
    if (session.creator_id !== user.id) {
      return NextResponse.json({ error: 'Only the creator can remove participants' }, { status: 403 });
    }

    // 참가자 타입에 따라 다른 테이블에서 삭제
    if (participant_type === 'user') {
      const { error: deleteError } = await supabase.from('session_participants').delete().eq('id', participant_id);

      if (deleteError) {
        throw deleteError;
      }
    } else if (participant_type === 'guest') {
      const { error: deleteError } = await supabase.from('guest_participants').delete().eq('id', participant_id);

      if (deleteError) {
        throw deleteError;
      }
    } else {
      return NextResponse.json({ error: 'Invalid participant type' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Participant removed successfully',
    });
  } catch (error) {
    console.error('Remove participant error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove participant' },
      { status: 500 },
    );
  }
}
