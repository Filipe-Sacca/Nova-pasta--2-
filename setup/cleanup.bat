@echo off
echo Removendo arquivos desnecessarios...

REM Deletar scripts de instalacao
del install.bat 2>nul
del install.ps1 2>nul
del install_python.bat 2>nul
del install_portable_python.bat 2>nul
del download_python_installer.bat 2>nul
del install_with_scoop.bat 2>nul
del add_python_to_path.bat 2>nul
del install_and_run.bat 2>nul
del find_and_use_python.bat 2>nul
del run_with_any_python.bat 2>nul
del setup_python.ps1 2>nul
del setup_and_run.bat 2>nul
del run.bat 2>nul
del python_installer.exe 2>nul
del INSTRUCOES_INSTALACAO.md 2>nul

echo Arquivos de instalacao removidos!
echo.
echo Mantidos apenas os arquivos essenciais:
dir *.py /b
echo .env
echo requirements.txt
echo.
pause