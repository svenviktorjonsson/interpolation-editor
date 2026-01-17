$ErrorActionPreference = "Stop"

$port = 8000
$url = "http://localhost:$port/test.html"

Write-Host "Starting local server on $url"

# Always run build before starting the server.
Write-Host "Running build script..."
npm run build

# Try to use Python's built-in server.
try {
    Start-Process $url
    python -m http.server $port
} catch {
    Write-Host "Failed to start Python server. Ensure Python is installed and on PATH."
    throw
}
