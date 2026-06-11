$ErrorActionPreference = "Stop"

$BaseUrl = "https://www.tatestv.ca"

Write-Host ""
Write-Host "========================================"
Write-Host "TATE'S TV PRODUCTION SMOKE TEST V2"
Write-Host "========================================"
Write-Host ""

$routes = @(
  "/",
  "/api/health",
  "/api/programming",
  "/health",
  "/launch",
  "/compat",
  "/install",
  "/help",
  "/offline",
  "/readiness",
  "/android",
  "/recovery",
  "/backup",
  "/manifest.webmanifest",
  "/.well-known/assetlinks.json",
  "/favicon.ico",
  "/favicon.svg",
  "/tatestv-logo.png",
  "/apple-icon-180.png",
  "/favicon-512.png",
  "/maskable-icon.svg",
  "/safari-pinned-tab.svg",
  "/browserconfig.xml",
  "/robots.txt",
  "/sitemap.xml",
  "/sw.js"
)

function Get-ResponseText {
  param(
    [Parameter(Mandatory = $true)] $Response
  )

  if ($Response.Content -is [byte[]]) {
    return [System.Text.Encoding]::UTF8.GetString($Response.Content)
  }

  return [string]$Response.Content
}

function Assert-Header {
  param(
    [Parameter(Mandatory = $true)] $Response,
    [Parameter(Mandatory = $true)] [string] $HeaderName,
    [Parameter(Mandatory = $true)] [string] $Route
  )

  if (-not $Response.Headers[$HeaderName]) {
    throw "$Route missing required header: $HeaderName"
  }
}

function Assert-ContentType {
  param(
    [Parameter(Mandatory = $true)] $Response,
    [Parameter(Mandatory = $true)] [string] $Route,
    [Parameter(Mandatory = $true)] [string[]] $Allowed
  )

  $contentType = [string]$Response.Headers["Content-Type"]

  foreach ($allowedType in $Allowed) {
    if ($contentType -like "*$allowedType*") {
      return
    }
  }

  throw "$Route returned unexpected Content-Type: $contentType"
}

function Get-Json {
  param(
    [Parameter(Mandatory = $true)] [string] $Route
  )

  $url = "$BaseUrl$route"
  $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 25 -MaximumRedirection 5

  Assert-Header -Response $response -HeaderName "X-Content-Type-Options" -Route $route
  Assert-Header -Response $response -HeaderName "Referrer-Policy" -Route $route
  Assert-ContentType -Response $response -Route $route -Allowed @("application/json", "application/manifest+json")

  $text = Get-ResponseText -Response $response
  return $text | ConvertFrom-Json
}

foreach ($route in $routes) {
  $url = "$BaseUrl$route"

  try {
    $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 25 -MaximumRedirection 5

    Assert-Header -Response $response -HeaderName "X-Content-Type-Options" -Route $route
    Assert-Header -Response $response -HeaderName "Referrer-Policy" -Route $route

    if ($route -eq "/favicon.svg" -or $route -eq "/maskable-icon.svg" -or $route -eq "/safari-pinned-tab.svg") {
      Assert-ContentType -Response $response -Route $route -Allowed @("image/svg+xml", "text/xml", "application/xml")
    }

    if ($route -eq "/apple-icon-180.png" -or $route -eq "/favicon-512.png") {
      Assert-ContentType -Response $response -Route $route -Allowed @("image/png")
    }

    if ($route -eq "/browserconfig.xml" -or $route -eq "/sitemap.xml") {
      Assert-ContentType -Response $response -Route $route -Allowed @("application/xml", "text/xml")
    }

    if ($route -eq "/manifest.webmanifest") {
      Assert-ContentType -Response $response -Route $route -Allowed @("application/manifest+json", "application/json")

      $manifestText = Get-ResponseText -Response $response
      $manifest = $manifestText | ConvertFrom-Json

      if (-not $manifest.name) {
        throw "Manifest missing name"
      }

      if (-not $manifest.short_name) {
        throw "Manifest missing short_name"
      }

      if (-not $manifest.start_url) {
        throw "Manifest missing start_url"
      }

      if (-not $manifest.display) {
        throw "Manifest missing display"
      }

      if (-not $manifest.icons -or $manifest.icons.Count -lt 1) {
        throw "Manifest missing icons"
      }
    }

    Write-Host "PASS $route -> $($response.StatusCode)"
  } catch {
    Write-Host "FAIL $route"
    Write-Host $_.Exception.Message
    exit 1
  }
}

Write-Host ""
Write-Host "Validating JSON APIs..."

$health = Get-Json -Route "/api/health"

if ($health.ok -ne $true) {
  Write-Host "FAIL /api/health"
  Write-Host "Expected ok: true"
  exit 1
}

if (-not $health.status) {
  Write-Host "FAIL /api/health"
  Write-Host "Missing status"
  exit 1
}

Write-Host "PASS /api/health JSON"

$programming = Get-Json -Route "/api/programming"

if ($null -eq $programming) {
  Write-Host "FAIL /api/programming"
  Write-Host "Programming API returned null"
  exit 1
}

Write-Host "PASS /api/programming JSON"

Write-Host ""
Write-Host "Running local typecheck..."
npm run typecheck

Write-Host ""
Write-Host "Running local production build..."
npm run build

Write-Host ""
Write-Host "========================================"
Write-Host "SMOKE TEST V2 PASSED"
Write-Host "========================================"
