'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Player } from '@/hooks/useGameManager';

const playerSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(20, '이름은 20자 이하여야 합니다'),
  gender: z.string().optional(),
  skillLevel: z.string().optional(),
  ageGroup: z.string().optional(),
});

type PlayerFormData = z.infer<typeof playerSchema>;

interface PlayerFormProps {
  onAddPlayer: (player: Omit<Player, 'id' | 'status'>) => void;
  isDisabled?: boolean;
}

export default function PlayerForm({ onAddPlayer, isDisabled = false }: PlayerFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PlayerFormData>({
    resolver: zodResolver(playerSchema),
    defaultValues: {
      name: '',
      gender: undefined,
      skillLevel: undefined,
    },
  });

  const onSubmit = (data: PlayerFormData) => {
    // Remove empty string values
    const playerData: Omit<Player, 'id' | 'status'> = {
      name: data.name,
    };

    if (data.gender && data.gender !== '') {
      playerData.gender = data.gender as 'male' | 'female';
    }

    if (data.skillLevel && data.skillLevel !== '') {
      playerData.skillLevel = data.skillLevel as 'S' | 'A' | 'B' | 'C' | 'D' | 'E';
    }

    if (data.ageGroup && data.ageGroup !== '') {
      playerData.ageGroup = data.ageGroup as '10s' | '20s' | '30s' | '40s' | '50s' | '60s+';
    }

    onAddPlayer(playerData);
    reset();
    // Focus on name input after submission
    const nameInput = document.getElementById('player-name') as HTMLInputElement;
    if (nameInput) {
      nameInput.focus();
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="player-name">이름 *</Label>
          <Input
            id="player-name"
            {...register('name')}
            disabled={isDisabled}
            placeholder="선수 이름"
            autoComplete="off"
          />
          {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="player-gender">성별</Label>
          <select
            id="player-gender"
            {...register('gender')}
            disabled={isDisabled}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">선택안함</option>
            <option value="male">남성</option>
            <option value="female">여성</option>
          </select>
          {errors.gender && <p className="text-sm text-red-600">{errors.gender.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="player-age">나이대</Label>
          <select
            id="player-age"
            {...register('ageGroup')}
            disabled={isDisabled}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">선택안함</option>
            <option value="10s">10대</option>
            <option value="20s">20대</option>
            <option value="30s">30대</option>
            <option value="40s">40대</option>
            <option value="50s">50대</option>
            <option value="60s+">60대 이상</option>
          </select>
          {errors.ageGroup && <p className="text-sm text-red-600">{errors.ageGroup.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="player-skill">실력 급수</Label>
          <select
            id="player-skill"
            {...register('skillLevel')}
            disabled={isDisabled}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">선택안함</option>
            <option value="S">S조</option>
            <option value="A">A조</option>
            <option value="B">B조</option>
            <option value="C">C조</option>
            <option value="D">D조</option>
            <option value="E">초심 or E조</option>
          </select>
          {errors.skillLevel && <p className="text-sm text-red-600">{errors.skillLevel.message}</p>}
        </div>
      </div>

      <Button type="submit" disabled={isDisabled} className="w-full md:w-auto">
        등록
      </Button>
    </form>
  );
}
