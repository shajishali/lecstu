# Start the PostgreSQL Windows service that matches DATABASE_URL in server/.env.
# Safe to run every day before npm run dev:server - no-op when DB port is already open.

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$EnvPath = Join-Path $RepoRoot 'server\.env'

function Test-PortOpen([int]$Port, [string]$HostName = '127.0.0.1') {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect($HostName, $Port, $null, $null)
        $ok = $async.AsyncWaitHandle.WaitOne(500)
        if ($ok -and $client.Connected) {
            $client.Close()
            return $true
        }
        $client.Close()
    } catch {}
    return $false
}

function Get-DatabaseTarget {
    $port = 5432
    $hostName = '127.0.0.1'

    if (Test-Path $EnvPath) {
        $line = Get-Content $EnvPath | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
        if ($line) {
            $url = ($line -replace '^DATABASE_URL=', '').Trim()
            if ($url -match '@([^:/]+)(?::(\d+))?/') {
                $hostName = $Matches[1]
                if ($Matches[2]) { $port = [int]$Matches[2] }
            }
        }
    }

    return @{ Host = $hostName; Port = $port }
}

function Get-PostgresServiceForPort([int]$Port) {
    $known = @{
        5432 = 'postgresql-x64-15'
        5433 = 'postgresql-x64-16'
        5434 = 'postgresql-x64-17'
    }
    if ($known.ContainsKey($Port)) {
        $name = $known[$Port]
        $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
        if ($svc) { return $svc }
    }

    $pgRoot = 'C:\Program Files\PostgreSQL'
    if (-not (Test-Path $pgRoot)) { return $null }

    Get-ChildItem $pgRoot -Directory | Sort-Object Name -Descending | ForEach-Object {
        $conf = Join-Path $_.FullName 'data\postgresql.conf'
        if (-not (Test-Path $conf)) { return }
        $match = Select-String -Path $conf -Pattern '^\s*port\s*=\s*(\d+)' | Select-Object -First 1
        if ($match -and [int]$match.Matches[0].Groups[1].Value -eq $Port) {
            $version = $_.Name
            $serviceName = "postgresql-x64-$version"
            $svc = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
            if ($svc) { return $svc }
        }
    } | Select-Object -First 1
}

$target = Get-DatabaseTarget
$dbHost = $target.Host
$dbPort = $target.Port

if ($dbHost -notin @('localhost', '127.0.0.1', '::1')) {
    Write-Host "[LECSTU] DATABASE_URL host is $dbHost (not local) - skipping auto-start."
    exit 0
}

if (Test-PortOpen $dbPort) {
    Write-Host "[LECSTU] PostgreSQL already listening on port $dbPort"
    exit 0
}

$svc = Get-PostgresServiceForPort $dbPort
if (-not $svc) {
    Write-Host "[LECSTU] No PostgreSQL Windows service found for port $dbPort (from server/.env DATABASE_URL)."
    Write-Host '[LECSTU] Install PostgreSQL or update DATABASE_URL to match your running instance.'
    exit 0
}

if ($svc.Status -ne 'Running') {
    Write-Host ('[LECSTU] Starting ' + $svc.Name + ' for port ' + $dbPort + '...')
    try {
        Start-Service -Name $svc.Name -ErrorAction Stop
    } catch {
        Write-Host '[LECSTU] Could not start PostgreSQL (admin rights may be required).'
        Write-Host ('[LECSTU] Open Services (Win+R -> services.msc), start "' + $svc.DisplayName + '",')
        Write-Host '[LECSTU] or set its Startup type to Automatic so it runs when Windows boots.'
        exit 0
    }
}

for ($i = 0; $i -lt 25; $i++) {
    if (Test-PortOpen $dbPort) {
        Write-Host "[LECSTU] PostgreSQL is ready on port $dbPort"
        exit 0
    }
    Start-Sleep -Seconds 1
}

Write-Host "[LECSTU] PostgreSQL service is running but port $dbPort is still closed."
Write-Host '[LECSTU] Check server/.env DATABASE_URL matches your PostgreSQL port (15=5432, 16=5433, 17=5434).'
exit 0
