@echo off
echo ========================================
echo Sistema de Sincronizacao iFood
echo ========================================
echo.

REM Verificar se o arquivo .env existe
if not exist ".env" (
    echo [AVISO] Arquivo .env nao encontrado!
    echo Criando .env a partir do exemplo...
    copy .env.example .env
    echo.
    echo Por favor, edite o arquivo .env com suas credenciais antes de continuar.
    echo.
    notepad .env
    pause
)

REM Tentar executar com diferentes comandos Python
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Iniciando sistema...
    python main.py
    goto :end
)

python3 --version >nul 2>&1
if %errorlevel% == 0 (
    echo Iniciando sistema...
    python3 main.py
    goto :end
)

py --version >nul 2>&1
if %errorlevel% == 0 (
    echo Iniciando sistema...
    py main.py
    goto :end
)

echo [ERRO] Python nao foi encontrado!
echo Execute install.bat primeiro para instalar as dependencias.
pause

:end