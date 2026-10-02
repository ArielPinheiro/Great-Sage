@echo off
setlocal
cd /d "%~dp0"

:: Verifica permissão de Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Solicitando permissao de Administrador...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\" admin\"' -Verb RunAs"
    exit /b
)

echo ========================================================
echo   Configurando GreatSage no Windows Hosts
echo ========================================================
echo.

findstr /i "greatsage" "%WINDIR%\System32\drivers\etc\hosts" >nul
if %errorlevel% equ 0 (
    echo [OK] O endereco "greatsage" ja esta configurado no seu arquivo hosts!
) else (
    echo.>>"%WINDIR%\System32\drivers\etc\hosts"
    echo 127.0.0.1 greatsage>>"%WINDIR%\System32\drivers\etc\hosts"
    echo [SUCESSO] 127.0.0.1 greatsage adicionado com sucesso!
)

echo.
echo ========================================================
echo   PRONTO! Agora voce pode acessar no seu navegador:
echo   http://greatsage/
echo ========================================================
echo.

pause
