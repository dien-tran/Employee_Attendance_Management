param(
    [string]$EnvFile = ".env",
    [string]$GatewayBaseUrl = "http://localhost:8080",
    [string]$CoreBaseUrl = "http://localhost:8082",
    [string]$Date = (Get-Date -Format "yyyy-MM-dd"),
    [switch]$SkipE2EUser
)

$ErrorActionPreference = "Stop"

function Read-DotEnv {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Env file not found: $Path"
    }

    $values = @{}
    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) {
            return
        }

        $parts = $line.Split("=", 2)
        if ($parts.Count -eq 2) {
            $values[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
        }
    }

    return $values
}

function Get-RequiredEnv {
    param(
        [hashtable]$Env,
        [string]$Name
    )

    if (-not $Env.ContainsKey($Name) -or [string]::IsNullOrWhiteSpace($Env[$Name])) {
        throw "$Name is required in $EnvFile"
    }

    return $Env[$Name]
}

function ConvertTo-Base64UrlJson {
    param($Value)

    $json = $Value | ConvertTo-Json -Compress -Depth 10
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function New-InternalJwt {
    param(
        [string]$SignedKey,
        [string]$Issuer,
        [string]$Audience,
        [string]$Scope
    )

    $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $header = @{
        alg = "HS512"
        typ = "JWT"
    }
    $payload = @{
        iss = $Issuer
        aud = $Audience
        scope = $Scope
        iat = $now
        exp = $now + 900
        jti = [Guid]::NewGuid().ToString()
    }

    $unsignedToken = "$(ConvertTo-Base64UrlJson $header).$(ConvertTo-Base64UrlJson $payload)"
    $keyBytes = [System.Text.Encoding]::UTF8.GetBytes($SignedKey)
    $hmac = [System.Security.Cryptography.HMACSHA512]::new($keyBytes)

    try {
        $signatureBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($unsignedToken))
        $signature = [Convert]::ToBase64String($signatureBytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
        return "$unsignedToken.$signature"
    } finally {
        $hmac.Dispose()
    }
}

function Invoke-Json {
    param(
        [string]$Method,
        [string]$Uri,
        $Body,
        [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
        [hashtable]$Headers = @{}
    )

    $request = @{
        Uri = $Uri
        Method = $Method
        ContentType = "application/json"
        Headers = $Headers
    }

    if ($Session) {
        $request.WebSession = $Session
    }

    if ($null -ne $Body) {
        $request.Body = ($Body | ConvertTo-Json -Depth 10)
    }

    return Invoke-RestMethod @request
}

function Ensure-DemoUser {
    param(
        [string]$Email,
        [string]$Dob,
        [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
        [string]$GatewayBaseUrl
    )

    $staffList = (Invoke-Json -Method "GET" -Uri "$GatewayBaseUrl/api/staff" -Session $Session).result
    $existing = $staffList | Where-Object { $_.email -eq $Email } | Select-Object -First 1

    if ($existing) {
        if ($existing.status -ne "ACTIVE") {
            Invoke-Json `
                -Method "PATCH" `
                -Uri "$GatewayBaseUrl/api/staff/$($existing.id)/status?status=ACTIVE" `
                -Session $Session | Out-Null
            Write-Host "Activated demo user: $Email ($($existing.staffId))"
        }

        return $existing
    }

    $created = Invoke-Json `
        -Method "POST" `
        -Uri "$GatewayBaseUrl/api/staff" `
        -Session $Session `
        -Body @{
            name = "Demo Attendance User"
            email = $Email
            dob = $Dob
            department = "QA"
            position = "Demo User"
            phone = "0911111111"
            identityCard = "079098009999"
            bankAccount = "9999999999"
            bankName = "Techcombank"
            role = "USER"
        }

    Write-Host "Created demo user: $Email ($($created.result.staffId))"
    return $created.result
}

function Sync-Attendance {
    param(
        [string]$StaffId,
        [string]$Type,
        [string]$Timestamp,
        [bool]$OnTime,
        [string]$Date,
        [string]$CoreBaseUrl,
        [string]$Token
    )

    $response = Invoke-Json `
        -Method "POST" `
        -Uri "$CoreBaseUrl/api/internal/attendance/sync" `
        -Headers @{ "X-Internal-Token" = "Bearer $Token" } `
        -Body @{
            staffId = $StaffId
            type = $Type
            timestamp = $Timestamp
            date = $Date
            onTime = $OnTime
        }

    return $response.result
}

$envValues = Read-DotEnv -Path $EnvFile

$adminEmail = Get-RequiredEnv -Env $envValues -Name "SEED_ADMIN_EMAIL"
$adminPassword = Get-RequiredEnv -Env $envValues -Name "SEED_ADMIN_PASSWORD"
$adminStaffId = if ($envValues.ContainsKey("SEED_ADMIN_STAFF_ID")) { $envValues["SEED_ADMIN_STAFF_ID"] } else { "SYS000001" }
$internalSignedKey = Get-RequiredEnv -Env $envValues -Name "INTERNAL_JWT_SIGNED_KEY"
$internalIssuer = if ($envValues.ContainsKey("INTERNAL_JWT_ISSUER")) { $envValues["INTERNAL_JWT_ISSUER"] } else { "ai-service" }
$internalAudience = if ($envValues.ContainsKey("INTERNAL_JWT_AUDIENCE")) { $envValues["INTERNAL_JWT_AUDIENCE"] } else { "core-service" }
$internalScope = if ($envValues.ContainsKey("INTERNAL_JWT_REQUIRED_SCOPE")) { $envValues["INTERNAL_JWT_REQUIRED_SCOPE"] } else { "attendance:sync" }

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-Json `
    -Method "POST" `
    -Uri "$GatewayBaseUrl/api/auth/login" `
    -Session $session `
    -Body @{
        username = $adminEmail
        password = $adminPassword
    } | Out-Null

Write-Host "Logged in as admin: $adminEmail"

$token = New-InternalJwt `
    -SignedKey $internalSignedKey `
    -Issuer $internalIssuer `
    -Audience $internalAudience `
    -Scope $internalScope

$seeded = @()
$seeded += Sync-Attendance `
    -StaffId $adminStaffId `
    -Type "CHECK_IN" `
    -Timestamp "$Date`T08:20:00" `
    -Date $Date `
    -OnTime $false `
    -CoreBaseUrl $CoreBaseUrl `
    -Token $token

$seeded += Sync-Attendance `
    -StaffId $adminStaffId `
    -Type "CHECK_OUT" `
    -Timestamp "$Date`T17:45:00" `
    -Date $Date `
    -OnTime $true `
    -CoreBaseUrl $CoreBaseUrl `
    -Token $token

if (-not $SkipE2EUser) {
    $e2eEmail = if ($envValues.ContainsKey("E2E_USER_EMAIL")) { $envValues["E2E_USER_EMAIL"] } else { "e2e_test_user@example.com" }
    $e2eDob = if ($envValues.ContainsKey("E2E_USER_DOB")) { $envValues["E2E_USER_DOB"] } else { "1998-03-20" }
    $demoUser = Ensure-DemoUser -Email $e2eEmail -Dob $e2eDob -Session $session -GatewayBaseUrl $GatewayBaseUrl

    $seeded += Sync-Attendance `
        -StaffId $demoUser.staffId `
        -Type "CHECK_IN" `
        -Timestamp "$Date`T08:02:00" `
        -Date $Date `
        -OnTime $true `
        -CoreBaseUrl $CoreBaseUrl `
        -Token $token

    $seeded += Sync-Attendance `
        -StaffId $demoUser.staffId `
        -Type "CHECK_OUT" `
        -Timestamp "$Date`T17:30:00" `
        -Date $Date `
        -OnTime $true `
        -CoreBaseUrl $CoreBaseUrl `
        -Token $token
}

Write-Host ""
Write-Host "Seeded demo attendance records for ${Date}:"
$seeded | Select-Object id, staffId, type, timestamp, date, onTime | Format-Table -AutoSize
Write-Host "Open $GatewayBaseUrl via the frontend at http://localhost:3000/admin/attendance and keep the date filter on $Date."
