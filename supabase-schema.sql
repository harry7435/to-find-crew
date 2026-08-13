-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extended for badminton features)
CREATE TABLE users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  profile_image TEXT,
  bio TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'kakao', 'email')),
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  skill_level INTEGER DEFAULT 1 CHECK (skill_level BETWEEN 1 AND 5),
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crews table
CREATE TABLE crews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  profile_image TEXT,
  location TEXT NOT NULL,
  max_members INTEGER NOT NULL DEFAULT 50,
  current_members INTEGER NOT NULL DEFAULT 1,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crew members table
CREATE TABLE crew_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, crew_id)
);

-- Meetings table
CREATE TABLE meetings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  max_participants INTEGER NOT NULL DEFAULT 20,
  current_participants INTEGER NOT NULL DEFAULT 1,
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meeting participants table
CREATE TABLE meeting_participants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, meeting_id)
);

-- Messages table
CREATE TABLE messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content TEXT NOT NULL,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Badminton sessions table
CREATE TABLE badminton_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  session_date TIMESTAMP WITH TIME ZONE NOT NULL,
  max_participants INTEGER NOT NULL DEFAULT 20,
  access_code TEXT NOT NULL,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  court_count INTEGER DEFAULT 1,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(access_code)
);

-- Session participants table
CREATE TABLE session_participants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES badminton_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  games_played INTEGER DEFAULT 0,
  UNIQUE(session_id, user_id)
);

-- Guest participants table (for non-authenticated users)
CREATE TABLE guest_participants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES badminton_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  skill_level INTEGER NOT NULL CHECK (skill_level BETWEEN 0 AND 5),
  age_group TEXT NOT NULL CHECK (age_group IN ('10s', '20s', '30s', '40s', '50s', '60s')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  games_played INTEGER DEFAULT 0
);

-- Teams table for badminton sessions
CREATE TABLE teams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES badminton_sessions(id) ON DELETE CASCADE,
  team_number INTEGER NOT NULL,
  court_number INTEGER,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team members table
CREATE TABLE team_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(team_id, user_id)
);

-- Games table for tracking badminton games
CREATE TABLE games (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES badminton_sessions(id) ON DELETE CASCADE,
  court_number INTEGER NOT NULL,
  team1_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  team2_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_crews_category ON crews(category);
CREATE INDEX idx_crews_location ON crews(location);
CREATE INDEX idx_crew_members_user_id ON crew_members(user_id);
CREATE INDEX idx_crew_members_crew_id ON crew_members(crew_id);
CREATE INDEX idx_meetings_crew_id ON meetings(crew_id);
CREATE INDEX idx_meetings_start_date ON meetings(start_date);
CREATE INDEX idx_meeting_participants_meeting_id ON meeting_participants(meeting_id);
CREATE INDEX idx_messages_crew_id ON messages(crew_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Badminton-specific indexes
CREATE INDEX idx_badminton_sessions_access_code ON badminton_sessions(access_code);
CREATE INDEX idx_badminton_sessions_creator_id ON badminton_sessions(creator_id);
CREATE INDEX idx_badminton_sessions_session_date ON badminton_sessions(session_date);
CREATE INDEX idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX idx_session_participants_user_id ON session_participants(user_id);
CREATE INDEX idx_guest_participants_session_id ON guest_participants(session_id);
CREATE INDEX idx_teams_session_id ON teams(session_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_games_session_id ON games(session_id);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Enable RLS for badminton tables
ALTER TABLE badminton_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Users can read all users
CREATE POLICY "Users can read all users" ON users FOR SELECT USING (true);

-- Users can update their own profile (when authenticated)
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = id::text
);

-- Users can insert their own profile (when authenticated)
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = id::text
);

-- For development/testing: Allow all operations on users (REMOVE IN PRODUCTION)
CREATE POLICY "Allow all operations for development" ON users FOR ALL USING (true);

-- Crews can be read by everyone
CREATE POLICY "Crews can be read by everyone" ON crews FOR SELECT USING (true);

-- Only crew creators can update crews
CREATE POLICY "Only crew creators can update crews" ON crews FOR UPDATE USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = creator_id::text
);

