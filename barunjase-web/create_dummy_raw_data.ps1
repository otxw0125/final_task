param(
    [int]$StartNumber = 90001,
    [int]$Count = 5,
    [string]$ApiUrl = "http://localhost:3000/api/sensor-data/raw"
)

Write-Host "Generating $Count dummy RawSensorData entries starting from number $StartNumber..."

for ($i = 0; $i -lt $Count; $i++) {
    $currentNumber = $StartNumber + $i
    $timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
    
    # Simulate more realistic accelerometer data with posture variations
    # X, Y: posture changes from baseline position
    $accelX = (Get-Random -Minimum -3.0 -Maximum 3.0).ToString("F2")
    $accelY = (Get-Random -Minimum -3.0 -Maximum 3.0).ToString("F2")
    # Z: more realistic gravity component variations (8.5 to 10.5 m/s²)
    $accelZ = (Get-Random -Minimum 8.5 -Maximum 10.5).ToString("F2")

    $body = @{
        number    = $currentNumber
        accel     = @{
            x = [double]$accelX
            y = [double]$accelY
            z = [double]$accelZ
        }
        timestamp = $timestamp
    } | ConvertTo-Json -Depth 3

    Write-Host "Sending data for number: $currentNumber"
    Write-Host "Request Body: $body"
    
    try {
        $response = Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $body -ContentType "application/json"
        Write-Host "Response for $currentNumber :"
        Write-Host ($response | ConvertTo-Json -Depth 3)
        Write-Host "-------------------------------------"
    }
    catch {
        Write-Error "Error sending data for $currentNumber : $_"
        Write-Error "Response content (if any): $($_.Exception.Response.GetResponseStream() | ForEach-Object {(New-Object System.IO.StreamReader($_)).ReadToEnd()})"
        Write-Host "-------------------------------------"
    }
    
    # Add a small delay if needed, e.g., Start-Sleep -Milliseconds 100
}

Write-Host "Dummy data generation finished." 