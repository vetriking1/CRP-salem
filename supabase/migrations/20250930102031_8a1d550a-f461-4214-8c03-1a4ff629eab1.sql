-- Enable RLS on all tables
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's ID from users table
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE id = auth.uid();
$$;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Tasks policies
CREATE POLICY "Users can view all tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Data collectors and admins can create tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    get_current_user_role() IN ('data_collector', 'admin')
  );

CREATE POLICY "Data collectors and admins can update tasks"
  ON public.tasks FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    get_current_user_role() IN ('data_collector', 'admin', 'manager')
  );

CREATE POLICY "Admins can delete tasks"
  ON public.tasks FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    get_current_user_role() = 'admin'
  );

-- Subtasks policies
CREATE POLICY "Users can view all subtasks"
  ON public.subtasks FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Assigned users can update subtasks"
  ON public.subtasks FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.task_assignments ta
      WHERE ta.task_id = subtasks.task_id
      AND ta.user_id = auth.uid()
      AND ta.is_active = true
    )
  );

CREATE POLICY "Data collectors can manage subtasks"
  ON public.subtasks FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    get_current_user_role() IN ('data_collector', 'admin')
  );

-- Task assignments policies
CREATE POLICY "Users can view all task assignments"
  ON public.task_assignments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Data collectors and managers can manage assignments"
  ON public.task_assignments FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    get_current_user_role() IN ('data_collector', 'admin', 'manager')
  );

-- Comments policies
CREATE POLICY "Users can view all comments"
  ON public.comments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Non-admin users can create comments"
  ON public.comments FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    get_current_user_role() != 'admin'
  );

CREATE POLICY "Users can update their own comments"
  ON public.comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id);

-- Attachments policies
CREATE POLICY "Users can view all attachments"
  ON public.attachments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can upload attachments"
  ON public.attachments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own attachments"
  ON public.attachments FOR DELETE
  USING (auth.uid() = uploaded_by);

-- Task history policies
CREATE POLICY "Users can view all task history"
  ON public.task_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert task history"
  ON public.task_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Task templates policies
CREATE POLICY "Users can view all task templates"
  ON public.task_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage task templates"
  ON public.task_templates FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    get_current_user_role() = 'admin'
  );

-- Teams policies
CREATE POLICY "Users can view all teams"
  ON public.teams FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers and admins can manage teams"
  ON public.teams FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    get_current_user_role() IN ('admin', 'manager')
  );

-- Team members policies
CREATE POLICY "Users can view all team members"
  ON public.team_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers and admins can manage team members"
  ON public.team_members FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    get_current_user_role() IN ('admin', 'manager')
  );

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Users policies
CREATE POLICY "Users can view all users"
  ON public.users FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can manage all users"
  ON public.users FOR ALL
  USING (
    auth.uid() IS NOT NULL AND
    get_current_user_role() = 'admin'
  );