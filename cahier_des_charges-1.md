# Cahier des charges — Application de gestion de troupeau (ovins laitiers Lacaune)

**Plateforme** : Android (téléphone + tablette), avec synchronisation automatique entre les deux appareils — modifications possibles sur l'un ou l'autre
**Stockage** : base de données cloud avec mode hors-ligne (ex: Firebase ou Supabase) — l'appli fonctionne sans réseau en bergerie et se resynchronise automatiquement dès que la connexion revient. Gratuit ou très peu coûteux pour un cheptel de cette taille.
**Lecteur** : Allflex LPR en mode clavier (HID) — le scan d'une boucle EID insère automatiquement le numéro dans le champ actif
**Campagne agricole** : du 1er octobre au 30 septembre (les stats et bilans doivent pouvoir se baser sur la campagne, pas uniquement l'année civile)
**Cheptel** : 100 à 500 brebis + inventaire béliers séparé + inventaire agnelles séparé
**Export** : possibilité d'exporter vers Excel à tout moment, en plus de la synchro cloud (sécurité et analyse)

---

## 1. Fiche brebis

- N° EID complet (scan LPR), **numéro officiel = les 5 derniers chiffres de l'EID** (ex: EID `250 016299131098` → numéro officiel `31098`), année de naissance (calculée depuis l'EID comme dans le fichier Excel actuel), race
- Statut : active / réformée / morte / vendue
- Historique complet consultable en un écran : reproduction, agnelages, sanitaire, contrôle laitier, mouvements

## 2. Inventaire béliers (annexe séparée)

- Fiche similaire (EID, n° visuel, année de naissance, statut)
- Volet carnet sanitaire propre (mêmes catégories que les brebis) — mêmes fonctions mais dans une liste distincte
- Pas de suivi reproduction/laitier (sauf si utile à ajouter plus tard, ex: lots de saillie)

## 3. Reproduction — Lutte et Échographie

### Lutte
- Une **date de lutte commune** pour l'ensemble des brebis
- Une **date de lutte commune** séparée pour les agnelles de l'année
- Pas de suivi de généalogie / paternité (pas besoin de savoir quel bélier a couvert quelle brebis)

### Échographie
- **Historique, pas un champ unique** : une brebis peut être échographiée plusieurs fois dans la campagne (1er passage souvent provisoire, notamment sur les "vides" qui peuvent se révéler gestantes au contrôle suivant). Chaque échographie est un évènement daté et vient s'ajouter à l'historique de l'animal — la dernière en date fait référence pour les statistiques du moment, mais les précédentes restent consultables.
- Pour chaque échographie, on renseigne :
- **Stade** : Début / Milieu / Fin / Vide
- **Nombre d'agneaux** (si non vide) : simple / double
- **Parasitisme** : case à cocher indépendante du stade (c'est une observation, pas une variante — ça correspond à l'actuel "P" du fichier Excel)
- Cas particuliers **modulables** : pseudogestation, avortée, et toute autre observation ajoutée librement par l'éleveur (pas de liste figée dans le code — on doit pouvoir en créer une nouvelle depuis l'appli)
- Calculs automatiques : taux de réussite, prolificité — basés sur le dernier résultat en date de chaque brebis, globaux, par âge, et par campagne

## 4. Agnelage

