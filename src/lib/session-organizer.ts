import { createServerClient } from '@/lib/supabase-server';
import { reportError } from '@/lib/monitoring';

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

/**
 * 세션 생성자이거나 session_organizers에 등록된 운영진인지 확인한다.
 * 호출부에서 이미 creator_id를 조회했다는 전제로 creatorId를 인자로 받아
 * 세션 존재 여부 재조회를 피한다.
 */
export async function isSessionOrganizer(
  supabase: ServerSupabaseClient,
  sessionId: string,
  userId: string,
  creatorId: string,
): Promise<boolean> {
  if (creatorId === userId) {
    return true;
  }

  const { data, error } = await supabase
    .from('session_organizers')
    .select('id')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('isSessionOrganizer check error:', error);
    // 호출부는 false만 받아 403으로 응답하므로 여기서만 보고한다.
    reportError('[api] 운영진 여부 확인에 실패했습니다', error, { sessionId });
    return false;
  }

  return !!data;
}
