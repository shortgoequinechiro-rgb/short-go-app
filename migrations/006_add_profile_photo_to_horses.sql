-- Add profile_photo_path column to horses table
-- Stores the Supabase storage path (bucket: horse-photos) for the patient's profile picture
ALTER TABLE horses ADD COLUMN IF NOT EXISTS profile_photo_path text;
