# Fix: Column current_workload_hours Does Not Exist

## 🔴 The Problem

You're getting this error:
```
column u.current_workload_hours does not exist
```

**Root Cause:** Old database functions/triggers are still referencing removed columns (`current_workload_hours`, `max_capacity_hours`, `specialty`).

---

## ✅ The Solution

### Step 1: Link Your Supabase Project

Run the new script that will link your project and apply both migrations:

```powershell
.\link-and-migrate.ps1
```

This script will:
1. ✅ Link to your remote Supabase project
2. ✅ Apply the schema migration (adds new tables/columns)
3. ✅ Drop old functions that reference removed columns
4. ✅ Create new task count tracking system

### Step 2: What You Need

**Your Supabase Project Reference ID:**
- Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/general
- Copy the "Reference ID" (looks like: `pvavhbkzfbzexczfpkif`)

---

## 📋 What the Fix Does

### Migration 1: `20251003093300_migrate_to_new_schema.sql`
- Adds new enums and tables
- Removes old columns from users table
- Adds new columns to tasks and task_assignments

### Migration 2: `20251003094000_drop_old_functions.sql` (NEW)
- ❌ Drops `auto_assign_task()` function (uses old columns)
- ❌ Drops `update_user_workload()` function (uses old columns)
- ✅ Creates `update_user_task_count()` function (uses new column)
- ✅ Initializes `current_task_count` for all users

---

## 🚀 Quick Start

```powershell
# Run this command
.\link-and-migrate.ps1

# When prompted:
# 1. Enter your Supabase Project Reference ID
# 2. Type "yes" to confirm migration
# 3. Wait for completion
```

---

## 🔍 Alternative: Manual Migration

If you prefer to do it manually:

### Option A: Via Supabase Dashboard

1. **Go to SQL Editor** in your Supabase Dashboard

2. **Run Migration 1:**
   - Copy contents from: `supabase/migrations/20251003093300_migrate_to_new_schema.sql`
   - Execute in SQL Editor

3. **Run Migration 2:**
   - Copy contents from: `supabase/migrations/20251003094000_drop_old_functions.sql`
   - Execute in SQL Editor

### Option B: Via CLI

```bash
# Link your project first
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push
```

---

## ✅ Verification

After migration, test:

1. **Create a Task**
   - Go to Create Task page
   - Fill in details
   - Click "Create Task"
   - ✅ Should work without errors

2. **Check Database**
   ```sql
   -- Verify old columns are gone
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'users' 
   AND column_name IN ('specialty', 'current_workload_hours', 'max_capacity_hours');
   -- Should return 0 rows
   
   -- Verify new column exists
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'users' 
   AND column_name = 'current_task_count';
   -- Should return 1 row
   
   -- Verify old functions are gone
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_name IN ('auto_assign_task', 'update_user_workload');
   -- Should return 0 rows
   ```

---

## 🆘 Troubleshooting

### Error: "Cannot find project ref"
**Solution:** Run `.\link-and-migrate.ps1` and enter your project reference ID

### Error: "Permission denied"
**Solution:** Make sure you're logged in to Supabase CLI:
```bash
supabase login
```

### Error: "Migration already applied"
**Solution:** Check which migrations are applied:
```bash
supabase migration list
```

If only the first migration is applied, manually run the second:
```bash
supabase db push
```

### Error: "Function does not exist"
**Solution:** This is okay - it means the old functions are already removed

---

## 📊 What Changed

| Before | After |
|--------|-------|
| ❌ `current_workload_hours` | ✅ `current_task_count` |
| ❌ `max_capacity_hours` | ✅ (removed) |
| ❌ `specialty` | ✅ (removed) |
| ❌ `auto_assign_task()` function | ✅ Uses service layer |
| ❌ `update_user_workload()` function | ✅ `update_user_task_count()` |

---

## 🎯 Expected Result

After running the migration:
- ✅ No more "column does not exist" errors
- ✅ Task creation works perfectly
- ✅ Task assignment works correctly
- ✅ User task counts are tracked automatically
- ✅ All TypeScript code compiles without errors

---

## 📞 Still Having Issues?

1. Check the migration logs for specific errors
2. Verify you're connected to the correct Supabase project
3. Ensure you have admin permissions on the project
4. Try running migrations one at a time via SQL Editor

---

**Ready to fix?** Run: `.\link-and-migrate.ps1` 🚀
