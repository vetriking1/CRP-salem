-- Fix missing create_notification function and improve auto-assignment

-- Step 1: Drop existing create_notification functions if they exist
DROP FUNCTION IF EXISTS public.create_notification(UUID, UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_notification(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_notification CASCADE;

-- Create the create_notification function with proper signature
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

-- Step 2: Create function to get user's current task count
CREATE OR REPLACE FUNCTION public.get_user_task_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM task_assignments ta
  JOIN tasks t ON t.id = ta.task_id
  WHERE ta.user_id = p_user_id
    AND ta.is_active = true
    AND t.status NOT IN ('completed', 'delivered');
  
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create function to find best assignee based on workload
CREATE OR REPLACE FUNCTION public.find_best_assignee(
  p_team_id UUID,
  p_difficulty TEXT DEFAULT 'medium',
  p_priority TEXT DEFAULT 'medium'
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_min_tasks INTEGER := 999999;
  v_current_tasks INTEGER;
  v_eligible_roles TEXT[];
BEGIN
  -- Determine eligible roles based on difficulty
  CASE p_difficulty
    WHEN 'easy' THEN
      v_eligible_roles := ARRAY['admin', 'manager', 'senior', 'employee', 'data_collector'];
    WHEN 'medium' THEN
      v_eligible_roles := ARRAY['admin', 'manager', 'senior', 'employee'];
    WHEN 'hard' THEN
      v_eligible_roles := ARRAY['admin', 'manager', 'senior'];
    ELSE
      v_eligible_roles := ARRAY['admin', 'manager', 'senior', 'employee'];
  END CASE;
  
  -- Find user with least active tasks
  SELECT u.id INTO v_user_id
  FROM users u
  JOIN team_members tm ON tm.user_id = u.id
  WHERE tm.team_id = p_team_id
    AND u.is_active = true
    AND u.role = ANY(v_eligible_roles)
  ORDER BY 
    -- First by task count (least busy)
    (SELECT COUNT(*) 
     FROM task_assignments ta 
     JOIN tasks t ON t.id = ta.task_id
     WHERE ta.user_id = u.id 
       AND ta.is_active = true 
       AND t.status NOT IN ('completed', 'delivered')) ASC,
    -- Then by role priority (senior roles preferred for hard tasks)
    CASE 
      WHEN p_difficulty = 'hard' AND u.role = 'senior' THEN 1
      WHEN p_difficulty = 'hard' AND u.role = 'manager' THEN 2
      WHEN p_difficulty = 'hard' AND u.role = 'admin' THEN 3
      ELSE 4
    END ASC,
    -- Finally random to distribute evenly
    RANDOM()
  LIMIT 1;
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Update current_task_count for all users based on actual assignments
UPDATE public.users u
SET current_task_count = (
  SELECT COUNT(*)
  FROM task_assignments ta
  JOIN tasks t ON t.id = ta.task_id
  WHERE ta.user_id = u.id
    AND ta.is_active = true
    AND t.status NOT IN ('completed', 'delivered')
);

-- Step 5: Create trigger to update task count when assignments change
CREATE OR REPLACE FUNCTION public.sync_user_task_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT
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
  
  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- Update old user if changed
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
    
    -- Update new user
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
  
  -- Handle DELETE
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

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS maintain_user_task_count ON public.task_assignments;
DROP TRIGGER IF EXISTS sync_user_task_count_trigger ON public.task_assignments;

CREATE TRIGGER sync_user_task_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.task_assignments
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_task_count();

-- Step 6: Create trigger to update task count when task status changes
CREATE OR REPLACE FUNCTION public.sync_task_count_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When task is completed or delivered, update all assigned users
  IF NEW.status IN ('completed', 'delivered') AND OLD.status NOT IN ('completed', 'delivered') THEN
    UPDATE users u
    SET current_task_count = (
      SELECT COUNT(*)
      FROM task_assignments ta
      JOIN tasks t ON t.id = ta.task_id
      WHERE ta.user_id = u.id
        AND ta.is_active = true
        AND t.status NOT IN ('completed', 'delivered')
    )
    WHERE u.id IN (
      SELECT user_id FROM task_assignments WHERE task_id = NEW.id AND is_active = true
    );
  END IF;
  
  -- When task is reopened, update all assigned users
  IF OLD.status IN ('completed', 'delivered') AND NEW.status NOT IN ('completed', 'delivered') THEN
    UPDATE users u
    SET current_task_count = (
      SELECT COUNT(*)
      FROM task_assignments ta
      JOIN tasks t ON t.id = ta.task_id
      WHERE ta.user_id = u.id
        AND ta.is_active = true
        AND t.status NOT IN ('completed', 'delivered')
    )
    WHERE u.id IN (
      SELECT user_id FROM task_assignments WHERE task_id = NEW.id AND is_active = true
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_task_count_on_status_change_trigger ON public.tasks;

CREATE TRIGGER sync_task_count_on_status_change_trigger
AFTER UPDATE ON public.tasks
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_task_count_on_status_change();

-- Step 7: Add helpful comments
COMMENT ON FUNCTION public.create_notification IS 'Creates a notification for a user about a task event';
COMMENT ON FUNCTION public.get_user_task_count IS 'Returns the current number of active tasks for a user';
COMMENT ON FUNCTION public.find_best_assignee IS 'Finds the best user to assign a task based on workload and difficulty';
COMMENT ON FUNCTION public.sync_user_task_count IS 'Keeps user task counts in sync with actual assignments';
COMMENT ON FUNCTION public.sync_task_count_on_status_change IS 'Updates user task counts when task status changes';

-- Step 8: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_task_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_best_assignee TO authenticated;
