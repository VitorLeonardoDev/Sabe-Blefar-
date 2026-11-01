'use strict';
// Servidor do "Sabe Blefar?" — Node 18+, sem dependências.
// TV e celulares recebem o estado por SSE (EventSource) e enviam ações por POST.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { Room } = require('./engine');
const PORT = process.env.PORT || 3000, PUB = path.join(__dirname, 'public');
const rooms = new Map();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.wav': 'audio/wav' };

const newCode = () => { let c; do { c = Array.from({ length: 4 }, () => 'BCDFGHJKLMNPQRSTVWXZ'[crypto.randomInt(20)]).join(''); } while (rooms.has(c)); return c; };
const send = (cl, r) => { // quem foi removido da sala recebe {kicked:1} e a conexão é encerrada
  const i = cl.pl ? r.ps.indexOf(cl.pl) : null, kicked = !!cl.pl && (i < 0 || !!cl.pl.gone);
  cl.res.write('data: ' + JSON.stringify(kicked ? { kicked: 1 } : r.view(i)) + '\n\n');
  if (kicked) { r.clients.delete(cl); cl.res.end(); }
};
const broadcast = r => { for (const cl of [...r.clients]) send(cl, r); };
const json = (res, o, s = 200) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
const body = req => new Promise(ok => {
  let b = ''; req.on('data', d => { b += d; if (b.length > 4096) req.destroy(); });
  req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch (e) { ok({}); } });
});

function stream(req, res, r, pl) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
  const cl = { res, pl }; r.clients.add(cl);
  if (pl) { pl.conn = 1; r.emit(); } else send(cl, r);
  const ka = setInterval(() => res.write(': ka\n\n'), 15000);
  req.on('close', () => {
    clearInterval(ka); r.clients.delete(cl);
    if (pl && !pl.gone && r.ps.includes(pl) && ![...r.clients].some(c => c.pl === pl)) { pl.conn = 0; r.emit(); }
  });
}

http.createServer(async (req, res) => {
  try {
    const p = new URL(req.url, 'http://x').pathname, q = new URL(req.url, 'http://x').searchParams, post = req.method == 'POST';
    let m;
    if (post && p == '/api/room') { const c = newCode(); rooms.set(c, new Room(c, broadcast)); return json(res, { code: c }); }
    if ((m = p.match(/^\/api\/room\/([A-Z]{4})$/))) return rooms.has(m[1]) ? json(res, { ok: 1 }) : json(res, { err: 1 }, 404);
    if ((m = p.match(/^\/api\/tv\/([A-Z]{4})$/))) { const r = rooms.get(m[1]); return r ? stream(req, res, r, null) : json(res, { err: 1 }, 404); }
    if ((m = p.match(/^\/api\/stream\/([A-Z]{4})$/))) {
      const r = rooms.get(m[1]), pl = r && r.ps.find(x => x.tk && !x.gone && x.tk == q.get('t'));
      return pl ? stream(req, res, r, pl) : json(res, { err: 1 }, 404);
    }
    if (post && p == '/api/join') {
      const b = await body(req), r = rooms.get(String(b.code || '').toUpperCase());
      if (!r) return json(res, { err: 'Código não encontrado. Confira na TV.' }, 404);
      const old = b.token && r.ps.find(x => x.tk && !x.gone && x.tk == b.token); // reconexão: volta para a mesma cadeira
      if (old) return json(res, { token: old.tk, name: old.n });
      const x = r.join(b.name); return x.err ? json(res, x, 400) : json(res, { token: x.tk, name: x.n });
    }
    if (post && p == '/api/act') {
      const b = await body(req), r = rooms.get(String(b.code || '').toUpperCase());
      const pl = r && r.ps.find(x => x.tk && !x.gone && x.tk == b.token);
      if (pl) r.act(pl.id, b);
      return json(res, { ok: !!pl });
    }
    // arquivos estáticos: / = celular · /tv = TV · /ABCD = celular já com o código da sala
    let f = p == '/tv' ? 'tv.html' : (p == '/' || /^\/[A-Za-z]{4}$/.test(p)) ? 'play.html' : p;
    f = path.join(PUB, path.normalize(f));
    if (!f.startsWith(PUB) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end('Não encontrado'); }
    const ext = path.extname(f), h = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (/^\.(mp3|ogg|m4a|wav)$/.test(ext)) h['Cache-Control'] = 'public, max-age=86400'; // áudio é pesado: o navegador guarda
    res.writeHead(200, h); fs.createReadStream(f).pipe(res);
  } catch (e) { console.error(e); try { res.writeHead(500); res.end(); } catch (_) {} }
}).listen(PORT, () => console.log(`Sabe Blefar? rodando em http://localhost:${PORT}  (TV: /tv)`));

// limpa salas abandonadas (sem ninguém conectado há 3 horas)
setInterval(() => { for (const [c, r] of rooms) if (!r.clients.size && Date.now() - r.seen > 3 * 3600e3) { clearTimeout(r.T); rooms.delete(c); } }, 600e3);
