param([string]$base = $Base)
$ErrorActionPreference = "Stop"
$base = $Base
$script:passed = 0
$script:failed = 0

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [string]$Token = $null
    )
    $headers = @{}
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    $params = @{
        Method      = $Method
        Uri         = "$base$Path"
        Headers     = $headers
        ContentType = "application/json"
    }
    if ($Body -ne $null) { $params["Body"] = ($Body | ConvertTo-Json -Depth 10) }
    try {
        $response = Invoke-RestMethod @params
        return @{ Status = 200; Data = $response }
    }
    catch {
        $statusCode = 0
        if ($_.Exception.Response) { $statusCode = [int]$_.Exception.Response.StatusCode }
        $detail = $_.ErrorDetails.Message
        return @{ Status = $statusCode; Data = $detail }
    }
}

function Check {
    param([string]$Name, [bool]$Condition, [string]$Extra = "")
    if ($Condition) {
        $script:passed++
        Write-Host "PASS: $Name" -ForegroundColor Green
    } else {
        $script:failed++
        Write-Host "FAIL: $Name $Extra" -ForegroundColor Red
    }
}

$stamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$email1 = "owner_$stamp@example.com"
$email2 = "member_$stamp@example.com"
$email3 = "stranger_$stamp@example.com"
$pw = "secret123"

Write-Host "`n=== AUTH ===" -ForegroundColor Cyan
$r = Invoke-Api -Method Post -Path "/auth/register" -Body @{ name = "Owner User"; email = $email1; password = $pw }
Check "register owner (201)" ($r.Status -eq 200 -and $r.Data.access_token) "got $($r.Status) $($r.Data)"
$ownerToken = $r.Data.access_token
$ownerId = $r.Data.user.id

$r = Invoke-Api -Method Post -Path "/auth/register" -Body @{ name = "Member User"; email = $email2; password = $pw }
Check "register member" ($r.Status -eq 200 -and $r.Data.access_token) "got $($r.Status) $($r.Data)"
$memberToken = $r.Data.access_token
$memberId = $r.Data.user.id

$r = Invoke-Api -Method Post -Path "/auth/register" -Body @{ name = "Stranger User"; email = $email3; password = $pw }
Check "register stranger" ($r.Status -eq 200) "got $($r.Status) $($r.Data)"
$strangerToken = $r.Data.access_token

$r = Invoke-Api -Method Post -Path "/auth/register" -Body @{ name = "Dup User"; email = $email1; password = $pw }
Check "duplicate email rejected (409)" ($r.Status -eq 409 -and $r.Data -match "already exists") "got $($r.Status) $($r.Data)"

$r = Invoke-Api -Method Post -Path "/auth/register" -Body @{ name = "X"; email = $email1; password = "123" }
Check "short password rejected (422)" ($r.Status -eq 422) "got $($r.Status) $($r.Data)"

$r = Invoke-Api -Method Post -Path "/auth/login" -Body @{ email = $email1; password = "wrongpass" }
Check "wrong password rejected (401)" ($r.Status -eq 401 -and $r.Data -match "Invalid email or password") "got $($r.Status) $($r.Data)"

$r = Invoke-Api -Method Post -Path "/auth/login" -Body @{ email = $email1; password = $pw }
Check "login ok" ($r.Status -eq 200 -and $r.Data.access_token) "got $($r.Status) $($r.Data)"

$r = Invoke-Api -Method Get -Path "/auth/me" -Token $ownerToken
Check "me with token" ($r.Status -eq 200 -and $r.Data.email -eq $email1) "got $($r.Status) $($r.Data)"

$r = Invoke-Api -Method Get -Path "/auth/me"
Check "me without token (401)" ($r.Status -eq 401) "got $($r.Status) $($r.Data)"

$r = Invoke-Api -Method Get -Path "/auth/me" -Token "garbage.token.here"
Check "me with bad token (401)" ($r.Status -eq 401) "got $($r.Status) $($r.Data)"

