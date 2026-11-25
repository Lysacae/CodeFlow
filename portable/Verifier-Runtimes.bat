@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "ROOT=%~dp0"
set "RUNTIME=%ROOT%runtimes"

if exist "%RUNTIME%\python\python.exe" set "PATH=%RUNTIME%\python;%PATH%"
if exist "%RUNTIME%\dotnet\dotnet.exe" set "PATH=%RUNTIME%\dotnet;%PATH%"
if exist "%RUNTIME%\mingw64\bin\g++.exe" set "PATH=%RUNTIME%\mingw64\bin;%PATH%"
if exist "%RUNTIME%\jdk\bin\javac.exe" set "PATH=%RUNTIME%\jdk\bin;%PATH%"

echo Verification des runtimes portables
echo ==================================
echo.

echo [Python]
python --version 2>&1
echo.

echo [.NET]
dotnet --version 2>&1
echo.

echo [C++]
g++ --version 2>&1 | findstr /i "g++ gcc"
echo.

echo [Java]
javac -version 2>&1
java -version 2>&1
echo.

pause
endlocal
