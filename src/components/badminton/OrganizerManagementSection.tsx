'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { SessionOrganizer, SessionParticipant } from '@/types/badminton';

interface OrganizerManagementSectionProps {
  sessionId: string;
  creatorId: string;
  creatorName: string;
  participants: SessionParticipant[];
  organizers: SessionOrganizer[];
  onOrganizersChanged: () => void;
}

export default function OrganizerManagementSection({
  sessionId,
  creatorId,
  creatorName,
  participants,
  organizers,
  onOrganizersChanged,
}: OrganizerManagementSectionProps) {
  const { user } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const organizerUserIds = new Set(organizers.map((o) => o.user_id));
  const candidates = participants.filter((p) => p.user_id !== creatorId && !organizerUserIds.has(p.user_id));

  const handleAdd = async () => {
    if (!selectedUserId || !user) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('session_organizers')
        .insert({ session_id: sessionId, user_id: selectedUserId, granted_by: user.id });

      if (error) throw error;

      toast.success('운영진으로 지정했습니다');
      setSelectedUserId('');
      onOrganizersChanged();
    } catch (error) {
      console.error('Add organizer error:', error);
      toast.error('운영진 지정에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('session_organizers')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('운영진을 해제했습니다');
      onOrganizersChanged();
    } catch (error) {
      console.error('Remove organizer error:', error);
      toast.error('운영진 해제에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>운영진 관리</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <span className="text-sm">{creatorName}</span>
            <Badge variant="outline">생성자</Badge>
          </div>
          {organizers.map((organizer) => (
            <div key={organizer.user_id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">{organizer.user.name}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                onClick={() => handleRemove(organizer.user_id)}
              >
                해제
              </Button>
            </div>
          ))}
        </div>

        {candidates.length > 0 && (
          <div className="flex gap-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="참가자 선택" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((participant) => (
                  <SelectItem key={participant.user_id} value={participant.user_id}>
                    {participant.user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={!selectedUserId || isSubmitting}>
              운영진 추가
            </Button>
          </div>
        )}

        {candidates.length === 0 && (
          <p className="text-xs text-gray-500">운영진으로 추가할 수 있는 로그인 참가자가 없습니다.</p>
        )}
      </CardContent>
    </Card>
  );
}
