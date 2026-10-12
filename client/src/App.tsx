import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ArrowDownToLine, CheckCircle2, File as FileIcon, FileImage, FileText, Film, FolderOpen, HardDrive, LockKeyhole, RefreshCw, Send, ShieldCheck, Smartphone, UploadCloud, Wifi, X } from 'lucide-react';

type RemoteFile = { name: string; size: number; modifiedAt: string };
type Notice = { kind: 'success' | 'error' | 'info'; text: string };

type SavedSelection = { id: 'selection'; files: File[] };

function openSelectionDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('transfer-local', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('pending', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSelection(files: File[]): Promise<void> {
  const db = await openSelectionDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('pending', 'readwrite');
    transaction.objectStore('pending').put({ id: 'selection', files } satisfies SavedSelection);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  db.close();
}

async function loadSelection(): Promise<File[]> {
  const db = await openSelectionDb();
  const saved = await new Promise<SavedSelection | undefined>((resolve, reject) => {
    const request = db.transaction('pending', 'readonly').objectStore('pending').get('selection');
    request.onsuccess = () => resolve(request.result as SavedSelection | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return saved?.files ?? [];
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${units[index]}`;
};

const fileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'svg'].includes(ext || '')) return FileImage;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext || '')) return Film;
  if (['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx'].includes(ext || '')) return FileText;
  return FileIcon;
};

export default function App() {
  const [pin, setPin] = useState(() => sessionStorage.getItem('transfer-local-pin') || '');
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem('transfer-local-authenticated') === 'true' && /^\d{6}$/.test(sessionStorage.getItem('transfer-local-pin') || ''));
  const [selected, setSelected] = useState<File[]>([]);
  const [remoteFiles, setRemoteFiles] = useState<RemoteFile[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [directory, setDirectory] = useState('');
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const api = useCallback(async (url: string, init: RequestInit = {}) => {
    return fetch(url, { ...init, headers: { ...(init.headers || {}), 'x-transfer-pin': pin } });
  }, [pin]);

  const refreshFiles = useCallback(async () => {
    if (!authenticated) return;
    try {
      const response = await api('/api/files');
      if (!response.ok) throw new Error('Não foi possível carregar os arquivos. Confira o PIN.');
      const data = await response.json() as { files: RemoteFile[]; directory: string };
      setRemoteFiles(data.files);
      setDirectory(data.directory);
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Falha ao conectar ao servidor.' });
    }
  }, [api, authenticated]);

  useEffect(() => { void refreshFiles(); }, [refreshFiles]);

  useEffect(() => {
    let active = true;
    loadSelection().then((files) => { if (active && files.length) setSelected(files); }).catch(() => {
      if (active) setNotice({ kind: 'error', text: 'Não foi possível restaurar a seleção anterior de arquivos.' });
    });
    return () => { active = false; };
  }, []);


  const authenticate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(pin)) {
      setNotice({ kind: 'error', text: 'Digite o PIN de seis dígitos exibido no terminal do computador.' });
      return;
    }
    setBusy(true);
    try {
      const response = await api('/api/files');
      const data = await response.json() as { files?: RemoteFile[]; directory?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'PIN inválido.');
      setRemoteFiles(data.files || []);
      setDirectory(data.directory || '');
      setAuthenticated(true);
      sessionStorage.setItem('transfer-local-pin', pin);
      sessionStorage.setItem('transfer-local-authenticated', 'true');
      setNotice({ kind: 'success', text: 'Conectado ao computador.' });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Não foi possível conectar.' });
    } finally { setBusy(false); }
  };

  const addFiles = async (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (!incoming.length) return;
    const seen = new Set(selected.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
    const merged = [...selected, ...incoming.filter((file) => {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })];
    try {
      // Persist before returning from the picker so mobile browser reloads do not discard the selection.
      await saveSelection(merged);
      setSelected(merged);
      setNotice(null);
    } catch {
      setNotice({ kind: 'error', text: 'Não foi possível guardar os arquivos selecionados no navegador.' });
    }
  };

  const handleInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    await addFiles(files);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragging(false);
    if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files);
  };

  const uploadFiles = async () => {
    if (!selected.length || busy) return;
    setBusy(true); setProgress(0); setNotice(null);
    const form = new FormData();
    selected.forEach((file) => form.append('files', file, file.name));
    try {
      // XMLHttpRequest provides upload progress in browsers, including mobile browsers.
      const result = await new Promise<{ status: number; body: { message?: string; error?: string } }>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('POST', '/api/upload');
        request.setRequestHeader('x-transfer-pin', pin);
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
        };
        request.onload = () => {
          try { resolve({ status: request.status, body: JSON.parse(request.responseText) as { message?: string; error?: string } }); }
          catch { reject(new Error('Resposta inválida do servidor.')); }
        };
        request.onerror = () => reject(new Error('Falha de rede. Verifique se o computador continua conectado.'));
        request.onabort = () => reject(new Error('Envio cancelado.'));
        request.send(form);
      });
      if (result.status < 200 || result.status >= 300) throw new Error(result.body.error || 'Falha no envio.');
      setNotice({ kind: 'success', text: result.body.message || 'Arquivos enviados.' });
      setSelected([]); await saveSelection([]); setProgress(100); await refreshFiles();
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Não foi possível enviar os arquivos.' });
    } finally { setBusy(false); }
  };

  const downloadFile = async (name: string) => {
    try {
      const response = await api(`/api/download/${encodeURIComponent(name)}`);
      if (!response.ok) throw new Error('Não foi possível baixar esse arquivo.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Falha no download.' });
    }
  };

  const totalSelected = selected.reduce((sum, file) => sum + file.size, 0);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Transfer Local início">
          <span className="brand-mark"><ArrowDownToLine size={21} strokeWidth={2.4} /></span>
          <span>transfer<span className="brand-light">local</span></span>
        </a>
        <div className="local-badge"><span className="status-dot" /> <Wifi size={15} /> Rede local</div>
      </header>

      <section className="hero" id="inicio">
        <div className="eyebrow"><span className="eyebrow-line" /> TRANSFERÊNCIA DIRETA</div>
        <h1>Seus arquivos.<br /><span>Direto para o PC.</span></h1>
        <p className="hero-copy">Envie fotos, vídeos e documentos do celular para o computador pela mesma rede Wi-Fi. Sem nuvem. Sem cabos. Sem complicação.</p>
        <div className="flow-line" aria-label="Celular para computador">
          <div className="flow-device"><Smartphone size={19} /><span>Celular</span></div>
          <div className="flow-connector"><span /><span /><span /><ArrowDownToLine size={16} /></div>
          <div className="flow-device"><HardDrive size={19} /><span>Seu computador</span></div>
        </div>
      </section>

      {!authenticated ? (
        <section className="panel auth-panel">
          <div className="panel-icon"><LockKeyhole size={21} /></div>
          <div className="panel-heading"><h2>Conectar ao computador</h2><p>Digite o PIN mostrado no terminal onde o servidor está rodando.</p></div>
          <form className="pin-form" onSubmit={authenticate}>
            <label htmlFor="pin">PIN de acesso</label>
            <input id="pin" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} required />
            <button className="button button-primary" type="submit" disabled={busy || pin.length !== 6}>{busy ? 'Conectando…' : 'Conectar'} <Send size={17} /></button>
          </form>
          <div className="hint"><ShieldCheck size={16} /><span>O PIN ajuda a impedir envios de pessoas sem autorização na sua rede.</span></div>
        </section>
      ) : (
        <>
          <section className="panel upload-panel">
            <div className="section-heading"><div><span className="step-label">01 / ENVIAR</span><h2>Escolha seus arquivos</h2><p>Selecione um ou vários arquivos para transferir.</p></div><span className="heading-icon"><UploadCloud size={22} /></span></div>
            <div className={`drop-zone ${dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
              <div className="upload-symbol"><UploadCloud size={27} /></div>
              <strong>Arraste os arquivos até aqui</strong><span className="drop-or">ou</span>
              <button className="button button-secondary" type="button" onClick={() => inputRef.current?.click()}>Selecionar arquivos <FolderOpen size={17} /></button>
              <span className="supported">Fotos, vídeos, documentos e outros formatos</span>
              <input ref={inputRef} className="visually-hidden" type="file" multiple onChange={handleInput} aria-label="Selecionar arquivos para enviar" />
            </div>
            {selected.length > 0 && <div className="selected-files">
              <div className="file-list-heading"><span>{selected.length} {selected.length === 1 ? 'arquivo selecionado' : 'arquivos selecionados'}</span><span>{formatBytes(totalSelected)}</span></div>
              <ul>{selected.map((file, index) => { const Icon = fileIcon(file.name); return <li key={`${file.name}-${file.lastModified}-${index}`}><span className="file-icon"><Icon size={18} /></span><span className="file-name"><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></span><button className="icon-button" type="button" aria-label={`Remover ${file.name}`} onClick={() => { const next = selected.filter((_, i) => i !== index); setSelected(next); void saveSelection(next); }}><X size={17} /></button></li>; })}</ul>
              {busy && <div className="progress-track" aria-label={`Enviando ${progress}%`}><span style={{ width: `${progress}%` }} /></div>}
              <button className="button button-primary send-button" type="button" onClick={uploadFiles} disabled={busy || selected.length === 0}>{busy ? `Enviando… ${progress}%` : 'Enviar para o computador'} <ArrowDownToLine size={18} /></button>
            </div>}
          </section>

          <section className="panel files-panel">
            <div className="section-heading"><div><span className="step-label">02 / RECEBIDOS</span><h2>Arquivos no computador</h2><p>Os arquivos enviados aparecem nesta lista.</p></div><button className="icon-button refresh-button" type="button" onClick={() => void refreshFiles()} aria-label="Atualizar lista"><RefreshCw size={18} /></button></div>
            {directory && <div className="directory-path"><FolderOpen size={15} /><span>{directory}</span></div>}
            {remoteFiles.length === 0 ? <div className="empty-state"><div className="empty-icon"><FolderOpen size={24} /></div><strong>Nenhum arquivo por enquanto</strong><span>Quando você enviar arquivos, eles aparecerão aqui.</span></div> : <ul className="remote-list">{remoteFiles.map((file) => { const Icon = fileIcon(file.name); return <li key={`${file.name}-${file.modifiedAt}`}><span className="file-icon"><Icon size={19} /></span><span className="file-name"><strong>{file.name}</strong><small>{formatBytes(file.size)} · {new Date(file.modifiedAt).toLocaleString('pt-BR')}</small></span><button className="download-button" type="button" onClick={() => void downloadFile(file.name)} aria-label={`Baixar ${file.name}`}><ArrowDownToLine size={17} /></button></li>; })}</ul>}
          </section>
        </>
      )}

      {notice && <div className={`notice notice-${notice.kind}`} role="status"><span>{notice.kind === 'success' ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}</span><p>{notice.text}</p><button type="button" className="notice-close" onClick={() => setNotice(null)} aria-label="Fechar aviso"><X size={16} /></button></div>}

      <footer className="footer"><div className="footer-rule" /><div className="footer-bottom"><span>TRANSFER LOCAL <span className="footer-dot">/</span> PROJETO OPEN SOURCE</span><span><ShieldCheck size={14} /> Seus arquivos ficam na sua rede</span></div><p>Use apenas em uma rede local confiável. Não exponha esta aplicação diretamente à internet.</p></footer>
    </main>
  );
}
