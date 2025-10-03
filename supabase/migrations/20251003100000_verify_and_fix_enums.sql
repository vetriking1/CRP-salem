-- Verify and fix all required enums and columns
-- This migration ensures everything is in place

-- Step 1: Create enums if they don't exist (idempotent)
DO $$ 
BEGIN
  -- Create difficulty_level enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty_level') THEN
    CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');
    RAISE NOTICE 'Created difficulty_level enum';
  ELSE
    RAISE NOTICE 'difficulty_level enum already exists';
  END IF;

  -- Create assignment_type enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_type') THEN
    CREATE TYPE assignment_type AS ENUM ('primary', 'reviewer', 'collaborator');
    RAISE NOTICE 'Created assignment_type enum';
  ELSE
    RAISE NOTICE 'assignment_type enum already exists';
  END IF;

  -- Create recurrence_frequency enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recurrence_frequency') THEN
    CREATE TYPE recurrence_frequency AS ENUM ('weekly', 'monthly', 'yearly');
    RAISE NOTICE 'Created recurrence_frequency enum';
  ELSE
    RAISE NOTICE 'recurrence_frequency enum already exists';
  END IF;
END $$;

-- Step 2: Add columns if they don't exist (idempotent)
DO $$ 
BEGIN
  -- Add difficulty to tasks table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tasks' 
    AND column_name = 'difficulty'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN difficulty difficulty_level DEFAULT 'easy';
    RAISE NOTICE 'Added difficulty column to tasks';
  ELSE
    -- Update default if column exists
    ALTER TABLE public.tasks ALTER COLUMN difficulty SET DEFAULT 'easy';
    RAISE NOTICE 'Updated difficulty default to easy';
  END IF;

  -- Add assignment_type to task_assignments table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'task_assignments' 
    AND column_name = 'assignment_type'
  ) THEN
    ALTER TABLE public.task_assignments ADD COLUMN assignment_type assignment_type;
    RAISE NOTICE 'Added assignment_type column to task_assignments';
  ELSE
    RAISE NOTICE 'assignment_type column already exists';
  END IF;

  -- Add current_task_count to users table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'current_task_count'
  ) THEN
    ALTER TABLE public.users ADD COLUMN current_task_count NUMERIC DEFAULT 0;
    RAISE NOTICE 'Added current_task_count column to users';
  ELSE
    RAISE NOTICE 'current_task_count column already exists';
  END IF;
END $$;

-- Step 3: Remove old columns if they still exist
DO $$ 
BEGIN
  -- Remove specialty from users
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'specialty'
  ) THEN
    ALTER TABLE public.users DROP COLUMN specialty;
    RAISE NOTICE 'Removed specialty column from users';
  END IF;

  -- Remove max_capacity_hours from users
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'max_capacity_hours'
  ) THEN
    ALTER TABLE public.users DROP COLUMN max_capacity_hours;
    RAISE NOTICE 'Removed max_capacity_hours column from users';
  END IF;

  -- Remove current_workload_hours from users
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'current_workload_hours'
  ) THEN
    ALTER TABLE public.users DROP COLUMN current_workload_hours;
    RAISE NOTICE 'Removed current_workload_hours column from users';
  END IF;
END $$;

-- Step 4: Update any existing tasks to have default difficulty
UPDATE public.tasks 
SET difficulty = 'easy' 
WHERE difficulty IS NULL;

-- Step 5: Create tables if they don't exist
CREATE TABLE IF NOT EXISTS public.recurring_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  template_id UUID REFERENCES public.task_templates(id),
  team_id UUID NOT NULL REFERENCES public.teams(id),
  priority priority DEFAULT 'medium',
  difficulty difficulty_level DEFAULT 'easy',
  estimated_hours NUMERIC DEFAULT 0,
  recurrence_frequency recurrence_frequency NOT NULL,
  recurrence_day INTEGER,
  recurrence_month INTEGER,
  recurrence_date DATE,
  is_active BOOLEAN DEFAULT true,
  last_generated_at TIMESTAMPTZ,
  next_generation_date DATE,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subtask_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_template_id UUID REFERENCES public.task_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 6: Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_subtask_templates_task_template_id ON public.subtask_templates(task_template_id);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_next_generation ON public.recurring_tasks(next_generation_date, is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_team_id ON public.recurring_tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_created_by ON public.recurring_tasks(created_by);

-- Step 7: Add comments
COMMENT ON COLUMN public.tasks.difficulty IS 'Task difficulty level (easy, medium, hard) - default is easy';
COMMENT ON COLUMN public.task_assignments.assignment_type IS 'Type of assignment: primary, reviewer, or collaborator';
COMMENT ON COLUMN public.users.current_task_count IS 'Current number of active tasks assigned to the user';

-- Success message
DO $$ 
BEGIN
  RAISE NOTICE '✓ All enums verified/created';
  RAISE NOTICE '✓ All columns verified/added';
  RAISE NOTICE '✓ Old columns removed';
  RAISE NOTICE '✓ Tables created';
  RAISE NOTICE '✓ Migration complete!';
END $$;
