$ErrorActionPreference='Stop'
$taskName='No1CryptoWatchHybrid-a8d1a19a'
$workerPath=Join-Path $PSScriptRoot 'run-local.ps1'
$launcherPath=Join-Path $PSScriptRoot 'run-hidden.vbs'
$statePath=Join-Path $PSScriptRoot 'watchdog-runtime.json'
$utf8=[Text.UTF8Encoding]::new($false)
$created=$false
$mutex=[Threading.Mutex]::new($true,'Local\No1CryptoWatchGuardian-v1',[ref]$created)
if(!$created){$mutex.Dispose();exit 0}
function Read-Worker {
  try{Get-Content (Join-Path $PSScriptRoot 'local-runtime.json') -Raw | ConvertFrom-Json}catch{$null}
}
function Get-OwnedWorker($runtime){
  if(!$runtime -or !$runtime.pid){return $null}
  $proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$runtime.pid) -ErrorAction SilentlyContinue
  if($proc -and $proc.Name -ieq 'powershell.exe' -and $proc.CommandLine.IndexOf($workerPath,[StringComparison]::OrdinalIgnoreCase) -ge 0){return $proc}
  return $null
}
try{
  $history=try{Get-Content $statePath -Raw|ConvertFrom-Json}catch{$null}
  $task=Get-ScheduledTask -TaskName $taskName
  if($task.Actions.Count -ne 1 -or $task.Actions[0].Arguments.IndexOf($launcherPath,[StringComparison]::OrdinalIgnoreCase) -lt 0){throw 'Unexpected task action; refusing to alter another task.'}
  $runtime=Read-Worker
  $worker=Get-OwnedWorker $runtime
  $age=if($runtime.lastCheck){([DateTime]::UtcNow-[DateTime]::Parse($runtime.lastCheck).ToUniversalTime()).TotalSeconds}else{[double]::PositiveInfinity}
  $healthy=$worker -and $age -lt 420
  $state=@{checked=[DateTime]::UtcNow.ToString('o');healthy=[bool]$healthy;status='healthy'}
  if($history.lastRecovery){$state.lastRecovery=$history.lastRecovery}
  if($history.lastNotice){$state.lastNotice=$history.lastNotice}
  if($history.pendingNotice){$state.pendingNotice=$history.pendingNotice}
  if(!$healthy){
    $sinceStart=([DateTime]::Now-(Get-ScheduledTaskInfo -TaskName $taskName).LastRunTime).TotalSeconds
    if($task.State -eq 'Running' -and !$worker -and $sinceStart -lt 90){$state.status='starting'}else{
      if($worker){
        # Only stop the verified monitor and its verified scanner child.
        Get-CimInstance Win32_Process -Filter ('ParentProcessId='+$worker.ProcessId) | Where-Object{$_.Name -ieq 'node.exe' -and $_.CommandLine.IndexOf((Join-Path $PSScriptRoot 'scanner.mjs'),[StringComparison]::OrdinalIgnoreCase) -ge 0}|ForEach-Object{Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue}
        Stop-Process -Id $worker.ProcessId -Force -ErrorAction SilentlyContinue
      }
      Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
      Start-ScheduledTask -TaskName $taskName
      $state.status='restarting'
      for($i=0;$i -lt 10;$i++){
        Start-Sleep -Seconds 2
        $next=Read-Worker;$nextWorker=Get-OwnedWorker $next
        if($nextWorker -and (!$worker -or $nextWorker.ProcessId -ne $worker.ProcessId) -and $next.lastCheck -and ([DateTime]::UtcNow-[DateTime]::Parse($next.lastCheck).ToUniversalTime()).TotalSeconds -lt 60){
          $state.status='recovered';$state.healthy=$true;$state.lastRecovery=[DateTime]::UtcNow.ToString('o')
          $state.pendingNotice='No1 กู้ตัวตรวจในเครื่องกลับมาอัตโนมัติแล้ว โปรแกรมเริ่มทำงานอีกครั้ง ข้อความนี้เป็นสถานะระบบ ไม่ใช่สัญญาณซื้อขาย'
          if($env:NO1_RECOVERY_TEST -eq '1'){$state.pendingNotice='ทดสอบระบบกู้สำเร็จ: '+$state.pendingNotice}
          break
        }
      }
      if(!$state.healthy){$state.pendingNotice='No1 ยังเปิดตัวตรวจในเครื่องกลับมาไม่ได้ ระบบจะลองกู้ให้อัตโนมัติอีกครั้ง โดยมี GitHub สำรองซึ่งอาจล่าช้า'}
    }
  }
  $noticeDue=!$state.lastNotice -or ([DateTime]::UtcNow-[DateTime]::Parse($state.lastNotice).ToUniversalTime()).TotalHours -ge 1
  if($state.pendingNotice -and $noticeDue){
    $token=$null
    try{
      $secret=Import-Clixml (Join-Path (Split-Path $PSScriptRoot -Parent) 'telegram-alerts\telegram.xml')
      $token=[Net.NetworkCredential]::new('',$secret.Token).Password
      $body=@{chat_id=$secret.ChatId;text=$state.pendingNotice}|ConvertTo-Json
      $reply=Invoke-RestMethod -Uri ('https://api.telegram.org/bot'+$token+'/sendMessage') -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 15
      if($reply.ok){$state.lastNotice=[DateTime]::UtcNow.ToString('o');$state.Remove('pendingNotice')}
    }catch{}finally{$token=$null}
  }
  [IO.File]::WriteAllText($statePath,($state|ConvertTo-Json -Depth 4),$utf8)
}finally{$mutex.ReleaseMutex();$mutex.Dispose()}
