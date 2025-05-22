-- Add notes generation status and progress columns
ALTER TABLE pdfs
ADD COLUMN notes_generation_status TEXT DEFAULT 'pending' CHECK (notes_generation_status IN ('pending', 'in_progress', 'completed', 'failed')),
ADD COLUMN notes_generation_progress INTEGER DEFAULT 0 CHECK (notes_generation_progress >= 0 AND notes_generation_progress <= 100);

-- Update existing rows to have default values
UPDATE pdfs
SET notes_generation_status = CASE 
    WHEN notes IS NOT NULL THEN 'completed'
    ELSE 'pending'
END,
notes_generation_progress = CASE 
    WHEN notes IS NOT NULL THEN 100
    ELSE 0
END; 