// Persistenz über das zentrale ToolsUebersicht-Login-Gateway.
// Gleiches Gateway-Muster wie E:\Spielersichtung\db.js — reines Gateway ohne
// lokalen Datei-Modus.
const GATEWAY_URL = "https://landingpage.michel-brunner.workers.dev";
const TOKEN_STORAGE_KEY = "tu_session_token";
const GATEWAY_APP_ID = "platzbelegung";

class NotLoggedInError extends Error {
  constructor(message) {
    super(message || "Nicht angemeldet");
    this.name = "NotLoggedInError";
  }
}

class ConflictError extends Error {
  constructor(message) {
    super(message || "Daten wurden zwischenzeitlich von einem anderen Gerät geändert");
    this.name = "ConflictError";
  }
}

// ETag des zuletzt geladenen/geschriebenen Stands. Wird bei dav-save mitgeschickt,
// damit der Worker Konflikte (anderes Gerät hat inzwischen gespeichert) erkennt.
let gatewayRev = null;

function getSessionToken() {
  try { return localStorage.getItem(TOKEN_STORAGE_KEY); } catch (_) { return null; }
}

async function gatewayRequest(payload) {
  const token = getSessionToken();
  if (!token) throw new NotLoggedInError();
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify(payload)
  });
  if (resp.status === 401) throw new NotLoggedInError("Sitzung abgelaufen");
  if (resp.status === 403) throw new Error("Kein Zugriff auf dieses Tool.");
  if (resp.status === 409) throw new ConflictError();
  if (!resp.ok) {
    let detail = "";
    try { const b = await resp.json(); if (b && b.error) detail = ": " + b.error; } catch (_) {}
    throw new Error(`Gateway-Fehler (HTTP ${resp.status})${detail}`);
  }
  return resp.json();
}

// Das "me" aus der letzten dav-load-Antwort. Der Worker legt es bei, weil er
// nutzer.json und die Rechte-Datei fuer diesen Request ohnehin gelesen hat --
// der erste fetchMe() nach dem Laden kommt damit ohne eigenen Roundtrip aus.
let gatewayMe = null;

async function gatewayLoad() {
  const body = await gatewayRequest({ action: "dav-load", app: GATEWAY_APP_ID });
  gatewayRev = typeof body.rev === "string" ? body.rev : null;
  gatewayMe = (body.me && typeof body.me === "object") ? body.me : null;
  return body.data; // Objekt oder null (Datei noch nicht vorhanden)
}

async function gatewaySave(dataObj) {
  const payload = { action: "dav-save", app: GATEWAY_APP_ID, data: dataObj };
  if (gatewayRev) payload.rev = gatewayRev;
  const body = await gatewayRequest(payload);
  gatewayRev = typeof body.rev === "string" ? body.rev : null;
}

// Letzter Rettungsversuch beim Verlassen der Seite. Ein normaler fetch wird beim
// Entladen abgebrochen -- mit keepalive ueberlebt der Request das Schliessen des
// Tabs. Betrifft zwei Faelle: einen noch nicht abgelaufenen Debounce-Timer und
// einen gerade laufenden Schreibvorgang.
// Bewusst MIT gatewayRev: ein unbedingter Schreibvorgang wuerde hier zwar immer
// durchgehen, koennte aber die Aenderung eines anderen Geraets ueberschreiben,
// ohne dass es jemand merkt. Lieber ein wirkungsloser 409 als stiller fremder
// Datenverlust.
//
// Grenze: Browser erlauben fuer keepalive-Requests nur 64 KB Body. Groessere
// Datenbestaende gehen auf diesem Weg gar nicht raus -- deshalb meldet die
// Funktion zurueck, ob sie abschicken konnte; der Aufrufer (beforeunload in
// app.js) fragt dann stattdessen nach.
const KEEPALIVE_MAX_BYTES = 64 * 1024;

function gatewaySaveBeacon(dataObj) {
  const token = getSessionToken();
  if (!token) return false;
  const payload = { action: "dav-save", app: GATEWAY_APP_ID, data: dataObj };
  if (gatewayRev) payload.rev = gatewayRev;
  const body = JSON.stringify(payload);
  if (new Blob([body]).size > KEEPALIVE_MAX_BYTES) return false;
  try {
    fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body,
      keepalive: true
    });
    return true;
  } catch (_) {
    return false; // z.B. wenn der Browser den keepalive-Request doch ablehnt
  }
}

