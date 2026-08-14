import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// 이용약관/개인정보처리방침처럼 "본문이 긴 정적 문서" 페이지의 공통 껍데기.
// 두 페이지가 동일한 여백/타이포/시행일 표기 규칙을 공유하도록 여기 한 곳에 모아둔다.
export default function LegalLayout({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          홈으로
        </Link>

        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">시행일: {effectiveDate}</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-gray-700">{children}</div>
      </div>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-gray-900">{heading}</h2>
      {children}
    </section>
  );
}
