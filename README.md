# 🏟️ Platzbelegung

Der Wochenplan der Trainingsplätze und Hallenzeiten: wer trainiert wann wo. Ein
Blick genügt, um zu sehen, ob ein Platz zu einer Uhrzeit noch frei ist — und wen
man fragen muss, wenn nicht.

**➡️ [Platzbelegung öffnen](https://sc1911heiligenstadt.github.io/platzbelegung/)**

## Was drin ist

| Reiter | Wofür |
|---|---|
| **Gitter** | Die Woche als Raster — Plätze gegen Uhrzeiten, Lücken sofort sichtbar |
| **Liste** | Dieselben Belegungen untereinander, gut zum Suchen und Ausdrucken |
| **Einstellungen** | Sicherungen anlegen und einspielen |

Ein Eintrag hält fest: **Tag**, **von–bis**, die **Mannschaft** (oder ihr
Kürzel), eine **Kategorie**, den **Ansprechpartner** und bei Bedarf eine
**Notiz** oder einen **Kommentar**.

## Sicherungen

Unter **Einstellungen** lässt sich der ganze Plan als Sicherung ablegen und
später zurückholen. Gedacht ist das für den Saisonwechsel und für den Fall, dass
beim Umräumen etwas verlorengeht.

## Wichtig: nicht die Raumnutzung

Hier stehen die **eigenen** Trainingszeiten des Vereins. Der Antrag auf Nutzung
einer Halle beim Landkreis läuft über die
[Raumnutzung](https://sc1911heiligenstadt.github.io/raumnutzung/) — anderes
Werkzeug, anderer Zweck.

## Zugang

Die Anmeldung läuft über die [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) — dort einmal anmelden, danach ist dieses Werkzeug offen.

Die Rechte gelten in drei Stufen: **Sehen** (Plan ansehen), **Bearbeiten**
(Belegungen pflegen) und **Administrieren** (Reiter *Einstellungen*:
Sicherungen). Wer welche Stufe hat, legt die Tools-Übersicht fest.

## Lokal starten

Über den Eintrag `platzbelegung` in `E:\.claude\launch.json` — der Server läuft dann auf `http://localhost:8778/`.

## Technik

Vanilla JavaScript ohne Build-Schritt — die Dateien werden so ausgeliefert, wie sie im Repo liegen. Veröffentlicht über GitHub Pages. Die Daten liegen in der Vereins-Nextcloud; der Zugriff läuft ausschließlich über den Login-Worker der Tools-Übersicht, nie mit Zugangsdaten im Browser.

---

Ein Werkzeug des 1. SC 1911 Heiligenstadt. Alle Werkzeuge auf einen Blick: [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) · Erklärungen im [Toolbox Wiki](https://sc1911heiligenstadt.github.io/Vereinswiki/).
