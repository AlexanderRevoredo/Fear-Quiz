/*
 * Fear Quiz — camada visual.
 *
 * Preferência do projeto: glitch pequeno e localizado (uma palavra, um canto,
 * um botão). O efeito de tela inteira existe, mas é raro de propósito — o alvo
 * é "eu realmente vi isso?", não bombardeio visual.
 */

const Effects = (() => {

  /* ---------- granulado de filme ---------- */

  const canvas = document.getElementById("grain");
  const ctx = canvas.getContext("2d");

  function resizeGrain() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function drawGrain() {
    const w = canvas.width, h = canvas.height;
    const imageData = ctx.createImageData(w, h);
    const buffer = new Uint32Array(imageData.data.buffer);
    for (let i = 0; i < buffer.length; i++) {
      const shade = (Math.random() * 255) | 0;
      buffer[i] = (255 << 24) | (shade << 16) | (shade << 8) | shade;
    }
    ctx.putImageData(imageData, 0, 0);
    requestAnimationFrame(() => setTimeout(drawGrain, 90));
  }

  function startGrain() {
    resizeGrain();
    window.addEventListener("resize", resizeGrain);
    drawGrain();
  }

  /* ---------- stingers ---------- */

  const flashEl = document.getElementById("flash");

  function flash() {
    flashEl.classList.remove("pulse");
    void flashEl.offsetWidth;
    flashEl.classList.add("pulse");
  }

  function shake(el) {
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  }

  /* ---------- glitches ---------- */

  function glitchElement(el, duration = 220) {
    if (!el) return;
    el.setAttribute("data-glitch", el.textContent);
    el.classList.add("glitch");
    setTimeout(() => {
      el.classList.remove("glitch");
      el.removeAttribute("data-glitch");
    }, duration);
  }

  /* Bloco inteiro — usado nos momentos autorais (reveals), não nos eventos. */
  function glitchText(el, duration = 220) {
    glitchElement(el, duration);
  }

  /*
   * Uma única palavra falha, e o resto do texto fica intacto.
   * Reconstrói o parágrafo com um <span> só na palavra sorteada e devolve o
   * texto puro no fim, para não sujar o DOM nem quebrar o efeito de digitação.
   */
  function glitchWord(el, duration = 260) {
    if (!el) return;
    const original = el.textContent;
    const words = original.split(/(\s+)/);
    const indexes = words
      .map((w, i) => (w.trim().length > 2 ? i : -1))
      .filter((i) => i >= 0);
    if (!indexes.length) return;

    const target = indexes[Math.floor(Math.random() * indexes.length)];
    const frag = document.createDocumentFragment();

    words.forEach((word, i) => {
      if (i === target) {
        const span = document.createElement("span");
        span.className = "glitch glitch-word";
        span.setAttribute("data-glitch", word);
        span.textContent = word;
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(word));
      }
    });

    el.textContent = "";
    el.appendChild(frag);
    setTimeout(() => {
      if (el.textContent === original) el.textContent = original;
    }, duration);
  }

  /* Fragmento gráfico que aparece por poucos frames numa região da tela. */
  function fragment() {
    const el = document.createElement("div");
    el.className = "fragment";
    el.style.left = `${Math.random() * 82 + 4}vw`;
    el.style.top = `${Math.random() * 82 + 4}vh`;
    el.style.width = `${Math.random() * 90 + 25}px`;
    el.style.height = `${Math.random() * 5 + 2}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 90 + Math.random() * 70);
  }

  /*
   * Artefato permanente: pequeno, colado numa borda, e não sai mais até
   * recarregar. Um glitch que pisca a pessoa duvida se viu; um que fica ela
   * pode conferir — e conferir que continua lá é pior. Limitado a 3 para
   * virar dano acumulado, não sujeira.
   */
  const MAX_ARTIFACTS = 3;
  let artifactCount = 0;

  function artifact() {
    if (artifactCount >= MAX_ARTIFACTS) return;
    artifactCount++;

    const el = document.createElement("div");
    el.className = "artifact";

    const kind = Math.random();
    if (kind < 0.45) {
      el.style.width = `${2 + Math.random() * 2}px`;
      el.style.height = `${2 + Math.random() * 2}px`;
    } else if (kind < 0.8) {
      el.style.width = `${10 + Math.random() * 22}px`;
      el.style.height = "1px";
    } else {
      el.style.width = `${4 + Math.random() * 5}px`;
      el.style.height = `${2 + Math.random() * 2}px`;
      el.classList.add("artifact-static");
    }

    const along = 8 + Math.random() * 84;
    const off = 0.8 + Math.random() * 3.2;
    switch (Math.floor(Math.random() * 4)) {
      case 0: el.style.top = `${off}vh`; el.style.left = `${along}vw`; break;
      case 1: el.style.bottom = `${off}vh`; el.style.left = `${along}vw`; break;
      case 2: el.style.left = `${off}vw`; el.style.top = `${along}vh`; break;
      default: el.style.right = `${off}vw`; el.style.top = `${along}vh`; break;
    }

    document.body.appendChild(el);
  }

  /* Os dois desenhos do autor, aparecendo por poucos frames no questionário. */
  const HUMAN_SVG = `
    <svg viewBox="0 0 140 230" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" stroke="currentColor" stroke-width="3.2"
         stroke-linecap="round" stroke-linejoin="round">
        <path d="M70,21 C82,21 92,30 92,42 C92,55 82,63 70,63 C56,63 48,55 48,42 C48,30 58,21 70,21 Z" />
        <path d="M54,29 L46,15" /><path d="M62,24 L57,9" /><path d="M70,21 L71,6" />
        <path d="M78,24 L84,10" /><path d="M86,30 L94,18" />
        <path d="M60,50 Q70,61 82,48" stroke-width="2.6" />
        <path d="M52,60 Q34,96 22,132" />
        <path d="M88,60 Q106,94 118,130" />
        <path d="M62,62 L59,226" /><path d="M79,62 L85,206" />
      </g>
      <circle cx="62" cy="40" r="2.8" fill="currentColor" />
      <circle cx="78" cy="40" r="2.8" fill="currentColor" />
    </svg>`;

  const FACE_SVG = `
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" stroke="currentColor" stroke-width="3.4"
         stroke-linecap="round" stroke-linejoin="round">
        <path d="M100,20 C136,19 172,47 174,94 C176,138 140,170 100,170 C60,170 24,139 26,94 C28,47 64,21 100,20 Z" />
        <path d="M40,60 L14,40" /><path d="M55,42 L42,16" /><path d="M76,31 L68,6" />
        <path d="M100,26 L100,2" /><path d="M124,30 L134,6" /><path d="M146,44 L163,22" />
        <path d="M162,63 L188,50" />
        <ellipse cx="76" cy="74" rx="11" ry="13" />
        <ellipse cx="124" cy="74" rx="11" ry="13" />
        <path d="M101,92 L95,104 L105,104" stroke-width="2.6" />
        <path d="M52,108 Q100,94 150,110" />
        <path d="M52,108 Q100,158 150,110" />
        <g stroke-width="2.6">
          <path d="M66,105 L72,123 L79,106" /><path d="M88,102 L94,120 L101,102" />
          <path d="M110,102 L116,121 L123,105" /><path d="M132,106 L138,123 L145,110" />
          <path d="M78,138 L84,121 L90,140" /><path d="M110,140 L116,122 L122,141" />
        </g>
      </g>
    </svg>`;

  function faceFlash() {
    flashDrawing(FACE_SVG, 0.62);
  }

  function humanFlash() {
    flashDrawing(HUMAN_SVG, 1);
  }

  function flashDrawing(svg, scale) {
    const el = document.createElement("div");
    el.className = "human-flash";
    el.innerHTML = svg;

    /* Encolhe em tela estreita: no celular o tamanho de desktop cobriria a
       pergunta, e aí deixa de ser vulto e vira jumpscare. */
    const narrow = window.innerWidth < 560;
    const base = (narrow ? 70 : 110) + Math.random() * (narrow ? 35 : 70);
    el.style.height = `${base * scale}px`;

    el.style.top = `${8 + Math.random() * 62}vh`;
    const inset = narrow ? 0.5 + Math.random() * 4 : 1 + Math.random() * 12;
    if (Math.random() < 0.5) el.style.left = `${inset}vw`;
    else el.style.right = `${inset}vw`;

    document.body.appendChild(el);
    setTimeout(() => el.remove(), 120 + Math.random() * 90);
  }

  /* Raro. O único efeito que toma a tela inteira. */
  function screenTear() {
    const el = document.createElement("div");
    el.className = "tear";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 260);
  }

  /* ---------- reações ao medo escolhido ---------- */

  function spiders() {
    const count = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "spider";
      el.style.left = `${6 + Math.random() * 88}vw`;
      el.style.setProperty("--drop", `${28 + Math.random() * 44}vh`);
      el.style.animationDelay = `${Math.random() * 1.6}s`;
      el.style.animationDuration = `${5 + Math.random() * 3}s`;
      el.innerHTML = `
        <div class="thread"></div>
        <svg viewBox="0 0 40 32" xmlns="http://www.w3.org/2000/svg">
          <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M20,14 L6,4" /><path d="M20,14 L2,13" /><path d="M20,14 L5,24" /><path d="M20,14 L11,29" />
            <path d="M20,14 L34,4" /><path d="M20,14 L38,13" /><path d="M20,14 L35,24" /><path d="M20,14 L29,29" />
          </g>
          <ellipse cx="20" cy="15" rx="6" ry="7" fill="currentColor" />
        </svg>`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 9000);
    }
  }

  function snake() {
    const el = document.createElement("div");
    el.className = "snake";
    el.innerHTML = `
      <svg viewBox="0 0 220 40" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <path d="M2,20 Q30,4 58,20 Q86,36 114,20 Q142,4 170,20 Q198,36 218,20"
              fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
      </svg>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 7200);
  }

  /* As paredes se fechando: o conteúdo é espremido e depois solto. */
  function closeIn() {
    document.body.classList.add("closing-in");
    setTimeout(() => document.body.classList.remove("closing-in"), 6000);
  }

  function blackout() {
    const el = document.createElement("div");
    el.className = "blackout";
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("lift"), 4200);
    setTimeout(() => el.remove(), 6400);
  }

  function vertigo() {
    document.body.classList.add("vertigo");
    setTimeout(() => document.body.classList.remove("vertigo"), 3400);
  }

  /* Palhaço: um nariz e um sorriso pintado, nada mais. */
  function clown() {
    const el = document.createElement("div");
    el.className = "clown";
    el.innerHTML = `
      <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
        <path d="M28,44 Q100,124 172,44" fill="none" stroke="#b8332f"
              stroke-width="7" stroke-linecap="round" />
        <circle cx="100" cy="40" r="15" fill="#c4302c" />
      </svg>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("visible"));
    setTimeout(() => el.classList.remove("visible"), 3600);
    setTimeout(() => el.remove(), 5200);
  }

  /* Ser observado: a presença se multiplica pelas bordas. */
  function manyEyes() {
    const dots = [];
    for (let i = 0; i < 9; i++) {
      const el = document.createElement("div");
      el.className = "watcher-dot";
      const edge = Math.random();
      el.style.top = `${5 + Math.random() * 88}vh`;
      el.style.left = edge < 0.5 ? `${1 + Math.random() * 8}vw` : `${91 + Math.random() * 8}vw`;
      el.style.animationDelay = `${Math.random() * 2.4}s`;
      document.body.appendChild(el);
      dots.push(el);
    }
    setTimeout(() => dots.forEach((d) => d.remove()), 7000);
  }

  /* ---------- presença ---------- */

  const presenceEl = document.getElementById("presence");
  let presenceTimer = null;

  function setPresenceActivity(level) {
    clearInterval(presenceTimer);
    if (level <= 0) return;
    const interval = Math.max(4200 - level * 350, 900);
    presenceTimer = setInterval(() => {
      presenceEl.classList.add("blink");
      setTimeout(() => presenceEl.classList.remove("blink"), 220 + Math.random() * 300);
    }, interval + Math.random() * 800);
  }

  function presencePulse() {
    presenceEl.classList.add("blink");
    setTimeout(() => presenceEl.classList.remove("blink"), 700);
  }

  return {
    startGrain,
    flash,
    shake,
    glitchText,
    glitchElement,
    glitchWord,
    fragment,
    artifact,
    humanFlash,
    faceFlash,
    screenTear,
    spiders,
    snake,
    closeIn,
    blackout,
    vertigo,
    clown,
    manyEyes,
    setPresenceActivity,
    presencePulse,
  };
})();
