// Áudio da TV. Procura arquivos em /audio (lobby, game, challenge, tick, whoosh, flash, boom, win;
// extensões mp3, ogg, m4a ou wav). Se um arquivo não existir, toca um som sintetizado no lugar.
const SB = (() => {
  const EXT = ['mp3', 'ogg', 'm4a', 'wav'], loads = {};
  let ctx = null, mg, msc, sfxg, want = null, cur = null, muted = false;
  const midi = n => 440 * 2 ** ((n - 69) / 12);

  const load = name => loads[name] || (loads[name] = (async () => {
    for (const e of EXT) {
      try {
        const r = await fetch(`/audio/${name}.${e}`);
        if (r.ok) return await ctx.decodeAudioData(await r.arrayBuffer());
      } catch (_) {}
    }
    return null;
  })());

  function tone(f, t, d, type, v, dest, f2) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + Math.min(.02, d / 4)); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(dest || sfxg); o.start(t); o.stop(t + d + .05);
  }
  function noise(t, d, v, type, f1, f2, dest) {
    const n = Math.max(1, Math.floor(ctx.sampleRate * d)), b = ctx.createBuffer(1, n, ctx.sampleRate), x = b.getChannelData(0);
    for (let i = 0; i < n; i++) x[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f1, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d);
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    s.connect(fl); fl.connect(g); g.connect(dest || sfxg); s.start(t);
  }

  // efeitos sintetizados (usados quando não há arquivo)
  const SYN = {
    tick: k => { const t = ctx.currentTime; noise(t, .03, .6, 'highpass', 3000); tone(k ? 900 : 1200, t, .05, 'sine', .35); },
    whoosh: () => { const t = ctx.currentTime; noise(t, .5, .7, 'bandpass', 300, 4000); tone(180, t, .45, 'sawtooth', .12, null, 1600); tone(800, t, .2, 'square', .05, null, 2400); },
    flash: () => { const t = ctx.currentTime; noise(t, .03, .9, 'highpass', 2000); noise(t + .08, .04, .7, 'highpass', 1500); tone(2000, t + .12, .4, 'sine', .12, null, 7000); },
    boom: () => { const t = ctx.currentTime; [650, 520, 780].forEach((f, i) => tone(f, t + i * .09, .08, 'square', .12)); const b = t + .3; tone(140, b, .9, 'sine', .9, null, 30); noise(b, .5, .8, 'lowpass', 900, 80); },
    win: () => { const t = ctx.currentTime; [60, 64, 67, 72, 76].forEach((n, i) => tone(midi(n), t + i * .14, .5, 'triangle', .3)); },
  };

  // músicas sintetizadas de reserva (um clima para cada situação)
  function synthMusic(name) {
    const P = {
      lobby: { bpm: 84, ch: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], w: 'sine' },
      game: { bpm: 108, ch: [[45, 48, 52], [41, 45, 48], [43, 47, 50], [40, 44, 47]], w: 'triangle' },
      challenge: { bpm: 140, ch: [[40, 43, 47], [40, 43, 47], [38, 41, 45], [39, 43, 46]], w: 'sawtooth' },
    }[name];
    const sp = 60 / P.bpm / 2; let step = 0, t = ctx.currentTime + .1;
    const id = setInterval(() => {
      while (t < ctx.currentTime + .5) {
        const c = P.ch[Math.floor(step / 8) % 4], n = c[step % 3] + (step % 8 >= 4 ? 12 : 0);
        tone(midi(n), t, sp * 1.6, P.w, name == 'challenge' ? .22 : .3, msc);
        if (step % 8 == 0) tone(midi(c[0] - 12), t, sp * 7, 'sine', .6, msc);
        if (name != 'lobby' && step % 2 == 0) tone(110, t, .12, 'sine', .5, msc, 40);
        t += sp; step++;
      }
    }, 120);
    return () => clearInterval(id);
  }

  // toca em loop até a situação mudar (name = lobby | game | challenge | null)
  async function music(name) {
    want = name;
    if (!ctx || (cur && cur.name == name)) return;
    if (cur) cur.stop();
    cur = null; if (!name) return;
    const me = cur = { name, dead: false, off: null, stop() { this.dead = true; if (this.off) this.off(); } };
    const b = await load(name);
    if (me.dead) return;
    if (b) { const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.connect(msc); s.start(); me.off = () => { try { s.stop(); } catch (_) {} }; }
    else me.off = synthMusic(name);
  }

  return {
    get on() { return !!ctx; },
    get muted() { return muted; },
    unlock() {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        mg = ctx.createGain(); mg.gain.value = muted ? 0 : 1; mg.connect(ctx.destination);
        msc = ctx.createGain(); msc.gain.value = .22; msc.connect(mg);   // música em volume ambiente
        sfxg = ctx.createGain(); sfxg.gain.value = .5; sfxg.connect(mg); // efeitos
        ['lobby', 'game', 'challenge', 'tick', 'whoosh', 'flash', 'boom', 'win'].forEach(load);
      }
      ctx.resume(); music(want);
    },
    music,
    sfx(name, arg) {
      if (!ctx || muted) return;
      load(name).then(b => {
        if (b) { const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; g.gain.value = name == 'tick' ? .5 : 1; s.connect(g); g.connect(sfxg); s.start(); }
        else if (SYN[name]) SYN[name](arg);
      });
    },
    toggleMute() { muted = !muted; if (mg) mg.gain.value = muted ? 0 : 1; return muted; },
  };
})();
