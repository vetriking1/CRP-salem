# 🔄 Regenerate TypeScript Types

## The Issue

Your database verification shows:
- ✅ `assignment_type` enum EXISTS
- ✅ `assignment_type` column EXISTS in `task_assignments` table
- ❌ But TypeScript types are out of sync

## Solution: Regenerate Types

### Option 1: Using Supabase CLI (If Linked)

```bash
supabase gen types typescript --project-id pvavhbkzfbzexczfpkif > src/integrations/supabase/types.ts
```

### Option 2: Using Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/pvavhbkzfbzexczfpkif/settings/api
2. Scroll to "Project API keys"
3. Copy the TypeScript types
4. Replace contents of `src/integrations/supabase/types.ts`

### Option 3: Manual Update (Quick Fix)

The types file already has the assignment_type enum defined (I added it earlier).

**Just restart your dev server:**
```bash
# Stop the dev server (Ctrl+C)
# Then restart:
npm run dev
```

## After Regenerating

Re-enable assignment_type in the code:

### File: `src/services/autoAssignmentService.ts`

**Line 92 - Uncomment:**
```typescript
assignment_type: "primary",  // ← Remove the comment slashes
```

**Line 193 - Uncomment:**
```typescript
assignment_type: "reviewer",  // ← Remove the comment slashes
```

## Quick Test

After making changes:
1. Restart dev server
2. Create a task
3. Should work with assignment_type now! ✅

---

**TL;DR:** Your database is correct. Just restart your dev server and uncomment the assignment_type lines!
