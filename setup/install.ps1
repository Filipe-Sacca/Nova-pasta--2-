# Script PowerShell para instalar dependências

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Instalando dependências do projeto" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se Python está instalado
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Python encontrado: $pythonVersion" -ForegroundColor Green
        
        # Atualizar pip
        Write-Host "Atualizando pip..." -ForegroundColor Yellow
        python -m pip install --upgrade pip
        
        # Instalar dependências
        Write-Host "Instalando dependências..." -ForegroundColor Yellow
        python -m pip install -r requirements.txt
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "✓ Instalação concluída com sucesso!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Para executar o sistema, use:" -ForegroundColor Cyan
        Write-Host "  python main.py" -ForegroundColor White
        Write-Host ""
    }
} catch {
    Write-Host "[ERRO] Python não foi encontrado!" -ForegroundColor Red
    Write-Host "Por favor, instale o Python em:" -ForegroundColor Yellow
    Write-Host "https://www.python.org/downloads/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Ou instale via Microsoft Store:" -ForegroundColor Yellow
    Write-Host "1. Abra a Microsoft Store" -ForegroundColor White
    Write-Host "2. Pesquise por Python" -ForegroundColor White
    Write-Host "3. Instale a versão mais recente" -ForegroundColor White
}

Write-Host "Pressione qualquer tecla para continuar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")