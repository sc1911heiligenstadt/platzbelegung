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

const APP_CHANGELOG = [
  {
    version: "1.2",
    groups: [
      {
        title: "Am Handy",
        items: [
          "Die Reiterleiste bricht am Handy jetzt um, statt seitlich aus dem Bild zu laufen. Sichtbar wird das nur, wenn genug Reiter nebeneinanderstehen — dann rutscht die rechte Gruppe in eine zweite Zeile, statt den letzten Reiter hinter den Bildschirmrand zu schieben."
        ]
      }
    ]
  },
  {
    version: "1.1",
    groups: [
      {
        title: "Mannschaften kommen jetzt aus der einen Vereinsliste",
        items: [
          "Das Feld „Mannschaft / Kürzel“ schlägt beim Tippen die echten Mannschaften des Vereins vor — dieselbe Liste, die in der Tools-Übersicht gepflegt wird.",
          "Damit steht dieselbe Mannschaft überall gleich geschrieben im Plan, statt einmal als „D1“ und einmal als „D-Junioren“.",
          "Ein eigener Eintrag bleibt möglich: Kürzel wie „FZG“ oder „1.MA“ und Kombinationen wie „D1/2“ lassen sich weiterhin frei eintippen."
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
          "Ein Klick auf eine Belegung — im Gitter wie in der Liste — zeigt alle Angaben samt Ansprechpartner und Notiz. Das steht auch Nutzern ohne Bearbeiten-Recht offen."
        ]
      },
      {
        title: "Belegungen pflegen",
        items: [
          "Anlegen, ändern und löschen über ein Formular mit Tag, Platz oder Halle, Start und Ende, Kürzel, Ansprechpartner, Kategorie und Notiz.",
          "Überschneidet sich die Zeit mit einer bestehenden Belegung, warnt die App.",
          "Ein Tippen auf ein freies Feld im Gitter legt direkt eine Belegung für diesen Platz und diese Zeit an.",
          "Bestehende Belegungen lassen sich im Gitter auf ein freies Feld ziehen."
        ]
      },
      {
        title: "Wer darf was",
        items: [
          "Sehen: Gitter, Liste und alle Angaben einer Belegung, schreibgeschützt.",
          "Bearbeiten: Belegungen anlegen, ändern, löschen und verschieben. Dazu der Ausdruck der Terminliste.",
          "Administrieren: zusätzlich Datei-Import und Sicherungen im Reiter „Einstellungen“.",
          "Der Reiter „Info“ ist für alle sichtbar."
        ]
      },
      {
        title: "Ausdruck",
        items: [
          "Die Terminliste lässt sich ausdrucken oder als PDF sichern — genau in dem Umfang, den der eingestellte Filter gerade zeigt.",
          "Gegliedert nach Wochentagen, mit den Farben der Kategorien."
        ]
      },
      {
        title: "Sicherungen",
        items: [
          "Im Reiter „Einstellungen“ lassen sich bis zu 10 Sicherungen anlegen. Jede enthält den vollständigen Stand beider Bereiche und kann mit einem Kommentar versehen werden.",
          "Jeder gesicherte Stand lässt sich per Knopfdruck zurückholen. Die Liste zeigt Zeitpunkt, wer gesichert hat, den Kommentar und die Zahl der enthaltenen Belegungen.",
          "Vor einem Import und vor dem Zurückholen legt die App von sich aus einen Sicherungspunkt an — das sind die beiden Momente, in denen viel auf einmal überschrieben wird.",
          "Es wird nie eine Sicherung von selbst gelöscht. Sind alle 10 Plätze belegt, sagt die App das und wartet, bis eine von Hand entfernt wurde."
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
        title: "Daten & Speicherung",
        items: [
          "Gespeichert wird in der Vereins-Nextcloud über die zentrale Anmeldung der Tools-Übersicht — ein eigenes Passwort braucht es nicht.",
          "Ändern zwei Geräte gleichzeitig denselben Stand, erkennt die App das, lädt den fremden Stand nach und sagt Bescheid."
        ]
      }
    ]
  }
];
