/* Shared header and footer, injected into #site-header and #site-footer so the pages stay in step. */
(function () {
  const pages = [
    ["index.html", "Overview"],
    ["dashboard.html", "Dashboard"],
    ["methodology.html", "Methodology"],
    ["data.html", "Data & sources"],
    ["about.html", "About"],
  ];
  const here = location.pathname.split("/").pop() || "index.html";

  async function inline(url) {
    try { return await (await fetch(url)).text(); } catch { return ""; }
  }

  async function render() {
    const markSvg = await inline("assets/brand/paracelsus-mark.svg");
    const h = document.getElementById("site-header");
    if (h) {
      h.outerHTML = `
      <div class="status"><div class="wrap"><strong>Preview</strong><span>Version 2 is in development. Indicator data below comes from open sources; no index scores or rankings have been calculated yet.</span></div></div>
      <header class="site-header"><div class="wrap">
        <nav class="nav" id="nav" aria-label="Main">${pages.map(([href, label]) =>
          `<a href="${href}"${href === here ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>
        <a class="brand" href="index.html" aria-label="Global Mental Health Index, home">${markSvg}<span>Global Mental Health Index</span></a>
        <a class="btn header-cta" href="dashboard.html">Explore the data</a>
        <button class="menu-btn" aria-expanded="false" aria-controls="nav" aria-label="Menu">
          <svg width="24" height="24" viewBox="0 0 24 24"><path d="M3 18H21V16H3V18ZM3 13H21V11H3V13ZM3 6V8H21V6H3Z" fill="currentColor"/></svg>
        </button>
      </div></header>`;
      const btn = document.querySelector(".menu-btn"), nav = document.getElementById("nav");
      btn.addEventListener("click", () => { const o = nav.classList.toggle("open"); btn.setAttribute("aria-expanded", o); });
    }
    const f = document.getElementById("site-footer");
    if (f) {
      f.outerHTML = `
      <footer class="site-footer"><div class="wrap">
        <div class="statement">
          <p>An open, reproducible measure of mental health across countries, built from official public data.</p>
          ${markSvg}
        </div>
        <div class="cols">
          <div>
            <p class="lead">A research initiative of Paracelsus Recovery</p>
            <address>Paracelsus Recovery<br>Utoquai 43 | 8008 Zurich<br>Switzerland</address>
            <div class="pills">
              <a href="https://paracelsus-recovery.com/" rel="noopener">Paracelsus Recovery</a>
              <a href="data/site.json">Download data</a>
              <a href="methodology.html">Methodology</a>
            </div>
          </div>
          <div><h4>Index</h4><ul>${pages.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join("")}</ul></div>
          <div><h4>Data</h4><ul>
            <li><a href="dashboard.html">Indicators</a></li>
            <li><a href="data.html#coverage">Coverage</a></li>
            <li><a href="data.html#licences">Licence register</a></li>
            <li><a href="data/site.json">Dataset (JSON)</a></li>
          </ul></div>
          <div><h4>Sources</h4><ul>
            <li><a href="https://ec.europa.eu/eurostat" rel="noopener">Eurostat</a></li>
            <li><a href="https://www.cdc.gov/nchs/" rel="noopener">CDC / NCHS</a></li>
            <li><a href="data.html#sources">All sources</a></li>
          </ul></div>
        </div>
        <div class="legal">
          <span>© ${new Date().getFullYear()} PRC Group AG</span>
          <span>Indicator data: Eurostat (CC BY 4.0) and US CDC/NCHS (public domain). Population statistics, not medical advice.</span>
        </div>
      </div></footer>`;
    }
  }
  render();
})();
