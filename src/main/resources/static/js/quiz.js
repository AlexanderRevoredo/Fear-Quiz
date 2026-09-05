/* Fear Quiz — engine. Wires QUESTIONS (questions.js) to the DOM and Effects. */

(() => {
  const screens = {
    settings: document.getElementById("screen-settings"),
    prologue: document.getElementById("screen-prologue"),
    intro: document.getElementById("screen-intro"),
    quiz: document.getElementById("screen-quiz"),
    fakeEnd: document.getElementById("screen-fake-end"),
    end: document.getElementById("screen-end"),
    watch: document.getElementById("screen-watch"),
  };

  const progressEl = document.getElementById("progress");
  const questionTextEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options");
  const endTitleEl = document.getElementById("end-title");
  const endTextEl = document.getElementById("end-text");
  const endProfileEl = document.getElementById("end-profile");
  const endDisclaimerEl = document.getElementById("end-disclaimer");
  const fakeTextEl = document.getElementById("fake-text");
  const btnExit = document.getElementById("btn-exit");
  const btnContinueEnd = document.getElementById("btn-continue-end");
  const watchTextEl = document.getElementById("watch-text");
  const btnMenu = document.getElementById("btn-menu");
  const btnStart = document.getElementById("btn-start");
  const btnSettings = document.getElementById("btn-settings");
  const sfxOnBtn = document.getElementById("sfx-on");
  const sfxOffBtn = document.getElementById("sfx-off");
  const volumeSlider = document.getElementById("volume");
  const audioMini = document.getElementById("audio-mini");
  const miniMute = document.getElementById("mini-mute");
  const miniVolume = document.getElementById("mini-volume");

  const DEBUG = new URLSearchParams(location.search).has("debug");

  /* Tuning knobs — section 8 (tempo) and 9 (eventos). Kept low on purpose:
     the effect only works while the interface still looks normal. */
  const TIMING = {
    fastMs: 1500,
    slowMs: 11000,
    maxCallouts: 2,
    firstEligibleIndex: 4,
    calloutChance: 0.6,
  };

  /*
   * A pontuação mede MEDO, numa direção só: quanto maior, mais a pessoa foi
   * afetada. Por isso o ranking tem duas pontas — menor pontuação é o mais
   * corajoso, maior é o mais assustado.
   *
   * A faixa alcançável nunca começa em zero (toda opção vale ao menos 1), então
   * o percentual é normalizado entre o mínimo e o máximo possíveis.
   */
  const SCORE_RANGE = QUESTIONS.reduce(
    (acc, q) => {
      const scores = (q.options || []).map((o) => o.score || 0);
      if (!scores.length) return acc;
      acc.min += Math.min(...scores);
      acc.max += Math.max(...scores);
      return acc;
    },
    { min: 0, max: 0 }
  );

  /* Teto do que o comportamento pode somar, para o tempo de resposta temperar
     o resultado sem passar por cima do que a pessoa de fato respondeu. */
  const BEHAVIOR_BUDGET = 12;

  function scorePercent() {
    const span = SCORE_RANGE.max + BEHAVIOR_BUDGET - SCORE_RANGE.min;
    if (span <= 0) return 0;
    const ratio = (state.score - SCORE_RANGE.min) / span;
    return Math.max(0, Math.min(100, Math.round(ratio * 100)));
  }

  const EVENTS = {
    minGap: 1,
    maxPerRun: 6,
    firstEligibleIndex: 3,
  };

  const state = {
    index: 0,
    level: 0,
    dreadPoints: 0,
    score: 0,
    behaviorPoints: 0,
    answers: {},
    answerLabels: {},
    startTime: null,
    questionShownAt: null,
    advancing: false,
    timingCallouts: 0,
    eventsFired: 0,
    lastEventIndex: -99,
    leftDuringQuestion: false,
    mutateTimer: null,
    renderToken: 0,
    times: {},
    fearPayloadDone: false,
    fearPayloadIndex: 8 + Math.floor(Math.random() * 4),
  };

  /* Dread is driven mostly by position so the arc always happens, and only
     nudged by answers — otherwise a timid player never sees the escalation. */
  const MAX_DREAD_POINTS = QUESTIONS.reduce((sum, q) => {
    const optionMax = Math.max(0, ...(q.options || []).map((o) => o.dread || 0));
    return sum + (q.dreadOnEnter || 0) + (q.dreadOnAnswer || 0) + optionMax;
  }, 0);

  function ctx() {
    return {
      answers: state.answers,
      answerLabels: state.answerLabels,
      name: state.answers.name || "",
      times: state.times,
      leftTab: state.leftTabEver,
      elapsedSeconds: () => Math.max(0, Math.round((Date.now() - state.startTime) / 1000)),
    };
  }

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  function buildProgressDots() {
    progressEl.innerHTML = "";
    QUESTIONS.forEach(() => {
      const dot = document.createElement("span");
      dot.className = "dot";
      progressEl.appendChild(dot);
    });
  }

  function updateProgressDots() {
    progressEl.querySelectorAll(".dot").forEach((d, i) => {
      d.classList.toggle("filled", i < state.index);
    });
  }

  function applyDreadLevel() {
    const progress = QUESTIONS.length > 1 ? state.index / (QUESTIONS.length - 1) : 1;
    const pointRatio = MAX_DREAD_POINTS > 0 ? state.dreadPoints / MAX_DREAD_POINTS : 0;
    const level = Math.max(0, Math.min(10, Math.round(progress * 6 + pointRatio * 4)));
    state.level = level;

    for (let i = 1; i <= 10; i++) document.body.classList.remove(`dread-${i}`);
    if (level > 0) document.body.classList.add(`dread-${level}`);
    Sound.setStage(level);
    Effects.setPresenceActivity(level);
  }

  function typeText(el, text, speed = 16, token = state.renderToken) {
    return new Promise((resolve) => {
      el.textContent = "";
      const cursor = document.createElement("span");
      cursor.className = "cursor";
      cursor.textContent = "▍";
      let i = 0;

      function step() {
        if (token !== state.renderToken) {
          cursor.remove();
          resolve();
          return;
        }
        if (i <= text.length) {
          el.textContent = text.slice(0, i);
          el.appendChild(cursor);
          i++;
          setTimeout(step, speed);
        } else {
          cursor.remove();
          resolve();
        }
      }
      step();
    });
  }

  function resolveText(value) {
    return typeof value === "function" ? value(ctx()) : value;
  }

  /* ---------- section 9: eventos aleatórios ---------- */

  function dotAnomaly() {
    const dots = Array.from(progressEl.querySelectorAll(".dot"));
    const candidates = dots.slice(state.index + 1);
    if (!candidates.length) return;
    const dot = candidates[Math.floor(Math.random() * candidates.length)];
    dot.classList.add("filled");
    setTimeout(() => dot.classList.remove("filled"), 900);
  }

  function titleShift() {
    const original = document.title;
    document.title = state.answers.name || "Ainda está aí?";
    setTimeout(() => (document.title = original), 1400);
  }

  function strangeOption() {
    const buttons = Array.from(optionsEl.querySelectorAll(".option"));
    if (!buttons.length) return;
    const lines = ["Você já respondeu isso.", "Essa não conta.", "Não escolha essa."];
    const btn = buttons[Math.floor(Math.random() * buttons.length)];
    const original = btn.textContent;
    btn.textContent = lines[Math.floor(Math.random() * lines.length)];
    setTimeout(() => {
      if (btn.textContent !== original) btn.textContent = original;
    }, 700);
  }

  /* Quase tudo aqui é pequeno e localizado. `screenTear` é o único efeito de
     tela inteira e por isso tem a menor probabilidade da tabela. */
  const RANDOM_EVENTS = [
    { chance: 0.07, run: () => Effects.glitchWord(questionTextEl) },
    { chance: 0.05, run: () => Sound.randomSfx() },
    { chance: 0.05, run: () => Effects.fragment() },
    { chance: 0.04, run: dotAnomaly },
    { chance: 0.035, run: glitchRandomOption },
    { chance: 0.03, run: () => Effects.presencePulse() },
    { chance: 0.025, run: titleShift },
    { chance: 0.025, run: () => Effects.artifact() },
    { chance: 0.02, run: strangeOption },
    { chance: 0.015, run: () => Effects.humanFlash() },
    { chance: 0.01, run: () => Effects.faceFlash() },
    { chance: 0.008, run: () => Effects.screenTear() },
  ];

  function glitchRandomOption() {
    const buttons = Array.from(optionsEl.querySelectorAll(".option"));
    if (!buttons.length) return;
    Effects.glitchElement(buttons[Math.floor(Math.random() * buttons.length)]);
  }

  /*
   * A resposta da primeira pergunta cobra o preço mais tarde. Dispara uma vez
   * só, num ponto sorteado da segunda metade, para duas pessoas não viverem a
   * mesma partida.
   */
  const FEAR_PAYLOADS = {
    aranhas: () => Effects.spiders(),
    cobras: () => Effects.snake(),
    altura: () => Effects.vertigo(),
    palhacos: () => Effects.clown(),
    fechado: () => Effects.closeIn(),
    escuro: () => {
      Effects.blackout();
      Sound.breathing(-0.4);
    },
    silencio: () => Sound.duckAll(4500),
    morte: () => Sound.flatline(),
    observado: () => {
      Effects.manyEyes();
      Sound.whisper(0.8);
    },
  };

  function maybeFearPayload() {
    if (state.fearPayloadDone) return;
    if (state.index !== state.fearPayloadIndex) return;

    const payload = FEAR_PAYLOADS[state.answers.fear];
    if (!payload) return;

    state.fearPayloadDone = true;
    setTimeout(payload, 1800 + Math.random() * 1800);
  }

  function maybeRandomEvent() {
    if (state.index < EVENTS.firstEligibleIndex) return;
    if (state.eventsFired >= EVENTS.maxPerRun) return;
    if (state.index - state.lastEventIndex < EVENTS.minGap) return;

    /* A chance sobe junto com o terror: o começo continua parecendo normal e
       o final fica visivelmente quebrado, que é o contraste que dá impacto. */
    const scale = 0.6 + state.level * 0.11;

    const roll = Math.random();
    let acc = 0;
    for (const ev of RANDOM_EVENTS) {
      acc += ev.chance * scale;
      if (roll < acc) {
        state.eventsFired++;
        state.lastEventIndex = state.index;
        setTimeout(ev.run, 600 + Math.random() * 2500);
        return;
      }
    }
  }

  /* ---------- section 8: tempo de resposta ---------- */

  /*
   * Só soma o que é sinal de medo: fugir da aba e hesitar. Responder rápido
   * não soma nada — antes somava +1, e como quase toda ação pontuava, o número
   * não apontava para lado nenhum.
   */
  function applyTimingScore(responseMs) {
    let points = 0;
    if (state.leftDuringQuestion) points = 3;
    else if (responseMs > TIMING.slowMs) points = 2;
    if (points === 0) return;

    const room = Math.max(0, BEHAVIOR_BUDGET - state.behaviorPoints);
    const applied = Math.min(points, room);
    state.behaviorPoints += applied;
    state.score += applied;

    if (state.leftDuringQuestion) state.dreadPoints += 1;
  }

  function maybeTimingCallout(responseMs) {
    if (state.timingCallouts >= TIMING.maxCallouts) return null;
    if (state.index < TIMING.firstEligibleIndex) return null;
    if (Math.random() > TIMING.calloutChance) return null;

    let pool = null;
    if (state.leftDuringQuestion) {
      pool = ["Você saiu.", "Onde você foi?"];
    } else if (responseMs > TIMING.slowMs) {
      pool = ["Você demorou.", "Por que pensou tanto nessa?", "Essa foi difícil?"];
    } else if (responseMs < TIMING.fastMs) {
      pool = ["Rápido demais.", "Nem pensou nessa."];
    }
    if (!pool) return null;

    state.timingCallouts++;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* ---------- rendering ---------- */

  async function renderQuestion(question) {
    clearTimeout(state.mutateTimer);
    state.renderToken++;
    const token = state.renderToken;

    state.dreadPoints += question.dreadOnEnter || 0;
    applyDreadLevel();
    updateProgressDots();

    optionsEl.innerHTML = "";
    questionTextEl.textContent = "";

    if (question.stinger) {
      Effects.flash();
      Sound.stinger();
      Effects.shake(document.getElementById("question-card"));
    }

    await typeText(questionTextEl, resolveText(question.text), 16, token);
    if (token !== state.renderToken) return;

    if (question.type === "text") renderTextInput(question);
    else renderOptions(question);

    state.questionShownAt = Date.now();
    state.leftDuringQuestion = false;

    if (question.mutateAfter) scheduleMutation(question, token);
    maybeFearPayload();
    maybeRandomEvent();
  }

  function scheduleMutation(question, token) {
    const { delay = 6000, text } = question.mutateAfter;
    state.mutateTimer = setTimeout(async () => {
      if (state.advancing || token !== state.renderToken) return;
      Effects.glitchText(questionTextEl);
      await new Promise((r) => setTimeout(r, 240));
      await typeText(questionTextEl, resolveText(text), 14, token);
    }, delay);
  }

  function renderOptions(question) {
    const buttons = question.options.map((opt) => {
      const btn = document.createElement("button");
      btn.className = "option";
      btn.type = "button";
      btn.textContent = opt.label;
      btn.addEventListener("click", () => handleAnswer(question, opt, buttons));
      optionsEl.appendChild(btn);
      return btn;
    });

    if (question.flickerOptions) flickerButtons(buttons, question.options);
  }

  function renderTextInput(question) {
    const row = document.createElement("div");
    row.className = "text-row";

    const input = document.createElement("input");
    input.className = "text-input";
    input.type = "text";
    input.maxLength = 24;
    input.autocomplete = "off";
    input.placeholder = question.placeholder || "";

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.type = "button";
    btn.textContent = "Continuar";

    const submit = () => {
      if (state.advancing) return;
      input.disabled = true;
      handleAnswer(
        question,
        {
          label: input.value.trim(),
          value: input.value.trim(),
          dread: question.dreadOnAnswer || 0,
          score: 0,
        },
        [btn]
      );
    };

    btn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });

    row.appendChild(input);
    row.appendChild(btn);
    optionsEl.appendChild(row);
    input.focus();
  }

  function flickerButtons(buttons, realOptions) {
    const decoys = ["...", "Talvez", "Já respondeu isso", "?", "Continue"];
    let ticks = 0;
    const maxTicks = 5;
    const interval = setInterval(() => {
      ticks++;
      buttons.forEach((btn, i) => {
        btn.textContent =
          ticks >= maxTicks
            ? realOptions[i].label
            : decoys[Math.floor(Math.random() * decoys.length)];
      });
      if (ticks >= maxTicks) clearInterval(interval);
    }, 90);
  }

  /* ---------- answering ---------- */

  async function handleAnswer(question, option, buttons) {
    if (state.advancing) return;
    state.advancing = true;

    clearTimeout(state.mutateTimer);
    state.renderToken++;
    const token = state.renderToken;

    buttons.forEach((b) => (b.disabled = true));

    const responseMs = Date.now() - state.questionShownAt;
    state.times[question.id] = responseMs;
    state.answers[question.id] = option.value;
    state.answerLabels[question.id] = option.label;
    state.dreadPoints += option.dread || 0;
    state.score += option.score || 0;
    applyTimingScore(responseMs);
    applyDreadLevel();

    /* An authored reveal outranks a timing remark, so the two never stack. */
    const beat = question.reveal
      ? resolveText(question.reveal)
      : maybeTimingCallout(responseMs);

    if (beat) {
      await new Promise((r) => setTimeout(r, 350));
      Effects.glitchText(questionTextEl);
      await new Promise((r) => setTimeout(r, 260));
      await typeText(questionTextEl, beat, 14, token);
      optionsEl.innerHTML = "";
      await new Promise((r) => setTimeout(r, 1500));
    } else {
      await new Promise((r) => setTimeout(r, 450));
    }

    advance();
  }

  function advance() {
    state.index++;
    state.advancing = false;
    if (state.index < QUESTIONS.length) {
      renderQuestion(QUESTIONS[state.index]);
    } else {
      finish();
    }
  }

  function finish() {
    updateProgressDots();
    Secrets.stop();
    Secrets.checkAnswers(state.answers);

    /* O falso final só existe pra quem se envolveu. No perfil mais leve o site
       perde o interesse — insistir ali contradiria o próprio final. */
    if (state.score > 20) showFakeEnding();
    else showRealEnding();
  }

  function showFakeEnding() {
    showScreen("fakeEnd");
    state.renderToken++;
    fakeTextEl.textContent = "Sua participação foi registrada.";

    let broken = false;
    const breakIllusion = () => {
      if (broken) return;
      broken = true;
      clearTimeout(autoBreak);

      Effects.glitchElement(fakeTextEl);
      Sound.stinger();
      btnExit.disabled = true;
      setTimeout(() => {
        fakeTextEl.textContent = "Você realmente achou que tinha acabado?";
        setTimeout(showRealEnding, 2600);
      }, 300);
    };

    const autoBreak = setTimeout(breakIllusion, 6500);
    btnExit.addEventListener("click", breakIllusion, { once: true });
  }

  function showRealEnding() {
    showScreen("end");
    state.renderToken++;

    const percent = scorePercent();
    const tier =
      SCORE_TIERS.find((t) => percent <= t.maxPercent) || SCORE_TIERS[SCORE_TIERS.length - 1];

    const profile = PROFILES[state.answers.fear] || PROFILE_FALLBACK;
    endProfileEl.textContent = `Você demonstra maior desconforto com situações relacionadas a ${profile}`;
    endDisclaimerEl.textContent = DISCLAIMER;

    endTitleEl.textContent = tier.title;
    typeText(endTextEl, resolveText(tier.text), 18, state.renderToken).then(() => {
      btnContinueEnd.hidden = false;
    });

    submitResult(tier);

    if (DEBUG) {
      const debugLine = document.createElement("p");
      debugLine.className = "fine-print";
      debugLine.textContent = `[debug] medo ${state.score} (${percent}%) · faixa ${SCORE_RANGE.min}–${SCORE_RANGE.max}+${BEHAVIOR_BUDGET} · comportamento ${state.behaviorPoints} · tier ${tier.id} · dread ${state.dreadPoints}/${MAX_DREAD_POINTS} · eventos ${state.eventsFired} · segredos [${Secrets.found().join(", ")}]`;
      screens.end.appendChild(debugLine);
    }

    document.body.classList.add("dread-10");
    Sound.setStage(10);
    Effects.setPresenceActivity(10);
  }

  /*
   * Manda a partida para a API. Falha em silêncio de propósito: se o back-end
   * estiver fora do ar, a experiência não pode quebrar por causa disso.
   */
  function submitResult(tier) {
    const answers = { ...state.answers };
    delete answers.name; // o nome já vai em campo próprio

    fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerName: state.answers.name || null,
        score: state.score,
        tier: tier.id,
        fear: state.answers.fear || null,
        durationSeconds: Math.max(0, Math.round((Date.now() - state.startTime) / 1000)),
        eventsFired: state.eventsFired,
        reachedEnd: true,
        answers,
      }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        state.standing = data;
        /* Com pouca gente o percentual não diz nada, então nem mostra. */
        if (data.totalPlayers > 4) {
          document.getElementById("end-standing").textContent =
            `Você se assustou mais que ${data.betterThanPercent}% de quem chegou até aqui.`;
        }
      })
      .catch(() => {});
  }

  async function showWatchScreen() {
    showScreen("watch");
    state.renderToken++;
    const token = state.renderToken;

    await new Promise((r) => setTimeout(r, 900));
    await typeText(watchTextEl, FINAL_WATCH, 42, token);

    Effects.glitchWord(watchTextEl);
    Sound.breathing(0.5);

    setTimeout(() => {
      showStanding();
      document.getElementById("watch-actions").hidden = false;
    }, 2200);
  }

  /* Placar só aparece depois que a frase final já assentou: número junto com o
     texto de encerramento roubaria o peso dele. */
  function showStanding() {
    const el = document.getElementById("watch-score");
    const data = state.standing;

    if (!data) {
      el.textContent = `Seu medo: ${state.score} pontos.`;
      return;
    }

    const linhas = [`Seu medo: ${data.score} pontos.`];
    if (data.totalPlayers > 1) {
      linhas.push(`${data.position}º mais assustado entre ${data.totalPlayers} pessoas.`);
    }
    el.textContent = linhas.join("\n");
  }

  /* Marca que essa aba já terminou uma vez: o menu volta com uma linha
     ligeiramente diferente na próxima partida. */
  function markPlayed() {
    try {
      sessionStorage.setItem("fq_played", "1");
    } catch {
      /* navegação privada pode bloquear — a marca é opcional. */
    }
  }

  /* F11 só existe no desktop; no toque a dica seria ruído. */
  function applySetupHint() {
    if (window.matchMedia("(hover: hover)").matches) {
      document.getElementById("setup-hint").textContent =
        "Recomendamos fones de ouvido e tela cheia (F11).";
    }
  }

  function wirePortfolioLinks() {
    if (PORTFOLIO.url) {
      ["credit-link", "watch-credit"].forEach((id) => {
        const el = document.getElementById(id);
        el.href = PORTFOLIO.url;
        el.textContent = PORTFOLIO.label;
        el.hidden = false;
      });
    }

    const feedbackUrl = FEEDBACK.url || PORTFOLIO.url;
    if (feedbackUrl) {
      const btn = document.getElementById("btn-feedback");
      btn.href = feedbackUrl;
      btn.textContent = FEEDBACK.label;
      btn.hidden = false;
    }
  }

  function applyPlayedMark() {
    let played = false;
    try {
      played = sessionStorage.getItem("fq_played") === "1";
    } catch {
      played = false;
    }
    if (played) {
      document.querySelector("#screen-settings .subtitle").textContent =
        "Antes de começar. De novo.";
    }
  }

  function startQuiz() {
    state.startTime = Date.now();
    Secrets.start();
    showScreen("quiz");
    renderQuestion(QUESTIONS[state.index]);
  }

  /* ---------- configurações de áudio ---------- */

  function syncSfxButtons(on) {
    sfxOnBtn.classList.toggle("active", on);
    sfxOffBtn.classList.toggle("active", !on);
  }

  function wireSettings() {
    sfxOnBtn.addEventListener("click", () => {
      Sound.setSfxEnabled(true);
      syncSfxButtons(true);
    });
    sfxOffBtn.addEventListener("click", () => {
      Sound.setSfxEnabled(false);
      syncSfxButtons(false);
    });

    const applyVolume = (value) => {
      Sound.setVolume(value / 100);
      volumeSlider.value = value;
      miniVolume.value = value;
      miniMute.classList.toggle("muted", Number(value) === 0);
    };

    volumeSlider.addEventListener("input", (e) => applyVolume(e.target.value));
    miniVolume.addEventListener("input", (e) => applyVolume(e.target.value));

    let volumeBeforeMute = Number(volumeSlider.value);
    miniMute.addEventListener("click", () => {
      const current = Number(miniVolume.value);
      if (current > 0) {
        volumeBeforeMute = current;
        applyVolume(0);
      } else {
        applyVolume(volumeBeforeMute || 70);
      }
    });

    /* O clique aqui é o gesto que libera o áudio no navegador. */
    btnSettings.addEventListener("click", () => {
      Sound.start();
      Sound.setVolume(Number(volumeSlider.value) / 100);
      Sound.setSfxEnabled(sfxOnBtn.classList.contains("active"));
      audioMini.hidden = false;
      showScreen("prologue");
      Prologue.play(() => showScreen("intro"));
    }, { once: true });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      state.leftDuringQuestion = true;
      state.leftTabEver = true;
    }
  });

  buildProgressDots();
  Effects.startGrain();
  applyPlayedMark();
  applySetupHint();
  wirePortfolioLinks();
  wireSettings();
  btnStart.addEventListener("click", startQuiz, { once: true });
  btnContinueEnd.addEventListener("click", showWatchScreen, { once: true });
  btnMenu.addEventListener("click", () => {
    markPlayed();
    location.reload();
  });
})();
