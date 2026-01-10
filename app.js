const URL = "https://www.opcom.ro/grafice-ip-raportPIP-si-volumTranzactionat/ro";

document.getElementById("test").onclick = async () => {
  const out = document.getElementById("output");
  out.textContent = "Fetching...\n";

  try {
    // STEP 1: GET page
    const res = await fetch(URL, {
      method: "GET",
      credentials: "include" // required for CSRF cookies
    });

    // This line WILL FAIL due to CORS
    const html = await res.text();

    out.textContent += "HTML received\n";

    // STEP 2: Parse HTML
    const doc = new DOMParser().parseFromString(html, "text/html");
    const token = doc.querySelector('input[name="_token"]')?.value;

    out.textContent += "Token: " + token + "\n";

  } catch (err) {
    out.textContent += "ERROR:\n" + err.message;
    console.error(err);
  }
};
