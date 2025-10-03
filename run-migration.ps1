# PowerShell script to run the database migration
# This script helps you migrate the database to the new schema

Write-Host "=== Database Migration Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
$supabaseInstalled = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseInstalled) {
    Write-Host "ERROR: Supabase CLI is not installed." -ForegroundColor Red
    Write-Host "Please install it from: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    exit 1
}

Write-Host "Step 1: Checking Supabase connection..." -ForegroundColor Green
supabase status

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "WARNING: Supabase is not running locally." -ForegroundColor Yellow
    Write-Host "Do you want to:" -ForegroundColor Yellow
    Write-Host "  1. Start local Supabase (supabase start)" -ForegroundColor White
    Write-Host "  2. Push to remote Supabase (requires project linked)" -ForegroundColor White
    Write-Host "  3. Exit" -ForegroundColor White
    
    $choice = Read-Host "Enter your choice (1-3)"
    
    switch ($choice) {
        "1" {
            Write-Host "Starting local Supabase..." -ForegroundColor Green
            supabase start
        }
        "2" {
            Write-Host "Proceeding with remote push..." -ForegroundColor Green
        }
        "3" {
            Write-Host "Exiting..." -ForegroundColor Yellow
            exit 0
        }
        default {
            Write-Host "Invalid choice. Exiting..." -ForegroundColor Red
            exit 1
        }
    }
}

Write-Host ""
Write-Host "Step 2: Running database migration..." -ForegroundColor Green
Write-Host "Migration file: supabase/migrations/20251003093300_migrate_to_new_schema.sql" -ForegroundColor Cyan

# Ask for confirmation
Write-Host ""
Write-Host "This migration will:" -ForegroundColor Yellow
Write-Host "  - Add new enums: difficulty_level, assignment_type, recurrence_frequency" -ForegroundColor White
Write-Host "  - Create tables: recurring_tasks, subtask_templates" -ForegroundColor White
Write-Host "  - Modify users table: remove specialty, workload columns; add current_task_count" -ForegroundColor White
Write-Host "  - Add difficulty column to tasks table" -ForegroundColor White
Write-Host "  - Add assignment_type column to task_assignments table" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Do you want to proceed? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "Migration cancelled." -ForegroundColor Yellow
    exit 0
}

# Run the migration
Write-Host ""
Write-Host "Pushing migration to database..." -ForegroundColor Green
supabase db push

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== Migration Completed Successfully! ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Review the MIGRATION_GUIDE.md for details" -ForegroundColor White
    Write-Host "  2. Test task creation with new difficulty field" -ForegroundColor White
    Write-Host "  3. Test task assignment with new assignment types" -ForegroundColor White
    Write-Host "  4. Implement recurring task generator (see guide)" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "=== Migration Failed ===" -ForegroundColor Red
    Write-Host "Please check the error messages above." -ForegroundColor Yellow
    Write-Host "You may need to:" -ForegroundColor Yellow
    Write-Host "  - Fix any SQL errors in the migration file" -ForegroundColor White
    Write-Host "  - Check if tables/columns already exist" -ForegroundColor White
    Write-Host "  - Review the rollback plan in MIGRATION_GUIDE.md" -ForegroundColor White
    Write-Host ""
    exit 1
}
