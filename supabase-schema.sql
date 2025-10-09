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
