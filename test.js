// Teste de ponta a ponta: sobe o servidor em modo rápido e joga uma partida inteira.
process.env.SB_FAST = '1'; process.env.PORT = '3456';
require('./server');
const B = 'http://localhost:3456';
const post = (p, b) => fetch(B + p, { method: 'POST', body: JSON.stringify(b || {}) });
const j = async (p, b) => (await post(p, b)).json();
const sleep = ms => new Promise(r => setTimeout(r, ms));
function watch(url) {
  const w = { last: null, n: 0 };
  fetch(B + url).then(async r => {
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
    for (;;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value);
      let k; while ((k = buf.indexOf('\n\n')) >= 0) { const m = buf.slice(0, k); buf = buf.slice(k + 2); if (m.startsWith('data: ')) { w.last = JSON.parse(m.slice(6)); w.n++; } } }
  });
  return w;
}
const ok = (c, m) => { if (!c) { console.error('FALHOU:', m); process.exit(1); } console.log('ok -', m); };
(async () => {
  const { code } = await j('/api/room');
  ok(/^[A-Z]{4}$/.test(code), 'sala criada com código ' + code);
  const tv = watch('/api/tv/' + code);
  ok((await post('/api/join', { code: 'ZZZZ', name: 'X' })).status == 404, 'código errado é recusado');
  const a = await j('/api/join', { code, name: 'Vitor' }), b = await j('/api/join', { code, name: 'Lia' });
  ok(a.token && b.token, 'dois celulares entraram');
  ok((await post('/api/join', { code, name: 'Lia' })).status == 400, 'nome repetido é recusado');
  const again = await j('/api/join', { code, name: 'Outro', token: a.token });
  ok(again.name == 'Vitor', 'reconexão com o token volta para a mesma cadeira');
  const ph = watch(`/api/stream/${code}?t=${a.token}`);
  await sleep(300);
  ok(tv.last && tv.last.ps.length == 2 && tv.last.phase == 'lobby', 'TV vê os jogadores no lobby');
  await post('/api/act', { code, token: b.token, a: 'start', n: 6 }); await sleep(200);
  ok(tv.last.phase == 'lobby', 'só o host consegue iniciar');
  await post('/api/act', { code, token: a.token, a: 'start', n: 6 });
  for (let i = 0; i < 900 && tv.last.phase != 'over'; i++) await sleep(100);
  ok(tv.last.phase == 'over', 'partida terminou sozinha (bots + timeouts), vencedor: ' + tv.last.ps[tv.last.win].n);
  ok(tv.last.ps.length == 6, 'bots completaram 6 jogadores');
  ok(!JSON.stringify(tv.last).includes('hand') && !tv.last.me, 'a TV nunca recebe as mãos');
  ok(ph.last && Array.isArray(ph.last.me.hand), 'o celular recebe a própria mão');
  await post('/api/act', { code, token: a.token, a: 'again' }); await sleep(300);
  ok(tv.last.phase == 'lobby' && tv.last.ps.length == 2, '"jogar de novo" volta ao lobby sem os bots');
  console.log('\nTUDO CERTO'); process.exit(0);
})();
