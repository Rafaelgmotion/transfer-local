import express from 'express';
import multer from 'multer';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 2048);
const MAX_FILES_PER_UPLOAD = Number(process.env.MAX_FILES_PER_UPLOAD || 30);
const PIN = process.env.TRANSFER_PIN || String(crypto.randomInt(100000, 1000000));
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../../client/dist');
const uploadDirectory = process.env.TRANSFER_DIRECTORY
  ? path.resolve(process.env.TRANSFER_DIRECTORY)
  : path.join(os.homedir(), 'TransferenciasCelular');

fs.mkdirSync(uploadDirectory, { recursive: true });
app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));

function requirePin(req, res, next) {
  const suppliedPin = req.get('x-transfer-pin');
  if (typeof suppliedPin !== 'string' || suppliedPin.length !== 6 || suppliedPin !== PIN) {
    return res.status(401).json({ error: 'PIN incorreto. Confira o PIN exibido no terminal do computador.' });
  }
  next();
}

function safeOriginalName(name) {
  // Remove caminhos enviados pelo cliente e caracteres de controle; never use this as a filesystem path.
  const base = path.basename(String(name || 'arquivo')).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  const cleaned = base.replace(/[<>:"/\\|?*]/g, '_').replace(/[. ]+$/g, '');
  return cleaned.slice(0, 180) || 'arquivo';
}

const reservedNames = new Set();

function uniqueDestination(originalName) {
  const safeName = safeOriginalName(originalName);
  const extension = path.extname(safeName).slice(0, 20);
  const stem = path.basename(safeName, path.extname(safeName)).slice(0, 140) || 'arquivo';
  let candidate = path.join(uploadDirectory, safeName);
  let counter = 1;
  while (fs.existsSync(candidate) || reservedNames.has(candidate)) {
    candidate = path.join(uploadDirectory, `${stem} (${counter})${extension}`);
    counter += 1;
  }
  reservedNames.add(candidate);
  return candidate;
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (req, file, callback) => {
    // Use a safe, unique destination name while retaining the original extension/name where possible.
    const destination = uniqueDestination(file.originalname);
    req.uploadDestinations ??= [];
    req.uploadDestinations.push({ path: destination, name: path.basename(destination) });
    callback(null, path.basename(destination));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    files: MAX_FILES_PER_UPLOAD
  }
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/files', requirePin, (_req, res) => {
  try {
    const files = fs.readdirSync(uploadDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const fullPath = path.join(uploadDirectory, entry.name);
        const stats = fs.statSync(fullPath);
        return { name: entry.name, size: stats.size, modifiedAt: stats.mtime.toISOString() };
      })
      .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
    res.json({ files, directory: uploadDirectory });
  } catch {
    res.status(500).json({ error: 'Não foi possível listar os arquivos.' });
  }
});

app.post('/api/upload', requirePin, (req, res) => {
  upload.array('files', MAX_FILES_PER_UPLOAD)(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        const message = error.code === 'LIMIT_FILE_SIZE'
          ? `Um arquivo excedeu o limite de ${MAX_FILE_SIZE_MB} MB.`
          : error.code === 'LIMIT_FILE_COUNT'
            ? `O limite é de ${MAX_FILES_PER_UPLOAD} arquivos por envio.`
            : 'Não foi possível processar o envio dos arquivos.';
        return res.status(400).json({ error: message });
      }
      return res.status(400).json({ error: 'Falha ao receber os arquivos.' });
    }
    const files = (req.files || []).map((file) => ({ name: file.filename, size: file.size }));
    if (files.length === 0) return res.status(400).json({ error: 'Selecione ao menos um arquivo.' });
    return res.status(201).json({ message: `${files.length} arquivo(s) recebido(s).`, files });
  });
});

app.get('/api/download/:name', requirePin, (req, res) => {
  const name = path.basename(req.params.name);
  if (!name || name !== req.params.name) return res.status(400).json({ error: 'Nome de arquivo inválido.' });
  const fullPath = path.resolve(uploadDirectory, name);
  if (path.dirname(fullPath) !== path.resolve(uploadDirectory) || !fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    return res.status(404).json({ error: 'Arquivo não encontrado.' });
  }
  return res.download(fullPath, name);
});

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
  app.get('/', (_req, res) => res.type('text').send('Servidor ativo. Execute npm run dev para iniciar a interface durante o desenvolvimento.'));
}

app.use((error, _req, res, _next) => {
  console.error('Erro inesperado:', error?.message || error);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

function getLanAddresses() {
  const addresses = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const info of interfaces || []) {
      if (info.family === 'IPv4' && !info.internal) addresses.push(info.address);
    }
  }
  return [...new Set(addresses)];
}

app.listen(PORT, '0.0.0.0', () => {
  console.log('\nTransfer Local iniciado.');
  console.log(`PIN de acesso: ${PIN}`);
  console.log(`Pasta de destino: ${uploadDirectory}`);
  console.log('Acesse pelo celular usando um dos endereços abaixo:');
  for (const address of getLanAddresses()) console.log(`  http://${address}:${PORT}`);
  console.log('\nUse somente em uma rede local confiável. Pressione Ctrl+C para encerrar.\n');
});
