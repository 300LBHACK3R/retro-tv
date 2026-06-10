$ErrorActionPreference = "Stop"

$BaseUrl = "https://www.tatestv.ca"

Write-Host ""
Write-Host "========================================"
Write-Host "TATE'S TV PRODUCTION SMOKE TEST"
Write-Host "========================================"
Write-Host ""

$routes = @(
  "/",
  "/api/health",
  "/api/programming",
  "/health",
  "/recovery",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml"
)

foreach ($route in $routes) {
  $url = "$BaseUrl$route"

  try {
    $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 25 -MaximumRedirection 5
    Write-Host "PASS $route -> $($response.StatusCode)"
  } catch {
    Write-Host "FAIL $route"
    Write-Host $_.Exception.Message
    exit 1
  }
}

Write-Host ""
Write-Host "Running local typecheck..."
npm run typecheck

Write-Host ""
Write-Host "Running local production build..."
npm run build

Write-Host ""
Write-Host "========================================"
Write-Host "SMOKE TEST PASSED"
Write-Host "========================================"
