@echo off
echo ===============================================
echo   Instalador do Magic MCP para SuperClaude
echo ===============================================
echo.

REM Verifica se o npm está instalado
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] npm não encontrado. Por favor, instale o Node.js primeiro.
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/3] Instalando Magic MCP globalmente...
npm install -g @modelcontextprotocol/server-magic

if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar Magic MCP
    pause
    exit /b 1
)

echo.
echo [2/3] Magic MCP instalado com sucesso!
echo.
echo ===============================================
echo   CONFIGURAÇÃO MANUAL NECESSÁRIA
echo ===============================================
echo.
echo Para completar a instalação, você precisa:
echo.
echo 1. Abrir o Claude Desktop
echo 2. Ir em Settings (Configurações)
echo 3. Procurar a seção "Model Context Protocol" ou "MCP Servers"
echo 4. Adicionar um novo servidor com estas configurações:
echo.
echo    Nome: magic
echo    Comando: npx
echo    Argumentos: @modelcontextprotocol/server-magic
echo.
echo 5. Salvar e reiniciar o Claude Desktop
echo.
echo ===============================================
echo.
echo Alternativamente, você pode usar o Smithery:
echo npx @smithery/cli install @21st-dev/magic
echo.
pause