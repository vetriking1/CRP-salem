-- Migration to align with new schema
-- This migration adds missing enums, tables, and columns

-- Step 1: Create missing enum types
CREATE TYPE IF NOT EXISTS difficulty_level AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE IF NOT EXISTS assignment_type AS ENUM ('primary', 'reviewer', 'collaborator');
CREATE TYPE IF NOT EXISTS recurrence_frequency AS ENUM ('weekly', 'monthly', 'yearly');

-- Step 2: Modify users table
-- Remove old columns and add new ones
ALTER TABLE public.users 
  DROP COLUMN IF EXISTS specialty,
  DROP COLUMN IF EXISTS max_capacity_hours,
  DROP COLUMN IF EXISTS current_workload_hours;

ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS current_task_count NUMERIC DEFAULT 0;

-- Step 3: Add difficulty column to tasks table
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS difficulty difficulty_level DEFAULT 'medium';

-- Step 4: Add assignment_type column to task_assignments table
ALTER TABLE public.task_assignments 
  ADD COLUMN IF NOT EXISTS assignment_type assignment_type;

-- Step 5: Create subtask_templates table
CREATE TABLE IF NOT EXISTS public.subtask_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_template_id UUID REFERENCES public.task_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 6: Create recurring_tasks table
CREATE TABLE IF NOT EXISTS public.recurring_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  template_id UUID REFERENCES public.task_templates(id),
  team_id UUID NOT NULL REFERENCES public.teams(id),
  priority priority DEFAULT 'medium',
  difficulty difficulty_level DEFAULT 'medium',
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

-- Step 7: Create indexes for new tables
CREATE INDEX IF NOT EXISTS idx_subtask_templates_task_template_id ON public.subtask_templates(task_template_id);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_next_generation ON public.recurring_tasks(next_generation_date, is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_team_id ON public.recurring_tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_created_by ON public.recurring_tasks(created_by);

-- Step 8: Add triggers for updated_at on new tables
CREATE TRIGGER update_subtask_templates_updated_at 
  BEFORE UPDATE ON public.subtask_templates 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recurring_tasks_updated_at 
  BEFORE UPDATE ON public.recurring_tasks 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Step 9: Add RLS policies for subtask_templates
ALTER TABLE public.subtask_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read subtask templates"
ON public.subtask_templates FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admin to manage subtask templates"
ON public.subtask_templates FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Step 10: Add RLS policies for recurring_tasks
ALTER TABLE public.recurring_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read recurring tasks"
ON public.recurring_tasks FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admin and data_collector to insert recurring tasks"
ON public.recurring_tasks FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'data_collector')
  )
);

CREATE POLICY "Allow admin and data_collector to update recurring tasks"
ON public.recurring_tasks FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'data_collector')
  )
);

CREATE POLICY "Allow admin and data_collector to delete recurring tasks"
ON public.recurring_tasks FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'data_collector')
  )
);

-- Step 11: Function to calculate next generation date for recurring tasks
CREATE OR REPLACE FUNCTION calculate_next_generation_date(
  frequency recurrence_frequency,
  day_val INTEGER,
  month_val INTEGER,
  date_val DATE
)
RETURNS DATE AS $$
DECLARE
  next_date DATE;
BEGIN
  CASE frequency
    WHEN 'weekly' THEN
      -- Find next occurrence of the specified day of week
      next_date := CURRENT_DATE + ((day_val - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + 7) % 7);
      IF next_date <= CURRENT_DATE THEN
        next_date := next_date + 7;
      END IF;
    WHEN 'monthly' THEN
      -- Find next occurrence of the specified day of month
      next_date := DATE_TRUNC('month', CURRENT_DATE) + (day_val - 1);
      IF next_date <= CURRENT_DATE THEN
        next_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month') + (day_val - 1);
      END IF;
    WHEN 'yearly' THEN
      -- Find next occurrence of the specified date
      next_date := MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, month_val, EXTRACT(DAY FROM date_val)::INTEGER);
      IF next_date <= CURRENT_DATE THEN
        next_date := MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER + 1, month_val, EXTRACT(DAY FROM date_val)::INTEGER);
      END IF;
  END CASE;
  
  RETURN next_date;
END;
$$ LANGUAGE plpgsql;

-- Step 12: Trigger to set next_generation_date on insert/update
CREATE OR REPLACE FUNCTION set_next_generation_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.next_generation_date := calculate_next_generation_date(
    NEW.recurrence_frequency,
    NEW.recurrence_day,
    NEW.recurrence_month,
    NEW.recurrence_date
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_next_generation_date
BEFORE INSERT OR UPDATE ON public.recurring_tasks
FOR EACH ROW
EXECUTE FUNCTION set_next_generation_date();

-- Step 13: Add comments for documentation
COMMENT ON TABLE public.recurring_tasks IS 'Stores recurring task definitions that generate tasks automatically';
COMMENT ON TABLE public.subtask_templates IS 'Templates for subtasks that can be used when creating tasks from templates';
COMMENT ON COLUMN public.tasks.difficulty IS 'Task difficulty level for workload estimation';
COMMENT ON COLUMN public.task_assignments.assignment_type IS 'Type of assignment: primary assignee, reviewer, or collaborator';
COMMENT ON COLUMN public.users.current_task_count IS 'Current number of active tasks assigned to the user';
