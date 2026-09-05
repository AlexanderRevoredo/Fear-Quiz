/*
 * Fear Quiz — eventos secretos.
 *
 * Cada um dispara no máximo uma vez por partida. A ideia é que quase ninguém
 * veja todos: quem só responde o questionário não encontra nenhum.
 */

const Secrets = (() => {
  const secretEl = document.getElementById("secret");
  const presenceEl = document.getElementById("presence");

  const fired = new Set();
  let active = false;
  let idleTimer = null;
  let presenceClicks = 0;
  let presenceClickTimer = null;
  let voidClicks = 0;
  let backPresses = 0;

  function show(message, ms = 2600) {
    secretEl.textContent = message;
    secretEl.classList.add("visible");
    setTimeout(() => secretEl.classList.remove("visible"), ms);
  }

  function once(id, fn) {
    if (fired.has(id)) return;
    fired.add(id);
    fn();
  }

  /* Cutucar o ponto vermelho três vezes seguidas. */
  function wirePresence() {
    presenceEl.addEventListener("click", () => {
      if (!active) return;
      presenceClicks++;
      clearTimeout(presenceClickTimer);
      presenceClickTimer = setTimeout(() => (presenceClicks = 0), 4000);

      if (presenceClicks >= 3) {
        once("presence", () => {
          Effects.presencePulse();
          Sound.whisper(0.85);
          show("Eu também estou te vendo.");
        });
      }
    });
  }

  /* Ficar parado tempo demais. */
  function resetIdle() {
    clearTimeout(idleTimer);
    if (!active) return;
    idleTimer = setTimeout(() => {
      once("idle", () => {
        Sound.breathing(-0.6);
        show("Você parou. Eu esperei.");
      });
    }, 45000);
  }

  function wireIdle() {
    ["mousemove", "keydown", "click", "touchstart"].forEach((evt) => {
      document.addEventListener(evt, resetIdle, { passive: true });
    });
  }

  /*
   * Tentar voltar. A primeira vez vira mensagem; a segunda sai de verdade —
   * prender a pessoa na página seria hostil, não assustador.
   */
  function wireBack() {
    history.pushState({ fq: true }, "");
    window.addEventListener("popstate", () => {
      if (!active) return;
      backPresses++;
      if (backPresses === 1) {
        history.pushState({ fq: true }, "");
        Sound.knock(-0.8);
        show("Ainda não.");
      }
    });
  }

  /* Clicar onde aparentemente não tem nada. */
  function wireVoid() {
    document.addEventListener("click", (e) => {
      if (!active) return;
      if (e.target.closest("button, input, #presence, #audio-mini")) return;
      voidClicks++;
      if (voidClicks === 7) {
        once("void", () => {
          Effects.fragment();
          Sound.drip(-0.5);
          show("Não tem nada aí. Ainda.");
        });
      }
    });
  }

  /* Combinação de respostas: recusar e mandar parar o tempo todo. */
  function checkAnswers(answers) {
    const resistiu =
      answers.alone === "na" &&
      (answers.name_alone === "pare" || answers.echo_fear === "protesto") &&
      answers.reassemble === "pare";

    if (resistiu) {
      once("resistencia", () => {
        Sound.childLaugh(0.6);
        show("Você pediu pra parar três vezes. Eu contei.", 4000);
      });
      return true;
    }
    return false;
  }

  function start() {
    active = true;
    resetIdle();
  }

  function stop() {
    active = false;
    clearTimeout(idleTimer);
  }

  wirePresence();
  wireIdle();
  wireBack();
  wireVoid();

  return { start, stop, checkAnswers, show, found: () => Array.from(fired) };
})();
