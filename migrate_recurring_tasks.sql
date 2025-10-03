-- Migration to remove assigned_user_id and make team_id required
-- Run this in Supabase SQL Editor

-- Drop the foreign key constraint first
ALTER TABLE public.recurring_tasks 
DROP CONSTRAINT IF EXISTS recurring_tasks_assigned_user_id_fkey;

-- Drop the column
ALTER TABLE public.recurring_tasks 
DROP COLUMN IF EXISTS assigned_user_id;

-- Make team_id NOT NULL (update any null values first if needed)
UPDATE public.recurring_tasks SET team_id = (SELECT id FROM public.teams LIMIT 1) WHERE team_id IS NULL;
ALTER TABLE public.recurring_tasks 
ALTER COLUMN team_id SET NOT NULL;

-- Update the select query to remove assigned_user reference
-- The frontend query will need to be updated too
