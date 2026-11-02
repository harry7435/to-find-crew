'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Player } from '@/hooks/useGameManager';
import {
  getPushSupport,
  getSessionPushState,
  subscribeToSession,
  unsubscribeFromSession,
  type PushSupport,
  type PushTarget,
  type SessionPushState,
} from '@/lib/push';

interface PushOptInProps {
  sessionId: string;
  players: Player[];
  /** 로그인 사용자가 이 모임의 session_participants 에 있으면 그 id. 아니면 null. */
  myParticipantId: string | null;
}

export default function PushOptIn({ sessionId, players, myParticipantId }: PushOptInProps) {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [state, setState] = useState<SessionPushState | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 브라우저 API는 마운트 후에만 읽는다 (SSR 결과와 어긋나지 않게).
  useEffect(() => {
    const nextSupport = getPushSupport();
    setSupport(nextSupport);
    if (nextSupport !== 'supported') return;
    let cancelled = false;
    getSessionPushState(sessionId)
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'off' });
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const me = myParticipantId ? players.find((p) => p.id === myParticipantId) : undefined;
  // 로그인 참가자는 본인으로만 받을 수 있다. 그 외에는 게스트 명단에서 고른다.
  const candidates: PushTarget[] = me
    ? [{ participantId: me.id, participantType: 'user', name: me.name }]
    : players
        .filter((p) => p.participantType === 'guest')
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
        .map((p) => ({ participantId: p.id, participantType: 'guest', name: p.name }));

  const handleSelect = async (target: PushTarget) => {
    setIsBusy(true);
    setError(null);
    try {
      await subscribeToSession(sessionId, target);
      setState({ status: 'on', target });
      setIsSheetOpen(false);
      toast.success(`${target.name}님 차례가 되면 알려드릴게요`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알림을 켜지 못했어요');
      if (Notification.permission === 'denied') {
        setState({ status: 'denied' });
        setIsSheetOpen(false);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleTurnOff = async () => {
    setIsBusy(true);
    try {
      await unsubscribeFromSession(sessionId);
      setState({ status: 'off' });
      toast.success('알림을 껐어요');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '알림을 끄지 못했어요');
    } finally {
      setIsBusy(false);
    }
  };

  if (support === null || support === 'unsupported') return null;

  if (support === 'ios-needs-install') {
    return (
      <p className="text-xs text-gray-500">
        📲 홈 화면에 추가한 앱으로 열면 내 차례 알림을 받을 수 있어요 (공유 → 홈 화면에 추가)
      </p>
    );
  }

  if (state === null) return null;

  if (state.status === 'denied') {
    return (
      <p className="text-xs text-gray-500">
        🔕 알림이 차단되어 있어요. 브라우저 설정에서 이 사이트의 알림을 허용해 주세요
      </p>
    );
  }

  if (state.status === 'on') {
    return (
      <div className="flex items-center gap-1">
        <span className="flex items-center text-xs text-green-700">
          <Bell className="h-3.5 w-3.5 mr-1" />
          {state.target.name}님 알림 켜짐
        </span>
        <Button size="sm" variant="ghost" disabled={isBusy} onClick={handleTurnOff}>
          끄기
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setError(null);
          setIsSheetOpen(true);
        }}
      >
        <Bell className="h-4 w-4 mr-1" />내 차례 알림 받기
      </Button>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>누구로 알림을 받을까요?</SheetTitle>
            <SheetDescription>내 게임이 코트에 배정되면 이 기기로 알림을 보내드려요.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6 space-y-2">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {candidates.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                선택할 수 있는 이름이 없어요. 운영진에게 명단 추가를 요청해 주세요
              </p>
            ) : (
              candidates.map((target) => (
                <Button
                  key={target.participantId}
                  variant="outline"
                  className="w-full justify-start"
                  disabled={isBusy}
                  onClick={() => handleSelect(target)}
                >
                  {target.name}
                  {target.participantType === 'user' && <span className="ml-1 text-xs text-gray-500">(나)</span>}
                </Button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
