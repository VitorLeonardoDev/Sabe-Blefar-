'use strict';
// Motor de regras do "Sabe Blefar?". O servidor é a única fonte da verdade.
const crypto = require('crypto');
const F = process.env.SB_FAST ? 0.01 : 1; // SB_FAST=1 acelera tudo (só para testes)
const NAMES = ['Ana', 'Beto', 'Cris', 'Davi', 'Eva', 'Fabi', 'Gui', 'Hugo', 'Iara', 'Jo'];
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const truth = q => q.t == 'e' ? q.card.v == q.n : q.t == 's' ? q.card.v > q.rb : q.card.v < q.rb;
const HUMAN_MS = 30000, REVEAL_MS = 6000, TUT_LEN = 10;
// Modo Desafio: o desafiado esconde CH_DECK cartas (de 1 a CH_POOL); o desafiante tenta acertar CH_NEED delas em até CH_TRIES palpites.
// (CH_TRIES = 3 vira "os 3 palpites precisam estar certos"; 5 deixa a disputa mais equilibrada: ~50% de chance.)
const CH_POOL = 10, CH_DECK = 5, CH_NEED = 3, CH_TRIES = 5, CH_PTS = 3, CH_PICK_MS = 30000, CH_GUESS_MS = 20000, CH_DONE_MS = 7000;