$r = Invoke-Api -Method Get -Path "/auth/me" -Token $ownerToken
Check "no password_hash in response" (-not ($r.Data | ConvertTo-Json | Select-String "password_hash")) ""

Write-Host "`n=== PAGES ===" -ForegroundColor Cyan
$r = Invoke-Api -Method Post -Path "/pages" -Body @{ title = "My Project Tasks" } -Token $ownerToken
Check "create page (201)" ($r.Status -eq 200 -and $r.Data.title -eq "My Project Tasks") "got $($r.Status) $($r.Data)"
$pageId = $r.Data.id

$r = Invoke-Api -Method Get -Path "/pages" -Token $ownerToken
Check "list owner pages" ($r.Status -eq 200 -and $r.Data.Count -ge 1) "got $($r.Status)"

$r = Invoke-Api -Method Get -Path "/pages/$pageId" -Token $ownerToken
Check "get page detail, role=owner" ($r.Status -eq 200 -and $r.Data.role -eq "owner") "got $($r.Status) $($r.Data)"

$r = Invoke-Api -Method Get -Path "/pages/$pageId" -Token $strangerToken
Check "stranger cannot read page (403)" ($r.Status -eq 403 -and $r.Data -match "do not have access") "got $($r.Status) $($r.Data)"

$r = Invoke-Api -Method Get -Path "/pages/000000000000000000000000" -Token $ownerToken
Check "missing page (404)" ($r.Status -eq 404) "got $($r.Status)"

$r = Invoke-Api -Method Patch -Path "/pages/$pageId" -Body @{ title = "Renamed Tasks" } -Token $strangerToken
Check "stranger cannot rename (403)" ($r.Status -eq 403) "got $($r.Status)"

$r = Invoke-Api -Method Patch -Path "/pages/$pageId" -Body @{ title = "Renamed Tasks" } -Token $ownerToken
Check "owner renames page" ($r.Status -eq 200 -and $r.Data.title -eq "Renamed Tasks") "got $($r.Status) $($r.Data)"

Write-Host "`n=== MEMBERS ===" -ForegroundColor Cyan
$r = Invoke-Api -Method Post -Path "/pages/$pageId/members" -Body @{ email = "ghost_$stamp@example.com" } -Token $ownerToken
Check "invite non-existing email (404)" ($r.Status -eq 404 -and $r.Data -match "No registered user") "got $($r.Status) $($r.Data)"

$r = Invoke-Api -Method Post -Path "/pages/$pageId/members" -Body @{ email = $email2 } -Token $memberToken
Check "member cannot invite (403)" ($r.Status -eq 403) "got $($r.Status)"

$r = Invoke-Api -Method Post -Path "/pages/$pageId/members" -Body @{ email = $email2 } -Token $ownerToken
Check "owner invites member (201)" ($r.Status -eq 200 -and $r.Data.Count -eq 2) "got $($r.Status) $($r.Data)"

$r = Invoke-Api -Method Post -Path "/pages/$pageId/members" -Body @{ email = $email2 } -Token $ownerToken
Check "duplicate member rejected (409)" ($r.Status -eq 409 -and $r.Data -match "already a member") "got $($r.Status) $($r.Data)"

$r = Invoke-Api -Method Post -Path "/pages/$pageId/members" -Body @{ email = $email1 } -Token $ownerToken
Check "invite owner rejected (400)" ($r.Status -eq 400) "got $($r.Status) $($r.Data)"

$r = Invoke-Api -Method Get -Path "/pages/$pageId/members" -Token $memberToken
Check "member lists members, roles ok" ($r.Status -eq 200 -and $r.Data.Count -eq 2 -and $r.Data[0].role -eq "owner" -and $r.Data[1].role -eq "member") "got $($r.Status) $($r.Data | ConvertTo-Json -Compress)"

$r = Invoke-Api -Method Get -Path "/pages" -Token $memberToken
Check "member sees shared page" ($r.Status -eq 200 -and ($r.Data | Where-Object { $_.id -eq $pageId })) "got $($r.Status)"

