// Teste do modo Desafio (motor direto, modo rápido).
process.env.SB_FAST = '1';
const { Room } = require('./engine');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ok = (c, m) => { if (!c) { console.error('FALHOU:', m); process.exit(1); } console.log('ok -', m); };
function novo(p0, p1) {
  const r = new Room('TEST', () => {}); r.join('Ana2'); r.join('Beto2'); r.start(4, false);
  r.ps[0].pts = p0; r.ps[1].pts = p1; return r;
}
(async () => {
  // regras de quem pode desafiar
  let r = novo(5, 9);
  ok(!r.canChallenge(1, 0), 'quem tem mais pontos não pode desafiar quem tem menos');
  ok(!r.canChallenge(0, 2) || r.ps[2].pts >= 8, 'só alvos com 8 ou 9 pontos');
  r.ps[1].pts = 7; ok(!r.canChallenge(0, 1), 'alvo com 7 pontos não pode ser desafiado');
  r.ps[1].pts = 9; r.act(0, { a: 'challenge', to: 1 });
  ok(r.phase == 'challenge' && r.ch.step == 'pick', 'desafio começou (jogo pausado)');
  r.act(0, { a: 'chdeck', d: [1, 2, 3, 4, 5] }); ok(r.ch.step == 'pick', 'o desafiante não escolhe o deck do outro');
  r.act(1, { a: 'chdeck', d: [1, 1, 2, 3, 4] }); ok(r.ch.step == 'pick', 'deck com repetidas é recusado');
  r.act(1, { a: 'chdeck', d: [5, 3, 1, 2, 4] }); ok(r.ch.step == 'guess', 'deck válido aceito');
  ok(r.view(null).ch.deck === null && !JSON.stringify(r.view(0)).includes('"chDeck":[5'), 'deck fica secreto para TV e desafiante');
  ok(JSON.stringify(r.view(1).me.chDeck) == '[1,2,3,4,5]', 'o desafiado enxerga o próprio deck');
  r.act(1, { a: 'chguess', n: 1 }); ok(r.ch.guesses.length == 0, 'só o desafiante dá palpites');
  r.act(0, { a: 'chguess', n: 1 }); r.act(0, { a: 'chguess', n: 2 }); r.act(0, { a: 'chguess', n: 3 });
  ok(r.ch.step == 'done' && r.ch.ok, '3 acertos = desafio vencido');
  ok(r.ps[0].pts == 8 && r.ps[1].pts == 6, 'desafiante +3 (5→8) e desafiado −3 (9→6)');
  await sleep(300); ok(r.phase != 'challenge' && !r.ch, 'o jogo continua depois do desafio (fase ' + r.phase + ')');

  // falha: desafiado vence a partida
  r = novo(5, 8); r.act(0, { a: 'challenge', to: 1 }); r.act(1, { a: 'chdeck', d: [1, 2, 3, 4, 5] });
  r.act(0, { a: 'chguess', n: 6 }); r.act(0, { a: 'chguess', n: 7 }); r.act(0, { a: 'chguess', n: 8 });
  ok(r.ch.step == 'done' && !r.ch.ok, 'sem chance de chegar a 3 acertos = desafio perdido');
  ok(r.ps[0].pts == 2 && r.ps[1].pts == 11, 'desafiante −3 e desafiado +3');
  await sleep(300); ok(r.phase == 'over' && r.win == 1, 'desafiado ganha o jogo');

  // tudo no automático (tempo esgotado)
  r = novo(6, 9); r.act(0, { a: 'challenge', to: 1 });
  for (let i = 0; i < 100 && r.phase == 'challenge'; i++) await sleep(50);
  ok(r.phase != 'challenge', 'tempo esgotado resolve o desafio sozinho');
  console.log('\nDESAFIO OK'); process.exit(0);
})();
