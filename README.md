# Transfer Local

Aplicação web para enviar arquivos do celular para o computador diretamente pela rede local. Não usa nuvem: o backend grava os arquivos no disco do computador que está executando o servidor.

## Funcionalidades

- Interface responsiva para celular e desktop.
- Upload de vários arquivos com barra de progresso.
- Lista dos arquivos recebidos, tamanho e data.
- Download dos arquivos pelo navegador.
- PIN de seis dígitos gerado no início do servidor.
- Salvamento na pasta `TransferenciasCelular` dentro da pasta pessoal do usuário, por padrão.
- Backend Node.js/Express e frontend React/TypeScript.

## Requisitos

- Node.js 20.19 ou superior (recomendado Node.js 22 LTS).
- npm.
- Celular e computador na mesma rede local. O roteador precisa permitir comunicação entre clientes Wi-Fi e dispositivos Ethernet.

## Iniciar com dois cliques (Linux, Windows ou macOS)

O computador precisa ter Node.js 20.19 ou superior instalado (recomendado Node.js 22 LTS). Na primeira execução, o iniciador instala automaticamente as dependências; é necessária conexão com a internet apenas para essa instalação.

- **Ubuntu/Linux:** execute `iniciar-linux.sh`. Se o gerenciador de arquivos não executar o script com dois cliques, abra o terminal na pasta e rode `./iniciar-linux.sh`.
- **Windows:** dê dois cliques em `iniciar-windows.bat`.
- **macOS:** dê dois cliques em `iniciar-macos.command`. Se o macOS bloquear a execução, abra o Terminal na pasta do projeto e rode `chmod +x iniciar-macos.command && ./iniciar-macos.command`.

O iniciador abre o servidor de desenvolvimento e mantém a janela do terminal aberta. O terminal do backend exibirá um PIN de seis dígitos, a pasta de destino e os endereços de rede encontrados. No celular, abra `http://IP-DO-COMPUTADOR:5173` e digite o PIN exibido. Para encerrar, pressione `Ctrl+C` na janela do terminal.

## Executar manualmente (alternativa para desenvolvedores)

Na pasta do projeto, execute:

```bash
npm install
npm run dev
```

Abra `http://localhost:5173` no computador. No celular, use `http://IP-DO-COMPUTADOR:5173`.

O frontend de desenvolvimento encaminha `/api` para o backend na porta 3000. O terminal do backend lista os endereços IP das interfaces de rede; use o endereço da rede compartilhada com o celular.

## Executar como versão de produção local

```bash
npm install
npm run build
npm start
```

Abra `http://IP-DO-COMPUTADOR:3000` no celular. O servidor exibe o endereço e o PIN no terminal. O backend serve os arquivos compilados do frontend e recebe os uploads.

## Configuração opcional

As variáveis de ambiente abaixo podem ser definidas antes de iniciar o servidor:

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta HTTP do backend |
| `TRANSFER_PIN` | PIN aleatório | Define um PIN fixo de seis dígitos para a sessão |
| `TRANSFER_DIRECTORY` | `~/TransferenciasCelular` | Pasta de destino dos uploads |
| `MAX_FILE_SIZE_MB` | `2048` | Tamanho máximo por arquivo, em MB |
| `MAX_FILES_PER_UPLOAD` | `30` | Número máximo de arquivos por envio |

O diretório é criado automaticamente se não existir. Exemplo no Bash:

```bash
TRANSFER_DIRECTORY="$HOME/Documentos/ArquivosRecebidos" npm start
```

No PowerShell, use `$env:TRANSFER_DIRECTORY = "$HOME\Documents\ArquivosRecebidos"` antes de `npm start`.

## Rede e firewall

- O computador deve estar conectado à mesma rede local que o celular.
- Se o sistema operacional perguntar, permita conexões privadas na porta escolhida. Não libere a porta para redes públicas.
- Se o celular não abrir o endereço, verifique o IP do computador, a rede de convidados/isolamento de clientes do roteador e o firewall.
- O servidor escuta na interface de rede para permitir acesso do celular. Use somente em uma rede confiável e encerre com `Ctrl+C` quando terminar.

## Segurança e limitações

- O PIN é uma barreira simples de acesso para uma ferramenta de rede local; não é autenticação forte nem criptografa o tráfego HTTP. Use apenas em uma rede confiável e não exponha o servidor diretamente à internet.
- A pasta de destino pode conter arquivos enviados por outros dispositivos que conheçam o PIN. Evite executar arquivos recebidos sem verificá-los.
- Os nomes são sanitizados e caminhos enviados pelo cliente não são usados como caminhos de destino. Arquivos com nomes repetidos recebem um sufixo numérico.
- Limites de tamanho e quantidade são configuráveis. Confirme que há espaço livre suficiente no disco para vídeos grandes.
- A aplicação não exige Linux; o Node.js oferece suporte a Linux, Windows e macOS. Ainda assim, valide a rede e o firewall em cada sistema operacional.

## Estrutura

```text
transfer-local/
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/
│   ├── src/index.js
│   └── package.json
├── iniciar-linux.sh
├── iniciar-windows.bat
├── iniciar-macos.command
├── .gitignore
├── package.json
└── README.md
```

## Próximas melhorias

- Testes automatizados de upload e validação.
- Autenticação por sessão em vez de enviar o PIN em cada requisição.
- Limpeza de arquivos temporários em uploads interrompidos.
- Empacotamento opcional para iniciar o servidor com um clique.

## Seleção de arquivos no celular

A interface guarda a sessão de conexão durante a aba e salva temporariamente a seleção de arquivos no armazenamento local do navegador (IndexedDB). Isso permite recuperar a seleção se o navegador recarregar a página ao retornar do seletor de arquivos. A seleção temporária fica no dispositivo móvel e é limpa após o envio bem-sucedido.
