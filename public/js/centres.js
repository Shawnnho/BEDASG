const centresList = document.getElementById("centresList");

async function loadCentres() {
  try {
    const res = await fetch("/api/centres");
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);

    const centres = await res.json();

    for (const centre of centres) {
      const card = document.createElement("a");
      card.className = "centre-card";
      card.href = `centre.html?centreId=${centre.centreId}`;

      card.innerHTML = `
        <div class="centre-img">
          <img src="${centre.imageUrl}" alt="${centre.name}">
        </div>
        <div class="centre-content">
          <h3>${centre.name}</h3>
          <p class="centre-meta">Centre ID: ${centre.centreId}</p>
        </div>
      `;

      centresList.appendChild(card);
    }
  } catch (err) {
    console.error("Error loading centres:", err);
    centresList.innerHTML = "<p>Could not load centres right now.</p>";
  }
}

loadCentres();
