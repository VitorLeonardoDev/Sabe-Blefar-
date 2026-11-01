// Testes dos poderes e da remoção de jogador (motor direto, modo rápido).
process.env.SB_FAST = '1';
const { Room } = require('./engine');
const ok = (c, m) => { if (!c) { console.error('FALHOU:', m); process.exit(1); } console.log('ok -', m); };
const mk = () => { const r = new Room('TEST', () => {}); r.join('Ana2'); r.join('Beto2'); r.join('Cris2'); r.join('Davi2'); r.start(4, false, true); clearTimeout(r.T); return r; };
const toPlay = (r, who) => { // põe a partida na fase "play" com 'who' como jogador da vez
  clearTimeout(r.T); r.pend = null; r.cur = who; r.actor = who; r.phase = 'play'; r.ps.forEach(p => { p.pw = []; p.used = false; }); };

let r = mk();
ok(r.ps.every(p => p.pw.length == 1), 'cada jogador começa com 1 poder');
r.start; const r2 = new Room('T2', () => {}); r2.join('A'); r2.join('B'); r2.join('C'); r2.join('D'); r2.start(4, false, false); clearTimeout(r2.T);
ok(r2.ps.every(p => p.pw.length == 0), 'modo poderes desligado: ninguém recebe poder');

// Escudo anula a perda
r = mk(); toPlay(r, 0); r.ps[0].pw = ['shield']; r.act(0, { a: 'power', k: 'shield' });
ok(r.ps[0].shield && r.ps[0].pw.length == 0 && r.ps[0].used, 'Escudo ativado e consumido');
r.ps[0].pts = 5; r.hit(r.ps[0], 2); ok(r.ps[0].pts == 5 && !r.ps[0].shield, 'Escudo absorve a perda uma vez');
r.hit(r.ps[0], 2); ok(r.ps[0].pts == 3, 'a perda seguinte conta normalmente');

// só 1 poder por vez
r = mk(); toPlay(r, 0); r.ps[0].pw = ['shield', 'gold']; r.act(0, { a: 'power', k: 'shield' }); r.act(0, { a: 'power', k: 'gold' });
ok(r.ps[0].pw.length == 1 && !r.ps[0].gold, 'só 1 poder por vez');

// Carta dourada: mentira vira verdade
r = mk(); toPlay(r, 0); r.ps[0].pw = ['gold']; r.act(0, { a: 'power', k: 'gold' });
const c = r.ps[0].hand[0]; r.act(0, { a: 'play', i: 0, t: 'e', n: c.v == 13 ? 12 : c.v + 1 }); // declara errado de propósito
ok(r.pend.gold && require('./engine') && r.phase == 'window', 'jogada com carta dourada registrada');
const acc = r.actor; r.act(acc, { a: 'accuse' });
ok(r.rev && r.rev.ok === false, 'acusar carta dourada com mentira = acusação errada');

// Aposta dobrada: blefe passa vale +4
r = mk(); toPlay(r, 0); r.ps[0].pw = ['dbl']; r.act(0, { a: 'power', k: 'dbl' });
const c2 = r.ps[0].hand[0]; r.act(0, { a: 'play', i: 0, t: 'e', n: c2.v == 13 ? 12 : c2.v + 1 });
const p0 = r.ps[0].pts; r.act(r.actor, { a: 'pass' }); r.act(r.actor, { a: 'pass' });
ok(r.ps[0].pts == p0 + 4, 'Aposta dobrada: blefe que passa vale +4');

// Mordaça: o alvo não acusa
r = mk(); toPlay(r, 0); r.ps[0].pw = ['gag']; const alvo = r.back2(0);
r.act(0, { a: 'power', k: 'gag', to: alvo });
const c3 = r.ps[0].hand[0]; r.act(0, { a: 'play', i: 0, t: 'e', n: c3.v == 13 ? 12 : c3.v + 1 });
ok(r.actor == alvo && r.phase == 'window', 'o alvo da Mordaça é quem teria a janela');
r.act(alvo, { a: 'accuse' }); ok(r.phase == 'window', 'a Mordaça impede a acusação');
ok(r.view(alvo).me.gagged === true, 'o celular do alvo sabe que está com Mordaça');

