param([string]$base = $Base)
$ErrorActionPreference = "Stop"
$base = $Base
$stamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$reg = Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType "application/json" -Body (@{ name = "Due Tester"; email = "due_$stamp@example.com"; password = "secret123" } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($reg.access_token)" }
$page = Invoke-RestMethod -Method Post -Uri "$base/pages" -Headers $h -ContentType "application/json" -Body (@{ title = "Reminders Page" } | ConvertTo-Json)

$yesterday = (Get-Date).AddDays(-1).ToString('yyyy-MM-dd')
$today     = (Get-Date).ToString('yyyy-MM-dd')
$tomorrow  = (Get-Date).AddDays(1).ToString('yyyy-MM-dd')

Invoke-RestMethod -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -ContentType "application/json" -Body (@{ title = "Overdue task"; due_date = $yesterday } | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -ContentType "application/json" -Body (@{ title = "Today task"; due_date = $today } | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -ContentType "application/json" -Body (@{ title = "Future task"; due_date = $tomorrow } | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -ContentType "application/json" -Body (@{ title = "Done overdue"; due_date = $yesterday; status = "completed" } | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -ContentType "application/json" -Body (@{ title = "No date task" } | ConvertTo-Json) | Out-Null

$dueRaw = Invoke-RestMethod -Method Get -Uri "$base/todos/due" -Headers $h
$due = if ($null -eq $dueRaw) { @() } elseif ($dueRaw -is [array]) { $dueRaw } else { @($dueRaw) }
"due endpoint returned $($due.Count) task(s):"
$due | ForEach-Object { "  - $($_.title) | due=$($_.due_date) | page=$($_.page_title)" }

$ok1 = $due.Count -eq 3
$ok2 = ($due[0].title -eq "Overdue task") -and ($due[2].title -eq "Future task")
$ok3 = $due[0].page_title -eq "Reminders Page"
$ok4 = -not ($due | Where-Object { $_.title -in @("Done overdue", "No date task") })

$reg2 = Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType "application/json" -Body (@{ name = "Due Stranger"; email = "duestranger_$stamp@example.com"; password = "secret123" } | ConvertTo-Json)
$dueStrangerRaw = Invoke-RestMethod -Method Get -Uri "$base/todos/due" -Headers @{ Authorization = "Bearer $($reg2.access_token)" }
$ok5 = ($null -eq $dueStrangerRaw) -or (@($dueStrangerRaw).Count -eq 0)

$failed = 0
"PASS: exactly 3 due tasks (completed & no-date excluded)" | Out-Null
foreach ($pair in @(@("exactly 3 due tasks (completed+no-date excluded)", $ok1),
                    @("sorted by due_date ascending", $ok2),
                    @("page_title attached", $ok3),
                    @("excluded items absent", $ok4),
                    @("stranger sees empty list", $ok5))) {
  if ($pair[1]) { Write-Host "PASS: $($pair[0])" -ForegroundColor Green }
  else { Write-Host "FAIL: $($pair[0])" -ForegroundColor Red; $failed++ }
}

Invoke-RestMethod -Method Delete -Uri "$base/pages/$($page.id)" -Headers $h | Out-Null
"cleanup done; failures: $failed"
exit $failed
