@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado.
  echo Instale o Node.js 20.19 ou superior, recomendado Node.js 22 LTS, e tente novamente.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm nao foi encontrado. Reinstale o Node.js incluindo o npm.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Primeira execucao: instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo Falha ao instalar dependencias.
    pause
    exit /b 1
  )
)

echo Iniciando Transfer Local. Para encerrar, feche esta janela ou pressione Ctrl+C.
call npm run dev
pause
