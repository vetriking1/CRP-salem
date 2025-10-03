# Quick fix script - Run this to fix the enum and column issues
Write-Host "=== Quick Fix: Enums & Columns ===" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
$supabaseInstalled = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseInstalled) {
    Write-Host "ERROR: Supabase CLI is not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Run this SQL in your Supabase Dashboard SQL Editor:" -ForegroundColor Yellow
    Write-Host "File: supabase/migrations/20251003100000_verify_and_fix_enums.sql" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "This will:" -ForegroundColor Green
Write-Host "  ✓ Create missing enums (difficulty_level, assignment_type, recurrence_frequency)" -ForegroundColor White
Write-Host "  ✓ Add missing columns (difficulty, assignment_type, current_task_count)" -ForegroundColor White
Write-Host "  ✓ Remove old columns (specialty, workload fields)" -ForegroundColor White
Write-Host "  ✓ Set default difficulty to 'easy'" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Continue? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Pushing migration..." -ForegroundColor Green
supabase db push

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== Success! ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "✓ Enums created" -ForegroundColor Green
    Write-Host "✓ Columns added" -ForegroundColor Green
    Write-Host "✓ Default difficulty set to 'easy'" -ForegroundColor Green
    Write-Host ""
    Write-Host "Now test your app - task creation should work!" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "=== Failed ===" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running the SQL manually:" -ForegroundColor Yellow
    Write-Host "1. Go to Supabase Dashboard > SQL Editor" -ForegroundColor White
    Write-Host "2. Copy contents from: supabase/migrations/20251003100000_verify_and_fix_enums.sql" -ForegroundColor White
    Write-Host "3. Execute the SQL" -ForegroundColor White
    Write-Host ""
}

Read-Host "Press Enter to exit"
