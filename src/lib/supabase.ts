import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 클라이언트 사이드용 Supabase 인스턴스
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// 타입 정의
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          profile_image?: string;
          bio?: string;
          provider: 'google' | 'kakao' | 'email';
          gender?: 'male' | 'female' | 'other';
          skill_level?: number;
          phone?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          profile_image?: string;
          bio?: string;
          provider: 'google' | 'kakao' | 'email';
          gender?: 'male' | 'female' | 'other';
          skill_level?: number;
          phone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          profile_image?: string;
          bio?: string;
          provider?: 'google' | 'kakao' | 'email';
          gender?: 'male' | 'female' | 'other';
          skill_level?: number;
          phone?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      crews: {
        Row: {
          id: string;
          name: string;
          description: string;
          category: string;
          profile_image?: string;
          location: string;
          max_members: number;
          current_members: number;
          creator_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          category: string;
          profile_image?: string;
          location: string;
          max_members: number;
          current_members?: number;
          creator_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          category?: string;
          profile_image?: string;
          location?: string;
          max_members?: number;
          current_members?: number;
          creator_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      crew_members: {
        Row: {
          id: string;
          user_id: string;
          crew_id: string;
          role: 'OWNER' | 'ADMIN' | 'MEMBER';
          joined_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          crew_id: string;
          role?: 'OWNER' | 'ADMIN' | 'MEMBER';
          joined_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          crew_id?: string;
          role?: 'OWNER' | 'ADMIN' | 'MEMBER';
          joined_at?: string;
        };
      };
      meetings: {
        Row: {
          id: string;
          title: string;
          description: string;
          location: string;
          start_date: string;
          end_date: string;
          max_participants: number;
          current_participants: number;
          crew_id: string;
          creator_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          location: string;
          start_date: string;
          end_date: string;
          max_participants: number;
          current_participants?: number;
          crew_id: string;
          creator_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          location?: string;
          start_date?: string;
          end_date?: string;
          max_participants?: number;
          current_participants?: number;
          crew_id?: string;
          creator_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      meeting_participants: {
        Row: {
          id: string;
          user_id: string;
          meeting_id: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          meeting_id: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          meeting_id?: string;
          joined_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          content: string;
          sender_id: string;
          crew_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          content: string;
          sender_id: string;
          crew_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          content?: string;
          sender_id?: string;
          crew_id?: string;
          created_at?: string;
        };
      };
      badminton_sessions: {
        Row: {
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
        };
        Insert: {
          id?: string;
          name: string;
          venue_name: string;
          session_date: string;
          max_participants: number;
          access_code: string;
          creator_id: string;
          court_count?: number;
          status?: 'open' | 'in_progress' | 'completed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          venue_name?: string;
          session_date?: string;
          max_participants?: number;
          access_code?: string;
          creator_id?: string;
          court_count?: number;
          status?: 'open' | 'in_progress' | 'completed';
          created_at?: string;
          updated_at?: string;
        };
      };
      session_participants: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          joined_at: string;
          games_played: number;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          joined_at?: string;
          games_played?: number;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          joined_at?: string;
          games_played?: number;
        };
      };
      teams: {
        Row: {
          id: string;
          session_id: string;
          team_number: number;
          court_number?: number;
          status: 'waiting' | 'playing' | 'finished';
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          team_number: number;
          court_number?: number;
          status?: 'waiting' | 'playing' | 'finished';
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          team_number?: number;
          court_number?: number;
          status?: 'waiting' | 'playing' | 'finished';
          created_at?: string;
        };
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          user_id?: string;
        };
      };
      games: {
        Row: {
          id: string;
          session_id: string;
          court_number: number;
          team1_id: string;
          team2_id: string;
          status: 'in_progress' | 'completed';
          started_at: string;
          completed_at?: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          court_number: number;
          team1_id: string;
          team2_id: string;
          status?: 'in_progress' | 'completed';
          started_at?: string;
          completed_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          court_number?: number;
          team1_id?: string;
          team2_id?: string;
          status?: 'in_progress' | 'completed';
          started_at?: string;
          completed_at?: string;
        };
      };
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
