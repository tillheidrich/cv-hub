#!/usr/bin/env bash
# Prüft, ob personenbezogene Daten oder Spuren des ursprünglichen Betreibers
# im Baum liegen. Läuft in der CI UND lokal — mit denselben Mustern, weil zwei
# Kopien derselben Regel früher oder später auseinanderlaufen.
#
#   ./scripts/neutralcheck.sh        vor jedem Push, besonders nach einem
#                                    Abgleich mit dem privaten Werkzeug
#
# Hintergrund: Dieses Projekt ist aus einem privaten Werkzeug herausgelöst
# worden. Die Entpersonalisierung war Handarbeit, und Handarbeit hält nicht von
# selbst — vor allem nicht, wenn eine Datei im Ganzen aus dem Original
# herüberkopiert wird. Genau so ging am 18.09.2026 die neutralisierte Fassung
# von `LandingScreen.tsx` verloren.
set -uo pipefail

# HART: darf nirgends stehen — Anschrift, Telefonnummer, private Mailadresse,
# Zugangsdaten jeder Art.
HART='Rotdornweg|21255 Tostedt|73953819|tillheidrich\.de|ghp_[A-Za-z0-9]{20,}|github_pat_|xox[baprs]-|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY'

# WEICH: Spuren des ursprünglichen Betreibers. Die Domain darf an GENAU EINER
# Stelle stehen — als Adresse der Demo-Instanz in der README. Wortmarke,
# Firmenname und Rechenzentrumsstandort nirgends: Ein fremder Betreiber will
# weder eine fremde Marke in seiner Fußzeile noch eine Ortsangabe, die für
# seine Instanz schlicht falsch ist.
WEICH='heidrich-digital|Heidrich/cv|Heidrich Digital|in Falkenstein'
ERLAUBT='https://cv\.heidrich-digital\.de'

AUS=(-- . ':!package-lock.json' ':!**/package-lock.json' ':!.github/workflows/ci.yml' ':!scripts/neutralcheck.sh')

FEHLER=0
if git grep -nIE "$HART" "${AUS[@]}"; then
  echo "::error::Personenbezogene Daten oder Zugangsdaten gefunden."
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
