# 1. 서버 초기화
Write-Host "서버 초기화 중..." -ForegroundColor Cyan
Invoke-WebRequest -Uri "http://localhost:3000/api/startup" -Method GET | Format-List

# 2. 센서 데이터 생성 (20개)
Write-Host "`n센서 데이터 생성 중..." -ForegroundColor Cyan
1..20 | ForEach-Object {
  $accelX = [math]::Round((Get-Random -Minimum -0.5 -Maximum 0.5), 2)
  $accelY = [math]::Round((Get-Random -Minimum -0.5 -Maximum 0.5), 2)
  $accelZ = [math]::Round((Get-Random -Minimum 0.7 -Maximum 1.2), 2)
  $body = @{
    number = 2000 + $_
    accel = @{
      x = $accelX
      y = $accelY
      z = $accelZ
    }
  } | ConvertTo-Json
  
  $headers = @{
    "Content-Type" = "application/json"
  }
  
  Invoke-WebRequest -Uri "http://localhost:3000/api/sensor-data/raw" -Method POST -Headers $headers -Body $body | Out-Null
  Start-Sleep -Milliseconds 200
  Write-Host "." -NoNewline
}

# 3. 배치 변환 실행
Write-Host "`n`n배치 변환 실행 중..." -ForegroundColor Cyan
$batchBody = @{
  batchSize = 50
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/batch/transform" -Method POST -Headers @{"Content-Type"="application/json"} -Body $batchBody | Format-List

# 4. 결과 확인
Write-Host "`n`n변환된 각도 데이터 확인 중..." -ForegroundColor Cyan
$result = Invoke-WebRequest -Uri "http://localhost:3000/api/sensor-data/angle?limit=5" -Method GET
$result.Content | ConvertFrom-Json | Format-List

# 5. 집계 데이터 확인
Write-Host "`n`n집계 데이터 확인 중..." -ForegroundColor Cyan
$aggregate = Invoke-WebRequest -Uri "http://localhost:3000/api/sensor-data/angle?timeUnit=day" -Method GET
$aggregate.Content | ConvertFrom-Json | Format-List