$r = Invoke-Api -Method Patch -Path "/pages/$pageId" -Body @{ title = "Member Rename" } -Token $memberToken
Check "member cannot rename page (403)" ($r.Status -eq 403) "got $($r.Status)"

$r = Invoke-Api -Method Delete -Path "/pages/$pageId" -Token $memberToken
Check "member cannot delete page (403)" ($r.Status -eq 403) "got $($r.Status)"

Write-Host "`n=== TODOS ===" -ForegroundColor Cyan
$r = Invoke-Api -Method Post -Path "/pages/$pageId/todos" -Body @{ title = "Task One"; description = "First task"; priority = "high"; assigned_to = $memberId } -Token $ownerToken
Check "create todo 1" ($r.Status -eq 200 -and $r.Data.position -eq 0 -and $r.Data.assigned_to -eq $memberId) "got $($r.Status) $($r.Data)"
$t1 = $r.Data.id

$r = Invoke-Api -Method Post -Path "/pages/$pageId/todos" -Body @{ title = "Task Two"; status = "in_progress"; due_date = "2026-12-31" } -Token $memberToken
Check "member creates todo 2" ($r.Status -eq 200 -and $r.Data.position -eq 1) "got $($r.Status) $($r.Data)"
$t2 = $r.Data.id

$r = Invoke-Api -Method Post -Path "/pages/$pageId/todos" -Body @{ title = "Task Three"; priority = "low" } -Token $ownerToken
Check "create todo 3" ($r.Status -eq 200 -and $r.Data.position -eq 2) "got $($r.Status) $($r.Data)"
$t3 = $r.Data.id

$r = Invoke-Api -Method Post -Path "/pages/$pageId/todos" -Body @{ title = "Bad Assign"; assigned_to = $strangerToken } -Token $ownerToken
Check "assign to non-member rejected (400)" ($r.Status -eq 400) "got $($r.Status) $($r.Data)"

$r = Invoke-Api -Method Post -Path "/pages/$pageId/todos" -Body @{ title = "" } -Token $ownerToken
Check "empty title rejected (422)" ($r.Status -eq 422) "got $($r.Status)"

$r = Invoke-Api -Method Post -Path "/pages/$pageId/todos" -Body @{ title = "Bad Status"; status = "weird" } -Token $ownerToken
Check "invalid status rejected (422)" ($r.Status -eq 422) "got $($r.Status)"

$r = Invoke-Api -Method Get -Path "/pages/$pageId/todos" -Token $ownerToken
Check "list todos sorted by position" ($r.Status -eq 200 -and $r.Data.Count -eq 3 -and $r.Data[0].title -eq "Task One" -and $r.Data[2].title -eq "Task Three") "got $($r.Status) $($r.Data | ConvertTo-Json -Compress)"

$r = Invoke-Api -Method Patch -Path "/todos/$t2" -Body @{ status = "completed"; assigned_to = $ownerId } -Token $memberToken
Check "member updates todo (status+assign)" ($r.Status -eq 200 -and $r.Data.status -eq "completed" -and $r.Data.assigned_to -eq $ownerId -and $r.Data.updated_by -eq $memberId) "got $($r.Status) $($r.Data)"

$r = Invoke-Api -Method Get -Path "/todos/$t1" -Token $memberToken
Check "get single todo with user info" ($r.Status -eq 200 -and $r.Data.created_by_user.name -eq "Owner User" -and $r.Data.assigned_to_user.name -eq "Member User") "got $($r.Status) $($r.Data | ConvertTo-Json -Compress)"

$r = Invoke-Api -Method Get -Path "/todos/$t1" -Token $strangerToken
Check "stranger cannot read todo (403)" ($r.Status -eq 403) "got $($r.Status)"

$r = Invoke-Api -Method Get -Path "/todos/000000000000000000000000" -Token $ownerToken
Check "missing todo (404)" ($r.Status -eq 404 -and $r.Data -match "Todo not found") "got $($r.Status) $($r.Data)"

