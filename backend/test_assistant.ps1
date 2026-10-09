param([string]$base = $Base)
$ErrorActionPreference = "Stop"
$base = $Base
$script:failed = 0
function Check([string]$Name, [bool]$Cond, [string]$Extra = "") {
  if ($Cond) { Write-Host "PASS: $Name" -ForegroundColor Green }
  else { Write-Host "FAIL: $Name $Extra" -ForegroundColor Red; $script:failed++ }
}

$stamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$reg = Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType "application/json" -Body (@{ name = "Chat Tester"; email = "chat_$stamp@example.com"; password = "secret123" } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($reg.access_token)" }
$page = Invoke-RestMethod -Method Post -Uri "$base/pages" -Headers $h -ContentType "application/json" -Body (@{ title = "Chat Page" } | ConvertTo-Json)

$yesterday = (Get-Date).AddDays(-1).ToString('yyyy-MM-dd')
$today     = (Get-Date).ToString('yyyy-MM-dd')
$tomorrow  = (Get-Date).AddDays(1).ToString('yyyy-MM-dd')

Invoke-RestMethod -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -ContentType "application/json" -Body (@{ title = "Fix urgent bug"; priority = "high"; due_date = $today } | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -ContentType "application/json" -Body (@{ title = "Submit report"; priority = "medium"; due_date = $today } | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -ContentType "application/json" -Body (@{ title = "Clean desk"; priority = "low" } | ConvertTo-Json) | Out-Null

function Ask([string]$q) {
  Invoke-RestMethod -Method Post -Uri "$base/ai/assistant" -Headers $h -ContentType "application/json" -Body (@{ text = $q; page_id = $page.id } | ConvertTo-Json)
}

Write-Host "`n=== QUESTIONS -> ANSWERS ===" -ForegroundColor Cyan
$r = Ask "What should I do first?"
"  Q: what should I do first? -> $($r.kind): $($r.answer)"
Check "kind = answer" ($r.kind -eq "answer") "got $($r.kind)"
Check "recommends urgent bug" ($r.answer -match "Fix urgent bug") "got: $($r.answer)"

$r = Ask "Any overdue tasks?"
"  Q: any overdue tasks? -> $($r.answer)"
Check "kind = answer" ($r.kind -eq "answer") ""
Check "no overdue tasks reported" ($r.answer -match "Nothing is overdue") "got: $($r.answer)"

$r = Ask "What's due today?"
"  Q: what's due today? -> $($r.answer)"
Check "mentions today task" ($r.answer -match "Submit report") "got: $($r.answer)"

$r = Ask "How many pending tasks do I have?"
"  Q: how many -> $($r.answer)"
Check "counts 3 pending, 0 overdue" ($r.answer -match "3 pending" -and $r.answer -match "0 overdue") "got: $($r.answer)"

Write-Host "`n=== TASK STATEMENTS -> PARSED FIELDS ===" -ForegroundColor Cyan
$r = Ask "Buy milk tomorrow"
"  task: 'Buy milk tomorrow' -> $($r.kind)"
Check "kind = task" ($r.kind -eq "task") "got $($r.kind)"
Check "title parsed" ($r.parsed.title -eq "Buy milk") "got '$($r.parsed.title)'"
Check "due tomorrow" ($r.parsed.due_date -eq $tomorrow) "got $($r.parsed.due_date)"
Check "category Shopping" ($r.parsed.category -eq "Shopping") "got $($r.parsed.category)"

$r = Ask "Finish the presentation by Friday, urgent!"
Check "task with urgency -> high" ($r.parsed.priority -eq "high") "got $($r.parsed.priority)"
Check "kind = task (no answer text)" ($null -eq $r.answer) ""

Write-Host "`n=== SMALLTALK (never creates tasks) ===" -ForegroundColor Cyan
$r = Ask "hii"
"  Q: hii -> $($r.kind): $($r.answer)"
Check "greeting -> short answer, not task" ($r.kind -eq "answer" -and $r.answer -match "Hello") "got kind=$($r.kind)"
Check "greeting has no 'ask me' guidance" ($r.answer -notmatch "Ask me|describe a task") "got: $($r.answer)"
$r = Ask "thanks"
Check "thanks -> answer" ($r.kind -eq "answer" -and $r.answer -match "welcome") "got kind=$($r.kind)"
$r = Ask "ab"
Check "gibberish -> asks to rephrase" ($r.kind -eq "answer" -and $r.answer -match "rephrase") "got: $($r.answer)"

Write-Host "`n=== LIST TASKS (natural language) ===" -ForegroundColor Cyan
$r = Ask "list down all tasks"
"  Q: list down all tasks ->`n$($r.answer)"
Check "kind = answer" ($r.kind -eq "answer") "got $($r.kind)"
Check "ALL view lists every task" ($r.answer -match "Fix urgent bug" -and $r.answer -match "Submit report" -and $r.answer -match "Clean desk") "got: $($r.answer)"
Check "ALL view has status labels" ($r.answer -match "Pending") "got: $($r.answer)"
Check "ALL view has pending icon, no overdue icon" (($r.answer -match "⏳") -and ($r.answer -notmatch "⚠️")) "got: $($r.answer)"
$r = Ask "show my tasks"
Check "show my tasks -> pending list" ($r.answer -match "pending task" -and $r.answer -match "1\.") "got: $($r.answer)"

# complete one task, then ask for completed list
$todos = Invoke-RestMethod -Method Get -Uri "$base/pages/$($page.id)/todos" -Headers $h
$clean = @($todos | Where-Object { $_.title -eq "Clean desk" }) | Select-Object -First 1
Invoke-RestMethod -Method Patch -Uri "$base/todos/$($clean.id)" -Headers $h -ContentType "application/json" -Body (@{ status = "completed" } | ConvertTo-Json) | Out-Null
$r = Ask "list completed tasks"
"  Q: list completed tasks -> $($r.answer)"
Check "completed list shows done task" ($r.answer -match "Clean desk") "got: $($r.answer)"
$r = Ask "list tasks"
Check "pending-only list shrinks after completion" ($r.answer -match "2 pending") "got: $($r.answer)"

$r = Ask "list all my tasks"
"  Q: list all my tasks ->`n$($r.answer)"
Check "ALL view includes completed task" ($r.answer -match "Clean desk" -and $r.answer -match "Completed") "got: $($r.answer)"
Check "ALL view includes completed icon" ($r.answer -match "✅") "got: $($r.answer)"
Check "ALL view still shows pending tasks" ($r.answer -match "Submit report" -and $r.answer -match "Fix urgent bug") "got: $($r.answer)"

# past due dates are rejected by validation
try {
  Invoke-RestMethod -Method Post -Uri "$base/pages/$($page.id)/todos" -Headers $h -ContentType "application/json" -Body (@{ title = "Past task"; due_date = $yesterday } | ConvertTo-Json) | Out-Null
  Check "create with past due date -> 422" ($false) ""
} catch { Check "create with past due date -> 422" ([int]$_.Exception.Response.StatusCode -eq 422) "" }

Write-Host "`n=== SECURITY ===" -ForegroundColor Cyan
try {
  Invoke-RestMethod -Method Post -Uri "$base/ai/assistant" -ContentType "application/json" -Body (@{ text = "hi" } | ConvertTo-Json) | Out-Null
  Check "no token -> 401" ($false) ""
} catch { Check "no token -> 401" ([int]$_.Exception.Response.StatusCode -eq 401) "" }
try {
  Invoke-RestMethod -Method Post -Uri "$base/ai/assistant" -Headers $h -ContentType "application/json" -Body (@{ text = "  " } | ConvertTo-Json) | Out-Null
  Check "empty text -> 422" ($false) ""
} catch { Check "empty text -> 422" ([int]$_.Exception.Response.StatusCode -eq 422) "" }

Invoke-RestMethod -Method Delete -Uri "$base/pages/$($page.id)" -Headers $h | Out-Null
Write-Host "`nRESULT: $(if ($script:failed -eq 0) { 'ALL ASSISTANT TESTS PASSED' } else { "$($script:failed) FAILED" })" -ForegroundColor $(if ($script:failed -eq 0) { 'Green' } else { 'Red' })
exit $script:failed
