-- LilyBeta Phase 1: Supabase / PostgreSQL Schema with RLS Policies
-- Domain target: beta.lilyhub.top

-- 1. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'BETA_READER')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE));

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() AND is_active = TRUE);

CREATE POLICY "Admins can insert or update profiles"
  ON public.profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE));

-- 2. Beta Books
CREATE TABLE IF NOT EXISTS public.beta_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  cover_url TEXT,
  cover_color TEXT DEFAULT '#D9829B',
  original_file_name TEXT NOT NULL,
  file_format TEXT NOT NULL CHECK(file_format IN ('TXT', 'EPUB', 'DOCX')),
  total_chapters INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'ASSIGNED', 'IN_BETA', 'BETA_COMPLETE', 'ARCHIVED')),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.beta_books ENABLE ROW LEVEL SECURITY;

-- Beta Books Policies:
-- Admins: can do everything.
CREATE POLICY "Admins full access to beta_books"
  ON public.beta_books FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE));

-- Beta Readers: can only SELECT books assigned to them!
CREATE POLICY "Beta Readers can only view assigned books"
  ON public.beta_books FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.beta_assignments
      WHERE beta_assignments.book_id = public.beta_books.id
        AND beta_assignments.beta_user_id = auth.uid()
        AND beta_assignments.status = 'ACTIVE'
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE)
  );

-- 3. Beta Chapters
CREATE TABLE IF NOT EXISTS public.beta_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.beta_books(id) ON DELETE CASCADE,
  chapter_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  paragraphs JSONB NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(book_id, chapter_index)
);

ALTER TABLE public.beta_chapters ENABLE ROW LEVEL SECURITY;

-- Beta Chapters Policies:
-- Admins: full access
CREATE POLICY "Admins full access to beta_chapters"
  ON public.beta_chapters FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE));

-- Beta Readers: can only SELECT chapters belonging to books assigned to them!
CREATE POLICY "Beta Readers can only view assigned chapters"
  ON public.beta_chapters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.beta_assignments
      WHERE beta_assignments.book_id = public.beta_chapters.book_id
        AND beta_assignments.beta_user_id = auth.uid()
        AND beta_assignments.status = 'ACTIVE'
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE)
  );

-- 4. Beta Assignments
CREATE TABLE IF NOT EXISTS public.beta_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.beta_books(id) ON DELETE CASCADE,
  beta_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'COMPLETED', 'REVOKED')),
  UNIQUE(book_id, beta_user_id)
);

ALTER TABLE public.beta_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to beta_assignments"
  ON public.beta_assignments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE));

CREATE POLICY "Beta Readers can view own assignments"
  ON public.beta_assignments FOR SELECT
  USING (beta_user_id = auth.uid());

-- 5. Beta Chapter Progress
CREATE TABLE IF NOT EXISTS public.beta_chapter_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.beta_assignments(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.beta_books(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.beta_chapters(id) ON DELETE CASCADE,
  beta_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK(status IN ('NOT_STARTED', 'IN_PROGRESS', 'READY', 'COMPLETED')),
  chapter_index INTEGER NOT NULL DEFAULT 1,
  scroll_percent REAL DEFAULT 0,
  scroll_offset REAL DEFAULT 0,
  percentage REAL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(book_id, beta_user_id)
);

ALTER TABLE public.beta_chapter_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to beta_chapter_progress"
  ON public.beta_chapter_progress FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE));

CREATE POLICY "Beta Readers manage own progress"
  ON public.beta_chapter_progress FOR ALL
  USING (beta_user_id = auth.uid());

-- 6. Beta Activity Logs
CREATE TABLE IF NOT EXISTS public.beta_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  book_id UUID,
  chapter_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.beta_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view activity logs"
  ON public.beta_activity_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE));

CREATE POLICY "Authenticated users can insert activity logs"
  ON public.beta_activity_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());
