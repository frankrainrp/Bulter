param(
  [Parameter(Mandatory = $true)]
  [string]$Message
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$appRoot = Join-Path $repoRoot "my-app"

Push-Location $appRoot
try {
  corepack pnpm install --frozen-lockfile
  corepack pnpm --filter @smart-hub/web build
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

  # Use the existing GitHub CLI login for this process only. This avoids a
  # password popup and does not persist a token or change global Git config.
  $token = gh auth token
  if (-not $token) {
    throw "GitHub CLI 尚未登录，请先运行 gh auth login。"
  }
  $pair = [Text.Encoding]::ASCII.GetBytes("x-access-token:$token")
  $basic = [Convert]::ToBase64String($pair)
  $env:GIT_CONFIG_COUNT = "1"
  $env:GIT_CONFIG_KEY_0 = "http.https://github.com/.extraheader"
  $env:GIT_CONFIG_VALUE_0 = "AUTHORIZATION: basic $basic"
  try {
    git push origin master
    if ($LASTEXITCODE -ne 0) { throw "Git 推送失败。" }
  } finally {
    Remove-Item Env:GIT_CONFIG_COUNT, Env:GIT_CONFIG_KEY_0, Env:GIT_CONFIG_VALUE_0 -ErrorAction SilentlyContinue
  }
  Write-Host "已推送。GitHub CI 通过后，Ubuntu 会在约 2 分钟内自动部署。"
} finally {
  Pop-Location
}
