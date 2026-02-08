-- Migration 005: Gamification System
-- Tables for badges, levels, progress tracking, and leaderboards

-- User badges/achievements
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL,
  badge_name TEXT,
  badge_description TEXT,
  earned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, badge_type)
);

-- User levels (derived from XP)
CREATE TABLE IF NOT EXISTS user_levels (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  level INT DEFAULT 1,
  xp INT DEFAULT 0,
  next_level_xp INT DEFAULT 100,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Chapter progress tracking
CREATE TABLE IF NOT EXISTS chapter_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  book_id UUID REFERENCES course_books(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  paragraphs_completed INT DEFAULT 0,
  total_paragraphs INT,
  mastered_concepts INT DEFAULT 0,
  total_concepts INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, chapter_id)
);

-- Difficulty tracking per subject/chapter
CREATE TABLE IF NOT EXISTS difficulty_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  got_it_count INT DEFAULT 0,
  confused_count INT DEFAULT 0,
  difficulty_level TEXT DEFAULT 'medium',
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, chapter_id)
);

-- Test sessions
CREATE TABLE IF NOT EXISTS test_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  book_id UUID REFERENCES course_books(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  score DECIMAL(5,2),
  total_questions INT,
  correct_answers INT,
  weak_concepts JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Individual test questions
CREATE TABLE IF NOT EXISTS test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES test_sessions(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  user_answer TEXT,
  is_correct BOOLEAN,
  concept TEXT,
  options JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Leaderboard materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS leaderboard AS
SELECT 
  p.id,
  p.email,
  COALESCE(ul.level, 1) as level,
  COALESCE(ul.xp, 0) as xp,
  COUNT(DISTINCT ub.badge_type) as badge_count
FROM profiles p
LEFT JOIN user_levels ul ON p.id = ul.user_id
LEFT JOIN user_badges ub ON p.id = ub.user_id
GROUP BY p.id, p.email, ul.level, ul.xp
ORDER BY ul.xp DESC, ul.level DESC
LIMIT 100;

-- Enable RLS
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE difficulty_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_badges
CREATE POLICY "Users can view own badges" ON user_badges 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage badges" ON user_badges 
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for user_levels
CREATE POLICY "Users can view own level" ON user_levels 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage levels" ON user_levels 
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for chapter_progress
CREATE POLICY "Users can view own progress" ON chapter_progress 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage progress" ON chapter_progress 
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for difficulty_tracking
CREATE POLICY "Users can view own difficulty" ON difficulty_tracking 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage difficulty" ON difficulty_tracking 
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for test_sessions
CREATE POLICY "Users can view own test sessions" ON test_sessions 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage test sessions" ON test_sessions 
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for test_questions
CREATE POLICY "Users can view own test questions" ON test_questions 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM test_sessions 
      WHERE test_sessions.id = test_questions.session_id 
      AND test_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage test questions" ON test_questions 
  FOR ALL USING (auth.role() = 'service_role');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_chapter_progress_user ON chapter_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_difficulty_tracking_user ON difficulty_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_user ON test_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_test_questions_session ON test_questions(session_id);
