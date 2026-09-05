/*
 * Fear Quiz — áudio.
 *
 * Tudo aqui é sintetizado em tempo real com a Web Audio API: nenhum arquivo de
 * som externo, nenhuma trilha de terceiros. A melodia é original.
 *
 * A música é uma caixinha de música que apodrece junto com o `stage` (0–10):
 *   0–1  caixinha limpa
 *   2–3  notas ligeiramente desafinadas
 *   4–5  ruído entrando por baixo
 *   6–7  reverberação estranha (IR longa e não-natural)
 *   8–9  partes da melodia começam a sumir
 *   10   lenta, grave, desafinada e cheia de buracos
 */

const Sound = (() => {
  let ac = null;
  /* Dois envios separados para o reverb: se os efeitos dividissem o envio com
     a música, desligar os efeitos mataria o reverb dela — e, pior, o envio
     compartilhado ia direto ao master, contornando o botão de desligar. */
  let master, musicBus, sfxBus, reverb, musicSend, sfxSend;
  let noiseBuf = null;
  let noiseFloor = null;
  let droneGain = null;
  let irCalm = null;
  let irStrange = null;

  const settings = { volume: 0.7, sfx: true };
  let stage = 0;
  let started = false;

  let schedulerTimer = null;
  let nextNoteTime = 0;
  let noteIndex = 0;
  let beatPos = 0;

  /* Melodia original. Passos curtos, contorno de acalanto, final que sobe
     e não resolve — inocente o bastante para estranhar quando desafinar. */
  const MELODY = [
    { n: 72, d: 1 }, { n: 76, d: 1 }, { n: 74, d: 2 },
    { n: 71, d: 1 }, { n: 72, d: 1 }, { n: 69, d: 2 },
    { n: 67, d: 1 }, { n: 71, d: 1 }, { n: 72, d: 1 }, { n: 74, d: 1 },
    { n: 76, d: 2 }, { n: 72, d: 2 },
  ];
  const BASS = [48, 43, 45, 47];

  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const bpm = () => 100 - stage * 3.5;
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- grafo ---------- */

  function makeIR(seconds, decay) {
    const len = Math.floor(ac.sampleRate * seconds);
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function makeNoiseBuffer(seconds = 2) {
    const len = Math.floor(ac.sampleRate * seconds);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function ensure() {
    if (ac) return ac;
    ac = new (window.AudioContext || window.webkitAudioContext)();

    master = ac.createGain();
    master.gain.value = settings.volume;
    master.connect(ac.destination);

    musicBus = ac.createGain();
    musicBus.gain.value = 0.9;
    musicBus.connect(master);

    sfxBus = ac.createGain();
    sfxBus.gain.value = settings.sfx ? 1 : 0;
    sfxBus.connect(master);

    irCalm = makeIR(1.8, 3);
    irStrange = makeIR(4.5, 1.2);

    reverb = ac.createConvolver();
    reverb.buffer = irCalm;
    reverb.connect(master);

    musicSend = ac.createGain();
    musicSend.gain.value = 0.08;
    musicSend.connect(reverb);

    sfxSend = ac.createGain();
    sfxSend.gain.value = settings.sfx ? 1 : 0;
    sfxSend.connect(reverb);

    noiseBuf = makeNoiseBuffer();
    return ac;
  }

  /* ---------- camada ambiente ---------- */

  function startDrone() {
    const a = ac.createOscillator();
    const b = ac.createOscillator();
    droneGain = ac.createGain();

    a.type = "sine";
    a.frequency.value = 48;
    b.type = "sine";
    b.frequency.value = 48.6;

    droneGain.gain.value = 0.0001;
    a.connect(droneGain);
    b.connect(droneGain);
    droneGain.connect(master);

    a.start();
    b.start();
    droneGain.gain.linearRampToValueAtTime(0.02, ac.currentTime + 3);
    droneGain._b = b;
  }

  function startNoiseFloor() {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;

    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1200;

    noiseFloor = ac.createGain();
    noiseFloor.gain.value = 0;

    src.connect(filter);
    filter.connect(noiseFloor);
    noiseFloor.connect(master);
    src.start();
  }

  /* ---------- música ---------- */

  function playTine(freq, time, dur, detuneCents, velocity) {
    const partials = [
      { ratio: 1, gain: 1, decay: dur },
      { ratio: 2.0, gain: 0.26, decay: dur * 0.5 },
      { ratio: 3.76, gain: 0.12, decay: dur * 0.3 },
    ];

    partials.forEach((p) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * p.ratio;
      osc.detune.value = detuneCents;

      const peak = 0.14 * p.gain * velocity;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(peak, time + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + p.decay);

      osc.connect(gain);
      gain.connect(musicBus);
      gain.connect(musicSend);

      osc.start(time);
      osc.stop(time + p.decay + 0.05);
    });
  }

  function scheduleNote(time) {
    const note = MELODY[noteIndex];

    /* estágio 8+: a melodia começa a ter buracos */
    const dropChance = stage >= 8 ? (stage - 7) * 0.14 : 0;
    const dropped = Math.random() < dropChance;

    if (!dropped) {
      const detune = stage >= 2 ? rand(-1, 1) * (stage - 1) * 7 : 0;
      const octaveDown = stage >= 9 && Math.random() < 0.3 ? -12 : 0;
      const beatDur = 60 / bpm();
      playTine(
        midiToFreq(note.n + octaveDown),
        time,
        Math.max(0.6, note.d * beatDur * 1.6),
        detune,
        1
      );
    }

    if (beatPos % 4 === 0) {
      const bass = BASS[Math.floor(beatPos / 4) % BASS.length];
      const detune = stage >= 2 ? rand(-1, 1) * (stage - 1) * 5 : 0;
      playTine(midiToFreq(bass), time, 2.2, detune, 0.5);
    }
  }

  function scheduler() {
    const lookahead = 0.15;
    while (nextNoteTime < ac.currentTime + lookahead) {
      scheduleNote(nextNoteTime);
      const note = MELODY[noteIndex];
      nextNoteTime += note.d * (60 / bpm());
      beatPos += note.d;
      noteIndex = (noteIndex + 1) % MELODY.length;
    }
  }

  function startMusic() {
    nextNoteTime = ac.currentTime + 0.4;
    noteIndex = 0;
    beatPos = 0;
    schedulerTimer = setInterval(scheduler, 25);
  }

  /* ---------- efeitos sonoros (todos com posição estéreo) ---------- */

  function sfxChain(pan, wet = 0.25) {
    const panner = ac.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(sfxBus);

    const send = ac.createGain();
    send.gain.value = wet;
    panner.connect(send);
    send.connect(sfxSend);

    return panner;
  }

  function noiseBurst(time, dur, filterType, freq, peak, out, q = 1) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;

    const filter = ac.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peak, time + dur * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    src.start(time);
    src.stop(time + dur + 0.05);
    return { filter, gain };
  }

  function footsteps(pan = 0) {
    const out = sfxChain(pan, 0.3);
    const t = ac.currentTime;
    const count = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const at = t + i * rand(0.42, 0.58);
      noiseBurst(at, 0.14, "lowpass", rand(320, 460), 0.05, out);
      const thump = ac.createOscillator();
      const g = ac.createGain();
      thump.type = "sine";
      thump.frequency.setValueAtTime(95, at);
      thump.frequency.exponentialRampToValueAtTime(55, at + 0.1);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(0.035, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
      thump.connect(g);
      g.connect(out);
      thump.start(at);
      thump.stop(at + 0.18);
    }
  }

  function knock(pan = 0) {
    const out = sfxChain(pan, 0.4);
    const t = ac.currentTime;
    for (let i = 0; i < 3; i++) {
      const at = t + i * 0.19;
      noiseBurst(at, 0.09, "lowpass", 280, 0.09, out);
      const body = ac.createOscillator();
      const g = ac.createGain();
      body.type = "sine";
      body.frequency.setValueAtTime(78, at);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(0.07, at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
      body.connect(g);
      g.connect(out);
      body.start(at);
      body.stop(at + 0.15);
    }
  }

  function drip(pan = 0) {
    const out = sfxChain(pan, 0.75);
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(950, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.07);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  function breathing(pan = 0) {
    const out = sfxChain(pan, 0.35);
    const t = ac.currentTime;
    noiseBurst(t, 0.85, "bandpass", 620, 0.028, out, 0.9);
    noiseBurst(t + 1.05, 1.0, "bandpass", 480, 0.022, out, 0.9);
  }

  function interference(pan = 0) {
    const out = sfxChain(pan, 0.15);
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;

    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 3;
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.linearRampToValueAtTime(3800, t + 0.55);

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    /* recortado, como sinal falhando */
    for (let i = 0; i < 7; i++) {
      const on = t + i * 0.08;
      gain.gain.setValueAtTime(i % 2 === 0 ? 0.045 : 0.006, on);
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    src.start(t);
    src.stop(t + 0.7);
  }

  function whisper(pan = 0) {
    const out = sfxChain(pan, 0.5);
    const t = ac.currentTime;
    const syllables = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < syllables; i++) {
      const at = t + i * rand(0.11, 0.19);
      noiseBurst(at, rand(0.07, 0.13), "bandpass", rand(1600, 2900), 0.03, out, 4);
    }
  }

  /* Estilizado de propósito: uma sugestão de risada, longe e com muita
     reverberação — mais desconfortável do que uma imitação realista. */
  function childLaugh(pan = 0) {
    const out = sfxChain(pan, 0.85);
    const t = ac.currentTime;
    const steps = 5;
    let freq = rand(700, 820);
    for (let i = 0; i < steps; i++) {
      const at = t + i * 0.13;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      const vib = ac.createOscillator();
      const vibGain = ac.createGain();

      osc.type = "triangle";
      osc.frequency.value = freq;
      vib.frequency.value = 22;
      vibGain.gain.value = 18;
      vib.connect(vibGain);
      vibGain.connect(osc.frequency);

      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(0.022, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);

      osc.connect(g);
      g.connect(out);
      vib.start(at);
      osc.start(at);
      vib.stop(at + 0.13);
      osc.stop(at + 0.13);
      freq *= 0.92;
    }
  }

  function distant(pan = 0) {
    const out = sfxChain(pan, 0.7);
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.linearRampToValueAtTime(112, t + 1.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.012, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + 1.5);
  }

  function stinger() {
    const out = sfxChain(0, 0.3);
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + 0.65);
  }

  /* Batimento: entra sozinho a partir do estágio 5 e vai acelerando. */
  let heartbeatTimer = null;

  function heartbeat(intensity = 1) {
    if (!ac) return;
    const out = sfxChain(0, 0.2);
    const t = ac.currentTime;

    const beat = (at, vol) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(92, at);
      osc.frequency.exponentialRampToValueAtTime(48, at + 0.12);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(vol, at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      osc.connect(g);
      g.connect(out);
      osc.start(at);
      osc.stop(at + 0.34);
    };

    beat(t, 0.07 * intensity);
    beat(t + 0.22, 0.045 * intensity);
  }

  const SFX = { footsteps, knock, drip, breathing, interference, whisper, childLaugh, distant };

  /* Um som de cada vez, sempre deslocado para um dos lados. */
  function randomSfx() {
    if (!ac || !settings.sfx) return;
    const names = Object.keys(SFX);
    const name = names[Math.floor(Math.random() * names.length)];
    const pan = Math.random() < 0.5 ? rand(-0.95, -0.55) : rand(0.55, 0.95);
    SFX[name](pan);
  }

  /* ---------- controle ---------- */

  function start() {
    ensure();
    if (started) return;
    started = true;
    startDrone();
    startNoiseFloor();
    startMusic();
  }

  function setStage(next) {
    stage = Math.max(0, Math.min(10, next));
    if (!ac) return;
    const now = ac.currentTime;

    if (droneGain) {
      droneGain.gain.linearRampToValueAtTime(Math.min(0.02 + stage * 0.008, 0.11), now + 1.5);
      droneGain._b.frequency.linearRampToValueAtTime(48 + 0.6 + stage * 0.35, now + 1.5);
    }

    if (noiseFloor) {
      const target = stage >= 4 ? Math.min((stage - 3) * 0.006, 0.03) : 0;
      noiseFloor.gain.linearRampToValueAtTime(target, now + 2);
    }

    if (musicSend) {
      musicSend.gain.linearRampToValueAtTime(stage >= 6 ? 0.35 : 0.08, now + 2);
    }
    if (reverb && stage >= 6 && reverb.buffer !== irStrange) {
      reverb.buffer = irStrange;
    }

    clearInterval(heartbeatTimer);
    if (stage >= 5) {
      const interval = Math.max(2100 - stage * 130, 900);
      heartbeatTimer = setInterval(
        () => heartbeat(Math.min(1, 0.45 + stage * 0.06)),
        interval
      );
    }
  }

  function setVolume(v) {
    settings.volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.linearRampToValueAtTime(settings.volume, ac.currentTime + 0.08);
  }

  function setSfxEnabled(on) {
    settings.sfx = !!on;
    if (!ac) return;
    const target = settings.sfx ? 1 : 0;
    const at = ac.currentTime + 0.08;
    sfxBus.gain.linearRampToValueAtTime(target, at);
    sfxSend.gain.linearRampToValueAtTime(target, at);
  }

  /* "Silêncio absoluto": tira todo o som por alguns segundos e devolve. */
  function duckAll(silenceMs = 4000) {
    if (!ac) return;
    const now = ac.currentTime;
    const back = silenceMs / 1000;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0.0001, now + 0.9);
    master.gain.setValueAtTime(0.0001, now + back);
    master.gain.linearRampToValueAtTime(settings.volume, now + back + 1.4);
  }

  /* Batidas acelerando até parar de vez. */
  function flatline() {
    if (!ac) return;
    clearInterval(heartbeatTimer);
    let delay = 0;
    for (let i = 0; i < 6; i++) {
      setTimeout(() => heartbeat(1), delay);
      delay += 640 - i * 80;
    }
    setTimeout(() => duckAll(3200), delay + 300);
  }

  function getSettings() {
    return { ...settings };
  }

  return {
    start,
    setStage,
    setVolume,
    setSfxEnabled,
    getSettings,
    duckAll,
    flatline,
    randomSfx,
    stinger,
    ...SFX,
  };
})();
