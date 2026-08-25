'use client';

import { useTheme } from 'next-themes';
import { toast, Toaster as Sonner, ToasterProps } from 'sonner';

const Toaster = ({ duration = 1000, ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    // sonner는 스와이프 제스처로만 닫히고 단순 탭에는 반응하지 않아서,
    // 토스트 영역을 탭하면 닫히도록 클릭 위임을 직접 붙인다.
    <div
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('[data-sonner-toast]')) {
          toast.dismiss();
        }
      }}
    >
      <Sonner
        theme={theme as ToasterProps['theme']}
        className="toaster group"
        duration={duration}
        style={
          {
            '--normal-bg': 'var(--popover)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
          } as React.CSSProperties
        }
        {...props}
      />
    </div>
  );
};

export { Toaster };
