# Backlog Ovilog

Points identifiés, non planifiés. Un point sort d'ici quand il est validé puis livré.

## Impressions : tous les écrans à revoir

Audit fait (18 PDF) : pages bien remplies, rien de coupé, mais les PDF en paysage s'impriment réduits sur tablette
(Contrôle laitier, Registre agnelage / mouvements / sanitaire, Échographies aujourd'hui et passages, Bilan du lot IA,
Traitements sur 12 mois). Le Tri des agnelles est passé en portrait avec « Colonnes à afficher ». À décider avec
l'éleveur, écran par écran, avec un visuel avant tout code : passage en portrait, colonnes à cocher ou non (jamais
pour les documents officiels : Registre, Déclaration, Traitements sur 12 mois), et un bouton « Imprimer » à la place
de « Export PDF » ou en plus.

À ajouter aussi : l'EFFECTIF en bas de chaque liste d'animaux imprimée (« 48 agnelles », « 132 brebis »…), sous le
tableau, sur toutes les listes (demande de l'éleveur).

Orientation choisie à l'impression : un PDF portrait imprimé en « Paysage » sur la tablette n'occupe qu'une partie de la feuille
(l'appli ne voit pas ce choix, fait après elle). Piste : le bouton « Imprimer » passerait par l'impression Android
(PrintManager / PrintDocumentAdapter), qui donne à l'appli le papier et l'orientation choisis : la mise en page serait refaite
pour remplir la feuille en portrait comme en paysage. Chantier natif (Android), plan et visuels avant tout code.

## Anomalie de lactation SIEOL (`ano_lact`) : à revoir

L'import SIEOL du contrôle laitier ne garde plus l'anomalie de lactation du cahier (`ano_lact`) : seuls les
contrôles et le n° de lactation sont repris. Le code 10 (vide définitive) est cherché dans l'anomalie de chaque
contrôle et dans l'anomalie repro (`ano_repro`). À voir plus tard avec l'éleveur : l'anomalie de lactation peut-elle
servir (code 10 ou autre) ? Si oui, la reprendre à l'import et l'afficher (plan validé avant tout code).

## Imports : « SIEOL ou modèle Ovilog » partout

Décisions de l'éleveur pour ce chantier (le « point sur les imports ») : UNE seule application (jamais de mode « avec / sans
SIEOL »), un langage simple compris sans SIEOL ; « SIEOL » n'est nommé que là où c'est lui (source « Depuis SIEOL »).
Renommage partout d'un coup (écrans, PDF, Excel, modèles) : « n° court SIEOL » → « n° de travail » ; « n° long SIEOL » →
« n° de travail complet » (« N° travail compl. » dans une colonne étroite). Modèles Excel lisibles sans SIEOL (une ligne
par colonne, codes de contrôle nommés : « /10 = vide définitive »). Puis rapprochement SIEOL ↔ Ovilog à chaque import
(inconnues d'Ovilog, absentes de SIEOL, mises bas jamais contrôlées, vides) et liste « À transmettre au technicien ».

Idée de l'éleveur : comme la carte « Contrôle laitier » (fichiers SIEOL puis modèle Excel Ovilog), proposer les deux
sources pour chaque import qui s'y prête (Lactation, Correspondance SIEOL…). Plan à faire.

## Synchro : écriture locale dans la seconde qui suit un lancement ou une connexion

Constaté avec le faux backend de test (`tests/lib`) : une modification enregistrée dans la
seconde qui suit la création d'un compte (ou une connexion) peut croiser le premier instantané
distant, reçu après l'écriture locale. L'appli le traite alors comme une suppression faite
ailleurs : le journal du faux backend montre un `delete` des documents du registre, réécrits
environ 1,7 s plus tard. Le faux backend livre ses instantanés par interrogation périodique, ce
qui permet cet ordre inversé ; Firestore réel superpose les écritures locales en attente et ne
devrait pas le faire, mais **cela n'a jamais été vérifié sur le vrai Firestore**. Risque réel
supposé : une modification dans la seconde après un lancement ou une connexion. À vérifier sur
Firestore réel (ou à protéger : ignorer un instantané plus ancien que la dernière écriture locale
confirmée de la collection, voir `startListeners` / `fusionnerInstantaneDistant`). Contournement
dans les tests : `test_dedoublonnage_registre` laisse la synchro initiale se stabiliser 3 s.
