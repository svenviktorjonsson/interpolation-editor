Param(
    [string]$Path = "$PSScriptRoot\test-radius.html"
)

if (-not (Test-Path -LiteralPath $Path)) {
    Write-Error "File not found: $Path"
    exit 1
}

$item = Get-Item -LiteralPath $Path
$cacheBust = $item.LastWriteTimeUtc.ToFileTimeUtc()
$uri = "file:///$($item.FullName -replace '\\','/')?v=$cacheBust"

Start-Process $uri
