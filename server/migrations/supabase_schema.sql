-- =============================================================================
-- LilyBeta: Supabase / PostgreSQL Production Schema & Comprehensive RLS Policies
-- Domain target: beta.lilyhub.top
--
-- Execution Order:
-- 1. CREATE EXTENSION & TABLES (in strict foreign key dependency order)
-- 2. CREATE INDEXES
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- 4. CREATE RLS POLICIES (safe because all referenced tables already exist)
-- =============================================================================

-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- 1.1 Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'BETA_READER')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.2 Beta Books
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

-- 1.3 Beta Chapters
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

-- 1.4 Beta Assignments (Supports multi-assignment per book)
CREATE TABLE IF NOT EXISTS public.beta_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.beta_books(id) ON DELETE CASCADE,
  beta_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'COMPLETED', 'REVOKED')),
  UNIQUE(book_id, beta_user_id)
);

-- 1.5 Beta Assignment Progress (Overall book reading position & completion count)
CREATE TABLE IF NOT EXISTS public.beta_assignment_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.beta_assignments(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.beta_books(id) ON DELETE CASCADE,
  beta_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_chapter_index INTEGER NOT NULL DEFAULT 1,
  overall_percentage REAL NOT NULL DEFAULT 0,
  completed_chapters_count INTEGER NOT NULL DEFAULT 0,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(book_id, beta_user_id)
);

-- 1.6 Beta Chapter Status (Individual chapter workflow lifecycle)
CREATE TABLE IF NOT EXISTS public.beta_chapter_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.beta_assignments(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.beta_books(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.beta_chapters(id) ON DELETE CASCADE,
  chapter_index INTEGER NOT NULL,
  beta_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED', 'IN_PROGRESS', 'READY', 'COMPLETED')),
  started_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_scroll_percent REAL NOT NULL DEFAULT 0,
  last_scroll_offset REAL NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assignment_id, chapter_index)
);

-- 1.7 Beta Activity Logs
CREATE TABLE IF NOT EXISTS public.beta_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  book_id UUID,
  chapter_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.8 Phase 3 Tables: Edits, Revisions, Notes
CREATE TABLE IF NOT EXISTS public.beta_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.beta_books(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.beta_chapters(id) ON DELETE CASCADE,
  beta_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  paragraph_index INTEGER NOT NULL,
  original_text TEXT NOT NULL,
  proposed_text TEXT NOT NULL,
  error_type TEXT DEFAULT 'OTHER' CHECK(error_type IN ('TYPO', 'GRAMMAR', 'TRANSLATION', 'TERMINOLOGY', 'FORMATTING', 'OTHER')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.beta_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edit_id UUID NOT NULL REFERENCES public.beta_edits(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id),
  comment TEXT,
  status TEXT NOT NULL CHECK(status IN ('ACCEPTED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.beta_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.beta_books(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.beta_chapters(id) ON DELETE CASCADE,
  beta_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  paragraph_index INTEGER NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 2. INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_beta_books_status ON public.beta_books(status);
CREATE INDEX IF NOT EXISTS idx_beta_chapters_book_idx ON public.beta_chapters(book_id, chapter_index);
CREATE INDEX IF NOT EXISTS idx_beta_assignments_user_status ON public.beta_assignments(beta_user_id, status);
CREATE INDEX IF NOT EXISTS idx_beta_assignments_book_status ON public.beta_assignments(book_id, status);
CREATE INDEX IF NOT EXISTS idx_beta_assignment_progress_user ON public.beta_assignment_progress(beta_user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_beta_chapter_status_assign ON public.beta_chapter_status(assignment_id, chapter_index);
CREATE INDEX IF NOT EXISTS idx_beta_activity_user ON public.beta_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_edits_chapter ON public.beta_edits(chapter_id, paragraph_index);
CREATE INDEX IF NOT EXISTS idx_beta_edits_book_user ON public.beta_edits(book_id, beta_user_id, status);
CREATE INDEX IF NOT EXISTS idx_beta_revisions_edit ON public.beta_revisions(edit_id);
CREATE INDEX IF NOT EXISTS idx_beta_notes_chapter ON public.beta_notes(chapter_id, paragraph_index);

-- =============================================================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_assignment_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_chapter_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_notes ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- 4.1 Profiles Policies
CREATE POLICY "Admins full access to profiles"
  ON public.profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE));

CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() AND is_active = TRUE);

-- 4.2 Beta Books Policies
CREATE POLICY "Admins full access to beta_books"
  ON public.beta_books FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE));

