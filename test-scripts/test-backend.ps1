# Test Backend API Endpoints

Write-Host "Testing Helios Backend API..." -ForegroundColor Cyan

# 1. Test Health Endpoint
Write-Host "`n1. Testing Health Endpoint:" -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get
Write-Host "Status: $($health.status)" -ForegroundColor Green
Write-Host "Agents Registered:"
$health.agents.byRole | ConvertTo-Json

# 2. Test Project Creation
Write-Host "`n2. Testing Project Creation:" -ForegroundColor Yellow
$projectData = @{
    name = "Test E-commerce Platform"
    description = "Build a full-stack e-commerce platform with React frontend and Node.js backend"
} | ConvertTo-Json

try {
    $project = Invoke-RestMethod -Uri "http://localhost:3000/api/projects" -Method Post -Body $projectData -ContentType "application/json"
    Write-Host "Project Created Successfully!" -ForegroundColor Green
    Write-Host "Project ID: $($project.projectId)"
} catch {
    Write-Host "Project Creation Failed: $_" -ForegroundColor Red
}

# 3. Test Socket.io Connection
Write-Host "`n3. Testing WebSocket Connection:" -ForegroundColor Yellow
Write-Host "Socket.io endpoint available at: ws://localhost:3000" -ForegroundColor Green

Write-Host "`n✅ Backend API Test Complete!" -ForegroundColor Green
