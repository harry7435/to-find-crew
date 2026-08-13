export interface SessionOrganizer {
  user_id: string;
  user: {
    id: string;
    name: string;
    profile_image?: string;
  };
}

export interface BadmintonSession {
  id: string;
  name: string;
  venue_name: string;
  session_date: string;
  max_participants: number;
  access_code: string;
  creator_id: string;
  court_count: number;
  status: 'open' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
  creator?: {
    id: string;
    name: string;
    email: string;
    profile_image?: string;
  };
  session_participants?: SessionParticipant[];
  guest_participants?: GuestParticipant[];
  teams?: Team[];
  session_organizers?: SessionOrganizer[];
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  joined_at: string;
  games_played: number;
  user: {
    id: string;
    name: string;
    email: string;
    profile_image?: string;
    gender?: 'male' | 'female' | 'other';
    skill_level?: number;
  };
}

export interface GuestParticipant {
  id: string;
  session_id: string;
  name: string;
  gender: 'male' | 'female';
  skill_level: number;
  age_group: '10s' | '20s' | '30s' | '40s' | '50s' | '60s';
  joined_at: string;
  games_played: number;
}

export interface Team {
  id: string;
  session_id: string;
  team_number: number;
  court_number?: number;
  status: 'waiting' | 'playing' | 'finished';
  created_at: string;
  team_members?: TeamMember[];
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  user: {
    id: string;
    name: string;
    profile_image?: string;
    gender?: 'male' | 'female' | 'other';
    skill_level?: number;
  };
}

export interface Game {
  id: string;
  session_id: string;
  court_number: number;
  team1_id: string;
  team2_id: string;
  status: 'in_progress' | 'completed';
  started_at: string;
  completed_at?: string;
}

export interface CreateSessionData {
  name: string;
  venue_name: string;
  session_date: string;
  max_participants: number;
  court_count: number;
}

export interface JoinSessionData {
  access_code: string;
}

export interface GuestJoinSessionData {
  access_code: string;
  name: string;
  gender: 'male' | 'female';
  skill_level: number;
  age_group: '10s' | '20s' | '30s' | '40s' | '50s' | '60s';
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  profile_image?: string;
  gender?: 'male' | 'female' | 'other';
  skill_level?: number;
  phone?: string;
}

export interface CourtRow {
  id: string;
  session_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface BoardGameRow {
  id: string;
  session_id: string;
  court_id: string | null;
  player_ids: [string, string, string, string];
  status: 'queued' | 'playing' | 'completed';
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface BoardPlayerStateRow {
  id: string;
  session_id: string;
  session_participant_id: string | null;
  guest_participant_id: string | null;
  attending: boolean;
  player_status: 'active' | 'resting' | 'playing' | 'queued';
  pinned: boolean;
  waiting_since: string | null;
}
