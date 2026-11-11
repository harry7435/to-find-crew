'use client';

// 왜 존재하나: iOS 인앱 웹뷰(카카오톡 등)나 "대화상자 차단"을 누른 Safari에서는
// 네이티브 window.confirm()이 아무것도 띄우지 않고 즉시 false를 반환한다.
// 그러면 confirm으로 감싼 동작이 조용히 무시되므로, 앱 안의 모달 기반 confirm으로 대체한다.

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
  const [open, setOpen] = React.useState(false);
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null);

  // 호출당 정확히 한 번만 resolve 되도록 resolver를 꺼내면서 비운다.
  const settle = React.useCallback((value: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(value);
  }, []);

  const confirm = React.useCallback<ConfirmFn>(
    (opts) => {
      // 이미 열린 confirm이 있으면 false로 먼저 마무리한다.
      settle(false);
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setOptions(opts);
        setOpen(true);
      });
    },
    [settle],
  );

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      settle(false);
      setOpen(false);
    }
  };

  const handleConfirm = () => {
    settle(true);
    setOpen(false);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{options?.title}</DialogTitle>
            {options?.description && (
              <DialogDescription className="whitespace-pre-line">{options.description}</DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              {options?.cancelText ?? '취소'}
            </Button>
            <Button variant={options?.variant === 'destructive' ? 'destructive' : 'default'} onClick={handleConfirm}>
              {options?.confirmText ?? '확인'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm()은 <ConfirmProvider> 안에서만 사용할 수 있습니다.');
  }
  return ctx;
}
