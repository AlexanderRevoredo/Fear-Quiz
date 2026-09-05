/*
 * Fear Quiz — prólogo.
 *
 * Um desenho infantil em papel claro que vai apodrecendo em cinco passos, e
 * então corte seco para preto. Curto de propósito (~15s) e sempre pulável:
 * serve para estabelecer atmosfera, não para contar nada.
 *
 * A música (Sound) sobe de estágio junto com a corrupção, então o áudio
 * estranha no mesmo ritmo da imagem.
 */

const Prologue = (() => {
  const screen = document.getElementById("screen-prologue");
  const paper = document.getElementById("paper");
  const caption = document.getElementById("paper-caption");
  const skipBtn = document.getElementById("btn-skip");

  let timers = [];
  let finished = false;
  let onDone = null;

  function at(ms, fn) {
    timers.push(setTimeout(fn, ms));
  }

  function setStep(n) {
    paper.classList.add(`corrupt-${n}`);
  }

  function finish() {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    timers = [];
    paper.className = "";
    caption.textContent = "minha casa";
    if (onDone) onDone();
  }

  function play(done) {
    onDone = done;
    finished = false;

    /* 1. pequenos erros */
    at(3600, () => {
      setStep(1);
      Sound.setStage(1);
    });

    /* 2. as cores mudam */
    at(6200, () => {
      setStep(2);
      Sound.setStage(2);
    });

    /* 3. alguém aparece na janela */
    at(8200, () => {
      setStep(3);
      caption.textContent = "minha casa";
      Sound.setStage(3);
      Sound.drip(0.7);
    });

    /* 4. o desenho é rabiscado */
    at(10400, () => {
      setStep(4);
      caption.textContent = "não é minha casa";
      Sound.setStage(4);
      Sound.whisper(-0.75);
    });

    /* 5. a imagem começa a falhar */
    at(12200, () => {
      setStep(5);
      Sound.interference(0.4);
      Effects.fragment();
    });
    at(12900, () => Effects.fragment());
    at(13400, () => Effects.screenTear());

    /* corte para preto */
    at(14200, () => {
      screen.classList.add("cut");
      Sound.setStage(2);
      Sound.stinger();
    });

    at(15600, finish);
  }

  skipBtn.addEventListener("click", finish);

  return { play };
})();
