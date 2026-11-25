#Requires -Version 5.1
<#
.SYNOPSIS
  Télécharge les runtimes portables (Python, .NET, MinGW, JDK) dans portable/runtimes.
#>
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Runtimes = Join-Path $Root "runtimes"
$Temp = Join-Path $Root "_tmp"

New-Item -ItemType Directory -Force -Path $Runtimes, $Temp | Out-Null

function Write-Step($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Expand-Zip($zipPath, $dest) {
  if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Expand-Archive -Path $zipPath -DestinationPath $dest -Force
}

function Download-File($url, $outFile) {
  Write-Host "Téléchargement : $url"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $url -OutFile $outFile -UseBasicParsing
}

# --- Python embeddable ---
Write-Step "Python 3.12 (embeddable)"
$pyDir = Join-Path $Runtimes "python"
$pyZip = Join-Path $Temp "python-embed.zip"
if (-not (Test-Path (Join-Path $pyDir "python.exe"))) {
  Download-File "https://www.python.org/ftp/python/3.12.8/python-3.12.8-embed-amd64.zip" $pyZip
  Expand-Zip $pyZip $pyDir
  # Activer import site pour un usage plus complet
  $pth = Get-ChildItem $pyDir -Filter "python*._pth" | Select-Object -First 1
  if ($pth) {
    $content = Get-Content $pth.FullName
    $content = $content -replace "^#import site", "import site"
    if ($content -notcontains "import site") { $content += "import site" }
    Set-Content -Path $pth.FullName -Value $content
  }
} else {
  Write-Host "Déjà présent."
}

# --- JDK Temurin 21 ---
Write-Step "JDK Temurin 21"
$jdkDir = Join-Path $Runtimes "jdk"
$jdkZip = Join-Path $Temp "jdk.zip"
if (-not (Test-Path (Join-Path $jdkDir "bin\javac.exe"))) {
  $jdkUrl = "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk"
  Download-File $jdkUrl $jdkZip
  $jdkExtract = Join-Path $Temp "jdk-extract"
  Expand-Zip $jdkZip $jdkExtract
  $inner = Get-ChildItem $jdkExtract -Directory | Select-Object -First 1
  if (Test-Path $jdkDir) { Remove-Item -Recurse -Force $jdkDir }
  Move-Item $inner.FullName $jdkDir
} else {
  Write-Host "Déjà présent."
}

# --- MinGW (winlibs, UCRT runtime) ---
Write-Step "Compilateur C++ (MinGW / winlibs)"
$mingwDir = Join-Path $Runtimes "mingw64"
$mingwZip = Join-Path $Temp "mingw.zip"
if (-not (Test-Path (Join-Path $mingwDir "bin\g++.exe"))) {
  # Archive winlibs stable (GCC 14 + MinGW-w64 UCRT)
  $mingwUrl = "https://github.com/brechtsanders/winlibs_mingw/releases/download/14.2.0posix-19.1.1-12.0.0-ucrt-r2/winlibs-x86_64-posix-seh-gcc-14.2.0-mingw-w64ucrt-12.0.0-r2.zip"
  Download-File $mingwUrl $mingwZip
  $mingwExtract = Join-Path $Temp "mingw-extract"
  Expand-Zip $mingwZip $mingwExtract
  $innerMingw = Get-ChildItem $mingwExtract -Directory | Where-Object { $_.Name -match "mingw" } | Select-Object -First 1
  if (-not $innerMingw) { $innerMingw = Get-ChildItem $mingwExtract -Directory | Select-Object -First 1 }
  if (Test-Path $mingwDir) { Remove-Item -Recurse -Force $mingwDir }
  Move-Item $innerMingw.FullName $mingwDir
} else {
  Write-Host "Déjà présent."
}

# --- .NET SDK 8 ---
Write-Step ".NET SDK 8"
$dotnetDir = Join-Path $Runtimes "dotnet"
$dotnetZip = Join-Path $Temp "dotnet-sdk.zip"
if (-not (Test-Path (Join-Path $dotnetDir "dotnet.exe"))) {
  $dotnetUrl = "https://aka.ms/dotnet/8.0/dotnet-sdk-win-x64.zip"
  Download-File $dotnetUrl $dotnetZip
  Expand-Zip $dotnetZip $dotnetDir
} else {
  Write-Host "Déjà présent."
}

Write-Step "Nettoyage"
Remove-Item -Recurse -Force $Temp -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Runtimes portables prêts dans : $Runtimes" -ForegroundColor Green
Write-Host "Lancez CodeFlow avec Lancer-CodeFlow.bat"
