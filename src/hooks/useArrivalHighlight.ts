'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** 방금 내 동작으로 도착한 항목(대기열 항목 id 또는 코트 id)과 그 위에 붙일 배지 문구. */
export type Arrival = { id: string; label: string };

const ARRIVAL_MS = 2500;

/**
 * 확정·코트 배정처럼 결과가 화면의 다른 곳에 나타나는 동작 뒤에, 그 도착지를 잠깐 강조하기 위한 상태.
 * 내 동작의 성공 분기에서만 flash()를 부른다 — 다른 운영자의 realtime 변경에는 강조를 걸지 않는다.
 */
export function useArrivalHighlight() {
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((id: string, label: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setArrival({ id, label });
    timerRef.current = setTimeout(() => setArrival(null), ARRIVAL_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { arrival, flash };
}

/** 도착지가 화면 밖이면 보이게 스크롤한다. 움직임 줄이기 설정이면 애니메이션 없이 이동한다. */
export function scrollToArrival(el: HTMLElement | null) {
  if (!el) return;
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
}

/** 순서와 무관하게 같은 4명인지. enqueueGame이 id를 돌려주지 않아 방금 넣은 대기열 항목을 이걸로 찾는다. */
export function samePlayerSet(a: readonly string[], b: readonly string[]) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((id, i) => id === sb[i]);
}
