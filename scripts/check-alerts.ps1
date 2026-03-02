# Price Alert Checker Script for Windows
# This script calls the price alert check API endpoint

# Configuration
$BASE_URL = "http://localhost:3000"
$API_ENDPOINT = "$BASE_URL/api/alerts/check"
$CRON_SECRET = "your-secret-key"  # Replace with your CRON_SECRET from .env

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  H-Stocks Price Alert Checker" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if server is running
Write-Host "[1/3] Checking if server is running..." -ForegroundColor Yellow
try {
    $pingResponse = Invoke-WebRequest -Uri $BASE_URL -Method GET -TimeoutSec 5 -UseBasicParsing
    Write-Host "✓ Server is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Server is not running at $BASE_URL" -ForegroundColor Red
    Write-Host "Please start the development server first: npm run dev" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[2/3] Checking active alerts..." -ForegroundColor Yellow

# Prepare headers
$headers = @{
    "Authorization" = "Bearer $CRON_SECRET"
    "Content-Type" = "application/json"
}

# Call the API
try {
    $response = Invoke-RestMethod -Uri $API_ENDPOINT -Method POST -Headers $headers -TimeoutSec 30
    
    Write-Host "✓ API call successful" -ForegroundColor Green
    Write-Host ""
    Write-Host "[3/3] Results:" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    
    if ($response.success) {
        Write-Host "Status: " -NoNewline -ForegroundColor White
        Write-Host "Success ✓" -ForegroundColor Green
        
        Write-Host "Checked Alerts: " -NoNewline -ForegroundColor White
        Write-Host $response.checkedAlerts -ForegroundColor Cyan
        
        Write-Host "Triggered Alerts: " -NoNewline -ForegroundColor White
        if ($response.triggeredAlerts -gt 0) {
            Write-Host $response.triggeredAlerts -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Triggered Details:" -ForegroundColor Yellow
            foreach ($alert in $response.triggered) {
                Write-Host "  • $($alert.symbol) - Alert #$($alert.alert_id) - Price: `$$($alert.currentPrice)" -ForegroundColor White
            }
        } else {
            Write-Host "0" -ForegroundColor Gray
            Write-Host "  (No alerts triggered at this time)" -ForegroundColor Gray
        }
        
        if ($response.errors -and $response.errors.Count -gt 0) {
            Write-Host ""
            Write-Host "Errors:" -ForegroundColor Red
            foreach ($error in $response.errors) {
                Write-Host "  • $($error.symbol): $($error.error)" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "Status: " -NoNewline -ForegroundColor White
        Write-Host "Failed ✗" -ForegroundColor Red
        Write-Host "Message: $($response.message)" -ForegroundColor Red
    }
    
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "✓ Check completed successfully!" -ForegroundColor Green
    
} catch {
    Write-Host "✗ Error calling API" -ForegroundColor Red
    Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host ""
        Write-Host "Authentication failed. Please check:" -ForegroundColor Yellow
        Write-Host "  1. CRON_SECRET in .env file matches the value in this script" -ForegroundColor White
        Write-Host "  2. Authorization header is correctly formatted" -ForegroundColor White
    }
    
    exit 1
}

Write-Host ""
Write-Host "Next scheduled check: " -NoNewline -ForegroundColor White
Write-Host (Get-Date).AddMinutes(5).ToString("yyyy-MM-dd HH:mm:ss") -ForegroundColor Cyan
Write-Host ""