Write-Host "`n=== REORDER ===" -ForegroundColor Cyan
$r = Invoke-Api -Method Patch -Path "/pages/$pageId/todos/reorder" -Body @{ task_ids = @($t3, $t1, $t2) } -Token $memberToken
Check "reorder todos" ($r.Status -eq 200 -and $r.Data[0].id -eq $t3 -and $r.Data[1].id -eq $t1 -and $r.Data[2].id -eq $t2) "got $($r.Status) $($r.Data)"

$r = Invoke-Api -Method Get -Path "/pages/$pageId/todos" -Token $ownerToken
Check "order persisted after refetch" ($r.Data[0].id -eq $t3 -and $r.Data[1].id -eq $t1 -and $r.Data[2].id -eq $t2 -and $r.Data[0].position -eq 0 -and $r.Data[2].position -eq 2) "got $($r.Data | ConvertTo-Json -Compress)"

$r = Invoke-Api -Method Patch -Path "/pages/$pageId/todos/reorder" -Body @{ task_ids = @($t1, $t2) } -Token $ownerToken
Check "partial reorder rejected (400)" ($r.Status -eq 400) "got $($r.Status) $($r.Data)"

$r = Invoke-Api -Method Patch -Path "/pages/$pageId/todos/reorder" -Body @{ task_ids = @($t1, $t2, "000000000000000000000000") } -Token $ownerToken
Check "foreign id in reorder rejected (400)" ($r.Status -eq 400) "got $($r.Status) $($r.Data)"

Write-Host "`n=== DELETE / CLEANUP ===" -ForegroundColor Cyan
$r = Invoke-Api -Method Delete -Path "/todos/$t3" -Token $memberToken
Check "member deletes todo" ($r.Status -eq 204 -or $r.Status -eq 200) "got $($r.Status)"

$r = Invoke-Api -Method Get -Path "/pages/$pageId/todos" -Token $ownerToken
Check "positions compacted after delete" ($r.Data.Count -eq 2 -and $r.Data[0].position -eq 0 -and $r.Data[1].position -eq 1) "got $($r.Data | ConvertTo-Json -Compress)"

$r = Invoke-Api -Method Delete -Path "/pages/$pageId/members/$memberId" -Token $ownerToken
Check "owner removes member" ($r.Status -eq 200 -and $r.Data.Count -eq 1) "got $($r.Status) $($r.Data)"

$r = Invoke-Api -Method Get -Path "/pages/$pageId/todos" -Token $ownerToken
Check "removed member unassigned from tasks" (($r.Data | Where-Object { $_.assigned_to -eq $memberId }).Count -eq 0) "got $($r.Data | ConvertTo-Json -Compress)"

$r = Invoke-Api -Method Get -Path "/pages/$pageId" -Token $memberToken
Check "removed member loses access (403)" ($r.Status -eq 403) "got $($r.Status)"

$r = Invoke-Api -Method Delete -Path "/pages/$pageId/members/$memberId" -Token $ownerToken
Check "remove non-member (404)" ($r.Status -eq 404) "got $($r.Status)"

$r = Invoke-Api -Method Delete -Path "/pages/$pageId/members/$ownerId" -Token $ownerToken
Check "remove owner rejected (400)" ($r.Status -eq 400) "got $($r.Status)"

$r = Invoke-Api -Method Delete -Path "/pages/$pageId" -Token $ownerToken
Check "owner deletes page (204)" ($r.Status -eq 204 -or $r.Status -eq 200) "got $($r.Status)"

$r = Invoke-Api -Method Get -Path "/pages/$pageId" -Token $ownerToken
Check "deleted page gone (404)" ($r.Status -eq 404) "got $($r.Status)"

$r = Invoke-Api -Method Get -Path "/todos/$t1" -Token $ownerToken
Check "todos cascade-deleted with page (404)" ($r.Status -eq 404) "got $($r.Status)"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "RESULT: $($script:passed) passed, $($script:failed) failed" -ForegroundColor $(if ($script:failed -eq 0) { "Green" } else { "Red" })
exit $script:failed
