# Einmalige Konvertierung des Excel-Hallenplans in hallenbelegung-seed.json.
# Read-only auf die Excel (Excel-COM). Erzeugt die Startdaten für den Hallenbelegung-
# Bereich, die dann EINMALIG in der App importiert werden.
#
# Layout unterscheidet sich vom Platz-Konverter: pro Halle EIN Tabellenblatt statt pro
# Tag, und jeder Wochentag hat sein EIGENES Zeit/Label-Spaltenpaar (Zeit-Header-Text
# "Montag".."Samstag" wird dynamisch gesucht, nicht hart verdrahtet — Spaltenversatz
# unterscheidet sich je Blatt, z. B. "kath Gymn" beginnt eine Spalte später).
#
# Zwei Buchungsstile kommen im selben Blatt vor:
#  (1) Dichtes 30-Min-Raster wie beim Platzplan (Zeitwert in JEDER Zeile) — Ende wird
#      wie dort aus der letzten Zeilen-Zeit + 30 Min berechnet.
#  (2) Freistehende "von / bis / Text"-Dreizeiler (mittlere Zeile enthält wörtlich "bis"
#      statt einer Zahl) für seltenere Zusatztermine — hier ist die letzte numerische
#      Zeit bereits das ECHTE Ende (keine +30-Korrektur). Per Interior.Color-Merge
#      (wie beim Platzplan) werden über mehrere Zeilen verteilte Namen zusammengefügt;
#      eine komplett leere Zeile (keine Zeit/kein "bis"/kein Text) beendet einen Lauf
#      unabhängig von der Hintergrundfarbe (wichtig, weil manche Zusatzblöcke eine reine
#      Dekor-Hintergrundfarbe über mehrere Buchungen hinweg teilen).
#
# Aufruf:  powershell -File tools\hallen-excel-to-seed.ps1 [-Xlsx <pfad>] [-Out <pfad>]
param(
  [string]$Xlsx = (Join-Path $env:USERPROFILE "Nextcloud\05_Nachwuchsbereich\01_Leitung\01_Platz- und Hallenbelegungsplan\Entwurf_Hallen Plan_2026-27_CP.xlsx"),
  [string]$Out  = "E:\platzbelegung\hallenbelegung-seed.json"
)

# --- Hallen = eigene Tabellenblätter (Namen aus den Blatt-Titeln übernommen) ---
$Hallen = @(
  @{ sheet="Stadionhalle";            id="stadionhalle"; name="Stadionhalle" },
  @{ sheet="LK Halle Kurpark";        id="lkh-kurpark";  name="LK Halle Kurpark" },
  @{ sheet="kath Gymn";               id="kath-gymn";    name="Kath. Gymnasium" },
  @{ sheet="Liethenhalle";            id="liethenhalle"; name="Liethenhalle" },
  @{ sheet="Th Stormhalle";           id="stormhalle";   name="Th.-Storm-Schule (große Sporthalle)" },
  @{ sheet="Solidorhalle-Staatl Gymn"; id="solidorhalle"; name="Solidorhalle / Staatl. Gymnasium" }
)

# Sonntag bewusst ausgeschlossen (Entscheidung: Hallenbelegung läuft wie Platzbelegung nur Mo-Sa).
$DayMatch = @(
  @{ pat="^montag";     tag="Mo" },
  @{ pat="^dienstag";   tag="Di" },
  @{ pat="^mittwoch";   tag="Mi" },
  @{ pat="^donnerstag"; tag="Do" },
  @{ pat="^freitag";    tag="Fr" },
  @{ pat="^samstag";    tag="Sa" }
)

$Kategorien = @(
  @{ id="sch";      name="1. SC 1911 (Herren & Jugend)"; farbe="#1a56a0" },
  @{ id="dfb";      name="DFB-Stützpunkt";               farbe="#8a5a2b" },
  @{ id="nf";       name="Nachwuchsförderung";           farbe="#e08a1e" },
  @{ id="tsv";      name="TSV / Kooperation";            farbe="#2e8b57" },
  @{ id="freizeit"; name="Freizeit / Breitensport";      farbe="#0d9488" },
  @{ id="fremd";    name="Fremdverein / extern";         farbe="#c0392b" },
  @{ id="frei";     name="Freie Zeit";                   farbe="#e9ecef" }
)

