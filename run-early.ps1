$ErrorActionPreference='Stop'
$created=$false;$mutex=[Threading.Mutex]::new($true,'Local\No1CryptoEarlyWatch-v1',[ref]$created)
if(!$created){$mutex.Dispose();exit 0}
try{
  $secretDir=Join-Path (Split-Path $PSScriptRoot -Parent) 'telegram-alerts'
  $secret=Import-Clixml (Join-Path $secretDir 'telegram.xml');$gemini=Import-Clixml (Join-Path $secretDir 'gemini.xml')
  $env:TELEGRAM_BOT_TOKEN=[Net.NetworkCredential]::new('',$secret.Token).Password;$env:TELEGRAM_CHAT_ID=[string]$secret.ChatId;$env:GEMINI_API_KEY=[Net.NetworkCredential]::new('',$gemini).Password
  $node=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
  $groqPath=Join-Path $secretDir 'groq.xml'
  if(Test-Path -LiteralPath $groqPath){$env:GROQ_API_KEY=[Net.NetworkCredential]::new('',(Import-Clixml -LiteralPath $groqPath)).Password}
  $env:MONITOR_ORIGIN='local'
  & $node (Join-Path $PSScriptRoot 'sweep-watch.mjs');$watchExit=$LASTEXITCODE
  & $node (Join-Path $PSScriptRoot 'fast-learning.mjs')
  if($watchExit -ne 0){throw 'Early watch deferred'}
}finally{Remove-Item Env:TELEGRAM_BOT_TOKEN,Env:TELEGRAM_CHAT_ID,Env:GEMINI_API_KEY,Env:GROQ_API_KEY,Env:MONITOR_ORIGIN -ErrorAction SilentlyContinue;$mutex.ReleaseMutex();$mutex.Dispose()}
