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

// ---- Tutorial (a TV mostra uma partida de mentira, passo a passo) ----
const PN = ['Ana', 'Beto', 'Cris', 'Davi'];
const P0 = { p: 0, card: { v: 3, s: 0 }, t: 's', n: 0, rb: 7 };
const TS = [
  { t: 'Objetivo', c: 'Todos começam com 5 pontos. Vence quem chegar a 10. Quem chegar a 0 está fora.', g: {} },
  { t: 'Referência', c: 'O número grande no centro é a REFERÊNCIA (aqui, 7). As jogadas “superior” e “inferior” são sempre comparadas com ele.', g: {} },
  { t: 'A sua vez', c: 'Na sua vez, você escolhe uma carta no celular e joga virada para baixo. Só você vê a sua mão.', g: { phase: 'play', actor: 0 }, n: 'No celular aparecem a sua mão e os botões Exato, Superior e Inferior.' },
  { t: 'A declaração', c: 'Você declara algo sobre a carta: o número exato, ou “superior” / “inferior” à referência. Pode falar a verdade ou blefar! A Ana disse “superior”, mas a carta dela era um 3: foi blefe.', g: { pend: P0 } },
  { t: 'Quem pode acusar', c: 'Logo depois da jogada, quem está duas cadeiras antes pode acusar. Aqui é a Cris. Se ela deixar passar, o próximo jogador também pode acusar na sua vez.', g: { phase: 'window', actor: 2, pend: P0 }, n: 'Quem pode acusar recebe o botão ACUSAR e o celular vibra.' },
  { t: 'Acusou e acertou', c: 'A carta é virada na TV. Era blefe! Quem acusou ganha 2 pontos e o blefador perde 2.', g: { phase: 'reveal', ref: 3, rev: { card: { v: 3, s: 0 }, t: 's', n: 0, p: 0, ok: true, by: 2 } }, p: [3, 5, 7, 5] },
  { t: 'Acusou e errou', c: 'Aqui o Beto acusou o Davi, mas a carta era mesmo um 9. Quem acusa errado perde 1 ponto, e quem falou a verdade não perde nada.', g: { phase: 'reveal', ref: 9, rev: { card: { v: 9, s: 1 }, t: 'e', n: 9, p: 3, ok: false, by: 1 } }, p: [3, 4, 7, 5] },
  { t: 'Sem acusação', c: 'Se ninguém acusar, nada é revelado. Quem falou a verdade não ganha nada; quem blefou sem ser pego ganha 2 pontos. O jogo segue para o próximo.', g: { phase: 'play', actor: 1, ref: 9, log: ['Cris não acusou'] }, p: [3, 4, 7, 5] },
  { t: 'Acusação obrigatória', c: 'Quem passar duas vezes sem acusar é obrigado a acusar na terceira. Os amigos podem apertar AVISAR para cutucar quem está esquecendo!', g: { phase: 'turn', actor: 3, ref: 9, pend: { p: 2, card: { v: 5, s: 3 }, t: 'i', n: 0, rb: 9 } }, p: [3, 4, 7, 5], forced: 1, nud: 1, n: 'Sem a opção de “Passar”: a acusação é obrigatória.' },
  { t: 'Pronto para jogar!', c: 'Quando as cartas acabam, o baralho é reembaralhado. O primeiro a chegar a 10 pontos vence. Bom jogo e bom blefe!', g: {}, p: [3, 4, 7, 5] },
];
function fakeState(s) {
  return Object.assign({ fake: 1, code: '', phase: '', ref: 7, actor: -1, log: [], win: null, forced: !!s.forced, nud: s.nud ? { n: -1, f: 1, t: 3 } : null,
    ps: PN.map((n, i) => ({ n, pts: (s.p || [5, 5, 5, 5])[i], cards: 12, alive: 1, conn: 1, bot: 0 })), pend: null, rev: null }, s.g);
}

// ---- Poderes ----
const PW = {
  spy: { i: '👁️', n: 'Espiar', d: 'Veja a carta virada da última jogada' },
  gag: { i: '🔒', n: 'Mordaça', d: 'Alguém não poderá acusar a sua próxima jogada' },
  radar: { i: '🎯', n: 'Radar', d: 'Revela se a última jogada foi blefe (custa 1 ponto)' },
  shield: { i: '🛡️', n: 'Escudo', d: 'Anula a sua próxima perda de pontos' },
  gold: { i: '🃏', n: 'Carta dourada', d: 'Sua próxima carta conta como verdade' },
  free: { i: '🔕', n: 'Passe livre', d: 'Dispensa uma acusação obrigatória' },
  dbl: { i: '🎲', n: 'Aposta dobrada', d: 'Seu próximo blefe vale +4 (ou −4 se for pego)' },
  swap: { i: '🔄', n: 'Troca', d: 'Troque uma carta da mão por outra do baralho' },
  shuf: { i: '🎡', n: 'Nova referência', d: 'Sorteia outra carta de referência' },
};
const ATKS = ['spy', 'gag', 'radar']; // bloqueados para quem tem 8 ou 9 pontos
