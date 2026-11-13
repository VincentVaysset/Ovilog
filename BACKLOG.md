# Backlog Ovilog

Points identifiés, non planifiés. Un point sort d'ici quand il est validé puis livré.

## Anomalie de lactation SIEOL (`ano_lact`) : à revoir

L'import SIEOL du contrôle laitier ne garde plus l'anomalie de lactation du cahier (`ano_lact`) : seuls les
contrôles et le n° de lactation sont repris. Le code 10 (vide définitive) est cherché dans l'anomalie de chaque
contrôle et dans l'anomalie repro (`ano_repro`). À voir plus tard avec l'éleveur : l'anomalie de lactation peut-elle
servir (code 10 ou autre) ? Si oui, la reprendre à l'import et l'afficher (plan validé avant tout code).

## Imports : « SIEOL ou modèle Ovilog » partout

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
