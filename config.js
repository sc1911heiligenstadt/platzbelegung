const APP_VERSION = "1.0";

// Wochentage des Plans (kein Sonntag im Bestand).
const TAGE = [
  { id: "Mo", name: "Montag" },
  { id: "Di", name: "Dienstag" },
  { id: "Mi", name: "Mittwoch" },
  { id: "Do", name: "Donnerstag" },
  { id: "Fr", name: "Freitag" },
  { id: "Sa", name: "Samstag" }
];

const SLOT_MIN = 30;               // Raster-Granularität in Minuten
const DEFAULT_GRID_START = "15:30"; // Fallback-Fenster, falls ein Tag keine Termine hat
const DEFAULT_GRID_END = "22:00";

// Höchstzahl gespeicherter Backups. Ist der Vorrat voll, wird NICHTS automatisch
// gelöscht — die App verlangt stattdessen, dass zuerst eines von Hand entfernt
// wird (bewusste Entscheidung: ein Backup verschwindet nie ungefragt).
const MAX_BACKUPS = 10;

// Startbestand für Plätze & Kategorien — greift, wenn im Gateway noch keine bzw.
// leere Daten liegen, damit die App (Dropdowns, Gitter) auch vor dem Excel-Import
// bedienbar ist. Muss zu tools/excel-to-seed.ps1 passen.
const DEFAULT_PLAETZE = [
  { id: "stadion-l", name: "Stadion links", standort: "Hauptplatz" },
  { id: "stadion-r", name: "Stadion rechts", standort: "Hauptplatz" },
  { id: "parkplatz", name: "KuRa Links", standort: "Hauptplatz" },
  { id: "kunstrasen", name: "KuRa Rechts", standort: "Hauptplatz" },
  { id: "kabinenseite", name: "Torwartplatz", standort: "Hauptplatz" },
  { id: "kleiner-platz", name: "Kleiner Platz / Käfig", standort: "Hauptplatz" },
  { id: "stelzenberg-vorne", name: "Stelzenberg vorne", standort: "Hauptplatz" },
  { id: "stelzenberg", name: "Stelzenberg hinten", standort: "Hauptplatz" },
  { id: "kalteneber-l", name: "Kalteneber links", standort: "Kalteneber" },
  { id: "kalteneber-r", name: "Kalteneber rechts", standort: "Kalteneber" },
  { id: "rengelrode-l", name: "Rengelrode vorne", standort: "Rengelrode" },
  { id: "rengelrode-r", name: "Rengelrode hinten", standort: "Rengelrode" },
  { id: "guenterode-l", name: "Günterode links", standort: "Günterode" },
  { id: "guenterode-r", name: "Günterode rechts", standort: "Günterode" }
];

// Startbestand für die Hallen (Hallensaison) — analog zu DEFAULT_PLAETZE, greift bei
// leerem Gateway-Stand. Ids/Namen aus tools/hallen-excel-to-seed.ps1 (Excel-Import).
const DEFAULT_HALLEN = [
  { id: "stadionhalle", name: "Stadionhalle", standort: "Stadionhalle" },
  { id: "lkh-kurpark", name: "LK Halle Kurpark", standort: "LK Halle Kurpark" },
  { id: "kath-gymn", name: "Kath. Gymnasium", standort: "Kath. Gymnasium" },
  { id: "liethenhalle", name: "Liethenhalle", standort: "Liethenhalle" },
  { id: "stormhalle", name: "Th.-Storm-Schule (große Sporthalle)", standort: "Th.-Storm-Schule (große Sporthalle)" },
  { id: "solidorhalle", name: "Solidorhalle / Staatl. Gymnasium", standort: "Solidorhalle / Staatl. Gymnasium" }
];

const DEFAULT_KATEGORIEN = [
  { id: "sch", name: "1. SC 1911 (Herren & Jugend)", farbe: "#1a56a0" },
  { id: "dfb", name: "DFB-Stützpunkt", farbe: "#8a5a2b" },
  { id: "nf", name: "Nachwuchsförderung", farbe: "#e08a1e" },
  { id: "tsv", name: "TSV / Kooperation", farbe: "#2e8b57" },
  { id: "freizeit", name: "Freizeit / Breitensport", farbe: "#0d9488" },
  { id: "fremd", name: "Fremdverein / extern", farbe: "#c0392b" },
  { id: "frei", name: "Freie Zeit", farbe: "#e9ecef" }
];

