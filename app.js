// ---------- Helpers ----------
function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "bxxxxxxxx".replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function timeToMin(t) {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minToTime(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function isoToDisplay(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// Textfarbe (schwarz/weiß) je nach Helligkeit der Hintergrundfarbe.
function contrastColor(hex) {
  const c = (hex || "").replace("#", "");
  if (c.length !== 6) return "#1e2330";
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1e2330" : "#ffffff";
}

// ---------- Bereich (Platzbelegung / Hallenbelegung) ----------
// Beide Bereiche teilen sich Kategorien und Wochentage, haben aber komplett getrennte
// Orts- und Belegungslisten (eigene Stammdaten, eigenes Meta/Import) — siehe BEREICHE.
const BEREICHE = {
  platz: { ortsKey: "plaetze", belegKey: "belegungen", metaKey: "meta", ortsField: "platz", ortLabel: "Platz", name: "Platzbelegung" },
  halle: { ortsKey: "hallen", belegKey: "hallenbelegungen", metaKey: "hallenMeta", ortsField: "halle", ortLabel: "Halle", name: "Hallenbelegung" }
};
let currentBereich = "platz";
function bcfg() { return BEREICHE[currentBereich]; }

// ---------- State ----------
let appData = { meta: {}, plaetze: [], kategorien: [], belegungen: [], hallenMeta: {}, hallen: [], hallenbelegungen: [], backups: [] };
let currentUser = null;
let currentDay = TAGE[0].id;
let editingBelegungId = null;
let persistTimer = null;
let backupLaeuft = false;

// ---------- Normalisierung & Lookups ----------
function normalizeData(data) {
  const d = data && typeof data === "object" ? data : {};
  return {
    meta: d.meta && typeof d.meta === "object" ? d.meta : {},
    plaetze: Array.isArray(d.plaetze) && d.plaetze.length ? d.plaetze : DEFAULT_PLAETZE.slice(),
    kategorien: Array.isArray(d.kategorien) && d.kategorien.length ? d.kategorien : DEFAULT_KATEGORIEN.slice(),
    belegungen: Array.isArray(d.belegungen) ? d.belegungen : [],
    hallenMeta: d.hallenMeta && typeof d.hallenMeta === "object" ? d.hallenMeta : {},
    hallen: Array.isArray(d.hallen) && d.hallen.length ? d.hallen : DEFAULT_HALLEN.slice(),
    hallenbelegungen: Array.isArray(d.hallenbelegungen) ? d.hallenbelegungen : [],
    // Nur das Verzeichnis der Backups (Zeitpunkt, Kommentar, Anzahl) — die
    // gesicherten Daten selbst liegen je in einer eigenen Datei, siehe db.js.
    backups: Array.isArray(d.backups) ? d.backups : []
  };
}
function ortsListe() { return appData[bcfg().ortsKey]; }
function belegungsListe() { return appData[bcfg().belegKey]; }
function currentMeta() { return appData[bcfg().metaKey] || {}; }
function ortById(id) { return ortsListe().find((p) => p.id === id) || null; }
function kategorieById(id) { return appData.kategorien.find((k) => k.id === id) || null; }
function tagName(id) { const t = TAGE.find((x) => x.id === id); return t ? t.name : id; }
function tagIndex(id) { return TAGE.findIndex((x) => x.id === id); }
function ortIndex(id) { return ortsListe().findIndex((p) => p.id === id); }

// Standorte in Reihenfolge des ersten Auftretens (im aktuellen Bereich).
function standorte() {
  const seen = [];
  ortsListe().forEach((p) => { const s = p.standort || "—"; if (!seen.includes(s)) seen.push(s); });
  return seen;
}

// ---------- Selects befüllen ----------
function fillSelect(el, options, allLabel) {
  if (!el) return;
  const cur = el.value;
  el.innerHTML = (allLabel != null ? `<option value="">${escapeHtml(allLabel)}</option>` : "") +
    options.map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join("");
  if ([...el.options].some((o) => o.value === cur)) el.value = cur;
}

function populateFilters() {
  const stOpts = standorte().map((s) => ({ value: s, label: s }));
  const katOpts = appData.kategorien.map((k) => ({ value: k.id, label: k.name }));
  fillSelect(document.getElementById("gitter-standort"), stOpts, "Alle Standorte");
  fillSelect(document.getElementById("liste-standort"), stOpts, "Alle Standorte");
  fillSelect(document.getElementById("liste-tag"), TAGE.map((t) => ({ value: t.id, label: t.name })), "Alle Tage");
  fillSelect(document.getElementById("liste-kategorie"), katOpts, "Alle Kategorien");
}

// ---------- Tagesumschalter ----------
function renderDaySwitch() {
  const el = document.getElementById("day-switch");
  el.innerHTML = TAGE.map((t) =>
    `<button data-day="${t.id}" class="${t.id === currentDay ? "active" : ""}">${escapeHtml(t.name)}</button>`
  ).join("");
}

// ---------- Legende ----------
function renderLegend() {
  const el = document.getElementById("legend");
  el.innerHTML = appData.kategorien
    .filter((k) => k.id !== "frei")
    .map((k) => `<span class="legend-item"><span class="legend-swatch" style="background:${escapeHtml(k.farbe)}"></span>${escapeHtml(k.name)}</span>`)
    .join("");
}

// ---------- Gitter ----------
let draggedBookingId = null;

function renderGrid() {
  const ortsField = bcfg().ortsField;
  const stf = document.getElementById("gitter-standort").value;
  const orte = ortsListe().filter((p) => !stf || (p.standort || "—") === stf);
  const ortIds = new Set(orte.map((p) => p.id));
  const bookings = belegungsListe().filter((b) => b.tag === currentDay && ortIds.has(b[ortsField]));

  const emptyEl = document.getElementById("gitter-empty");
  const gridEl = document.getElementById("grid");

  if (bookings.length === 0) {
    gridEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  let startMin = Math.min(...bookings.map((b) => timeToMin(b.start)).filter((x) => x != null));
  let endMin = Math.max(...bookings.map((b) => timeToMin(b.ende)).filter((x) => x != null));
  if (!isFinite(startMin)) startMin = timeToMin(DEFAULT_GRID_START);
  if (!isFinite(endMin)) endMin = timeToMin(DEFAULT_GRID_END);
  const slotCount = Math.max(1, Math.round((endMin - startMin) / SLOT_MIN));

  // pro Ort: welche Belegung startet in Slot i, und welche Slots sind überdeckt
  const startMap = {}, covered = {};
  orte.forEach((p) => { startMap[p.id] = {}; covered[p.id] = new Set(); });
  bookings.forEach((b) => {
    const s = timeToMin(b.start), e = timeToMin(b.ende);
    if (s == null || e == null || e <= s) return;
    const si = Math.round((s - startMin) / SLOT_MIN);
    const span = Math.round((e - s) / SLOT_MIN);
    const ortId = b[ortsField];
    if (!startMap[ortId]) return;
    startMap[ortId][si] = { b, span };
    for (let k = si + 1; k < si + span; k++) covered[ortId].add(k);
  });

  let html = '<table class="grid-table"><thead><tr><th class="col-time">Zeit</th>';
  orte.forEach((p) => { html += `<th>${escapeHtml(p.name)}</th>`; });
  html += "</tr></thead><tbody>";

  for (let i = 0; i < slotCount; i++) {
    const slotMin = startMin + i * SLOT_MIN;
    html += `<tr><td class="slot-time">${minToTime(slotMin)}</td>`;
    orte.forEach((p) => {
      if (covered[p.id].has(i)) return; // von rowspan überdeckt
      const entry = startMap[p.id][i];
      if (entry) {
        const kat = kategorieById(entry.b.kategorie);
        const bg = kat ? kat.farbe : "#e9ecef";
        const fg = contrastColor(bg);
        html += `<td class="slot-booking" rowspan="${entry.span}" style="background:${escapeHtml(bg)};color:${fg}" data-id="${escapeHtml(entry.b.id)}" draggable="true" title="${escapeHtml(entry.b.start + "–" + entry.b.ende + " · " + p.name)}">${escapeHtml(entry.b.label)}</td>`;
      } else {
        html += `<td class="slot-free" data-ort="${escapeHtml(p.id)}" data-slotmin="${slotMin}"></td>`;
      }
    });
    html += "</tr>";
  }
  html += "</tbody></table>";
  gridEl.innerHTML = html;
}

// ---------- Liste ----------
function filteredListe() {
  const ortsField = bcfg().ortsField;
  const q = (document.getElementById("liste-search").value || "").trim().toLowerCase();
  const tagF = document.getElementById("liste-tag").value;
  const stF = document.getElementById("liste-standort").value;
  const katF = document.getElementById("liste-kategorie").value;
  let list = belegungsListe().filter((b) => {
    const p = ortById(b[ortsField]);
    if (tagF && b.tag !== tagF) return false;
    if (stF && (!p || (p.standort || "—") !== stF)) return false;
    if (katF && b.kategorie !== katF) return false;
    if (q) {
      const hay = `${b.label} ${p ? p.name : ""} ${b.notiz || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  list.sort((a, b) => {
    if (a.tag !== b.tag) return tagIndex(a.tag) - tagIndex(b.tag);
    const ta = timeToMin(a.start) || 0, tb = timeToMin(b.start) || 0;
    if (ta !== tb) return ta - tb;
    return ortIndex(a[ortsField]) - ortIndex(b[ortsField]);
  });
  return list;
}

function listeRowHtml(b) {
  const kat = kategorieById(b.kategorie);
  const color = kat ? kat.farbe : "#e9ecef";
  const p = ortById(b[bcfg().ortsField]);
  return `
    <div class="list-row" data-id="${escapeHtml(b.id)}" style="border-left-color:${escapeHtml(color)}">
      <div class="lr-strong">${escapeHtml(tagName(b.tag).slice(0, 2))}<span class="lr-sub"> ${escapeHtml(tagName(b.tag))}</span></div>
      <div>${escapeHtml(b.start)}–${escapeHtml(b.ende)}</div>
      <div>${escapeHtml(p ? p.name : b[bcfg().ortsField])}<div class="lr-sub">${escapeHtml(p ? (p.standort || "") : "")}</div></div>
      <div class="lr-strong">${escapeHtml(b.label)}</div>
      <div><span class="kat-chip"><span class="kat-dot" style="background:${escapeHtml(color)}"></span>${escapeHtml(kat ? kat.name : "—")}</span></div>
    </div>`;
}

function renderListe() {
  const list = filteredListe();
  document.getElementById("liste-rows").innerHTML = list.map(listeRowHtml).join("");
  document.getElementById("liste-count").textContent = `${list.length} von ${belegungsListe().length}`;
  document.getElementById("liste-empty").classList.toggle("hidden", list.length > 0);
}

// ---------- PDF-Export der Liste ----------
// jsPDF + autoTable sind zusammen rund 400 KB und werden nur hier gebraucht — sie
// stehen deshalb NICHT im <head>, sondern werden beim ersten Bedarf nachgeladen.
// Jeder weitere Aufruf bekommt dieselbe Promise; ein Fehlschlag wird vergessen,
// damit ein zweiter Versuch möglich ist.
const bibliotheken = new Map();
function ladeBibliothek(url) {
  if (bibliotheken.has(url)) return bibliotheken.get(url);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.onload = () => resolve();
    s.onerror = () => {
      bibliotheken.delete(url);
      reject(new Error("Bibliothek konnte nicht geladen werden: " + url));
    };
    document.head.appendChild(s);
  });
  bibliotheken.set(url, p);
  return p;
}
// autoTable hängt sich an jsPDF an und braucht es deshalb VOR sich — die beiden
// nacheinander laden, nicht parallel.
async function ladePdfBibliotheken() {
  await ladeBibliothek("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
  await ladeBibliothek("https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js");
}

function hexToRgb(hex) {
  const c = (hex || "").replace("#", "");
  if (c.length !== 6) return [233, 236, 239];
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

// Beschreibt den eingestellten Filter in Worten — steht als Untertitel im PDF, damit
// ein ausgedrucktes Blatt selbst erklärt, welchen Ausschnitt es zeigt. Die Texte
// kommen aus den Dropdowns selbst, damit sie nie auseinanderlaufen.
function filterBeschreibung() {
  const teile = [];
  ["liste-tag", "liste-standort", "liste-kategorie"].forEach((id) => {
    const el = document.getElementById(id);
    if (el && el.value) teile.push(el.options[el.selectedIndex].text);
  });
  const q = (document.getElementById("liste-search").value || "").trim();
  if (q) teile.push(`Suche: „${q}“`);
  return teile.length ? teile.join(" · ") : "Alle Belegungen";
}

// Dateiname: Bereich + ggf. gewählter Tag + Datum, z. B. Platzbelegung_Montag_2026-07-23.pdf
function pdfDateiname() {
  const tagEl = document.getElementById("liste-tag");
  const tagTeil = tagEl && tagEl.value ? "_" + tagName(tagEl.value) : "";
  return `${bcfg().name}${tagTeil}_${new Date().toISOString().slice(0, 10)}.pdf`;
}

async function exportListePdf() {
  const list = filteredListe();
  if (!list.length) {
    alert("Für den eingestellten Filter gibt es keine Belegungen.");
    return;
  }
  const btn = document.getElementById("btn-pdf-liste");
  const beschriftung = btn.textContent;
  btn.disabled = true;
  btn.textContent = "PDF wird erstellt…";
  try {
    await ladePdfBibliotheken();
    if (!window.jspdf || typeof new window.jspdf.jsPDF().autoTable !== "function") {
      alert("Die PDF-Bibliothek konnte nicht geladen werden — bitte die Seite neu laden.");
      return;
    }
    baueListenPdf(list);
  } catch (e) {
    console.error(e);
    alert("Die PDF-Bibliothek konnte nicht geladen werden (keine Internetverbindung?).");
  } finally {
    btn.disabled = false;
    btn.textContent = beschriftung;
  }
}

function baueListenPdf(list) {
  const cfg = bcfg();
  const m = currentMeta();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.text(cfg.name, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(filterBeschreibung(), 14, 22);
  doc.text([
    m.gueltigAb ? "Gültig ab " + isoToDisplay(m.gueltigAb) : "",
    m.saison ? "Saison " + m.saison : "",
    `${list.length} von ${belegungsListe().length} Belegungen`,
    "Stand " + new Date().toLocaleDateString("de-DE")
  ].filter(Boolean).join(" · "), 14, 27);
  doc.setTextColor(0);

  // Die Liste ist nach Tag sortiert — je Tag eine Zwischenüberschrift, damit ein
  // mehrseitiger Ausdruck lesbar bleibt. Die erste Spalte ist nur ein schmaler
  // Farbbalken in der Kategoriefarbe, wie der farbige Rand in der Listenansicht.
  const body = [];
  let letzterTag = null;
  list.forEach((b) => {
    if (b.tag !== letzterTag) {
      letzterTag = b.tag;
      body.push([{
        content: tagName(b.tag),
        colSpan: 5,
        styles: { fontStyle: "bold", fillColor: [232, 240, 251], textColor: [26, 86, 160] }
      }]);
    }
    const p = ortById(b[cfg.ortsField]);
    const kat = kategorieById(b.kategorie);
    const ortText = !p ? b[cfg.ortsField]
      : (p.standort && p.standort !== p.name ? `${p.name}\n${p.standort}` : p.name);
    body.push([
      { content: "", styles: { fillColor: hexToRgb(kat ? kat.farbe : "#e9ecef") } },
      `${b.start}–${b.ende}`,
      ortText,
      b.label || "",
      kat ? kat.name : "—"
    ]);
  });

  doc.autoTable({
    head: [["", "Zeit", cfg.ortLabel, "Mannschaft / Kürzel", "Kategorie"]],
    body,
    startY: 32,
    margin: { top: 14, left: 14, right: 14, bottom: 18 },
    styles: { fontSize: 9, cellPadding: 2, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [26, 86, 160] },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    // Feste Breiten in mm (A4 hoch, netto 182 mm): der längste Kategoriename
    // („1. SC 1911 (Herren & Jugend)“, 42,6 mm bei Schriftgröße 9) passt damit
    // in eine Zeile, für die Mannschaft bleiben 61 mm.
    columnStyles: {
      0: { cellWidth: 3 },
      1: { cellWidth: 24 },
      2: { cellWidth: 46 },
      3: { fontStyle: "bold" },
      4: { cellWidth: 48 }
    }
  });

  const seiten = doc.internal.getNumberOfPages();
  for (let i = 1; i <= seiten; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(cfg.name + " · 1. SC 1911 Heiligenstadt e.V.", 14, 289);
    doc.text(`Seite ${i} von ${seiten}`, 196, 289, { align: "right" });
  }

  doc.save(pdfDateiname());
}

// ---------- Meta / Changelog / Version / Nutzer ----------
function renderMeta() {
  const m = currentMeta();
  const rows = [
    ["Gültig ab", isoToDisplay(m.gueltigAb) || "—"],
    ["Saison", m.saison || "—"],
    ["Belegungen", String(belegungsListe().length)],
    ["Letzter Stand", m.stand ? new Date(m.stand).toLocaleString("de-DE") : "—"]
  ];
  document.getElementById("meta-view").innerHTML = rows.map(([k, v]) =>
    `<div class="form-field"><label>${escapeHtml(k)}</label><span>${escapeHtml(v)}</span></div>`).join("");
  const hint = document.getElementById("gueltig-hint");
  hint.textContent = m.gueltigAb ? `Gültig ab ${isoToDisplay(m.gueltigAb)}${m.saison ? " · Saison " + m.saison : ""}` : "";
}

function renderVersionInfo() {
  document.querySelectorAll("#version-badge, #version-badge-2").forEach((el) => { if (el) el.textContent = "v" + APP_VERSION; });
  const list = document.getElementById("changelog-list");
  if (!list) return;
  list.innerHTML = APP_CHANGELOG.map((entry) => `
    <div class="changelog-entry">
      <div class="cv">Version ${escapeHtml(entry.version)}</div>
      ${entry.groups.map((g) => `
        <div class="changelog-group">
          <div class="cg-title">${escapeHtml(g.title)}</div>
          <ul class="cg-items">${g.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
        </div>`).join("")}
    </div>`).join("");
}

// Bearbeiten dürfen Site-Admins sowie Nutzer, deren Gruppe in der Tools-Übersicht
// für diese App Bearbeiten-Rechte hat (server-seitig aufgelöst, siehe fetchMe/canEdit
// in db.js) — alle anderen eingeloggten Nutzer dürfen den Plan nur ansehen. Gilt für
// beide Bereiche gleichermaßen.
function canEdit() {
  if (!currentUser) return false;
  return currentUser.isAdmin || !!currentUser.canEdit;
}

// Dritte Stufe "Administrieren" (Tools-Übersicht, seit 2026-07-24): Import und
// Backups sind strukturelle Eingriffe und hängen an dieser Stufe, nicht mehr am
// Bearbeiten-Recht. canAdmin kommt wie canEdit aus me (Administrieren schließt
// Bearbeiten serverseitig ein — umgekehrt nicht).
function canAdmin() {
  if (!currentUser) return false;
  return currentUser.isAdmin || !!currentUser.canAdmin;
}

// Anzeigename der eingeloggten Person — Vor-/Nachname, sonst der Nutzername.
function eigenerAnzeigeName() {
  if (!currentUser) return "";
  return (currentUser.vorname || currentUser.nachname)
    ? `${currentUser.vorname || ""} ${currentUser.nachname || ""}`.trim()
    : currentUser.username;
}

function renderHeaderUser() {
  const el = document.getElementById("header-user");
  const el2 = document.getElementById("einstellungen-user");
  if (!currentUser) { if (el) el.textContent = ""; if (el2) el2.textContent = ""; return; }
  const name = eigenerAnzeigeName();
  const rolle = currentUser.isAdmin ? " (Admin)" : (canEdit() ? " (Bearbeiter)" : "");
  if (el) el.textContent = "👤 " + name + rolle;
  if (el2) el2.textContent = "Angemeldet als " + name + rolle +
    (canEdit() ? "" : " — Bearbeiten ist bestimmten Nutzern vorbehalten.");
}

function applyAdminVisibility() {
  const editable = canEdit();
  const admin = canAdmin();
  document.body.classList.toggle("can-edit", editable);
  document.querySelectorAll(".editor-only").forEach((el) => el.classList.toggle("hidden", !editable));
  document.querySelectorAll(".admin-only").forEach((el) => el.classList.toggle("hidden", !admin));
}

function renderAll() {
  populateFilters();
  renderDaySwitch();
  renderLegend();
  renderGrid();
  renderListe();
  renderMeta();
  renderVersionInfo();
  renderBackups();
  document.getElementById("import-banner").classList.toggle("hidden", belegungsListe().length > 0 || !canAdmin());
}

// ---------- Bereich-Umschalter (Platzbelegung / Hallenbelegung) ----------
function switchBereich(bereich) {
  if (!BEREICHE[bereich]) return;
  currentBereich = bereich;
  document.querySelectorAll(".bereich-switch button").forEach((b) => b.classList.toggle("active", b.dataset.bereich === bereich));
  renderAll();
  switchTab("gitter");
}

// ---------- Belegungs-Formular ----------
function openBelegungModal(idOrPrefill) {
  const cfg = bcfg();
  const isNew = !idOrPrefill || typeof idOrPrefill === "object";
  if (isNew && !canEdit()) return;
  const b = (!isNew) ? belegungsListe().find((x) => x.id === idOrPrefill) : null;
  editingBelegungId = b ? b.id : null;
  const editable = canEdit();

  fillSelect(document.getElementById("bf-tag"), TAGE.map((t) => ({ value: t.id, label: t.name })), null);
  fillSelect(document.getElementById("bf-platz"), ortsListe().map((p) => ({ value: p.id, label: (p.standort && p.standort !== p.name) ? p.name + " (" + p.standort + ")" : p.name })), null);
  fillSelect(document.getElementById("bf-kategorie"), appData.kategorien.map((k) => ({ value: k.id, label: k.name })), null);

  const platzLabelEl = document.getElementById("bf-platz-label");
  if (platzLabelEl) platzLabelEl.textContent = cfg.ortLabel + " *";

  const prefill = (typeof idOrPrefill === "object" && idOrPrefill) ? idOrPrefill : {};
  document.getElementById("bf-tag").value = b ? b.tag : (prefill.tag || currentDay);
  document.getElementById("bf-platz").value = b ? b[cfg.ortsField] : (prefill[cfg.ortsField] || ortsListe()[0].id);
  document.getElementById("bf-start").value = b ? b.start : (prefill.start || "");
  document.getElementById("bf-ende").value = b ? b.ende : (prefill.ende || "");
  document.getElementById("bf-label").value = b ? b.label : "";
  document.getElementById("bf-kategorie").value = b ? b.kategorie : (appData.kategorien[0] ? appData.kategorien[0].id : "sch");
  document.getElementById("bf-ansprechpartner").value = b ? (b.ansprechpartner || "") : "";
  document.getElementById("bf-notiz").value = b ? (b.notiz || "") : "";

  ["bf-tag", "bf-platz", "bf-start", "bf-ende", "bf-label", "bf-kategorie", "bf-ansprechpartner", "bf-notiz"]
    .forEach((id) => { document.getElementById(id).disabled = !editable; });

  document.getElementById("belegung-modal-title").textContent = b ? (editable ? "Belegung bearbeiten" : "Belegung ansehen") : "Neue Belegung";
  document.getElementById("btn-delete-belegung").classList.toggle("hidden", !b || !editable);
  document.getElementById("btn-save-belegung").classList.toggle("hidden", !editable);
  document.getElementById("btn-cancel-belegung").textContent = editable ? "Abbrechen" : "Schließen";
  document.getElementById("belegung-modal").classList.remove("hidden");
  if (editable) document.getElementById("bf-label").focus();
}

function closeBelegungModal() {
  document.getElementById("belegung-modal").classList.add("hidden");
  editingBelegungId = null;
}

function saveBelegung() {
  if (!canEdit()) return;
  const cfg = bcfg();
  const tag = document.getElementById("bf-tag").value;
  const ort = document.getElementById("bf-platz").value;
  const start = document.getElementById("bf-start").value;
  const ende = document.getElementById("bf-ende").value;
  const label = document.getElementById("bf-label").value.trim();
  const kategorie = document.getElementById("bf-kategorie").value;
  const ansprechpartner = document.getElementById("bf-ansprechpartner").value.trim();
  const notiz = document.getElementById("bf-notiz").value.trim();

  if (!label) { alert("Bitte eine Mannschaft / ein Kürzel eingeben."); return; }
  if (!start || !ende) { alert("Bitte Start- und Endzeit angeben."); return; }
  if (timeToMin(ende) <= timeToMin(start)) { alert("Die Endzeit muss nach der Startzeit liegen."); return; }

  const list = belegungsListe();

  // Überschneidungs-Warnung analog zur Drag&Drop-Prüfung — hier nur warnen statt
  // blockieren, damit bewusst gewollte bzw. schon im Bestand vorhandene
  // Überlappungen weiter bearbeitbar bleiben (das Gitter zeigt dann nur eine an).
  const neuS = timeToMin(start), neuE = timeToMin(ende);
  const ueberlappt = list.find((x) =>
    x.id !== editingBelegungId && x.tag === tag && x[cfg.ortsField] === ort &&
    timeToMin(x.start) < neuE && neuS < timeToMin(x.ende)
  );
  if (ueberlappt && !confirm(
    `Achtung: Überschneidung mit „${ueberlappt.label}“ (${ueberlappt.start}–${ueberlappt.ende}) auf diesem ${cfg.ortLabel}. ` +
    "Trotzdem speichern? Im Gitter wird dann nur eine der beiden Belegungen angezeigt."
  )) return;
  let b = editingBelegungId ? list.find((x) => x.id === editingBelegungId) : null;
  const isNew = !b;
  if (isNew) { b = { id: uuid() }; list.push(b); }
  Object.assign(b, { tag, [cfg.ortsField]: ort, start, ende, label, kategorie, ansprechpartner, notiz });
  persist();
  renderAll();
  closeBelegungModal();
}

function deleteBelegung() {
  if (!canEdit() || !editingBelegungId) return;
  if (!confirm("Diese Belegung wirklich löschen?")) return;
  const cfg = bcfg();
  appData[cfg.belegKey] = belegungsListe().filter((x) => x.id !== editingBelegungId);
  persist();
  renderAll();
  closeBelegungModal();
}

// ---------- Import (einmaliger Excel-Seed als JSON, je Bereich getrennt) ----------
function handleImportFile(file) {
  if (!file) return;
  if (!canAdmin()) { alert("Importieren ist Administrierenden vorbehalten."); return; }
  const cfg = bcfg();
  const reader = new FileReader();
  reader.onload = async () => {
    let parsed;
    try { parsed = JSON.parse(reader.result); }
    catch (e) { alert("Die Datei ist kein gültiges JSON."); return; }
    if (!parsed || !Array.isArray(parsed[cfg.belegKey])) {
      alert(`Die Datei enthält nicht das erwartete Format ({ ${cfg.belegKey}: [...] }).`);
      return;
    }
    if (belegungsListe().length > 0 &&
        !confirm("Es sind bereits Belegungen vorhanden. Diese durch den Import ERSETZEN?")) return;
    if (!confirm(`Wirklich ${parsed[cfg.belegKey].length} Belegungen importieren?`)) return;
    // Sicherungspunkt VOR dem Ersetzen — ein Import überschreibt den kompletten
    // Bestand eines Bereichs auf einen Schlag.
    if (!(await ensureSicherungspunkt(`Automatisch vor dem Import (${cfg.name})`))) return;
    // Nur die Felder des AKTUELLEN Bereichs ersetzen — der jeweils andere Bereich
    // (z. B. die 71 bestehenden Platzbelegungen) bleibt dabei unangetastet.
    appData = normalizeData(Object.assign({}, appData, {
      [cfg.metaKey]: parsed.meta || {},
      [cfg.ortsKey]: Array.isArray(parsed[cfg.ortsKey]) && parsed[cfg.ortsKey].length ? parsed[cfg.ortsKey] : appData[cfg.ortsKey],
      [cfg.belegKey]: parsed[cfg.belegKey]
    }));
    renderAll();
    const ok = await saveNow();
    if (ok) alert(`Import erfolgreich gespeichert: ${belegungsListe().length} Belegungen.`);
  };
  reader.readAsText(file, "utf-8");
}

// ---------- Backups ----------
// Ein Backup sichert IMMER beide Bereiche zusammen (ein Sicherungspunkt = ein
// vollständiger Stand der App). Getrennt wird nur die Ablage: die Daten liegen
// je in einer eigenen Datei im Gateway, in appData steht nur der Index — sonst
// würde jeder normale Speichervorgang alle Backups mitschleppen (siehe db.js).
function backupListe() {
  if (!Array.isArray(appData.backups)) appData.backups = [];
  return appData.backups;
}

// Der zu sichernde Nutzdatenstand. Bewusst OHNE das Backup-Verzeichnis selbst:
// beim Wiederherstellen soll der Datenbestand von damals zurückkommen, nicht
// der damalige Stand der Backup-Liste — sonst würden neuere Backups aus der
// Liste verschwinden und wären nur noch als verwaiste Dateien vorhanden.
function backupNutzdaten() {
  return {
    meta: appData.meta,
    plaetze: appData.plaetze,
    kategorien: appData.kategorien,
    belegungen: appData.belegungen,
    hallenMeta: appData.hallenMeta,
    hallen: appData.hallen,
    hallenbelegungen: appData.hallenbelegungen
  };
}

function backupZeitpunkt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? "—" : d.toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

// Legt ein Backup an: erst die Datei, dann der Index-Eintrag. Diese Reihenfolge
// ist Absicht — bricht der zweite Schritt ab, bleibt eine ungenutzte Datei
// liegen (harmlos). Andersherum stünde ein Eintrag in der Liste, dessen
// „Wiederherstellen“-Knopf ins Leere greift.
async function createBackup(kommentar, automatisch) {
  const id = fileUuid();
  const erstelltAm = new Date().toISOString();
  await gatewayFilePut(id, `backup-${erstelltAm.slice(0, 10)}.json`, {
    formatVersion: 1,
    appVersion: APP_VERSION,
    erstelltAm,
    erstelltVon: currentUser ? currentUser.username : "",
    kommentar,
    automatisch: !!automatisch,
    daten: backupNutzdaten()
  });
  backupListe().unshift({
    id,
    erstelltAm,
    erstelltVon: currentUser ? currentUser.username : "",
    erstelltVonName: eigenerAnzeigeName(),
    kommentar,
    automatisch: !!automatisch,
    anzahlBelegungen: appData.belegungen.length,
    anzahlHallenbelegungen: appData.hallenbelegungen.length
  });
  renderBackups();
  return saveNow();
}

// Sicherungspunkt vor einer Aktion, die viel auf einmal überschreibt (Import,
// Wiederherstellen). Liefert, ob weitergemacht werden soll. Ein fehlender
// Sicherungspunkt DARF die eigentliche Aktion nicht verhindern — sonst stünde
// man mit vollem Backup-Vorrat vor einer App, die nichts mehr importiert —
// aber er wird deutlich gemeldet.
async function ensureSicherungspunkt(anlass) {
  if (backupListe().length >= MAX_BACKUPS) {
    return confirm(
      `Es kann kein automatischer Sicherungspunkt angelegt werden: alle ${MAX_BACKUPS} Backup-Plätze sind belegt.\n\n` +
      "Trotzdem fortfahren? Der aktuelle Stand ist dann nicht gesichert.\n\n" +
      "Abbrechen, um zuerst im Tab „Einstellungen“ ein Backup zu löschen."
    );
  }
  try {
    const ok = await createBackup(anlass, true);
    if (ok) return true;
    return confirm("Der automatische Sicherungspunkt konnte nicht gespeichert werden. Trotzdem fortfahren?");
  } catch (e) {
    console.error("Sicherungspunkt fehlgeschlagen", e);
    return confirm(`Der automatische Sicherungspunkt ist fehlgeschlagen (${e.message}). Trotzdem fortfahren?`);
  }
}

function openBackupModal() {
  if (!canAdmin()) return;
  if (backupListe().length >= MAX_BACKUPS) {
    alert(
      `Alle ${MAX_BACKUPS} Backup-Plätze sind belegt.\n\n` +
      "Bitte zuerst ein vorhandenes Backup löschen — es wird nie eines von selbst entfernt."
    );
    return;
  }
  document.getElementById("bk-kommentar").value = "";
  document.getElementById("backup-modal-info").textContent =
    `Gesichert wird der aktuelle Stand beider Bereiche: ${appData.belegungen.length} Platz- und ` +
    `${appData.hallenbelegungen.length} Hallenbelegungen. Platz ${backupListe().length + 1} von ${MAX_BACKUPS}.`;
  document.getElementById("backup-modal").classList.remove("hidden");
  document.getElementById("bk-kommentar").focus();
}

function closeBackupModal() {
  document.getElementById("backup-modal").classList.add("hidden");
}

async function confirmBackup() {
  if (!canAdmin() || backupLaeuft) return;
  const kommentar = document.getElementById("bk-kommentar").value.trim();
  backupLaeuft = true;
  const btn = document.getElementById("btn-confirm-backup");
  btn.disabled = true;
  btn.textContent = "Wird erstellt…";
  try {
    const ok = await createBackup(kommentar, false);
    closeBackupModal();
    if (ok) alert("Backup erstellt.");
    else alert("Das Backup wurde angelegt, konnte aber nicht in die Liste eingetragen werden. Bitte die Seite neu laden und erneut versuchen.");
  } catch (e) {
    console.error("Backup fehlgeschlagen", e);
    alert("Backup fehlgeschlagen: " + e.message);
  } finally {
    backupLaeuft = false;
    btn.disabled = false;
    btn.textContent = "Backup erstellen";
    renderBackups();
  }
}

async function restoreBackup(id) {
  if (!canAdmin() || backupLaeuft) return;
  const eintrag = backupListe().find((b) => b.id === id);
  if (!eintrag) return;
  if (!confirm(
    `Backup vom ${backupZeitpunkt(eintrag.erstelltAm)} wiederherstellen?\n\n` +
    (eintrag.kommentar ? `„${eintrag.kommentar}“\n\n` : "") +
    `Der aktuelle Stand (${appData.belegungen.length} Platz- / ${appData.hallenbelegungen.length} Hallenbelegungen) wird dabei durch ` +
    `${eintrag.anzahlBelegungen ?? "?"} Platz- / ${eintrag.anzahlHallenbelegungen ?? "?"} Hallenbelegungen ersetzt — in BEIDEN Bereichen.`
  )) return;

  backupLaeuft = true;
  try {
    if (!(await ensureSicherungspunkt("Automatisch vor dem Wiederherstellen"))) return;
    const inhalt = await gatewayFileGet(id);
    if (!inhalt || !inhalt.daten || !Array.isArray(inhalt.daten.belegungen)) {
      alert("Die Backup-Datei hat nicht das erwartete Format und wurde nicht eingespielt.");
      return;
    }
    // Das Backup-Verzeichnis bleibt der AKTUELLE Stand (inkl. des eben
    // angelegten Sicherungspunkts) — nur die Nutzdaten kommen aus der Datei.
    appData = normalizeData(Object.assign({}, inhalt.daten, { backups: backupListe() }));
    renderAll();
    const ok = await saveNow();
    alert(ok
      ? `Backup wiederhergestellt: ${appData.belegungen.length} Platz- und ${appData.hallenbelegungen.length} Hallenbelegungen.`
      : "Der wiederhergestellte Stand konnte nicht gespeichert werden. Bitte die Seite neu laden und erneut versuchen.");
  } catch (e) {
    console.error("Wiederherstellen fehlgeschlagen", e);
    alert("Wiederherstellen fehlgeschlagen: " + e.message);
  } finally {
    backupLaeuft = false;
    renderBackups();
  }
}

// Umgekehrte Reihenfolge wie beim Anlegen: erst den Index speichern, dann die
// Datei entfernen. Scheitert der zweite Schritt, bleibt eine ungenutzte Datei
// zurück — deutlich besser als ein Eintrag ohne Datei dahinter.
async function deleteBackup(id) {
  if (!canAdmin() || backupLaeuft) return;
  const eintrag = backupListe().find((b) => b.id === id);
  if (!eintrag) return;
  if (!confirm(
    `Backup vom ${backupZeitpunkt(eintrag.erstelltAm)} endgültig löschen?` +
    (eintrag.kommentar ? `\n\n„${eintrag.kommentar}“` : "")
  )) return;

  backupLaeuft = true;
  try {
    appData.backups = backupListe().filter((b) => b.id !== id);
    renderBackups();
    // Kein Zurücksetzen bei Misserfolg: bei einem Konflikt hat writeToGateway()
    // den Server-Stand bereits neu geladen (die alte Liste hier wieder
    // hineinzuschreiben würde ihn überbügeln), und bei einem Netzfehler steht
    // der Eintrag serverseitig ohnehin noch — er ist nach dem nächsten Laden
    // wieder da. Die Datei bleibt in beiden Fällen unangetastet.
    if (!(await saveNow())) return;
    try {
      await gatewayFileDelete(id);
    } catch (e) {
      console.warn("Backup-Datei konnte nicht entfernt werden (Eintrag ist bereits weg)", e);
    }
  } finally {
    backupLaeuft = false;
    renderBackups();
  }
}

function backupRowHtml(b) {
  const kommentar = (b.kommentar || "").trim();
  const anzahl = `${b.anzahlBelegungen ?? "?"} Platz- / ${b.anzahlHallenbelegungen ?? "?"} Hallenbelegungen`;
  const wer = b.erstelltVonName || b.erstelltVon || "—";
  return `
    <div class="backup-row${b.automatisch ? " is-auto" : ""}" data-id="${escapeHtml(b.id)}">
      <div class="bk-main">
        <div class="bk-comment${kommentar ? "" : " is-empty"}">${escapeHtml(kommentar || "Ohne Kommentar")}</div>
        <div class="bk-meta">${escapeHtml(backupZeitpunkt(b.erstelltAm))} · ${escapeHtml(wer)} · ${escapeHtml(anzahl)}${b.automatisch ? " · automatisch" : ""}</div>
      </div>
      <div class="bk-actions">
        <button class="btn small secondary" data-act="restore">Wiederherstellen</button>
        <button class="btn small danger" data-act="delete">Löschen</button>
      </div>
    </div>`;
}

function renderBackups() {
  const rows = document.getElementById("backup-rows");
  if (!rows) return;
  const list = backupListe().slice().sort((a, b) => String(b.erstelltAm || "").localeCompare(String(a.erstelltAm || "")));
  rows.innerHTML = list.map(backupRowHtml).join("");
  document.getElementById("backup-empty").classList.toggle("hidden", list.length > 0);
  document.getElementById("backup-count").textContent = `${list.length} von ${MAX_BACKUPS} Plätzen belegt`;
  document.getElementById("backup-full-hint").classList.toggle("hidden", list.length < MAX_BACKUPS);
  document.getElementById("btn-backup-create").disabled = list.length >= MAX_BACKUPS;
}

// ---------- Tabs ----------
function switchTab(tab) {
  document.querySelectorAll("nav button[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-section").forEach((s) => s.classList.toggle("active", s.id === "tab-" + tab));
  if (tab === "gitter") renderGrid();
  if (tab === "liste") renderListe();
  if (tab === "info") { renderMeta(); renderVersionInfo(); }
  if (tab === "einstellungen") renderBackups();
}

// ---------- Gateway: Laden / Speichern / Konflikte ----------
function setSaveStatus(text, kind) {
  const el = document.getElementById("save-status");
  if (!el) return;
  el.textContent = text;
  el.className = "header-status" + (kind ? " is-" + kind : "");
}

function persist() {
  clearTimeout(persistTimer);
  setSaveStatus("Änderung noch nicht gespeichert…", "pending");
  ungespeicherteAenderungen = true;
  persistTimer = setTimeout(doPersist, 300);
}
async function saveNow() { clearTimeout(persistTimer); return doPersist(); }

// Es darf immer nur EIN dav-save unterwegs sein. gatewayRev (das ETag, mit dem der
// Worker Konflikte erkennt) wird erst aktualisiert, wenn ein Save zurückkommt —
// ein zweiter Save, der währenddessen startet, schickt also dasselbe, inzwischen
// veraltete ETag und wird zwangsläufig mit 409 abgelehnt. Für die bearbeitende
// Person sah das aus wie "ein anderes Gerät hat geändert", obwohl sie allein war,
// und reloadAfterConflict() verwarf dabei ihre letzte Eingabe.
// Deshalb: Änderungen, die während eines laufenden Saves anfallen, nur vormerken
// und danach in einem Rutsch nachschreiben. appData wird ohnehin immer komplett
// geschrieben, es geht also nichts verloren, wenn mehrere Änderungen zusammenfallen.
let saveRunner = null;
let saveDirty = false;
// Fuer das Sicherheitsnetz beim Verlassen der Seite (beforeunload unter
// runSaveLoop): "es liegt etwas an" und "der letzte Versuch ging schief".
// Beides wird eigens gepflegt statt aus saveDirty/saveRunner abgeleitet -- der
// Debounce-Timer laeuft schon, bevor saveDirty ueberhaupt gesetzt ist, und
// genau dieses Fenster ist der Fall, den das Netz auffangen soll.
let ungespeicherteAenderungen = false;
let letzterSaveFehlgeschlagen = false;

function doPersist() {
  saveDirty = true;
  ungespeicherteAenderungen = true;
  if (!saveRunner) saveRunner = runSaveLoop().finally(() => { saveRunner = null; });
  return saveRunner;
}
async function runSaveLoop() {
  let ok = true;
  while (saveDirty) {
    saveDirty = false;
    ok = await writeToGateway();
    // Bei Konflikt/Fehler wurde der Stand neu geladen bzw. der Login-Screen
    // gezeigt — dann NICHT blind nachschreiben, das würde den fremden Stand
    // wieder überbügeln.
    if (!ok) { saveDirty = false; break; }
  }
  // Nach einem sauberen Durchlauf ist alles draussen, sonst liegt noch etwas an.
  ungespeicherteAenderungen = !ok;
  letzterSaveFehlgeschlagen = !ok;
  return ok;
}

// Sicherheitsnetz beim Verlassen der Seite: ein noch nicht abgelaufener
// Debounce-Timer und ein gerade laufender fetch gehen beim Entladen beide
// verloren -- der Browser bricht laufende Requests ab. Der keepalive-Request
// ueberlebt das Schliessen des Tabs.
//
// Nachgefragt wird NUR, wenn dieser Weg nicht traegt (Daten ueber der
// 64-KB-Grenze, kein Token, oder der letzte regulaere Versuch schlug schon
// fehl). Sonst kaeme die Rueckfrage bei JEDEM Schliessen kurz nach einer
// Aenderung -- also staendig -- und wuerde reflexhaft weggeklickt, gerade dann
// wenn sie einmal wirklich zaehlt.
window.addEventListener("beforeunload", (e) => {
  if (!ungespeicherteAenderungen) return;
  // Apps mit zusaetzlichem lokalem Datei-Modus duerfen hier nichts ins Gateway
  // schicken: dort ist die lokale Datei die Wahrheit, nicht Nextcloud.
  if (typeof storageMode !== "undefined" && storageMode !== "gateway") return;
  const abgeschickt = gatewaySaveBeacon(appData);
  if (abgeschickt && !letzterSaveFehlgeschlagen) return;
  e.preventDefault();
  e.returnValue = "";
});

async function writeToGateway() {
  setSaveStatus("Speichern…", "pending");
  try {
    appData.meta = Object.assign({}, appData.meta, { stand: new Date().toISOString() });
    appData.hallenMeta = Object.assign({}, appData.hallenMeta, { stand: new Date().toISOString() });
    await gatewaySave(appData);
    const t = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    setSaveStatus("Gespeichert " + t, "ok");
    return true;
  } catch (e) {
    if (e instanceof ConflictError) { await reloadAfterConflict(); setSaveStatus("Von anderem Gerät aktualisiert", ""); return false; }
    if (e instanceof NotLoggedInError) { showConnectScreen("Sitzung abgelaufen — bitte neu anmelden."); return false; }
    console.error("Speichern fehlgeschlagen", e);
    setSaveStatus("Nicht gespeichert", "error");
    alert("Speichern fehlgeschlagen: " + e.message);
    return false;
  }
}

async function reloadAfterConflict() {
  try {
    const data = await gatewayLoad();
    appData = normalizeData(data);
    renderAll();
    alert("Die Daten wurden zwischenzeitlich auf einem anderen Gerät geändert — die aktuelle Version wurde neu geladen. Bitte die letzte Änderung bei Bedarf erneut vornehmen.");
  } catch (e) {
    console.error("Neuladen nach Konflikt fehlgeschlagen", e);
  }
}

// ---------- Start ----------
function showConnectScreen(errorMsg) {
  document.getElementById("connect-screen").style.display = "";
  document.getElementById("app-shell").style.display = "none";
  document.getElementById("cloud-error").textContent = errorMsg ? "Fehler: " + errorMsg : "";
}

// Vorschläge fürs Feld „Mannschaft / Kürzel" aus der zentralen Vereinsliste.
let vereinsMannschaften = [];

// Füllt die datalist am Namensfeld. ⚠️ Eine datalist SCHLÄGT nichts vor, was
// nicht drinsteht, verbietet aber auch nichts — genau das ist hier gewollt:
// die echten Mannschaften zur Auswahl, Kürzel wie „FZG" weiter frei tippbar.
function renderVereinsListe() {
  const dl = document.getElementById("vereins-mannschaften");
  if (!dl) return;
  dl.innerHTML = vereinsMannschaften
    .map((m) => `<option value="${escapeHtml(m.kurz)}">${escapeHtml(m.lang)}${m.liga ? " · " + escapeHtml(m.liga) : ""}</option>`)
    .join("");
}

async function startApp() {
  document.getElementById("connect-screen").style.display = "none";
  document.getElementById("app-shell").style.display = "";
  renderAll();
  try {
    currentUser = await fetchMe();
  } catch (_) { /* best effort */ }
  renderHeaderUser();
  applyAdminVisibility();
  // Kommt zum Schluss: die Liste füllt nur ein Vorschlagsfeld, der Wochenplan
  // ist ohne sie schon vollständig bedienbar. Ein zweiter Roundtrip soll den
  // ersten Aufbau nicht aufhalten.
  vereinsMannschaften = await fetchVereinsMannschaften();
  renderVereinsListe();
}

async function init() {
  setupListeners();
  if (!getSessionToken()) { showConnectScreen(); return; }
  try {
    const data = await gatewayLoad();
    appData = normalizeData(data);
    await startApp();
  } catch (e) {
    if (e instanceof NotLoggedInError) { showConnectScreen(); return; }
    console.error("Nextcloud-Zugriff über Login fehlgeschlagen", e);
    showConnectScreen(e.message);
  }
}

function setupListeners() {
  document.querySelectorAll(".bereich-switch button").forEach((b) => b.addEventListener("click", () => switchBereich(b.dataset.bereich)));
  document.querySelectorAll("nav button[data-tab]").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

  document.getElementById("day-switch").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-day]");
    if (!btn) return;
    currentDay = btn.dataset.day;
    renderDaySwitch();
    renderGrid();
  });
  document.getElementById("gitter-standort").addEventListener("change", renderGrid);
  document.getElementById("btn-new-gitter").addEventListener("click", () => openBelegungModal({ tag: currentDay }));
  document.getElementById("btn-new-liste").addEventListener("click", () => openBelegungModal({ tag: currentDay }));

  document.getElementById("grid").addEventListener("click", (e) => {
    const booking = e.target.closest("td.slot-booking");
    if (booking) { openBelegungModal(booking.dataset.id); return; }
    const free = e.target.closest("td.slot-free");
    if (free && canEdit()) {
      const slotMin = parseInt(free.dataset.slotmin, 10);
      const prefill = { tag: currentDay, start: minToTime(slotMin), ende: minToTime(slotMin + SLOT_MIN) };
      prefill[bcfg().ortsField] = free.dataset.ort;
      openBelegungModal(prefill);
    }
  });

  // Belegungen per Drag & Drop auf ein freies Feld verschieben (nur berechtigte Nutzer).
  document.getElementById("grid").addEventListener("dragstart", (e) => {
    const cell = e.target.closest("td.slot-booking[draggable='true']");
    if (!cell || !canEdit()) { e.preventDefault(); return; }
    draggedBookingId = cell.dataset.id;
    cell.classList.add("is-dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", draggedBookingId);
  });
  document.getElementById("grid").addEventListener("dragend", (e) => {
    e.target.closest("td.slot-booking")?.classList.remove("is-dragging");
    document.querySelectorAll("#grid td.drop-target").forEach((el) => el.classList.remove("drop-target"));
    draggedBookingId = null;
  });
  document.getElementById("grid").addEventListener("dragover", (e) => {
    const free = e.target.closest("td.slot-free");
    if (!free || !draggedBookingId) return;
    e.preventDefault();
    free.classList.add("drop-target");
  });
  document.getElementById("grid").addEventListener("dragleave", (e) => {
    e.target.closest("td.slot-free")?.classList.remove("drop-target");
  });
  document.getElementById("grid").addEventListener("drop", (e) => {
    const free = e.target.closest("td.slot-free");
    if (!free || !draggedBookingId || !canEdit()) return;
    e.preventDefault();
    free.classList.remove("drop-target");
    const ortsField = bcfg().ortsField;
    const list = belegungsListe();
    const booking = list.find((b) => b.id === draggedBookingId);
    draggedBookingId = null;
    if (!booking) return;

    const dauer = timeToMin(booking.ende) - timeToMin(booking.start);
    const neuStart = parseInt(free.dataset.slotmin, 10);
    const neuEnde = neuStart + dauer;
    const neuOrt = free.dataset.ort;
    const konflikt = list.some((b) =>
      b.id !== booking.id && b.tag === booking.tag && b[ortsField] === neuOrt &&
      timeToMin(b.start) < neuEnde && neuStart < timeToMin(b.ende)
    );
    if (konflikt) { alert("Der Zielzeitraum ist auf diesem Platz bereits belegt."); return; }

    booking[ortsField] = neuOrt;
    booking.start = minToTime(neuStart);
    booking.ende = minToTime(neuEnde);
    persist();
    renderAll();
  });

  ["liste-search", "liste-tag", "liste-standort", "liste-kategorie"].forEach((id) =>
    document.getElementById(id).addEventListener("input", renderListe));
  ["liste-tag", "liste-standort", "liste-kategorie"].forEach((id) =>
    document.getElementById(id).addEventListener("change", renderListe));
  document.getElementById("liste-rows").addEventListener("click", (e) => {
    const row = e.target.closest(".list-row");
    if (row) openBelegungModal(row.dataset.id);
  });
  document.getElementById("btn-pdf-liste").addEventListener("click", exportListePdf);

  document.getElementById("belegung-modal-close").addEventListener("click", closeBelegungModal);
  document.getElementById("btn-cancel-belegung").addEventListener("click", closeBelegungModal);
  document.getElementById("btn-save-belegung").addEventListener("click", saveBelegung);
  document.getElementById("btn-delete-belegung").addEventListener("click", deleteBelegung);
  document.getElementById("belegung-modal").addEventListener("click", (e) => { if (e.target.id === "belegung-modal") closeBelegungModal(); });
  document.getElementById("belegung-form").addEventListener("submit", (e) => { e.preventDefault(); saveBelegung(); });

  document.getElementById("btn-import-seed").addEventListener("click", () => document.getElementById("import-file-input").click());
  document.getElementById("import-file-input").addEventListener("change", (e) => { handleImportFile(e.target.files[0]); e.target.value = ""; });

  document.getElementById("btn-backup-create").addEventListener("click", openBackupModal);
  document.getElementById("backup-modal-close").addEventListener("click", closeBackupModal);
  document.getElementById("btn-cancel-backup").addEventListener("click", closeBackupModal);
  document.getElementById("btn-confirm-backup").addEventListener("click", confirmBackup);
  document.getElementById("backup-modal").addEventListener("click", (e) => { if (e.target.id === "backup-modal") closeBackupModal(); });
  document.getElementById("bk-kommentar").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); confirmBackup(); } });
  document.getElementById("backup-rows").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.closest(".backup-row").dataset.id;
    if (btn.dataset.act === "restore") restoreBackup(id);
    else if (btn.dataset.act === "delete") deleteBackup(id);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!document.getElementById("belegung-modal").classList.contains("hidden")) closeBelegungModal();
    else if (!document.getElementById("backup-modal").classList.contains("hidden")) closeBackupModal();
  });
}

document.addEventListener("DOMContentLoaded", init);
