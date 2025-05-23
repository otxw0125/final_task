$ApiUrl = "http://localhost:3000/api/raw-to-angle"
$LoopCount = 5

Write-Host "Attempting to process $LoopCount RawSensorData entries via $ApiUrl..."

for ($i = 1; $i -le $LoopCount; $i++) {
    Write-Host "`n--- Processing attempt #$i ---"
    
    $body = @{
        processOldestUnprocessed = $true
    } | ConvertTo-Json
    
    Write-Host "Request Body: $body"
    
    try {
        $response = Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $body -ContentType "application/json" -TimeoutSec 60
        Write-Host "Response for attempt #$i :"
        Write-Host ($response | ConvertTo-Json -Depth 5)
        Write-Host "-------------------------------------"
    }
    catch {
        Write-Error "Error during attempt #$i : $_"
        if ($_.Exception.Response) {
            $errorResponse = $_.Exception.Response.GetResponseStream()
            $streamReader = New-Object System.IO.StreamReader($errorResponse)
            $errorBody = $streamReader.ReadToEnd()
            $streamReader.Close()
            $errorResponse.Close()
            Write-Error "Response content (if any): $errorBody"
        } else {
            Write-Error "No response content available."
        }
        Write-Host "-------------------------------------"
    }
    
    # API 호출 사이에 약간의 지연을 주어 서버 부하를 줄이고, 
    # 이전 요청이 완료될 시간을 확보합니다. (선택 사항)
    # Start-Sleep -Milliseconds 500 
}

Write-Host "`nFinished $LoopCount processing attempts." 