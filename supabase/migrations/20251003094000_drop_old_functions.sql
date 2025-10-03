-- Drop old functions and triggers that reference removed columns
-- This migration removes functions that use specialty, current_workload_hours, max_capacity_hours

-- Step 1: Drop triggers that use the old functions
DROP TRIGGER IF EXISTS auto_assign_task_trigger ON public.tasks;
DROP TRIGGER IF EXISTS update_workload_on_task_completion ON public.tasks;

-- Step 2: Drop the old functions
DROP FUNCTION IF EXISTS public.auto_assign_task() CASCADE;
DROP FUNCTION IF EXISTS public.update_user_workload() CASCADE;

-- Step 3: Create a simple function to update current_task_count
CREATE OR REPLACE FUNCTION public.update_user_task_count()
RETURNS TRIGGER AS $$
BEGIN
  -- When a task assignment is created or activated
  IF (TG_OP = 'INSERT' AND NEW.is_active = true) OR 
     (TG_OP = 'UPDATE' AND OLD.is_active = false AND NEW.is_active = true) THEN
    UPDATE users 
    SET current_task_count = current_task_count + 1
    WHERE id = NEW.user_id;
  END IF;
  
  -- When a task assignment is deactivated or deleted
  IF (TG_OP = 'DELETE' AND OLD.is_active = true) OR 
     (TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false) THEN
    UPDATE users 
    SET current_task_count = GREATEST(0, current_task_count - 1)
    WHERE id = COALESCE(NEW.user_id, OLD.user_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to maintain current_task_count
CREATE TRIGGER maintain_user_task_count
AFTER INSERT OR UPDATE OR DELETE ON public.task_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_user_task_count();

-- Step 5: Initialize current_task_count for existing users
UPDATE public.users u
SET current_task_count = (
  SELECT COUNT(*)
  FROM task_assignments ta
  WHERE ta.user_id = u.id
    AND ta.is_active = true
);

-- Add comment
COMMENT ON FUNCTION public.update_user_task_count() IS 'Maintains the current_task_count field in users table based on active task assignments';
