'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';

const userInfoSchema = z.object({
  gender: z.enum(['male', 'female', 'other'], { message: '성별을 선택해주세요' }),
  age_group: z.enum(['10s', '20s', '30s', '40s', '50s', '60s+'], { message: '나이대를 선택해주세요' }),
  skill_level: z.enum(['S', 'A', 'B', 'C', 'D', 'E'], { message: '실력을 선택해주세요' }),
});

type UserInfoFormData = z.infer<typeof userInfoSchema>;

interface UserInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UserInfoFormData) => void;
  isLoading?: boolean;
}

export default function UserInfoModal({ isOpen, onClose, onSubmit, isLoading = false }: UserInfoModalProps) {
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<UserInfoFormData>({
    resolver: zodResolver(userInfoSchema),
  });

  // 기존 프로필 정보 불러오기
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!isOpen) return;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from('users')
            .select('gender, skill_level')
            .eq('id', user.id)
            .single();

          if (profile) {
            if (profile.gender) {
              setValue('gender', profile.gender as 'male' | 'female' | 'other');
            }
            if (profile.skill_level) {
              // 기존 숫자 실력을 문자 급수로 변환
              const skillMap: { [key: number]: 'S' | 'A' | 'B' | 'C' | 'D' | 'E' } = {
                5: 'S',
                4: 'A',
                3: 'B',
                2: 'C',
                1: 'D',
                0: 'E',
              };
              setValue('skill_level', skillMap[profile.skill_level] || 'E');
            }
          }
        }
      } catch (error) {
        console.error('Failed to load user profile:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadUserProfile();
  }, [isOpen, setValue]);

  const handleFormSubmit = (data: UserInfoFormData) => {
    onSubmit(data);
  };

  const handleClose = () => {
    reset();
    setIsLoadingProfile(true);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">👤 참가자 정보 입력</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gender">성별 *</Label>
              <select
                id="gender"
                {...register('gender')}
                disabled={isLoading || isLoadingProfile}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">선택해주세요</option>
                <option value="male">남성</option>
                <option value="female">여성</option>
                <option value="other">기타</option>
              </select>
              {errors.gender && <p className="text-sm text-red-600">{errors.gender.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="age_group">나이대 *</Label>
              <select
                id="age_group"
                {...register('age_group')}
                disabled={isLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">선택해주세요</option>
                <option value="10s">10대</option>
                <option value="20s">20대</option>
                <option value="30s">30대</option>
                <option value="40s">40대</option>
                <option value="50s">50대</option>
                <option value="60s+">60대 이상</option>
              </select>
              {errors.age_group && <p className="text-sm text-red-600">{errors.age_group.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="skill_level">실력 급수 *</Label>
              <select
                id="skill_level"
                {...register('skill_level')}
                disabled={isLoading || isLoadingProfile}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">선택해주세요</option>
                <option value="S">S조</option>
                <option value="A">A조</option>
                <option value="B">B조</option>
                <option value="C">C조</option>
                <option value="D">D조</option>
                <option value="E">초심 or E조</option>
              </select>
              {errors.skill_level && <p className="text-sm text-red-600">{errors.skill_level.message}</p>}
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading} className="flex-1">
              취소
            </Button>
            <Button type="submit" disabled={isLoading || isLoadingProfile} className="flex-1">
              {isLoading ? '저장 중...' : isLoadingProfile ? '로딩 중...' : '확인'}
            </Button>
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            <p>💡 입력하신 정보는 팀 배정에 활용됩니다</p>
            <p>• 성별과 실력은 프로필에 저장되어 다음에 자동으로 채워집니다</p>
            <p>• 나이대는 매번 입력하셔야 합니다</p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
