-- First, check what notification types currently exist
-- Run this to see what types you have:
-- SELECT DISTINCT type FROM public.notifications;

-- Option 1: Update invalid types to valid ones before adding constraint
-- Uncomment and modify based on your actual data:
-- UPDATE public.notifications 
-- SET type = 'task_status_changed' 
-- WHERE type NOT IN ('task_assigned', 'task_due_soon', 'task_overdue', 'task_created', 'task_completed', 'task_status_changed');

-- Option 2: Delete invalid notifications (if they're not important)
-- DELETE FROM public.notifications 
-- WHERE type NOT IN ('task_assigned', 'task_due_soon', 'task_overdue', 'task_created', 'task_completed', 'task_status_changed');

-- Add constraint for notification types
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_notification_type' 
        AND table_name = 'notifications'
    ) THEN
        ALTER TABLE public.notifications 
        ADD CONSTRAINT check_notification_type 
        CHECK (type IN ('task_assigned', 'task_due_soon', 'task_overdue', 'task_created', 'task_completed', 'task_status_changed'));
    END IF;
END $$;

-- Add missing foreign key constraints with CASCADE delete
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_task_id_fkey;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_task_id_fkey 
FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications USING btree (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications USING btree (type);

-- Enable RLS (Row Level Security)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to send notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_task_id uuid DEFAULT NULL,
  p_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id uuid;
BEGIN
  -- Validate notification type
  IF p_type NOT IN ('task_assigned', 'task_due_soon', 'task_overdue', 'task_created', 'task_completed', 'task_status_changed') THEN
    RAISE EXCEPTION 'Invalid notification type: %', p_type;
  END IF;

  INSERT INTO public.notifications (user_id, task_id, type, title, message)
  VALUES (p_user_id, p_task_id, p_type, p_title, p_message)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Create function to notify team managers when task is created
CREATE OR REPLACE FUNCTION public.notify_team_managers_on_task_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  manager_record RECORD;
  task_title text;
BEGIN
  -- Get task title
  task_title := NEW.title;
  
  -- Find team managers for the task's team
  FOR manager_record IN
    SELECT DISTINCT u.id, u.full_name
    FROM public.users u
    JOIN public.team_members tm ON u.id = tm.user_id
    WHERE tm.team_id = NEW.team_id 
    AND u.role IN ('manager', 'admin')
    AND u.id != NEW.created_by  -- Don't notify the creator
  LOOP
    -- Create notification for each manager
    PERFORM public.create_notification(
      manager_record.id,
      NEW.id,
      'task_created',
      'New Task Created',
      'A new task "' || task_title || '" has been created and assigned to your team.'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create function to notify users when task is assigned
CREATE OR REPLACE FUNCTION public.notify_on_task_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_record RECORD;
  user_name text;
BEGIN
  -- Get task details
  SELECT title, created_by INTO task_record FROM public.tasks WHERE id = NEW.task_id;
  
  -- Get user name
  SELECT full_name INTO user_name FROM public.users WHERE id = NEW.user_id;
  
  -- Create notification for assigned user
  PERFORM public.create_notification(
    NEW.user_id,
    NEW.task_id,
    'task_assigned',
    'Task Assigned to You',
    'You have been assigned to task: "' || task_record.title || '"'
  );
  
  RETURN NEW;
END;
$$;

-- Create function to check for due soon tasks and create notifications
CREATE OR REPLACE FUNCTION public.check_due_soon_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_record RECORD;
  assignee_record RECORD;
BEGIN
  -- Find tasks that are due within 24 hours and not completed
  FOR task_record IN
    SELECT id, title, due_date
    FROM public.tasks
    WHERE due_date IS NOT NULL
    AND due_date <= (NOW() + INTERVAL '24 hours')
    AND due_date > NOW()
    AND status NOT IN ('completed', 'delivered')
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE task_id = tasks.id 
      AND type = 'task_due_soon' 
      AND created_at > (NOW() - INTERVAL '24 hours')
    )
  LOOP
    -- Notify all assigned users
    FOR assignee_record IN
      SELECT ta.user_id
      FROM public.task_assignments ta
      WHERE ta.task_id = task_record.id
      AND ta.is_active = true
    LOOP
      PERFORM public.create_notification(
        assignee_record.user_id,
        task_record.id,
        'task_due_soon',
        'Task Due Soon',
        'Task "' || task_record.title || '" is due within 24 hours.'
      );
    END LOOP;
  END LOOP;
END;
$$;

-- Create function to check for overdue tasks and create notifications
CREATE OR REPLACE FUNCTION public.check_overdue_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_record RECORD;
  assignee_record RECORD;
BEGIN
  -- Find tasks that are overdue and not completed
  FOR task_record IN
    SELECT id, title, due_date
    FROM public.tasks
    WHERE due_date IS NOT NULL
    AND due_date < NOW()
    AND status NOT IN ('completed', 'delivered')
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE task_id = tasks.id 
      AND type = 'task_overdue' 
      AND created_at > (NOW() - INTERVAL '24 hours')
    )
  LOOP
    -- Notify all assigned users
    FOR assignee_record IN
      SELECT ta.user_id
      FROM public.task_assignments ta
      WHERE ta.task_id = task_record.id
      AND ta.is_active = true
    LOOP
      PERFORM public.create_notification(
        assignee_record.user_id,
        task_record.id,
        'task_overdue',
        'Task Overdue',
        'Task "' || task_record.title || '" is overdue.'
      );
    END LOOP;
  END LOOP;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_notify_team_managers_on_task_creation ON public.tasks;
CREATE TRIGGER trigger_notify_team_managers_on_task_creation
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  WHEN (NEW.team_id IS NOT NULL)
  EXECUTE FUNCTION public.notify_team_managers_on_task_creation();

DROP TRIGGER IF EXISTS trigger_notify_on_task_assignment ON public.task_assignments;
CREATE TRIGGER trigger_notify_on_task_assignment
  AFTER INSERT ON public.task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_task_assignment();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_due_soon_tasks TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_overdue_tasks TO authenticated;