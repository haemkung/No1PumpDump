param([switch]$Once)
$ErrorActionPreference='Stop'
$created=$false
$mutex=[Threading.Mutex]::new($true,'Local\No1CryptoWatchHybrid-v1',[ref]$created)
if(!$created){$mutex.Dispose();exit 0}
$node=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$secretDir=Join-Path (Split-Path $PSScriptRoot -Parent) 'telegram-alerts'
$statusPath=Join-Path $PSScriptRoot 'local-runtime.json'
$utf8=[Text.UTF8Encoding]::new($false)
function Save-Runtime($value){
  $tmp=$statusPath+'.tmp'
  [IO.File]::WriteAllText($tmp,($value|ConvertTo-Json -Depth 6),$utf8)
  Move-Item -LiteralPath $tmp -Destination $statusPath -Force
}
try{
  $telegram=Import-Clixml (Join-Path $secretDir 'telegram.xml')
  $gemini=Import-Clixml (Join-Path $secretDir 'gemini.xml')
  $env:TELEGRAM_BOT_TOKEN=[Net.NetworkCredential]::new('',$telegram.Token).Password
  $env:TELEGRAM_CHAT_ID=[string]$telegram.ChatId
  $env:GEMINI_API_KEY=[Net.NetworkCredential]::new('',$gemini).Password
  $env:MONITOR_ORIGIN='local'
  do{
    $started=[DateTime]::UtcNow.ToString('o')
    $status=@{status='checking';pid=$PID;lastCheck=$started;mode='local_with_github_backup'}
    Save-Runtime $status
    try{
      $output=@(& $node (Join-Path $PSScriptRoot 'scanner.mjs') 2>&1)
      $code=$LASTEXITCODE
      $jsonLine=$output|ForEach-Object{[string]$_}|Where-Object{$_ -match '^\{.*\}$'}|Select-Object -Last 1
      if($jsonLine){$status.result=$jsonLine|ConvertFrom-Json}
      $status.status=if($code -eq 0){'running'}else{'scan_failed'}
    }catch{$status.status='scan_failed'}
    Save-Runtime $status
    if($Once){$status|ConvertTo-Json -Depth 6;break}
    Start-Sleep -Seconds 20
  }while($true)
}catch{
  Save-Runtime @{status='setup_failed';updated=[DateTime]::UtcNow.ToString('o');pid=$PID}
  throw 'Local monitor setup failed; credentials are not logged.'
}finally{
  Remove-Item Env:TELEGRAM_BOT_TOKEN,Env:TELEGRAM_CHAT_ID,Env:GEMINI_API_KEY,Env:MONITOR_ORIGIN -ErrorAction SilentlyContinue
  $mutex.ReleaseMutex();$mutex.Dispose()
}
