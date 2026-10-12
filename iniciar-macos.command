#!/bin/bash
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js e npm nao foram encontrados."
  echo "Instale o Node.js 20.19 ou superior (recomendado Node.js 22 LTS) e tente novamente."
  read -r -p "Pressione Enter para fechar..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Primeira execucao: instalando dependencias..."
  npm install || { echo "Falha ao instalar dependencias."; read -r -p "Pressione Enter para fechar..."; exit 1; }
fi

echo "Iniciando Transfer Local. Para encerrar, pressione Ctrl+C."
npm run dev
