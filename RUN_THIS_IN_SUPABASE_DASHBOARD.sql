-- ============================================================================
-- COPY THIS ENTIRE FILE AND RUN IT IN SUPABASE DASHBOARD SQL EDITOR
-- ============================================================================
-- This will fix all your issues in one go
-- Go to: https://supabase.com/dashboard → Your Project → SQL Editor
-- Paste this entire file and click RUN
-- ============================================================================

-- Step 1: Create enums if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty_level') THEN
    CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');
    RAISE NOTICE '✓ Created difficulty_level enum';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_type') THEN
    CREATE TYPE assignment_type AS ENUM ('primary', 'reviewer', 'collaborator');
    RAISE NOTICE '✓ Created assignment_type enum';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recurrence_frequency') THEN
    CREATE TYPE recurrence_frequency AS ENUM ('weekly', 'monthly', 'yearly');
    RAISE NOTICE '✓ Created recurrence_frequency enum';
  END IF;
END $$;

-- Step 2: Remove old columns from users table
ALTER TABLE public.users DROP COLUMN IF EXISTS specialty;
ALTER TABLE public.users DROP COLUMN IF EXISTS max_capacity_hours;
ALTER TABLE public.users DROP COLUMN IF EXISTS current_workload_hours;

-- Step 3: Add new columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS current_task_count NUMERIC DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS difficulty difficulty_level DEFAULT 'easy';
ALTER TABLE public.task_assignments ADD COLUMN IF NOT EXISTS assignment_type assignment_type;

-- Step 4: Update existing tasks to have default difficulty
UPDATE public.tasks SET difficulty = 'easy' WHERE difficulty IS NULL;

-- Step 5: Drop old functions that reference removed columns
DROP TRIGGER IF EXISTS auto_assign_task_trigger ON public.tasks;
DROP TRIGGER IF EXISTS update_workload_on_task_completion ON public.tasks;
DROP FUNCTION IF EXISTS public.auto_assign_task() CASCADE;
DROP FUNCTION IF EXISTS public.update_user_workload() CASCADE;

-- Step 6: Drop and recreate notification function
DROP FUNCTION IF EXISTS public.create_notification(UUID, UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_notification(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_notification CASCADE;

CREATE FUNCTION public.create_notification(
  p_user_id UUID,
  p_task_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    task_id,
    type,
    title,
    message,
    is_read,
    created_at
  ) VALUES (
    p_user_id,
    p_task_id,
    p_type,
    p_title,
    p_message,
    false,
    now()
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create function to sync user task counts
CREATE OR REPLACE FUNCTION public.sync_user_task_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_active = true THEN
    UPDATE users 
    SET current_task_count = (
      SELECT COUNT(*)
      FROM task_assignments ta
      JOIN tasks t ON t.id = ta.task_id
      WHERE ta.user_id = NEW.user_id
        AND ta.is_active = true
        AND t.status NOT IN ('completed', 'delivered')
    )
    WHERE id = NEW.user_id;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    IF OLD.user_id IS DISTINCT FROM NEW.user_id OR OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      UPDATE users 
      SET current_task_count = (
        SELECT COUNT(*)
        FROM task_assignments ta
        JOIN tasks t ON t.id = ta.task_id
        WHERE ta.user_id = OLD.user_id
          AND ta.is_active = true
          AND t.status NOT IN ('completed', 'delivered')
      )
      WHERE id = OLD.user_id;
    END IF;
    
    UPDATE users 
    SET current_task_count = (
      SELECT COUNT(*)
      FROM task_assignments ta
      JOIN tasks t ON t.id = ta.task_id
      WHERE ta.user_id = NEW.user_id
        AND ta.is_active = true
        AND t.status NOT IN ('completed', 'delivered')
    )
    WHERE id = NEW.user_id;
  END IF;
  
  IF TG_OP = 'DELETE' AND OLD.is_active = true THEN
    UPDATE users 
    SET current_task_count = (
      SELECT COUNT(*)
      FROM task_assignments ta
      JOIN tasks t ON t.id = ta.task_id
      WHERE ta.user_id = OLD.user_id
        AND ta.is_active = true
        AND t.status NOT IN ('completed', 'delivered')
    )
    WHERE id = OLD.user_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create trigger for task count sync
DROP TRIGGER IF EXISTS sync_user_task_count_trigger ON public.task_assignments;
CREATE TRIGGER sync_user_task_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.task_assignments
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_task_count();

-- Step 9: Initialize current_task_count for all users
UPDATE public.users u
SET current_task_count = (
  SELECT COUNT(*)
  FROM task_assignments ta
  JOIN tasks t ON t.id = ta.task_id
  WHERE ta.user_id = u.id
    AND ta.is_active = true
    AND t.status NOT IN ('completed', 'delivered')
);

-- Step 10: Create recurring_tasks table if not exists
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

-- Step 11: Create subtask_templates table if not exists
CREATE TABLE IF NOT EXISTS public.subtask_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_template_id UUID REFERENCES public.task_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 12: Create indexes
CREATE INDEX IF NOT EXISTS idx_subtask_templates_task_template_id ON public.subtask_templates(task_template_id);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_next_generation ON public.recurring_tasks(next_generation_date, is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_team_id ON public.recurring_tasks(team_id);

-- Step 13: Grant permissions
GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_task_count TO authenticated;

-- ============================================================================
-- DONE! Your database is now ready.
-- ============================================================================
-- What was fixed:
-- ✓ Created assignment_type enum (primary, reviewer, collaborator)
-- ✓ Created difficulty_level enum (easy, medium, hard)
-- ✓ Created recurrence_frequency enum (weekly, monthly, yearly)
-- ✓ Added difficulty column to tasks (default: easy)
-- ✓ Added assignment_type column to task_assignments
-- ✓ Added current_task_count column to users
-- ✓ Removed old columns (specialty, workload_hours, max_capacity_hours)
-- ✓ Created notification function
-- ✓ Created task count sync function
-- ✓ Initialized all user task counts
-- ✓ Created recurring_tasks and subtask_templates tables
-- 
-- Now go test your app - it should work perfectly!
-- ============================================================================

-- Show success message
DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ MIGRATION COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ All enums created';
  RAISE NOTICE '✓ All columns added';
  RAISE NOTICE '✓ Old columns removed';
  RAISE NOTICE '✓ Functions created';
  RAISE NOTICE '✓ Task counts initialized';
  RAISE NOTICE '';
  RAISE NOTICE 'Your app is ready to use!';
  RAISE NOTICE '========================================';
END $$;