- Depuis la fiche de la mère (scan de la brebis dans son parc) : "Ajouter un agnelage"
- Pour chaque agneau né : bip EID (boucle posée dans les 24h, une fois l'agneau sec — donc bouclage définitif dès la saisie, pas de bouclage provisoire à gérer), sexe, date de naissance
- Affectation automatique de l'agneau à sa mère (lien mère/agneau dans l'historique des deux fiches)
- **Adoption** : possibilité de rattacher un agneau à une mère adoptive différente de sa mère biologique (l'historique doit garder trace des deux : mère biologique et mère adoptive)
- **Mort-né** : case à cocher qui remplace le scan EID (pas de boucle posée sur un mort-né, donc pas de bip)
- **Mort après naissance (ex: à J+3, une fois bouclé)** : ne se gère plus depuis l'agnelage — l'agneau a déjà sa fiche comme n'importe quel animal, donc on passe par l'écran "Mouvement" standard (section 7)
- **Vente des agneaux** : se fait généralement autour d'un mois d'âge — c'est un mouvement "Vendue" fréquent à prévoir dans les statistiques/exports (volume important sur un troupeau laitier)

### Agnelles — inventaire distinct des brebis

Pendant toute une campagne, les **agnelles forment un inventaire séparé du troupeau de brebis** — elles ne rejoignent le troupeau (et ne redeviennent suivies comme des brebis, reproduction incluse) qu'**au début de la campagne suivante (1er octobre)**.

Deux origines possibles pour une agnelle dans cet inventaire :
1. **Nées sur l'exploitation et triées pour le renouvellement** (cf. ci-dessus, ~80/an) — passent automatiquement dans l'inventaire agnelles au moment du tri
2. **Achetées à l'extérieur** (~30/an), autour d'un mois d'âge — entrée directe dans l'inventaire par un simple **bip de l'agnelle** (pas besoin de passer par l'écran "Mouvement" d'une fiche existante puisque l'animal n'existe pas encore dans la base)

**Passage agnelles → brebis** : à prévoir comme une bascule (individuelle ou en masse) au moment du changement de campagne — l'agnelle devient alors une brebis à part entière, suivie normalement (échographie, lutte, etc.)

## 5. Carnet sanitaire (brebis et béliers)

- Ajout d'un évènement, classé en 3 types :
- **Vaccins**
- **Traitements** — avec sous-catégories : antibiotiques, antiparasitaires, anti-inflammatoires
- **Autre** — uniquement soin de plaie (pas de catégorie fourre-tout au-delà)
- **Liste des produits modulable et rangée par catégorie** : l'éleveur ajoute un nouveau produit à la volée et le classe dans sa catégorie (vaccin / type de traitement / autre)
- Champs par évènement : type, catégorie, produit, date, dose si pertinent, commentaire
- Possibilité de saisie **groupée** (scanner plusieurs animaux d'un coup pour un même soin — ex: vaccination de tout le lot)
- Historique consultable par animal et vue d'ensemble

### Posologie officielle — V1.5

- L'ANMV (Agence Nationale du Médicament Vétérinaire) publie une **base de données publique** de tous les médicaments vétérinaires autorisés en France, mise à jour chaque semaine, incluant pour chaque produit : espèce cible, dose recommandée, et surtout le **temps d'attente lait et viande**
- **Objectif V1.5** : intégrer cette base pour qu'au moment de choisir un produit, l'appli affiche automatiquement son temps d'attente officiel — et puisse alerter sur une fiche brebis ("délai d'attente lait jusqu'au [date]") après un traitement
- Non prioritaire pour la V1 (la base fonctionne d'abord avec des produits saisis librement, sans données réglementaires liées) — mais à garder en tête dès la conception du modèle de données pour faciliter le branchement plus tard

## 6. Contrôle laitier

- 3 contrôles par campagne
- **Import prioritaire** : les mesures sont prises par un agent externe (via SIEOL) qui produit un export (CSV/Excel, comme celui qu'il transmet aujourd'hui à Venus ou sur papier) — l'appli doit pouvoir **importer ce fichier directement**, sans ressaisie brebis par brebis
- **À faire avant de coder cette partie** : récupérer un exemplaire réel de ce fichier auprès de l'agent ou de la coopérative, pour construire l'import exactement sur sa structure (colonnes, format des EID, etc.)
- Saisie manuelle gardée en secours (correction ponctuelle, brebis oubliée) mais plus le mode principal
- Cumul et moyenne par brebis sur la campagne, classement/tri possible

## 7. Mouvements d'animaux

- Types de mouvement : **Morte** (avec une cause choisie dans une **liste modulable** — liste des causes à fournir plus tard, structure prête à l'accueillir) / **Vendue** (avec choix de l'acheteur dans un répertoire) / **Vendue reproduction** / **Née** (agnelage, cf. section 4)
- L'entrée d'agnelles achetées ne passe pas par cet écran : c'est un bip direct dans l'inventaire agnelles (cf. section 4)
- Répertoire des acheteurs : liste gérable (ajouter/modifier un acheteur), pour éviter de retaper à chaque fois
- Chaque mouvement change le statut de l'animal et reste dans son historique (traçabilité)

## 8. Réforme *(reporté)*

Non traité dans cette V1 — trop de risque d'erreur pour l'instant. À reprendre une fois le reste de l'appli stabilisé et testé sur le terrain.

## 9. Statistiques / Tableau de bord

- Vue d'ensemble troupeau : effectif par âge, par stade de gestation, **effectif agnelles (inventaire séparé)**
- **Nombre de mises bas** et **nombre total d'agneaux nés** sur la campagne (statistique clé à afficher en évidence)
- Taux de réussite et prolificité (global, par âge, par campagne, avec comparaison campagne N vs N-1)
- Suivi laitier : production moyenne, cumulée
- Alertes simples (ex: brebis vides, brebis à réformer, retards de vaccin)

## 10. Export

- Export Excel des données (fiches, historique, stats) dans un format proche du fichier de synthèse actuel
- Sauvegarde/restauration de la base pour sécuriser les données (copie du fichier local vers Drive ou autre)

---

## Décisions prises

- **Réforme** : reportée à plus tard (même la liste manuelle) — trop de risques d'erreur pour l'instant, on la traitera une fois le reste stabilisé
- **TB/TP (contrôle laitier)** : reporté à plus tard, on garde la base (quantité de lait) pour la V1
- **Lots/parcs** : pas de regroupement, pas nécessaire
- **Lutte** : une date commune pour les brebis, une date commune pour les agnelles de l'année ; pas de généalogie/paternité à suivre
- **Échographie** : historique par brebis (plusieurs passages possibles dans la campagne), stade Début/Milieu/Fin/Vide, nombre d'agneaux, et parasitisme comme observation indépendante (case à cocher)
- **Agnelage** : bouclage définitif systématique dans les 24h (pas de bouclage provisoire à gérer), workflow "scan brebis → scan agneau → sexe"
- **Adoption** : à gérer (mère adoptive distincte de la mère biologique) — **biberons non nécessaires**

## S'inspirer des standards du métier (constatés chez des logiciels équivalents)

- Génération automatique de lots après une campagne d'échographie (vides / simples / doubles) pour faciliter le tri
- Bouclage **provisoire puis définitif** pour les agneaux (utile si tu boucles à la naissance avec un numéro temporaire avant la boucle électronique officielle)
- Gestion des **biberons et adoptions** au moment de l'agnelage
- Fiche brebis qui s'ouvre automatiquement au scan pour enchaîner la saisie

## Prochaine étape

Une fois ces points validés, on pourra :
1. Définir précisément le modèle de données (les tables et leurs liens)
2. Choisir la techno (Kotlin natif ou Flutter/React Native pour rester multiplateforme)
3. Commencer par un premier module fonctionnel (probablement fiche brebis + scan HID + échographie, puisque c'est ce qu'on a déjà bien cadré)
