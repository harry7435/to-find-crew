'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const joinSchema = z.object({
  access_code: z
    .string()
    .min(4, '접근 코드는 4자리입니다')
    .max(4, '접근 코드는 4자리입니다')
    .regex(/^[A-Z0-9]+$/, '접근 코드는 영문 대문자와 숫자만 포함합니다'),
});

type JoinFormData = z.infer<typeof joinSchema>;

export default function JoinSessionForm() {
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
    // 접근 코드를 통한 참가는 초대 링크로 리다이렉트
    const code = data.access_code.toUpperCase();
    router.push(`/badminton/invite/${code}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length <= 4) {
      setValue('access_code', value);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">🏸 번개 모임 참가</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="access_code">접근 코드</Label>
            <Input
              id="access_code"
              placeholder="영문 대문자와 숫자만 포함 4자리"
              value={accessCode}
              onChange={handleInputChange}
              className="text-center text-lg font-mono tracking-widest"
              maxLength={4}
            />
            {errors.access_code && <p className="text-sm text-red-600">{errors.access_code.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={accessCode.length !== 4}>
            번개 모임 참가하기
          </Button>

          <div className="text-sm text-gray-600 space-y-1">
            <p>
              💡 <strong>참가 방법:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4 text-xs">
              <li>관리자로부터 받은 4자리 코드를 입력하세요</li>
              <li>로그인 사용자 또는 게스트로 참가할 수 있습니다</li>
              <li>게스트 참가 시 이름, 성별, 급수, 나이대 정보가 필요합니다</li>
            </ul>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
