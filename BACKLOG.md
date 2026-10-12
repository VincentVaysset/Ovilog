# Backlog Ovilog

Points identifiés, non planifiés. Un point sort d'ici quand il est validé puis livré.

## À corriger avant 2029

- **`anneeNaissance(eid)` (www/index.html)** : l'année est déduite du seul chiffre d'année de
  l'EID (`2020 + chiffre`, moins 10 si l'année dépasse l'année courante), ce qui suppose des
  animaux de moins de 10 ans. À partir de 2030, un animal né en 2030 (chiffre 0) serait lu
  comme né en 2020 : il ne serait jamais « le millésime le plus jeune » (règle antenaise du
  Bilan de reproduction) et son âge affiché serait faux. À corriger avant 2029 (par exemple en
  ancrant la décennie sur la date d'entrée de l'animal ou sur son mouvement « Naissance »,
  avec validation de l'éleveur avant tout changement de classement).

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
