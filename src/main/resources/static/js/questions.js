/*
 * Fear Quiz — question script.
 *
 * Each question:
 *   id            unique key, used to look up earlier answers
 *   type          "choice" (default) or "text" (free input)
 *   dreadOnEnter  dread points added the moment this question is shown
 *   text          string, or fn(ctx) -> string, evaluated at render time
 *   reveal        optional fn(ctx) -> string, shown briefly after an answer
 *                 is picked, before advancing (the "the site knows" beat)
 *   options       array of { label, value, dread, score }
 *                   dread → drives the visual/audio escalation
 *                   score → hidden fear profile, decides the ending (section 6)
 *   mutateAfter   optional { delay, text } — if the question is still
 *                 unanswered after `delay` ms, it silently rewrites itself
 *   flickerOptions / stinger   one-off staging flags
 *
 * ctx passed to text()/reveal() functions:
 *   answers        { questionId: value }
 *   answerLabels   { questionId: label }
 *   name           what the user typed at the start ("" if they skipped)
 *   elapsedSeconds()  seconds since the quiz started
 */

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function clockNow() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 5) return "madrugada";
  if (h < 12) return "manha";
  if (h < 18) return "tarde";
  return "noite";
}

/* Três variantes por período, sorteadas: duas pessoas na mesma hora não
   recebem a mesma frase, e ninguém recebe a mesma na segunda partida. */
const MOMENT_LINES = {
  madrugada: [
    () => `São ${clockNow()} aí.\nQuase ninguém chega até aqui a essa hora.`,
    () => "Você devia estar dormindo.\nMas você não ia dormir mesmo, ia?",
    () => "Madrugada.\nÉ quando as respostas ficam mais sinceras.",
  ],
  manha: [
    () => `São ${clockNow()} aí.\nVocê acordou e veio direto pra cá.`,
    () => "Ainda é cedo aí.\nVocê vai carregar isso pelo resto do dia.",
    () => "Manhã.\nEu vou continuar aqui quando escurecer.",
  ],
  tarde: [
    () => `São ${clockNow()} aí.\nVocê tinha outra coisa pra fazer agora, não tinha?`,
    () => "Ainda tem luz aí.\nIsso vai parecer diferente daqui a algumas horas.",
    () => "Tarde.\nVocê parou no meio de alguma coisa pra fazer isso.",
  ],
  noite: [
    () => "Já escureceu aí.\nEra o que eu esperava.",
    () => `São ${clockNow()} aí.\nA essa hora você já não vai mais sair.`,
    () => "Noite.\nBoa hora. Pra mim.",
  ],
};

/*
 * Monta a "leitura" que o site faz da pessoa, com o que ela respondeu e com o
 * tempo que levou em cada resposta. Só afirma o que é verdade naquela partida:
 * cada linha depende de um dado real, então nada soa genérico.
 */
function buildReading(ctx) {
  const linhas = [];

  const medo = (ctx.answerLabels.fear || "").toLowerCase();
  if (medo) linhas.push(`Você tem medo de ${medo}.`);

  /* fear, alone e headphones já têm linha própria — sem elas, a de hesitação
     não repete uma resposta que aparece logo abaixo. */
  const tempos = Object.entries(ctx.times || {}).filter(
    ([id]) => !["name", "fear", "alone", "headphones"].includes(id) && ctx.answerLabels[id]
  );
  if (tempos.length) {
    const [lentoId, lentoMs] = tempos.reduce((a, b) => (b[1] > a[1] ? b : a));
    if (lentoMs > 3500) {
      linhas.push(`Onde você mais hesitou, respondeu "${ctx.answerLabels[lentoId]}".`);
    } else {
      linhas.push("Respondeu tudo rápido. Nem parou pra pensar em nenhuma.");
    }
  }

  if (ctx.answers.alone === "sim") {
    linhas.push("Está sozinho, e me contou isso sem hesitar.");
  } else if (ctx.answers.alone === "na") {
    linhas.push("Não quis dizer se estava sozinho. Isso também me diz alguma coisa.");
  }

  if (ctx.answers.headphones === "sim") {
    linhas.push("E está de fone. Estive perto esse tempo todo.");
  }

  if (ctx.leftTab) {
    linhas.push("Saiu daqui no meio e voltou. Eu continuei contando.");
  }

  return linhas;
}

/* Prefixo com o nome — some sozinho se a pessoa não quis dizer. */
function named(ctx, sentence) {
  return ctx.name ? `${ctx.name}. ${sentence}` : sentence;
}

