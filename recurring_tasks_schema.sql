-- SQL Schema for Recurring Tasks Management
-- Run this in your Supabase SQL Editor

-- Create enum for recurrence frequency
CREATE TYPE recurrence_frequency AS ENUM ('weekly', 'monthly', 'yearly');

-- Create recurring_tasks table
CREATE TABLE public.recurring_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  template_id uuid,
  team_id uuid,
  assigned_user_id uuid NOT NULL,
  priority priority DEFAULT 'medium'::priority,
  difficulty difficulty_level DEFAULT 'medium'::difficulty_level,
  estimated_hours numeric DEFAULT 0,
  recurrence_frequency recurrence_frequency NOT NULL,
  recurrence_day integer, -- Day of week (1-7) for weekly, day of month (1-31) for monthly, or NULL for yearly
  recurrence_month integer, -- Month (1-12) for yearly, NULL for weekly/monthly
  recurrence_date date, -- Specific date for yearly recurrence
  is_active boolean DEFAULT true,
  last_generated_at timestamp with time zone,
  next_generation_date date,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT recurring_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT recurring_tasks_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.task_templates(id),
  CONSTRAINT recurring_tasks_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT recurring_tasks_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES public.users(id),
  CONSTRAINT recurring_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

-- Create index for performance
CREATE INDEX idx_recurring_tasks_next_generation ON public.recurring_tasks(next_generation_date, is_active);
CREATE INDEX idx_recurring_tasks_assigned_user ON public.recurring_tasks(assigned_user_id);

-- Add RLS policies
ALTER TABLE public.recurring_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read all recurring tasks
CREATE POLICY "Allow authenticated users to read recurring tasks"
ON public.recurring_tasks FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow admin and data_collector to insert recurring tasks
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

-- Policy: Allow admin and data_collector to update recurring tasks
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

-- Policy: Allow admin and data_collector to delete recurring tasks
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

-- Function to calculate next generation date
CREATE OR REPLACE FUNCTION calculate_next_generation_date(
  frequency recurrence_frequency,
  day_val integer,
  month_val integer,
  date_val date
)
RETURNS date AS $$
DECLARE
  next_date date;
BEGIN
  CASE frequency
    WHEN 'weekly' THEN
      -- Find next occurrence of the specified day of week
      next_date := CURRENT_DATE + ((day_val - EXTRACT(DOW FROM CURRENT_DATE)::integer + 7) % 7);
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
      next_date := MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::integer, month_val, EXTRACT(DAY FROM date_val)::integer);
      IF next_date <= CURRENT_DATE THEN
        next_date := MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::integer + 1, month_val, EXTRACT(DAY FROM date_val)::integer);
      END IF;
  END CASE;
  
  RETURN next_date;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set next_generation_date on insert/update
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
