[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)] [int] $Port = 8791,
    [string] $PythonPath = '',
    [switch] $ConfigureAI
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:PYTHONDONTWRITEBYTECODE = '1'

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

Write-Host "Open http://127.0.0.1:$Port in a browser. Ctrl+C stops the local service."
Write-Host 'No dependencies need to be installed. The service only listens on this computer.'
& $python -B (Join-Path $PSScriptRoot 'server.py') --port $Port
if ($LASTEXITCODE -ne 0) { throw 'The local service exited with an error. Read the message above; no runtime was changed.' }
