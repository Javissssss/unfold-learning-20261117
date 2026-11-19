[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)] [int] $Port = 8791,
    [string] $PythonPath = '',
    [switch] $ConfigureAI,
    [switch] $Background,
    [switch] $OpenBrowser
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:PYTHONDONTWRITEBYTECODE = '1'
$url = "http://127.0.0.1:$Port/"
if ($OpenBrowser) { $Background = $true }

function Test-UnfoldReady {
    try {
        $health = Invoke-RestMethod -Uri "${url}api/health" -TimeoutSec 2
        if ($health.api_protocol -ne 'Chat Completions (OpenAI-style)' -or
            $health.lesson_count -lt 1 -or $health.audio_ready -isnot [bool]) { return $false }
        $page = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
        return ($page.StatusCode -eq 200 -and $page.Content -match '<title>Unfold</title>')
    } catch { return $false }
}

function Test-PortInUse {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $pending = $client.ConnectAsync('127.0.0.1', $Port)
        return ($pending.Wait(500) -and $client.Connected)
    } catch { return $false }
    finally { $client.Dispose() }
}

# Reuse a healthy instance; never silently change the browser storage origin.
if ($Background) {
    if (Test-UnfoldReady) {
        if ($ConfigureAI) { throw 'Unfold is already running. Configure AI in Settings, or stop that instance first.' }
        Write-Host "Unfold is ready: $url (existing service reused)."
        if ($OpenBrowser) { Start-Process -FilePath $url }
        return
    }
    if (Test-PortInUse) {
        throw "Port $Port is occupied by an unrelated or unhealthy service. It was not stopped and the address was not changed."
    }
}

# Prefer an explicitly selected entry, then the bundled entry, then system Python.
if ($PythonPath) {
    $python = $PythonPath
} elseif ($env:WORKSPACE_PYTHON_BIN) {
    $python = $env:WORKSPACE_PYTHON_BIN
} else {
    $entry = Get-Command python -ErrorAction SilentlyContinue
    if (-not $entry) { throw 'Python 3.11+ is required. No runtime will be downloaded automatically.' }
    $python = $entry.Source
}
if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    throw 'The selected Python entry is unavailable. Specify -PythonPath; the launcher will not silently switch runtimes.'
}

# Read-only runtime verification; this never creates or synchronizes an environment.
& $python -c "import sys; print(sys.version); print(sys.executable); print(sys.prefix)"
if ($LASTEXITCODE -ne 0) { throw 'The selected Python runtime probe failed.' }
& $python -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)"
if ($LASTEXITCODE -ne 0) { throw 'The selected Python version must be 3.11 or newer.' }

if ($ConfigureAI) {
    Write-Host 'Only configure a service you are authorized to use. Keys remain in this process environment.'
    $base = Read-Host 'AI API root URL (HTTPS, usually ends with /v1)'
    $model = Read-Host 'Model identifier from your provider'
    $secureKey = Read-Host 'API key (hidden input; do not paste it into the web app)' -AsSecureString
    if (-not $base -or -not $model) { throw 'API root URL and model identifier are required.' }
    $env:UNFOLD_AI_BASE_URL = $base.TrimEnd('/')
    $env:UNFOLD_AI_MODEL = $model.Trim()
    $credential = New-Object System.Net.NetworkCredential('', $secureKey)
    $env:UNFOLD_AI_API_KEY = $credential.Password
    $credential = $null
    $secureKey = $null
}

if ($Background) {
    $logDir = Join-Path ([System.IO.Path]::GetTempPath()) 'Unfold'
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    $runId = [guid]::NewGuid().ToString('N')
    $stdout = Join-Path $logDir "server-$Port-$runId.stdout.log"
    $stderr = Join-Path $logDir "server-$Port-$runId.stderr.log"
    $serverPath = Join-Path $PSScriptRoot 'server.py'
    $process = Start-Process -FilePath $python -ArgumentList @('-B', ('"{0}"' -f $serverPath), '--port', "$Port") `
        -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr -PassThru
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    while ($timer.Elapsed.TotalSeconds -lt 30) {
        if (Test-UnfoldReady) {
            Write-Host "Unfold is ready: $url (background service PID $($process.Id))."
            Write-Host 'You may close this launcher. After a computer restart, open Unfold again to restart the local service.'
            if ($OpenBrowser) { Start-Process -FilePath $url }
            return
        }
        $process.Refresh()
        if ($process.HasExited) { throw "The local service exited before it was ready. See: $stderr" }
        Start-Sleep -Milliseconds 200
    }
    throw "The local service did not become ready within 30 seconds. No browser was opened. See: $stderr"
}

Write-Host "Open $url in a browser. Ctrl+C stops the local service."
Write-Host 'No dependencies need to be installed. The service only listens on this computer.'
& $python -B (Join-Path $PSScriptRoot 'server.py') --port $Port
if ($LASTEXITCODE -ne 0) { throw 'The local service exited with an error. Read the message above; no runtime was changed.' }
