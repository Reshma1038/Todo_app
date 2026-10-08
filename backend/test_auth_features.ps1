param([string]$Base = "http://127.0.0.1:8001/api")
$ErrorActionPreference = "Stop"
$base = $Base
$script:failed = 0
function Check([string]$Name, [bool]$Cond, [string]$Extra = "") {
  if ($Cond) { Write-Host "PASS: $Name" -ForegroundColor Green }
  else { Write-Host "FAIL: $Name $Extra" -ForegroundColor Red; $script:failed++ }
}

$stamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()

Write-Host "`n=== AVATAR ===" -ForegroundColor Cyan
$r = Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType "application/json" -Body (@{ name = "Avatar User"; email = "avatar_$stamp@example.com"; password = "secret123"; avatar = "female_2" } | ConvertTo-Json)
Check "register with avatar" ($r.user.avatar -eq "female_2") "got $($r.user.avatar)"
Check "auth_provider = password" ($r.user.auth_provider -eq "password") "got $($r.user.auth_provider)"
$h = @{ Authorization = "Bearer $($r.access_token)" }

$me = Invoke-RestMethod -Method Get -Uri "$base/auth/me" -Headers $h
Check "me returns avatar" ($me.avatar -eq "female_2") "got $($me.avatar)"

$upd = Invoke-RestMethod -Method Patch -Uri "$base/auth/me/avatar" -Headers $h -ContentType "application/json" -Body (@{ avatar = "male_3" } | ConvertTo-Json)
Check "change avatar" ($upd.avatar -eq "male_3") "got $($upd.avatar)"

try {
  Invoke-RestMethod -Method Patch -Uri "$base/auth/me/avatar" -Headers $h -ContentType "application/json" -Body (@{ avatar = "male_9" } | ConvertTo-Json) | Out-Null
  Check "invalid avatar -> 422" ($false) ""
} catch { Check "invalid avatar -> 422" ([int]$_.Exception.Response.StatusCode -eq 422) "" }

try {
  Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType "application/json" -Body (@{ name = "Bad Avatar"; email = "badavatar_$stamp@example.com"; password = "secret123"; avatar = "robot_1" } | ConvertTo-Json) | Out-Null
  Check "register invalid avatar -> 422" ($false) ""
} catch { Check "register invalid avatar -> 422" ([int]$_.Exception.Response.StatusCode -eq 422) "" }

$r2 = Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType "application/json" -Body (@{ name = "No Avatar"; email = "noavatar_$stamp@example.com"; password = "secret123" } | ConvertTo-Json)
Check "avatar optional at signup" ($null -eq $r2.user.avatar) "got $($r2.user.avatar)"

Write-Host "`n=== GOOGLE LOGIN (error paths) ===" -ForegroundColor Cyan
try {
  Invoke-RestMethod -Method Post -Uri "$base/auth/google" -ContentType "application/json" -Body (@{ credential = "" } | ConvertTo-Json) | Out-Null
  Check "empty credential -> 4xx" ($false) ""
} catch { Check "empty credential -> 4xx" ([int]$_.Exception.Response.StatusCode -in 400,422) "" }

try {
  $resp = Invoke-RestMethod -Method Post -Uri "$base/auth/google" -ContentType "application/json" -Body (@{ credential = "fake.invalid.token" } | ConvertTo-Json)
  Check "google unreachable or 503 without client id" ($false) "unexpected success"
} catch {
  $code = [int]$_.Exception.Response.StatusCode
  # 503 = GOOGLE_CLIENT_ID not configured; 401 = configured but token invalid
  Check "fake token -> 401/503" ($code -in 401,503) "got $code"
}

try {
  Invoke-RestMethod -Method Post -Uri "$base/auth/google" -ContentType "application/json" -Body (@{ credential = "abc" } | ConvertTo-Json) | Out-Null
  Check "tiny credential -> 422" ($false) ""
} catch { Check "tiny credential -> 422" ([int]$_.Exception.Response.StatusCode -eq 422) "" }

Write-Host "`nRESULT: $(if ($script:failed -eq 0) { 'ALL AUTH-FEATURE TESTS PASSED' } else { "$($script:failed) FAILED" })" -ForegroundColor $(if ($script:failed -eq 0) { 'Green' } else { 'Red' })
exit $script:failed
