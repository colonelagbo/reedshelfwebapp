-- ============================================================================
-- REEDSHELF SUPABASE POSTGRESQL SCHEMA & ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- 1. Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  avatar TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. BOOKS TABLE
CREATE TABLE IF NOT EXISTS public.books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  file_name TEXT NOT NULL,
  file_type TEXT DEFAULT 'application/pdf',
  file_size BIGINT DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  uploaded_by TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  cover_data_url TEXT,
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. READING PROGRESS TABLE
CREATE TABLE IF NOT EXISTS public.reading_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  page INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_book_progress UNIQUE(user_id, book_id)
);

-- 5. READING PLANS TABLE
CREATE TABLE IF NOT EXISTS public.reading_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  start_date TIMESTAMPTZ NOT NULL,
  target_date TIMESTAMPTZ NOT NULL,
  days INTEGER NOT NULL,
  pages_per_day INTEGER NOT NULL,
  total_pages INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. HIGHLIGHTS TABLE
CREATE TABLE IF NOT EXISTS public.highlights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  text TEXT NOT NULL,
  color TEXT DEFAULT '#ffd24c',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. USER SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  dark_mode INTEGER DEFAULT 0,
  library_view TEXT DEFAULT 'grid',
  font_size INTEGER DEFAULT 18,
  line_height REAL DEFAULT 1.75,
  reader_width TEXT DEFAULT 'medium',
  auto_save INTEGER DEFAULT 1,
  show_page_numbers INTEGER DEFAULT 1,
  confirm_sign_out INTEGER DEFAULT 1,
  keyboard_shortcuts INTEGER DEFAULT 1,
  default_highlight_color TEXT DEFAULT '#ffd24c',
  reduced_motion INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. ADMIN SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. ADMIN AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  target_email TEXT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. READING ACTIVITY TABLE
CREATE TABLE IF NOT EXISTS public.reading_activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  action TEXT DEFAULT 'read',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR OPTIMAL QUERY PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_books_uploaded_by ON public.books(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_progress_user_book ON public.reading_progress(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_plans_user ON public.reading_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user_book ON public.highlights(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.reading_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- ============================================================================
-- SEED DEFAULT SETTINGS
-- ============================================================================
INSERT INTO public.admin_settings (key, value, updated_at)
VALUES 
  ('storage_limit_gb', '100', NOW()),
  ('allow_registrations', 'true', NOW()),
  ('max_upload_size_mb', '100', NOW())
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_activity ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if current auth user is an administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()::text AND role = 'admin' AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users policies
CREATE POLICY "Users can view their own profile or admins can view all"
  ON public.users FOR SELECT
  USING (auth.uid()::text = id OR public.is_admin());

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid()::text = id)
  WITH CHECK (
    (auth.uid()::text = id AND role = (SELECT role FROM public.users WHERE id = auth.uid()::text))
    OR public.is_admin()
  );

-- Books policies
CREATE POLICY "Users can manage their own books or admins can view all"
  ON public.books FOR SELECT
  USING (uploaded_by = auth.uid()::text OR public.is_admin());

CREATE POLICY "Users can insert their own books"
  ON public.books FOR INSERT
  WITH CHECK (uploaded_by = auth.uid()::text);

CREATE POLICY "Users can update their own books"
  ON public.books FOR UPDATE
  USING (uploaded_by = auth.uid()::text OR public.is_admin());

CREATE POLICY "Users can delete their own books or admins can delete"
  ON public.books FOR DELETE
  USING (uploaded_by = auth.uid()::text OR public.is_admin());

-- Admin Settings policies
CREATE POLICY "Admins only can view admin settings"
  ON public.admin_settings FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins only can modify admin settings"
  ON public.admin_settings FOR ALL
  USING (public.is_admin());

-- Admin Audit Logs policies
CREATE POLICY "Admins only can view audit logs"
  ON public.admin_audit_logs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins only can insert audit logs"
  ON public.admin_audit_logs FOR INSERT
  WITH CHECK (public.is_admin());
