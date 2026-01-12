// ---------- How-to modal ----------
document.getElementById("howToBtn").onclick = () => {
  document.getElementById("howToModal").classList.remove("hidden");
};
document.getElementById("closeHowTo").onclick = () => {
  document.getElementById("howToModal").classList.add("hidden");
};
// click outside to close
document.getElementById("howToModal").addEventListener("click", (e) => {
  if (e.target.id === "howToModal") {
    document.getElementById("howToModal").classList.add("hidden");
  }
});
// ESC to close
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.getElementById("howToModal").classList.add("hidden");
});

// ---------- Generate script ----------
document.getElementById("generate").onclick = async () => {
  const start = document.getElementById("start").value;
  const end = document.getElementById("end").value;

  if (!start || !end) {
    alert("Select start and end dates.");
    return;
  }
  if (start > end) {
    alert("Start date must be <= end date.");
    return;
  }

  const options = {
    normalizeHourly: document.getElementById("normalizeData").checked,

    all: document.getElementById("all").checked,
    price: document.getElementById("price").checked,
    volume: document.getElementById("volume").checked,
    buy: document.getElementById("buy").checked,
    sell: document.getElementById("sell").checked
  };

  const script = buildConsoleScript({ start, end, options });

  const textarea = document.getElementById("output");
  textarea.value = script;
  textarea.focus();
  textarea.select();

  try {
    await navigator.clipboard.writeText(script);
    alert("Script copied to clipboard. Paste it into OPCOM page console.");
  } catch {
    alert("Could not auto-copy. The script is in the box — copy it manually.");
  }
};

