cd C:\Users\techn\retro-tv

$Utf8NoBom = New-Object System.Text.UTF8Encoding $false
$Path = ".\components\GuideGrid.tsx"

$Content = Get-Content $Path -Raw

$Content = $Content.Replace(
  'const [nowMs, setNowMs] = useState(() => Date.now());',
  'const [nowMs, setNowMs] = useState(() => BROADCAST_EPOCH_MS);'
)

[System.IO.File]::WriteAllText(
  (Resolve-Path $Path).Path,
  $Content,
  $Utf8NoBom
)

npm run typecheck
npm run build