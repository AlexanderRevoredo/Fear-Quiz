/*
 * Fear Quiz — tela de estatísticas.
 *
 * Fica fora da ficção de propósito: aqui o objetivo é ler dado, não assustar.
 * Os rótulos dos medos e dos perfis são derivados de questions.js, para não
 * existir uma segunda lista para manter em sincronia.
 */

(() => {
  const stateEl = document.getElementById("stats-state");
  const bodyEl = document.getElementById("stats-body");

  /* Os valores gravados no banco são chaves ("observado"); as etiquetas legíveis
     vivem em questions.js. */
  const FEAR_LABELS = Object.fromEntries(
    (QUESTIONS.find((q) => q.id === "fear")?.options || []).map((o) => [o.value, o.label])
  );

  const TIER_LABELS = {
    leve: "Leve",
    intermediario: "Intermediário",
    intenso: "Intenso",
  };

  const TIER_ORDER = ["leve", "intermediario", "intenso"];

  function formatDuration(seconds) {
    if (!seconds) return "—";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  function renderBars(container, entries, total) {
    container.innerHTML = "";
    if (!entries.length) {
      container.innerHTML = '<p class="stats-empty">Sem dados ainda.</p>';
      return;
    }

    const maior = Math.max(...entries.map((e) => e.value));

    entries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "bar-row";

      const label = document.createElement("span");
      label.className = "bar-label";
      label.textContent = entry.label;

      const track = document.createElement("div");
      track.className = "bar-track";
      const fill = document.createElement("div");
      fill.className = "bar-fill";
      /* Largura relativa ao maior valor, senão as barras pequenas somem. */
      fill.style.width = `${maior > 0 ? (entry.value / maior) * 100 : 0}%`;
      track.appendChild(fill);

      const value = document.createElement("span");
      value.className = "bar-value";
      const percent = total > 0 ? Math.round((entry.value / total) * 100) : 0;
      value.textContent = `${entry.value} · ${percent}%`;

      row.append(label, track, value);
      container.appendChild(row);
    });
  }

  function renderRanking(listEl, entries) {
    listEl.innerHTML = "";
    if (!entries || !entries.length) {
      listEl.innerHTML = '<li class="stats-empty">Ninguém ainda.</li>';
      return;
    }

    entries.forEach((entry) => {
      const li = document.createElement("li");

      const name = document.createElement("span");
      name.className = "rank-name";
      name.textContent = entry.playerName;

      const score = document.createElement("span");
      score.className = "rank-score";
      score.textContent = `${entry.score} pts · ${formatDuration(entry.durationSeconds)}`;

      li.append(name, score);
      listEl.appendChild(li);
    });
  }

  function render(stats, ranking) {
    document.getElementById("stat-total").textContent = stats.totalPlayers;
    document.getElementById("stat-avg").textContent = stats.averageScore;
    document.getElementById("stat-time").textContent =
      formatDuration(stats.averageDurationSeconds);

    const tierEntries = TIER_ORDER.filter((id) => stats.tierCounts[id] !== undefined).map((id) => ({
      label: TIER_LABELS[id] || id,
      value: stats.tierCounts[id],
    }));
    renderBars(document.getElementById("tier-bars"), tierEntries, stats.totalPlayers);

    const fearEntries = Object.entries(stats.fearCounts)
      .map(([key, value]) => ({ label: FEAR_LABELS[key] || key, value }))
      .sort((a, b) => b.value - a.value);
    renderBars(document.getElementById("fear-bars"), fearEntries, stats.totalPlayers);

    renderRanking(document.getElementById("rank-fear"), ranking.maisMedrosos);
    renderRanking(document.getElementById("rank-brave"), ranking.maisCorajosos);

    stateEl.hidden = true;
    bodyEl.hidden = false;
  }

  Promise.all([
    fetch("/api/results/stats").then((r) => {
      if (!r.ok) throw new Error(`stats ${r.status}`);
      return r.json();
    }),
    fetch("/api/results/ranking").then((r) => {
      if (!r.ok) throw new Error(`ranking ${r.status}`);
      return r.json();
    }),
  ])
    .then(([stats, ranking]) => {
      if (!stats.totalPlayers) {
        stateEl.textContent = "Ninguém terminou o quiz ainda.";
        return;
      }
      render(stats, ranking);
    })
    .catch(() => {
      stateEl.textContent =
        "Não consegui falar com o servidor. Confira se a aplicação está no ar.";
    });
})();
