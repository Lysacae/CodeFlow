@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "ROOT=%~dp0"
set "RUNTIME=%ROOT%runtimes"
set "APP=%ROOT%CodeFlow\CodeFlow.exe"

if not exist "%APP%" (
  echo CodeFlow.exe introuvable : "%APP%"
  echo Compilez d'abord l'application ou recopiez l'executable.
  pause
  exit /b 1
)

REM Prepend portable runtimes to PATH for this session only
if exist "%RUNTIME%\python\python.exe" set "PATH=%RUNTIME%\python;%PATH%"
if exist "%RUNTIME%\dotnet\dotnet.exe" set "PATH=%RUNTIME%\dotnet;%PATH%"
if exist "%RUNTIME%\mingw64\bin\g++.exe" set "PATH=%RUNTIME%\mingw64\bin;%PATH%"
if exist "%RUNTIME%\jdk\bin\javac.exe" set "PATH=%RUNTIME%\jdk\bin;%PATH%"

set "DOTNET_ROOT=%RUNTIME%\dotnet"
set "JAVA_HOME=%RUNTIME%\jdk"
set "DOTNET_CLI_HOME=%RUNTIME%\dotnet-cli-home"
set "DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1"
set "DOTNET_NOLOGO=1"
set "DOTNET_WANT_CLI_TELEMETRY=0"

if not exist "%DOTNET_CLI_HOME%" mkdir "%DOTNET_CLI_HOME%" >nul 2>&1

echo.
echo CodeFlow — environnement portable
echo ---------------------------------
where python >nul 2>&1 && (for /f "delims=" %%i in ('where python') do echo Python : %%i & goto :py_done)
echo Python : non detecte
:py_done
where dotnet >nul 2>&1 && (for /f "delims=" %%i in ('where dotnet') do echo .NET   : %%i & goto :dn_done)
echo .NET   : non detecte
:dn_done
where g++ >nul 2>&1 && (for /f "delims=" %%i in ('where g++') do echo C++    : %%i & goto :cpp_done)
echo C++    : non detecte
:cpp_done
where javac >nul 2>&1 && (for /f "delims=" %%i in ('where javac') do echo Java   : %%i & goto :java_done)
echo Java   : non detecte
:java_done
echo.

if not exist "%RUNTIME%\python\python.exe" (
  if not exist "%RUNTIME%\dotnet\dotnet.exe" (
    echo Les runtimes portables semblent absents.
    echo Executez setup-runtimes.ps1 avant le premier lancement.
    echo.
  )
)

start "" "%APP%"
endlocal
