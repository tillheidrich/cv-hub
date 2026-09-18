#!/usr/bin/env bash
# Prüft, ob Zugangsdaten oder Spuren des ursprünglichen Betreibers im Baum
# liegen. Läuft in der CI UND lokal — mit denselben Mustern, weil zwei Kopien
# derselben Regel früher oder später auseinanderlaufen.
#
#   ./scripts/neutralcheck.sh        vor jedem Push, besonders nach einem
#                                    Abgleich mit dem privaten Werkzeug
#
# Hintergrund: Dieses Projekt ist aus einem privaten Werkzeug herausgelöst
# worden. Die Entpersonalisierung war Handarbeit, und Handarbeit hält nicht von
# selbst — vor allem nicht, wenn eine Datei im Ganzen aus dem Original
# herüberkopiert wird. Genau so ging am 18.09.2026 die neutralisierte Fassung
# von `LandingScreen.tsx` verloren.
#
# ── Warum die personenbezogenen Muster NICHT hier stehen ────────────────────
# Sie standen hier, wörtlich: Straße, Postleitzahl, Telefonnummer, private
# Maildomain — in einem öffentlichen Repository, in einer Datei, die sich von
# der eigenen Suche ausnimmt. Ein Wächter, der die gesuchten Daten selbst
# veröffentlicht, hebt sich auf. Sie kommen deshalb von außen:
#
#   NEUTRAL_EXTRA        ein erweiterter regulärer Ausdruck (ERE), ODER
#   NEUTRAL_EXTRA_FILE   eine Datei mit einem Muster je Zeile (# = Kommentar)
#
# In der CI als Repository-Secret `NEUTRAL_EXTRA` hinterlegt. Lokal zieht das
# Skript sie von selbst aus dem privaten Zwilling, wenn er daneben liegt
# (../cv-tool/scripts/neutral-extra.txt). Fehlen sie, läuft die Prüfung
# trotzdem — aber sie sagt laut, dass sie weniger geprüft hat, als sie könnte.
set -uo pipefail

# ── HART: darf nirgends stehen ──────────────────────────────────────────────
# Nur generische Zugangsdaten-Muster; die sind selbst kein Geheimnis.
HART='ghp_[A-Za-z0-9]{20,}|github_pat_|xox[baprs]-|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY'

# ── WEICH: Spuren des ursprünglichen Betreibers ─────────────────────────────
# Die Domain darf an GENAU EINER Stelle stehen — als Adresse der Demo-Instanz
# in der README. Wortmarke und Firmenname nirgends: Ein fremder Betreiber will
# keine fremde Marke in seiner Fußzeile. Diese Muster stehen offen hier, weil
# die Demo-Adresse ohnehin in der README steht — und weil genau dieser Teil des
# Wächters den Vorfall vom 18.09. gefunden hat.
WEICH='heidrich-digital|Heidrich/cv|Heidrich Digital'
ERLAUBT='https://cv\.heidrich-digital\.de'

AUS=(-- . ':!package-lock.json' ':!**/package-lock.json' ':!.github/workflows/ci.yml' ':!scripts/neutralcheck.sh')

# ── Zusatzmuster laden ──────────────────────────────────────────────────────
EXTRA="${NEUTRAL_EXTRA:-}"
if [ -z "$EXTRA" ]; then
  DATEI="${NEUTRAL_EXTRA_FILE:-$(dirname "$0")/../../cv-tool/scripts/neutral-extra.txt}"
  if [ -r "$DATEI" ]; then
    EXTRA=$(grep -vE '^\s*(#|$)' "$DATEI" | paste -sd '|' -)
  fi
fi

FEHLER=0

if [ -n "$EXTRA" ]; then
  if git grep -nIE "$EXTRA" "${AUS[@]}"; then
    echo "::error::Personenbezogene Daten des ursprünglichen Betreibers gefunden."
    FEHLER=1
  fi
else
  echo "::warning::Zusatzmuster nicht geladen — Anschrift, Telefonnummer und" \
       "private Maildomain wurden NICHT geprüft. Setze NEUTRAL_EXTRA" \
       "(CI-Secret) oder lege den privaten Zwilling daneben."
fi

if git grep -nIE "$HART" "${AUS[@]}"; then
  echo "::error::Zugangsdaten gefunden."
  FEHLER=1
fi

REST=$(git grep -nIE "$WEICH" "${AUS[@]}" | grep -vE "$ERLAUBT" || true)
if [ -n "$REST" ]; then
  echo "$REST"
  echo "::error::Spur des ursprünglichen Betreibers außerhalb des Demo-Links in der README."
  FEHLER=1
fi

[ "$FEHLER" -eq 0 ] && echo "sauber"
exit $FEHLER
