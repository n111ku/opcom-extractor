const URL = "https://www.opcom.ro/grafice-ip-raportPIP-si-volumTranzactionat/ro";

const iframe = document.getElementById("scrapeFrame");
const progressBar = document.getElementById("progressBar");
const statusDiv = document.getElementById("status");

let token = null;
let collectedRows = [];

/* ------------------------------
   INITIAL LOAD – GET CSRF TOKEN
-------------------------------- */
iframe.src = URL;

iframe.onload = () => {
  const doc = iframe.contentDocument;
  const tokenInput = doc.querySelector('input[name="_token"]');

  if (!tokenInput) {
    alert("Failed to extract CSRF token.");
    return;
  }

  token = tokenInput.value;
  statusDiv.textContent = "Token loaded.";
};

/* ------------------------------
   DATE RANGE HELPER
-------------------------------- */
function* dateRange(start, end) {
  const d = new Date(start);
  while (d <= end) {
    yield new Date(d);
    d.setDate(d.getDate() + 1);
  }
}

/* ------------------------------
   FETCH ONE DAY (POST via iframe)
-------------------------------- */
function fetchDayData(date) {
  return new Promise(resolve => {
    const doc = iframe.contentDocument;

    doc.body.innerHTML = "";

    const form = doc.createElement("form");
    form.method = "POST";
    form.action = URL;

    form.innerHTML = `
      <input name="_token" value="${token}">
      <input name="day" value="${date.getDate()}">
      <input name="month" value="${date.getMonth() + 1}">
      <input name="year" value="${date.getFullYear()}">
      <input name="buton" value="Refresh">
    `;

    doc.body.appendChild(form);

    iframe.onload = () => {
      const page = iframe.contentDocument;
      const table = page.querySelector("table.border_table");

      if (!table) {
        resolve([]);
        return;
      }

      const rows = [...table.querySelectorAll("tr")].slice(1);

      const dayRows = rows.map(row => {
        const cols = [...row.querySelectorAll("td")].map(td =>
          td.innerText
            .trim()
            .replace(/\./g, "")
            .replace(",", ".")
        );

        return [
          date.toDateString(), // Date
          cols[0],              // Zone
          cols[1],              // Interval
          cols[2],              // Price
          cols[3],              // Volume
          cols[4],              // Buy volume
          cols[5]               // Sell volume
        ];
      });

      resolve(dayRows);
    };

    form.submit();
  });
}

/* ------------------------------
   READ DATA BUTTON
-------------------------------- */
document.getElementById("readBtn").onclick = async () => {
  if (!token) {
    alert("Token not ready yet.");
    return;
  }

  const start = new Date(document.getElementById("startDate").value);
  const end = new Date(document.getElementById("endDate").value);

  if (!start || !end || start > end) {
    alert("Invalid date range.");
    return;
  }

  collectedRows = [];
  progressBar.value = 0;

  const dates = [...dateRange(start, end)];
  let completed = 0;

  for (const date of dates) {
    statusDiv.textContent = `Fetching ${date.toDateString()}...`;
    const rows = await fetchDayData(date);
    collectedRows.push(...rows);

    completed++;
    progressBar.value = (completed / dates.length) * 100;
  }

  statusDiv.textContent = "Data loaded.";
};

/* ------------------------------
   CSV HELPERS
-------------------------------- */
function downloadCSV(filename, content) {
  const blob = new Blob([content], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function transposeByColumn(colIndex) {
  const grouped = {};

  collectedRows.forEach(r => {
    const date = r[0];
    grouped[date] ??= [];
    grouped[date].push(r[colIndex]);
  });

  return Object.entries(grouped)
    .map(([date, values]) => [date, ...values].join(","))
    .join("\n");
}

/* ------------------------------
   EXPORT BUTTON
-------------------------------- */
document.getElementById("exportBtn").onclick = () => {
  if (!collectedRows.length) {
    alert("No data to export.");
    return;
  }

  if (document.getElementById("exportAll").checked) {
    const header = "Date,Zone,Interval,Price,Volume,BuyVolume,SellVolume\n";
    const rows = collectedRows.map(r => r.join(",")).join("\n");
    downloadCSV("opcom_all.csv", header + rows);
  }

  if (document.getElementById("exportPrice").checked)
    downloadCSV("opcom_price.csv", transposeByColumn(3));

  if (document.getElementById("exportVolume").checked)
    downloadCSV("opcom_volume.csv", transposeByColumn(4));

  if (document.getElementById("exportBuy").checked)
    downloadCSV("opcom_buy.csv", transposeByColumn(5));

  if (document.getElementById("exportSell").checked)
    downloadCSV("opcom_sell.csv", transposeByColumn(6));
};
