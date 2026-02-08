'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Player } from '@/hooks/useGameManager';

const playerSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(20, '이름은 20자 이하여야 합니다'),
  gender: z.string().optional(),
  skillLevel: z.string().optional(),
  ageGroup: z.string().optional(),
});

type PlayerFormData = z.infer<typeof playerSchema>;

interface PlayerEditModalProps {
  player: Player | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Omit<Player, 'id'>>) => void;
}

export default function PlayerEditModal({ player, isOpen, onClose, onUpdate }: PlayerEditModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PlayerFormData>({
    resolver: zodResolver(playerSchema),
  });

  useEffect(() => {
    if (player && isOpen) {
      reset({
        name: player.name,
        gender: player.gender || '',
        skillLevel: player.skillLevel || '',
        ageGroup: player.ageGroup || '',
      });
    }
  }, [player, isOpen, reset]);

  const onSubmit = (data: PlayerFormData) => {
    if (!player) return;

    const updates: Partial<Omit<Player, 'id'>> = {
      name: data.name,
    };

    if (data.gender && data.gender !== '') {
      updates.gender = data.gender as 'male' | 'female';
    } else {
      updates.gender = undefined;
    }

    if (data.skillLevel && data.skillLevel !== '') {
      updates.skillLevel = data.skillLevel as 'S' | 'A' | 'B' | 'C' | 'D' | 'E';
    } else {
      updates.skillLevel = undefined;
    }

    if (data.ageGroup && data.ageGroup !== '') {
      updates.ageGroup = data.ageGroup as '10s' | '20s' | '30s' | '40s' | '50s' | '60s+';
    } else {
      updates.ageGroup = undefined;
    }

    onUpdate(player.id, updates);
    onClose();
  };

  if (!player) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>선수 정보 수정</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">이름 *</Label>
            <Input id="edit-name" {...register('name')} placeholder="선수 이름" autoComplete="off" />
            {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-gender">성별</Label>
            <select
              id="edit-gender"
              {...register('gender')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">선택안함</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-age">나이대</Label>
            <select
              id="edit-age"
              {...register('ageGroup')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">선택안함</option>
              <option value="10s">10대</option>
              <option value="20s">20대</option>
              <option value="30s">30대</option>
              <option value="40s">40대</option>
              <option value="50s">50대</option>
              <option value="60s+">60대 이상</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-skill">실력 급수</Label>
            <select
              id="edit-skill"
              {...register('skillLevel')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">선택안함</option>
              <option value="S">S조</option>
              <option value="A">A조</option>
              <option value="B">B조</option>
              <option value="C">C조</option>
              <option value="D">D조</option>
              <option value="E">초심 or E조</option>
            </select>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              취소
            </Button>
            <Button type="submit" className="flex-1">
              수정
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
