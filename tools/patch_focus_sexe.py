#!/usr/bin/env python3
"""Focus automatique après le choix du sexe (demande de Vincent, 28/10/2026) : à la mise bas — saisie rapide comme
fiche « Ajouter un agnelage » — sélectionner le sexe d'un agneau met le curseur dans SA case d'EID, pour biper
l'agneau directement sans tap intermédiaire. Appliqué par .github/workflows/vibe-fix.yml (événement pull_request),
car www/index.html est trop gros pour l'édition directe par l'assistant. Idempotent (marqueur window.__focusApresSexe).
Le bloc est inséré au DÉBUT DE LA LIGNE de chaque définition de « function onEidScanned » (la fonction est dupliquée
dans le fichier) : l'écouteur, protégé par le marqueur, n'est enregistré qu'une seule fois. En cas d'échec, RIEN n'est
modifié : un diagnostic avec toutes les occurrences est écrit dans tools/diag_focus_sexe.txt."""
import pathlib
import sys

RACINE = pathlib.Path(__file__).resolve().parents[1]
FICHIER = RACINE / "www" / "index.html"
DIAG = pathlib.Path(__file__).resolve().parent / "diag_focus_sexe.txt"
ANCRE = "function onEidScanned"
MARQUEUR = "__focusApresSexe"

BLOC = """// Focus automatique après le choix du sexe (28/10/2026, demande de Vincent en agnelage) : à la mise bas (saisie
// rapide et fiche « Ajouter un agnelage »), choisir le sexe d'un agneau met le curseur dans SA case d'EID, pour biper
// l'agneau directement sans tap intermédiaire. Ne change rien d'autre : case absente (mort-né sans scan) ou autre
// vue, rien ne se passe ; le chaînage brebis au champ de scan est inchangé. Marqueur : un seul écouteur enregistré,
// bien que onEidScanned soit dupliquée dans ce fichier.
if (!window.__focusApresSexe) {
  window.__focusApresSexe = true;
  document.addEventListener('click', function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest('.sexe-opt-rapide, .sexe-opt') : null;
    if (!btn) return;
    if (currentView !== 'misebas-rapide' && currentView !== 'add-agnelage') return;
    var id = btn.getAttribute('data-id');
    if (id == null) return;
    var suffixe = (currentView === 'misebas-rapide') ? '-rapide' : '';
    var cible = document.querySelector('input.eid-input' + suffixe + '[data-id="' + id + '"]');
    if (cible && !cible.disabled) cible.focus();
    setTimeout(function () {
      var c = document.querySelector('input.eid-input' + suffixe + '[data-id="' + id + '"]');
      if (c && !c.disabled && document.activeElement !== c) c.focus();
    }, 0);
  });
}
"""

texte = FICHIER.read_text(encoding="utf-8")

if MARQUEUR in texte:
    print("Correctif déjà appliqué (%s présent) : rien à faire." % MARQUEUR)
    sys.exit(0)

positions = []
pos = 0
while True:
    i = texte.find(ANCRE, pos)
    if i == -1:
        break
    positions.append(i)
    pos = i + 1

def echec(raison):
    lignes = ["DIAGNOSTIC (échec du patch, aucune modification du code). Raison : " + raison, ""]
    for n, i in enumerate(positions, 1):
        lignes.append("=== occurrence %d de l'ancre (position %d) ===" % (n, i))
        lignes.append("--- AVANT ---")
        lignes.append(texte[max(0, i - 400): i])
        lignes.append("--- ANCRE ET SUITE ---")
        lignes.append(texte[i: i + 600])
        lignes.append("")
    DIAG.write_text("\n".join(lignes), encoding="utf-8")
    print("ÉCHEC DU PATCH : " + raison + " — rien n'a été modifié. Diagnostic écrit dans tools/diag_focus_sexe.txt (la CI le committe).")

if not positions:
    echec("ancre « %s » introuvable dans www/index.html" % ANCRE)
    sys.exit(0)

def debut_de_ligne(i):
    j = texte.rfind("\n", 0, i)
    return j + 1

emplacements = []
for i in positions:
    debut = debut_de_ligne(i)
    avant = texte[debut:i].strip()
    apres = texte[i + len(ANCRE): i + len(ANCRE) + 1]
    ok = avant in ("", "async") and apres in ("(", " ")
    emplacements.append((debut, ok))

a_inserer = [d for (d, ok) in emplacements if ok]
if not a_inserer:
    echec("aucune définition valide en début de ligne de « %s » (%d occurrence(s) trouvée(s))" % (ANCRE, len(emplacements)))
    sys.exit(0)
if len(a_inserer) != len(emplacements):
    print("NOTE : %d occurrence(s) ignorée(s) (pas une définition de la fonction en début de ligne)." % (len(emplacements) - len(a_inserer)))

for d in sorted(a_inserer, reverse=True):
    texte = texte[:d] + BLOC + texte[d:]

FICHIER.write_text(texte, encoding="utf-8")
print("Correctif appliqué : bloc de focus inséré avant %d définition(s) de %s." % (len(a_inserer), ANCRE))
