'use client';

import { useCallback, useEffect, useState } from 'react';

function readIds(storageKey: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((id): id is string => typeof id === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function writeIds(storageKey: string, ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify([...ids]));
  } catch {
    // localStorage 접근 불가 시 조용히 무시 (준비완료는 기기 로컬 편의 기능일 뿐)
  }
}

/**
 * 준비완료(셔틀콕 납부 + 게임 준비) 체크는 모임장이 현장에서만 확인하는 용도라
 * 서버 테이블 없이 기기 로컬(localStorage)에만 저장한다.
 */
export function useReadyFlags(storageKey: string) {
  const [readyIds, setReadyIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setReadyIds(readIds(storageKey));
  }, [storageKey]);

  /**
   * keepIds에 없는 준비완료 플래그를 걷어낸다. 준비완료는 "오늘 참석"에 종속된 상태라
   * 참석이 풀리면 함께 해제되어야 하는데, 참석은 개별 토글·오늘 참석자 선택·참석 전체 해제·
   * (모임 보드에서는) 다른 기기의 realtime 변경까지 여러 경로로 바뀐다.
   * 호출부마다 해제 코드를 흩뿌리는 대신 참석자 집합이 바뀔 때 한 번에 정리한다.
   */
  const pruneReady = useCallback(
    (keepIds: Set<string>) => {
      setReadyIds((prev) => {
        const next = new Set([...prev].filter((id) => keepIds.has(id)));
        if (next.size === prev.size) return prev;
        writeIds(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const toggleReady = useCallback(
    (id: string) => {
      setReadyIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        writeIds(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const removeReady = useCallback(
    (id: string) => {
      setReadyIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        writeIds(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const clearReady = useCallback(() => {
    setReadyIds(new Set());
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  return { readyIds, toggleReady, removeReady, clearReady, pruneReady };
}