const QUESTIONS = [

  // ---------- phase 1: a perfectly normal quiz ----------
  {
    id: "name",
    type: "text",
    dreadOnEnter: 0,
    dreadOnAnswer: 1,
    placeholder: "seu nome",
    text: "Antes de começar: qual é o seu nome?",
  },
  {
    id: "fear",
    dreadOnEnter: 0,
    text: (ctx) => named(ctx, "Qual dessas situações te incomoda mais?"),
    options: [
      { label: "Aranhas", value: "aranhas", dread: 0, score: 1 },
      { label: "Cobras", value: "cobras", dread: 0, score: 1 },
      { label: "Altura", value: "altura", dread: 0, score: 1 },
      { label: "Palhaços", value: "palhacos", dread: 0, score: 3 },
      { label: "Espaço fechado", value: "fechado", dread: 1, score: 3 },
      { label: "O escuro", value: "escuro", dread: 1, score: 3 },
      { label: "Silêncio absoluto", value: "silencio", dread: 0, score: 3 },
      { label: "Morte", value: "morte", dread: 1, score: 5 },
      { label: "Ser observado sem saber", value: "observado", dread: 1, score: 5 },
    ],
  },
  {
    id: "sleep",
    dreadOnEnter: 0,
    text: "Você dorme com a luz apagada?",
    options: [
      { label: "Sim", value: "sim", dread: 0, score: 1 },
      { label: "Não", value: "nao", dread: 0, score: 3 },
      { label: "Depende da noite", value: "depende", dread: 0, score: 5 },
    ],
  },
  {
    id: "background_noise",
    dreadOnEnter: 0,
    text: "O que você prefere enquanto dorme?",
    options: [
      { label: "Silêncio total", value: "silencio", dread: 0, score: 1 },
      { label: "Algum som de fundo", value: "som", dread: 0, score: 3 },
      { label: "Não penso nisso", value: "nada", dread: 0, score: 1 },
    ],
  },

  // ---------- phase 2: the questions start pointing at the room, not the screen ----------
  {
    id: "headphones",
    dreadOnEnter: 1,
    text: "Você está usando fone de ouvido agora?",
    options: [
      { label: "Estou", value: "sim", dread: 2, score: 3 },
      { label: "Não estou", value: "nao", dread: 1, score: 1 },
    ],
    reveal: (ctx) =>
      ctx.answers.headphones === "sim"
        ? "Bom.\nAssim o que vier agora vai estar dentro da sua cabeça."
        : "Então tudo que você ouvir a partir de agora\nestá no seu quarto.",
  },
  {
    id: "alone",
    dreadOnEnter: 1,
    text: "Está sozinho(a) nesse cômodo agora?",
    options: [
      { label: "Sim", value: "sim", dread: 3, score: 5 },
      { label: "Não", value: "nao", dread: 1, score: 1 },
      { label: "Prefiro não dizer", value: "na", dread: 2, score: 5 },
    ],
  },
  {
    id: "elapsed",
    dreadOnEnter: 1,
    text: "Há quanto tempo você está olhando para essa tela, sem desviar o olhar?",
    options: [
      { label: "Não faço ideia", value: "sem_ideia", dread: 1, score: 3 },
      { label: "Pouco tempo", value: "pouco", dread: 0, score: 1 },
    ],
    reveal: (ctx) => {
      const s = ctx.elapsedSeconds();
      return `${s} segundos. Você não desviou uma vez sequer.`;
    },
  },
  {
    /*
     * Hora local: funciona em qualquer navegador, ao contrário de detectar
     * navegador/sistema. O incômodo não vem do clima da hora — de manhã não
     * tem clima nenhum — e sim do site deduzir algo sobre a pessoa a partir
     * dela. Por isso toda variante fala de você, não do relógio.
     */
    id: "moment",
    dreadOnEnter: 2,
    text: () => pick(MOMENT_LINES[timeOfDay()])(),
    options: [
      { label: "É, faz sentido", value: "sim", dread: 2, score: 3 },
      { label: "Como você sabe disso?", value: "como", dread: 3, score: 5 },
    ],
    /* A versão antiga afirmava "eu sabia" sem que ninguém tivesse perguntado.
       Agora a pergunta é provocada pela pessoa, e a resposta não explica. */
    reveal: (ctx) =>
      ctx.answers.moment === "como"
        ? "Você me disse.\nSó não percebeu quando."
        : "Eu presto atenção nesse tipo de coisa.",
  },

  // ---------- phase 3: it starts quoting you back to yourself ----------
  {
    id: "echo_fear",
    dreadOnEnter: 3,
    text: (ctx) => {
      const label = ctx.answerLabels.fear || "alguma coisa";
      return `Você disse que "${label}" te incomoda.\nEu vou lembrar disso.`;
    },
    options: [
      { label: "Tudo bem", value: "ok", dread: 1, score: 3 },
      { label: "Eu não disse pra você lembrar", value: "protesto", dread: 2, score: 5 },
    ],
  },
  {
    id: "name_alone",
    dreadOnEnter: 3,
    text: (ctx) => {
      const before = ctx.answers.alone;
      if (before === "nao") {
        return named(ctx, "Antes você disse que não estava sozinho(a).\nIsso ainda é verdade?");
      }
      if (before === "na") {
        return named(ctx, "Você não quis responder isso antes.\nE agora?");
      }
      return named(ctx, "Você ainda está sozinho(a)?");
    },
    options: [
      { label: "Ainda estou", value: "ainda", dread: 3, score: 5 },
      { label: "Agora não", value: "agora_nao", dread: 2, score: 3 },
      { label: "Pare de perguntar isso", value: "pare", dread: 3, score: 5 },
    ],
  },
  {
    id: "surroundings",
    dreadOnEnter: 3,
    text: "As pessoas ao seu redor sabem que você está fazendo isso agora?",
    mutateAfter: {
      delay: 7000,
      text: "As pessoas ao seu redor sabem que você ainda está aqui?",
    },
    options: [
      { label: "Sim", value: "sim", dread: 1, score: 1 },
      { label: "Não", value: "nao", dread: 3, score: 5 },
    ],
  },
  {
    id: "flicker_choice",
    dreadOnEnter: 4,
    flickerOptions: true,
    text: "Isso ainda parece um questionário normal pra você?",
    options: [
      { label: "Sim", value: "sim", dread: 2, score: 3 },
      { label: "Não mais", value: "nao", dread: 3, score: 5 },
    ],
  },

  // ---------- phase 4: the quiz stops pretending ----------
  {
    id: "stinger",
    dreadOnEnter: 6,
    stinger: true,
    text: (ctx) => named(ctx, "Achei que você fosse desviar o olhar dessa vez."),
    options: [{ label: "Continuar", value: "continuar", dread: 2, score: 3 }],
  },
  {
    id: "reassemble",
    dreadOnEnter: 7,
    text: (ctx) => {
      const linhas = buildReading(ctx);
      return `${named(ctx, "Deixa eu ver o que eu já sei.")}\n\n${linhas.join("\n")}\n\nFaz sentido?`;
    },
    options: [
      { label: "Não", value: "nao", dread: 2, score: 3 },
      { label: "Pare", value: "pare", dread: 2, score: 5 },
    ],
  },
  {
    id: "final",
    dreadOnEnter: 8,
    text: "Só mais uma coisa, e então acabou.",
    options: [{ label: "Terminar", value: "terminar", dread: 1, score: 1 }],
  },
];

