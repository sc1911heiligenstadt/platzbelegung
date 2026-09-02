# 🏟️ Platzbelegung

Der Wochenplan der Trainingsplätze und Hallenzeiten: wer trainiert wann wo. Ein
Blick genügt, um zu sehen, ob ein Platz zu einer Uhrzeit noch frei ist — und wen
man fragen muss, wenn nicht.

**➡️ [Platzbelegung öffnen](https://sc1911heiligenstadt.github.io/platzbelegung/)**

## Zwei Bereiche

Oben wird zwischen **Platzbelegung** und **Hallenbelegung** umgeschaltet. Beide
haben ihr eigenes Gitter, ihre eigene Liste und ihren eigenen Bestand: 14 Plätze
(Hauptplatz sowie Kalteneber, Rengelrode und Günterode) auf der einen Seite, 6
Hallen (Stadionhalle, LK Halle Kurpark, Kath. Gymnasium, Liethenhalle,
Th.-Storm-Schule, Solidorhalle im Staatlichen Gymnasium) auf der anderen.

## Was drin ist

| Reiter | Wofür |
|---|---|
| **Gitter** | Die Woche als Raster — Plätze gegen Uhrzeiten, Lücken sofort sichtbar |
| **Liste** | Dieselben Belegungen untereinander, mit Filter, gut zum Suchen und als PDF |
| **Einstellungen** | Datei-Import und Sicherungen (nur Administrieren) |
| **Info** | Was die App tut, die Änderungen und der Datenschutz-Hinweis |

Ein Eintrag hält fest: **Tag**, **von–bis**, die **Mannschaft** (oder ihr
Kürzel), eine **Kategorie**, den **Ansprechpartner** und bei Bedarf eine
**Notiz**. Ein Klick auf eine Belegung zeigt alle Angaben — auch ohne
Bearbeiten-Recht.

Das Feld „Mannschaft / Kürzel“ schlägt beim Tippen die echten Mannschaften des
Vereins vor, dieselbe Liste wie in der Tools-Übersicht. Eigene Kürzel wie „FZG“
oder Kombinationen wie „D1/2“ lassen sich trotzdem frei eintippen.

## Belegungen pflegen

Ein Tippen auf ein freies Feld im Gitter legt gleich eine Belegung für diesen
Platz und diese Zeit an; eine bestehende lässt sich am Rechner auf ein freies
Feld ziehen. Überschneidet sich eine Zeit mit einer bestehenden Belegung, warnt
die App und fragt nach — gewollte Überlappungen bleiben damit möglich, im Gitter
ist dann nur eine der beiden zu sehen. Ein belegtes Ziel lehnt sie beim Ziehen ab.

## Liste als PDF

Der Knopf **„Als PDF“** über der Liste sichert genau den Umfang, den der
eingestellte Filter gerade zeigt — nach Wochentagen gegliedert, in den Farben der
Kategorien, mit dem gewählten Filter als Untertitel. Der Dateiname trägt Bereich,
Tag und Datum. Das steht allen offen, die den Plan sehen dürfen.

## Sicherungen

Unter **Einstellungen** lässt sich der ganze Plan als Sicherung ablegen und
später zurückholen. Gedacht ist das für den Saisonwechsel und für den Fall, dass
beim Umräumen etwas verlorengeht. Eine Sicherung enthält immer **beide Bereiche**;
vor einem Import und vor dem Zurückholen legt die App zusätzlich von sich aus
einen Sicherungspunkt an. Es werden nie Sicherungen von selbst gelöscht — sind
alle 10 Plätze belegt, sagt die App das und wartet.

Ebenfalls dort: der einmalige **Import** eines bestehenden Excel-Plans je Bereich
(als JSON-Datei aus den Skripten in `tools/`).

## Wichtig: nicht die Raumnutzung

Hier stehen die **eigenen** Trainingszeiten des Vereins. Der Antrag auf Nutzung
einer Halle beim Landkreis läuft über die
[Raumnutzung](https://sc1911heiligenstadt.github.io/raumnutzung/) — anderes
Werkzeug, anderer Zweck.

## Zugang

Die Anmeldung läuft über die [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) — dort einmal anmelden, danach ist dieses Werkzeug offen.

Die Rechte gelten in drei Stufen: **Sehen** (Plan ansehen, Angaben einer Belegung
lesen, PDF sichern), **Bearbeiten** (Belegungen anlegen, ändern, löschen,
verschieben) und **Administrieren** (Reiter *Einstellungen*: Import und
Sicherungen). Wer welche Stufe hat, legt die Tools-Übersicht fest.

Fällt die Anmeldung weg, während die App offen ist, wird der Bildschirm samt der
Dialoge daneben geräumt; zurück geht es über ein Neuladen der Seite.

## Lokal starten

Über den Eintrag `platzbelegung` in `E:\.claude\launch.json` — der Server läuft dann auf `http://localhost:8778/`.

## Technik

| Datei | Zweck |
|---|---|
| `index.html` | vier Reiter (Gitter, Liste, Einstellungen, Info), zwei Dialoge |
| `config.js` | Version, Wochentage, Startbestand für Plätze, Hallen und Kategorien, Changelog |
| `db.js` | Anbindung an das Gateway der Tools-Übersicht |
| `app.js` | Gitter, Liste, Formular, PDF, Sicherungen, Rechte |
| `style.css` | Gestaltung |
| `tools/*.ps1` | Excel-Pläne einmalig in eine Import-Datei umwandeln (nicht ausgeliefert) |

Vanilla JavaScript ohne Build-Schritt — die Dateien werden so ausgeliefert, wie sie im Repo liegen. Veröffentlicht über GitHub Pages. Die PDF-Bibliothek wird erst beim Klick auf „Als PDF“ nachgeladen. Die Daten liegen in der Vereins-Nextcloud; der Zugriff läuft ausschließlich über den Login-Worker der Tools-Übersicht, nie mit Zugangsdaten im Browser. Ändern zwei Geräte gleichzeitig denselben Stand, erkennt die App das, lädt den fremden Stand nach und sagt Bescheid.

---

Ein Werkzeug des 1. SC 1911 Heiligenstadt. Alle Werkzeuge auf einen Blick: [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) · Erklärungen im [Toolbox Wiki](https://sc1911heiligenstadt.github.io/Vereinswiki/).
