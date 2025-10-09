'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

const joinSchema = z.object({
  access_code: z
    .string()
    .min(6, '접근 코드는 6자리입니다')
    .max(6, '접근 코드는 6자리입니다')
    .regex(/^[A-Z0-9]+$/, '접근 코드는 영문 대문자와 숫자만 포함합니다'),
});

type JoinFormData = z.infer<typeof joinSchema>;

interface JoinSessionFormProps {
  onSuccess?: (sessionId: string) => void;
}

export default function JoinSessionForm({ onSuccess }: JoinSessionFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const {
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<JoinFormData>({
    resolver: zodResolver(joinSchema),
  });

  const accessCode = watch('access_code', '');

  const onSubmit = async (data: JoinFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/badminton/sessions/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_code: data.access_code.toUpperCase(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.redirect_to === '/profile/complete') {
          toast.error('프로필 완성 필요', {
            description: '배드민턴 참가를 위해 성별과 실력 정보를 입력해주세요',
          });
          router.push('/profile/complete');
          return;
        }
        throw new Error(result.error || 'Failed to join session');
      }

      // 성공 응답 처리 (신규 가입 또는 이미 가입한 경우 모두)
      if (result.already_joined) {
        toast.success('이미 참가한 세션입니다', {
          description: `${result.session.name}으로 이동합니다`,
        });
      } else {
        toast.success('세션에 참가했습니다!', {
          description: `${result.session.name}에 참가하셨습니다`,
        });
      }

      if (onSuccess) {
        onSuccess(result.session.id);
      } else {
        router.push(`/badminton/${result.session.id}`);
      }
    } catch (error) {
      console.error('Session join error:', error);

      let errorMessage = '알 수 없는 오류가 발생했습니다';
      if (error instanceof Error) {
        switch (error.message) {
          case 'Invalid access code':
            errorMessage = '유효하지 않은 접근 코드입니다';
            break;
          case 'Session is full':
            errorMessage = '세션이 가득 찼습니다';
            break;
          case 'Session has ended':
            errorMessage = '종료된 세션입니다';
            break;
          case 'Authentication required':
            errorMessage = '로그인이 필요합니다';
            break;
          default:
            errorMessage = error.message;
        }
      }

      toast.error('세션 참가에 실패했습니다', {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length <= 6) {
      setValue('access_code', value);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">🏸 세션 참가</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="access_code">접근 코드</Label>
            <Input
              id="access_code"
              placeholder="ABCD12"
              value={accessCode}
              onChange={handleInputChange}
              className="text-center text-lg font-mono tracking-widest"
              maxLength={6}
              disabled={isLoading}
            />
            {errors.access_code && <p className="text-sm text-red-600">{errors.access_code.message}</p>}
            <p className="text-xs text-gray-500 text-center">관리자로부터 받은 6자리 코드를 입력하세요</p>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading || accessCode.length !== 6}>
            {isLoading ? '참가 중...' : '세션 참가하기'}
          </Button>

          <div className="text-sm text-gray-600 space-y-1">
            <p>
              💡 <strong>참가 전 확인사항:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4 text-xs">
              <li>프로필에 성별과 실력 정보가 입력되어 있어야 합니다</li>
              <li>세션 시작 후에는 팀 배정이 이루어집니다</li>
              <li>공정한 게임을 위해 정확한 실력 정보를 입력해주세요</li>
            </ul>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
