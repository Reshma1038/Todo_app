param([string]$base = $Base)
$ErrorActionPreference = "Stop"
$base = $Base
$script:failed = 0
function Check([string]$Name, [bool]$Cond, [string]$Extra = "") {
  if ($Cond) { Write-Host "PASS: $Name" -ForegroundColor Green }
  else { Write-Host "FAIL: $Name $Extra" -ForegroundColor Red; $script:failed++ }
}
function As-Array($raw) {
  if ($null -eq $raw) { return @() }
  if ($raw -is [array]) { return $raw }
  return @($raw)
}

$stamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$reg = Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType "application/json" -Body (@{ name = "AI Tester"; email = "ai_$stamp@example.com"; password = "secret123" } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($reg.access_token)" }

# expected next Friday (matches backend weekday rule)
$d = Get-Date
while ($d.DayOfWeek -ne 'Friday') { $d = $d.AddDays(1) }
$expectedFriday = $d.ToString('yyyy-MM-dd')
$tomorrow = (Get-Date).AddDays(1).ToString('yyyy-MM-dd')
$yesterday = (Get-Date).AddDays(-1).ToString('yyyy-MM-dd')

Write-Host "`n=== PARSE TASK ===" -ForegroundColor Cyan
$r = Invoke-RestMethod -Method Post -Uri "$base/ai/parse-task" -Headers $h -ContentType "application/json" -Body (@{ text = "Complete the project report by Friday, this is very important." } | ConvertTo-Json)
"  -> title='$($r.title)' priority=$($r.priority) due=$($r.due_date) category=$($r.category) provider=$($r.provider)"
Check "title cleaned" ($r.title -eq "Complete the project report") "got '$($r.title)'"
Check "priority = high (very important)" ($r.priority -eq "high") "got $($r.priority)"
Check "due = next Friday ($expectedFriday)" ($r.due_date -eq $expectedFriday) "got $($r.due_date)"
# categories are freeform when Gemini answers; rule engine uses a fixed vocabulary
Check "category sensible" (($r.provider -eq "gemini") -or ($r.category -eq "Work")) "got $($r.category) via $($r.provider)"

$r = Invoke-RestMethod -Method Post -Uri "$base/ai/parse-task" -Headers $h -ContentType "application/json" -Body (@{ text = "Buy groceries tomorrow" } | ConvertTo-Json)
"  -> title='$($r.title)' priority=$($r.priority) due=$($r.due_date) category=$($r.category) provider=$($r.provider)"
Check "title cleaned" ($r.title -eq "Buy groceries") "got '$($r.title)'"
Check "priority = medium (no signals)" ($r.priority -eq "medium") "got $($r.priority)"
Check "due = tomorrow ($tomorrow)" ($r.due_date -eq $tomorrow) "got $($r.due_date)"
Check "category sensible" (($r.provider -eq "gemini") -or ($r.category -eq "Shopping")) "got $($r.category) via $($r.provider)"

$r = Invoke-RestMethod -Method Post -Uri "$base/ai/parse-task" -Headers $h -ContentType "application/json" -Body (@{ text = "Please remember to call the dentist when you can" } | ConvertTo-Json)
"  -> title='$($r.title)' priority=$($r.priority) category=$($r.category) provider=$($r.provider)"
Check "filler stripped from title" ($r.title -eq "Call the dentist") "got '$($r.title)'"
Check "priority = low (when you can)" ($r.priority -eq "low") "got $($r.priority)"
Check "category sensible" (($r.provider -eq "gemini") -or ($r.category -eq "Health")) "got $($r.category) via $($r.provider)"

$r = Invoke-RestMethod -Method Post -Uri "$base/ai/parse-task" -Headers $h -ContentType "application/json" -Body (@{ text = "Pay rent by 2026-10-25 urgent" } | ConvertTo-Json)
"  -> title='$($r.title)' priority=$($r.priority) due=$($r.due_date) category=$($r.category) provider=$($r.provider)"
Check "ISO date extracted" ($r.due_date -eq "2026-10-25") "got $($r.due_date)"
Check "priority = high (urgent)" ($r.priority -eq "high") "got $($r.priority)"
Check "category sensible" (($r.provider -eq "gemini") -or ($r.category -eq "Finance")) "got $($r.category) via $($r.provider)"

Write-Host "`n=== SUGGEST PRIORITY ===" -ForegroundColor Cyan
$r = Invoke-RestMethod -Method Post -Uri "$base/ai/suggest-priority" -Headers $h -ContentType "application/json" -Body (@{ title = "Fix critical production bug"; description = "" } | ConvertTo-Json)
Check "critical bug -> high" ($r.priority -eq "high") "got $($r.priority) ($($r.reasons -join '; '))"
$r = Invoke-RestMethod -Method Post -Uri "$base/ai/suggest-priority" -Headers $h -ContentType "application/json" -Body (@{ title = "Water the plants someday"; description = "" } | ConvertTo-Json)
Check "someday -> low" ($r.priority -eq "low") "got $($r.priority)"
$r = Invoke-RestMethod -Method Post -Uri "$base/ai/suggest-priority" -Headers $h -ContentType "application/json" -Body (@{ title = "Read chapter 4"; description = "" } | ConvertTo-Json)
Check "neutral -> medium" ($r.priority -eq "medium") "got $($r.priority)"

Write-Host "`n=== NEXT TASK ===" -ForegroundColor Cyan
$page = Invoke-RestMethod -Method Post -Uri "$base/pages" -Headers $h -ContentType "application/json" -Body (@{ title = "AI Analysis Page" } | ConvertTo-Json)
Invoke-RestMethod -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -ContentType "application/json" -Body (@{ title = "Urgent overdue report"; priority = "high"; due_date = $yesterday; category = "Work" } | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -ContentType "application/json" -Body (@{ title = "Someday cleanup"; priority = "low"; due_date = (Get-Date).AddDays(10).ToString('yyyy-MM-dd') } | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -ContentType "application/json" -Body (@{ title = "Regular task"; priority = "medium" } | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -ContentType "application/json" -Body (@{ title = "Done task"; status = "completed"; priority = "high"; due_date = $yesterday } | ConvertTo-Json) | Out-Null

$r = Invoke-RestMethod -Method Get -Uri "$base/ai/next-task?page_id=$($page.id)" -Headers $h
"  -> suggestion='$($r.suggestion.todo.title)' score=$($r.suggestion.score) analyzed=$($r.analyzed)"
Check "suggestion = urgent overdue report" ($r.suggestion.todo.title -eq "Urgent overdue report") "got '$($r.suggestion.todo.title)'"
Check "completed task excluded (analyzed=3)" ($r.analyzed -eq 3) "got $($r.analyzed)"
Check "explanation present" (-not [string]::IsNullOrEmpty($r.suggestion.explanation)) ""
Check "reasons present" ($r.suggestion.reasons.Count -ge 2) ""
Check "alternatives = 2, sorted" ((As-Array $r.alternatives).Count -eq 2 -and (As-Array $r.alternatives)[0].score -ge (As-Array $r.alternatives)[1].score) ""

$r2 = Invoke-RestMethod -Method Get -Uri "$base/ai/next-task" -Headers $h
Check "global next-task also picks it" ($r2.suggestion.todo.title -eq "Urgent overdue report") "got '$($r2.suggestion.todo.title)'"

Write-Host "`n=== CATEGORY FIELD ===" -ForegroundColor Cyan
$t = Invoke-RestMethod -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -ContentType "application/json" -Body (@{ title = "Categorized task"; category = "Study" } | ConvertTo-Json)
Check "create with category" ($t.category -eq "Study") "got $($t.category)"
$t2 = Invoke-RestMethod -Method Patch -Uri "$base/todos/$($t.id)" -Headers $h -ContentType "application/json" -Body (@{ category = "Health" } | ConvertTo-Json)
Check "update category" ($t2.category -eq "Health") "got $($t2.category)"
$t3 = Invoke-RestMethod -Method Patch -Uri "$base/todos/$($t.id)" -Headers $h -ContentType "application/json" -Body (@{ category = $null } | ConvertTo-Json)
Check "clear category" ($null -eq $t3.category) "got $($t3.category)"

Write-Host "`n=== SECURITY ===" -ForegroundColor Cyan
try {
  Invoke-RestMethod -Method Post -Uri "$base/ai/parse-task" -ContentType "application/json" -Body (@{ text = "test" } | ConvertTo-Json) | Out-Null
  Check "no token -> 401" ($false) ""
} catch { Check "no token -> 401" ([int]$_.Exception.Response.StatusCode -eq 401) "" }
try {
  Invoke-RestMethod -Method Post -Uri "$base/ai/parse-task" -Headers $h -ContentType "application/json" -Body (@{ text = "   " } | ConvertTo-Json) | Out-Null
  Check "empty text -> 422" ($false) ""
} catch { Check "empty text -> 422" ([int]$_.Exception.Response.StatusCode -eq 422) "" }
$reg2 = Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType "application/json" -Body (@{ name = "AI Stranger"; email = "aistranger_$stamp@example.com"; password = "secret123" } | ConvertTo-Json)
try {
  Invoke-RestMethod -Method Get -Uri "$base/ai/next-task?page_id=$($page.id)" -Headers @{ Authorization = "Bearer $($reg2.access_token)" } | Out-Null
  Check "stranger page-scoped next-task -> 403" ($false) ""
} catch { Check "stranger page-scoped next-task -> 403" ([int]$_.Exception.Response.StatusCode -eq 403) "" }

Invoke-RestMethod -Method Delete -Uri "$base/pages/$($page.id)" -Headers $h | Out-Null
Write-Host "`nRESULT: $(if ($script:failed -eq 0) { 'ALL AI TESTS PASSED' } else { "$($script:failed) FAILED" })" -ForegroundColor $(if ($script:failed -eq 0) { 'Green' } else { 'Red' })
exit $script:failed