-- Only crew creators can delete crews
CREATE POLICY "Only crew creators can delete crews" ON crews FOR DELETE USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = creator_id::text
);

-- Anyone can create crews
CREATE POLICY "Anyone can create crews" ON crews FOR INSERT WITH CHECK (true);

-- Crew members can be read by everyone
CREATE POLICY "Crew members can be read by everyone" ON crew_members FOR SELECT USING (true);

-- Only crew owners/admins can manage crew members
CREATE POLICY "Only crew owners/admins can manage crew members" ON crew_members FOR ALL USING (
  EXISTS (
    SELECT 1 FROM crew_members cm 
    WHERE cm.crew_id = crew_members.crew_id 
    AND cm.user_id::text = auth.uid()::text
    AND cm.role IN ('OWNER', 'ADMIN')
  )
);

-- Users can join crews themselves
CREATE POLICY "Users can join crews themselves" ON crew_members FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text
);

-- Meetings can be read by everyone
CREATE POLICY "Meetings can be read by everyone" ON meetings FOR SELECT USING (true);

-- Only meeting creators can update/delete meetings
CREATE POLICY "Only meeting creators can update meetings" ON meetings FOR UPDATE USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = creator_id::text
);
CREATE POLICY "Only meeting creators can delete meetings" ON meetings FOR DELETE USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = creator_id::text
);

-- Anyone can create meetings
CREATE POLICY "Anyone can create meetings" ON meetings FOR INSERT WITH CHECK (true);

-- Meeting participants can be read by everyone
CREATE POLICY "Meeting participants can be read by everyone" ON meeting_participants FOR SELECT USING (true);

-- Users can join meetings themselves
CREATE POLICY "Users can join meetings themselves" ON meeting_participants FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text
);

-- Users can leave meetings themselves
CREATE POLICY "Users can leave meetings themselves" ON meeting_participants FOR DELETE USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text
);

-- Messages can be read by crew members
CREATE POLICY "Messages can be read by crew members" ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crew_members cm 
    WHERE cm.crew_id = messages.crew_id 
    AND cm.user_id::text = auth.uid()::text
  )
);

-- Users can send messages to crews they're members of
CREATE POLICY "Users can send messages to crews they're members of" ON messages FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  auth.uid()::text = sender_id::text AND
  EXISTS (
    SELECT 1 FROM crew_members cm 
    WHERE cm.crew_id = messages.crew_id 
    AND cm.user_id::text = auth.uid()::text
  )
);

-- Badminton sessions RLS policies
-- Anyone can read badminton sessions
CREATE POLICY "Anyone can read badminton sessions" ON badminton_sessions FOR SELECT USING (true);

-- Anyone can create badminton sessions
CREATE POLICY "Anyone can create badminton sessions" ON badminton_sessions FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = creator_id::text
);

-- Only session creators can update their sessions
CREATE POLICY "Only session creators can update sessions" ON badminton_sessions FOR UPDATE USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = creator_id::text
);

-- Only session creators can delete their sessions
CREATE POLICY "Only session creators can delete sessions" ON badminton_sessions FOR DELETE USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = creator_id::text
);

-- Session participants policies
-- Anyone can read session participants
CREATE POLICY "Anyone can read session participants" ON session_participants FOR SELECT USING (true);

-- Users can join sessions themselves
CREATE POLICY "Users can join sessions themselves" ON session_participants FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text
);

-- Users can leave sessions themselves
CREATE POLICY "Users can leave sessions themselves" ON session_participants FOR DELETE USING (
  auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text
);

-- Session creators can manage participants
CREATE POLICY "Session creators can manage participants" ON session_participants FOR ALL USING (
  EXISTS (
    SELECT 1 FROM badminton_sessions bs
    WHERE bs.id = session_participants.session_id
    AND bs.creator_id::text = auth.uid()::text
  )
);

