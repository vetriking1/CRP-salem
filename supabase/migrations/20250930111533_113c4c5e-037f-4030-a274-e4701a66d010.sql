-- Create function to automatically assign tasks to team members
CREATE OR REPLACE FUNCTION public.auto_assign_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned_user_id uuid;
  v_task_specialty text;
BEGIN
  -- Extract potential specialty from task title/description (lowercase for matching)
  v_task_specialty := lower(NEW.title || ' ' || COALESCE(NEW.description, ''));
  
  -- Try to find best matching user based on:
  -- 1. Active status
  -- 2. Specialty match (if any)
  -- 3. Available capacity (current_workload < max_capacity)
  -- 4. Lowest current workload
  SELECT u.id INTO v_assigned_user_id
  FROM users u
  WHERE u.is_active = true
    AND u.role IN ('employee', 'data_collector', 'reviewer')
    AND u.current_workload_hours < u.max_capacity_hours
    -- Boost score if specialty matches keywords in task
    AND (
      u.specialty IS NULL 
      OR v_task_specialty LIKE '%' || lower(u.specialty) || '%'
    )
  ORDER BY 
    -- Prioritize specialty match
    CASE 
      WHEN u.specialty IS NOT NULL AND v_task_specialty LIKE '%' || lower(u.specialty) || '%' 
      THEN 0 
      ELSE 1 
    END,
    -- Then by available capacity (most available first)
    (u.max_capacity_hours - u.current_workload_hours) DESC,
    -- Then by current workload (least busy first)
    u.current_workload_hours ASC
  LIMIT 1;
  
  -- If we found a suitable user, create the assignment
  IF v_assigned_user_id IS NOT NULL THEN
    INSERT INTO task_assignments (task_id, user_id, assigned_by)
    VALUES (NEW.id, v_assigned_user_id, NEW.created_by);
    
    -- Update user's workload
    UPDATE users 
    SET current_workload_hours = current_workload_hours + COALESCE(NEW.estimated_hours, 0)
    WHERE id = v_assigned_user_id;
    
    -- Create notification for assigned user
    INSERT INTO notifications (user_id, task_id, type, title, message)
    VALUES (
      v_assigned_user_id,
      NEW.id,
      'task_assigned',
      'New Task Assigned',
      'You have been automatically assigned to task: ' || NEW.title
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign tasks after insert
DROP TRIGGER IF EXISTS trigger_auto_assign_task ON tasks;
CREATE TRIGGER trigger_auto_assign_task
  AFTER INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_task();

-- Also create function to update workload when task is completed
CREATE OR REPLACE FUNCTION public.update_user_workload_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When task status changes to completed or delivered, reduce assigned users' workload
  IF NEW.status IN ('completed', 'delivered') AND OLD.status NOT IN ('completed', 'delivered') THEN
    UPDATE users u
    SET current_workload_hours = GREATEST(0, current_workload_hours - COALESCE(NEW.estimated_hours, 0))
    FROM task_assignments ta
    WHERE ta.task_id = NEW.id
      AND ta.user_id = u.id
      AND ta.is_active = true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to update workload on task completion
DROP TRIGGER IF EXISTS trigger_update_workload_on_completion ON tasks;
CREATE TRIGGER trigger_update_workload_on_completion
  AFTER UPDATE ON tasks
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION update_user_workload_on_completion();