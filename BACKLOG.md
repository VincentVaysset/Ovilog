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
