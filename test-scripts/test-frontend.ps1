# Test Frontend Accessibility

Write-Host "Testing Helios Frontend..." -ForegroundColor Cyan

# Check if frontend is accessible
Write-Host "`n1. Testing Frontend Server:" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -Method Get
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Frontend is accessible at http://localhost:5173" -ForegroundColor Green
        Write-Host "Page Title: $($response.Content | Select-String -Pattern '<title>(.*?)</title>' | ForEach-Object { $_.Matches[0].Groups[1].Value })"
    }
} catch {
    Write-Host "❌ Frontend is not accessible: $_" -ForegroundColor Red
}

Write-Host "`n2. Open in Browser:" -ForegroundColor Yellow
Write-Host "Navigate to: http://localhost:5173" -ForegroundColor Cyan
Write-Host "You should see the Helios Mission Control interface"

Write-Host "`n✅ Frontend Test Complete!" -ForegroundColor Green