/*
 * Resultado individual, a partir do medo escolhido na primeira pergunta.
 * É entretenimento: não finge validade psicológica nem diagnóstica, e a tela
 * final deixa isso escrito.
 */
const PROFILES = {
  observado:
    "perda de privacidade — o desconforto aparece quando algo consegue te observar e você não consegue observar de volta.",
  silencio:
    "ausência de estímulo — o incômodo não vem do que acontece, e sim de quanto tempo nada acontece.",
  altura:
    "perda de controle e a antecipação de algo irreversível, muito antes de acontecer.",
  aranhas:
    "imprevisibilidade — coisas que se movem antes de você decidir o que sentir sobre elas.",
};

const PROFILE_FALLBACK =
  "aquilo que você preferiu não nomear. Isso também diz alguma coisa.";

const DISCLAIMER = "Isto é entretenimento. Não é avaliação psicológica.";

/*
 * Faixas de medo (seção 6).
 *
 * O corte é por PERCENTUAL da faixa realmente alcançável, não por valor
 * absoluto. Como toda opção vale no mínimo 1, o piso de pontuação nunca é zero
 * — com cortes absolutos a faixa mais leve ficava inalcançável. Assim as
 * faixas se recalibram sozinhas quando perguntas são adicionadas ou removidas.
 *
 * Ordem importa: a primeira faixa cujo `maxPercent` couber é a escolhida.
 */
const SCORE_TIERS = [
  {
    id: "leve",
    maxPercent: 35,
    title: "ACABOU.",
    text: (ctx) =>
      `Você não me deu muita coisa${ctx.name ? `, ${ctx.name}` : ""}.\n\n` +
      `Tudo bem. Outras pessoas dão.\n\n` +
      `Eu fico por aqui mesmo assim.`,
  },
  {
    id: "intermediario",
    maxPercent: 70,
    title: "OBRIGADO.",
    text: (ctx) =>
      `Já é o suficiente${ctx.name ? `, ${ctx.name}` : ""}.\n\n` +
      `Nunca precisa de muito, na verdade.\n\n` +
      `Da próxima vez eu já vou saber por onde começar.`,
  },
  {
    id: "intenso",
    maxPercent: Infinity,
    title: "ATÉ LOGO.",
    text: (ctx) =>
      `Você respondeu tudo${ctx.name ? `, ${ctx.name}` : ""}. Até as que demoraram.\n\n` +
      `"${ctx.answerLabels.fear || "aquilo que você não disse"}" foi só o começo da lista.\n\n` +
      `Eu fiquei com o resto dela.`,
  },
];

/*
 * Último texto antes de voltar ao menu, igual para todos os perfis.
 * Fica sozinho na tela: é a única frase que assume, sem metáfora, que a
 * experiência não termina quando a aba fecha.
 */
const FINAL_WATCH = "Você pode fechar a aba agora.\nIsso nunca fez diferença.";

/*
 * Link do portfólio. Preencha `url` para os links aparecerem — enquanto
 * estiver vazio, nada é renderizado.
 */
const PORTFOLIO = {
  url: "https://portifolio-two-delta-76.vercel.app/",
  label: "portfólio do desenvolvedor",
};

