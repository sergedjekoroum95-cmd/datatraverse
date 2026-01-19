/****************************************************
 * CONFIG — REMPLACE ICI
 ****************************************************/
const SUPABASE_URL = "https://XXXX.supabase.co";
const SUPABASE_ANON_KEY = "XXXX";

/****************************************************
 * INIT
 ****************************************************/
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const tbody = document.getElementById("tbody");
const form = document.getElementById("hospitalForm");
const resetBtn = document.getElementById("resetBtn");
const refreshBtn = document.getElementById("refreshBtn");
const searchInput = document.getElementById("search");
const syncStatus = document.getElementById("syncStatus");
const saveBtn = document.getElementById("saveBtn");

let cache = [];

/****************************************************
 * UI helpers
 ****************************************************/
function qs(id){ return document.getElementById(id); }

function setStatus(text, variant){
  syncStatus.textContent = text;
  syncStatus.classList.remove("ok","warn","bad");
  if(variant) syncStatus.classList.add(variant);
}

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
    speciality: qs("speciality").value.trim() || null,
    website: qs("website").value.trim() || null,
    email: qs("email").value.trim() || null,
    telephone: qs("telephone").value.trim() || null,
    teleconsultation: getTeleconsultationValue()
  };
}

/****************************************************
 * Security helpers (anti XSS basique)
 ****************************************************/
function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function escapeAttr(str){ return escapeHtml(str).replaceAll("`","&#096;"); }

/****************************************************
 * Rendering
 ****************************************************/
function rowHTML(h){
  const website = h.website
    ? `<a href="${escapeAttr(h.website)}" target="_blank" rel="noreferrer">Lien</a>`
    : "—";

  const email = h.email
    ? `<a href="mailto:${escapeAttr(h.email)}">${escapeHtml(h.email)}</a>`
    : "—";

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
  tbody.innerHTML = list.map(rowHTML).join("") || `<tr><td colspan="11">Aucune donnée.</td></tr>`;
}

function applySearch(){
  const q = (searchInput.value || "").toLowerCase().trim();
  if(!q) return render(cache);
  const filtered = cache.filter(h => JSON.stringify(h).toLowerCase().includes(q));
  render(filtered);
}

/****************************************************
 * Data (Supabase)
 ****************************************************/
async function fetchHospitals(){
  setStatus("• Synchronisation…", "warn");

  const { data, error } = await supabase
    .from("hospitals")
    .select("*")
    .order("created_at", { ascending: false });

  if(error){
    setStatus("• Erreur de connexion", "bad");
    throw error;
  }

  cache = data || [];
  applySearch();
  setStatus("• Connecté", "ok");
}

/****************************************************
 * Actions (Create / Update / Delete)
 ****************************************************/
async function createHospital(payload){
  const { error } = await supabase.from("hospitals").insert(payload);
  if(error) throw error;
}

async function updateHospital(id, payload){
  const { error } = await supabase.from("hospitals").update(payload).eq("id", id);
  if(error) throw error;
}

async function deleteHospital(id){
  const { error } = await supabase.from("hospitals").delete().eq("id", id);
  if(error) throw error;
}

/****************************************************
 * Events
 ****************************************************/
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = qs("id").value.trim();
  const payload = formToPayload();

  saveBtn.disabled = true;
  saveBtn.textContent = "Enregistrement…";

  try{
    if(!payload.name || !payload.status || !payload.country || !payload.city || !payload.category){
      alert("Veuillez remplir les champs obligatoires.");
      return;
    }

    if(id){
      await updateHospital(id, payload);
    } else {
      await createHospital(payload);
    }

    resetForm();
    await fetchHospitals(); // ✅ recharge DB centrale → synchro multi-users
  } catch(err){
    console.error(err);
    alert("Erreur enregistrement: " + (err.message || err));
    setStatus("• Erreur (voir console)", "bad");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Enregistrer";
  }
});

resetBtn.addEventListener("click", resetForm);

refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Chargement…";
  try{
    await fetchHospitals();
  } catch(err){
    console.error(err);
    alert("Erreur rafraîchissement: " + (err.message || err));
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
      await fetchHospitals();
    } catch(err){
      console.error(err);
      alert("Erreur suppression: " + (err.message || err));
      setStatus("• Erreur suppression", "bad");
    }
  }
});

/****************************************************
 * LIVE SYNC (Realtime)
 * -> Quand n’importe qui modifie la table, tu recharges.
 ****************************************************/
function startRealtime(){
  // Note: nécessite Supabase Realtime activé
  supabase
    .channel("hospitals_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "hospitals" },
      () => {
        // Recharge silencieuse
        fetchHospitals().catch(()=>{});
      }
    )
    .subscribe((status) => {
      // statuses possible: SUBSCRIBED, TIMED_OUT, CHANNEL_ERROR, CLOSED
      if(status === "SUBSCRIBED"){
        setStatus("• Connecté (live)", "ok");
      }
    });
}

/****************************************************
 * INIT
 ****************************************************/
(async function init(){
  setStatus("• Connexion…", "warn");

  // Petit check basique des clés
  if(!SUPABASE_URL.includes("https://") || SUPABASE_ANON_KEY.length < 20){
    setStatus("• Clés Supabase manquantes", "bad");
    tbody.innerHTML = `<tr><td colspan="11">Configure SUPABASE_URL et SUPABASE_ANON_KEY dans app.js</td></tr>`;
    return;
  }

  try{
    await fetchHospitals();
    startRealtime();
  } catch(err){
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="11">Impossible de charger la base. Vérifie Supabase + RLS/Policies.</td></tr>`;
  }
})();
