# Einmalige Konvertierung des Excel-Platzbelegungsplans in platzbelegung-seed.json.
# Read-only auf die Excel (Excel-COM). Erzeugt die Startdaten, die dann EINMALIG
# in der App importiert werden; danach wird der Plan nur noch in der App gepflegt.
#
# Aufruf:  powershell -File tools\excel-to-seed.ps1 [-Xlsx <pfad>] [-Out <pfad>]
param(
  [string]$Xlsx = (Join-Path $env:USERPROFILE "Desktop\Endversion_Platzbelegungsplan 26-27_3_ab 15-06-26.xlsx"),
  [string]$Out  = "E:\platzbelegung\platzbelegung-seed.json"
)

# --- Platz-Spalten (konstant über alle Tagesblätter; Namen sitzen auf der Zeit-Spalte) ---
$Courts = @(
  @{ col=1;  id="stadion-l";    name="Stadion links";         standort="Hauptplatz" },
  @{ col=3;  id="stadion-r";    name="Stadion rechts";        standort="Hauptplatz" },
  @{ col=5;  id="parkplatz";    name="Parkplatz";             standort="Hauptplatz" },
  @{ col=7;  id="kunstrasen";   name="Kunstrasen";            standort="Hauptplatz" },
  @{ col=9;  id="kabinenseite"; name="Kabinenseite";          standort="Hauptplatz" },
  @{ col=11; id="stelzenberg";  name="Stelzenberg (hinten)";  standort="Hauptplatz" },
  @{ col=13; id="kleiner-platz";name="Kleiner Platz / Käfig"; standort="Hauptplatz" },
  @{ col=16; id="kalteneber-l"; name="Kalteneber links";      standort="Kalteneber" },
  @{ col=18; id="kalteneber-r"; name="Kalteneber rechts";     standort="Kalteneber" },
  @{ col=19; id="rengelrode-l"; name="Rengelrode links";      standort="Rengelrode" },
  @{ col=21; id="rengelrode-r"; name="Rengelrode rechts";     standort="Rengelrode" },
  @{ col=22; id="guenterode-l"; name="Günterode links";       standort="Günterode" },
  @{ col=24; id="guenterode-r"; name="Günterode rechts";      standort="Günterode" }
)

$Days = @(
  @{ sheet="MONTAG";     tag="Mo" },
  @{ sheet="DIENSTAG";   tag="Di" },
  @{ sheet="MITTWOCH";   tag="Mi" },
  @{ sheet="DONNERSTAG"; tag="Do" },
  @{ sheet="FREITAG";    tag="Fr" },
  @{ sheet="SAMSTAG";    tag="Sa" }
)

$TimeCols = @(2,6,10,14,17,20,23)

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
  $s = ($s -replace "\s+", " ").Trim()
  switch -Regex ($s) {
    "^Reng rode$"              { return "SV Rengelrode" }
    "^Grün Weiß Sieme$"        { return "Grün-Weiß Siemerode" }
    "^Dyn Bisch hagen$"        { return "Dynamo Bischhagen" }
    "^FZG Sonne schein$"       { return "FZG Sonnenschein" }
    "^1MA$"                    { return "1.MA" }
    "^2\. MA$"                 { return "2.MA" }
    "^EIC Werkstatt Norbert Jünemann$" { return "EIC Werkstatt Jünemann" }
  }
  return $s
}

function Match-Category([string]$u) {
  if ($u -match "DFB") { return "dfb" }
  if ($u -match "^NF")  { return "nf" }
  if ($u -match "FZG|ALTE HERREN|^AH$|VORSTAND|KICKER|BREITEN|^TEAM|MANNI|^MO$") { return "freizeit" }
  if ($u -match "^(1\.?\s*MA|2\.?\s*MA)") { return "sch" }
  if ($u -match "^MÄD") { return "sch" }
  if ($u -match "^[A-G]\d*(/\d+)*$") { return "sch" }
  if ($u -match "TSV") { return "tsv" }
  return $null
}

