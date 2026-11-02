import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createServerClient } from '@/lib/supabase-server';
import { isSessionOrganizer } from '@/lib/session-organizer';

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// public/push-sw.js 의 push 핸들러가 읽는 형식과 같아야 한다.
interface GameStartedPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
}

// upsert RPC는 임의의 endpoint URL을 저장하므로, 서버가 임의 호스트로 POST하지 않도록
// 알려진 푸시 서비스 호스트로만 발송한다.
const ALLOWED_PUSH_HOSTS = ['fcm.googleapis.com', 'push.apple.com', 'push.services.mozilla.com', 'notify.windows.com'];

function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return false;
    return ALLOWED_PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

// 설정이 불가능하면 false. 환경 변수 누락과 잘못된 키 형식 모두 로그를 남긴다.
function configureVapid(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  const missing = [
    !publicKey && 'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    !privateKey && 'VAPID_PRIVATE_KEY',
    !subject && 'VAPID_SUBJECT',
  ].filter((name): name is string => !!name);
  if (missing.length > 0) {
    console.error(`[push] VAPID 환경 변수가 없습니다: ${missing.join(', ')}`);
    return false;
  }
  try {
    webpush.setVapidDetails(subject!, publicKey!, privateKey!);
  } catch (error) {
    console.error('[push] VAPID 설정이 올바르지 않습니다:', error);
    return false;
  }
  return true;
}

// 발송 로직은 트리거와 분리해 둔다. 운영진 클라이언트 호출 대신 DB Webhook으로 트리거를 바꿀 때
// 이 함수는 그대로 재사용한다.
async function sendToSubscriptions(
  supabase: ServerSupabaseClient,
  allSubscriptions: PushSubscriptionRow[],
  payload: GameStartedPayload,
): Promise<{ sent: number; removed: number }> {
  const subscriptions = allSubscriptions.filter((sub) => isAllowedPushEndpoint(sub.endpoint));
  const skipped = allSubscriptions.length - subscriptions.length;
  if (skipped > 0) {
    console.warn('[push] skipped non-push-service endpoint(s):', skipped);
  }

  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body),
    ),
  );

  let sent = 0;
  const expiredIds: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      sent++;
      return;
    }
    const statusCode = (result.reason as { statusCode?: number } | undefined)?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      expiredIds.push(subscriptions[i].id);
    } else {
      console.error('[push] send failed:', statusCode, result.reason);
    }
  });

  if (expiredIds.length === 0) {
    return { sent, removed: 0 };
  }
  const { error } = await supabase.from('push_subscriptions').delete().in('id', expiredIds);
  if (error) {
    console.error('[push] expired subscription cleanup failed:', error);
    return { sent, removed: 0 };
  }
  return { sent, removed: expiredIds.length };
}

export async function POST(request: NextRequest) {
  if (!configureVapid()) {
    return NextResponse.json({ error: 'Push is not configured' }, { status: 500 });
  }

  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const gameId = body?.gameId;
    if (typeof gameId !== 'string' || gameId.length === 0) {
      return NextResponse.json({ error: 'Missing gameId' }, { status: 400 });
    }

    const { data: game, error: gameError } = await supabase
      .from('board_games')
      .select('id, session_id, court_id, player_ids, status')
      .eq('id', gameId)
      .maybeSingle();
    if (gameError) {
      console.error('[push] board_games lookup failed:', gameError);
      return NextResponse.json({ error: 'Failed to load game' }, { status: 500 });
    }
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    if (game.status !== 'playing' || !game.court_id) {
      return NextResponse.json({ error: 'Game is not on a court' }, { status: 409 });
    }

    const { data: session, error: sessionError } = await supabase
      .from('badminton_sessions')
      .select('creator_id')
      .eq('id', game.session_id)
      .single();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const isOrganizer = await isSessionOrganizer(supabase, game.session_id, user.id, session.creator_id);
    if (!isOrganizer) {
      return NextResponse.json({ error: 'Only session organizers can send turn notifications' }, { status: 403 });
    }

    const { data: court } = await supabase.from('courts').select('name').eq('id', game.court_id).maybeSingle();

    const playerIds = (game.player_ids as string[]).join(',');
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('session_id', game.session_id)
      .or(`session_participant_id.in.(${playerIds}),guest_participant_id.in.(${playerIds})`);
    if (subsError) {
      console.error('[push] push_subscriptions lookup failed:', subsError);
      return NextResponse.json({ error: 'Failed to load subscriptions' }, { status: 500 });
    }
    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, removed: 0 });
    }

    // 코트 이름은 임의 문자열이라 받침에 따라 갈리는 조사(으로/로)를 붙이지 않는다.
    const payload: GameStartedPayload = {
      title: '내 차례예요! 🏸',
      body: `${court?.name ?? '코트'}에서 게임이 시작돼요`,
      tag: game.id,
      url: `/badminton/${game.session_id}`,
    };

    const result = await sendToSubscriptions(supabase, subscriptions as PushSubscriptionRow[], payload);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[push] game-started error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
