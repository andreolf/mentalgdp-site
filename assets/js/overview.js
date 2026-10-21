/* Overview: hero trend (suicide rate, indexed to 2015) and the "where countries stand" positions block.
   Reads data/site.json (built by build/site_data.py). */
(async function () {
  const { bars, lines, fmt, notesBlock, indicatorTabs } = window.GMHI;
  const data = await (await fetch("data/site.json")).json();
  const $ = id => document.getElementById(id);
  const name = Object.fromEntries(data.jurisdictions.map(j => [j.iso3, j.name]));
  const BASE = "2015";
  if ($("n-countries")) $("n-countries").textContent = data.jurisdictions.length;

  // ---- hero trend ----
  const suicide = data.indicators.find(i => i.id === "suicide");
  const us = data.us_suicide;
  const indexed = series => {
    const b = series[BASE];
    return b ? Object.entries(series).filter(([y]) => y >= BASE).map(([y, v]) => [y, +(v / b * 100).toFixed(1)]) : [];
  };
  const change = series => {
    const ys = Object.keys(series).filter(y => y >= BASE).sort(), last = ys[ys.length - 1];
    return series[BASE] ? { pct: (series[last] / series[BASE] - 1) * 100, last } : null;
  };

  const pick = $("trend-pick");
  pick.appendChild(new Option("EU-27 and United States", "regions"));
  const og = document.createElement("optgroup"); og.label = "A country against the EU-27";
  data.jurisdictions.filter(j => suicide.series[j.iso3]?.[BASE] != null)
    .forEach(j => og.appendChild(new Option(j.name, j.iso3)));
  pick.appendChild(og);

  function renderTrend() {
    const v = pick.value;
    const shown = v === "regions"
      ? [{ label: "EU-27", color: "--series-1", raw: suicide.eu27 }, { label: "United States", color: "--series-2", raw: us.series }]
      : [{ label: name[v] + (suicide.notes?.[v] ? " *" : ""), color: "--series-3", raw: suicide.series[v] }, { label: "EU-27", color: "--ref", dashed: true, raw: suicide.eu27 }];
    const series = shown.map(s => ({ key: s.label, label: s.label, short: s.label, color: s.color, dashed: s.dashed, points: indexed(s.raw) }));
    lines($("trend-chart"), series, { digits: 0, height: 280, aria: "Suicide rate, change since 2015" });
    $("trend-stats").innerHTML = shown.map(s => {
      const c = change(s.raw); if (!c) return "";
      const sign = c.pct > 0 ? "+" : c.pct < 0 ? "−" : "";
      return `<div><i style="--c:var(${s.color})" class="${s.dashed ? "dash" : ""}"></i><span class="v">${sign}${fmt(Math.abs(c.pct), 0)}%</span>` +
        `<span class="l">${s.label}, ${BASE}–${c.last}</span></div>`;
    }).join("");
    const usNote = v === "regions" ? ` US: ${us.source} (${us.licence}), ${us.unit}.` : "";
    $("trend-source").innerHTML = `Suicide deaths per 100,000, age-standardised; each line indexed to its own 2015 level, because the EU and US standardise differently. ` +
      `EU: Eurostat <code>hlth_cd_asdr2</code> (CC BY 4.0).${usNote} Lower is better.` +
      (suicide.notes?.[v] ? `<span class="footnote">* ${suicide.notes[v]}</span>` : "");
  }
  pick.addEventListener("change", renderTrend);

  // ---- positions block ----
  const DIR = { lower_better: "Lower is better", higher_better: "Higher is better", context: "Context indicator" };
  function refYear(ind) {
    const n = Object.keys(ind.series).length, count = {};
    Object.values(ind.series).forEach(s => Object.keys(s).forEach(y => count[y] = (count[y] || 0) + 1));
    const ok = Object.keys(count).filter(y => count[y] >= 0.75 * n).sort();
    return ok[ok.length - 1];
  }
  let posInd = "suicide";
  function renderPositions() {
    const ind = data.indicators.find(i => i.id === posInd), year = refYear(ind);
    const rows = Object.entries(ind.series).filter(([, s]) => s[year] != null)
      .map(([iso, s]) => ({ key: iso, label: name[iso], value: s[year], note: ind.notes?.[iso] }))
      .sort((a, b) => ind.direction === "lower_better" ? a.value - b.value : b.value - a.value);
    $("pos-title").textContent = `${ind.title}, ${year}`;
    $("pos-sub").textContent = `${ind.unit} · ${DIR[ind.direction]} · best first`;
    $("pos-link").href = `dashboard.html?ind=${ind.id}`;
    $("pos-notes").innerHTML = notesBlock(rows.filter(r => r.note).map(r => ({ label: r.label, note: r.note })));
    bars($("pos-chart"), rows, { digits: 1, unit: ind.unit, color: "--series-1", aria: `${ind.title} by country, ${year}`,
      onPick: iso => { location.href = `dashboard.html?ind=${ind.id}&c=${iso}`; } });
  }
  indicatorTabs($("pos-tabs"), data.indicators, posInd,
    ind => `${ind.unit.split(", ")[0]} · ${refYear(ind)}`, id => { posInd = id; renderPositions(); });

  renderTrend();
  renderPositions();
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { renderTrend(); renderPositions(); }, 150); });
})();
