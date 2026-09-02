param(
  [Parameter(Mandatory = $true)]
  [string]$Message
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$appRoot = Join-Path $repoRoot "my-app"

Push-Location $appRoot
try {
  corepack enable
  corepack prepare pnpm@9.0.0 --activate
  pnpm install --frozen-lockfile
  pnpm --filter @smart-hub/web build
} finally {
  Pop-Location
}

Push-Location $repoRoot
try {
  git add -A
  git diff --cached --quiet
  if ($LASTEXITCODE -eq 0) {
    Write-Host "没有需要发布的改动。"
    exit 0
  }
  git commit -m $Message
  git push origin master
  Write-Host "已推送。GitHub CI 通过后，Ubuntu 会在约 2 分钟内自动部署。"
} finally {
  Pop-Location
}
