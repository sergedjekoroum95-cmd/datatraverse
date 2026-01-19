const API_BASE_URL = "http://localhost:3000/api"; // <- change si besoin
const USE_API = false; // ✅ Mets true si ton API marche (GET/POST/PUT/DELETE)

const tbody = document.getElementById("tbody");
const form = document.getElementById("hospitalForm");
const resetBtn = document.getElementById("resetBtn");
const refreshBtn = document.getElementById("refreshBtn");
const searchInput = document.getElementById("search");

let cache = [];

/** =========================
 *  Local DB (localStorage)
 *  ========================= */
const LS_KEY = "hospitals_db_v1";

function loadLocalDB() {
  const raw = localStorage.getItem(LS_KEY);
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveLocalDB(items) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}
function makeId() {
  return "h_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

/** =========================
 *  Helpers DOM
 *  ========================= */
function qs(id){ return document.getElementById(id); }

function getTeleconsultationValue(){
  const selected = document.querySelector('input[name="teleconsultation"]:checked');
  return selected ? selected.value : "NO";
}

function setTeleconsultationValue(val){
  const v = (val === "YES") ? "YES" : "NO";
  const el = document.querySelector(`input[name="teleconsultation"][value="${v}"]`);
  if(el) el.checked = true;
}

function resetForm(){
  form.reset();
  qs("id").value = "";
  setTeleconsultationValue("NO");
}

function formToPayload(){
  return {
    name: qs("name").value.trim(),
    status: qs("status").value,
    country: qs("country").value.trim(),
    city: qs("city").value.trim(),
    category: qs("category").value,
    speciality: qs("speciality").value.trim(),
    website: qs("website").value.trim(),
    email: qs("email").value.trim(),
    telephone: qs("telephone").value.trim(),
    teleconsultation: getTeleconsultationValue()
  };
}

/** =========================
 *  Rendering
 *  ========================= */
function rowHTML(h){
  const website = h.website ? `<a href="${escapeAttr(h.website)}" target="_blank" rel="noreferrer">Lien</a>` : "—";
  const email = h.email ? `<a href="mailto:${escapeAttr(h.email)}">${escapeHtml(h.email)}</a>` : "—";

  return `
    <tr data-id="${escapeAttr(h.id)}">
      <td>${escapeHtml(h.name || "")}</td>
      <td>${escapeHtml(h.status || "")}</td>
      <td>${escapeHtml(h.country || "")}</td>
      <td>${escapeHtml(h.city || "")}</td>
      <td>${escapeHtml(h.category || "")}</td>
      <td>${escapeHtml(h.speciality || "")}</td>
      <td>${website}</td>
      <td>${email}</td>
      <td>${escapeHtml(h.telephone || "")}</td>
      <td>${escapeHtml(h.teleconsultation || "")}</td>
      <td class="right">
        <button type="button" class="btn" data-action="edit">Modifier</button>
        <button type="button" class="btn danger" data-action="delete">Supprimer</button>
      </td>
    </tr>
  `;
}

function render(list){
  tbody.innerHTML = list.map(rowHTML).join("") || `
    <tr><td colspan="11">Aucune donnée.</td></tr>
  `;
}

function applySearch(){
  const q = (searchInput.value || "").toLowerCase().trim();
  if(!q) return render(cache);
  const filtered = cache.filter(h => JSON.stringify(h).toLowerCase().includes(q));
  render(filtered);
}

/** =========================
 *  Data layer (API ou Local)
 *  ========================= */
async function fetchHospitals(){
  if(USE_API){
    const res = await fetch(`${API_BASE_URL}/hospitals`);
    if(!res.ok) throw new Error("Erreur chargement API");
    const data = await res.json();
    cache = Array.isArray(data) ? data : (data.items || []);
  } else {
    cache = loadLocalDB();
  }
  applySearch();
}

async function createHospital(payload){
  if(USE_API){
    const res = await fetch(`${API_BASE_URL}/hospitals`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error(await res.text().catch(()=> "Erreur POST"));
    return await res.json().catch(()=> payload);
  } else {
    const item = { id: makeId(), ...payload };
    const items = loadLocalDB();
    items.unshift(item);
    saveLocalDB(items);
    return item;
  }
}

async function updateHospital(id, payload){
  if(USE_API){
    const res = await fetch(`${API_BASE_URL}/hospitals/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error(await res.text().catch(()=> "Erreur PUT"));
    return await res.json().catch(()=> ({ id, ...payload }));
  } else {
    const items = loadLocalDB();
    const idx = items.findIndex(x => String(x.id) === String(id));
    if(idx === -1) throw new Error("ID introuvable (local)");
    items[idx] = { ...items[idx], ...payload };
    saveLocalDB(items);
    return items[idx];
  }
}

async function deleteHospital(id){
  if(USE_API){
    const res = await fetch(`${API_BASE_URL}/hospitals/${encodeURIComponent(id)}`, { method: "DELETE" });
    if(!res.ok) throw new Error(await res.text().catch(()=> "Erreur DELETE"));
    return true;
  } else {
    const items = loadLocalDB().filter(x => String(x.id) !== String(id));
    saveLocalDB(items);
    return true;
  }
}

/** =========================
 *  Events
 *  ========================= */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = qs("id").value.trim();
  const payload = formToPayload();

  // ✅ Ajout direct dans la liste après enregistrement
  try{
    if(id){
      const updated = await updateHospital(id, payload);
      cache = cache.map(x => String(x.id) === String(id) ? updated : x);
    } else {
      const created = await createHospital(payload);
      cache = [created, ...cache];
    }

    saveLocalDB(cache); // utile même si USE_API=false (sinon ça écrase rien)
    resetForm();
    applySearch();
  } catch(err){
    console.error(err);
    alert("Erreur enregistrement: " + err.message);
  }
});

resetBtn.addEventListener("click", resetForm);

// ✅ RAFRAICHIR corrigé (bouton actif)
refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Chargement...";
  try{
    await fetchHospitals();
  } catch(err){
    console.error(err);
    alert("Erreur rafraîchissement: " + err.message);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "Rafraîchir";
  }
});

searchInput.addEventListener("input", applySearch);

tbody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if(!btn) return;

  const tr = e.target.closest("tr");
  const id = tr?.dataset?.id;
  const action = btn.dataset.action;
  if(!id) return;

  const item = cache.find(x => String(x.id) === String(id));
  if(!item) return;

  if(action === "edit"){
    qs("id").value = item.id || "";
    qs("name").value = item.name || "";
    qs("status").value = item.status || "";
    qs("country").value = item.country || "";
    qs("city").value = item.city || "";
    qs("category").value = item.category || "HOSPITAL";
    qs("speciality").value = item.speciality || "";
    qs("website").value = item.website || "";
    qs("email").value = item.email || "";
    qs("telephone").value = item.telephone || "";
    setTeleconsultationValue(item.teleconsultation || "NO");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if(action === "delete"){
    if(!confirm("Supprimer cet établissement ?")) return;

    try{
      await deleteHospital(id);
      cache = cache.filter(x => String(x.id) !== String(id));
      saveLocalDB(cache);
      applySearch();
    } catch(err){
      console.error(err);
      alert("Erreur suppression: " + err.message);
    }
  }
});

/** =========================
 *  Security helpers
 *  ========================= */
function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function escapeAttr(str){ return escapeHtml(str).replaceAll("`","&#096;"); }

/** =========================
 *  Init
 *  ========================= */
fetchHospitals().catch(err => {
  console.error(err);
  tbody.innerHTML = `<tr><td colspan="11">Impossible de charger les données.</td></tr>`;
});