# Kategorie nach dem ersten erkennbaren Token bestimmen (bei zusammengesetzten
# Labels wie "B1 (E1/E2) A" zählt das erste Team), sonst Gesamt-Label, sonst fremd.
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

foreach ($d in $Days) {
  $ws = $wb.Worksheets.Item($d.sheet)
  $ur = $ws.UsedRange
  $rowN = $ur.Rows.Count

  # Zeit je Zeile bestimmen (alle Zeit-Spalten haben denselben Wert) -> nur "Slot-Zeilen"
  $rowTime = @{}
  $slotRows = New-Object System.Collections.ArrayList
  for ($r = 4; $r -le $rowN; $r++) {
    # Nur die Stadion-Zeitspalte (c2, Fallback c6) als "Slot-Spine" nutzen — so
    # werden Legende/Sonderzeilen (die nur in anderen Spalten Zeiten haben) sauber
    # ausgeschlossen.
    $t = $null
    foreach ($tc in @(2, 6)) {
      $v = $ws.Cells.Item($r, $tc).Value2
      if ($v -is [double] -and $v -gt 0 -and $v -lt 1) { $t = $v; break }
    }
    if ($null -ne $t) { $rowTime[$r] = (To-HHMM $t); [void]$slotRows.Add($r) }
  }
  if ($slotRows.Count -eq 0) { continue }

  foreach ($court in $Courts) {
    $c = $court.col
    $runColor = $null; $runStart = $null; $runEnd = $null; $frags = $null

    $emit = {
      if ($null -ne $runStart) {
        $label = Clean-Label (($frags -join " "))
        if ($label -ne "" -and $label.ToLower() -ne "frei" -and $label.ToLower() -ne "freie zeit") {
          $script:counter++
          $kat = Get-Category $label
          [void]$belegungen.Add([ordered]@{
            id        = "b$($script:counter)"
            tag       = $d.tag
            platz     = $court.id
            start     = $rowTime[$runStart]
            ende      = (Add-Slot $rowTime[$runEnd] 30)
            label     = $label
            kategorie = $kat
            notiz     = ""
          })
          if (-not $summary.ContainsKey($kat)) { $summary[$kat] = 0 }
          $summary[$kat]++
        }
      }
    }

    foreach ($r in $slotRows) {
      $cell = $ws.Cells.Item($r, $c)
      $raw = $cell.Value2
      $txt = if ($null -eq $raw) { "" } else { ("$raw").Trim() }
      if ($txt -eq "") {
        & $emit
        $runColor = $null; $runStart = $null; $runEnd = $null; $frags = $null
        continue
      }
      $col = [int]$cell.Interior.Color
      if ($null -ne $runStart -and $col -eq $runColor) {
        $runEnd = $r
        if ($frags[-1] -ne $txt) { $frags += $txt }
      } else {
        & $emit
        $runColor = $col; $runStart = $r; $runEnd = $r; $frags = @($txt)
      }
    }
    & $emit
  }
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

# --- gültig-ab aus Dateiname/Blatt: bekannt 14.07.2025 ---
$result = [ordered]@{
  meta = [ordered]@{
    saison    = "2026/27"
    gueltigAb = "2025-07-14"
    stand     = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
    quelle    = "Endversion_Platzbelegungsplan 26-27 (Excel-Import)"
  }
  plaetze    = @($Courts | ForEach-Object { [ordered]@{ id=$_.id; name=$_.name; standort=$_.standort } })
  kategorien = @($Kategorien | ForEach-Object { [ordered]@{ id=$_.id; name=$_.name; farbe=$_.farbe } })
  belegungen = @($belegungen)
}

$json = $result | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($Out, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Output "Geschrieben: $Out"
Write-Output "Belegungen gesamt: $($belegungen.Count)"
Write-Output "--- je Kategorie ---"
$summary.GetEnumerator() | Sort-Object Name | ForEach-Object { Write-Output ("  {0,-9}: {1}" -f $_.Key, $_.Value) }
