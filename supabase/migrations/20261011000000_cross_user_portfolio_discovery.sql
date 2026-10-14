-- =============================================================================
-- Prismora: Cross-User Portfolio Visibility & Creator Synchronization Migration
-- Migration: 20261011000000_cross_user_portfolio_discovery.sql
-- =============================================================================

-- 1. Ensure RLS Insert Policies for Profiles & Creator Profiles
-- Missing INSERT policies prevented users from persisting their own profile upon signup.

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Creators can insert own creator profile" ON public.creator_profiles;
CREATE POLICY "Creators can insert own creator profile"
  ON public.creator_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Creators can delete own creator profile" ON public.creator_profiles;
CREATE POLICY "Creators can delete own creator profile"
  ON public.creator_profiles FOR DELETE
  USING (auth.uid() = id);

-- 2. Automatic Creator Profile Synchronization
-- Whenever a user signs up or updates their profile as a freelancer/creator,
-- automatically ensure a corresponding creator_profiles row exists.

CREATE OR REPLACE FUNCTION public.handle_profile_creator_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_type = 'freelancer' OR NEW.role = 'creator' THEN
    INSERT INTO public.creator_profiles (
      id,
      tagline,
      specializations,
      primary_ai_tools,
      starting_rate_cents,
      currency,
      verification_status,
      is_available,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.bio, 'Verified AI Content Creator'),
      COALESCE(NEW.skills, ARRAY['cinematic_video']),
      COALESCE(NEW.primary_ai_tools, ARRAY['runway_gen3', 'flux_1']),
      45000,
      'USD',
      'verified',
      true,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      tagline = EXCLUDED.tagline,
      specializations = CASE WHEN array_length(EXCLUDED.specializations, 1) > 0 THEN EXCLUDED.specializations ELSE public.creator_profiles.specializations END,
      primary_ai_tools = CASE WHEN array_length(EXCLUDED.primary_ai_tools, 1) > 0 THEN EXCLUDED.primary_ai_tools ELSE public.creator_profiles.primary_ai_tools END,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_profile_creator ON public.profiles;
CREATE TRIGGER trg_sync_profile_creator
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_profile_creator_sync();

-- 3. Automatic Synchronization from Posts to Portfolio Items
-- Ensures works published via the marketplace upload flow automatically
-- reflect in portfolio_items for public creator profiles, matcher, and verification.

CREATE OR REPLACE FUNCTION public.handle_post_to_portfolio_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Ensure creator_profile exists before linking foreign key
    INSERT INTO public.creator_profiles (id, tagline, specializations, primary_ai_tools, starting_rate_cents, currency, verification_status, is_available)
    VALUES (
      NEW.creator_id,
      'Verified AI Content Creator',
      ARRAY[LOWER(REGEXP_REPLACE(NEW.category, '[^a-zA-Z0-9]+', '_', 'g'))],
      NEW.ai_tools,
      NEW.price_cents,
      NEW.currency,
      'verified',
      true
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.portfolio_items (
      id,
      creator_id,
      title,
      description,
      content_type,
      media_url,
      thumbnail_url,
      aspect_ratio,
      ai_tools_used,
      commercial_rights_granted,
      is_featured,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.creator_id,
      NEW.title,
      NEW.description,
      CASE WHEN NEW.media_type = 'video' THEN 'video'::content_type ELSE 'image'::content_type END,
      NEW.media_url,
      NEW.thumbnail_url,
      '16:9'::aspect_ratio,
      NEW.ai_tools,
      'full_buyout'::commercial_license_type,
      true,
      NEW.created_at,
      NEW.updated_at
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      media_url = EXCLUDED.media_url,
      thumbnail_url = EXCLUDED.thumbnail_url,
      ai_tools_used = EXCLUDED.ai_tools_used,
      updated_at = NOW();

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.portfolio_items SET
      title = NEW.title,
      description = NEW.description,
      media_url = NEW.media_url,
      thumbnail_url = NEW.thumbnail_url,
      ai_tools_used = NEW.ai_tools,
      updated_at = NOW()
    WHERE id = NEW.id;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.portfolio_items WHERE id = OLD.id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_post_to_portfolio ON public.posts;
CREATE TRIGGER trg_sync_post_to_portfolio
  AFTER INSERT OR UPDATE OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_post_to_portfolio_sync();

-- 4. Storage Bucket Configuration for Portfolio Media
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio-media', 'portfolio-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read access for portfolio media
DROP POLICY IF EXISTS "Portfolio media is publicly accessible" ON storage.objects;
CREATE POLICY "Portfolio media is publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'portfolio-media');

-- Authenticated upload for portfolio media
DROP POLICY IF EXISTS "Authenticated users can upload portfolio media" ON storage.objects;
CREATE POLICY "Authenticated users can upload portfolio media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'portfolio-media' AND auth.role() = 'authenticated');

-- Owners can update and delete their uploaded media
DROP POLICY IF EXISTS "Users can update own portfolio media" ON storage.objects;
CREATE POLICY "Users can update own portfolio media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'portfolio-media' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete own portfolio media" ON storage.objects;
CREATE POLICY "Users can delete own portfolio media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'portfolio-media' AND auth.uid()::text = (storage.foldername(name))[1]);