function buildConsoleScript({ start, end, options }) {
  const cfg = {
    start,
    end,
    normalizeHourly: !!options.normalizeHourly,
    exportAll: !!options.all,
    exportPrice: !!options.price,
    exportVolume: !!options.volume,
    exportBuy: !!options.buy,
    exportSell: !!options.sell,
    delayMs: 400
  };

  // Everything below becomes the "paste into console" script.
  return `(async () => {
  "use strict";

  // =========================
  // CONFIG (generated)
  // =========================
  const CFG = ${JSON.stringify(cfg, null, 2)};

  // OPCOM endpoint (fixed, safer than location.href)
  const ENDPOINT = "https://www.opcom.ro/grafice-ip-raportPIP-si-volumTranzactionat/ro";

  // =========================
  // Helpers
  // =========================
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Parse Romanian numbers like "2.005,2" -> 2005.2
  function roToNumber(text) {
    if (text == null) return NaN;
    const s = String(text).trim().replace(/\\./g, "").replace(/,/g, ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  // CSV escaping
  function csvCell(v) {
    const s = String(v ?? "");
    if (/[",\\n\\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function downloadCSV(filename, content) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function formatDateLabel(ymd) {
    // Keep it stable: "YYYY-MM-DD"
    return ymd;
  }

  // Date iterator using Y-M-D strings (no timezone bugs)
  function* dateRangeYMD(startYmd, endYmd) {
    let [y, m, d] = startYmd.split("-").map(Number);
    const [ey, em, ed] = endYmd.split("-").map(Number);

    const beforeOrEqual = () =>
      (y < ey) || (y === ey && m < em) || (y === ey && m === em && d <= ed);

    while (beforeOrEqual()) {
      yield { y, m, d, ymd: \`\${y}-\${String(m).padStart(2,"0")}-\${String(d).padStart(2,"0")}\` };

      d++;
      const dim = new Date(y, m, 0).getDate(); // days in month (m is 1-based here)
      if (d > dim) { d = 1; m++; }
      if (m > 12) { m = 1; y++; }
    }
  }

  // =========================
  // UI overlay on OPCOM page
  // =========================
  const overlay = document.createElement("div");
  overlay.style.cssText = [
    "position:fixed",
    "right:12px",
    "bottom:12px",
    "z-index:999999",
    "background:rgba(0,0,0,0.82)",
    "color:#fff",
    "padding:10px 12px",
    "border-radius:10px",
    "font:12px ui-monospace, Menlo, Consolas, monospace",
    "max-width:360px",
    "line-height:1.35"
  ].join(";");

  overlay.innerHTML = "<b>OPCOM export</b><div id='opcom_msg' style='margin-top:6px'>Starting…</div>";
  document.body.appendChild(overlay);

  const msgEl = overlay.querySelector("#opcom_msg");
  const setMsg = (s) => { msgEl.textContent = s; };

  // =========================
  // Token extraction
  // =========================
  const token = document.querySelector('input[name="_token"]')?.value;
  if (!token) {
    setMsg("Token not found. Open the OPCOM page first.");
    throw new Error("CSRF token not found on page.");
  }

  // =========================
  // Fetch & parse one day
  // =========================
  async function fetchDay({ y, m, d, ymd }) {
    const form = new FormData();
    form.append("_token", token);
    form.append("day", String(d));
    form.append("month", String(m));
    form.append("year", String(y));
    form.append("buton", "Refresh");

    const res = await fetch(ENDPOINT, {
      method: "POST",
      body: form,
      credentials: "include"
    });

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const table = doc.querySelector("table.border_table");
    if (!table) return [];

    const trs = Array.from(table.querySelectorAll("tr")).slice(1);

    // Row shape (strings):
    // [Date, Zone, Interval, Price, Volume, Buy, Sell]
    return trs.map(tr => {
      const tds = Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim());
      return [
        formatDateLabel(ymd),
        tds[0] ?? "",
        tds[1] ?? "",
        String(roToNumber(tds[2] ?? "") ?? ""),
        String(roToNumber(tds[3] ?? "") ?? ""),
        String(roToNumber(tds[4] ?? "") ?? ""),
        String(roToNumber(tds[5] ?? "") ?? "")
      ];
    });
  }

  // =========================
  // Normalize 96x15min -> 24 hourly (mean of 4)
  // =========================
  function is15MinData(dayRows) {
    return dayRows.length === 96;
  }

  function normalizeToHourly(dayRows) {
    // Assumes dayRows is 96 rows, ordered by interval 1..96
    const out = [];
    for (let h = 0; h < 24; h++) {
      const slice = dayRows.slice(h * 4, h * 4 + 4);

      const meanAt = (idx) => {
        const nums = slice.map(r => Number(r[idx])).filter(n => Number.isFinite(n));
        if (!nums.length) return "";
        const avg = nums.reduce((a,b) => a + b, 0) / nums.length;
        return avg.toFixed(2);
      };

      out.push([
        slice[0][0],        // Date (YYYY-MM-DD)
        slice[0][1],        // Zone
        String(h + 1),      // Interval (hour)
        meanAt(3),          // Price mean
        meanAt(4),          // Volume mean
        meanAt(5),          // Buy mean
        meanAt(6)           // Sell mean
      ]);
    }
    return out;
  }

  // =========================
  // Collect all days
  // =========================
  const days = Array.from(dateRangeYMD(CFG.start, CFG.end));
  const total = days.length;

  let allRows = [];
  for (let i = 0; i < total; i++) {
    const day = days[i];
    const label = day.ymd;

    setMsg(\`Fetching \${label} (\${i+1}/\${total})…\`);
    console.log(\`[OPCOM] Fetching \${label} (\${i+1}/\${total})\`);

    let dayRows = await fetchDay(day);

    if (CFG.normalizeHourly && is15MinData(dayRows)) {
      console.log(\`[OPCOM] \${label}: 15-min data detected (96) -> normalized to 24 hourly means.\`);
      dayRows = normalizeToHourly(dayRows);
    }

    allRows.push(...dayRows);

    await sleep(CFG.delayMs);
  }

  // =========================
  // Export builders
  // =========================
  function exportAll() {
    const header = ["Date","Zone","Interval","Price","Volume","Buy Volume","Sell Volume"];
    const lines = [header.map(csvCell).join(",")];

    for (const r of allRows) lines.push(r.map(csvCell).join(","));

    downloadCSV("opcom_all.csv", lines.join("\\n"));
  }

  function exportTransposed(filename, colIndex, label) {
    // Group by Date; preserve insertion order from allRows
    const order = [];
    const map = new Map();

    for (const r of allRows) {
      const date = r[0];
      if (!map.has(date)) { map.set(date, []); order.push(date); }
      map.get(date).push(r[colIndex] ?? "");
    }

    // Determine max intervals across all dates (24 or 96)
    let maxLen = 0;
    for (const d of order) maxLen = Math.max(maxLen, map.get(d).length);

    const header = ["Date"];
    for (let i = 1; i <= maxLen; i++) header.push(String(i));

    const lines = [header.map(csvCell).join(",")];
    for (const d of order) {
      const arr = map.get(d);
      const row = [d, ...arr];
      // pad to full width
      while (row.length < header.length) row.push("");
      lines.push(row.map(csvCell).join(","));
    }

    downloadCSV(filename, lines.join("\\n"));
    console.log(\`[OPCOM] Exported \${label}: \${filename}\`);
  }

  // =========================
  // Exports
  // =========================
  setMsg("Exporting CSV…");

  if (CFG.exportAll) exportAll();
  if (CFG.exportPrice)  exportTransposed("opcom_price.csv",  3, "price");
  if (CFG.exportVolume) exportTransposed("opcom_volume.csv", 4, "volume");
  if (CFG.exportBuy)    exportTransposed("opcom_buy.csv",    5, "buy");
  if (CFG.exportSell)   exportTransposed("opcom_sell.csv",   6, "sell");

  setMsg("Done. Check your downloads.");
  console.log("[OPCOM] Done.");

  // auto-hide overlay after a bit
  setTimeout(() => overlay.remove(), 8000);
})();`;
}
