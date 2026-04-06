[CmdletBinding()]
param(
    [string]$StableVersion = "20260406stable1"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$targetRoot = Join-Path $repoRoot "ios-estavel"
$filesToCopy = @(
    "app.js",
    "auth.js",
    "firebase-config.js",
    "firebase-config.example.js",
    "index.html",
    "manifest.webmanifest",
    "README.md",
    "service-worker.js",
    "styles.css",
    "supabase-config.js",
    "supabase-config.example.js",
    "icons"
)

if (Test-Path -LiteralPath $targetRoot) {
    Remove-Item -LiteralPath $targetRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $targetRoot | Out-Null

foreach ($entry in $filesToCopy) {
    $source = Join-Path $repoRoot $entry
    if (-not (Test-Path -LiteralPath $source)) {
        throw "Arquivo ou pasta não encontrado: $source"
    }

    Copy-Item -LiteralPath $source -Destination $targetRoot -Recurse -Force
}

$indexPath = Join-Path $targetRoot "index.html"
$authPath = Join-Path $targetRoot "auth.js"
$workerPath = Join-Path $targetRoot "service-worker.js"
$versionPath = Join-Path $targetRoot "VERSION.txt"

$indexContent = Get-Content -LiteralPath $indexPath -Raw
$indexContent = $indexContent -replace "20260406l", $StableVersion
Set-Content -LiteralPath $indexPath -Value $indexContent -NoNewline

$authContent = Get-Content -LiteralPath $authPath -Raw
$authContent = $authContent -replace "20260406l", $StableVersion
Set-Content -LiteralPath $authPath -Value $authContent -NoNewline

$workerContent = Get-Content -LiteralPath $workerPath -Raw
$workerContent = $workerContent -replace "financeiro-pwa-main-cache-", "financeiro-pwa-stable-cache-"
$workerContent = $workerContent -replace "v25", "v1"
Set-Content -LiteralPath $workerPath -Value $workerContent -NoNewline

$versionContent = @"
versao=$StableVersion
gerado_em=$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@
Set-Content -LiteralPath $versionPath -Value $versionContent -NoNewline

Write-Host "Versão estável iOS gerada em: $targetRoot"
