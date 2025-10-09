'use client';

import SessionForm from '@/components/badminton/SessionForm';
import AuthGuard from '@/components/auth/AuthGuard';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function CreateSessionPage() {
  return (
    <AuthGuard>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              홈으로 돌아가기
            </Button>
          </Link>
        </div>
        <SessionForm />
      </div>
    </AuthGuard>
  );
}
