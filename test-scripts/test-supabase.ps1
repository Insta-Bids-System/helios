# Test Supabase Integration

Write-Host "Testing Helios Supabase Integration..." -ForegroundColor Cyan

# 1. Test Health Endpoint
Write-Host "`n1. Testing Health Endpoint:" -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get
Write-Host "Backend Status: $($health.status)" -ForegroundColor Green

# 2. Test Monitoring Endpoint
Write-Host "`n2. Testing Monitoring Endpoints:" -ForegroundColor Yellow
try {
    $agents = Invoke-RestMethod -Uri "http://localhost:3000/api/monitor/agents" -Method Get
    Write-Host "✅ Agent monitoring endpoint working" -ForegroundColor Green
    Write-Host "   Total logs in Supabase: $($agents.totalLogs)"
    Write-Host "   Supabase URL: $($agents.monitoring.supabaseUrl)"
} catch {
    Write-Host "❌ Monitoring endpoint not accessible: $_" -ForegroundColor Red
}

# 3. Create a test project
Write-Host "`n3. Creating Test Project:" -ForegroundColor Yellow
$projectData = @{
    name = "Supabase Integration Test"
    description = "Testing Helios with Supabase backend"
} | ConvertTo-Json

try {
    $project = Invoke-RestMethod -Uri "http://localhost:3000/api/projects" -Method Post -Body $projectData -ContentType "application/json"
    Write-Host "✅ Project Created Successfully!" -ForegroundColor Green
    Write-Host "   Project ID: $($project.id)"
    
    # 4. Test project monitoring
    Write-Host "`n4. Testing Project Monitoring:" -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    
    try {
        $monitoring = Invoke-RestMethod -Uri "http://localhost:3000/api/monitor/projects/$($project.id)/monitor" -Method Get
        Write-Host "✅ Project monitoring data retrieved" -ForegroundColor Green
        Write-Host "   Recent activity count: $($monitoring.recentActivity.Count)"
        Write-Host "   Dashboard URL: $($monitoring.monitoring.dashboardUrl)"
    } catch {
        Write-Host "❌ Could not fetch monitoring data: $_" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Project Creation Failed: $_" -ForegroundColor Red
}

Write-Host "Supabase Dashboard Links:" -ForegroundColor Yellow
Write-Host "   Table Editor: https://supabase.com/dashboard/project/kaeydovooyaxczctsmas/editor" -ForegroundColor Cyan
Write-Host "   SQL Editor: https://supabase.com/dashboard/project/kaeydovooyaxczctsmas/sql/new" -ForegroundColor Cyan
Write-Host "   Realtime: https://supabase.com/dashboard/project/kaeydovooyaxczctsmas/realtime" -ForegroundColor Cyan

Write-Host "`nImportant: Run the init-supabase.sql in the SQL Editor first!" -ForegroundColor Yellow
Write-Host "   File location: packages\backend\sql\init-supabase.sql" -ForegroundColor Yellow

Write-Host "`nSupabase Integration Test Complete!" -ForegroundColor Green