function To-HHMM([double]$frac) {
  $mins = [Math]::Round($frac * 24 * 60)
  $h = [Math]::Floor($mins / 60); $m = $mins - $h * 60
  return ("{0:D2}:{1:D2}" -f [int]$h, [int]$m)
}
function Add-Slot([string]$hhmm, [int]$minutes) {
  $p = $hhmm.Split(":"); $t = [int]$p[0] * 60 + [int]$p[1] + $minutes
  $h = [Math]::Floor($t / 60); $m = $t - $h * 60
  return ("{0:D2}:{1:D2}" -f [int]$h, [int]$m)
}

function Clean-Label([string]$s) {
  if ($null -eq $s) { return "" }
  return ($s -replace "\s+", " ").Trim()
}

function Match-Category([string]$u) {
  if ($u -match "DFB") { return "dfb" }
  if ($u -match "^NF\b") { return "nf" }
  if ($u -match "TSV") { return "tsv" }
  if ($u -match "FZG|BREITENSP|FRAUEN|ALTE HERREN|\bAH\b|KICKER|WANDERGRU|RADSPORT|VOLKSSOLIDA|\bKITA\b|VOLLEYBALL|BUDOKAN|RHEUMA|SCHWALBEN") { return "freizeit" }
  if ($u -match "^SCH\b") { return "sch" }
  if ($u -match "^(1\.?\s*MA|2\.?\s*MA)") { return "sch" }
  if ($u -match "^[A-G]\d*(/[A-G]?\d+)*$") { return "sch" }
  return $null
}

# Kategorie nach dem ersten erkennbaren Token (bei zusammengesetzten Labels zählt das
# erste Team), sonst Gesamt-Label, sonst fremd — gleiches Vorgehen wie im Platz-Konverter.
function Get-Category([string]$label) {
  $tokens = @($label -split "\s+")
  foreach ($cand in @($tokens[0], $label)) {
    if ($null -ne $cand -and $cand -ne "") {
      $r = Match-Category ($cand.ToUpper())
      if ($r) { return $r }
    }
  }
  return "fremd"
}

# --- Excel öffnen ---
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($Xlsx, $true, $true)

$belegungen = New-Object System.Collections.ArrayList
$counter = 0
$summary = @{}
$skippedSheets = @()

