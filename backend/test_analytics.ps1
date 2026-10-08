param([string]$Base = "http://127.0.0.1:8001/api")
$ErrorActionPreference = "Stop"
$base = $Base
$script:failed = 0
function Check([string]$Name, [bool]$Cond, [string]$Extra = "") {
  if ($Cond) { Write-Host "PASS: $Name" -ForegroundColor Green }
  else { Write-Host "FAIL: $Name $Extra" -ForegroundColor Red; $script:failed++ }
}

$stamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$reg = Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType "application/json" -Body (@{ name = "Analytics User"; email = "analytics_$stamp@example.com"; password = "secret123" } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($reg.access_token)" }
$page = Invoke-RestMethod -Method Post -Uri "$base/pages" -Headers $h -ContentType "application/json" -Body (@{ title = "Analytics Page" } | ConvertTo-Json)

$yesterday = (Get-Date).AddDays(-1).ToString('yyyy-MM-dd')
$today     = (Get-Date).ToString('yyyy-MM-dd')

$t1 = Invoke-RestMethod -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -ContentType "application/json" -Body (@{ title = "Done one"; priority = "high"; category = "Work" } | ConvertTo-Json)
Invoke-RestMethod -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -ContentType "application/json" -Body (@{ title = "Overdue open"; priority = "high"; due_date = $yesterday } | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -ContentType "application/json" -Body (@{ title = "Due today open"; priority = "medium"; due_date = $today; category = "Work" } | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -ContentType "application/json" -Body (@{ title = "Low open"; priority = "low"; status = "in_progress"; category = "Personal" } | ConvertTo-Json) | Out-Null

# complete t1 -> completed_at must be set
$c = Invoke-RestMethod -Method Patch -Uri "$base/todos/$($t1.id)" -Headers $h -ContentType "application/json" -Body (@{ status = "completed" } | ConvertTo-Json)
Check "completed_at set on completion" (-not [string]::IsNullOrEmpty($c.completed_at)) "got '$($c.completed_at)'"

# reopen -> completed_at cleared
$r = Invoke-RestMethod -Method Patch -Uri "$base/todos/$($t1.id)" -Headers $h -ContentType "application/json" -Body (@{ status = "pending" } | ConvertTo-Json)
Check "completed_at cleared on reopen" ($null -eq $r.completed_at) "got '$($r.completed_at)'"
Invoke-RestMethod -Method Patch -Uri "$base/todos/$($t1.id)" -Headers $h -ContentType "application/json" -Body (@{ status = "completed" } | ConvertTo-Json) | Out-Null

Write-Host "`n=== SUMMARY ===" -ForegroundColor Cyan
$s = Invoke-RestMethod -Method Get -Uri "$base/analytics/summary" -Headers $h
Check "total = 4" ($s.total_tasks -eq 4) "got $($s.total_tasks)"
Check "completed = 1" ($s.completed -eq 1) "got $($s.completed)"
Check "pending = 2" ($s.pending -eq 2) "got $($s.pending)"
Check "in_progress = 1" ($s.in_progress -eq 1) "got $($s.in_progress)"
Check "overdue = 1" ($s.overdue -eq 1) "got $($s.overdue)"
Check "due_today = 1" ($s.due_today -eq 1) "got $($s.due_today)"
Check "completion_rate = 25" ($s.completion_rate -eq 25) "got $($s.completion_rate)"
Check "completed_this_week >= 1" ($s.completed_this_week -ge 1) "got $($s.completed_this_week)"
Check "by_priority open: high=1 medium=1 low=1" ($s.by_priority.high -eq 1 -and $s.by_priority.medium -eq 1 -and $s.by_priority.low -eq 1) "got $($s.by_priority | ConvertTo-Json -Compress)"
Check "by_category has Work=2 Personal=1" (($s.by_category | Where-Object { $_.category -eq 'Work' }).count -eq 2 -and ($s.by_category | Where-Object { $_.category -eq 'Personal' }).count -eq 1) "got $($s.by_category | ConvertTo-Json -Compress)"
$todayEntry = $s.completed_per_day | Where-Object { $_.date -eq $today }
Check "14-day series has today with count>=1" ($null -ne $todayEntry -and $todayEntry.count -ge 1) "got $($s.completed_per_day.Count) entries"
Check "series length = 14" ($s.completed_per_day.Count -eq 14) "got $($s.completed_per_day.Count)"

$s2 = Invoke-RestMethod -Method Get -Uri "$base/analytics/summary?page_id=$($page.id)" -Headers $h
Check "page-scoped summary works" ($s2.total_tasks -eq 4) "got $($s2.total_tasks)"

$reg2 = Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType "application/json" -Body (@{ name = "Analytics Stranger"; email = "anstranger_$stamp@example.com"; password = "secret123" } | ConvertTo-Json)
$s3 = Invoke-RestMethod -Method Get -Uri "$base/analytics/summary" -Headers @{ Authorization = "Bearer $($reg2.access_token)" }
Check "stranger sees zeros" ($s3.total_tasks -eq 0 -and $s3.completion_rate -eq 0) "got $($s3.total_tasks)"
try {
  Invoke-RestMethod -Method Get -Uri "$base/analytics/summary?page_id=$($page.id)" -Headers @{ Authorization = "Bearer $($reg2.access_token)" } | Out-Null
  Check "stranger page-scoped -> 403" ($false) ""
} catch { Check "stranger page-scoped -> 403" ([int]$_.Exception.Response.StatusCode -eq 403) "" }
try {
  Invoke-RestMethod -Method Get -Uri "$base/analytics/summary" | Out-Null
  Check "no token -> 401" ($false) ""
} catch { Check "no token -> 401" ([int]$_.Exception.Response.StatusCode -eq 401) "" }

Invoke-RestMethod -Method Delete -Uri "$base/pages/$($page.id)" -Headers $h | Out-Null
Write-Host "`nRESULT: $(if ($script:failed -eq 0) { 'ALL ANALYTICS TESTS PASSED' } else { "$($script:failed) FAILED" })" -ForegroundColor $(if ($script:failed -eq 0) { 'Green' } else { 'Red' })
exit $script:failed
