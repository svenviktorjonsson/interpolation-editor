Param(
    [int]$Port = 5173,
    [switch]$Rebuild,
    [switch]$Release
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-PortListening {
    Param([int]$LocalPort)
    try {
        $conn = Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue
        return $null -ne $conn
    } catch {
        return $false
    }
}

function Get-FreePort {
    Param([int]$Preferred, [int]$MaxTries = 30)
    for ($i = 0; $i -lt $MaxTries; $i++) {
        $candidate = $Preferred + $i
        if (-not (Test-PortListening -LocalPort $candidate)) {
            return $candidate
        }
    }
    throw "Could not find a free port near $Preferred."
}

function Test-WasmStale {
    Param(
        [string]$VektorRepoPath,
        [string]$WasmJsPath
    )

    if (-not (Test-Path $WasmJsPath)) { return $true }
    $wasmTime = (Get-Item $WasmJsPath).LastWriteTimeUtc
    $latestRust = Get-ChildItem -Path (Join-Path $VektorRepoPath "src") -Recurse -File -Include *.rs |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1
    if (-not $latestRust) { return $false }
    return $latestRust.LastWriteTimeUtc -gt $wasmTime
}

$interpolationRepo = $PSScriptRoot
$svenRepoRoot = Split-Path -Parent $interpolationRepo
$repositoriesRoot = Split-Path -Parent $svenRepoRoot
$vektorRepo = Join-Path $repositoriesRoot "tesseracs\packages\vektor"
$platonicRepo = Join-Path $svenRepoRoot "platonic-play"

if (-not (Test-Path $vektorRepo)) {
    throw "Could not find vektor repo at: $vektorRepo"
}
if (-not (Test-Path $platonicRepo)) {
    throw "Could not find platonic-play repo at: $platonicRepo"
}

$sourceWasmDir = Join-Path $platonicRepo "vektor_wasm"
$localWasmDir = Join-Path $interpolationRepo "vektor_wasm"
$sourceWasmJs = Join-Path $sourceWasmDir "vektor.js"
$sourceWasmBin = Join-Path $sourceWasmDir "vektor_bg.wasm"

$needBuild = $Rebuild.IsPresent -or
    (-not (Test-Path $sourceWasmJs)) -or
    (-not (Test-Path $sourceWasmBin)) -or
    (Test-WasmStale -VektorRepoPath $vektorRepo -WasmJsPath $sourceWasmJs)

if ($needBuild) {
    Write-Host "Building real vektor wasm..." -ForegroundColor Cyan
    $buildCopyScript = Join-Path $vektorRepo "build_copy.ps1"
    if (-not (Test-Path $buildCopyScript)) {
        throw "Missing build script: $buildCopyScript"
    }

    Push-Location $vektorRepo
    try {
        if ($Release.IsPresent) {
            & $buildCopyScript -SkipExe
        } else {
            & $buildCopyScript -FastWasm -SkipExe
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "Wasm up-to-date, skipping rebuild." -ForegroundColor DarkGray
}

if (-not (Test-Path $sourceWasmJs) -or -not (Test-Path $sourceWasmBin)) {
    throw "Expected wasm output in $sourceWasmDir (vektor.js + vektor_bg.wasm)."
}

if (-not (Test-Path $localWasmDir)) {
    New-Item -ItemType Directory -Path $localWasmDir | Out-Null
}

Write-Host "Copying wasm to interpolation-editor/vektor_wasm..." -ForegroundColor Cyan
Copy-Item -Path (Join-Path $sourceWasmDir "*") -Destination $localWasmDir -Recurse -Force

$selectedPort = Get-FreePort -Preferred $Port
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
$pyLauncher = Get-Command py -ErrorAction SilentlyContinue
if (-not $pythonCmd -and -not $pyLauncher) {
    throw "Python is required for local http server. Install Python or ensure 'python'/'py' is on PATH."
}

if (-not (Test-PortListening -LocalPort $selectedPort)) {
    Write-Host "Starting local server in interpolation-editor on port $selectedPort..." -ForegroundColor Cyan
    if ($pythonCmd) {
        Start-Process -FilePath $pythonCmd.Source -ArgumentList "-m", "http.server", "$selectedPort" -WorkingDirectory $interpolationRepo | Out-Null
    } else {
        Start-Process -FilePath $pyLauncher.Source -ArgumentList "-m", "http.server", "$selectedPort" -WorkingDirectory $interpolationRepo | Out-Null
    }
    Start-Sleep -Milliseconds 800
}

$url = "http://localhost:$selectedPort/test.html"
Write-Host "Opening $url" -ForegroundColor Green
Start-Process $url
