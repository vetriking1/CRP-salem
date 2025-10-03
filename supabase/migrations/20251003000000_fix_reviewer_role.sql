-- Fix any task templates that have 'reviewer' as default_role
-- Change them to 'senior' since senior members are responsible for reviews

-- First, we need to temporarily allow 'reviewer' in the enum, update the data, then remove it
-- But since we can't have 'reviewer' in the enum, we'll just update any NULL or invalid references

-- Update task_templates: set any that might reference reviewer to senior
UPDATE public.task_templates
SET default_role = 'senior'
WHERE default_role IS NULL 
   OR default_role::text NOT IN ('admin', 'manager', 'data_collector', 'senior', 'employee');

-- If there are any users with invalid roles (shouldn't happen, but just in case)
UPDATE public.users
SET role = 'senior'
WHERE role::text NOT IN ('admin', 'manager', 'data_collector', 'senior', 'employee');

-- Add a comment to document this change
COMMENT ON COLUMN public.task_templates.default_role IS 'Default role for task assignment. Use "senior" for review tasks.';
