'use client';

import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { MIN_PASSWORD_LENGTH, describePasswordError, validateNewPassword } from '@/utils/password';

/**
 * 이메일 가입자의 비밀번호 설정·변경. 온보딩 모달을 닫았거나 "비밀번호 없이 계속"을 고른
 * 사람이 나중에 설정하는 경로다. 카카오 사용자는 OAuth라 비밀번호가 필요 없어 보이지 않는다.
 */
export default function PasswordSection() {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (user?.app_metadata?.provider !== 'email') return null;

  const hasPassword = user.user_metadata?.password_set === true;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validateNewPassword(password, passwordConfirm);
    if (problem) {
      setErrorMessage(problem);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      // 현재 비밀번호는 묻지 않는다 — 로그인 세션이 본인 확인 역할을 한다.
      const { error } = await supabase.auth.updateUser({ password, data: { password_set: true } });
      if (error) {
        setErrorMessage(describePasswordError(error));
        return;
      }
      setPassword('');
      setPasswordConfirm('');
      toast.success(hasPassword ? '비밀번호가 변경되었습니다' : '비밀번호가 설정되었습니다');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-center">{hasPassword ? '비밀번호 변경' : '비밀번호 설정'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!hasPassword && (
            <p className="text-sm text-gray-600">비밀번호를 설정하면 다음부터 메일을 열지 않고 로그인할 수 있습니다.</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="new-password">새 비밀번호</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={`${MIN_PASSWORD_LENGTH}자 이상`}
              autoComplete="new-password"
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password-confirm">새 비밀번호 확인</Label>
            <Input
              id="new-password-confirm"
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              autoComplete="new-password"
              disabled={isSaving}
            />
          </div>
          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
          <Button type="submit" className="w-full" disabled={isSaving || !password}>
            {isSaving ? '저장 중...' : hasPassword ? '비밀번호 변경' : '비밀번호 설정'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
