const RK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SI = ['⭐', '🔷', '🍀', '🌙'];
const $ = id => document.getElementById(id);
const face = c => `<div class="c k${c.s}"><div class="ct"><span>${RK[c.v]}</span><span>${SI[c.s]}</span></div><div class="cm">${RK[c.v]}</div><div class="cf"><span>${RK[c.v]}</span><span>${SI[c.s]}</span></div></div>`;
const ctext = q => q.t == 'e' ? `“É um ${RK[q.n]}”` : q.t == 's' ? '“Superior à anterior”' : '“Inferior à anterior”';
const esc = s => String(s).replace(/[&<>"']/g, '');
// conexão em tempo real com reconexão automática (EventSource já reconecta sozinho)
function listen(url, onState, onDown) {
  const es = new EventSource(url);
  es.onmessage = e => { const s = JSON.parse(e.data); s.end = Date.now() + s.left; onState(s); };
  es.onerror = () => onDown && onDown();
  return es;
}
