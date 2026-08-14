import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t bg-white">
      <div className="container mx-auto flex flex-col items-center gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
        <p>&copy; 2026 To Find Crew. All rights reserved.</p>
        <nav className="flex items-center gap-4">
          <Link href="/terms" className="hover:text-foreground">
            서비스 이용약관
          </Link>
          <Link href="/privacy" className="font-medium hover:text-foreground">
            개인정보처리방침
          </Link>
        </nav>
      </div>
    </footer>
  );
}
