'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// users 테이블에 저장된 표시 정보. 소셜 계정 메타데이터(user.user_metadata)는 로그인 시점 값이라
// 프로필 페이지에서 바꾼 이름·사진을 반영하지 못하므로, 화면 표시는 이 값을 우선한다.
interface AuthProfile {
  name: string | null;
  profile_image: string | null;
}

// 이메일 가입자의 온보딩(이름·비밀번호 설정) 대기 상태. 완료 여부는 user_metadata에 있고
// 본인이 조작할 수 있는 값이므로 화면 표시 판단에만 쓴다 — 권한 판단에 쓰지 말 것.
interface EmailOnboarding {
  isPending: boolean;
  needsName: boolean;
  needsPassword: boolean;
  dismiss: () => void;
}

interface AuthContextType {
  user: User | null;
  profile: AuthProfile | null;
  refreshProfile: () => Promise<void>;
  loading: boolean;
  signInWithKakao: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  emailOnboarding: EmailOnboarding;
  signOut: () => Promise<void>;
}

// "나중에"로 닫은 온보딩 모달이 같은 탭에서 페이지를 옮길 때마다 다시 뜨지 않도록,
// 닫은 사용자의 id를 sessionStorage에 둔다. 브라우저를 새로 열면 다시 묻는다.
const ONBOARDING_DISMISSED_KEY = 'email_onboarding_dismissed';

function readDismissedUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(ONBOARDING_DISMISSED_KEY);
  } catch {
    return null;
  }
}

function writeDismissedUserId(userId: string): void {
  try {
    window.sessionStorage.setItem(ONBOARDING_DISMISSED_KEY, userId);
  } catch {
    // sessionStorage를 쓸 수 없어도 메모리 상태로 이번 화면에서는 닫힌다.
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const userId = user?.id;
  const [dismissedUserId, setDismissedUserId] = useState<string | null>(readDismissedUserId);

  const dismissEmailOnboarding = useCallback(() => {
    if (!userId) return;
    writeDismissedUserId(userId);
    setDismissedUserId(userId);
  }, [userId]);

  // provider를 먼저 본다 — 카카오 사용자는 메타데이터에 아래 키가 전혀 없어서,
  // provider 확인 없이 판정하면 온보딩 대상으로 잘못 잡힌다.
  const isEmailUser = user?.app_metadata?.provider === 'email';
  const needsName = isEmailUser && !user?.user_metadata?.name_confirmed;
  const needsPassword =
    isEmailUser && !user?.user_metadata?.password_set && !user?.user_metadata?.password_prompt_skipped;
  const emailOnboarding: EmailOnboarding = {
    isPending: !loading && (needsName || needsPassword) && dismissedUserId !== userId,
    needsName,
    needsPassword,
    dismiss: dismissEmailOnboarding,
  };

  // onAuthStateChange 콜백 안에서 supabase를 다시 호출하면 교착될 수 있어, 조회는 별도 effect로 뺀다.
  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('users').select('name, profile_image').eq('id', userId).maybeSingle();
    setProfile(data ?? null);
  }, [userId]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    // 초기 세션 확인
    const getSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Session error:', error);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // 인증 상태 변경 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithKakao = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Email sign in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithPassword = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      console.error('Password sign in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    profile,
    refreshProfile,
    loading,
    signInWithKakao,
    signInWithEmail,
    signInWithPassword,
    emailOnboarding,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