// Radar custa 1 ponto, não acusa; ataque bloqueado com 8+ pontos
r = mk(); toPlay(r, 1); const cc = r.ps[1].hand[0]; r.ps[1].pw = []; r.act(1, { a: 'play', i: 0, t: 'e', n: cc.v });
const rad = r.actor; r.ps[rad].pw = ['radar']; r.ps[rad].pts = 8; r.act(rad, { a: 'power', k: 'radar' });
ok(r.ps[rad].pw.length == 1, 'quem tem 8 pontos não usa poder de ataque');
r.ps[rad].pts = 5; r.act(rad, { a: 'power', k: 'radar' });
ok(r.ps[rad].pts == 4 && r.pwe && r.pwe.k == 'radar' && r.pwe.res === false && r.phase == 'window', 'Radar: −1 ponto, revela verdade e não acusa');

// Espiar mostra a carta só para quem usou
r = mk(); toPlay(r, 1); const cs = r.ps[1].hand[0]; r.act(1, { a: 'play', i: 0, t: 'e', n: cs.v });
const sp = r.actor; r.ps[sp].pw = ['spy']; r.ps[sp].pts = 5; r.act(sp, { a: 'power', k: 'spy' });
ok(r.view(sp).me.spy && r.view(sp).me.spy.v == cs.v, 'Espiar mostra a carta ao espião');
ok(!r.view(1).me.spy && !JSON.stringify(r.view(null)).includes('"spy"') && r.pwe.k === null, 'ninguém mais vê (a TV só sabe que houve um poder secreto)');

// Troca e Nova referência
r = mk(); toPlay(r, 0); r.ps[0].pw = ['swap']; const antes = r.ps[0].hand.length, nd = r.deck.length;
r.act(0, { a: 'power', k: 'swap', i: 0 }); ok(r.ps[0].hand.length == antes && r.deck.length == nd, 'Troca mantém o tamanho da mão e do baralho');
r = mk(); toPlay(r, 0); r.ps[0].pw = ['shuf']; r.act(0, { a: 'power', k: 'shuf' }); ok(r.pwe.k == 'shuf' && r.ref >= 1 && r.ref <= 13, 'Nova referência sorteada');

// Passe livre dispensa a acusação obrigatória
r = mk(); toPlay(r, 1); const cp = r.ps[1].hand[0]; r.act(1, { a: 'play', i: 0, t: 'e', n: cp.v });
r.act(r.actor, { a: 'pass' }); const t = r.actor; r.ps[t].miss = 2; r.ps[t].pw = ['free'];
ok(r.phase == 'turn' && r.view(t).forced, 'acusação obrigatória ativa');
r.act(t, { a: 'power', k: 'free' }); ok(r.phase == 'play' && r.actor == t && r.ps[t].miss <= 1, 'Passe livre dispensa e segue para jogar');

// Acusar certo dá poder (máx. 2)
r = mk(); toPlay(r, 0); const cb = r.ps[0].hand[0]; r.act(0, { a: 'play', i: 0, t: 'e', n: cb.v == 13 ? 12 : cb.v + 1 });
const ac = r.actor; r.ps[ac].pw = ['shield']; r.act(ac, { a: 'accuse' }); ok(r.ps[ac].pw.length == 2, 'acusar certo rende um poder novo');

// Remover jogador
r = mk(); r.act(1, { a: 'kick', to: 2 }); ok(r.ps[2].alive, 'só o host remove');
r.act(0, { a: 'kick', to: 0 }); ok(r.ps[0].alive, 'o host não remove a si mesmo');
toPlay(r, 2); r.act(0, { a: 'kick', to: 2 });
ok(!r.ps[2].alive && r.ps[2].gone && r.actor != 2 && r.ps[r.actor].alive, 'remover quem estava na vez: a partida segue');
r.act(0, { a: 'lobby' }); ok(r.phase == 'lobby' && r.ps.length == 3 && r.ps.every((p, i) => p.id == i && !p.gone), 'voltar ao lobby mantém os humanos, menos o removido');
r = new Room('T3', () => {}); ['A', 'B', 'C'].forEach(n => r.join(n)); r.act(0, { a: 'kick', to: 1 });
ok(r.ps.length == 2 && r.ps[1].n == 'C' && r.ps[1].id == 1, 'no lobby o jogador sai da lista');
r = mk(); r.ps[3].conn = 0; r.cur = 3; r.actor = 3; r.phase = 'play'; r.pend = null; r.go();
ok(r.dl - Date.now() < 100, 'jogador desconectado tem tempo curto (não trava a mesa)');
clearTimeout(r.T);
console.log('\nTUDO CERTO'); process.exit(0);
