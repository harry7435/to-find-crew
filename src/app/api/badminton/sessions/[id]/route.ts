import { createServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerClient();
    const { id: sessionId } = await params;

    // 세션 상세 정보 조회
    const { data: session, error: sessionError } = await supabase
      .from('badminton_sessions')
      .select(
        `
        *,
        creator:users!creator_id(
          id, 
          name, 
          email, 
          profile_image
        ),
        session_participants(
          id,
          joined_at,
          games_played,
          user:users(
            id, 
            name, 
            email, 
            profile_image, 
            gender, 
            skill_level
          )
        )
      `,
      )
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 팀 정보도 함께 조회 (있는 경우)
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select(
        `
        *,
        team_members(
          id,
          user:users(
            id, 
            name, 
            profile_image, 
            gender, 
            skill_level
          )
        )
      `,
      )
      .eq('session_id', sessionId)
      .order('team_number', { ascending: true });

    if (teamsError) {
      console.error('Teams fetch error:', teamsError);
      // 팀 정보는 선택사항이므로 에러가 나도 세션 정보는 반환
    }

    return NextResponse.json({
      session: {
        ...session,
        teams: teams || [],
      },
    });
  } catch (error) {
    console.error('Session fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id: sessionId } = await params;
    const updates = await request.json();

    // 세션 생성자 확인
    const { data: session, error: sessionError } = await supabase
      .from('badminton_sessions')
      .select('creator_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.creator_id !== user.id) {
      return NextResponse.json({ error: 'Only session creator can update' }, { status: 403 });
    }

    // 허용된 필드만 업데이트
    const allowedFields = ['name', 'venue_name', 'session_date', 'max_participants', 'court_count', 'status'];
    const filteredUpdates = Object.keys(updates)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj: Record<string, unknown>, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // 세션 업데이트
    const { data: updatedSession, error: updateError } = await supabase
      .from('badminton_sessions')
      .update(filteredUpdates)
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) {
      console.error('Session update error:', updateError);
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session: updatedSession,
    });
  } catch (error) {
    console.error('Session update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id: sessionId } = await params;

    // 세션 생성자 확인
    const { data: session, error: sessionError } = await supabase
      .from('badminton_sessions')
      .select('creator_id, status')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.creator_id !== user.id) {
      return NextResponse.json({ error: 'Only session creator can delete' }, { status: 403 });
    }

    // 진행 중인 세션은 삭제 불가
    if (session.status === 'in_progress') {
      return NextResponse.json({ error: 'Cannot delete session in progress' }, { status: 400 });
    }

    // 세션 삭제 (CASCADE로 관련 데이터 자동 삭제)
    const { error: deleteError } = await supabase.from('badminton_sessions').delete().eq('id', sessionId);

    if (deleteError) {
      console.error('Session delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Session delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
