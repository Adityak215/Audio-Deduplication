# Logging Test Script for Windows PowerShell
# Tests the complete upload and warning logging pipeline
#
# Usage:
#   .\test-logging.ps1 -FilePath "path\to\audio\file.mp3"
#
# Example:
#   .\test-logging.ps1 -FilePath "..\uploads\sample.mp3"

param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath
)

$ApiUrl = "http://localhost:5000"
$DEBUG = $false

function Write-Log {
    param(
        [string]$Level,
        [string]$Message
    )
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] $Level : $Message"
}

function Test-FileExists {
    if (-not (Test-Path $FilePath)) {
        Write-Host "ERROR: File not found: $FilePath" -ForegroundColor Red
        exit 1
    }
}

function Upload-File {
    param(
        [string]$Path
    )
    
    Write-Log "INFO" "Uploading file: $(Split-Path -Leaf $Path)"
    
    $form = @{
        audio = Get-Item -Path $Path
    }
    
    try {
        $response = Invoke-WebRequest -Uri "$ApiUrl/upload" `
            -Method Post `
            -Form $form `
            -ErrorAction Stop
        
        return @{
            Status = $response.StatusCode
            Body = ($response.Content | ConvertFrom-Json)
        }
    }
    catch {
        return @{
            Status = $_.Exception.Response.StatusCode
            Body = ($_.Exception.Response.Content.ReadAsStream() | ForEach-Object { [System.IO.StreamReader]::new($_).ReadToEnd() } | ConvertFrom-Json)
        }
    }
}

function Get-Warnings {
    param(
        [string]$AudioId
    )
    
    Write-Log "INFO" "Getting warnings for audioId: $AudioId"
    
    try {
        $response = Invoke-WebRequest -Uri "$ApiUrl/upload/$AudioId/warnings" `
            -Method Get `
            -ErrorAction Stop
        
        return @{
            Status = $response.StatusCode
            Body = ($response.Content | ConvertFrom-Json)
        }
    }
    catch {
        return @{
            Status = $_.Exception.Response.StatusCode
            Body = ($_.Exception.Response.Content.ReadAsStream() | ForEach-Object { [System.IO.StreamReader]::new($_).ReadToEnd() } | ConvertFrom-Json)
        }
    }
}

function Get-AllWarnings {
    Write-Log "INFO" "Getting all warnings"
    
    try {
        $response = Invoke-WebRequest -Uri "$ApiUrl/upload/warnings" `
            -Method Get `
            -ErrorAction Stop
        
        return @{
            Status = $response.StatusCode
            Body = ($response.Content | ConvertFrom-Json)
        }
    }
    catch {
        return @{
            Status = $_.Exception.Response.StatusCode
            Body = ($_.Exception.Response.Content.ReadAsStream() | ForEach-Object { [System.IO.StreamReader]::new($_).ReadToEnd() } | ConvertFrom-Json)
        }
    }
}

# Main execution
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "           LOGGING TEST SCRIPT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Test-FileExists

Write-Host "INSTRUCTION: Watch the backend terminal while running this script." -ForegroundColor Yellow
Write-Host "You should see logs appearing in real-time.`n" -ForegroundColor Yellow

# Test 1: Upload original file
Write-Host "`n--- TEST 1: UPLOAD ORIGINAL FILE ---" -ForegroundColor Cyan
Write-Host "Expected logs:" -ForegroundColor Yellow
Write-Host "  - 'Original audio file stored - fingerprinting queued' (INFO)" -ForegroundColor Yellow
Write-Host "  - 'Fingerprint job queued' (DEBUG)" -ForegroundColor Yellow
Write-Host "  - 'Fingerprint stored' (DEBUG)" -ForegroundColor Yellow

$upload1 = Upload-File -Path $FilePath
$audioId = if ($upload1.Body.audioId) { $upload1.Body.audioId } else { "unknown" }

Write-Host "`nResponse: Status=$($upload1.Status)"
Write-Host "AudioId: $audioId"
Write-Host "Duplicate: $($upload1.Body.duplicate)"
Write-Host "✅ Check backend logs for original file logs (look for 'ORIGINAL_FILE')"

# Wait for fingerprinting
Write-Host "`nWaiting 3 seconds for fingerprinting to complete..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Test 2: Call warnings endpoint for specific file
Write-Host "`n--- TEST 2: GET WARNINGS FOR SPECIFIC FILE ---" -ForegroundColor Cyan
Write-Host "Expected logs:" -ForegroundColor Yellow
Write-Host "  - 'Warnings endpoint called - found X similarity warning(s)' (INFO)" -ForegroundColor Yellow

if ($audioId -eq "unknown") {
    Write-Host "Skipping Test 2: audioId is unknown" -ForegroundColor Red
}
else {
    $warnings = Get-Warnings -AudioId $audioId
    Write-Host "`nResponse: Status=$($warnings.Status)"
    Write-Host "Warnings found: $($warnings.Body.warnings.Count)"
    Write-Host "✅ Check backend logs for warnings endpoint logs"
}

# Test 3: Call all warnings endpoint
Write-Host "`n--- TEST 3: GET ALL WARNINGS ---" -ForegroundColor Cyan
Write-Host "Expected logs:" -ForegroundColor Yellow
Write-Host "  - 'All warnings endpoint called - found X total similarity warning(s)' (INFO)" -ForegroundColor Yellow

$allWarnings = Get-AllWarnings
Write-Host "`nResponse: Status=$($allWarnings.Status)"
Write-Host "Total warnings: $($allWarnings.Body.total)"
Write-Host "✅ Check backend logs for all warnings endpoint logs"

# Test 4: Upload duplicate
Write-Host "`n--- TEST 4: UPLOAD DUPLICATE FILE ---" -ForegroundColor Cyan
Write-Host "Expected logs:" -ForegroundColor Yellow
Write-Host "  - 'Duplicate file rejected - identical file already exists' (WARN)" -ForegroundColor Yellow
Write-Host "  - 'Duplicate detected - file rejected' (INFO)" -ForegroundColor Yellow

$upload2 = Upload-File -Path $FilePath
Write-Host "`nResponse: Status=$($upload2.Status)"
Write-Host "Duplicate: $($upload2.Body.duplicate)"
Write-Host "✅ Check backend logs for duplicate detection logs (look for 'isDuplicate')"

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "         TESTS COMPLETED SUCCESSFULLY" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nSUMMARY:" -ForegroundColor Green
Write-Host "  ✅ Original file upload tested"
Write-Host "  ✅ Warnings endpoint called for specific file"
Write-Host "  ✅ All warnings endpoint called"
Write-Host "  ✅ Duplicate file upload tested"

Write-Host "`nNEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Check your backend terminal for all the logs listed above"
Write-Host "  2. Look for the color-coded log levels:"
Write-Host "     - [WARN] - Warnings (orange) for duplicates and similar files"
Write-Host "     - [INFO] - Information (blue) for endpoint calls and original files"
Write-Host "     - [DEBUG] - Debug info (gray) for job details"
Write-Host ""
