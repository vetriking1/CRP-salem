# PowerShell script to link Supabase project and run migrations
# This script helps you connect to your remote Supabase project and migrate

Write-Host "=== Supabase Project Link & Migration ===" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
$supabaseInstalled = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseInstalled) {
    Write-Host "ERROR: Supabase CLI is not installed." -ForegroundColor Red
    Write-Host "Please install it from: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    exit 1
}

Write-Host "Step 1: Link to Supabase Project" -ForegroundColor Green
Write-Host ""
Write-Host "You need your Supabase project reference ID." -ForegroundColor Yellow
Write-Host "Find it at: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/general" -ForegroundColor Cyan
Write-Host ""

$projectRef = Read-Host "Enter your Supabase Project Reference ID (or 'skip' if already linked)"

if ($projectRef -ne "skip" -and $projectRef -ne "") {
    Write-Host ""
    Write-Host "Linking to project: $projectRef" -ForegroundColor Green
    supabase link --project-ref $projectRef
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "ERROR: Failed to link project." -ForegroundColor Red
        Write-Host "Please check your project reference ID and try again." -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host ""
    Write-Host "✓ Project linked successfully!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 2: Review Migrations to Apply" -ForegroundColor Green
Write-Host ""
Write-Host "The following migrations will be applied:" -ForegroundColor Cyan
Write-Host "  1. 20251003093300_migrate_to_new_schema.sql" -ForegroundColor White
Write-Host "     - Adds new enums and tables" -ForegroundColor Gray
Write-Host "     - Modifies existing tables" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. 20251003094000_drop_old_functions.sql" -ForegroundColor White
Write-Host "     - Drops old functions using removed columns" -ForegroundColor Gray
Write-Host "     - Creates new task count tracking" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. 20251003095400_fix_notifications_and_assignment.sql" -ForegroundColor White
Write-Host "     - Creates missing notification function" -ForegroundColor Gray
Write-Host "     - Implements smart auto-assignment based on workload" -ForegroundColor Gray
Write-Host "     - Syncs task counts automatically" -ForegroundColor Gray
Write-Host ""

$confirm = Read-Host "Do you want to proceed with migration? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "Migration cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Step 3: Pushing Migrations to Database..." -ForegroundColor Green
supabase db push

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== Migration Completed Successfully! ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "✓ Database schema updated" -ForegroundColor Green
    Write-Host "✓ Old functions removed" -ForegroundColor Green
    Write-Host "✓ New features enabled" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Test task creation in your app" -ForegroundColor White
    Write-Host "  2. Verify difficulty levels work" -ForegroundColor White
    Write-Host "  3. Test task assignments" -ForegroundColor White
    Write-Host ""
    Write-Host "Your app should now work without errors! 🎉" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "=== Migration Failed ===" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "  - Check if you have the correct permissions" -ForegroundColor White
    Write-Host "  - Verify your project is linked correctly" -ForegroundColor White
    Write-Host "  - Check if migrations were already applied" -ForegroundColor White
    Write-Host ""
    Write-Host "To check migration status:" -ForegroundColor Cyan
    Write-Host "  supabase migration list" -ForegroundColor White
    Write-Host ""
    exit 1
}
