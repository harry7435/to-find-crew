'use client';

import { useRef, type KeyboardEvent } from 'react';

export type MobileTab = { key: string; label: string; badge?: string | number };

/** 탭 바를 쓰는 가장 바깥 페이지 래퍼에 붙여, 마지막 콘텐츠가 하단 고정 바에 가려지지 않게 한다. 바 높이(4rem)에 더한 1rem은 마지막 카드와 바 사이에 두는 의도적인 여백이다. 데스크톱 패딩은 건드리지 않는다. */
export const MOBILE_TAB_BAR_PADDING = 'max-md:pb-[calc(5rem+env(safe-area-inset-bottom))]';

interface MobileTabBarProps {
  tabs: MobileTab[];
  active: string;
  onChange: (key: string) => void;
}

/**
 * 모바일(md 미만) 전용 하단 탭 바. 섹션을 세로로 다 펼치면 인원·대기·코트를 한 화면에 볼 수 없어서,
 * 한 번에 한 섹션만 보여주고 여기서 전환한다. 데스크톱은 기존 대시보드 레이아웃을 그대로 쓴다.
 * z-40: Radix 시트·모달(z-50)이 이 바 위에 떠야 한다.
 */
export default function MobileTabBar({ tabs, active, onChange }: MobileTabBarProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (key: string) => {
    if (key === active) return;
    // 사용자가 직접 탭을 바꾸면 새 섹션을 맨 위부터 보여준다.
    // 확정 → 대기, 배정 → 코트 같은 프로그램 전환은 페이지의 setter를 직접 호출해 여기를 거치지 않으므로
    // 도착 강조 스크롤이 그대로 유지된다.
    window.scrollTo({ top: 0, behavior: 'auto' });
    onChange(key);
  };

  // ARIA tabs 패턴: 방향키로 이동하면 선택과 포커스가 함께 따라간다(양 끝은 순환).
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = tabs.findIndex((t) => t.key === active);
    let next: number;
    if (e.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    select(tabs[next].key);
    tabRefs.current[next]?.focus();
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <div role="tablist" aria-label="화면 섹션" className="flex h-16" onKeyDown={handleKeyDown}>
        {tabs.map((tab, i) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              onClick={() => select(tab.key)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
                selected ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <span className={`text-sm ${selected ? 'font-semibold' : ''}`}>{tab.label}</span>
              <span className={`min-h-4 text-[11px] tabular-nums ${selected ? 'text-blue-600' : 'text-gray-400'}`}>
                {tab.badge ?? ''}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
