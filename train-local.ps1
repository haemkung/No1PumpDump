$ErrorActionPreference='Stop'
$created=$false;$mutex=[Threading.Mutex]::new($true,'Local\No1CryptoMLTrainer-v1',[ref]$created)
if(!$created){$mutex.Dispose();exit 0}
try{
  $secret=Import-Clixml (Join-Path (Split-Path $PSScriptRoot -Parent) 'telegram-alerts\telegram.xml')
  $env:TELEGRAM_BOT_TOKEN=[Net.NetworkCredential]::new('',$secret.Token).Password
  $env:TELEGRAM_CHAT_ID=[string]$secret.ChatId
  $node=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
  & $node (Join-Path $PSScriptRoot 'ml-trainer.mjs')
  if($LASTEXITCODE -ne 0){throw 'ML update deferred'}
}finally{Remove-Item Env:TELEGRAM_BOT_TOKEN,Env:TELEGRAM_CHAT_ID -ErrorAction SilentlyContinue;$mutex.ReleaseMutex();$mutex.Dispose()}