CREATE POLICY "Beta Readers view only actively assigned books"
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

-- 4.3 Beta Chapters Policies
CREATE POLICY "Admins full access to beta_chapters"
  ON public.beta_chapters FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE));

CREATE POLICY "Beta Readers view only chapters of actively assigned books"
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

-- 4.4 Beta Assignments Policies
CREATE POLICY "Admins full access to beta_assignments"
  ON public.beta_assignments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE));

CREATE POLICY "Beta Readers view own assignments"
  ON public.beta_assignments FOR SELECT
  USING (beta_user_id = auth.uid());

-- 4.5 Beta Assignment Progress Policies (Strict Active Assignment Validation)
CREATE POLICY "Admins full access to beta_assignment_progress"
  ON public.beta_assignment_progress FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE));

CREATE POLICY "Beta Readers manage progress only on actively assigned books"
  ON public.beta_assignment_progress FOR ALL
  USING (
    beta_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.beta_assignments
      WHERE beta_assignments.id = public.beta_assignment_progress.assignment_id
        AND beta_assignments.book_id = public.beta_assignment_progress.book_id
        AND beta_assignments.beta_user_id = auth.uid()
        AND beta_assignments.status = 'ACTIVE'
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE)
  )
  WITH CHECK (
    beta_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.beta_assignments
      WHERE beta_assignments.id = public.beta_assignment_progress.assignment_id
        AND beta_assignments.book_id = public.beta_assignment_progress.book_id
        AND beta_assignments.beta_user_id = auth.uid()
        AND beta_assignments.status = 'ACTIVE'
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE)
  );

-- 4.6 Beta Chapter Status Policies (Strict Chapter & Assignment Integrity)
CREATE POLICY "Admins full access to beta_chapter_status"
  ON public.beta_chapter_status FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE));

CREATE POLICY "Beta Readers manage chapter status only for active assignment"
  ON public.beta_chapter_status FOR ALL
  USING (
    beta_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.beta_assignments
      WHERE beta_assignments.id = public.beta_chapter_status.assignment_id
        AND beta_assignments.book_id = public.beta_chapter_status.book_id
        AND beta_assignments.beta_user_id = auth.uid()
        AND beta_assignments.status = 'ACTIVE'
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE)
  )
  WITH CHECK (
    beta_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.beta_assignments
      WHERE beta_assignments.id = public.beta_chapter_status.assignment_id
        AND beta_assignments.book_id = public.beta_chapter_status.book_id
        AND beta_assignments.beta_user_id = auth.uid()
        AND beta_assignments.status = 'ACTIVE'
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE)
    AND (
      chapter_id IS NULL OR EXISTS (
        SELECT 1 FROM public.beta_chapters
        WHERE beta_chapters.id = public.beta_chapter_status.chapter_id
          AND beta_chapters.book_id = public.beta_chapter_status.book_id
      )
    )
  );

-- 4.7 Beta Activity Logs Policies
CREATE POLICY "Admins view all activity logs"
  ON public.beta_activity_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE));

CREATE POLICY "Users insert own activity logs"
  ON public.beta_activity_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 4.8 Beta Edits Policies (Audited Phase 3 Edit Workflow)
CREATE POLICY "Admins full access to beta_edits"
  ON public.beta_edits FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE));

