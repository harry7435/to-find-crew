// Supabase Dashboard → Authentication → Email의 "Minimum password length"와 같은 값이어야 한다.
// 다르면 여기서는 통과하고 서버에서 weak_password로 거부된다.
export const MIN_PASSWORD_LENGTH = 6;

/** 새 비밀번호 입력을 저장 호출 전에 검증한다. 문제가 없으면 null. */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다`;
  }
  if (password !== confirm) {
    return '비밀번호가 서로 다릅니다';
  }
  return null;
}

/** supabase.auth.updateUser({ password })가 돌려준 에러를 사용자 문구로 바꾼다. */
export function describePasswordError(error: { code?: string; message: string }): string {
  switch (error.code) {
    case 'weak_password':
      return '비밀번호가 너무 단순합니다. 더 길거나 복잡하게 입력해주세요';
    case 'same_password':
      return '현재 비밀번호와 다른 비밀번호를 입력해주세요';
    case 'reauthentication_needed':
      // 대시보드의 "Secure password change"가 켜져 있으면 오래된 로그인 세션에서 거부된다.
      return '보안을 위해 다시 로그인이 필요합니다. 로그아웃 후 이메일 링크로 로그인한 뒤 시도해주세요';
    default:
      return '비밀번호 저장에 실패했습니다';
  }
}