// Was die Platzbelegung kann -- steht im Info-Reiter als Karte "Funktionen".
// WICHTIG: Das ist NICHT der Changelog. Hier steht der ZUSTAND ("Belegungen
// lassen sich ziehen"), dort die Aenderung. Wer eine Funktion umbaut oder
// abschaltet, zieht diesen Text mit -- und ebenso die grosse Anleitung, wo
// dasselbe ausfuehrlich steht.
const APP_FUNKTIONEN = [
  {
    title: "Wofür die Platzbelegung da ist",
    items: [
      "Der Wochenplan der Trainingsplätze und Hallenzeiten — wer nutzt wann welchen Platz und welche Halle.",
      "Zwei getrennte Bereiche mit eigenem Gitter, eigener Liste und eigenem Import: die Platzbelegung mit 14 Plätzen (Hauptplatz sowie Kalteneber, Rengelrode und Günterode) und die Hallenbelegung mit den 6 Hallen der Stadt.",
      "Über der Woche stehen Saison und Gültig-ab-Datum des geladenen Plans."
    ]
  },
  {
    title: "Der Wochenplan als Gitter",
    items: [
      "Der Reiter „Gitter“ zeigt die Woche von Montag bis Samstag als Raster aus Uhrzeit und Platz beziehungsweise Halle, farbig nach Kategorie — freie Zeiten fallen dadurch sofort auf.",
      "Ein Standort-Filter trennt den Hauptplatz von den Außenstandorten.",
      "Ein Klick auf eine Belegung zeigt alle Angaben samt Ansprechpartner und Notiz. Das steht auch ohne Bearbeiten-Recht offen.",
      "Passen zwei sich überschneidende Belegungen nicht nebeneinander, steht an der Zelle ein „+1“; der Mauszeiger darauf nennt Name und Zeit."
    ]
  },
  {
    title: "Die Terminliste",
    items: [
      "Der Reiter „Liste“ zeigt dieselben Belegungen als Termine, filterbar nach Tag, Standort, Kategorie und freier Textsuche.",
      "Am Handy ist das die bequemere Ansicht als das Gitter.",
      "Auch hier führt ein Klick auf eine Belegung zu allen Angaben."
    ]
  },
  {
    title: "Belegungen pflegen",
    items: [
      "Anlegen, ändern und löschen über ein Formular mit Tag, Platz oder Halle, Start und Ende, Kürzel, Ansprechpartner, Kategorie und Notiz.",
      "Ein Tippen auf ein freies Feld im Gitter legt direkt eine Belegung für diesen Platz und diese Zeit an.",
      "Bestehende Belegungen lassen sich im Gitter auf ein freies Feld ziehen. Ist das Ziel belegt, lehnt die App den Zug ab.",
      "Überschneidet sich die Zeit mit einer bestehenden Belegung, warnt die App und fragt nach, statt stillschweigend zu speichern."
    ]
  },
  {
    title: "Mannschaften aus der einen Vereinsliste",
    items: [
      "Das Feld „Mannschaft / Kürzel“ schlägt beim Tippen die echten Mannschaften des Vereins vor — dieselbe Liste, die in der Tools-Übersicht gepflegt wird.",
      "Damit steht dieselbe Mannschaft überall gleich geschrieben im Plan, statt einmal als „D1“ und einmal als „D-Junioren“.",
      "Ein eigener Eintrag bleibt möglich: Kürzel wie „FZG“ oder Kombinationen wie „D1/2“ lassen sich frei eintippen."
    ]
  },
  {
    title: "Liste als PDF",
    items: [
      "Die Terminliste lässt sich als PDF sichern — genau in dem Umfang, den der eingestellte Filter zeigt; welcher Filter das war, steht als Untertitel darin.",
      "Gegliedert nach Wochentagen, mit den Farben der Kategorien und dem Vereinsnamen in der Fußzeile.",
      "Der Dateiname trägt Bereich, gewählten Tag und Datum, etwa „Platzbelegung_Montag_2026-07-23.pdf“."
    ]
  },
  {
    title: "Sicherungen und Import",
    items: [
      "Im Reiter „Einstellungen“ lassen sich bis zu 10 Sicherungen anlegen, jede mit dem vollständigen Stand beider Bereiche und einem Kommentar.",
      "Jeder gesicherte Stand lässt sich zurückholen. Die Liste zeigt Zeitpunkt, wer gesichert hat, den Kommentar und die Zahl der Belegungen.",
      "Vor einem Import und vor dem Zurückholen legt die App von sich aus einen Sicherungspunkt an. Gelöscht wird nie eine Sicherung von selbst — sind alle 10 Plätze belegt, wartet die App, bis eine von Hand entfernt wurde.",
      "Ein bestehender Excel-Plan lässt sich je Bereich einmalig einlesen. Sind schon Belegungen erfasst, fragt die App nach, bevor sie sie ersetzt."
    ]
  },
  {
    title: "Am Handy",
    items: [
      "Die Ansicht ist für das Handy gebaut; die gefilterte Terminliste ist dort die bequemere Ansicht.",
      "Eingabefelder sind groß genug, dass der iPhone-Browser beim Antippen nicht ungefragt in die Seite hineinzoomt.",
      "Das Verschieben einer Belegung per Ziehen braucht eine Maus; am Handy geht es über das Formular."
    ]
  },
  {
    title: "Wer darf was",
    items: [
      "Sehen: Gitter, Liste und alle Angaben einer Belegung, schreibgeschützt — dazu das PDF der gefilterten Liste. Das steht jedem angemeldeten Nutzer offen.",
      "Bearbeiten: Belegungen anlegen, ändern, löschen und verschieben.",
      "Administrieren: zusätzlich Datei-Import und Sicherungen im Reiter „Einstellungen“.",
      "Fällt die Anmeldung weg, während die App offen ist, räumt sie den Bildschirm samt der Dialoge daneben. Der Reiter „Info“ bleibt für alle sichtbar."
    ]
  },
  {
    title: "Nicht zu verwechseln",
    items: [
      "Hier stehen die eigenen Trainingszeiten des Vereins.",
      "Der Antrag auf Nutzung einer Halle beim Landkreis läuft über die Raumnutzung — anderes Werkzeug, anderer Zweck."
    ]
  },
  {
    title: "Daten und Speicherung",
    items: [
      "Gespeichert wird in der Vereins-Nextcloud über die zentrale Anmeldung der Tools-Übersicht — ein eigenes Passwort braucht es nicht.",
      "Ändern zwei Geräte gleichzeitig denselben Stand, erkennt die App das, lädt den fremden Stand nach und sagt Bescheid."
    ]
  }
];

