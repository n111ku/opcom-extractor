document.getElementById("generate").onclick = async () => {
  const start = document.getElementById("start").value;
  const end = document.getElementById("end").value;

  if (!start || !end) {
    alert("Select start and end dates.");
    return;
  }

  const options = {
    all: document.getElementById("all").checked,
    price: document.getElementById("price").checked,
    volume: document.getElementById("volume").checked,
    buy: document.getElementById("buy").checked,
    sell: document.getElementById("sell").checked
  };

  const script = buildConsoleScript(start, end, options);

  const textarea = document.getElementById("output");
  textarea.value = script;
  textarea.select();

  await navigator.clipboard.writeText(script);
  alert("Script copied to clipboard.");
};

function buildConsoleScript(start, end, opt) {
  return `(async () => {
const PAGE_URL = location.href;
const token = document.querySelector('input[name="_token"]')?.value;

if (!token) {
  alert("Token not found. Make sure you're on the OPCOM page.");
  return;
}

function* dateRange(s, e) {
  let d = new Date(s);
  while (d <= e) {
    yield new Date(d);
    d.setDate(d.getDate() + 1);
  }
}

function normalize(v) {
  return v.replace(/\\./g, "").replace(",", ".");
}

async function fetchDay(date) {
  const form = new FormData();
  form.append("_token", token);
  form.append("day", date.getDate());
  form.append("month", date.getMonth() + 1);
  form.append("year", date.getFullYear());
  form.append("buton", "Refresh");

  const res = await fetch(PAGE_URL, {
    method: "POST",
    body: form,
    credentials: "include"
  });

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table.border_table");
  if (!table) return [];

  return [...table.querySelectorAll("tr")].slice(1).map(tr => {
    const tds = [...tr.querySelectorAll("td")].map(td =>
      normalize(td.innerText.trim())
    );
    return [
      date.toDateString(),
      tds[0], tds[1], tds[2], tds[3], tds[4], tds[5]
    ];
  });
}

const start = new Date("${start}");
const end = new Date("${end}");
let allRows = [];
const dates = [...dateRange(start, end)];

for (let i = 0; i < dates.length; i++) {
  console.log(\`Fetching \${dates[i].toDateString()} (\${i+1}/\${dates.length})\`);
  const rows = await fetchDay(dates[i]);
  allRows.push(...rows);
}

function download(name, content) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([content], { type: "text/csv" })
  );
  a.download = name;
  a.click();
}


function transpose(col) {
  const m = {};
  allRows.forEach(r => {
    m[r[0]] ??= [];
    m[r[0]].push(r[col]);
  });
  return Object.entries(m)
    .map(([d,v]) => [d, ...v].join(","))
    .join("\\n");
}

${opt.all ? `
download("opcom_all.csv",
  "Date,Zone,Interval,Price,Volume,Buy,Sell\\n" +
  allRows.map(r => r.join(",")).join("\\n")
);` : ""}

${opt.price ? `download("opcom_price.csv", transpose(3));` : ""}
${opt.volume ? `download("opcom_volume.csv", transpose(4));` : ""}
${opt.buy ? `download("opcom_buy.csv", transpose(5));` : ""}
${opt.sell ? `download("opcom_sell.csv", transpose(6));` : ""}

console.log("Done.");
})();`;
}
