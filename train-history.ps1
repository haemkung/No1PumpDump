$ErrorActionPreference='Stop'
$created=$false;$mutex=[Threading.Mutex]::new($true,'Local\No1CryptoMLHistory-v1',[ref]$created)
if(!$created){$mutex.Dispose();exit 0}
try{$node=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe';& $node (Join-Path $PSScriptRoot 'ml-historical.mjs');if($LASTEXITCODE -ne 0){throw 'Historical ML update incomplete'}}finally{$mutex.ReleaseMutex();$mutex.Dispose()}
