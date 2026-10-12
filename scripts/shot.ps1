param(
  [string]$Url = 'http://localhost:8080/',
  [string]$Out = 'shot.png',
  [int]$Budget = 20000
)
# 自動チェック：ヘッドレス撮影＋JSエラー検出
# 使い方: powershell -ExecutionPolicy Bypass -File scripts/shot.ps1
# 前提: `npm start` でサーバー起動中
$ErrorActionPreference = 'Continue'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $chrome)) { Write-Output 'CHROME_NOT_FOUND'; exit 2 }
try {
  $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 8
  Write-Output ("SERVER_HTTP " + $r.StatusCode)
} catch {
  Write-Output ("SERVER_NG: " + $_.Exception.Message); exit 2
}
& $chrome --headless=new --disable-gpu --no-sandbox --hide-scrollbars `
  --window-size=800,700 --virtual-time-budget=$Budget `
  --enable-logging=stderr --screenshot=$Out $Url 2> "$Out.log"
if (-not (Test-Path $Out)) { Write-Output 'SHOT_FAILED'; exit 1 }
$size = (Get-Item $Out).Length
Write-Output ("SHOT_OK bytes=" + $size)
$errs = Select-String -Path "$Out.log" -Pattern 'Uncaught|CONSOLE[^]]*(ERROR|error)' |
  Where-Object { $_.Line -notmatch 'gpu|GPU|Google.Update|PdhAdd|externally_managed|HMR|Hot Module' } |
  Select-Object -First 20
if ($errs) {
  Write-Output 'JS_ERRORS:'
  $errs | ForEach-Object { Write-Output $_.Line }
  exit 1
}
Write-Output 'NO_JS_ERRORS'
exit 0
