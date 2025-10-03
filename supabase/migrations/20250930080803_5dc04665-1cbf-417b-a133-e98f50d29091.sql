-- Insert dummy users
INSERT INTO public.users (email, full_name, role, specialty, max_capacity_hours, current_workload_hours) VALUES
('admin@compliancefirst.com', 'John Administrator', 'admin', 'Management', 40, 0),
('manager@compliancefirst.com', 'Sarah Manager', 'manager', 'Tax Planning', 40, 15),
('collector@compliancefirst.com', 'Mike DataCollector', 'data_collector', 'Data Entry', 40, 20),
('senior@compliancefirst.com', 'Lisa senior', 'senior', 'Quality Assurance', 40, 10),
('employee1@compliancefirst.com', 'David Employee', 'employee', 'GST Filing', 40, 25),
('employee2@compliancefirst.com', 'Emma Worker', 'employee', 'Income Tax', 40, 30);

-- Insert teams
INSERT INTO public.teams (name, description, manager_id) VALUES
('Tax Compliance Team', 'Handles all tax-related compliance tasks', (SELECT id FROM public.users WHERE email = 'manager@compliancefirst.com')),
('Data Management Team', 'Manages data collection and validation', (SELECT id FROM public.users WHERE email = 'admin@compliancefirst.com'));

-- Assign team members
INSERT INTO public.team_members (team_id, user_id) 
SELECT t.id, u.id FROM public.teams t, public.users u 
WHERE t.name = 'Tax Compliance Team' AND u.email IN ('employee1@compliancefirst.com', 'employee2@compliancefirst.com', 'senior@compliancefirst.com');

INSERT INTO public.team_members (team_id, user_id)
SELECT t.id, u.id FROM public.teams t, public.users u
WHERE t.name = 'Data Management Team' AND u.email IN ('collector@compliancefirst.com', 'manager@compliancefirst.com');

-- Insert task templates
INSERT INTO public.task_templates (name, description, estimated_hours, default_role, sla_days) VALUES
('GST Filing', 'Monthly GST return filing and compliance', 8, 'employee', 5),
('Income Tax Filing', 'Annual income tax return preparation', 12, 'employee', 10),
('TDS Return', 'Quarterly TDS return filing', 6, 'employee', 7),
('Audit Support', 'Preparation of documents for audit', 20, 'senior', 15);

-- Insert sample tasks
INSERT INTO public.tasks (title, description, status, priority, estimated_hours, actual_hours, due_date, team_id, created_by) VALUES
('GST Return - Client ABC Ltd', 'Monthly GST return for December 2024', 'in_progress', 'high', 8, 3, NOW() + INTERVAL '2 days', (SELECT id FROM public.teams WHERE name = 'Tax Compliance Team'), (SELECT id FROM public.users WHERE email = 'manager@compliancefirst.com')),
('Income Tax Filing - Individual XYZ', 'AY 2024-25 ITR filing', 'assigned', 'medium', 12, 0, NOW() + INTERVAL '7 days', (SELECT id FROM public.teams WHERE name = 'Tax Compliance Team'), (SELECT id FROM public.users WHERE email = 'manager@compliancefirst.com')),
('TDS Return Q3 - DEF Corp', 'Third quarter TDS return', 'pending', 'urgent', 6, 4, NOW() + INTERVAL '1 day', (SELECT id FROM public.teams WHERE name = 'Tax Compliance Team'), (SELECT id FROM public.users WHERE email = 'manager@compliancefirst.com')),
('Audit Documents - GHI Ltd', 'Prepare financial documents for statutory audit', 'review', 'high', 20, 18, NOW() + INTERVAL '5 days', (SELECT id FROM public.teams WHERE name = 'Tax Compliance Team'), (SELECT id FROM public.users WHERE email = 'admin@compliancefirst.com')),
('Data Validation - New Client', 'Validate and clean client master data', 'completed', 'low', 4, 4, NOW() - INTERVAL '2 days', (SELECT id FROM public.teams WHERE name = 'Data Management Team'), (SELECT id FROM public.users WHERE email = 'manager@compliancefirst.com')),
('ROC Annual Filing - JKL Pvt Ltd', 'Company annual filing with ROC', 'not_started', 'medium', 10, 0, NOW() + INTERVAL '10 days', (SELECT id FROM public.teams WHERE name = 'Tax Compliance Team'), (SELECT id FROM public.users WHERE email = 'manager@compliancefirst.com')),
('GST Return - Client MNO Ltd', 'Monthly GST return for November 2024', 'delivered', 'medium', 8, 8, NOW() - INTERVAL '5 days', (SELECT id FROM public.teams WHERE name = 'Tax Compliance Team'), (SELECT id FROM public.users WHERE email = 'manager@compliancefirst.com'));

-- Update pending task with reason
UPDATE public.tasks SET pending_reason = 'data_missing', pending_notes = 'Missing Form 16 documents from client' WHERE title = 'TDS Return Q3 - DEF Corp';

