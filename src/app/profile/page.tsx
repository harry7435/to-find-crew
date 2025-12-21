'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import AuthGuard from '@/components/auth/AuthGuard';
import { ArrowLeft, User, Camera } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const profileSchema = z.object({
  name: z.string().min(2, '이름은 최소 2자 이상이어야 합니다'),
  bio: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']),
  skill_level: z.number().min(0).max(5),
  phone: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface UserProfile {
  id: string;
  email: string;
  name: string;
  profile_image: string | null;
  bio: string | null;
  gender: string | null;
  skill_level: number | null;
  phone: string | null;
}

// 상수
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// 이미지 파일 검증
const validateImageFile = (file: File): { ok: true } | { ok: false; reason: string } => {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, reason: `파일 크기는 ${MAX_FILE_SIZE_MB}MB 이하여야 합니다` };
  }

  if (!file.type.startsWith('image/')) {
    return { ok: false, reason: '이미지 파일만 업로드 가능합니다' };
  }

  return { ok: true };
};

export default function ProfilePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const genderValue = watch('gender');
  const skillLevelValue = watch('skill_level');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/auth/login');
          return;
        }

        const { data, error } = await supabase.from('users').select('*').eq('id', user.id).single();

        if (error) {
          throw error;
        }

        setProfile(data);
        setProfileImageUrl(data.profile_image);

        // 폼에 데이터 채우기
        setValue('name', data.name || '');
        setValue('bio', data.bio || '');
        setValue('gender', (data.gender as 'male' | 'female' | 'other') || 'male');
        setValue('skill_level', data.skill_level || 1);
        setValue('phone', data.phone || '');
      } catch (error) {
        console.error('Profile fetch error:', error);
        toast.error('프로필을 불러올 수 없습니다');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [router, setValue]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!profile) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: data.name,
          bio: data.bio || null,
          gender: data.gender,
          skill_level: data.skill_level,
          phone: data.phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) {
        throw error;
      }

      toast.success('프로필이 업데이트되었습니다!');
      router.push('/');
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('프로필 업데이트에 실패했습니다', {
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    // 파일 검증
    const validation = validateImageFile(file);
    if (!validation.ok) {
      toast.error(validation.reason);
      return;
    }

    setIsUploadingImage(true);
    try {
      // 파일 이름 생성 (사용자 ID + 타임스탬프)
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      // Supabase Storage에 업로드
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

      if (uploadError) {
        throw uploadError;
      }

      // 공개 URL 가져오기
      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);

      // 데이터베이스 업데이트
      const { error: updateError } = await supabase
        .from('users')
        .update({
          profile_image: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (updateError) {
        throw updateError;
      }

      setProfileImageUrl(publicUrl);
      toast.success('프로필 이미지가 업데이트되었습니다!');
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error('이미지 업로드에 실패했습니다', {
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다',
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const getSkillLevelText = (level: number) => {
    const levels = ['E급', 'D급', 'C급', 'B급', 'A급', 'S급'];
    return levels[level] || 'E급';
  };

  if (isLoading) {
    return (
      <AuthGuard>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">프로필을 불러오는 중...</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (!profile) {
    return (
      <AuthGuard>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-red-600 mb-4">프로필을 찾을 수 없습니다</p>
            <Link href="/">
              <Button>홈으로 돌아가기</Button>
            </Link>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* 헤더 */}
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              뒤로가기
            </Button>
          </Link>
        </div>

        {/* 프로필 카드 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center">프로필 수정</CardTitle>
          </CardHeader>
          <CardContent>
            {/* 프로필 이미지 */}
            <div className="flex justify-center mb-6">
              <div className="relative group">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profileImageUrl || undefined} />
                  <AvatarFallback>
                    <User className="h-12 w-12" />
                  </AvatarFallback>
                </Avatar>

                {/* 이미지 업로드 버튼 */}
                <label
                  htmlFor="profile-image-upload"
                  className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full p-2 cursor-pointer hover:bg-blue-700 transition-colors shadow-lg"
                >
                  {isUploadingImage ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </label>
                <input
                  id="profile-image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={isUploadingImage}
                />
              </div>
            </div>
            <p className="text-center text-sm text-gray-500 mb-6">프로필 사진을 클릭하여 변경할 수 있습니다</p>

            {/* 이메일 (읽기 전용) */}
            <div className="mb-6 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">이메일</p>
              <p className="font-medium">{profile.email}</p>
            </div>

            {/* 수정 폼 */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">이름 *</Label>
                <Input id="name" placeholder="이름을 입력하세요" {...register('name')} disabled={isSaving} />
                {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">자기소개</Label>
                <Textarea
                  id="bio"
                  placeholder="자기소개를 입력하세요"
                  {...register('bio')}
                  disabled={isSaving}
                  rows={4}
                />
                {errors.bio && <p className="text-sm text-red-600">{errors.bio.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender">성별 *</Label>
                  <Select
                    value={genderValue}
                    onValueChange={(value) => setValue('gender', value as 'male' | 'female' | 'other')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="성별 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">남성</SelectItem>
                      <SelectItem value="female">여성</SelectItem>
                      <SelectItem value="other">기타</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.gender && <p className="text-sm text-red-600">{errors.gender.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="skill_level">실력 급수 *</Label>
                  <Select
                    value={skillLevelValue?.toString()}
                    onValueChange={(value) => setValue('skill_level', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="실력 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">E급 (초심)</SelectItem>
                      <SelectItem value="1">D급</SelectItem>
                      <SelectItem value="2">C급</SelectItem>
                      <SelectItem value="3">B급</SelectItem>
                      <SelectItem value="4">A급</SelectItem>
                      <SelectItem value="5">S급</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.skill_level && <p className="text-sm text-red-600">{errors.skill_level.message}</p>}
                  <p className="text-xs text-gray-500">현재: {getSkillLevelText(skillLevelValue || 0)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">연락처</Label>
                <Input id="phone" type="tel" placeholder="010-1234-5678" {...register('phone')} disabled={isSaving} />
                {errors.phone && <p className="text-sm text-red-600">{errors.phone.message}</p>}
              </div>

              <div className="pt-4 flex gap-2">
                <Button type="submit" className="flex-1" disabled={isSaving}>
                  {isSaving ? '저장 중...' : '프로필 저장'}
                </Button>
                <Link href="/" className="flex-1">
                  <Button type="button" variant="outline" className="w-full" disabled={isSaving}>
                    취소
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
}
