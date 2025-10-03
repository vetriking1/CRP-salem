-- Run this in Supabase SQL Editor to verify your database state
-- This will show you what exists and what's missing

-- Check if enums exist
SELECT 
  'assignment_type enum' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_type') 
    THEN '✓ EXISTS' 
    ELSE '✗ MISSING' 
  END as status;

SELECT 
  'difficulty_level enum' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty_level') 
    THEN '✓ EXISTS' 
    ELSE '✗ MISSING' 
  END as status;

SELECT 
  'recurrence_frequency enum' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recurrence_frequency') 
    THEN '✓ EXISTS' 
    ELSE '✗ MISSING' 
  END as status;

-- Check if columns exist
SELECT 
  'tasks.difficulty column' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'difficulty'
  ) 
    THEN '✓ EXISTS' 
    ELSE '✗ MISSING' 
  END as status;

SELECT 
  'task_assignments.assignment_type column' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_assignments' AND column_name = 'assignment_type'
  ) 
    THEN '✓ EXISTS' 
    ELSE '✗ MISSING' 
  END as status;

SELECT 
  'users.current_task_count column' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'current_task_count'
  ) 
    THEN '✓ EXISTS' 
    ELSE '✗ MISSING' 
  END as status;

-- Check if old columns are removed
SELECT 
  'users.specialty column (should be removed)' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'specialty'
  ) 
    THEN '✗ STILL EXISTS (should be removed)' 
    ELSE '✓ REMOVED' 
  END as status;

-- Show enum values if they exist
SELECT 
  'assignment_type enum values' as info,
  string_agg(enumlabel::text, ', ' ORDER BY enumsortorder) as values
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'assignment_type'
GROUP BY t.typname;

SELECT 
  'difficulty_level enum values' as info,
  string_agg(enumlabel::text, ', ' ORDER BY enumsortorder) as values
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'difficulty_level'
GROUP BY t.typname;

-- Show task_assignments table structure
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'task_assignments'
ORDER BY ordinal_position;