// ---------- Datei-Anhaenge (Backups) ----------
// Backups liegen NICHT in der App-JSON, sondern je als eigene Datei im Ordner
// dateien/<uuid> neben ihr (Gateway-Aktionen dav-file-*). Grund: die App
// schreibt bei jeder Aenderung ihren KOMPLETTEN Datenstand -- zehn eingebettete
// Backups wuerden jeden einzelnen Speichervorgang um ein Vielfaches verteuern
// und den Datenstand ueber die 64-KB-Grenze von gatewaySaveBeacon() heben,
// womit das Sicherheitsnetz beim Schliessen des Tabs ausfiele. In der App-JSON
// steht deshalb nur ein schlanker Index (Zeitpunkt, Kommentar, Anzahl).
//
// Rechte kommen ohne Zusatzarbeit: Schreiben und Loeschen verlangen fuer diese
// App serverseitig ein Bearbeiten-Recht (WRITE_REQUIRES_EDIT_PERMISSION im
// Worker), Lesen die Tool-Sichtbarkeit -- dieselbe Schranke wie dav-save.

// btoa() versteht nur Latin-1. Umlaute in Mannschaftsnamen wuerden es werfen,
// deshalb erst nach UTF-8 kodieren und die Bytes in Haeppchen umwandeln
// (String.fromCharCode nimmt nicht beliebig viele Argumente auf einmal).
function jsonToBase64(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

// Datei-Ids muessen im Worker das UUID-Format erfuellen (FILE_ID_RE), sonst 400.
// Der uuid()-Helfer in app.js hat fuer alte Browser einen kuerzeren Fallback --
// fuer Dateinamen braucht es die vollstaendige Form.
function fileUuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < b.length; i++) b[i] = (Math.random() * 256) | 0;
  b[6] = (b[6] & 0x0f) | 0x40; // Version 4
  b[8] = (b[8] & 0x3f) | 0x80; // Variante
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function gatewayFilePut(id, name, obj) {
  await gatewayRequest({
    action: "dav-file-put",
    app: GATEWAY_APP_ID,
    id,
    name,
    contentType: "application/json",
    dataBase64: jsonToBase64(obj)
  });
}

// Antwortet mit den rohen Datei-Bytes statt der ueblichen JSON-Huelle, laeuft
// deshalb an gatewayRequest() vorbei.
async function gatewayFileGet(id) {
  const token = getSessionToken();
  if (!token) throw new NotLoggedInError();
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ action: "dav-file-get", app: GATEWAY_APP_ID, id })
  });
  if (resp.status === 401) throw new NotLoggedInError("Sitzung abgelaufen");
  if (resp.status === 404) throw new Error("Die Backup-Datei wurde nicht gefunden.");
  if (!resp.ok) throw new Error(`Gateway-Fehler (HTTP ${resp.status})`);
  return resp.json();
}

async function gatewayFileDelete(id) {
  await gatewayRequest({ action: "dav-file-delete", app: GATEWAY_APP_ID, id });
}

// Liefert {username, isAdmin, groupIds, vorname, nachname, canEdit} der eingeloggten Person.
async function fetchMe() {
  // Genau EINMAL aus dem letzten dav-load bedienen, danach wieder echt fragen:
  // ein spaeterer Aufruf will den aktuellen Stand (etwa nach einem Rechte-
  // wechsel), nicht eine beliebig alte Kopie. Faellt von selbst auf den Request
  // zurueck, wenn der Worker das Feld noch nicht mitschickt.
  if (gatewayMe) { const me = gatewayMe; gatewayMe = null; return me; }
  return gatewayRequest({ action: "me", app: GATEWAY_APP_ID });
}

// Die Mannschaften des Vereins aus der zentralen Liste (seit 2026-08-12).
//
// ⚠️ GETEILTER FLOTTEN-BAUSTEIN. Wortgleich in busplan/db.js, Materialliste/db.js,
// spielertool-test/db.js und kadermanager/db.js -- es gibt keinen Build-Step,
// also wird kopiert. Wer eine Fassung aendert, zieht die anderen mit.
//
// Diese App fuehrt ihre Mannschaften weiterhin SELBST: an ihnen haengen die
// eigentlichen Nutzdaten. Die Liste ist deshalb ein VORSCHLAG, keine Schranke --
// sie fuellt die Auswahl beim Anlegen, ein frei getippter Name bleibt moeglich.
//
// ⚠️ Wirft nicht nach oben durch. Ohne die Liste laeuft die App wie vorher
// weiter; sie ist Komfort, keine Voraussetzung.
async function fetchVereinsMannschaften() {
  try {
    if (!getSessionToken()) return [];
    const body = await gatewayRequest({ action: "mannschaften-load" });
    const teams = (body && Array.isArray(body.teams)) ? body.teams : [];
    // Archivierte sind aufgeloeste Mannschaften -- die soll niemand mehr neu
    // anlegen; vorhandene Eintraege bleiben davon unberuehrt.
    return teams
      .filter((t) => t && t.kurz && !t.archiviert)
      .map((t) => ({ kurz: String(t.kurz), lang: String(t.lang || t.kurz), liga: String(t.liga || "") }));
  } catch (e) {
    console.warn("Vereins-Mannschaftsliste nicht ladbar", e);
    return [];
  }
}
