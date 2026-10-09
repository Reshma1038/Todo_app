param([string]$base = $Base)
$ErrorActionPreference = "Stop"
$base = $Base
$script:failed = 0
function Check([string]$Name, [bool]$Cond, [string]$Extra = "") {
  if ($Cond) { Write-Host "PASS: $Name" -ForegroundColor Green }
  else { Write-Host "FAIL: $Name $Extra" -ForegroundColor Red; $script:failed++ }
}
# Returns @{ ok = $true; data = ... } or @{ ok = $false; code = ...; msg = ... }
function Try-Request([string]$Method, [string]$Uri, $Headers, $Body = $null) {
  $params = @{ Method = $Method; Uri = $Uri; Headers = $Headers; ContentType = "application/json" }
  if ($Body -ne $null) { $params["Body"] = ($Body | ConvertTo-Json -Depth 10) }
  try {
    return @{ ok = $true; data = (Invoke-RestMethod @params) }
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    return @{ ok = $false; code = $code; msg = $_.ErrorDetails.Message }
  }
}

$stamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$reg = Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType "application/json" -Body (@{ name = "Due Tester"; email = "due_$stamp@example.com"; password = "secret123" } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($reg.access_token)" }
$page = Invoke-RestMethod -Method Post -Uri "$base/pages" -Headers $h -ContentType "application/json" -Body (@{ title = "Reminders Page" } | ConvertTo-Json)

$yesterday = (Get-Date).AddDays(-1).ToString('yyyy-MM-dd')
$today     = (Get-Date).ToString('yyyy-MM-dd')
$tomorrow  = (Get-Date).AddDays(1).ToString('yyyy-MM-dd')

Write-Host "`n=== TODAY / FUTURE DUE DATES ACCEPTED ===" -ForegroundColor Cyan
$r = Try-Request -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -Body (@{ title = "Today task"; due_date = $today })
Check "create with today due date works" ($r.ok -and $r.data.due_date -eq $today) "$($r | ConvertTo-Json -Compress)"
$todayTaskId = if ($r.ok) { $r.data.id } else { $null }
$r = Try-Request -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -Body (@{ title = "Future task"; due_date = $tomorrow })
Check "create with future due date works" ($r.ok -and $r.data.due_date -eq $tomorrow) "$($r | ConvertTo-Json -Compress)"
$r = Try-Request -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -Body (@{ title = "No date task" })
Check "create with no due date works" ($r.ok) "$($r | ConvertTo-Json -Compress)"

Write-Host "`n=== PAST DUE DATES REJECTED ===" -ForegroundColor Cyan
$r = Try-Request -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -Body (@{ title = "Overdue task"; due_date = $yesterday })
Check "create with past due date -> 422" ((-not $r.ok) -and ($r.code -eq 422)) "got $($r.code) $($r.msg)"
Check "clear past-date message" ($r.msg -match "cannot be in the past") "got $($r.msg)"
$r = Try-Request -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -Body (@{ title = "Done overdue"; due_date = $yesterday; status = "completed" })
Check "create completed with past due date -> 422" ((-not $r.ok) -and ($r.code -eq 422)) "got $($r.code)"

$r = Try-Request -Method Patch -Uri "$base/todos/$todayTaskId" -Headers $h -Body (@{ due_date = $yesterday })
Check "update due date to past -> 422" ((-not $r.ok) -and ($r.code -eq 422)) "got $($r.code) $($r.msg)"
$r = Try-Request -Method Patch -Uri "$base/todos/$todayTaskId" -Headers $h -Body (@{ due_date = $tomorrow })
Check "update due date to future works" ($r.ok -and $r.data.due_date -eq $tomorrow) "$($r | ConvertTo-Json -Compress)"
# restore today so the reminder listing below stays meaningful
Try-Request -Method Patch -Uri "$base/todos/$todayTaskId" -Headers $h -Body (@{ due_date = $today }) | Out-Null

Write-Host "`n=== REMINDER LISTING (/todos/due) ===" -ForegroundColor Cyan
$dueRaw = Invoke-RestMethod -Method Get -Uri "$base/todos/due" -Headers $h
$due = if ($null -eq $dueRaw) { @() } elseif ($dueRaw -is [array]) { $dueRaw } else { @($dueRaw) }
"due endpoint returned $($due.Count) task(s):"
$due | ForEach-Object { "  - $($_.title) | due=$($_.due_date) | page=$($_.page_title)" }

$ok1 = $due.Count -eq 2
$ok2 = ($due[0].title -eq "Today task") -and ($due[1].title -eq "Future task")
$ok3 = $due[0].page_title -eq "Reminders Page"
$ok4 = -not ($due | Where-Object { $_.title -eq "No date task" })

$reg2 = Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType "application/json" -Body (@{ name = "Due Stranger"; email = "duestranger_$stamp@example.com"; password = "secret123" } | ConvertTo-Json)
$dueStrangerRaw = Invoke-RestMethod -Method Get -Uri "$base/todos/due" -Headers @{ Authorization = "Bearer $($reg2.access_token)" }
$ok5 = ($null -eq $dueStrangerRaw) -or (@($dueStrangerRaw).Count -eq 0)

foreach ($pair in @(@("today + future listed, no-date excluded", $ok1),
                    @("sorted by due_date ascending", $ok2),
                    @("page_title attached", $ok3),
                    @("no-date item absent", $ok4),
                    @("stranger sees empty list", $ok5))) {
  if ($pair[1]) { Write-Host "PASS: $($pair[0])" -ForegroundColor Green }
  else { Write-Host "FAIL: $($pair[0])" -ForegroundColor Red; $script:failed++ }
}

Invoke-RestMethod -Method Delete -Uri "$base/pages/$($page.id)" -Headers $h | Out-Null
"cleanup done; failures: $($script:failed)"
exit $script:failed
