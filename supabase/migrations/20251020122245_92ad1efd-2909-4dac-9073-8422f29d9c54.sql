-- Create enum for player roles
CREATE TYPE player_role AS ENUM ('P', 'D', 'C', 'A');

-- Create enum for auction order
CREATE TYPE auction_order AS ENUM ('alphabetical', 'random');

-- Sessions table
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code text UNIQUE NOT NULL,
  admin_id uuid NOT NULL,
  num_participants integer NOT NULL CHECK (num_participants >= 6 AND num_participants <= 12),
  budget_per_participant integer NOT NULL CHECK (budget_per_participant IN (500, 1000)),
  auction_order auction_order NOT NULL DEFAULT 'alphabetical',
  starting_letter text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Participants table
CREATE TABLE participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  nickname text NOT NULL,
  credits integer NOT NULL,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, nickname),
  UNIQUE(session_id, position)
);

-- Players table (539 giocatori)
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  team text NOT NULL,
  role player_role NOT NULL,
  fvm_value integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Selected players for auction
CREATE TABLE selected_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, player_id)
);

-- Assigned players
CREATE TABLE assigned_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  participant_id uuid REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  price integer NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  assignment_order integer NOT NULL,
  UNIQUE(session_id, player_id)
);

-- Current player being auctioned
CREATE TABLE current_player (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE UNIQUE NOT NULL,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE selected_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE assigned_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_player ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sessions
CREATE POLICY "Anyone can read sessions" ON sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can create sessions" ON sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can update their sessions" ON sessions FOR UPDATE USING (admin_id = auth.uid());

-- RLS Policies for participants
CREATE POLICY "Anyone can read participants" ON participants FOR SELECT USING (true);
CREATE POLICY "Anyone can create participants" ON participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own participant" ON participants FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for players (read-only for all)
CREATE POLICY "Anyone can read players" ON players FOR SELECT USING (true);

-- RLS Policies for selected_players
CREATE POLICY "Anyone can read selected players" ON selected_players FOR SELECT USING (true);
CREATE POLICY "Session admin can manage selected players" ON selected_players FOR ALL USING (
  EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_id AND sessions.admin_id = auth.uid())
);

-- RLS Policies for assigned_players
CREATE POLICY "Anyone can read assigned players" ON assigned_players FOR SELECT USING (true);
CREATE POLICY "Session admin can manage assigned players" ON assigned_players FOR ALL USING (
  EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_id AND sessions.admin_id = auth.uid())
);

-- RLS Policies for current_player
CREATE POLICY "Anyone can read current player" ON current_player FOR SELECT USING (true);
CREATE POLICY "Session admin can manage current player" ON current_player FOR ALL USING (
  EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_id AND sessions.admin_id = auth.uid())
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
ALTER PUBLICATION supabase_realtime ADD TABLE selected_players;
ALTER PUBLICATION supabase_realtime ADD TABLE assigned_players;
ALTER PUBLICATION supabase_realtime ADD TABLE current_player;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_current_player_updated_at BEFORE UPDATE ON current_player
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();