-- Migration: Create public schema tables for website applications and posts
-- These tables are shared between the SMS (Next.js) and Website (React) apps
-- The website reads applications and posts from the public schema

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
    option_subjects JSONB,
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
-- STORAGE BUCKET FOR MEDIA (used by both apps)
-- ========================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'media',
    'media',
    true,
    52428800,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- RLS POLICIES FOR APPLICATIONS (public schema)
-- ========================================
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Anyone can view applications (public access for website)
CREATE POLICY "Public can view applications" ON public.applications
    FOR SELECT USING (true);

-- Only service role can insert/update/delete applications (handled server-side)
CREATE POLICY "Service role can manage applications" ON public.applications
    FOR ALL USING (
        auth.role() = 'service_role'
    );

-- ========================================
-- RLS POLICIES FOR POSTS (public schema)
-- ========================================
ALTER TABLE public.POSTS ENABLE ROW LEVEL SECURITY;

-- Anyone can view posts (public access for website)
CREATE POLICY "Public can view posts" ON public.POSTS
    FOR SELECT USING (true);

-- Authenticated users can insert posts (for admin dashboard)
CREATE POLICY "Authenticated users can insert posts" ON public.POSTS
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update their own posts
CREATE POLICY "Authenticated users can update own posts" ON public.POSTS
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Authenticated users can delete posts
CREATE POLICY "Authenticated users can delete posts" ON public.POSTS
    FOR DELETE USING (auth.role() = 'authenticated');

-- ========================================
-- RLS POLICIES FOR STORAGE MEDIA BUCKET
-- ========================================
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Public can view media files
CREATE POLICY "Public can view media files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'media'
    );

-- Authenticated users can upload media
CREATE POLICY "Authenticated users can upload media" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'media'
        AND auth.role() = 'authenticated'
    );

-- Authenticated users can update media
CREATE POLICY "Authenticated users can update media" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'media'
        AND auth.role() = 'authenticated'
    );

-- Authenticated users can delete media
CREATE POLICY "Authenticated users can delete media" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'media'
        AND auth.role() = 'authenticated'
    );

-- ========================================
-- GRANT PERMISSIONS
-- ========================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.POSTS TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.POSTS TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
