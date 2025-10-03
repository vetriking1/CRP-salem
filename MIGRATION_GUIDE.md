# Database Migration Guide

## Overview
This guide explains the database schema migration to align with the new requirements. The migration adds support for recurring tasks, subtask templates, task difficulty levels, and assignment types.

## Schema Changes

### New Enums Added
1. **`difficulty_level`**: `'easy' | 'medium' | 'hard'`
   - Used for task difficulty classification
   - Helps with workload estimation and auto-assignment

2. **`assignment_type`**: `'primary' | 'reviewer' | 'collaborator'`
   - Defines the type of task assignment
   - Enables multiple assignment roles per task

3. **`recurrence_frequency`**: `'weekly' | 'monthly' | 'yearly'`
   - Controls recurring task generation frequency

### New Tables

#### `recurring_tasks`
Stores recurring task definitions that automatically generate tasks.

**Columns:**
- `id` (UUID, PK)
- `title` (TEXT, required)
- `description` (TEXT)
- `template_id` (UUID, FK → task_templates)
- `team_id` (UUID, FK → teams, required)
- `priority` (priority enum, default: 'medium')
- `difficulty` (difficulty_level enum, default: 'medium')
- `estimated_hours` (NUMERIC, default: 0)
- `recurrence_frequency` (recurrence_frequency enum, required)
- `recurrence_day` (INTEGER) - Day of week (1-7) or day of month (1-31)
- `recurrence_month` (INTEGER) - Month (1-12) for yearly recurrence
- `recurrence_date` (DATE) - Specific date for yearly recurrence
- `is_active` (BOOLEAN, default: true)
- `last_generated_at` (TIMESTAMPTZ)
- `next_generation_date` (DATE) - Auto-calculated
- `created_by` (UUID, FK → users, required)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Features:**
- Automatic next generation date calculation via trigger
- RLS policies for admin and data_collector roles
- Indexes on next_generation_date and team_id

#### `subtask_templates`
Templates for subtasks that can be used when creating tasks from templates.

**Columns:**
- `id` (UUID, PK)
- `task_template_id` (UUID, FK → task_templates)
- `title` (TEXT, required)
- `description` (TEXT)
- `sort_order` (INTEGER, default: 0)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### Modified Tables

#### `users`
**Removed columns:**
- `specialty`
- `max_capacity_hours`
- `current_workload_hours`

**Added columns:**
- `current_task_count` (NUMERIC, default: 0) - Tracks active task count

#### `tasks`
**Added columns:**
- `difficulty` (difficulty_level enum, default: 'medium')

#### `task_assignments`
**Added columns:**
- `assignment_type` (assignment_type enum) - Defines assignment role

## Migration Steps

### 1. Run the Migration SQL
Execute the migration file in your Supabase SQL Editor:

```bash
# The migration file is located at:
supabase/migrations/20251003093300_migrate_to_new_schema.sql
```

Or push to Supabase:
```bash
supabase db push
```

### 2. Update TypeScript Types
The TypeScript types have been updated in:
- `src/integrations/supabase/types.ts`

If you need to regenerate types from Supabase:
```bash
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

### 3. Code Changes Made

#### `src/services/autoAssignmentService.ts`
- Updated difficulty type from `'easy' | 'medium' | 'hard' | 'expert'` to `'easy' | 'medium' | 'hard'`
- Changed assignment_type from `'initial'` to `'primary'`
- Changed assignment_type from `'pending_reroute'` to `'reviewer'`
- Removed references to removed user fields (specialty, workload_hours)
- Updated workload calculation to use task count instead

#### `src/pages/CreateTask.tsx`
- Removed "expert" difficulty option from UI
- Updated difficulty type constraints to match new schema

## Recurring Tasks Feature

### How It Works
1. Create a recurring task definition with:
   - Frequency (weekly/monthly/yearly)
   - Recurrence parameters (day, month, date)
   - Task template (optional)
   - Team assignment

2. The system automatically calculates `next_generation_date` via trigger

3. A scheduled job (to be implemented) will:
   - Check for recurring tasks where `next_generation_date <= CURRENT_DATE`
   - Generate actual tasks from the recurring task definition
   - Update `last_generated_at` and recalculate `next_generation_date`

### Functions Available
- `calculate_next_generation_date()` - Calculates next occurrence date
- `set_next_generation_date()` - Trigger function to auto-set next date

## Assignment Types

The new `assignment_type` field in `task_assignments` allows for:
- **primary**: Main assignee responsible for task completion
- **reviewer**: Person assigned to review the task
- **collaborator**: Additional team member collaborating on the task

This enables multiple people to be assigned to a task with different roles.

## Rollback Plan

If you need to rollback this migration:

```sql
-- Drop new tables
DROP TABLE IF EXISTS public.recurring_tasks CASCADE;
DROP TABLE IF EXISTS public.subtask_templates CASCADE;

-- Remove new columns
ALTER TABLE public.users DROP COLUMN IF EXISTS current_task_count;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS difficulty;
ALTER TABLE public.task_assignments DROP COLUMN IF EXISTS assignment_type;

-- Drop new enums
DROP TYPE IF EXISTS difficulty_level;
DROP TYPE IF EXISTS assignment_type;
DROP TYPE IF EXISTS recurrence_frequency;

-- Re-add old columns to users (if needed)
ALTER TABLE public.users 
  ADD COLUMN specialty TEXT,
  ADD COLUMN max_capacity_hours INTEGER DEFAULT 40,
  ADD COLUMN current_workload_hours DECIMAL(10,2) DEFAULT 0;
```

## Testing Checklist

- [ ] Migration runs without errors
- [ ] All existing tasks display correctly
- [ ] Task creation works with new difficulty field
- [ ] Task assignment works with new assignment_type
- [ ] Recurring tasks can be created
- [ ] Subtask templates can be created and used
- [ ] Auto-assignment service works correctly
- [ ] No TypeScript errors in the codebase

## Next Steps

1. **Implement Recurring Task Generator**
   - Create a scheduled Edge Function or cron job
   - Query recurring tasks due for generation
   - Create tasks from recurring task definitions
   - Update last_generated_at and next_generation_date

2. **UI for Recurring Tasks**
   - Create page to manage recurring tasks
   - Add UI to create/edit recurring task definitions
   - Display upcoming recurring task generations

3. **UI for Subtask Templates**
   - Add subtask template management to task templates
   - Show subtask templates when creating tasks from templates

4. **Enhanced Assignment UI**
   - Show assignment types in task details
   - Allow assigning multiple people with different roles
   - Display primary assignee, reviewers, and collaborators separately

## Support

If you encounter any issues during migration:
1. Check the migration logs for errors
2. Verify all enum values match the schema
3. Ensure RLS policies are correctly applied
4. Review the TypeScript types for consistency
