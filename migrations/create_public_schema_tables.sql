-- Migration: Create public schema tables for website applications and posts
-- Run this in Supabase SQL Editor (as admin/owner)

-- ========================================
-- APPLICATIONS TABLE (public schema)
-- ========================================
CREATE TABLE IF NOT EXISTS public.applications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    student_full_name TEXT NOT NULL,
    gender TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    class_applying_for TEXT NOT NULL,
    former_school TEXT,
    district TEXT NOT NULL,
    subjects_and_grades JSONB,
    optional_subject JSONB,
    subject_combination TEXT,
    parent_guardian_full_name TEXT NOT NULL,
    parent_guardian_phone TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- POSTS TABLE (public schema) - for news/updates
-- ========================================
CREATE TABLE IF NOT EXISTS public.POSTS (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    media_type TEXT DEFAULT 'article',
    media_url TEXT,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- RLS POLICIES FOR APPLICATIONS
-- ========================================
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Anyone can view applications (public website access)
CREATE POLICY IF NOT EXISTS "Public can view applications" ON public.applications
    FOR SELECT USING (true);

-- Anyone can insert applications (public form submission)
CREATE POLICY IF NOT EXISTS "Public can insert applications" ON public.applications
    FOR INSERT WITH CHECK (true);

-- Authenticated users can update applications
CREATE POLICY IF NOT EXISTS "Authenticated can update applications" ON public.applications
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Authenticated users can delete applications
CREATE POLICY IF NOT EXISTS "Authenticated can delete applications" ON public.applications
    FOR DELETE USING (auth.role() = 'authenticated');

-- ========================================
-- RLS POLICIES FOR POSTS
-- ========================================
ALTER TABLE public.POSTS ENABLE ROW LEVEL SECURITY;

-- Anyone can view posts (public website access)
CREATE POLICY IF NOT EXISTS "Public can view posts" ON public.POSTS
    FOR SELECT USING (true);

-- Authenticated users can manage posts (admin dashboard)
CREATE POLICY IF NOT EXISTS "Authenticated can insert posts" ON public.POSTS
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Authenticated can update posts" ON public.POSTS
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Authenticated can delete posts" ON public.POSTS
    FOR DELETE USING (auth.role() = 'authenticated');

-- ========================================
-- Grant necessary permissions
-- ========================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT SELECT, INSERT ON public.applications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.POSTS TO authenticated;
GRANT SELECT ON public.POSTS TO anon;
