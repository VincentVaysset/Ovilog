# Écrans à migrer vers la charte graphique

Relevé en lecture seule (aucun écran modifié) des endroits qui utilisent encore l'ancien style gris, un tableau « tableur » de l'ancien gabarit, une bulle d'aide « ? » (toutes supprimées, voir la section 4) ou des couleurs écrites en dur hors de la charte (voir la section « Charte graphique » de `CLAUDE.md`). Méthode : analyse de chaque fonction de rendu de `www/index.html` (couleurs `#rrggbb` absentes de la charte, gabarits `REGISTRE_TH/TD` et `table-desktop`, `infoBulleHtml`, fonds gris `#f0efe9`, `#f7f5ee`, `#f6f3ea`, `--gray-bg`).

Les écrans déjà conformes (non listés) : Production laitière (Tank, Qualité, Bilan économique), Paramètres, Déclaration annuelle, Calendrier, Inventaire (PC, mobile, PDF), Registre d'élevage (PC, mobile, PDF), Contrôle laitier (mobile), Bilan de campagne mobile (Brebis à régulariser, Bilan de reproduction), Mouvements d'animaux (mobile : liste et « Nouveau mouvement ») et tous les PDF.

## 1. Styles globaux (CSS)
Socle aligné sur la charte (chantier « listes Brebis / Béliers / Agneaux / Agnelles ») : fond des onglets (`.tab-bar`, `.fiche-tabs`, pistes de barres, `.badge-muted`, `.pc-pill.neutral`) en `#efe9da` ; lignes alternées / survol en `#f6f1e4` ; `--gray-bg` / `--gray-fg`, `--text-muted` (`#5e5b47`), `--danger` et `--coral-*` (rouge unique `#a33a31`), `--green-*`, `--amber-*`, `--blue-*`, `--indigo-*` (= bleu charte) pointent vers les variables `--ch-*`. Plus aucun ancien gris (`#f0efe9`, `#f0eee6`, `#f7f5ee`, `#f6f3ea`, `#eceae3`) dans le code (vérifié par `test_charte_graphique`).
Reste à faire : `.table-desktop` (en-tête gris-beige `#efe9da` au lieu du vert `#357f4b` avec texte blanc) pour Mouvements passés, Mise bas rapide, Ordonnances, Sous délai d'attente, tableaux des fiches.

## 2. Écrans avec couleurs écrites en dur hors charte
| Écran (fonction) | Couleurs hors charte | Remarque |
|---|---|---|
| Accueil PC (`accueilDesktopHtml`), tuiles du tableau de bord (`dashboardKpiHtml`) | `#c7dcea`, `#eee` | |
| Bilan de lactation PC (`bilanLactationDesktopHtml`) | `#cfe3d5` | |
| Bilan économique PC, ancienne version (`bilanEconomiqueDesktopHtml`) | `#a9cdb8`, `#f0efe9` | remplacé par la page Production laitière |
| Barres des pages PC (`pcBarres`) | `#cfe3d5`, `#eb6834` | |
| Brebis à régulariser PC (`bilanARegulariserDesktopHtml`) | `#6c8ebf`, `#e8b38f`, `#eb6834` | |
| Contrôle laitier (`renderControleLaitier`), carte « sans contrôle » (`carteSansControleLaitierHtml`) | `#a9cdb8`, `#eb6834`, `#e8c88a`, `#f4f4f4`, `#fbe3df` | |
| Tank (carte de tableau de bord, `plTankHtml`) | `#b9d4ea` | |
| Ajout d'échographie (`renderAddEcho`) | `#add` | |

## 3. Écrans avec tableau de l'ancien gabarit (à passer en cartes sur mobile, tableau charte sur PC)
`REGISTRE_TH` / `REGISTRE_TD` et `table-desktop` : Historique des échographies (8 usages), Ordonnances, Sous délai d'attente, Mise bas rapide (PC), Mouvements passés / traitements collectifs (historiques), tableau du carnet sanitaire.

## 4. Bulles d'aide « ? » : terminé
Les 31 bulles « ? » (`infoBulleHtml`) ont été supprimées de tous les écrans ; la fonction, son registre de textes et la fenêtre d'aide n'existent plus (vérifié par `test_info_bulles`). Chaque texte est conservé tel quel, écran par écran, dans `docs/manuel_aides_ecrans.md` (futur manuel d'utilisation), avec la décision prise pour lui.
Reste à l'écran, seulement quand elle évite une erreur de saisie, un effet inattendu ou une perte de données, une ligne d'information courte (`infoLigneHtml`, classe `.info`, 13 px, `#5e5b47`) : Campagne concernée (ajout d'écho et saisie rapide), critères d'échographie des lots, recherche en bergerie, Sous délai d'attente, Contrôle de lot, Traitements collectifs (suppression), Conflits à trancher (import SIEOL) ; et un texte sous le champ « Type de suivi laitier » (Première configuration).

## 5. En-tête et PDF
- Le vert de l'en-tête et du bouton principal (`--primary`) est aligné sur la charte (`#357f4b`) ; l'ancienne valeur était `#3c8a55`.
- Dans les PDF, le filet vert et les titres de section (`PDF_COULEURS.vert`, `PDF_PL_COUL.vertTitre`) gardent l'ancienne teinte `#3c8a55` / `#2f6e44` : à aligner avec la prochaine passe PDF (les en-têtes de tableau et les tuiles utilisent déjà la charte via `PDF_CHARTE`).
- Les anciennes variables sémantiques (`--text`, `--text-muted`, `--green-bg`, `--coral-fg`…) sont alignées sur les variables `--ch-*` (voir section 1).
- Écran PC « Échographies » (Résultats + Historique) migré, en consultation seule ; sa saisie reste sur mobile (écran « Nouvelle session » et historique mobile à migrer plus tard : bulle « ? », tableau à l'ancien gabarit).
- Accueil mobile « Mon troupeau » migré (tuiles, Mises bas, À surveiller, Dernière échographie, Contrôle laitier) ; plus aucun titre répété sous le bandeau vert sur mobile (audit de tous les écrans).
- Listes mobiles migrées : Brebis, Béliers (lignes compactes dans une carte), Agneaux (segmenté + cartes) ; Agnelles : couleurs et styles de la charte seulement (cartes inchangées) ; fiches Brebis / Béliers / Agnelles / Agneaux (PC et mobile) à la charte, structure inchangée ; en-têtes verts des tableaux Brebis / Béliers PC et de l'en-tête « campagne » de Carrière.
