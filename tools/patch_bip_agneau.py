#!/usr/bin/env python3
"""Correctif « bip agneau » : à la mise bas (saisie rapide et fiche « Ajouter un agnelage »), le bip du lecteur Allflex doit saisir
le n° dans la case qui a le curseur (EID de l'agneau ou de sa mère adoptive) au lieu de relancer une recherche de brebis
(rapport du 28/10/2026). Appliqué par .github/workflows/vibe-fix.yml sur la branche claude/vibe-fix-bip-agneau, car www/index.html
est trop gros pour l'édition directe par l'assistant. Idempotent ; échoue franchement (sans rien modifier) si le point d'ancrage
n'est pas trouvé exactement tel qu'attendu."""
import pathlib
import sys

FICHIER = pathlib.Path(__file__).resolve().parents[1] / "www" / "index.html"
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
if "caseBip" in texte:
    print("Correctif déjà appliqué (caseBip présent) : rien à faire.")
    sys.exit(0)
debut = texte.find(ANCRE)
if debut == -1:
    sys.exit("ERREUR : ancre introuvable dans onEidScanned — rien n'a été modifié.")
if texte.find(ANCRE, debut + 1) != -1:
    sys.exit("ERREUR : ancre présente plusieurs fois — rien n'a été modifié.")
fin_de_ligne = texte.find("\n", debut)
ligne_suivante = texte[fin_de_ligne + 1: fin_de_ligne + 1 + len(LIGNE_SUIVANTE)]
if ligne_suivante != LIGNE_SUIVANTE:
    sys.exit("ERREUR : la ligne suivant l'ancre n'est pas celle attendue — rien n'a été modifié.")
FICHIER.write_text(texte[:fin_de_ligne + 1] + BLOC + texte[fin_de_ligne + 1:], encoding="utf-8")
print("Correctif appliqué : à la mise bas, le bip saisit le n° dans la case qui a le curseur (agneau ou mère adoptive).")
