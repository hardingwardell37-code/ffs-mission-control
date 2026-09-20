-- Add Runway Gen-4 Image to generation_provider enum (image-only provider in app layer).
-- Safe to re-run: IF NOT EXISTS (PostgreSQL 9.1+ / Supabase PG 15).

ALTER TYPE public.generation_provider ADD VALUE IF NOT EXISTS 'runway';
