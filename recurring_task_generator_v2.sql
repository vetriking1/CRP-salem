-- Updated SQL Function to generate tasks with auto-assignment
-- This uses the AutoAssignmentService logic in the database

CREATE OR REPLACE FUNCTION generate_recurring_tasks()
RETURNS TABLE(task_id uuid, recurring_task_id uuid, generated_count integer) AS $$
DECLARE
  rec_task RECORD;
  new_task_id uuid;
  due_date_val timestamp with time zone;
  generated integer := 0;
BEGIN
  FOR rec_task IN 
    SELECT * FROM public.recurring_tasks
    WHERE is_active = true
    AND next_generation_date <= CURRENT_DATE
  LOOP
    -- Calculate due date
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

    -- Note: Auto-assignment will be handled by the application layer (AutoAssignmentService)
    -- The task is created with team_id, and the app will assign to best team member

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

    generated := generated + 1;
    
    task_id := new_task_id;
    recurring_task_id := rec_task.id;
    generated_count := generated;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION generate_recurring_tasks() TO authenticated;