CREATE POLICY "Beta Readers propose edits on assigned chapters"
  ON public.beta_edits FOR INSERT
  WITH CHECK (
    beta_user_id = auth.uid()
    AND status = 'PENDING'
    AND EXISTS (
      SELECT 1 FROM public.beta_assignments
      WHERE beta_assignments.book_id = public.beta_edits.book_id
        AND beta_assignments.beta_user_id = auth.uid()
        AND beta_assignments.status = 'ACTIVE'
    )
    AND EXISTS (
      SELECT 1 FROM public.beta_chapters
      WHERE beta_chapters.id = public.beta_edits.chapter_id
        AND beta_chapters.book_id = public.beta_edits.book_id
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Beta Readers view own edits on assigned books"
  ON public.beta_edits FOR SELECT
  USING (
    beta_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.beta_assignments
      WHERE beta_assignments.book_id = public.beta_edits.book_id
        AND beta_assignments.beta_user_id = auth.uid()
        AND beta_assignments.status = 'ACTIVE'
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Beta Readers update own pending edits"
  ON public.beta_edits FOR UPDATE
  USING (
    beta_user_id = auth.uid()
    AND status = 'PENDING'
    AND EXISTS (
      SELECT 1 FROM public.beta_assignments
      WHERE beta_assignments.book_id = public.beta_edits.book_id
        AND beta_assignments.beta_user_id = auth.uid()
        AND beta_assignments.status = 'ACTIVE'
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE)
  )
  WITH CHECK (
    beta_user_id = auth.uid()
    AND status = 'PENDING'
    AND EXISTS (
      SELECT 1 FROM public.beta_assignments
      WHERE beta_assignments.book_id = public.beta_edits.book_id
        AND beta_assignments.beta_user_id = auth.uid()
        AND beta_assignments.status = 'ACTIVE'
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Beta Readers delete own pending edits"
  ON public.beta_edits FOR DELETE
  USING (
    beta_user_id = auth.uid()
    AND status = 'PENDING'
    AND EXISTS (
      SELECT 1 FROM public.beta_assignments
      WHERE beta_assignments.book_id = public.beta_edits.book_id
        AND beta_assignments.beta_user_id = auth.uid()
        AND beta_assignments.status = 'ACTIVE'
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE)
  );

-- 4.9 Beta Notes Policies (Audited Paragraph Notes)
CREATE POLICY "Admins full access to beta_notes"
  ON public.beta_notes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE));

CREATE POLICY "Beta Readers insert notes on assigned chapters"
  ON public.beta_notes FOR INSERT
  WITH CHECK (
    beta_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.beta_assignments
      WHERE beta_assignments.book_id = public.beta_notes.book_id
        AND beta_assignments.beta_user_id = auth.uid()
        AND beta_assignments.status = 'ACTIVE'
    )
    AND EXISTS (
      SELECT 1 FROM public.beta_chapters
      WHERE beta_chapters.id = public.beta_notes.chapter_id
        AND beta_chapters.book_id = public.beta_notes.book_id
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Beta Readers view own notes on assigned books"
  ON public.beta_notes FOR SELECT
  USING (
    beta_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.beta_assignments
      WHERE beta_assignments.book_id = public.beta_notes.book_id
        AND beta_assignments.beta_user_id = auth.uid()
        AND beta_assignments.status = 'ACTIVE'
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Beta Readers update own notes"
  ON public.beta_notes FOR UPDATE
  USING (
    beta_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.beta_assignments
      WHERE beta_assignments.book_id = public.beta_notes.book_id
        AND beta_assignments.beta_user_id = auth.uid()
        AND beta_assignments.status = 'ACTIVE'
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE)
  )
  WITH CHECK (
    beta_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.beta_assignments
      WHERE beta_assignments.book_id = public.beta_notes.book_id
        AND beta_assignments.beta_user_id = auth.uid()
        AND beta_assignments.status = 'ACTIVE'
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Beta Readers delete own notes"
  ON public.beta_notes FOR DELETE
  USING (
    beta_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.beta_assignments
      WHERE beta_assignments.book_id = public.beta_notes.book_id
        AND beta_assignments.beta_user_id = auth.uid()
        AND beta_assignments.status = 'ACTIVE'
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE)
  );

-- 4.10 Beta Revisions Policies (Review Workflow)
CREATE POLICY "Admins full access to beta_revisions"
  ON public.beta_revisions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE));

CREATE POLICY "Beta Readers view review decisions on own edits"
  ON public.beta_revisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.beta_edits
      WHERE beta_edits.id = public.beta_revisions.edit_id
        AND beta_edits.beta_user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE)
  );
