/* Dashboard: indicator explorer, US pulse, coverage matrix. Reads data/site.json (built by build/site_data.py). */
(async function () {
  const { bars, lines, dumbbell, bump, legend, table, fmt, ord, notesBlock, indicatorTabs } = window.GMHI;
  const data = await (await fetch("data/site.json")).json();
  const name = Object.fromEntries(data.jurisdictions.map(j => [j.iso3, j.name]));
  const SLOTS = ["--series-1", "--series-2", "--series-3"];
  const DIR = { lower_better: "Lower is better", higher_better: "Higher is better", context: "Context indicator: no better direction assumed" };
  const $ = id => document.getElementById(id);

  const state = { ind: data.indicators[0].id, picked: new Map(), views: {} };
  // Shareable views: dashboard.html?ind=suicide&c=CHE,DEU
  const params = new URLSearchParams(location.search);
  if (data.indicators.some(i => i.id === params.get("ind"))) state.ind = params.get("ind");
  const fromUrl = (params.get("c") || "").split(",").filter(c => name[c]).slice(0, 3);
  for (const iso of fromUrl.length ? fromUrl : ["CHE", "DEU", "SWE"]) pick(iso);

  // Click on any country in a chart: add it, remove it if already compared, or replace the oldest pick when full
  function toggle(iso) {
    if (state.picked.has(iso)) state.picked.delete(iso);
    else {
      if (state.picked.size >= 3) state.picked.delete(state.picked.keys().next().value);
      pick(iso);
    }
    render();
  }

  function pick(iso) {
    if (state.picked.has(iso) || state.picked.size >= 3) return;
    const used = new Set(state.picked.values());
    state.picked.set(iso, SLOTS.find(s => !used.has(s)));   // colour follows the country, not its position
  }

  // indicator select
  indicatorTabs($("ind"), data.indicators, state.ind, null, id => { state.ind = id; render(); }, false);
  // Same rule as clicking in a chart: when three are picked, the new one replaces the oldest
  $("add").addEventListener("change", e => { const iso = e.target.value; e.target.value = ""; if (iso) toggle(iso); });

  document.querySelectorAll(".toggle").forEach(b => b.addEventListener("click", () => {
    const t = b.dataset.target; state.views[t] = !state.views[t];
    b.textContent = state.views[t] ? "Chart" : "Table"; render();
  }));

  function refYear(ind) {
    // most recent year that at least 75% of the jurisdictions with this indicator report
    const n = Object.keys(ind.series).length, count = {};
    Object.values(ind.series).forEach(s => Object.keys(s).forEach(y => count[y] = (count[y] || 0) + 1));
    const ok = Object.keys(count).filter(y => count[y] >= 0.75 * n).sort();
    return ok.length ? ok[ok.length - 1] : Object.keys(count).sort().pop();
  }

  function digits() { return 1; }

  function render() {
    const ind = data.indicators.find(i => i.id === state.ind);
    const year = refYear(ind), d = digits(ind);

    // pills
    $("cmp").innerHTML = "";
    for (const [iso, slot] of state.picked) {
      const b = document.createElement("button");
      b.className = "pill"; b.setAttribute("aria-pressed", "true");
      b.innerHTML = `<span class="sw" style="--sw:var(${slot})"></span>${name[iso]} <span aria-hidden="true">×</span>`;
      b.title = `Remove ${name[iso]}`;
      b.addEventListener("click", () => { state.picked.delete(iso); render(); });
      $("cmp").appendChild(b);
    }
    const add = $("add");
    add.innerHTML = '<option value="">Choose…</option>';
    add.options[0].text = state.picked.size >= 3 ? "Swap in…" : "Choose…";
    data.jurisdictions.filter(j => !state.picked.has(j.iso3)).forEach(j => {
      const o = new Option(j.name + (ind.series[j.iso3] ? "" : " (no data)"), j.iso3); add.appendChild(o);
    });

    // ranked bars for the reference year
    const rows = Object.entries(ind.series).filter(([, s]) => s[year] != null)
      .map(([iso, s]) => ({ key: iso, label: name[iso], value: s[year], note: ind.notes?.[iso] }))
      .sort((a, b) => b.value - a.value);
    const missing = data.jurisdictions.map(j => j.iso3).filter(iso => !rows.some(r => r.key === iso));
    $("bar-title").textContent = `${ind.title}, ${year}`;
    $("bar-sub").textContent = `${ind.unit} · ${DIR[ind.direction]} · latest year comparable across jurisdictions`;
    const eu = ind.eu27[year];
    const hl = Object.fromEntries(state.picked);
    if (state.views.bar) table($("bar"), ["Jurisdiction", `${year} (${ind.unit})`], rows.map(r => [r.label, fmt(r.value, d)]).concat(eu != null ? [["EU-27", fmt(eu, d)]] : []));
    else bars($("bar"), rows, { highlight: hl, onPick: toggle, ref: eu != null ? { value: eu } : null, digits: d, unit: ind.unit, aria: `${ind.title} by jurisdiction, ${year}` });
    legend($("bar-legend"), [...state.picked].map(([iso, c]) => ({ label: name[iso], color: c })).concat(eu != null ? [{ label: "EU-27 average", color: "--ref", dashed: true }] : []));
    $("bar-source").innerHTML = `Source: Eurostat, <code>${ind.dataset}</code> (CC BY 4.0), updated ${ind.source_updated}. ` +
      (missing.length ? `No ${year} value: ${missing.map(i => name[i]).join(", ")}.` : "");
    $("bar-notes").innerHTML = notesBlock(rows.filter(r => r.note).map(r => ({ label: r.label, note: r.note })));

    // lines for picked countries + EU-27
    const series = [...state.picked].filter(([iso]) => ind.series[iso]).map(([iso, c]) => ({
      key: iso, label: name[iso], color: c, points: Object.entries(ind.series[iso]).map(([y, v]) => [y, v]) }));
    if (Object.keys(ind.eu27).length) series.push({ key: "EU", label: "EU-27", short: "EU-27", color: "--ref", dashed: true, points: Object.entries(ind.eu27) });
    const xs = [...new Set(series.flatMap(s => s.points.map(p => p[0])))].sort();
    // keep long histories readable: from 2000 on
    const xsShown = xs.filter(y => +y >= 2000);
    $("line-title").textContent = `${ind.title} over time`;
    $("line-sub").textContent = ind.unit;
    if (state.views.line) table($("line"), ["Year", ...series.map(s => s.label)], xsShown.slice().reverse().map(y => [y, ...series.map(s => fmt(Object.fromEntries(s.points)[y], d))]));
    else lines($("line"), series, { xs: xsShown, digits: d, aria: `${ind.title} over time` });
    legend($("line-legend"), series.map(s => ({ label: s.label, color: s.color, dashed: s.dashed })));
    const noData = [...state.picked.keys()].filter(iso => !ind.series[iso]);
    $("ind-note").textContent = ind.note + (noData.length ? ` No data for ${noData.map(i => name[i]).join(", ")}.` : "");

    renderCards(ind, year, d);
    renderPositions(ind, year);
    renderPulse();
  }

  // "Your comparison": latest value, position (best first) and change over about five years for each picked country
  const natl = Object.fromEntries(nationalRows().map(r => [r.iso3, r]));
  function renderCards(ind, year, d) {
    const ranked = Object.entries(ind.series).filter(([, s]) => s[year] != null)
      .sort((a, b) => ind.direction === "lower_better" ? a[1][year] - b[1][year] : b[1][year] - a[1][year]).map(([k]) => k);
    $("cmp-sub").textContent = ind.direction === "context" ? `${ind.unit} · ${year} · position by value` : `${ind.unit} · ${year} · position best first`;
    $("cmp-cards").innerHTML = [...state.picked].map(([iso, c]) => {
      const s = ind.series[iso];
      if (!s) return `<div class="cmp-card"><i style="--c:var(${c})"></i><div class="n">${name[iso]}</div><div class="l">No data for this indicator</div></div>`;
      const ys = Object.keys(s).sort(), last = s[year] != null ? year : ys[ys.length - 1];
      const past = ys.filter(y => +y <= +last - 5).pop() || ys[0];
      const delta = s[last] - s[past];
      const better = ind.direction === "lower_better" ? delta < 0 : ind.direction === "higher_better" ? delta > 0 : null;
      const pos = ranked.indexOf(iso);
      return `<div class="cmp-card"><i style="--c:var(${c})"></i><div class="n">${name[iso]}${ind.notes?.[iso] ? " *" : ""}</div>` +
        `<div class="v">${fmt(s[last], d)}</div><div class="l">${last}${pos >= 0 && last === year ? ` · ${ord(pos + 1)} of ${ranked.length}` : ""}</div>` +
        (natl[iso] && ind.id === "suicide" ? `<div class="l">${natl[iso].area ? natl[iso].area + " " : "National "}${natl[iso].year}: ${natl[iso].deaths != null ? fmt(natl[iso].deaths, 0) + " deaths" : fmt(natl[iso].rate, 1) + " per 100,000"}</div>` : "") +
        (past !== last ? `<div class="d ${better === null ? "" : better ? "up" : "down"}">${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${fmt(Math.abs(delta), d)} since ${past}</div>` : "") + `</div>`;
    }).join("") || '<p class="muted small">Pick up to three countries above or in the charts.</p>';
  }

  function goodYears(ind) {
    const n = Object.keys(ind.series).length, count = {};
    Object.values(ind.series).forEach(s => Object.keys(s).forEach(y => count[y] = (count[y] || 0) + 1));
    return Object.keys(count).filter(y => count[y] >= 0.75 * n).sort();
  }

  // competition ranking (1, 2, 2, 4) among the given countries, best first by the indicator's direction
  function rankYear(ind, year, keys) {
    const vals = keys.filter(k => ind.series[k]?.[year] != null).map(k => [k, ind.series[k][year]]);
    vals.sort((a, b) => ind.direction === "lower_better" ? a[1] - b[1] : b[1] - a[1]);
    const out = {};
    vals.forEach(([k, v], i) => { out[k] = i && v === vals[i - 1][1] ? out[vals[i - 1][0]] : i + 1; });
    return out;
  }

  function renderPositions(ind, to) {
    const years = goodYears(ind).filter(y => y <= to);
    const from = years.find(y => +y >= +to - 10 && y !== to) || years.filter(y => y !== to)[0];
    const best = { suicide: "lowest rate", depression: "lowest share", psychiatrists: "most per 100,000", psy_beds: "most per 100,000",
      life_sat: "highest rating", poor_support: "lowest share" }[ind.id] || (ind.direction === "lower_better" ? "lowest value" : "highest value");
    $("pos-title").textContent = `How positions have changed: ${ind.title.toLowerCase()}`;
    if (!from) {
      $("db-title").textContent = "Only one year of comparable data";
      $("db-sub").textContent = ""; $("db").innerHTML = '<div class="empty">Positions can be compared once a second year is published.</div>';
      $("bump").innerHTML = ""; $("db-legend").innerHTML = ""; $("bump-legend").innerHTML = ""; return;
    }
    const keys = Object.keys(ind.series).filter(k => ind.series[k][from] != null && ind.series[k][to] != null);
    const rf = rankYear(ind, from, keys), rt = rankYear(ind, to, keys);
    const rows = keys.map(k => ({ key: k, label: name[k], from: rf[k], to: rt[k], fromV: ind.series[k][from], toV: ind.series[k][to], note: ind.notes?.[k] }));
    const neutral = ind.direction === "context";
    $("db-title").textContent = `${from} → ${to}`;
    $("db-sub").textContent = `1st = ${best}, among the ${keys.length} jurisdictions with data in both years` + (neutral ? " · context indicator, no better direction" : "");
    const hl = Object.fromEntries(state.picked);
    if (state.views.db) table($("db"), ["Jurisdiction", `${to}`, `${from}`, "Change"], rows.sort((a, b) => a.to - b.to).map(r => [r.label, ord(r.to), ord(r.from), r.from === r.to ? "=" : (r.from > r.to ? "▲ " : "▼ ") + Math.abs(r.from - r.to)]));
    else dumbbell($("db"), rows, { fromYear: from, toYear: to, highlight: hl, onPick: toggle, neutral, digits: 1, aria: `${ind.title}: positions in ${from} and ${to}` });
    $("db-legend").innerHTML = `<span><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="var(--ink-3)" stroke-width="2"/></svg>${from}</span>` +
      `<span><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="6" fill="var(--ink)"/></svg>${to}</span>` +
      (neutral ? "" : `<span><b style="color:var(--good)">▲</b>&nbsp;moved up</span><span><b style="color:var(--bad)">▼</b>&nbsp;moved down</span>`);
    $("db-notes").innerHTML = notesBlock(keys.filter(k => ind.notes?.[k]).map(k => ({ label: name[k], note: ind.notes[k] })));

    const span = years.filter(y => y >= from);
    const ranks = {}; keys.forEach(k => ranks[k] = {});
    span.forEach(y => { const r = rankYear(ind, y, keys); Object.entries(r).forEach(([k, v]) => ranks[k][y] = v); });
    $("bump-sub").textContent = `${span[0]}–${span.at(-1)}, same ${keys.length} jurisdictions · your comparison countries highlighted`;
    bump($("bump"), span, ranks, name, { highlight: hl, onPick: toggle, height: Math.max(360, keys.length * 22 + 42), aria: `${ind.title}: position each year` });
    const missing = [...state.picked.keys()].filter(k => !keys.includes(k));
    $("bump-legend").innerHTML = [...state.picked].filter(([k]) => keys.includes(k)).map(([k, c]) => `<span><i style="--c:var(${c})"></i>${name[k]}</span>`).join("") +
      `<span><i style="--c:var(--bar-rest)"></i>Other jurisdictions</span>` + (missing.length ? `<span>No ${from}/${to} pair: ${missing.map(k => name[k]).join(", ")}</span>` : "");
  }

  // Latest national figures (not comparable across countries; shown as published)
  function nationalRows() {
    const rows = (data.national || []).slice();
    const us = data.us_suicide, ys = Object.keys(us.series).sort(), y = ys[ys.length - 1];
    rows.push({ iso3: "USA", year: y, deaths: null, rate: us.series[y], rate_type: "age-adjusted (2000 US standard)",
      source: us.source, licence: us.licence, dataset: us.datasets.join(", ") });
    return rows.sort((a, b) => (a.area || name[a.iso3]).localeCompare(b.area || name[b.iso3]));
  }
  function renderNational() {
    const eurostatYear = refYear(data.indicators.find(i => i.id === "suicide"));
    const rows = nationalRows();
    const suicide = data.indicators.find(i => i.id === "suicide");
    // Short label for the rate type; only call it the European standard when the source says so
    const kind = t => !/standard|adjusted/i.test(t) ? (/derived/i.test(t) ? "crude (calculated)" : /crude/i.test(t) ? "crude" : "–")
      : t.split(" (")[0] + (/US/.test(t) ? " (US standard)" : /ESP|European|Eurostat/i.test(t.split(/;\s*not /i)[0]) ? " (European standard)" : " (national standard)");
    $("natl").innerHTML = `<thead><tr><th>Country</th><th class="n">Year</th><th class="n">Deaths</th><th class="n">Rate per 100,000</th><th>Rate type</th><th>Source</th></tr></thead><tbody>${
      rows.map(r => `<tr><td>${r.area || name[r.iso3]}${suicide.notes?.[r.iso3] ? " *" : ""}</td><td class="n">${r.year}${+r.year > +eurostatYear ? ' <span class="tag ok">newer</span>' : ""}</td>` +
        `<td class="n">${r.deaths != null ? fmt(r.deaths, 0) : "–"}</td><td class="n">${r.rate != null ? fmt(r.rate, 1) : "–"}</td>` +
        `<td>${r.rate != null ? kind(r.rate_type) : "–"}</td><td class="muted">${r.source} (${r.licence})</td></tr>`).join("")}</tbody>`;
    $("natl-notes").innerHTML = notesBlock(rows.filter(r => suicide.notes?.[r.iso3]).map(r => ({ label: name[r.iso3], note: suicide.notes[r.iso3] })));
  }

  function renderPulse() {
    const p = data.pulse;
    const monthFmt = m => new Date(m + "-01T00:00:00").toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    const monthName = n => new Date(2000, n - 1, 1).toLocaleDateString("en-GB", { month: "long" });

    // Sweden: 12-month rolling suicide deaths, and this year so far against the same months last year
    const se = p.sweden, y = se.ytd;
    const diff = y.current - y.previous;
    $("se-ytd").innerHTML = `<span class="v">${fmt(y.current, 0)}</span><span class="l">deaths, January–${monthName(y.months)} ${y.year}<br>` +
      `${fmt(y.previous, 0)} in the same months of ${y.year - 1} (${diff >= 0 ? "+" : "−"}${fmt(Math.abs(diff), 0)})</span><span class="tag warn">Provisional</span>`;
    const seSeries = [{ key: "se", label: "Sweden, 12-month total", short: "Sweden", color: "--series-1", points: se.rolling }];
    if (state.views["pulse-se"]) table($("pulse-se"), ["Month", "Deaths that month", "12-month total"],
      se.months.slice().reverse().map(([m, v]) => [monthFmt(m), fmt(v, 0), fmt(Object.fromEntries(se.rolling)[m], 0)]));
    else lines($("pulse-se"), seSeries, { digits: 0, endLabels: false, xFmt: monthFmt, height: 240, aria: "Sweden suicide deaths, 12 months ending each month" });
    $("se-source").innerHTML = `Source: ${se.source} (${se.licence}), <code>${se.dataset}</code>. Latest month ${monthFmt(se.latest)}; fetched ${se.fetched.slice(0, 10)}.`;

    const rates = [
      { key: "s", label: "Suicide", color: "--series-1", points: p.suicide.points },
      { key: "o", label: "Drug overdose", color: "--series-2", points: p.overdose_rate.points },
    ];
    if (state.views["pulse-rates"]) {
      const xs = [...new Set(rates.flatMap(s => s.points.map(q => q[0])))].sort().reverse();
      table($("pulse-rates"), ["12 months ending", "Suicide", "Drug overdose"], xs.map(x => [x, ...rates.map(s => fmt(Object.fromEntries(s.points)[x], 1))]));
    } else lines($("pulse-rates"), rates, { digits: 1, aria: "US suicide and overdose death rates" });
    legend($("pulse-rates-legend"), rates);

    const od = [{ key: "od", label: "Overdose deaths", short: "Deaths", color: "--series-2", points: p.overdose_deaths.points }];
    if (state.views["pulse-od"]) table($("pulse-od"), ["12 months ending", "Deaths"], od[0].points.slice().reverse().map(([m, v]) => [monthFmt(m), fmt(v, 0)]));
    else lines($("pulse-od"), od, { digits: 0, endLabels: false, xFmt: monthFmt, yFmt: v => (v / 1000).toLocaleString("en-GB") + "k", aria: "US drug overdose deaths, 12 months ending each month" });
    $("pulse-source").innerHTML = `Source: ${p.source} (${p.licence}), datasets <code>489q-934x</code> and <code>xkb8-kh2a</code>. Fetched ${p.fetched.slice(0, 10)}. Latest quarter with published rates: ${p.suicide.points.at(-1)[0]}.`;
  }

  renderNational();
  render();
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(render, 150); });
})();
