-- Add missing columns to users and task_assignments tables
DO $ 
BEGIN
  -- Add tasks_completed_count column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'tasks_completed_count'
  ) THEN
    ALTER TABLE public.users ADD COLUMN tasks_completed_count INTEGER DEFAULT 0;
    RAISE NOTICE 'Added tasks_completed_count column to users';
  ELSE
    RAISE NOTICE 'tasks_completed_count column already exists';
  END IF;
  
  -- Add tasks_delivered_count column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'tasks_delivered_count'
  ) THEN
    ALTER TABLE public.users ADD COLUMN tasks_delivered_count INTEGER DEFAULT 0;
    RAISE NOTICE 'Added tasks_delivered_count column to users';
  ELSE
    RAISE NOTICE 'tasks_delivered_count column already exists';
  END IF;
  
  -- Add is_primary column to task_assignments if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'task_assignments' 
    AND column_name = 'is_primary'
  ) THEN
    ALTER TABLE public.task_assignments ADD COLUMN is_primary BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added is_primary column to task_assignments';
  ELSE
    RAISE NOTICE 'is_primary column already exists';
  END IF;
END $;

-- Create function to update user task completion counts
CREATE OR REPLACE FUNCTION update_user_task_counts()
RETURNS TRIGGER AS $$
DECLARE
  primary_worker_id UUID;
  reviewer_id UUID;
BEGIN
  -- When task status changes TO completed
  IF (NEW.status = 'completed' AND OLD.status != 'completed') THEN
    -- Find the primary worker
    SELECT user_id INTO primary_worker_id
    FROM public.task_assignments 
    WHERE task_id = NEW.id 
      AND is_primary = true
    ORDER BY assigned_at DESC
    LIMIT 1;
    
    -- Increment completion count for primary worker
    IF primary_worker_id IS NOT NULL THEN
      UPDATE public.users 
      SET tasks_completed_count = tasks_completed_count + 1
      WHERE id = primary_worker_id;
    END IF;
  END IF;
  
  -- When task status changes TO delivered
  IF (NEW.status = 'delivered' AND OLD.status != 'delivered') THEN
    -- Find the reviewer (most recent non-primary assignment)
    SELECT user_id INTO reviewer_id
    FROM public.task_assignments 
    WHERE task_id = NEW.id 
      AND (is_primary = false OR is_primary IS NULL)
    ORDER BY assigned_at DESC
    LIMIT 1;
    
    -- Increment delivery count for reviewer
    IF reviewer_id IS NOT NULL THEN
      UPDATE public.users 
      SET tasks_delivered_count = tasks_delivered_count + 1
      WHERE id = reviewer_id;
    END IF;
  END IF;
  
  -- Handle status reversals - when task status changes FROM completed
  IF (OLD.status = 'completed' AND NEW.status != 'completed') THEN
    SELECT user_id INTO primary_worker_id
    FROM public.task_assignments 
    WHERE task_id = NEW.id 
      AND is_primary = true
    ORDER BY assigned_at DESC
    LIMIT 1;
    
    IF primary_worker_id IS NOT NULL THEN
      UPDATE public.users 
      SET tasks_completed_count = GREATEST(tasks_completed_count - 1, 0)
      WHERE id = primary_worker_id;
    END IF;
  END IF;
  
  -- Handle status reversals - when task status changes FROM delivered
  IF (OLD.status = 'delivered' AND NEW.status != 'delivered') THEN
    SELECT user_id INTO reviewer_id
    FROM public.task_assignments 
    WHERE task_id = NEW.id 
      AND (is_primary = false OR is_primary IS NULL)
    ORDER BY assigned_at DESC
    LIMIT 1;
    
    IF reviewer_id IS NOT NULL THEN
      UPDATE public.users 
      SET tasks_delivered_count = GREATEST(tasks_delivered_count - 1, 0)
      WHERE id = reviewer_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update task counts when task status changes
DROP TRIGGER IF EXISTS update_user_task_counts_trigger ON public.tasks;
CREATE TRIGGER update_user_task_counts_trigger
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_user_task_counts();

-- Update comments
COMMENT ON COLUMN public.users.tasks_completed_count IS 'Total number of tasks completed by the user';
COMMENT ON COLUMN public.users.tasks_delivered_count IS 'Total number of tasks delivered by the user';
COMMENT ON FUNCTION update_user_task_counts IS 'Updates user task completion and delivery counts when task status changes';