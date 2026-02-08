-- Migration 006: Math Equations LaTeX Support
-- Add LaTeX content and math detection to paragraphs table

-- Add new columns for LaTeX content
ALTER TABLE paragraphs 
ADD COLUMN IF NOT EXISTS latex_content TEXT,
ADD COLUMN IF NOT EXISTS contains_math BOOLEAN DEFAULT FALSE;

-- Add index for faster math content queries
CREATE INDEX IF NOT EXISTS idx_paragraphs_math ON paragraphs(contains_math) WHERE contains_math = TRUE;

-- Add comment explaining the columns
COMMENT ON COLUMN paragraphs.latex_content IS 'LaTeX representation of math equations extracted from images';
COMMENT ON COLUMN paragraphs.contains_math IS 'Flag indicating if this paragraph contains mathematical equations';
