import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { isSessionOrganizer } from '@/lib/session-organizer';

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

    // 생성자 또는 운영진만 참가자를 제거할 수 있음
    const isOrganizer = await isSessionOrganizer(supabase, session_id, user.id, session.creator_id);
    if (!isOrganizer) {
      return NextResponse.json({ error: 'Only session organizers can remove participants' }, { status: 403 });
    }

    // 참가자 타입에 따라 다른 테이블에서 삭제
    if (participant_type === 'user') {
      const { data: deletedParticipant, error: deleteError } = await supabase
        .from('session_participants')
        .delete()
        .eq('id', participant_id)
        .select('user_id')
        .single();

      if (deleteError) {
        throw deleteError;
      }

      // 강퇴된 사람이 운영진이었다면 "유령 운영진"으로 남지 않도록 자격도 함께 정리한다
      if (deletedParticipant) {
        const { error: organizerCleanupError } = await supabase
          .from('session_organizers')
          .delete()
          .eq('session_id', session_id)
          .eq('user_id', deletedParticipant.user_id);

        if (organizerCleanupError) {
          console.error('Organizer cleanup on remove-participant error:', organizerCleanupError);
        }
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
