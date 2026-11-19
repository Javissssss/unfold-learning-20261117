# Isolated launcher regression checks. No personal browser or account data is used.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$temp = Join-Path ([System.IO.Path]::GetTempPath()) ('unfold-launcher-qa-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp -Force | Out-Null
$savedDataDir = $env:UNFOLD_DATA_DIR
$env:UNFOLD_DATA_DIR = Join-Path $temp 'accounts'
$launcher = Join-Path $root ((-join [char[]](0x542F, 0x52A8)) + '.ps1')
$servicePid = $null
$checks = @()

function Check($condition, $label) {
    if (-not $condition) { throw "FAIL: $label. Diagnostic logs: $temp" }
    $script:checks += $label
    Write-Output "PASS: $label"
}

function Free-Port {
    $listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback), 0
    $listener.Start()
    $port = $listener.LocalEndpoint.Port
    $listener.Stop()
    return $port
}

function Run-Launcher($arguments) {
    $id = [guid]::NewGuid().ToString('N')
    $stdout = Join-Path $temp "$id.stdout.log"
    $stderr = Join-Path $temp "$id.stderr.log"
    $process = Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -WorkingDirectory $temp `
        -ArgumentList (@('-NoLogo', '-NoProfile', '-File', ('"{0}"' -f $launcher)) + $arguments) `
        -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    # Cache the process handle before waiting, including on Windows PowerShell 5.1.
    $null = $process.Handle
    if (-not $process.WaitForExit(45000)) { throw "Launcher parent did not exit in 45 seconds. Logs: $temp" }
    $process.Refresh()
    return [pscustomobject]@{
        ExitCode = $process.ExitCode
        Output = (Get-Content -LiteralPath $stdout -Raw)
        Error = (Get-Content -LiteralPath $stderr -Raw)
    }
}

try {
    $port = Free-Port
    $cold = Run-Launcher @('-Port', "$port", '-Background')
    if ($cold.Output -match 'background service PID (\d+)') { $servicePid = [int]$Matches[1] }
    Check ($cold.ExitCode -eq 0) 'cold background launch from a different working directory'
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen
    Check ($listener.LocalAddress -eq '127.0.0.1' -and $listener.OwningProcess -eq $servicePid) 'service remains loopback only'
    Start-Sleep -Seconds 2
    $health = Invoke-RestMethod "http://127.0.0.1:$port/api/health" -TimeoutSec 5
    Check ($health.lesson_count -eq 36 -and $health.audio_ready -and $health.audio_missing -eq 0) 'service survives launcher parent exit and serves complete assets'
    $warm = Run-Launcher @('-Port', "$port", '-Background')
    Check ($warm.ExitCode -eq 0 -and (Get-NetTCPConnection -LocalPort $port -State Listen).OwningProcess -eq $servicePid) 'repeat launch reuses the same process'
    Check ((Test-Path -LiteralPath (Join-Path $env:UNFOLD_DATA_DIR 'accounts.sqlite3')) -and $env:UNFOLD_DATA_DIR.StartsWith($temp)) 'test uses an isolated account database'
    $busy = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback), 0
    $busy.Start()
    try {
        $occupied = Run-Launcher @('-Port', "$($busy.LocalEndpoint.Port)", '-Background', '-OpenBrowser')
        Check ($occupied.ExitCode -ne 0 -and $occupied.Error -match 'occupied') 'unrelated occupied port fails visibly without switching address'
    } finally { $busy.Stop() }
    $free = Free-Port
    $invalid = Run-Launcher @('-Port', "$free", '-Background', '-OpenBrowser', '-PythonPath', ('"{0}"' -f (Join-Path $temp 'missing-python.exe')))
    Check ($invalid.ExitCode -ne 0 -and $invalid.Error -match 'unavailable') 'missing selected runtime fails without silently changing runtime'
    Write-Output "Launcher checks passed: $($checks.Count). Diagnostic logs: $temp"
} finally {
    try {
        if ($servicePid) {
            $owned = Get-CimInstance Win32_Process -Filter "ProcessId=$servicePid"
            if ($owned -and $owned.CommandLine -like "*server.py*--port $port*" -and $owned.CommandLine.Contains($root)) {
                Stop-Process -Id $servicePid
            } elseif ($owned) { throw 'Refusing cleanup: test process identity did not match.' }
        }
    } finally {
        if ($null -eq $savedDataDir) { Remove-Item Env:UNFOLD_DATA_DIR -ErrorAction SilentlyContinue }
        else { $env:UNFOLD_DATA_DIR = $savedDataDir }
    }
}
