-- Create an enum type for notes_generation_status
CREATE TYPE notes_generation_status_type AS ENUM ('pending', 'in_progress', 'completed', 'failed');

-- Drop the existing check constraint
ALTER TABLE pdfs DROP CONSTRAINT IF EXISTS pdfs_notes_generation_status_check;

-- First, remove the default value
ALTER TABLE pdfs ALTER COLUMN notes_generation_status DROP DEFAULT;

-- Alter the column to use the enum type
ALTER TABLE pdfs 
  ALTER COLUMN notes_generation_status TYPE notes_generation_status_type 
  USING notes_generation_status::notes_generation_status_type;

-- Add back the default value
ALTER TABLE pdfs 
  ALTER COLUMN notes_generation_status 
  SET DEFAULT 'pending'::notes_generation_status_type;

-- Add back the check constraint
ALTER TABLE pdfs 
  ADD CONSTRAINT pdfs_notes_generation_status_check 
  CHECK (notes_generation_status IN ('pending', 'in_progress', 'completed', 'failed')); 