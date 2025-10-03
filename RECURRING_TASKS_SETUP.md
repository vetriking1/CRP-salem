# Recurring Tasks Management Setup Guide

## Overview
This feature allows admin and data_collector users to create recurring tasks that automatically generate and assign tasks to users on a weekly, monthly, or yearly basis.

## Database Setup

### Step 1: Run the Schema SQL
1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Copy and paste the contents of `recurring_tasks_schema.sql`
4. Click "Run" to execute the SQL

This will create:
- `recurrence_frequency` enum type
- `recurring_tasks` table
- Indexes for performance
- Row Level Security (RLS) policies
- Helper functions for date calculations
- Triggers for automatic date updates

### Step 2: Run the Task Generator Function
1. In the SQL Editor, copy and paste the contents of `recurring_task_generator.sql`
2. Click "Run" to execute the SQL

This creates the `generate_recurring_tasks()` function that automatically creates tasks from recurring task schedules.

## Automatic Task Generation

You have two options to automatically generate tasks:

### Option 1: Manual Trigger (For Testing)
Run this SQL query manually to generate tasks:
```sql
SELECT * FROM generate_recurring_tasks();
```

### Option 2: Scheduled Execution (Recommended for Production)

#### Using Supabase Edge Functions:
1. Create a new edge function:
```bash
supabase functions new recurring-task-generator
```

2. Add this code to the function:
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data, error } = await supabaseClient.rpc('generate_recurring_tasks')

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true, generated: data }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
```

3. Deploy the function:
```bash
supabase functions deploy recurring-task-generator
```

4. Set up a cron trigger in Supabase Dashboard:
   - Go to Database → Cron Jobs
   - Create a new cron job
   - Schedule: `0 0 * * *` (runs daily at midnight)
   - Command: Call your edge function

#### Using pg_cron (if available):
```sql
SELECT cron.schedule(
  'generate-recurring-tasks',
  '0 0 * * *',
  'SELECT generate_recurring_tasks();'
);
```

## Features

### For Admin and Data Collector:
- Create recurring tasks with weekly, monthly, or yearly schedules
- Assign tasks to specific users
- Set priority, difficulty, and estimated hours
- Link to task templates for automatic subtask creation
- Assign to teams
- Activate/deactivate recurring tasks
- Edit and delete recurring tasks

### Automatic Task Generation:
- Tasks are automatically created based on the schedule
- Tasks are automatically assigned to the specified user
- Subtasks are created if a template is linked
- Notifications are sent to assigned users
- Due dates are calculated based on recurrence frequency:
  - Weekly: 7 days from generation
  - Monthly: 30 days from generation
  - Yearly: 365 days from generation

### Recurrence Options:

#### Weekly:
- Select a day of the week (Sunday - Saturday)
- Task generates every week on that day

#### Monthly:
- Select a day of the month (1-31)
- Task generates on that day each month

#### Yearly:
- Select a specific month and date
- Task generates once per year on that date

## Usage

### Creating a Recurring Task:
1. Navigate to Tasks page
2. Click "Recurring Tasks" button (visible to admin and data_collector only)
3. Click "Create Recurring Task"
4. Fill in the form:
   - Task Title (required)
   - Description
   - Assign To (required) - Select the user who will receive the task
   - Team (optional)
   - Task Template (optional) - Automatically adds subtasks
   - Priority, Difficulty, Estimated Hours
   - Recurrence Frequency (weekly/monthly/yearly)
   - Schedule details based on frequency
5. Click OK to save

### Managing Recurring Tasks:
- **View**: See all recurring tasks in a table
- **Edit**: Click Edit button to modify a recurring task
- **Delete**: Click Delete button to remove a recurring task
- **Activate/Deactivate**: Use the toggle switch to enable/disable task generation

### Monitoring:
- "Next Generation" column shows when the next task will be created
- "Last Generated At" field tracks when the last task was created
- Check the tasks list to see generated tasks

## Database Schema

### recurring_tasks table:
- `id`: UUID primary key
- `title`: Task title
- `description`: Task description
- `template_id`: Link to task template
- `team_id`: Link to team
- `assigned_user_id`: User who will receive the task
- `priority`: Task priority (low/medium/high/urgent)
- `difficulty`: Task difficulty (easy/medium/hard/expert)
- `estimated_hours`: Estimated hours to complete
- `recurrence_frequency`: weekly/monthly/yearly
- `recurrence_day`: Day of week (0-6) or day of month (1-31)
- `recurrence_month`: Month (1-12) for yearly
- `recurrence_date`: Specific date for yearly
- `is_active`: Enable/disable task generation
- `last_generated_at`: Timestamp of last task generation
- `next_generation_date`: Date when next task will be generated
- `created_by`: User who created the recurring task
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

## Troubleshooting

### Tasks not generating automatically:
1. Check if the recurring task is active (is_active = true)
2. Verify next_generation_date is in the past or today
3. Check if the scheduled job is running
4. Manually run: `SELECT * FROM generate_recurring_tasks();`

### Permission errors:
1. Verify RLS policies are created
2. Check user role is 'admin' or 'data_collector'
3. Ensure user is authenticated

### Date calculation issues:
1. Check recurrence_day, recurrence_month, recurrence_date values
2. Verify the calculate_next_generation_date function is working
3. Test with: `SELECT calculate_next_generation_date('weekly', 1, NULL, NULL);`

## Notes

- Only admin and data_collector roles can access recurring tasks management
- Generated tasks have status 'not_started'
- Assignment type is set to 'auto' for generated tasks
- Notifications are automatically sent to assigned users
- Recurring tasks can be temporarily disabled without deletion
- Next generation date is automatically calculated and updated after each generation
