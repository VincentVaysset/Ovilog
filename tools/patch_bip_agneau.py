#!/usr/bin/env python3
"""Correctif « bip agneau » : à la mise bas (saisie rapide et fiche « Ajouter un agnelage »), le bip du lecteur Allflex doit saisir
le n° dans la case qui a le curseur (EID de l'agneau ou de sa mère adoptive) au lieu de relancer une recherche de brebis
(rapport du 28/10/2026). Appliqué par .github/workflows/vibe-fix.yml (événement pull_request), car www/index.html est trop gros
pour l'édition directe par l'assistant. Idempotent. La fonction onEidScanned est définie DEUX FOIS dans le fichier (la seconde
définition écrase la première à l'exécution) : le correctif est donc inséré après CHAQUE occurrence de l'ancre, avec la ligne
suivante vérifiée pour chacune. En cas d'échec, RIEN n'est modifié : un diagnostic est écrit dans tools/diag_oneidscanned.txt."""
import pathlib
import sys

RACINE = pathlib.Path(__file__).resolve().parents[1]
FICHIER = RACINE / "www" / "index.html"
DIAG = pathlib.Path(__file__).resolve().parent / "diag_oneidscanned.txt"
ANCRE = "  if (panneauContact) return;"
LIGNE_SUIVANTE = "  if (!activeScanTarget || !activeScanTarget.isConnected) { activeScanTarget = null; return; }"
BLOC = (
    "  // Mise bas (saisie rapide et fiche « Ajouter un agnelage ») : le bip de l'agneau — ou de sa mère adoptive — arrive dans la case qui a\n"
    "  // le curseur (rapport du 28/10/2026 : il relançait une recherche de brebis). Même chemin qu'une frappe clavier (événement\n"
    "  // input seul : aperçu, pastille, préfixe), jamais d'Entrée simulée.\n"
    "  const caseBip = (currentView === 'misebas-rapide' || currentView === 'add-agnelage') ? document.activeElement : null;\n"
    "  if (caseBip && caseBip.isConnected && caseBip.matches && caseBip.matches('input.eid-input, input.eid-input-rapide, input.adopt-eid, input.adopt-eid-rapide')) {\n"
    "    caseBip.value = eid;\n"
    "    caseBip.dispatchEvent(new Event('input', { bubbles: true }));\n"
    "    return;\n"
    "  }\n"
)

texte = FICHIER.read_text(encoding="utf-8")

def echec(raison):
    print("ÉCHEC DU PATCH : " + raison + " — rien n'a été modifié.")
    morceaux = []
    j = texte.find("function onEidScanned")
    if j == -1:
        morceaux.append("function onEidScanned : INTROUVABLE dans www/index.html")
    else:
        morceaux.append("--- function onEidScanned (extrait du code réel) ---\n" + texte[j: j + 1800])
    DIAG.write_text(
        "DIAGNOSTIC (échec du patch, aucune modification du code). Raison : " + raison + "\n\n" + "\n\n".join(morceaux),
        encoding="utf-8")
    print("Diagnostic écrit dans tools/diag_oneidscanned.txt (la CI le committe).")

if "caseBip" in texte:
    print("Correctif déjà appliqué (caseBip présent) : rien à faire.")
    sys.exit(0)

occurrences = []
pos = 0
while True:
    i = texte.find(ANCRE, pos)
    if i == -1:
        break
    occurrences.append(i)
    pos = i + 1
if not occurrences:
    echec("ancre introuvable (onEidScanned a-t-il changé ?)")
    sys.exit(0)

emplacements = []
for i in occurrences:
    fin_de_ligne = texte.find("\n", i)
    if fin_de_ligne == -1:
        emplacements.append((i, None, False))
        continue
    ligne_suivante = texte[fin_de_ligne + 1: fin_de_ligne + 1 + len(LIGNE_SUIVANTE)]
    emplacements.append((i, fin_de_ligne, ligne_suivante == LIGNE_SUIVANTE))

invalides = [e for e in emplacements if not e[2]]
if invalides:
    echec("ancre présente %d fois, mais %d occurrence(s) ne sont PAS suivies de la ligne attendue" % (len(emplacements), len(invalides)))
    sys.exit(0)

for (i, fin_de_ligne, _) in sorted(emplacements, key=lambda e: -e[0]):
    texte = texte[:fin_de_ligne + 1] + BLOC + texte[fin_de_ligne + 1:]

FICHIER.write_text(texte, encoding="utf-8")
print("Correctif appliqué : le bloc caseBip inséré après chacune des %d définition(s) de onEidScanned." % len(emplacements))
