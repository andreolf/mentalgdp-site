/* Small SVG chart kit for the index site: ranked bars and line charts with hover tooltips.
   Colours come from CSS custom properties (--series-1..3, --bar-rest, --grid, --axis, --ref), so themes swap in CSS. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };
  const fmt = (v, d = 1) => (v == null || isNaN(v) ? "–" : Number(v).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }));

  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }
  function niceStep(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }
  function ticks(min, max, n = 4) {
    const step = niceStep((max - min) / n);
    const out = [];
    for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) out.push(+t.toFixed(10));
    return out;
  }

  function tooltip(container) {
    let t = container.querySelector(".tooltip");
    if (!t) { t = document.createElement("div"); t.className = "tooltip"; t.setAttribute("role", "status"); container.appendChild(t); }
    return {
      show(html, x, y) { t.innerHTML = html; t.style.left = x + "px"; t.style.top = y + "px"; t.classList.add("on"); },
      hide() { t.classList.remove("on"); },
    };
  }

  /* Horizontal ranked bars. rows: [{key, label, value, note}], opts: {highlight: {key: cssVar}, ref: {value, label}, digits, unit} */
  function bars(container, rows, opts = {}) {
    container.innerHTML = "";
    if (!rows.length) { container.innerHTML = '<div class="empty">No data for this selection.</div>'; return; }
    const d = opts.digits ?? 1;
    const W = Math.max(320, container.clientWidth || 600);
    const narrow = W < 520;
    const labelW = narrow ? 92 : 132, valueW = 52, rowH = 22, gap = 2, top = 24, bottom = 8;
    const H = top + rows.length * (rowH + gap) + bottom;
    const max = niceMax(Math.max(...rows.map(r => r.value), opts.ref?.value ?? 0));
    const x0 = labelW, x1 = W - valueW;
    const sx = v => x0 + (v / max) * (x1 - x0);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opts.aria || "Ranked bar chart" }, container);

    for (const t of ticks(0, max, narrow ? 3 : 4)) {
      el("line", { x1: sx(t), x2: sx(t), y1: top - 6, y2: H - bottom, stroke: "var(--grid)", "stroke-width": 1 }, svg);
      el("text", { x: sx(t), y: top - 10, "text-anchor": "middle" }, svg).textContent = fmt(t, t % 1 ? 1 : 0);
    }
    const tip = tooltip(container);
    rows.forEach((r, i) => {
      const y = top + i * (rowH + gap);
      const hl = opts.highlight?.[r.key];
      const g = el("g", { tabindex: 0, role: "listitem", "aria-label": `${r.label}: ${fmt(r.value, d)} ${opts.unit || ""}${r.note ? ", " + r.note : ""}` }, svg);
      el("rect", { x: 0, y, width: W, height: rowH + gap, fill: "transparent" }, g);
      const w = Math.max(1, sx(r.value) - x0);
      // 4px rounded data end, square at the baseline
      const h = rowH - 6, by = y + 3, rr = Math.min(4, w);
      const bar = el("path", { d: `M${x0},${by}h${w - rr}a${rr},${rr} 0 0 1 ${rr},${rr}v${h - 2 * rr}a${rr},${rr} 0 0 1 -${rr},${rr}h-${w - rr}z`,
        fill: hl ? `var(${hl})` : `var(${opts.color || "--bar-rest"})` }, g);
      if (!hl) { g.addEventListener("mouseenter", () => bar.setAttribute("fill", "var(--ink-3)")); g.addEventListener("mouseleave", () => bar.setAttribute("fill", `var(${opts.color || "--bar-rest"})`)); }
      const lt = el("text", { x: x0 - 8, y: y + rowH / 2 + 4, "text-anchor": "end", class: hl ? "label-strong" : "" }, g);
      lt.textContent = (r.label.length > (narrow ? 12 : 18) ? r.label.slice(0, narrow ? 11 : 17) + "…" : r.label) + (r.note ? " *" : "");
      el("text", { x: sx(r.value) + 6, y: y + rowH / 2 + 4, class: hl ? "label-strong" : "" }, g).textContent = fmt(r.value, d);
      const show = () => {
        const b = container.getBoundingClientRect(), s = svg.getBoundingClientRect(), k = s.width / W;
        tip.show(`<b>${r.label}</b><br>${fmt(r.value, d)} ${opts.unit || ""}${r.note ? `<br><span style="opacity:.75;white-space:normal;display:inline-block;max-width:260px">* ${r.note}</span>` : ""}${opts.onPick ? `<br><span style="opacity:.7">${hl ? "Click to remove" : "Click to compare"}</span>` : ""}`,
          (sx(r.value) * k) + (s.left - b.left), (y * k) + (s.top - b.top));
      };
      g.addEventListener("mouseenter", show); g.addEventListener("focus", show);
      if (opts.onPick) {
        g.style.cursor = "pointer";
        const pick = () => { tip.hide(); opts.onPick(r.key); };
        g.addEventListener("click", pick);
        g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
      }
      g.addEventListener("mouseleave", tip.hide); g.addEventListener("blur", tip.hide);
    });
    if (opts.ref && opts.ref.value != null) {
      const x = sx(opts.ref.value);
      el("line", { x1: x, x2: x, y1: top - 4, y2: H - bottom, stroke: "var(--ref)", "stroke-width": 1.5, "stroke-dasharray": "4 3" }, svg);
    }
  }

  /* Line chart. series: [{key, label, color (css var), dashed, points: [[xLabel, y]]}]; x is categorical and shared. */
  function lines(container, series, opts = {}) {
    container.innerHTML = "";
    const all = series.flatMap(s => s.points);
    if (!all.length) { container.innerHTML = '<div class="empty">No data for this selection.</div>'; return; }
    const d = opts.digits ?? 1;
    const xs = opts.xs || [...new Set(all.map(p => p[0]))].sort();
    const W = Math.max(320, container.clientWidth || 600), H = opts.height || 300;
    const narrow = W < 520;
    const left = 44, right = narrow ? 16 : (opts.endLabels === false ? 16 : 92), top = 16, bottom = 28;
    let lo = Math.min(...all.map(p => p[1])), hi = Math.max(...all.map(p => p[1]));
    if (opts.zero) { lo = Math.min(0, lo); hi = niceMax(hi); }
    else {
      // fit the range to the data with a nice step, so trends are readable
      const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.1 || 1;
      const step = niceStep((hi - lo + 2 * pad) / 4);
      lo = Math.floor((lo - pad) / step) * step; hi = Math.ceil((hi + pad) / step) * step;
      if (lo < 0 && Math.min(...all.map(p => p[1])) >= 0) lo = 0;
    }
    const sx = i => left + (xs.length === 1 ? (W - left - right) / 2 : (i / (xs.length - 1)) * (W - left - right));
    const sy = v => top + (1 - (v - lo) / (hi - lo || 1)) * (H - top - bottom);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opts.aria || "Line chart" }, container);

    for (const t of ticks(lo, hi, 4)) {
      el("line", { x1: left, x2: W - right, y1: sy(t), y2: sy(t), stroke: "var(--grid)", "stroke-width": 1 }, svg);
      el("text", { x: left - 8, y: sy(t) + 4, "text-anchor": "end" }, svg).textContent = opts.yFmt ? opts.yFmt(t) : fmt(t, t % 1 ? 1 : 0);
    }
    el("line", { x1: left, x2: W - right, y1: sy(lo), y2: sy(lo), stroke: "var(--axis)", "stroke-width": 1 }, svg);
    const every = Math.ceil(xs.length / (narrow ? 4 : 8));
    xs.forEach((x, i) => {
      if (i % every && i !== xs.length - 1) return;
      el("text", { x: sx(i), y: H - 8, "text-anchor": i === 0 ? "start" : i === xs.length - 1 ? "end" : "middle" }, svg).textContent = opts.xFmt ? opts.xFmt(x) : x;
    });

    const idx = new Map(xs.map((x, i) => [x, i]));
    const ends = [];
    series.forEach(s => {
      const pts = s.points.filter(p => idx.has(p[0])).sort((a, b) => idx.get(a[0]) - idx.get(b[0]));
      if (!pts.length) return;
      // break the line where years are missing, so gaps stay visible
      let dstr = "", prev = -2;
      pts.forEach(p => { const i = idx.get(p[0]); dstr += (i === prev + 1 ? "L" : "M") + sx(i) + "," + sy(p[1]); prev = i; });
      el("path", { d: dstr, fill: "none", stroke: `var(${s.color})`, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round", ...(s.dashed ? { "stroke-dasharray": "5 4" } : {}) }, svg);
      pts.forEach(p => {
        const i = idx.get(p[0]);
        const lonely = !pts.some(q => Math.abs(idx.get(q[0]) - i) === 1);
        if (lonely || pts.length <= 12) el("circle", { cx: sx(i), cy: sy(p[1]), r: lonely ? 4 : 2.5, fill: `var(${s.color})`, stroke: "var(--card)", "stroke-width": 2 }, svg);
      });
      const last = pts[pts.length - 1];
      ends.push({ y: sy(last[1]), x: sx(idx.get(last[0])), s });
    });
    // direct end labels (series ≤ 4), nudged apart
    if (!narrow && opts.endLabels !== false && series.length <= 4) {
      ends.sort((a, b) => a.y - b.y);
      for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
      ends.forEach(e => { el("text", { x: e.x + 8, y: e.y + 4, class: "label-strong" }, svg).textContent = e.s.short || e.s.label; });
    }

    // crosshair + tooltip
    const tip = tooltip(container);
    const cross = el("line", { y1: top, y2: H - bottom, stroke: "var(--axis)", "stroke-width": 1, visibility: "hidden" }, svg);
    const hit = el("rect", { x: left, y: top, width: W - left - right, height: H - top - bottom, fill: "transparent" }, svg);
    const lookup = series.map(s => new Map(s.points));
    const move = ev => {
      const s = svg.getBoundingClientRect(), k = s.width / W;
      const px = (ev.clientX - s.left) / k;
      const i = Math.max(0, Math.min(xs.length - 1, Math.round(((px - left) / (W - left - right)) * (xs.length - 1))));
      const x = xs[i];
      const rowsH = series.map((se, j) => lookup[j].has(x) ? `<div class="row"><span class="sw" style="background:var(${se.color})"></span>${se.label}: <b>${fmt(lookup[j].get(x), d)}</b></div>` : "").join("");
      if (!rowsH) { tip.hide(); cross.setAttribute("visibility", "hidden"); return; }
      cross.setAttribute("x1", sx(i)); cross.setAttribute("x2", sx(i)); cross.setAttribute("visibility", "visible");
      const b = container.getBoundingClientRect();
      tip.show(`<b>${opts.xFmt ? opts.xFmt(x) : x}</b>${rowsH}`, sx(i) * k + (s.left - b.left), top * k + (s.top - b.top) + 10);
    };
    hit.addEventListener("mousemove", move);
    hit.addEventListener("mouseleave", () => { tip.hide(); cross.setAttribute("visibility", "hidden"); });
  }

  const ord = n => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || "th");

  /* Dumbbell of positions: rows [{key, label, from, to, fromV, toV}], ranks 1..n. Sorted by `to`.
     opts: {fromYear, toYear, highlight: {key: cssVar}, neutral (no better/worse), unit, digits} */
  function dumbbell(container, rows, opts = {}) {
    container.innerHTML = "";
    if (!rows.length) { container.innerHTML = '<div class="empty">Not enough years to compare positions.</div>'; return; }
    const n = rows.length, d = opts.digits ?? 1;
    const W = Math.max(320, container.clientWidth || 600), narrow = W < 520;
    const rankW = 26, labelW = narrow ? 86 : 124, deltaW = 54, rowH = 24, top = 26, bottom = 8;
    const H = top + n * rowH + bottom;
    const x0 = rankW + labelW + 10, x1 = W - deltaW;
    const sx = r => x0 + ((r - 1) / Math.max(1, n - 1)) * (x1 - x0);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opts.aria || "Change in position" }, container);
    for (const r of [1, ...ticks(0, n, narrow ? 3 : 5).filter(t => t >= 5), n].filter((v, i, a) => a.indexOf(v) === i && v <= n)) {
      el("line", { x1: sx(r), x2: sx(r), y1: top - 6, y2: H - bottom, stroke: "var(--grid)", "stroke-width": 1 }, svg);
      el("text", { x: sx(r), y: top - 10, "text-anchor": "middle" }, svg).textContent = ord(r);
    }
    const tip = tooltip(container);
    rows.sort((a, b) => a.to - b.to).forEach((r, i) => {
      const y = top + i * rowH + rowH / 2, hl = opts.highlight?.[r.key];
      const g = el("g", { tabindex: 0, role: "listitem",
        "aria-label": `${r.label}: ${ord(r.from)} in ${opts.fromYear}, ${ord(r.to)} in ${opts.toYear}` }, svg);
      el("rect", { x: 0, y: y - rowH / 2, width: W, height: rowH, fill: "transparent" }, g);
      el("line", { x1: 0, x2: W, y1: y + rowH / 2, y2: y + rowH / 2, stroke: "var(--grid)", "stroke-width": .5, "stroke-dasharray": "2 3" }, g);
      el("text", { x: rankW - 4, y: y + 4, "text-anchor": "end", class: "label-strong" }, g).textContent = r.to;
      el("text", { x: rankW + 6, y: y + 4, class: hl ? "label-strong" : "" }, g).textContent =
        (r.label.length > (narrow ? 11 : 17) ? r.label.slice(0, narrow ? 10 : 16) + "…" : r.label) + (r.note ? " *" : "");
      el("line", { x1: sx(r.from), x2: sx(r.to), y1: y, y2: y, stroke: hl ? `var(${hl})` : "var(--bar-rest)", "stroke-width": 3, "stroke-linecap": "round", opacity: .55 }, g);
      el("circle", { cx: sx(r.from), cy: y, r: 5, fill: "var(--card)", stroke: hl ? `var(${hl})` : "var(--ink-3)", "stroke-width": 2 }, g);
      el("circle", { cx: sx(r.to), cy: y, r: 6, fill: hl ? `var(${hl})` : "var(--ink)", stroke: "var(--card)", "stroke-width": 2 }, g);
      const delta = r.from - r.to;   // positive = moved up the list
      const dt = el("text", { x: W - deltaW + 10, y: y + 4, class: "label-strong" }, g);
      if (delta === 0) dt.textContent = "=";
      else {
        const a = el("tspan", { fill: opts.neutral ? "var(--ink-3)" : delta > 0 ? "var(--good)" : "var(--bad)" }, dt);
        a.textContent = delta > 0 ? "▲ " : "▼ ";
        el("tspan", {}, dt).textContent = Math.abs(delta);
      }
      const show = () => {
        const b = container.getBoundingClientRect(), s = svg.getBoundingClientRect(), k = s.width / W;
        tip.show(`<b>${r.label}</b><br>${opts.fromYear}: ${ord(r.from)} (${fmt(r.fromV, d)})<br>${opts.toYear}: ${ord(r.to)} (${fmt(r.toV, d)})${r.note ? `<br><span style="opacity:.75;white-space:normal;display:inline-block;max-width:260px">* ${r.note}</span>` : ""}${opts.onPick ? `<br><span style="opacity:.7">${hl ? "Click to remove" : "Click to compare"}</span>` : ""}`,
          sx(r.to) * k + (s.left - b.left), (y - 8) * k + (s.top - b.top));
      };
      g.addEventListener("mouseenter", show); g.addEventListener("focus", show);
      if (opts.onPick) {
        g.style.cursor = "pointer";
        const pick = () => { tip.hide(); opts.onPick(r.key); };
        g.addEventListener("click", pick);
        g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
      }
      g.addEventListener("mouseleave", tip.hide); g.addEventListener("blur", tip.hide);
    });
  }

  /* Bump chart of positions over time. years: [..]; ranks: {key: {year: rank}}; labels: {key: label};
     highlight: {key: cssVar}. Highlighted series get numbered markers, the rest stay as thin context lines. */
  function bump(container, years, ranks, labels, opts = {}) {
    container.innerHTML = "";
    const keys = Object.keys(ranks);
    if (years.length < 2 || !keys.length) { container.innerHTML = '<div class="empty">Not enough years to show a trend in positions.</div>'; return; }
    const n = Math.max(...keys.flatMap(k => Object.values(ranks[k])));
    const W = Math.max(320, container.clientWidth || 600), narrow = W < 420;
    const left = 34, right = narrow ? 14 : 98, top = 14, bottom = 28, H = opts.height || Math.max(320, n * 22 + top + bottom);
    const sx = i => left + (i / (years.length - 1)) * (W - left - right);
    const sy = r => top + ((r - 1) / Math.max(1, n - 1)) * (H - top - bottom);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opts.aria || "Positions over time" }, container);
    for (const r of [1, ...ticks(0, n, 5).filter(t => t >= 5 && t <= n)]) {
      el("line", { x1: left, x2: W - right, y1: sy(r), y2: sy(r), stroke: "var(--grid)", "stroke-width": 1 }, svg);
      el("text", { x: left - 8, y: sy(r) + 4, "text-anchor": "end" }, svg).textContent = ord(r);
    }
    const every = Math.ceil(years.length / (narrow ? 4 : 8));
    years.forEach((y, i) => { const last = i === years.length - 1;
      if ((i % every === 0 && (last || years.length - 1 - i >= every / 2 + .5 || every === 1)) || last)
      el("text", { x: sx(i), y: H - 8, "text-anchor": i === 0 ? "start" : i === years.length - 1 ? "end" : "middle" }, svg).textContent = y; });
    const tip = tooltip(container);
    const pathFor = k => { let d = "", prev = -2; years.forEach((y, i) => { const r = ranks[k][y]; if (r == null) return;
      d += (i === prev + 1 ? "L" : "M") + sx(i) + "," + sy(r); prev = i; }); return d; };
    const hl = opts.highlight || {};
    const order = keys.filter(k => !hl[k]).concat(keys.filter(k => hl[k]));   // highlighted drawn on top
    const ends = [];
    order.forEach(k => {
      const c = hl[k], d = pathFor(k);
      const p = el("path", { d, fill: "none", stroke: c ? `var(${c})` : "var(--bar-rest)", "stroke-width": c ? 2.5 : 1.2, "stroke-linejoin": "round", opacity: c ? 1 : .8 }, svg);
      const hit = el("path", { d, fill: "none", stroke: "transparent", "stroke-width": 12, style: opts.onPick ? "cursor:pointer" : "cursor:default" }, svg);
      if (opts.onPick) hit.addEventListener("click", () => { tip.hide(); opts.onPick(k); });
      hit.addEventListener("mousemove", ev => {
        const s = svg.getBoundingClientRect(), b = container.getBoundingClientRect(), kx = s.width / W;
        const i = Math.max(0, Math.min(years.length - 1, Math.round((((ev.clientX - s.left) / kx) - left) / (W - left - right) * (years.length - 1))));
        const r = ranks[k][years[i]];
        if (!c) { p.setAttribute("stroke", "var(--ink)"); p.setAttribute("stroke-width", 2); p.setAttribute("opacity", 1); }
        tip.show(`<b>${labels[k]}</b><br>${years[i]}: ${r ? ord(r) : "no data"}${opts.onPick ? `<br><span style="opacity:.7">${c ? "Click to remove" : "Click to compare"}</span>` : ""}`, sx(i) * kx + (s.left - b.left), (r ? sy(r) : top) * kx + (s.top - b.top));
      });
      hit.addEventListener("mouseleave", () => { tip.hide(); if (!c) { p.setAttribute("stroke", "var(--bar-rest)"); p.setAttribute("stroke-width", 1.2); p.setAttribute("opacity", .8); } });
      if (c) {
        years.forEach((y, i) => { const r = ranks[k][y]; if (r == null) return;
          el("circle", { cx: sx(i), cy: sy(r), r: narrow ? 6 : 8, fill: `var(${c})`, stroke: "var(--card)", "stroke-width": 1.5 }, svg);
          if (!narrow) el("text", { x: sx(i), y: sy(r) + 3.5, "text-anchor": "middle", style: "fill:#fff;font-size:9.5px;font-weight:500" }, svg).textContent = r; });
        const last = years.map(y => ranks[k][y]).filter(v => v != null).pop();
        if (last != null) ends.push({ y: sy(last), k });
      }
    });
    if (!narrow) {
      ends.sort((a, b) => a.y - b.y);
      for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
      ends.forEach(e => { el("text", { x: W - right + 14, y: e.y + 4, class: "label-strong" }, svg).textContent = labels[e.k]; });
    }
  }

  function legend(container, items) {
    container.innerHTML = items.map(i => `<span><i class="${i.dashed ? "dash" : ""}" style="--c:var(${i.color})"></i>${i.label}</span>`).join("");
  }

  function table(container, head, rows) {
    container.innerHTML = `<div class="table-wrap"><table><thead><tr>${head.map((h, i) => `<th class="${i ? "n" : ""}">${h}</th>`).join("")}</tr></thead><tbody>${
      rows.map(r => `<tr>${r.map((c, i) => `<td class="${i ? "n" : ""}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  /* Country caveats folded into one toggle: [{label, note}] */
  function notesBlock(items) {
    if (!items.length) return "";
    return `<details class="notes"><summary>Notes on ${items.map(i => i.label).join(", ")}</summary><ul>${
      items.map(i => `<li><b>${i.label}.</b> ${i.note}</li>`).join("")}</ul></details>`;
  }

  /* Indicator tabs. inds: site.json indicators; meta(ind) -> short line under the title; onSelect(id) */
  function indicatorTabs(container, inds, current, meta, onSelect, grouped = true) {
    const pillar = { outcomes: "Outcomes", care: "Care", conditions: "Conditions" };
    container.innerHTML = "";
    let last = null;
    for (const ind of inds) {
      if (grouped && ind.pillar !== last) {
        const h = document.createElement("span"); h.className = "tab-group"; h.textContent = pillar[ind.pillar] || ind.pillar;
        container.appendChild(h); last = ind.pillar;
      }
      const b = document.createElement("button");
      b.type = "button"; b.role = "tab"; b.className = "ind-tab";
      b.setAttribute("aria-selected", ind.id === current);
      b.innerHTML = `<span class="t">${ind.title}</span>${meta ? `<span class="m">${meta(ind)}</span>` : ""}`;
      b.addEventListener("click", () => {
        container.querySelectorAll(".ind-tab").forEach(x => x.setAttribute("aria-selected", x === b));
        onSelect(ind.id);
      });
      container.appendChild(b);
    }
  }

  window.GMHI = Object.assign(window.GMHI || {}, { bars, lines, dumbbell, bump, legend, table, fmt, ord, notesBlock, indicatorTabs });
})();