-- Guest participants policies
-- Anyone can read guest participants
CREATE POLICY "Anyone can read guest participants" ON guest_participants FOR SELECT USING (true);

-- Anyone can add guest participants (no authentication required)
CREATE POLICY "Anyone can add guest participants" ON guest_participants FOR INSERT WITH CHECK (true);

-- Session creators can manage guest participants
CREATE POLICY "Session creators can manage guest participants" ON guest_participants FOR ALL USING (
  EXISTS (
    SELECT 1 FROM badminton_sessions bs
    WHERE bs.id = guest_participants.session_id
    AND bs.creator_id::text = auth.uid()::text
  )
);

-- Teams policies
-- Anyone can read teams
CREATE POLICY "Anyone can read teams" ON teams FOR SELECT USING (true);

-- Session creators can manage teams
CREATE POLICY "Session creators can manage teams" ON teams FOR ALL USING (
  EXISTS (
    SELECT 1 FROM badminton_sessions bs 
    WHERE bs.id = teams.session_id 
    AND bs.creator_id::text = auth.uid()::text
  )
);

-- Team members policies
-- Anyone can read team members
CREATE POLICY "Anyone can read team members" ON team_members FOR SELECT USING (true);

-- Session creators can manage team members
CREATE POLICY "Session creators can manage team members" ON team_members FOR ALL USING (
  EXISTS (
    SELECT 1 FROM badminton_sessions bs 
    JOIN teams t ON t.session_id = bs.id 
    WHERE t.id = team_members.team_id 
    AND bs.creator_id::text = auth.uid()::text
  )
);

-- Games policies
-- Anyone can read games
CREATE POLICY "Anyone can read games" ON games FOR SELECT USING (true);

-- Session creators can manage games
CREATE POLICY "Session creators can manage games" ON games FOR ALL USING (
  EXISTS (
    SELECT 1 FROM badminton_sessions bs 
    WHERE bs.id = games.session_id 
    AND bs.creator_id::text = auth.uid()::text
  )
);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crews_updated_at BEFORE UPDATE ON crews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_badminton_sessions_updated_at BEFORE UPDATE ON badminton_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update crew member count
CREATE OR REPLACE FUNCTION update_crew_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE crews SET current_members = current_members + 1 WHERE id = NEW.crew_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE crews SET current_members = current_members - 1 WHERE id = OLD.crew_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

-- Triggers for crew member count
CREATE TRIGGER update_crew_member_count_insert AFTER INSERT ON crew_members FOR EACH ROW EXECUTE FUNCTION update_crew_member_count();
CREATE TRIGGER update_crew_member_count_delete AFTER DELETE ON crew_members FOR EACH ROW EXECUTE FUNCTION update_crew_member_count();

-- Function to update meeting participant count
CREATE OR REPLACE FUNCTION update_meeting_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE meetings SET current_participants = current_participants + 1 WHERE id = NEW.meeting_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE meetings SET current_participants = current_participants - 1 WHERE id = OLD.meeting_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

-- Triggers for meeting participant count
CREATE TRIGGER update_meeting_participant_count_insert AFTER INSERT ON meeting_participants FOR EACH ROW EXECUTE FUNCTION update_meeting_participant_count();
CREATE TRIGGER update_meeting_participant_count_delete AFTER DELETE ON meeting_participants FOR EACH ROW EXECUTE FUNCTION update_meeting_participant_count();

-- ============================================================
-- Board persistence tables (배드민턴 보드 서버 영속화, additive only)
-- ============================================================

CREATE TABLE board_player_state (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES badminton_sessions(id) ON DELETE CASCADE,
  session_participant_id UUID REFERENCES session_participants(id) ON DELETE CASCADE,
  guest_participant_id UUID REFERENCES guest_participants(id) ON DELETE CASCADE,
  attending BOOLEAN NOT NULL DEFAULT false,
  player_status TEXT NOT NULL DEFAULT 'resting'
    CHECK (player_status IN ('active', 'resting', 'playing', 'queued')),
  pinned BOOLEAN NOT NULL DEFAULT false,
  waiting_since TIMESTAMP WITH TIME ZONE,
  CHECK (num_nonnulls(session_participant_id, guest_participant_id) = 1),
  UNIQUE (session_participant_id),
  UNIQUE (guest_participant_id)
);

