[CmdletBinding()]
param(
    [string]$StableVersion = "$(Get-Date -Format 'yyyyMMdd')stable1"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$targetRoot = Join-Path $repoRoot "ios-estavel"
$oldRoot = Join-Path $repoRoot "old"
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

function Get-CurrentBuildToken {
    param([string]$AuthPath)

    $authContent = Get-Content -LiteralPath $AuthPath -Raw
    $match = [regex]::Match($authContent, 'const IOS_BUILD_TOKEN = "([^"]+)"')
    if (-not $match.Success) {
        throw "Nao foi possivel localizar o IOS_BUILD_TOKEN em $AuthPath"
    }

    return $match.Groups[1].Value
}

function Get-ArchivedStableName {
    param([string]$StablePath)

    $versionFile = Join-Path $StablePath "VERSION.txt"
    if (Test-Path -LiteralPath $versionFile) {
        $versionLine = Get-Content -LiteralPath $versionFile | Where-Object { $_ -match '^versao=' } | Select-Object -First 1
        if ($versionLine) {
            return ($versionLine -replace '^versao=', '').Trim()
        }
    }

    return "sem-versao-$(Get-Date -Format 'yyyyMMddHHmmss')"
}

if (-not (Test-Path -LiteralPath $oldRoot)) {
    New-Item -ItemType Directory -Path $oldRoot | Out-Null
}

if (Test-Path -LiteralPath $targetRoot) {
    $archivedStableName = Get-ArchivedStableName -StablePath $targetRoot
    $archivePath = Join-Path $oldRoot "ios-estavel-$archivedStableName"
    if (Test-Path -LiteralPath $archivePath) {
        $archivePath = Join-Path $oldRoot "ios-estavel-$archivedStableName-$(Get-Date -Format 'yyyyMMddHHmmss')"
    }

    Move-Item -LiteralPath $targetRoot -Destination $archivePath
    Write-Host "Versao estavel anterior arquivada em: $archivePath"
}

New-Item -ItemType Directory -Path $targetRoot | Out-Null

foreach ($entry in $filesToCopy) {
    $source = Join-Path $repoRoot $entry
    if (-not (Test-Path -LiteralPath $source)) {
        throw "Arquivo ou pasta nao encontrado: $source"
    }

    Copy-Item -LiteralPath $source -Destination $targetRoot -Recurse -Force
}

$authPath = Join-Path $targetRoot "auth.js"
$indexPath = Join-Path $targetRoot "index.html"
$workerPath = Join-Path $targetRoot "service-worker.js"
$versionPath = Join-Path $targetRoot "VERSION.txt"
$rootAuthPath = Join-Path $repoRoot "auth.js"

$currentBuildToken = Get-CurrentBuildToken -AuthPath $rootAuthPath

$authContent = Get-Content -LiteralPath $authPath -Raw
$authContent = $authContent.Replace($currentBuildToken, $StableVersion)
Set-Content -LiteralPath $authPath -Value $authContent -NoNewline

$indexContent = Get-Content -LiteralPath $indexPath -Raw
$indexContent = $indexContent.Replace($currentBuildToken, $StableVersion)
Set-Content -LiteralPath $indexPath -Value $indexContent -NoNewline

$workerContent = Get-Content -LiteralPath $workerPath -Raw
$workerContent = $workerContent.Replace('const CACHE_PREFIX = "financeiro-pwa-main-cache-";', 'const CACHE_PREFIX = "financeiro-pwa-stable-cache-";')
$workerCacheNameLine = 'const CACHE_NAME = `${CACHE_PREFIX}' + $StableVersion + '`;'
$workerContent = [regex]::Replace($workerContent, 'const CACHE_NAME = `\$\{CACHE_PREFIX\}[^`]+`;', $workerCacheNameLine)
Set-Content -LiteralPath $workerPath -Value $workerContent -NoNewline

$versionContent = @"
versao=$StableVersion
gerado_em=$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@
Set-Content -LiteralPath $versionPath -Value $versionContent -NoNewline

Write-Host "Nova versao estavel iOS gerada em: $targetRoot"