foreach ($h in $Hallen) {
  $ws = $null
  try { $ws = $wb.Worksheets.Item($h.sheet) } catch { }
  if ($null -eq $ws) { $skippedSheets += $h.sheet; continue }

  $ur = $ws.UsedRange
  $rowN = $ur.Rows.Count
  $colN = $ur.Columns.Count

  # Kopfzeile suchen (erste Zeile mit einer Zelle, die mit "Montag" beginnt).
  $headerRow = $null
  for ($r = 1; $r -le [Math]::Min(10, $rowN); $r++) {
    for ($c = 1; $c -le $colN; $c++) {
      $v = $ws.Cells.Item($r, $c).Value2
      if ($v -is [string] -and $v.Trim() -match "^Montag") { $headerRow = $r; break }
    }
    if ($null -ne $headerRow) { break }
  }
  if ($null -eq $headerRow) { $skippedSheets += "$($h.sheet) (keine Kopfzeile gefunden)"; continue }

  # Tages-Spalten dynamisch aus der Kopfzeile ermitteln (Zeit-Spalte = Header-Spalte,
  # Label-Spalte = Header-Spalte + 1 — über alle Blätter konsistent, auch bei Versatz).
  $dayCols = @()
  for ($c = 1; $c -le $colN; $c++) {
    $v = $ws.Cells.Item($headerRow, $c).Value2
    if ($v -is [string]) {
      foreach ($d in $DayMatch) {
        if ($v.Trim() -match $d.pat) { $dayCols += @{ tag = $d.tag; timeCol = $c; labelCol = $c + 1 }; break }
      }
    }
  }

  foreach ($dc in $dayCols) {
    $runColor = $null; $runStart = $null; $lastNumeric = $null; $sawBis = $false; $frags = $null

    $emit = {
      if ($null -ne $runStart) {
        $label = Clean-Label ($frags -join " ")
        if ($label -ne "" -and $label.ToLower() -ne "frei" -and $label.ToLower() -ne "freie zeit") {
          $startS = To-HHMM $runStart
          if ($sawBis) {
            $endS = if ($null -ne $lastNumeric) { To-HHMM $lastNumeric } else { Add-Slot $startS 30 }
          } else {
            $endS = Add-Slot (To-HHMM $lastNumeric) 30
          }
          if ($endS -gt $startS) {
            $script:counter++
            $kat = Get-Category $label
            [void]$belegungen.Add([ordered]@{
              id        = "hb$($script:counter)"
              tag       = $dc.tag
              halle     = $h.id
              start     = $startS
              ende      = $endS
              label     = $label
              kategorie = $kat
              notiz     = ""
            })
            if (-not $summary.ContainsKey($kat)) { $summary[$kat] = 0 }
            $summary[$kat]++
          }
        }
      }
    }

    for ($r = $headerRow + 1; $r -le $rowN; $r++) {
      $tRaw = $ws.Cells.Item($r, $dc.timeCol).Value2
      $lCell = $ws.Cells.Item($r, $dc.labelCol)
      $lRaw = $lCell.Value2
      $txt = if ($null -eq $lRaw) { "" } else { ("$lRaw").Trim() }
      $color = [int]$lCell.Interior.Color

      $isNum = ($tRaw -is [double]) -and ($tRaw -gt 0) -and ($tRaw -lt 1)
      $isBis = ($tRaw -is [string]) -and ($tRaw.Trim().ToLower() -eq "bis")

      if ($txt -eq "" -and -not $isNum -and -not $isBis) {
        & $emit
        $runColor = $null; $runStart = $null; $lastNumeric = $null; $sawBis = $false; $frags = $null
        continue
      }

      if ($null -ne $runStart -and $color -eq $runColor) {
        if ($isNum) { $lastNumeric = $tRaw }
        if ($isBis) { $sawBis = $true }
        if ($txt -ne "" -and $frags[-1] -ne $txt) { $frags += $txt }
      } else {
        & $emit
        if ($isNum) {
          $runColor = $color; $runStart = $tRaw; $lastNumeric = $tRaw; $sawBis = $false
          $frags = @()
          if ($txt -ne "") { $frags += $txt }
        } else {
          $runColor = $null; $runStart = $null; $lastNumeric = $null; $sawBis = $false; $frags = $null
        }
      }
    }
    & $emit
  }
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

$result = [ordered]@{
  meta = [ordered]@{
    saison    = "2026/27"
    gueltigAb = ""
    stand     = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
    quelle    = "Entwurf_Hallen Plan_2026-27_CP (Excel-Import)"
  }
  hallen           = @($Hallen | Where-Object { $skippedSheets -notcontains $_.sheet } | ForEach-Object { [ordered]@{ id = $_.id; name = $_.name; standort = $_.name } })
  hallenbelegungen = @($belegungen)
}

$json = $result | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($Out, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Output "Geschrieben: $Out"
Write-Output "Belegungen gesamt: $($belegungen.Count)"
Write-Output "--- je Kategorie ---"
$summary.GetEnumerator() | Sort-Object Name | ForEach-Object { Write-Output ("  {0,-9}: {1}" -f $_.Key, $_.Value) }
if ($skippedSheets.Count -gt 0) {
  Write-Output "--- übersprungen ---"
  $skippedSheets | ForEach-Object { Write-Output "  $_" }
}