CREATE TABLE courts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES badminton_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE board_games (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES badminton_sessions(id) ON DELETE CASCADE,
  court_id UUID REFERENCES courts(id) ON DELETE SET NULL,
  player_ids UUID[4] NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'playing', 'completed')),
  queued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_board_player_state_session_id ON board_player_state(session_id);
CREATE INDEX idx_courts_session_id ON courts(session_id);
CREATE INDEX idx_board_games_session_id ON board_games(session_id);
CREATE INDEX idx_board_games_court_id ON board_games(court_id);

ALTER TABLE board_player_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_games ENABLE ROW LEVEL SECURITY;

-- board_player_state: 누구나 읽기, 누구나 자기 상태 행 생성(추후 셀프 등록/셀프 토글 대비),
-- 수정/삭제는 세션 생성자만
CREATE POLICY "Anyone can read board player state" ON board_player_state FOR SELECT USING (true);
CREATE POLICY "Anyone can insert board player state" ON board_player_state FOR INSERT WITH CHECK (true);
CREATE POLICY "Session creators can update board player state" ON board_player_state FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM badminton_sessions bs
    WHERE bs.id = board_player_state.session_id
    AND bs.creator_id::text = auth.uid()::text
  )
);
CREATE POLICY "Session creators can delete board player state" ON board_player_state FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM badminton_sessions bs
    WHERE bs.id = board_player_state.session_id
    AND bs.creator_id::text = auth.uid()::text
  )
);

-- courts: 누구나 읽기, 세션 생성자만 쓰기
CREATE POLICY "Anyone can read courts" ON courts FOR SELECT USING (true);
CREATE POLICY "Session creators can manage courts" ON courts FOR ALL USING (
  EXISTS (
    SELECT 1 FROM badminton_sessions bs
    WHERE bs.id = courts.session_id
    AND bs.creator_id::text = auth.uid()::text
  )
);

-- board_games: 누구나 읽기, 세션 생성자만 쓰기
CREATE POLICY "Anyone can read board games" ON board_games FOR SELECT USING (true);
CREATE POLICY "Session creators can manage board games" ON board_games FOR ALL USING (
  EXISTS (
    SELECT 1 FROM badminton_sessions bs
    WHERE bs.id = board_games.session_id
    AND bs.creator_id::text = auth.uid()::text
  )
);

-- Realtime 활성화 (기본적으로 CREATE TABLE만으로는 postgres_changes가 브로드캐스트되지 않음)
ALTER PUBLICATION supabase_realtime ADD TABLE
  board_player_state, courts, board_games, guest_participants, session_participants;

-- DELETE 이벤트에도 session_id 등 전체 row가 실리도록 설정
-- (기본 REPLICA IDENTITY는 primary key만 old record에 포함시켜, session_id 필터가
--  DELETE 이벤트를 매칭하지 못해 실시간 반영이 안 되는 문제가 있었음)
ALTER TABLE board_player_state REPLICA IDENTITY FULL;
ALTER TABLE courts REPLICA IDENTITY FULL;
ALTER TABLE board_games REPLICA IDENTITY FULL;
ALTER TABLE guest_participants REPLICA IDENTITY FULL;
ALTER TABLE session_participants REPLICA IDENTITY FULL;

-- ============================================================
-- Multi-organizer support (세션 다중 운영진, additive only)
-- ============================================================

CREATE TABLE session_organizers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES badminton_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES users(id),
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, user_id)
);

CREATE INDEX idx_session_organizers_session_id ON session_organizers(session_id);

ALTER TABLE session_organizers ENABLE ROW LEVEL SECURITY;

