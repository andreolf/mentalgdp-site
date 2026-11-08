/* Topic pages (depression.html, alcohol.html): headline numbers, country by country, who is affected.
   Reads data/site.json (topics block, built by build/site_data.py). Every number on the page comes from that file. */
(async function () {
  const { bars, fmt, ord, indicatorTabs, table } = window.GMHI;
  const TOPIC = document.body.dataset.topic;
  const data = await (await fetch("data/site.json")).json();
  const measures = data.topics[TOPIC];
  const name = Object.fromEntries(data.jurisdictions.map(j => [j.iso3, j.name]));
  const $ = id => document.getElementById(id);
  const EU = "EU27";
  const SHORT = { "F": "Women", "M": "Men", "ED0-2": "Lower secondary or less", "ED3_4": "Upper secondary", "ED5-8": "Degree (tertiary)",
                  "Y_GE75": "75 and over" };
  const shortLabel = b => SHORT[b.code] || b.code.replace(/^Y/, "").replace("-", "–");
  const DIM = { sex: "By sex", age: "By age", isced11: "By education" };

  // most recent year that at least 75% of jurisdictions report (same rule as the dashboard)
  function refYear(m) {
    const n = Object.keys(m.series).length, count = {};
    Object.values(m.series).forEach(s => Object.keys(s).forEach(y => count[y] = (count[y] || 0) + 1));
    const ok = Object.keys(count).filter(y => count[y] >= 0.75 * n).sort();
    return ok.length ? ok[ok.length - 1] : Object.keys(count).sort().pop();
  }
  const valueOf = (obj, geo, year) => geo === EU ? obj.eu27[year] : obj.series[geo]?.[year];
  const geoName = geo => geo === EU ? "the EU" : name[geo];
  const isRate = m => !m.unit.startsWith("%");
  const per = (v, m) => isRate(m) ? `${fmt(v)} per 100,000` : `${fmt(v)}%`;
  const bd = (m, dim, code) => m.breakdowns[dim]?.find(b => b.code === code);

  // ---- headline numbers (EU-27, latest comparable year) ----
  const tiles = {
    depression: [
      ["symptoms", m => `${fmt(m.eu27[refYear(m)])}%`, m => `of people aged 15+ in the EU reported depressive symptoms (${refYear(m)})`],
      ["symptoms", m => `${fmt(bd(m, "sex", "F").eu27[refYear(m)])}%`, m => `of women, against ${fmt(bd(m, "sex", "M").eu27[refYear(m)])}% of men`],
      ["symptoms", m => `${fmt(bd(m, "isced11", "ED0-2").eu27[refYear(m)])}%`, m => `of people who left school earliest, against ${fmt(bd(m, "isced11", "ED5-8").eu27[refYear(m)])}% of graduates`],
      ["chronic", m => `${fmt(m.eu27[refYear(m)])}%`, m => `reported chronic depression in the past year (${refYear(m)})`],
    ],
    alcohol: [
      ["deaths", m => fmt(m.eu27[refYear(m)]), m => `deaths per 100,000 people from alcohol-use disorders in the EU (${refYear(m)})`],
      ["deaths", m => `${fmt(bd(m, "sex", "M").eu27[refYear(m)] / bd(m, "sex", "F").eu27[refYear(m)])}×`, m => `men's death rate compared with women's`],
      ["heavy", m => `${fmt(m.eu27[refYear(m)])}%`, m => `of people aged 15+ drink heavily at least once a week (${refYear(m)})`],
      ["daily", m => `${fmt(m.eu27[refYear(m)])}%`, m => `drink alcohol every day (${refYear(m)})`],
    ],
  }[TOPIC];
  $("tiles").innerHTML = tiles.map(t => {
    const [id, v, l] = t;
    const m = measures.find(x => x.id === id);
    try { return `<div class="stat"><span class="v">${v(m)}</span><span class="l">${l(m)}</span></div>`; } catch { return ""; }
  }).join("");

  // ---- country by country ----
  const state = { m: measures[0].id, geo: EU, view: false };
  const params = new URLSearchParams(location.search);
  if (measures.some(m => m.id === params.get("m"))) state.m = params.get("m");
  if (name[params.get("c")]) state.geo = params.get("c");

  indicatorTabs($("measures"), measures, state.m, null, id => { state.m = id; render(); }, false);
  const sel = $("geo");
  sel.appendChild(new Option("EU average", EU));
  data.jurisdictions.filter(j => measures.some(m => m.series[j.iso3])).forEach(j => sel.appendChild(new Option(j.name, j.iso3)));
  sel.value = state.geo;
  sel.addEventListener("change", () => { state.geo = sel.value; render(); });
  $("view").addEventListener("click", () => { state.view = !state.view; $("view").textContent = state.view ? "Chart" : "Table"; render(); });

  function render() {
    const m = measures.find(x => x.id === state.m), year = refYear(m);
    history.replaceState(null, "", `?m=${m.id}${state.geo !== EU ? "&c=" + state.geo : ""}`);
    const rows = Object.entries(m.series).filter(([, s]) => s[year] != null)
      .map(([iso, s]) => ({ key: iso, label: name[iso], value: s[year] })).sort((a, b) => b.value - a.value);
    const missing = data.jurisdictions.filter(j => !rows.some(r => r.key === j.iso3)).map(j => j.name);

    $("bar-title").textContent = `${m.title}, ${year}`;
    $("bar-sub").textContent = `${m.unit} · lower is better · dashed line: EU average`;
    const hl = state.geo !== EU ? { [state.geo]: "--series-2" } : {};
    if (state.view) table($("bar"), ["Country", m.unit], rows.map(r => [r.label, fmt(r.value)]));
    else bars($("bar"), rows, { highlight: hl, unit: m.unit, ref: { value: m.eu27[year] }, aria: `${m.title} by country, ${year}`,
      onPick: iso => { state.geo = state.geo === iso ? EU : iso; sel.value = state.geo; render(); } });
    $("bar-source").innerHTML = `${m.note} Source: Eurostat <code>${m.dataset}</code> (CC BY 4.0), updated ${m.source_updated}.` +
      (missing.length ? ` No ${year} figure for ${missing.join(", ")}.` : "");

    // plain-language card for the chosen country or the EU
    const v = valueOf(m, state.geo, year), eu = m.eu27[year];
    const years = Object.keys(state.geo === EU ? m.eu27 : m.series[state.geo] || {}).sort();
    const first = years.find(y => y < year);
    const card = $("card");
    if (v == null) { card.innerHTML = `<p class="muted">No ${year} figure for ${geoName(state.geo)} on this measure.</p>`; }
    else {
      const pos = rows.findIndex(r => r.key === state.geo) + 1, n = rows.length;
      const plain = isRate(m)
        ? `In a town of 100,000 people, that is about <b>${Math.round(v)}</b> death${Math.round(v) === 1 ? "" : "s"} a year.`
        : `That is about <b>${Math.round(v)} in every 100</b> people aged 15 and over.`;
      const vsEU = state.geo === EU || eu == null ? "" :
        `<p>${Math.abs(v - eu) < 0.05 ? "The same as" : v < eu ? "Lower than" : "Higher than"} the EU average of ${per(eu, m)}. ` +
        `${pos <= n / 2 ? ord(pos) + " highest" : ord(n - pos + 1) + " lowest"} of ${n} countries with ${year} data (one measure, not an index ranking).</p>`;
      const trend = first ? (() => {
        const v0 = valueOf(m, state.geo, first), d = v - v0;
        return `<p>In ${first} it was ${per(v0, m)}, so it has ${Math.abs(d) < 0.05 ? "stayed about the same" : d < 0 ? "fallen" : "risen"} since.</p>`;
      })() : "";
      card.innerHTML = `<p class="eyebrow">${geoName(state.geo) === "the EU" ? "EU average" : geoName(state.geo)}, ${year}</p>
        <div class="big">${per(v, m)}</div><p class="intro">${plain}</p>${vsEU}${trend}`;
    }

    // who is affected: breakdowns for the chosen country or the EU
    $("who-geo").textContent = geoName(state.geo) === "the EU" ? "the EU as a whole" : geoName(state.geo);
    $("who").innerHTML = "";
    const charts = [];
    for (const [dim, items] of Object.entries(m.breakdowns)) {
      const brows = items.map(b => ({ key: b.code, label: shortLabel(b), value: valueOf(b, state.geo, year) })).filter(r => r.value != null);
      if (!brows.length) continue;
      const panel = document.createElement("div");
      panel.className = "panel";
      panel.innerHTML = `<div class="panel-head"><div><h3>${DIM[dim]}</h3><div class="muted small">${m.title}, ${year}, ${m.unit}</div></div></div><div class="chart"></div>`;
      $("who").appendChild(panel);
      charts.push([panel.querySelector(".chart"), brows, dim]);
    }
    // draw once every panel is in the grid, so each chart is sized to its final column width
    charts.forEach(([c, brows, dim]) => bars(c, brows, { unit: m.unit, color: "--series-1", aria: `${m.title} ${DIM[dim].toLowerCase()}` }));
    if (!$("who").children.length)
      $("who").innerHTML = `<p class="muted">No breakdown available for ${geoName(state.geo)} on this measure.</p>`;
  }
  render();
  let w = innerWidth;
  addEventListener("resize", () => { if (Math.abs(innerWidth - w) > 40) { w = innerWidth; render(); } });
})();