-- Insert task assignments
INSERT INTO public.task_assignments (task_id, user_id, assigned_by) VALUES
((SELECT id FROM public.tasks WHERE title = 'GST Return - Client ABC Ltd'), (SELECT id FROM public.users WHERE email = 'employee1@compliancefirst.com'), (SELECT id FROM public.users WHERE email = 'manager@compliancefirst.com')),
((SELECT id FROM public.tasks WHERE title = 'Income Tax Filing - Individual XYZ'), (SELECT id FROM public.users WHERE email = 'employee2@compliancefirst.com'), (SELECT id FROM public.users WHERE email = 'manager@compliancefirst.com')),
((SELECT id FROM public.tasks WHERE title = 'Audit Documents - GHI Ltd'), (SELECT id FROM public.users WHERE email = 'senior@compliancefirst.com'), (SELECT id FROM public.users WHERE email = 'manager@compliancefirst.com')),
((SELECT id FROM public.tasks WHERE title = 'TDS Return Q3 - DEF Corp'), (SELECT id FROM public.users WHERE email = 'collector@compliancefirst.com'), (SELECT id FROM public.users WHERE email = 'manager@compliancefirst.com'));

-- Insert subtasks for GST Return
INSERT INTO public.subtasks (task_id, title, is_done, sort_order, completed_by) VALUES
((SELECT id FROM public.tasks WHERE title = 'GST Return - Client ABC Ltd'), 'Collect sales invoices', true, 1, (SELECT id FROM public.users WHERE email = 'employee1@compliancefirst.com')),
((SELECT id FROM public.tasks WHERE title = 'GST Return - Client ABC Ltd'), 'Verify input tax credit', false, 2, NULL),
((SELECT id FROM public.tasks WHERE title = 'GST Return - Client ABC Ltd'), 'File online return', false, 3, NULL);

-- Insert subtasks for Audit task
INSERT INTO public.subtasks (task_id, title, is_done, sort_order, completed_by) VALUES
((SELECT id FROM public.tasks WHERE title = 'Audit Documents - GHI Ltd'), 'Gather financial statements', true, 1, (SELECT id FROM public.users WHERE email = 'senior@compliancefirst.com')),
((SELECT id FROM public.tasks WHERE title = 'Audit Documents - GHI Ltd'), 'Prepare reconciliation sheets', true, 2, (SELECT id FROM public.users WHERE email = 'senior@compliancefirst.com')),
((SELECT id FROM public.tasks WHERE title = 'Audit Documents - GHI Ltd'), 'Review supporting documents', false, 3, NULL);

-- Insert comments
INSERT INTO public.comments (task_id, user_id, content) VALUES
((SELECT id FROM public.tasks WHERE title = 'GST Return - Client ABC Ltd'), (SELECT id FROM public.users WHERE email = 'employee1@compliancefirst.com'), 'Started working on sales invoice collection. Found 23 invoices so far.'),
((SELECT id FROM public.tasks WHERE title = 'Audit Documents - GHI Ltd'), (SELECT id FROM public.users WHERE email = 'senior@compliancefirst.com'), 'All financial statements are ready. Just need final approval on supporting docs.'),
((SELECT id FROM public.tasks WHERE title = 'TDS Return Q3 - DEF Corp'), (SELECT id FROM public.users WHERE email = 'manager@compliancefirst.com'), 'Waiting for client to provide Form 16. Followed up via email.');

-- Insert task history
INSERT INTO public.task_history (task_id, user_id, action, new_value) VALUES
((SELECT id FROM public.tasks WHERE title = 'GST Return - Client ABC Ltd'), (SELECT id FROM public.users WHERE email = 'manager@compliancefirst.com'), 'Task Created', '{"status": "not_started"}'::jsonb),
((SELECT id FROM public.tasks WHERE title = 'GST Return - Client ABC Ltd'), (SELECT id FROM public.users WHERE email = 'manager@compliancefirst.com'), 'Assigned to Employee', '{"assigned_to": "employee1@compliancefirst.com"}'::jsonb),
((SELECT id FROM public.tasks WHERE title = 'GST Return - Client ABC Ltd'), (SELECT id FROM public.users WHERE email = 'employee1@compliancefirst.com'), 'Status Changed', '{"status": "in_progress"}'::jsonb);

-- Insert notifications
INSERT INTO public.notifications (user_id, task_id, type, title, message, is_read) VALUES
((SELECT id FROM public.users WHERE email = 'employee1@compliancefirst.com'), (SELECT id FROM public.tasks WHERE title = 'GST Return - Client ABC Ltd'), 'task_assigned', 'New Task Assigned', 'You have been assigned: GST Return - Client ABC Ltd', true),
((SELECT id FROM public.users WHERE email = 'employee2@compliancefirst.com'), (SELECT id FROM public.tasks WHERE title = 'Income Tax Filing - Individual XYZ'), 'task_assigned', 'New Task Assigned', 'You have been assigned: Income Tax Filing - Individual XYZ', false),
((SELECT id FROM public.users WHERE email = 'collector@compliancefirst.com'), (SELECT id FROM public.tasks WHERE title = 'TDS Return Q3 - DEF Corp'), 'task_pending', 'Task Marked Pending', 'Task requires data: TDS Return Q3 - DEF Corp', false),
((SELECT id FROM public.users WHERE email = 'senior@compliancefirst.com'), (SELECT id FROM public.tasks WHERE title = 'Audit Documents - GHI Ltd'), 'task_review', 'Task Ready for Review', 'Please review: Audit Documents - GHI Ltd', false);