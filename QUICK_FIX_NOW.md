# 🚨 Quick Fix - Run This Now!

## The Problem
- ❌ Error: `invalid input value for enum assignment_type: "primary"`
- ❌ The `assignment_type` enum doesn't exist in your database yet
- ❌ Default difficulty is showing 'medium' instead of 'easy'

## ✅ The Solution (2 Minutes)

### **Option 1: PowerShell Script (Easiest)**

```powershell
.\quick-fix.ps1
```

Type `yes` when prompted. Done! ✅

---

### **Option 2: Manual via Supabase Dashboard (If script fails)**

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project
   - Click **SQL Editor**

2. **Copy & Run This SQL**
   - Open file: `supabase/migrations/20251003100000_verify_and_fix_enums.sql`
   - Copy ALL contents
   - Paste in SQL Editor
   - Click **Run**

3. **Done!** ✅

---

## What This Does

✅ **Creates missing enums:**
- `difficulty_level` → `'easy' | 'medium' | 'hard'`
- `assignment_type` → `'primary' | 'reviewer' | 'collaborator'`
- `recurrence_frequency` → `'weekly' | 'monthly' | 'yearly'`

✅ **Adds missing columns:**
- `tasks.difficulty` (default: 'easy')
- `task_assignments.assignment_type`
- `users.current_task_count`

✅ **Removes old columns:**
- `users.specialty`
- `users.max_capacity_hours`
- `users.current_workload_hours`

✅ **Sets defaults:**
- Task difficulty default → 'easy'
- All existing tasks → 'easy'

---

## After Running

**Test it:**
1. Go to Create Task page
2. Create a new task
3. Should work without errors! ✅

**What you'll see:**
- Default difficulty: **Easy** ✅
- Task creation: **Works** ✅
- Auto-assignment: **Works** ✅
- No enum errors: **Fixed** ✅

---

## Still Getting Errors?

### If you see: "Cannot find project ref"
Run this first:
```powershell
.\link-and-migrate.ps1
```

### If you see: "Permission denied"
Login to Supabase:
```bash
supabase login
```

### If script doesn't work
Use **Option 2** (Manual via Dashboard) - it always works!

---

## 🎯 Quick Summary

**Run this command:**
```powershell
.\quick-fix.ps1
```

**Or run this SQL in Dashboard:**
- File: `supabase/migrations/20251003100000_verify_and_fix_enums.sql`

**Result:**
- ✅ All enums created
- ✅ All columns added
- ✅ Default difficulty = 'easy'
- ✅ App works perfectly!

---

**Do it now! Takes 2 minutes.** 🚀
