'use client';

import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { MIN_PASSWORD_LENGTH, describePasswordError, validateNewPassword } from '@/utils/password';

/**
 * 이메일(메일 링크) 가입자에게 첫 로그인 직후 이름과 비밀번호를 받는 모달.
 * 이메일 로그인은 이름을 수집하지 않아 users.name에 임시값이 들어가 있고, 비밀번호가 없으면
 * 로그인할 때마다 메일함을 열어야 한다. 표시 여부는 AuthContext의 emailOnboarding이 정한다.
 */
export default function EmailOnboardingModal() {
  const { user, refreshProfile, emailOnboarding } = useAuth();
  const { isPending, needsName, needsPassword, dismiss } = emailOnboarding;
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!user) return null;

  const saveName = async (trimmedName: string): Promise<boolean> => {
    // 갱신된 행을 돌려받아 확인한다. 로그인 콜백의 행 생성이 실패했던 계정은 users 행이 없어
    // update가 에러 없이 0행만 바꾸는데, 그대로 두면 저장된 것처럼 보이고 이름은 없다.
    const { data: updatedRows, error: nameError } = await supabase
      .from('users')
      .update({ name: trimmedName, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('id');
    if (nameError || !updatedRows || updatedRows.length === 0) {
      setErrorMessage('이름 저장에 실패했습니다. 로그아웃 후 다시 로그인해주세요');
      return false;
    }
    // 이름은 이미 저장됐으므로 아래 표시 기록이 실패하더라도 헤더에는 바로 반영한다.
    await refreshProfile();
    const { error: metadataError } = await supabase.auth.updateUser({ data: { name_confirmed: true } });
    if (metadataError) {
      setErrorMessage('이름은 저장됐지만 설정을 마치지 못했습니다. 다시 시도해주세요');
      return false;
    }
    return true;
  };

  const save = async (skipPassword: boolean) => {
    setErrorMessage(null);

    // 저장 호출 전에 모든 입력을 검증한다. 이름만 저장되고 비밀번호가 형식 문제로 거부되면
    // 모달이 반쯤 처리된 상태로 남는다.
    const trimmedName = name.trim();
    if (needsName && trimmedName.length < 2) {
      setErrorMessage('이름은 2자 이상 입력해주세요');
      return;
    }
    const wantsPassword = needsPassword && !skipPassword && password.length > 0;
    if (needsPassword && !skipPassword && !password && passwordConfirm) {
      setErrorMessage('비밀번호를 입력해주세요');
      return;
    }
    if (wantsPassword) {
      const passwordProblem = validateNewPassword(password, passwordConfirm);
      if (passwordProblem) {
        setErrorMessage(passwordProblem);
        return;
      }
    }

    setIsSaving(true);
    // 실제로 저장한 것이 있을 때만 성공을 알린다(이름은 이미 확정됐고 비밀번호 칸을 비운 채
    // 저장을 누르면 아무것도 저장하지 않고 닫기만 한다).
    let savedSomething = false;
    try {
      if (needsName) {
        if (!(await saveName(trimmedName))) return;
        savedSomething = true;
      }

      if (needsPassword) {
        if (skipPassword) {
          const { error } = await supabase.auth.updateUser({ data: { password_prompt_skipped: true } });
          if (error) {
            setErrorMessage('설정 저장에 실패했습니다');
            return;
          }
          savedSomething = true;
        } else if (wantsPassword) {
          const { error } = await supabase.auth.updateUser({ password, data: { password_set: true } });
          if (error) {
            setErrorMessage(describePasswordError(error));
            return;
          }
          savedSomething = true;
        } else {
          // 비밀번호 칸을 비워 둔 채 저장: 미설정 상태로 남기고 이 탭에서는 다시 묻지 않는다.
          dismiss();
        }
      }

      if (savedSomething) toast.success('설정이 저장되었습니다');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    save(false);
  };

  return (
    <Dialog
      open={isPending}
      onOpenChange={(open) => {
        // 저장 중에 Esc·바깥 클릭·X로 닫히면 뒤이어 난 에러를 보여줄 곳이 없다.
        if (!open && !isSaving) dismiss();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">👋 계정 설정</DialogTitle>
          <DialogDescription className="text-center">
            {needsName
              ? '모임에서 표시될 이름을 알려주세요.'
              : '비밀번호를 설정하면 다음부터 메일을 열지 않고 로그인할 수 있습니다.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {needsName && (
            <div className="space-y-2">
              <Label htmlFor="onboarding-name">이름 *</Label>
              <Input
                id="onboarding-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="이름 또는 닉네임"
                autoComplete="name"
                disabled={isSaving}
              />
            </div>
          )}

          {needsPassword && (
            <>
              <div className="space-y-2">
                <Label htmlFor="onboarding-password">비밀번호 (선택)</Label>
                <Input
                  id="onboarding-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={`${MIN_PASSWORD_LENGTH}자 이상`}
                  autoComplete="new-password"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboarding-password-confirm">비밀번호 확인</Label>
                <Input
                  id="onboarding-password-confirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  autoComplete="new-password"
                  disabled={isSaving}
                />
              </div>
              <p className="text-xs text-gray-500">
                비밀번호가 없어도 지금처럼 이메일 링크로 로그인할 수 있고, 나중에 프로필에서 설정할 수 있습니다.
              </p>
            </>
          )}

          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? '저장 중...' : '저장'}
            </Button>
            {needsPassword && (
              <Button type="button" variant="outline" onClick={() => save(true)} disabled={isSaving}>
                비밀번호 없이 계속
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={dismiss} disabled={isSaving}>
              나중에
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
