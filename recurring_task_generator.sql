-- SQL Function to generate tasks from recurring tasks
-- This should be called by a scheduled job (cron job or edge function)

CREATE OR REPLACE FUNCTION generate_recurring_tasks()
RETURNS TABLE(task_id uuid, recurring_task_id uuid, generated_count integer) AS $$
DECLARE
  rec_task RECORD;
  new_task_id uuid;
  due_date_val timestamp with time zone;
  generated integer := 0;
BEGIN
  -- Loop through all active recurring tasks that are due for generation
  FOR rec_task IN 
    SELECT * FROM public.recurring_tasks
    WHERE is_active = true
    AND next_generation_date <= CURRENT_DATE
  LOOP
    -- Calculate due date (7 days from generation for weekly, 30 for monthly, 365 for yearly)
    CASE rec_task.recurrence_frequency
      WHEN 'weekly' THEN
        due_date_val := rec_task.next_generation_date + INTERVAL '7 days';
      WHEN 'monthly' THEN
        due_date_val := rec_task.next_generation_date + INTERVAL '30 days';
      WHEN 'yearly' THEN
        due_date_val := rec_task.next_generation_date + INTERVAL '365 days';
    END CASE;

    -- Create the task
    INSERT INTO public.tasks (
      title,
      description,
      status,
      priority,
      difficulty,
      estimated_hours,
      due_date,
      team_id,
      template_id,
      created_by
    ) VALUES (
      rec_task.title,
      rec_task.description,
      'not_started',
      rec_task.priority,
      rec_task.difficulty,
      rec_task.estimated_hours,
      due_date_val,
      rec_task.team_id,
      rec_task.template_id,
      rec_task.created_by
    ) RETURNING id INTO new_task_id;

    -- Assign the task to the specified user
    INSERT INTO public.task_assignments (
      task_id,
      user_id,
      assigned_by,
      assignment_type
    ) VALUES (
      new_task_id,
      rec_task.assigned_user_id,
      rec_task.created_by,
      'auto'
    );

    -- Create subtasks if template exists
    IF rec_task.template_id IS NOT NULL THEN
      INSERT INTO public.subtasks (task_id, title, description, sort_order)
      SELECT 
        new_task_id,
        st.title,
        st.description,
        st.sort_order
      FROM public.subtask_templates st
      WHERE st.task_template_id = rec_task.template_id;
    END IF;

    -- Update the recurring task's last_generated_at and next_generation_date
    UPDATE public.recurring_tasks
    SET 
      last_generated_at = now(),
      next_generation_date = calculate_next_generation_date(
        recurrence_frequency,
        recurrence_day,
        recurrence_month,
        recurrence_date
      )
    WHERE id = rec_task.id;

    -- Create notification for the assigned user
    INSERT INTO public.notifications (
      user_id,
      task_id,
      type,
      title,
      message,
      is_read
    ) VALUES (
      rec_task.assigned_user_id,
      new_task_id,
      'task_assigned',
      'New Recurring Task Assigned',
      'A new recurring task "' || rec_task.title || '" has been automatically assigned to you.',
      false
    );

    generated := generated + 1;
    
    -- Return the generated task info
    task_id := new_task_id;
    recurring_task_id := rec_task.id;
    generated_count := generated;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION generate_recurring_tasks() TO authenticated;

-- You can manually test this function by running:
-- SELECT * FROM generate_recurring_tasks();

-- To set up automatic execution, you have two options:

-- Option 1: Use Supabase Edge Functions (Recommended)
-- Create an edge function that calls this SQL function on a schedule
-- Deploy it with: supabase functions deploy recurring-task-generator
-- Set up a cron trigger in Supabase dashboard

-- Option 2: Use pg_cron extension (if available in your Supabase project)
-- SELECT cron.schedule('generate-recurring-tasks', '0 0 * * *', 'SELECT generate_recurring_tasks();');
-- This runs daily at midnight

-- Manual execution for testing:
-- SELECT * FROM generate_recurring_tasks();