const APP_CHANGELOG = [
  {
    version: "1.2",
    groups: [
      {
        title: "Im Info-Reiter steht jetzt, was die App kann",
        items: [
          "Die Liste der Änderungen und die Versionsnummer sind aus dem Info-Reiter verschwunden.",
          "Stattdessen steht dort die Karte „Funktionen“: was die App kann, nach Themen geordnet.",
          "Was sich geändert hat, steht weiterhin in den Neuigkeiten auf der Startseite der Tools-Übersicht."
        ]
      }
    ]
  },
  {
    version: "1.1",
    groups: [
      {
        title: "Das Gitter verrutscht nicht mehr",
        items: [
          "Wenn sich zwei Belegungen auf demselben Platz zeitlich überschneiden, steht ab jetzt jede Belegung wieder unter dem richtigen Platz.",
          "Vorher rutschten in so einem Fall alle Belegungen rechts davon eine Spalte nach links, und die letzte Spalte fiel ganz weg. Der Wochenplan sah dabei völlig normal aus — man hatte keinen Anhaltspunkt, dass er falsch ist. Ausgelöst hat es der Alltagsfall: jemand trägt nachträglich etwas Kürzeres in dieselbe Zeit ein.",
          "Die Belegung, die das Gitter nicht zeigen kann, ist jetzt an der Zelle als „+1“ vermerkt. Zeigt man mit der Maus darauf, steht ihr Name und ihre Zeit da.",
          "Eine Belegung unter einer halben Stunde belegt jetzt eine Zeile statt den Rest der Spalte."
        ]
      }
    ]
  },
  {
    version: "1.0",
    groups: [
      {
        title: "Platz- und Hallenbelegung",
        items: [
          "Zwei getrennte Bereiche mit eigenem Gitter, eigener Liste und eigenem Import: die Platzbelegung mit 14 Plätzen (Hauptplatz sowie Kalteneber, Rengelrode und Günterode) und die Hallenbelegung für die Hallensaison mit 6 Hallen (Stadionhalle, LK Halle Kurpark, Kath. Gymnasium, Liethenhalle, Th.-Storm-Schule, Solidorhalle im Staatlichen Gymnasium).",
          "Wochenplan als Gitter aus Zeit und Platz beziehungsweise Halle, von Montag bis Samstag, farblich nach Kategorie.",
          "Terminliste mit Filter nach Tag, Standort, Kategorie und freier Textsuche — die praktischere Ansicht auf dem Handy.",
          "Der Standort-Filter trennt den Hauptplatz von den Außenstandorten.",
          "Ein Klick auf eine Belegung — im Gitter wie in der Liste — zeigt alle Angaben samt Ansprechpartner und Notiz. Das steht auch Nutzern ohne Bearbeiten-Recht offen.",
          "Über der Woche stehen Saison und Gültig-ab-Datum des gerade geladenen Plans."
        ]
      },
      {
        title: "Belegungen pflegen",
        items: [
          "Anlegen, ändern und löschen über ein Formular mit Tag, Platz oder Halle, Start und Ende, Kürzel, Ansprechpartner, Kategorie und Notiz.",
          "Überschneidet sich die Zeit mit einer bestehenden Belegung, warnt die App und fragt nach, statt stillschweigend zu speichern.",
          "Ein Tippen auf ein freies Feld im Gitter legt direkt eine Belegung für diesen Platz und diese Zeit an.",
          "Bestehende Belegungen lassen sich im Gitter auf ein freies Feld ziehen. Ist das Ziel schon belegt, lehnt die App den Zug ab."
        ]
      },
      {
        title: "Mannschaften aus der einen Vereinsliste",
        items: [
          "Das Feld „Mannschaft / Kürzel“ schlägt beim Tippen die echten Mannschaften des Vereins vor — dieselbe Liste, die in der Tools-Übersicht gepflegt wird.",
          "Damit steht dieselbe Mannschaft überall gleich geschrieben im Plan, statt einmal als „D1“ und einmal als „D-Junioren“.",
          "Ein eigener Eintrag bleibt möglich: Kürzel wie „FZG“ oder „1.MA“ und Kombinationen wie „D1/2“ lassen sich weiterhin frei eintippen."
        ]
      },
      {
        title: "Liste als PDF",
        items: [
          "Die Terminliste lässt sich als PDF sichern — genau in dem Umfang, den der eingestellte Filter gerade zeigt; welcher Filter das war, steht als Untertitel darin.",
          "Gegliedert nach Wochentagen, mit den Farben der Kategorien, mit dem Vereinsnamen in der Fußzeile.",
          "Der Dateiname trägt Bereich, gewählten Tag und das Datum, etwa „Platzbelegung_Montag_2026-07-23.pdf“."
        ]
      },
      {
        title: "Sicherungen und Import",
        items: [
          "Im Reiter „Einstellungen“ lassen sich bis zu 10 Sicherungen anlegen. Jede enthält den vollständigen Stand beider Bereiche und kann mit einem Kommentar versehen werden.",
          "Jeder gesicherte Stand lässt sich per Knopfdruck zurückholen. Die Liste zeigt Zeitpunkt, wer gesichert hat, den Kommentar und die Zahl der enthaltenen Belegungen.",
          "Vor einem Import und vor dem Zurückholen legt die App von sich aus einen Sicherungspunkt an — das sind die beiden Momente, in denen viel auf einmal überschrieben wird.",
          "Es wird nie eine Sicherung von selbst gelöscht. Sind alle 10 Plätze belegt, sagt die App das und wartet, bis eine von Hand entfernt wurde.",
          "Ein bestehender Excel-Plan lässt sich je Bereich einmalig als Datei einlesen. Sind schon Belegungen erfasst, fragt die App ausdrücklich nach, bevor sie sie ersetzt."
        ]
      },
      {
        title: "Bedienung am Handy",
        items: [
          "Die Ansicht ist für das Handy gebaut; die gefilterte Terminliste ist dort die bequemere Ansicht als das Gitter.",
          "Eingabefelder sind mindestens 16 Pixel groß, damit der iPhone-Browser beim Antippen nicht ungefragt in die Seite hineinzoomt und verschoben stehen bleibt.",
          "Das Verschieben einer Belegung per Ziehen braucht eine Maus; am Handy geht es über das Formular."
        ]
      },
      {
        title: "Wer darf was",
        items: [
          "Sehen: Gitter, Liste und alle Angaben einer Belegung, schreibgeschützt — dazu das PDF der gefilterten Liste.",
          "Bearbeiten: Belegungen anlegen, ändern, löschen und verschieben.",
          "Administrieren: zusätzlich Datei-Import und Sicherungen im Reiter „Einstellungen“.",
          "Der Reiter „Info“ steht jedem angemeldeten Nutzer offen.",
          "Fällt die Anmeldung weg, während die App offen ist, räumt sie den Bildschirm samt der Dialoge daneben, statt die Belegungen im Hintergrund lesbar zu lassen."
        ]
      },
      {
        title: "Nicht zu verwechseln",
        items: [
          "Hier stehen die eigenen Trainingszeiten des Vereins. Der Antrag auf Nutzung einer Halle beim Landkreis läuft über die Raumnutzung — anderes Werkzeug, anderer Zweck."
        ]
      },
      {
        title: "Daten und Speicherung",
        items: [
          "Gespeichert wird in der Vereins-Nextcloud über die zentrale Anmeldung der Tools-Übersicht — ein eigenes Passwort braucht es nicht.",
          "Ändern zwei Geräte gleichzeitig denselben Stand, erkennt die App das, lädt den fremden Stand nach und sagt Bescheid."
        ]
      }
    ]
  }
];
