-- Create subtask_templates table
CREATE TABLE public.subtask_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_template_id uuid REFERENCES public.task_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subtask_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all subtask templates"
  ON public.subtask_templates
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage subtask templates"
  ON public.subtask_templates
  FOR ALL
  USING (
    auth.uid() IS NOT NULL 
    AND get_current_user_role() = 'admin'
  );

-- Add trigger for updated_at
CREATE TRIGGER update_subtask_templates_updated_at
  BEFORE UPDATE ON public.subtask_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();