class Room {
  constructor(code, onChange) {
    Object.assign(this, { code, onChange, clients: new Set(), ps: [], phase: 'lobby', ref: 0, pend: null, rev: null,
      win: null, actor: -1, cur: 0, log: [], nud: null, nn: 0, dl: 0, tut: -1, n: 6, T: null, seen: Date.now(), ch: null, resume: null });
  }
  emit() { this.seen = Date.now(); this.onChange(this); }
  say(m) { this.log.unshift(m); this.log.length = Math.min(4, this.log.length); }
  mkp(n, bot) { return { id: this.ps.length, tk: bot ? '' : crypto.randomBytes(8).toString('hex'), n, pts: 5, hand: [], alive: 1, miss: 0, bot, conn: bot }; }
  al() { return this.ps.filter(p => p.alive).map(p => p.id); }
  nextA(i) { const n = this.ps.length; for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (this.ps[j].alive) return j; } return i; }
  back2(i) { const a = this.al(); return a[(a.indexOf(i) - 2 + a.length * 2) % a.length]; }

  join(name) {
    if (this.phase != 'lobby') return { err: 'A partida já começou.' };
    if (this.ps.length >= 10) return { err: 'Sala cheia (máximo 10).' };
    name = String(name || '').replace(/[<>&"']/g, '').trim().slice(0, 10);
    if (!name) return { err: 'Digite o seu nome.' };
    if (this.ps.some(p => p.n == name)) return { err: 'Esse nome já está na sala.' };
    const p = this.mkp(name, 0); this.ps.push(p); this.emit(); return p;
  }
  start(n, tut) {
    this.n = Math.min(10, Math.max(4, this.ps.length, n | 0));
    if (tut) { this.phase = 'tutorial'; this.tut = -1; return this.tutGo(1); }
    this.begin();
  }
  tutGo(d) { // tutorial na TV, controlado pelo host; avança sozinho a cada 12s
    clearTimeout(this.T); this.tut = Math.max(0, this.tut + d);
    if (this.tut >= TUT_LEN) { this.tut = -1; return this.begin(); }
    if (this.tut < TUT_LEN - 1) this.T = setTimeout(() => this.tutGo(1), 12000 * F);
    this.emit();
  }
  begin() {
    for (const x of NAMES) { if (this.ps.length >= this.n) break; if (!this.ps.some(p => p.n == x)) this.ps.push(this.mkp(x, 1)); }
    this.deal(); this.cur = 0; this.say('Partida iniciada!'); this.startTurn();
  }
  again() {
    clearTimeout(this.T); this.ps = this.ps.filter(p => !p.bot);
    this.ps.forEach(p => Object.assign(p, { pts: 5, hand: [], alive: 1, miss: 0 }));
    Object.assign(this, { phase: 'lobby', pend: null, rev: null, win: null, actor: -1, log: [], dl: 0, tut: -1, nud: null, ch: null, resume: null }); this.emit();
  }
  deal() {
    const d = []; for (let s = 0; s < 4; s++) for (let v = 1; v <= 13; v++) d.push({ v, s });
    shuffle(d); this.ref = d.pop().v;
    const al = this.ps.filter(p => p.alive), k = Math.floor(d.length / al.length);
    al.forEach(p => p.hand = d.splice(0, k).sort((a, b) => a.v - b.v));
  }
  startTurn() { this.actor = this.cur; if (this.pend) { this.phase = 'turn'; this.go(); } else this.enterPlay(); }
  enterPlay() {
    if (!this.ps[this.cur].hand.length) { this.deal(); this.say('Cartas acabaram: nova distribuição'); }
    this.actor = this.cur; this.phase = 'play'; this.go();
  }
  go() {
    clearTimeout(this.T);
    if (this.phase == 'over' || this.phase == 'reveal') return this.emit();
    const a = this.actor, P = this.ps[a], d = (P.bot ? 2400 + rnd(2000) : HUMAN_MS) * F;
    this.dl = Date.now() + d;
    if (this.phase == 'turn' && P.miss >= 2) { // acusação obrigatória: um bot cutuca
      const b = this.ps.filter(x => x.bot && x.alive && x.id != a)[0];
      if (b) setTimeout(() => { if (this.actor == a && this.phase == 'turn') this.nudge(b.id, a); }, 1800 * F);
    }
    this.T = setTimeout(() => this.timeout(), d); this.emit();
  }
  want(a) {
    const q = this.pend, h = this.ps[a].hand; let p = .18;
    if (q.t == 'e') p += h.filter(x => x.v == q.n).length * .25;
    else if (q.t == 's') p = q.rb >= 12 ? .7 : q.rb >= 10 ? p + .2 : p;
    else p = q.rb <= 2 ? .7 : q.rb <= 4 ? p + .2 : p;
    return Math.random() < p;
  }
  timeout() { // bots decidem; humanos que estouram o tempo passam (ou acusam, se obrigados)
    const a = this.actor, P = this.ps[a], b = P.bot;
    if (this.phase == 'window') { if (b && this.want(a)) this.accuse(a); else this.pass(); }
    else if (this.phase == 'turn') { if (P.miss >= 2 || (b && this.want(a))) this.accuse(a); else this.pass(); }
    else if (this.phase == 'play') this.botPlay(a);
  }
  botPlay(a) {
    const P = this.ps[a], i = rnd(P.hand.length), c = P.hand[i], r = this.ref;
    const tr = [{ t: 'e', n: c.v }]; if (c.v > r) tr.push({ t: 's' }); if (c.v < r) tr.push({ t: 'i' });
    let cl;
    if (Math.random() < .62) cl = tr[rnd(tr.length)];
    else {
      const fl = [];
      for (let k = 0; k < 2; k++) { const n = 1 + rnd(13); if (n != c.v) fl.push({ t: 'e', n }); }
      if (c.v <= r) fl.push({ t: 's' }); if (c.v >= r) fl.push({ t: 'i' });
      cl = fl.length ? fl[rnd(fl.length)] : tr[0];
    }
    this.play(a, i, cl);
  }
  play(a, i, c) {
    clearTimeout(this.T);
    const P = this.ps[a], card = P.hand.splice(i, 1)[0];
    this.pend = { p: a, card, t: c.t, n: c.n, rb: this.ref };
    if (c.t == 'e') this.ref = c.n;
    this.say(`${P.n} jogou uma carta`);
    if (this.al().length >= 4) { this.actor = this.back2(a); this.phase = 'window'; this.go(); }
    else { this.cur = this.nextA(a); this.startTurn(); }
  }
  pass() {
    clearTimeout(this.T); const a = this.actor;
    if (this.phase == 'window') { this.cur = this.nextA(this.pend.p); return this.startTurn(); }
    const P = this.ps[a], q = this.pend; P.miss++;
    if (!truth(q)) this.ps[q.p].pts += 2;
    this.pend = null; this.say(`${P.n} não acusou`);
    if (this.chk()) return; this.enterPlay();
  }
  accuse(by) {
    clearTimeout(this.T);
    const q = this.pend, ok = !truth(q), A = this.ps[by], B = this.ps[q.p];
    if (ok) { A.pts += 2; B.pts -= 2; } else A.pts -= 1;
    A.miss = 0; this.ref = q.card.v;
    this.rev = { q, ok, by, fromWin: this.phase == 'window' }; this.pend = null; this.phase = 'reveal'; this.dl = 0;
    this.say(`${A.n} acusou ${B.n}: ${ok ? 'era blefe!' : 'era verdade'}`);
    this.emit(); this.T = setTimeout(() => this.afterReveal(), REVEAL_MS * F);
  }
  afterReveal() {
    const r = this.rev; this.rev = null;
    if (this.chk()) return;
    if (r.fromWin) { this.cur = this.nextA(r.q.p); this.startTurn(); }
    else if (this.ps[r.by].alive) { this.cur = r.by; this.enterPlay(); }
    else { this.cur = this.nextA(r.by); this.startTurn(); }
  }
  chk() {
    this.ps.forEach(p => { if (p.alive && p.pts <= 0) { p.alive = 0; p.hand = []; this.say(`${p.n} foi eliminado`); } });
    const a = this.al(), w = a.filter(i => this.ps[i].pts >= 10);
    if (w.length || a.length <= 1) {
      this.phase = 'over'; this.dl = 0; clearTimeout(this.T);
      this.win = (w.length ? w.sort((x, y) => this.ps[y].pts - this.ps[x].pts) : a)[0]; this.emit(); return true;
    }
    return false;
  }
  // ---- Modo Desafio ----
  // Quem tem MENOS pontos pode desafiar um jogador com 8 ou 9 pontos. O jogo pausa e depois continua de onde parou.
  canChallenge(by, to) {
    const A = this.ps[by], B = this.ps[to];
    return !!(A && B && by != to && A.alive && B.alive && !A.bot && B.pts >= 8 && B.pts <= 9 && A.pts < B.pts && ['play', 'window', 'turn'].includes(this.phase));
  }
  startChallenge(by, tg) {
    clearTimeout(this.T);
    this.resume = { phase: this.phase, actor: this.actor };
    this.phase = 'challenge';
    this.ch = { by, tg, step: 'pick', deck: [], guesses: [], hits: 0, ok: null };
    this.say(`${this.ps[by].n} desafiou ${this.ps[tg].n}!`);
    this.chGo();
  }
  chWho() { return this.ch.step == 'pick' ? this.ch.tg : this.ch.by; }
  chGo() {
    clearTimeout(this.T); const c = this.ch;
    if (c.step == 'done') { this.dl = 0; this.T = setTimeout(() => this.chEnd(), CH_DONE_MS * F); return this.emit(); }
    const P = this.ps[this.chWho()], d = (P.bot ? 1800 + rnd(1400) : c.step == 'pick' ? CH_PICK_MS : CH_GUESS_MS) * F;
    this.dl = Date.now() + d; this.T = setTimeout(() => this.chTimeout(), d); this.emit();
  }
  chTimeout() { // tempo esgotado (ou bot): joga aleatório
    const c = this.ch; if (!c) return;
    if (c.step == 'pick') this.chDeck(shuffle(Array.from({ length: CH_POOL }, (_, i) => i + 1)).slice(0, CH_DECK));
    else { const left = []; for (let n = 1; n <= CH_POOL; n++) if (!c.guesses.some(g => g.n == n)) left.push(n); this.chGuess(left[rnd(left.length)]); }
  }
  chDeck(d) {
    const c = this.ch; if (!c || c.step != 'pick' || !Array.isArray(d)) return;
    d = [...new Set(d.map(x => x | 0))].filter(n => n >= 1 && n <= CH_POOL);
    if (d.length != CH_DECK) return;
    c.deck = d.sort((a, b) => a - b); c.step = 'guess'; this.chGo();
  }
  chGuess(n) {
    const c = this.ch; if (!c || c.step != 'guess') return;
    n |= 0; if (n < 1 || n > CH_POOL || c.guesses.some(g => g.n == n)) return;
    const hit = c.deck.includes(n); c.guesses.push({ n, hit }); if (hit) c.hits++;
    const win = c.hits >= CH_NEED, lose = !win && CH_TRIES - c.guesses.length < CH_NEED - c.hits;
    if (!win && !lose) return this.chGo();
    clearTimeout(this.T);
    const A = this.ps[c.by], B = this.ps[c.tg]; c.ok = win; c.step = 'done';
    if (win) { A.pts += CH_PTS; B.pts -= CH_PTS; this.say(`${A.n} venceu o desafio! ${A.n} +${CH_PTS} · ${B.n} −${CH_PTS}`); }
    else { A.pts -= CH_PTS; B.pts += CH_PTS; this.say(`${A.n} falhou no desafio! ${A.n} −${CH_PTS} · ${B.n} +${CH_PTS}`); }
    this.chGo();
  }
  chEnd() {
    const r = this.resume; this.ch = null; this.resume = null;
    if (this.chk()) return; // alguém chegou a 10 (ou sobrou um só)
    this.phase = r.phase; this.actor = r.actor;
    if (!this.ps[r.actor].alive) { // o jogador da vez foi eliminado no desafio
      this.cur = this.nextA(this.pend ? this.pend.p : r.actor); return this.startTurn();
    }
    this.go();
  }
  nudge(f, t) { this.nn++; this.nud = { n: this.nn, f, t }; this.say(`${this.ps[f].n} avisou ${this.ps[t].n}!`); this.emit(); }

  // Ação vinda de um celular. Tudo é validado aqui: o celular só "pede".
  act(id, m) {
    const P = this.ps[id]; if (!P) return;
    if (m.a == 'start') { if (this.phase == 'lobby' && id == 0) this.start(+m.n, !!m.tut); return; }
    if (m.a == 'tut') { if (this.phase == 'tutorial' && id == 0 && [-1, 1, 99].includes(m.d)) this.tutGo(m.d); return; }
    if (m.a == 'lobby') { if (id == 0 && this.phase != 'lobby') this.again(); return; }
    if (m.a == 'again') { if (this.phase == 'over' && id == 0) this.again(); return; }
    if (m.a == 'nudge') {
      const t = this.ps[m.to];
      if (t && t.alive && P.alive && m.to != id && !['lobby', 'tutorial', 'over'].includes(this.phase)) this.nudge(id, m.to);
      return;
    }
    if (m.a == 'challenge') { const to = m.to | 0; if (this.canChallenge(id, to)) this.startChallenge(id, to); return; }
    if (this.phase == 'challenge' && this.ch) {
      if (m.a == 'chdeck' && this.ch.tg == id) this.chDeck(m.d);
      else if (m.a == 'chguess' && this.ch.by == id) this.chGuess(m.n);
      return;
    }
    if (this.actor != id || !P.alive) return;
    const ph = this.phase;
    if (m.a == 'accuse' && (ph == 'window' || ph == 'turn') && this.pend) this.accuse(id);
    else if (m.a == 'pass' && (ph == 'window' || (ph == 'turn' && P.miss < 2))) this.pass();
    else if (m.a == 'play' && ph == 'play') {
      const i = m.i | 0, t = m.t, n = m.n | 0;
      if (i < 0 || i >= P.hand.length || !['e', 's', 'i'].includes(t) || (t == 'e' && (n < 1 || n > 13))) return;
      this.play(id, i, { t, n });
    }
  }
  // O que cada tela pode ver. A TV nunca recebe mãos; cada celular só recebe a própria.
  view(id) {
    const v = {
      code: this.code, phase: this.phase, tut: this.tut, ref: this.ref, actor: this.actor, log: this.log, win: this.win, nud: this.nud,
      left: this.dl ? Math.max(0, this.dl - Date.now()) : 0,
      forced: this.phase == 'turn' && this.ps[this.actor] && this.ps[this.actor].miss >= 2,
      ps: this.ps.map(p => ({ n: p.n, pts: p.pts, cards: p.hand.length, alive: p.alive, conn: p.conn, bot: p.bot })),
      pend: this.pend && { p: this.pend.p, t: this.pend.t, n: this.pend.n },
      ch: this.ch && { by: this.ch.by, tg: this.ch.tg, step: this.ch.step, hits: this.ch.hits, guesses: this.ch.guesses, ok: this.ch.ok, deck: this.ch.step == 'done' ? this.ch.deck : null, pool: CH_POOL, need: CH_NEED, tries: CH_TRIES, size: CH_DECK, pts: CH_PTS },
      rev: this.rev && { card: this.rev.q.card, t: this.rev.q.t, n: this.rev.q.n, p: this.rev.q.p, ok: this.rev.ok, by: this.rev.by },
    };
    if (id != null && this.ps[id]) v.me = { id, hand: this.ps[id].hand, miss: this.ps[id].miss, chDeck: this.ch && this.ch.tg == id ? this.ch.deck : null };
    return v;
  }
}
module.exports = { Room };
