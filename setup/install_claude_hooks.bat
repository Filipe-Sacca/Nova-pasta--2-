@echo off
echo ========================================
echo  Instalador de Hooks do Claude
echo ========================================
echo.

REM Verifica se Node.js está instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado! Instale primeiro.
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js encontrado
echo.

REM Verifica se Git está instalado
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Git nao encontrado! Instale primeiro.
    pause
    exit /b 1
)

echo [OK] Git encontrado
echo.

REM Cria diretório de hooks
echo Criando diretorio de hooks...
if not exist "%APPDATA%\Claude\hooks" (
    mkdir "%APPDATA%\Claude\hooks"
    echo [OK] Diretorio criado
) else (
    echo [OK] Diretorio ja existe
)
echo.

REM Verifica se os arquivos foram criados
echo Verificando arquivos de hook...
if exist "%APPDATA%\Claude\hooks\commit-system.js" (
    echo [OK] commit-system.js encontrado
) else (
    echo [ERRO] commit-system.js nao encontrado
    echo Execute este script atraves do Claude primeiro!
    pause
    exit /b 1
)

if exist "%APPDATA%\Claude\hooks\smart_commit.py" (
    echo [OK] smart_commit.py encontrado
) else (
    echo [INFO] smart_commit.py opcional nao encontrado
)
echo.

REM Verifica configuração
echo Verificando configuracao do Claude...
if exist "%APPDATA%\Claude\claude_desktop_config.json" (
    echo [OK] Configuracao encontrada
    echo.
    echo Conteudo atual:
    type "%APPDATA%\Claude\claude_desktop_config.json"
) else (
    echo [ERRO] Configuracao nao encontrada
    pause
    exit /b 1
)
echo.
echo.

echo ========================================
echo  INSTALACAO CONCLUIDA COM SUCESSO!
echo ========================================
echo.
echo COMANDOS DISPONIVEIS:
echo.
echo   /commit [mensagem]     - Commit com mensagem
echo   /smart-commit          - Commit inteligente automatico
echo   /commit-all            - Commit tudo com timestamp
echo   /amend [mensagem]      - Altera ultimo commit
echo   /push                  - Push para origin
echo   /status                - Status do git
echo   /log                   - Historico de commits
echo.
echo IMPORTANTE:
echo 1. Reinicie o Claude Desktop para ativar os hooks
echo 2. Os comandos funcionam em qualquer conversa
echo 3. Use /smart-commit para commits automaticos
echo.
echo ========================================
pause