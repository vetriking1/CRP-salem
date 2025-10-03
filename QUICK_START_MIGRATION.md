# Quick Start: Database Migration

## 🚀 Run the Migration in 3 Steps

### Step 1: Review What Will Change
The migration will:
- ✅ Add 3 new enums (difficulty_level, assignment_type, recurrence_frequency)
- ✅ Create 2 new tables (recurring_tasks, subtask_templates)
- ✅ Modify 3 existing tables (users, tasks, task_assignments)
- ✅ Remove unused columns from users table
- ✅ Add new columns for difficulty and assignment types

### Step 2: Run the Migration

**Option A: Using PowerShell Script (Easiest)**
```powershell
.\run-migration.ps1
```

**Option B: Using Supabase CLI**
```bash
# Make sure Supabase is running
supabase status

# Push the migration
supabase db push
```

**Option C: Manual via Supabase Dashboard**
1. Open Supabase Dashboard → SQL Editor
2. Copy contents from: `supabase/migrations/20251003093300_migrate_to_new_schema.sql`
3. Execute the SQL

### Step 3: Verify Migration Success

**Check 1: No Errors**
- Migration should complete without errors
- All tables should be created successfully

**Check 2: Test Task Creation**
1. Go to Create Task page
2. Select difficulty (Easy/Medium/Hard)
3. Create a task
4. Verify it saves correctly

**Check 3: Check TypeScript**
```bash
npm run build
# or
npm run type-check
```
Should complete without errors.

---

## 📚 Documentation

- **`MIGRATION_SUMMARY.md`** - Overview of all changes
- **`MIGRATION_GUIDE.md`** - Detailed technical guide
- **`run-migration.ps1`** - Automated migration script

---

## ⚠️ Important Notes

1. **Backup First** (if in production)
   ```bash
   # Backup your database before migrating
   supabase db dump -f backup.sql
   ```

2. **Test Locally First**
   - Run migration on local Supabase instance
   - Test all features
   - Then deploy to production

3. **No Data Loss**
   - Migration is additive (adds new features)
   - Removes only unused columns (specialty, workload_hours)
   - All existing tasks and assignments remain intact

---

## 🆘 Troubleshooting

### Issue: "Supabase CLI not found"
**Solution:** Install Supabase CLI
```bash
npm install -g supabase
```

### Issue: "Migration fails with constraint error"
**Solution:** Check if tables already exist
```sql
-- Check existing tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('recurring_tasks', 'subtask_templates');
```

### Issue: "TypeScript errors after migration"
**Solution:** Regenerate types
```bash
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

---

## ✅ Success Checklist

After migration, you should be able to:
- [ ] Create tasks with difficulty levels (Easy/Medium/Hard)
- [ ] Assign tasks with assignment types (Primary/Reviewer/Collaborator)
- [ ] View all existing tasks without errors
- [ ] Auto-assignment works correctly
- [ ] No TypeScript compilation errors

---

## 🎯 What's Next?

After successful migration:

1. **Implement Recurring Tasks UI**
   - Create page to manage recurring task definitions
   - Add UI to view upcoming task generations

2. **Implement Task Generator**
   - Create Edge Function or cron job
   - Generate tasks from recurring definitions
   - Update next_generation_date

3. **Enhance Assignment UI**
   - Show assignment types in task details
   - Allow multiple assignees with different roles
   - Display primary, reviewers, and collaborators separately

4. **Add Subtask Templates UI**
   - Manage subtask templates in task templates
   - Auto-create subtasks from templates

---

## 🔄 Rollback (If Needed)

If something goes wrong:

```sql
-- Quick rollback (copy from MIGRATION_GUIDE.md)
DROP TABLE IF EXISTS public.recurring_tasks CASCADE;
DROP TABLE IF EXISTS public.subtask_templates CASCADE;
ALTER TABLE public.users DROP COLUMN IF EXISTS current_task_count;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS difficulty;
ALTER TABLE public.task_assignments DROP COLUMN IF EXISTS assignment_type;
DROP TYPE IF EXISTS difficulty_level;
DROP TYPE IF EXISTS assignment_type;
DROP TYPE IF EXISTS recurrence_frequency;
```

---

## 📞 Need Help?

1. Check `MIGRATION_GUIDE.md` for detailed information
2. Review `MIGRATION_SUMMARY.md` for what changed
3. Check migration logs for specific errors
4. Verify RLS policies are correctly applied

---

**Ready to migrate? Run:** `.\run-migration.ps1` 🚀