-- 생성자 OR 운영진 여부를 하나의 함수로 통일
CREATE OR REPLACE FUNCTION is_session_organizer(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM badminton_sessions bs
    WHERE bs.id = p_session_id AND bs.creator_id::text = auth.uid()::text
  ) OR EXISTS (
    SELECT 1 FROM session_organizers so
    WHERE so.session_id = p_session_id AND so.user_id::text = auth.uid()::text
  );
$$;

-- 기존 "생성자만" 정책 10개를 "생성자 OR 운영진"으로 교체
-- (badminton_sessions의 DELETE 정책은 생성자 전용 유지, 변경하지 않음)

-- badminton_sessions UPDATE 정책의 WITH CHECK에서 "수정 전 creator_id"를 읽기 위한 헬퍼.
-- 정책이 자기 테이블을 직접 서브쿼리하면 재귀 문제가 생길 수 있어 STABLE 함수로 감싼다.
CREATE OR REPLACE FUNCTION session_creator_id(p_session_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT creator_id FROM badminton_sessions WHERE id = p_session_id;
$$;

DROP POLICY IF EXISTS "Only session creators can update sessions" ON badminton_sessions;
CREATE POLICY "Session organizers can update sessions" ON badminton_sessions
  FOR UPDATE
  USING (is_session_organizer(id))
  WITH CHECK (is_session_organizer(id) AND creator_id = session_creator_id(id));

DROP POLICY IF EXISTS "Session creators can manage participants" ON session_participants;
CREATE POLICY "Session organizers can manage participants" ON session_participants FOR ALL USING (
  is_session_organizer(session_id)
);

DROP POLICY IF EXISTS "Session creators can manage guest participants" ON guest_participants;
CREATE POLICY "Session organizers can manage guest participants" ON guest_participants FOR ALL USING (
  is_session_organizer(session_id)
);

DROP POLICY IF EXISTS "Session creators can manage teams" ON teams;
CREATE POLICY "Session organizers can manage teams" ON teams FOR ALL USING (
  is_session_organizer(session_id)
);

DROP POLICY IF EXISTS "Session creators can manage team members" ON team_members;
CREATE POLICY "Session organizers can manage team members" ON team_members FOR ALL USING (
  is_session_organizer((SELECT session_id FROM teams WHERE id = team_members.team_id))
);

DROP POLICY IF EXISTS "Session creators can manage games" ON games;
CREATE POLICY "Session organizers can manage games" ON games FOR ALL USING (
  is_session_organizer(session_id)
);

DROP POLICY IF EXISTS "Session creators can update board player state" ON board_player_state;
CREATE POLICY "Session organizers can update board player state" ON board_player_state FOR UPDATE USING (
  is_session_organizer(session_id)
);

DROP POLICY IF EXISTS "Session creators can delete board player state" ON board_player_state;
CREATE POLICY "Session organizers can delete board player state" ON board_player_state FOR DELETE USING (
  is_session_organizer(session_id)
);

DROP POLICY IF EXISTS "Session creators can manage courts" ON courts;
CREATE POLICY "Session organizers can manage courts" ON courts FOR ALL USING (
  is_session_organizer(session_id)
);

DROP POLICY IF EXISTS "Session creators can manage board games" ON board_games;
CREATE POLICY "Session organizers can manage board games" ON board_games FOR ALL USING (
  is_session_organizer(session_id)
);

-- session_organizers 자체의 RLS
CREATE POLICY "Anyone can read session organizers" ON session_organizers
  FOR SELECT USING (true);

CREATE POLICY "Organizers can grant organizer status" ON session_organizers
  FOR INSERT WITH CHECK (
    is_session_organizer(session_id)
    AND granted_by::text = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM session_participants sp
      WHERE sp.session_id = session_organizers.session_id
        AND sp.user_id = session_organizers.user_id
    )
  );

CREATE POLICY "Organizers can revoke organizer status" ON session_organizers
  FOR DELETE USING (is_session_organizer(session_id));

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE session_organizers;
ALTER TABLE session_organizers REPLICA IDENTITY FULL;
