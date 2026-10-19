# Ovilog — extraction de la charte graphique

Document de synthèse, produit **en lecture seule** : aucun fichier de l'application n'a été modifié.

- **Source unique du style** : `www/index.html` (≈ 30 800 lignes, une seule balise `<style>` aux lignes 7–1492, HTML + CSS + JS dans le même fichier). C'est le fichier chargé par Capacitor (Android) et par Electron (PC) ; les deux plateformes partagent exactement le même CSS (`body.desktop-shell` distingue le PC, `body:not(.desktop-shell)` le mobile).
- `index-7.html` (racine) est un **ancien prototype** : palette différente (`--primary: #3c7a4e`, `--accent: #e3812f`…), il n'est plus la référence. Ne pas l'utiliser.
- Les numéros de ligne `Lnnn` ci-dessous renvoient à `www/index.html` à la date de l'extraction.
- Les blocs CSS sont copiés **tels quels** (commentaires d'origine compris). Seule exception : les données `base64` des polices, remplacées par `…BASE64…` (≈ 150 Ko au total) ; elles sont dans `www/index.html` L16, L25, L32, L39.
- Règle maison (CLAUDE.md) : **aucune couleur en dur hors des variables `--ch-*`** du `:root` et des constantes PDF (`PDF_CHARTE`, `PDF_COULEURS`). Vérifié : dans la balise `<style>`, tous les hex sont dans le `:root` ; ailleurs ne subsistent que des `rgba()` d'ombres/voiles.

## Sommaire

1. [CSS de base : polices, `:root`, `body`](#1-css-de-base)
2. [Styles des composants clés](#2-styles-des-composants-clés)
3. [HTML d'exemple de chaque composant](#3-html-dexemple-de-chaque-composant)
4. [Palette](#4-palette)
5. [Rayons, ombres, espacements, tailles de police](#5-rayons-ombres-espacements-tailles-de-police)
6. [Icônes](#6-icônes)
7. [Mode sombre](#7-mode-sombre)

---

## 1. CSS de base

### 1.1 `@import` / chargement des polices

**Il n'y a aucun `@import`, aucun `<link>` vers Google Fonts ni CDN** : l'appli doit fonctionner hors ligne dès le premier lancement. Les deux familles sont embarquées en `@font-face` avec `src: url(data:font/woff2;base64,…)` :

| Famille | Graisses | Usage |
|---|---|---|
| `Roboto` (sous-ensemble latin, `@fontsource/roboto` 5.3.0, licence SIL OFL 1.1) | 400, 500, 700 | Police de tout le texte (`body`) ; sur Android c'est aussi la police native |
| `Fredoka` (sous-ensemble latin) | 700 | **Uniquement** le wordmark « OVILOG » (`.brand-name`) |

Pile de repli du `body` : `Roboto, -apple-system, "Segoe UI", Arial, sans-serif`. Les chiffres sont tabulaires (`font-variant-numeric: tabular-nums`) sur tuiles, tableaux et numéros.

### 1.2 `@font-face`, variables `:root`, reset et `body`

_Source : `www/index.html` L8–83 (`<style>` commence L7)._

```css
  /* Police du wordmark "OVILOG" — embarquée en base64 (sous-ensemble latin,
     couvre les accents français) plutôt que chargée depuis Google Fonts :
     l'appli doit rester utilisable hors ligne dès le premier lancement. */
  @font-face {
    font-family: 'Fredoka';
    font-style: normal;
    font-weight: 700;
    font-display: swap;
    src: url(data:font/woff2;base64,…BASE64…) format('woff2');
  }
  /* Police Roboto (charte) -- embarquée en base64, sous-ensemble latin (400, 500, 700), pour s'afficher à l'identique sur PC (Electron) sans réseau ;
     sur Android elle est déjà la police native. Roboto (Google) : licence SIL Open Font License 1.1 (https://openfontlicense.org), via le paquet @fontsource/roboto 5.3.0. */
  @font-face {
    font-family: 'Roboto';
    font-style: normal;
    font-weight: 400;
    font-display: swap;
    src: url(data:font/woff2;base64,…BASE64…) format('woff2');
  }
  @font-face {
    font-family: 'Roboto';
    font-style: normal;
    font-weight: 500;
    font-display: swap;
    src: url(data:font/woff2;base64,…BASE64…) format('woff2');
  }
  @font-face {
    font-family: 'Roboto';
    font-style: normal;
    font-weight: 700;
    font-display: swap;
    src: url(data:font/woff2;base64,…BASE64…) format('woff2');
  }
  :root {
    /* ---- Charte graphique Ovilog (CLAUDE.md, section « Charte graphique ») : source unique des couleurs, jamais de valeur écrite en dur ailleurs ---- */
    --ch-fond: #fbf8f1; --ch-carte: #ffffff; --ch-bord: #e6ddc9; --ch-bord-champ: #d9cfb8; --ch-separateur: #efe9da;
    --ch-texte: #2b261c; --ch-texte2: #5e5b47; --ch-icone: #8a8670;
    --ch-vert: #357f4b; --ch-vert-fonce: #2f6e44; --ch-vert-pastel: #e3f3e6; --ch-vert-texte: #24613a;
    --ch-bleu: #1f5a8a; --ch-bleu-pastel: #e6f0fa;
    --ch-ambre: #b5701c; --ch-ambre-pastel: #fbeed7; --ch-ambre-texte: #8a5413;
    --ch-rouge: #a33a31; --ch-rouge-pastel: #fbe3e0;
    --ch-onglets: #efe9da; --ch-ligne-alt: #f6f1e4;
    --ch-rayon: 18px; --ch-rayon-pc: 14px;

    --primary: var(--ch-vert);
    --primary-light: #5a9968;
    --bg: var(--ch-fond);
    --card: var(--ch-carte);
    --border: var(--ch-bord);
    --text: var(--ch-texte);
    --text-muted: var(--ch-texte2);
    --accent: var(--ch-ambre);   /* ambre de la charte (audit charte J) */
    --danger: var(--ch-rouge);
    --success: #4f9c5f;
    --warning: var(--ch-ambre);   /* ambre de la charte (audit charte J) */
    --blue-solid: #3f7fb0;
    --indigo-solid: #6f73d1;
    --radius: 18px;
    --radius-sm: 14px;
    --radius-pill: 999px;

    /* Couleurs sémantiques par catégorie : pastel (bg) + assortie plus foncée (fg) -- alignées sur la charte (--ch-*), indigo = bleu charte, rouge unique */
    --green-bg: var(--ch-vert-pastel);   --green-fg: var(--ch-vert-texte);   /* échographie / actions principales */
    --amber-bg: var(--ch-ambre-pastel);   --amber-fg: var(--ch-ambre-texte);   /* agnelage / agnelles */
    --coral-bg: var(--ch-rouge-pastel);   --coral-fg: var(--ch-rouge);   /* sanitaire / mouvements */
    --blue-bg:  var(--ch-bleu-pastel);   --blue-fg:  var(--ch-bleu);   /* contrôle laitier / traite */
    --indigo-bg: var(--ch-bleu-pastel);   --indigo-fg: var(--ch-bleu);   /* béliers */
    --gray-bg:  var(--ch-onglets);   --gray-fg:  var(--ch-texte2);   /* paramètres / neutre */
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Roboto, -apple-system, "Segoe UI", Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
  }
```

Variables à retenir :

- `--ch-*` = **la charte** (source unique, jamais redéfinies).
- `--primary`, `--bg`, `--card`, `--border`, `--text`, `--text-muted`, `--danger`, `--accent`, `--warning` = **alias historiques** pointant vers `--ch-*` (sauf `--primary-light`, `--success`, `--blue-solid`, `--indigo-solid`, valeurs propres).
- `--green/amber/coral/blue/indigo/gray` `-bg` / `-fg` = couples pastel + texte foncé par catégorie, alignés sur la charte. **Corail = rouge de la charte** (pas de corail distinct).
- Breakpoints : la bascule PC/mobile ne passe **pas** par une media query de largeur mais par la classe `body.desktop-shell` (posée par `isDesktopMode()`, Electron). Media queries présentes : `prefers-reduced-motion` (animations coupées), `max-width: 1100px` (grilles PC qui se replient en 1–3 colonnes) et un `max-width: 560px` isolé (Paramètres).

---

## 2. Styles des composants clés

#### 2.1 En-tête / barre du haut (bandeau vert)

_Source : `www/index.html` L84–109, L113–116, L151–159._ Structure : `header` > `.header-top` (menu | logo OVILOG centré | pastille lecteur) + `.header-farm-row` (éleveur à gauche, campagne à droite) + `h1` (titre de l'écran).

```css
  header {
    background: var(--primary);
    color: white;
    padding: 12px 16px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .header-top { display: flex; align-items: center; gap: 8px; }
  .icon-btn {
    background: rgba(255,255,255,0.15);
    border: none;
    color: white;
    width: 36px;
    height: 36px;
    border-radius: var(--radius);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: pointer;
    font-size: 18px;
  }
  .header-slot-g { flex: 0 1 100px; min-width: 36px; display: flex; align-items: center; gap: 8px; }
  .header-slot-d { flex: 0 0 auto; min-width: 100px; display: flex; align-items: center; justify-content: flex-end; }
  body.desktop-shell .header-slot-g { flex: none; }
  body.desktop-shell .header-slot-d { min-width: 36px; width: 36px; }
  .brand-lockup { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; min-width: 0; }
  header h1 { font-size: 16px; margin: 2px 2px 0; font-weight: 600; }
  .logo-icon { flex-shrink: 0; }
  .logo-img { flex-shrink: 0; border-radius: 50%; display: block; }
  .brand-name { font-family: 'Fredoka', sans-serif; font-size: 11px; opacity: 0.8; margin: 0; letter-spacing: 0.5px; }
  .brand-lockup .brand-name { font-size: 19px; font-weight: 700; letter-spacing: 0.5px; opacity: 1; }
  .header-farm-row { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; opacity: 0.85; padding: 0 2px; min-height: 14px; }
  .header-farm-row span:empty { display: none; }
  .header-farm-right { display: flex; align-items: center; gap: 6px; }
```


#### 2.1 bis Pastille « Lecteur » Bluetooth, pastille et bandeau de synchro

_Source : `www/index.html` L117–130, L170–183._

```css
  .icon-btn-lecteur { display: none; flex: none; width: auto; height: 36px; padding: 0; background: transparent; border-radius: 999px; touch-action: manipulation; -webkit-touch-callout: none; user-select: none; }
  .icon-btn-lecteur.visible { display: flex; }
  .pastille-lecteur { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 10px; border-radius: 999px; white-space: nowrap; font-size: 12px; font-weight: 500; background: var(--ch-ambre-pastel); color: var(--ch-ambre-texte); }
  .pastille-lecteur .point { width: 8px; height: 8px; border-radius: 50%; background: var(--ch-ambre); }
  .pastille-lecteur[data-etat="connecte"] { background: var(--ch-vert-pastel); color: var(--ch-vert-texte); }
  .pastille-lecteur[data-etat="connecte"] .point { background: var(--ch-vert); }
  .pastille-lecteur[data-etat="reconnexion"] .point, .pastille-lecteur[data-etat="connexion"] .point { animation: lecteur-pulse 1.2s ease-in-out infinite; }
  /* Écran Lecteur ouvert PAR-DESSUS l'écran de scan (la saisie en cours n'est jamais perdue) */
  .surcouche-lecteur { position: fixed; inset: 0; z-index: 900; background: var(--ch-fond); display: flex; flex-direction: column; overflow: hidden; }
  .surcouche-lecteur-tete { background: var(--primary); color: white; display: flex; align-items: center; gap: 12px; padding: 12px 16px; }
  .surcouche-lecteur-tete h2 { margin: 0; font-size: 18px; font-weight: 700; }
  .surcouche-lecteur-corps { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  @keyframes lecteur-pulse { 50% { opacity: .35; } }
  @media (prefers-reduced-motion: reduce) { .pastille-lecteur .point { animation: none !important; } }
  .sync-badge {
    display: none;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--warning);
    flex-shrink: 0;
  }
  .sync-badge.show { display: inline-block; animation: sync-badge-pulse 1.6s ease-in-out infinite; }
  @keyframes sync-badge-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  /* Bandeau « Synchro en attente » (charte : ambre pastel, liseré gauche) -- sous l'en-tête ; masqué avec lui sur les écrans de connexion. */
  .sync-bandeau { display: flex; flex-direction: row; align-items: baseline; flex-wrap: wrap; gap: 4px 6px; margin: 10px 16px 0; padding: 10px 14px; background: var(--ch-ambre-pastel); border-left: 5px solid var(--ch-ambre); border-radius: var(--ch-rayon); color: var(--ch-ambre-texte); font-size: 13.5px; line-height: 1.4; }
  .sync-bandeau strong::after { content: " ·"; font-weight: 400; }
  .sync-bandeau[hidden], header.hidden + .sync-bandeau { display: none; }
```


#### 2.1 ter En-tête sur PC (décalé de la sidebar de 240 px)

_Source : `www/index.html` L477–477._

```css
  body.desktop-shell header { margin-left: 240px; }
```


#### 2.2 Menu hamburger (drawer mobile) et éléments de menu

_Source : `www/index.html` L436–444._ `.drawer-overlay` = voile sombre plein écran ; `.nav-drawer` = panneau de gauche (78 vw, 300 px max) ; `.nav-item` = une entrée (pastille d'icône `.icon-circle.ic-sm` + libellé).

```css
  .drawer-overlay { position: fixed; inset: 0; background: rgba(43,38,28,0.45); z-index: 1000; display: flex; }
  .drawer-overlay.hidden { display: none; }
  .nav-drawer { width: min(78vw, 300px); height: 100%; background: var(--card); box-shadow: 4px 0 24px rgba(0,0,0,0.2); display: flex; flex-direction: column; padding: 8px 0 20px; overflow-y: auto; }
  .nav-drawer-header { display: flex; align-items: center; gap: 12px; padding: 14px 20px 16px; margin-bottom: 6px; border-bottom: 1px solid var(--border); }
  .nav-drawer-header .brand-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .nav-drawer-header .brand-name { font-size: 20px; font-weight: 700; letter-spacing: 0.5px; color: var(--text); opacity: 1; line-height: 1; }
  .brand-slogan { font-family: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 11.5px; color: var(--text-muted); font-style: italic; margin: 0; }
  .nav-item { display: flex; align-items: center; gap: 14px; width: 100%; border: none; background: none; padding: 13px 20px; font-size: 15px; font-weight: 600; color: var(--text); text-align: left; cursor: pointer; }
  .nav-item:active { background: var(--ch-onglets); }
```


#### 2.2 bis Le même menu sur PC : sidebar fixe de 240 px

_Source : `www/index.html` L457–508._ Les commentaires d'origine sont conservés.

```css
  body.desktop-shell #nav-drawer-overlay {
    position: fixed; inset: 0 auto 0 0; width: 240px;
    /* z-index sous les modales/sheets/toast (1000/1000/2000) -- une
       modale doit toujours recouvrir toute la fenêtre, sidebar comprise --
       mais au-dessus du contenu normal de la page. */
    background: none; z-index: 500; display: flex; box-shadow: none;
  }
  /* .hidden est une utilitaire globale en display:none!important (voir sa
     règle) : closeNavDrawer() (déclenché par un clic sur un item de nav ou
     hors du panneau) la pose sur l'overlay comme sur mobile -- sans effet
     réel côté logique desktop (rien ne dépend de la sidebar ouverte/fermée
     ici), mais il faut quand même repasser par-dessus avec le même
     !important pour que le panneau reste visible en permanence. */
  body.desktop-shell #nav-drawer-overlay.hidden { display: flex !important; }
  /* Connexion, lecture du compte, première configuration : ni en-tête ni menu latéral sur PC, le contenu est centré dans toute la fenêtre (audit charte U) */
  body.desktop-shell.porte-auth #nav-drawer-overlay, body.desktop-shell.porte-auth #nav-drawer-overlay.hidden { display: none !important; }
  body.desktop-shell.porte-auth main#app, body.desktop-shell.porte-auth main#app.fiche-desktop-wide { margin-left: auto; margin-right: auto; }
  body.desktop-shell .nav-drawer {
    width: 100%; height: 100%; box-shadow: none; border-right: 1px solid var(--border);
  }
  body.desktop-shell header { margin-left: 240px; }
  body.desktop-shell .nav-item { padding: 12px 16px; gap: 12px; font-size: 14px; white-space: nowrap; }   /* chaque entrée du menu tient sur une seule ligne (« Mouvements d'animaux ») */
  /* Centrage réel du contenu dans l'espace disponible à droite de la
     sidebar (240px fixe) -- PAS juste "margin-left:240px" (l'ancien
     réglage), qui ne fait que décaler la boîte sans jamais répartir
     l'espace en trop des deux côtés : sur un écran large, tout le vide
     s'accumulait à droite (voir mockup "Refonte desktop", diagnostic du
     bug de recentrage sur Brebis/Béliers/Accueil). Formule généralisée :
     pour une boîte de largeur max M à droite d'une sidebar de largeur S,
     centrer dans [S, 100vw] revient à margin-left = 50vw + (S-M)/2,
     plafonné à S minimum (jamais moins large que l'espace après sidebar).
     margin-right:auto absorbe le reste, qui retombe exactement sur la
     même valeur par symétrie une fois margin-left fixé ainsi. Deux
     règles (main normal 700px, main.fiche-desktop-wide 1500px) car M
     diffère selon l'écran -- la sidebar elle-même n'est pas touchée. */
  body.desktop-shell main#app {
    margin-left: max(240px, calc(50vw - 230px));
    margin-right: auto;
  }
  /* Gabarit PC : les écrans larges prennent toute la place à droite de la sidebar, avec 24 px de marge de chaque côté (plus de colonne centrée ni de plafond). */
  body.desktop-shell main#app.fiche-desktop-wide {
    max-width: none; margin-left: 240px; margin-right: 0; padding: 24px 24px 60px;
  }
  /* Le hamburger n'a plus de sidebar à ouvrir/fermer sur PC (déjà visible
     en permanence) -- visibility:hidden (pas display:none) pour garder son
     gabarit 36px et le centrage du logo (voir .brand-lockup) intacts. Même
     traitement pour le bouton lecteur Bluetooth (aucun scan/bip EID sur
     PC) : le code Bluetooth reste intact dans ce fichier partagé avec
     Android (voir electron/main.js -- "aucune copie, aucune
     transformation"), seul ce point d'entrée disparaît côté PC. */
  body.desktop-shell #btn-menu,
  body.desktop-shell #btn-lecteur-lpr { display: none !important; }
```


#### 2.3 Cartes / blocs

_Source : `www/index.html` L238–238, L243–256._ `.card` est le bloc générique (fiche brebis, réglages, formulaires). `.card.scan-highlight` = repère temporaire après un scan.

```css
  main { max-width: 700px; margin: 0 auto; padding: 16px; padding-bottom: 60px; }
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    margin-bottom: 12px;
  }
  /* Repère visuel temporaire après un scan : montre quelle carte correspond
     au bip, sans exécuter d'action à sa place (voir Chantier de tri). */
  .card.scan-highlight {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--amber-bg);
    transition: box-shadow 0.3s, border-color 0.3s;
  }
```


#### 2.3 bis Éléments de liste : `.sheep-item`, `.badge` de base, `.history-item`, `.error-box`, `.empty`, lignes de détail

_Source : `www/index.html` L311–342, L424–430, L431–433._

```css
  .sheep-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-bottom: 8px;
    background: var(--ch-carte);
    cursor: pointer;
  }
  .sheep-item .num { font-weight: 600; font-size: 15px; }
  .sheep-item .sub { font-size: 12px; color: var(--text-muted); }
  .sheep-item.selected { border-color: var(--primary); background: var(--green-bg); }
  .badge {
    font-size: 12px;
    padding: 3px 10px;
    border-radius: 20px;
    background: var(--ch-vert-pastel);
    color: var(--ch-vert-texte);
  }
  .history-item {
    display: flex;
    gap: 10px;
    padding: 10px 0;
    border-top: 1px solid var(--border);
  }
  .history-item .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); margin-top: 6px; flex-shrink: 0; }
  .history-item .content { flex: 1; }
  .history-item .date { font-size: 12px; color: var(--text-muted); }
  .error-box { color: var(--danger); font-size: 13px; margin-bottom: 10px; }
  .empty { text-align: center; color: var(--text-muted); padding: 40px 20px; }
  .accordion { border-top: 1px solid var(--border); }
  .accordion:first-of-type { border-top: none; }
  .accordion-head { display: flex; align-items: center; gap: 10px; padding: 12px 0; cursor: pointer; user-select: none; }
  .accordion-head .chevron { margin-left: auto; color: var(--text-muted); font-size: 13px; transition: transform 0.15s; }
  .accordion.open .accordion-head .chevron { transform: rotate(180deg); }
  .accordion-body { display: none; padding: 0 0 12px 46px; }
  .accordion.open .accordion-body { display: block; }
  .row-item { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px dashed var(--border); font-size: 13.5px; }
  .row-item:first-child { border-top: none; }
  .empty-mini { color: var(--text-muted); font-size: 13px; padding: 6px 0; }
```


#### 2.3 ter Carte de liste unique `.carte-liste` (mobile, remplace tout tableau)

_Source : `www/index.html` L1144–1157._

```css
  /* Carte de liste (mobile) : remplace tout tableau sur téléphone -- n° en vert foncé gras + pastille d'état à droite, infos grises 13 px, pastilles
     complémentaires, boutons d'action éventuels ; chevron seulement si la carte s'ouvre ; 56 px minimum. Le PC garde ses tableaux. */
  .cartes-liste { display: flex; flex-direction: column; gap: 10px; }
  .carte-liste { box-sizing: border-box; width: 100%; min-height: 56px; background: var(--ch-carte); border: 1px solid var(--ch-bord); border-radius: 18px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; text-align: left; color: var(--ch-texte); }
  .carte-liste.ouvre { cursor: pointer; }
  .carte-liste-l1 { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .carte-liste-nm { flex: 1; min-width: 0; font-size: 16px; font-weight: 700; color: var(--ch-vert-fonce); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .carte-liste-d { display: flex; align-items: center; gap: 6px; flex: none; }
  .carte-liste-chev { flex: none; color: var(--ch-icone); }
  .carte-liste-l2 { font-size: 13px; color: var(--ch-texte2); overflow-wrap: anywhere; }
  .carte-liste-l3 { display: flex; flex-wrap: wrap; gap: 6px; }
  .carte-liste-acts { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; border-top: 1px solid var(--ch-separateur); padding-top: 8px; }
  .carte-liste-acts .btn { width: auto; height: 44px; padding: 0 16px; margin: 0; }
  .carte-liste.sel { background: var(--ch-vert-pastel); border-color: var(--ch-vert-fonce); }
```


#### 2.3 quater Tuiles d'effectifs : `.tuile-charte` (mobile) et `.tuile-pc` (PC)

_Source : `www/index.html` L1290–1299, L607–617._

```css
  /* Tuile d'effectifs MOBILE de la charte (même apparence que .tuile-pc sur PC) : liseré 5 px, fond pastel, libellé gris, chiffre coloré 24 px gras */
  .tuiles-charte { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
  .tuile-charte { --tp-fond: var(--ch-onglets); --tp-trait: var(--ch-icone); --tp-chiffre: var(--ch-texte2); display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 10px 12px; border-left: 5px solid var(--tp-trait); border-radius: 14px; background: var(--tp-fond); }
  .tuile-charte.vert { --tp-fond: var(--ch-vert-pastel); --tp-trait: var(--ch-vert-fonce); --tp-chiffre: var(--ch-vert-fonce); }
  .tuile-charte.bleu { --tp-fond: var(--ch-bleu-pastel); --tp-trait: var(--ch-bleu); --tp-chiffre: var(--ch-bleu); }
  .tuile-charte.ambre { --tp-fond: var(--ch-ambre-pastel); --tp-trait: var(--ch-ambre-texte); --tp-chiffre: var(--ch-ambre-texte); }
  .tuile-charte.rouge { --tp-fond: var(--ch-rouge-pastel); --tp-trait: var(--ch-rouge); --tp-chiffre: var(--ch-rouge); }   /* alerte avérée seulement (jamais pour un zéro : tonTuile) */
  .tuile-charte .l { font-size: 13px; color: var(--ch-texte2); }
  .tuile-charte .n { font-size: 24px; font-weight: 700; line-height: 1.15; color: var(--tp-chiffre); font-variant-numeric: tabular-nums; }
  .tuile-charte .s { font-size: 12px; color: var(--ch-texte2); }
  /* TUILE PC UNIQUE (CLAUDE.md « Charte graphique ») : liseré gauche de 5 px + fond pastel, libellé 13 px gris en minuscules, chiffre 24 px gras. Couleur selon le sens : vert, bleu, ambre ; rouge = alerte avérée ;
     neutre (ou gris) = valeur vide. Les classes d'origine (apc-tuile, brd-kpi, reg-tuile, decl-tuile) restent pour les tests et le mobile ; seul le gabarit PC (body.desktop-shell) en dépend. */
  body.desktop-shell .tuile-pc { --tp-fond: var(--ch-onglets); --tp-trait: var(--ch-icone); --tp-chiffre: var(--ch-texte2); position: relative; display: flex; flex-direction: column; align-items: stretch; gap: 2px; min-width: 0; padding: 12px 16px; border: 0; border-left: 5px solid var(--tp-trait); border-radius: var(--ch-rayon-pc); background: var(--tp-fond); }
  body.desktop-shell .tuile-pc.vert { --tp-fond: var(--ch-vert-pastel); --tp-trait: var(--ch-vert-fonce); --tp-chiffre: var(--ch-vert-fonce); }
  body.desktop-shell .tuile-pc.bleu { --tp-fond: var(--ch-bleu-pastel); --tp-trait: var(--ch-bleu); --tp-chiffre: var(--ch-bleu); }
  body.desktop-shell .tuile-pc.ambre { --tp-fond: var(--ch-ambre-pastel); --tp-trait: var(--ch-ambre-texte); --tp-chiffre: var(--ch-ambre-texte); }
  body.desktop-shell .tuile-pc.rouge { --tp-fond: var(--ch-rouge-pastel); --tp-trait: var(--ch-rouge); --tp-chiffre: var(--ch-rouge); }
  body.desktop-shell .tuile-pc .icon-circle { display: none; }
  body.desktop-shell .tuile-pc :is(.l, .brd-kpi-l, .reg-tuile-l, .decl-tuile-l) { font-size: 13px; font-weight: 400; color: var(--ch-texte2); text-transform: none; letter-spacing: 0; }
  body.desktop-shell .tuile-pc :is(.n, .brd-kpi-v, .reg-tuile-v, .decl-tuile-v) { font-size: 24px; font-weight: 700; line-height: 1.15; margin-top: 0; padding: 0; color: var(--tp-chiffre); font-variant-numeric: tabular-nums; }
  body.desktop-shell .tuile-pc :is(.s, .brd-kpi-s, .reg-tuile-s, .decl-tuile-s, .ep-ts) { font-size: 12px; font-weight: 400; color: var(--ch-texte2); margin-top: 0; line-height: 1.4; }
```


#### 2.3 quinquies Onglets / contrôles segmentés : `.tab-bar`, fiche brebis, onglets PC

_Source : `www/index.html` L511–513, L553–558, L791–793._

```css
  .tab-bar { display: flex; gap: 4px; background: var(--ch-onglets); padding: 4px; border-radius: var(--radius-pill); margin-bottom: 16px; }
  .tab-btn { flex: 1; border: none; background: none; padding: 9px 6px; border-radius: var(--radius-pill); font-size: 13px; font-weight: 600; color: var(--text-muted); cursor: pointer; }
  .tab-btn.active { background: var(--card); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,0.12); }
  .fiche-tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; background: var(--ch-onglets); padding: 4px; border-radius: var(--radius-pill); margin-bottom: 4px; }
  .fiche-tabs.row2 { grid-template-columns: repeat(4, 1fr); margin-bottom: 16px; }
  .fiche-tab-btn { border: none; background: none; padding: 8px 2px; border-radius: var(--radius-pill); font-size: 10.5px; font-weight: 700; color: var(--text-muted); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px; line-height: 1.15; }
  .fiche-tab-btn.active { background: var(--card); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,0.12); }
  .fiche-tab-btn.disabled { color: var(--ch-icone); opacity: 0.6; cursor: default; }
  .fiche-tab-badge { background: var(--ch-icone); color: var(--ch-carte); font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 999px; line-height: 1.4; }
  .pc-onglets { display: flex; gap: 4px; background: var(--ch-onglets); padding: 4px; border-radius: var(--radius-pill); margin-bottom: 16px; }
  .pc-onglets .opt-btn { flex: 1; min-width: 0; padding: 9px 10px; border: 0; background: none; border-radius: var(--radius-pill); font-size: 13px; font-weight: 600; color: var(--text-muted); cursor: pointer; white-space: nowrap; box-shadow: none; }
  .pc-onglets .opt-btn.selected { background: var(--ch-carte); color: var(--ch-texte); box-shadow: 0 1px 3px rgba(0,0,0,0.12); }
```


#### 2.3 sexies Tableaux « charte » (PC)

_Source : `www/index.html` L812–839._

```css
  .pc-t { width: 100%; border-collapse: collapse; font-size: 13px; }
  .pc-t th, .pc-t td { padding: 8px 10px; text-align: right; border-top: 1px solid var(--border); font-variant-numeric: tabular-nums; }
  .pc-t th { white-space: nowrap; }
  .pc-t th.l, .pc-t td.l { text-align: left; }
  .pc-t th.sortable { cursor: pointer; }
  .pc-t td.cb, .pc-t th.cb { text-align: center; width: 40px; }
  /* ---------- Tableaux PC à la charte (CLAUDE.md, « Tableaux ») : même rendu que l'Inventaire PC -- en-tête vert à texte blanc gras, lignes alternées blanc / --ch-ligne-alt, 1re colonne en vert foncé gras,
     coins arrondis, survol vert pastel. Une seule règle pour .pc-t, .table-desktop, .brd-t et .rs-t. ---------- */
  .pc-t, .table-desktop, .brd-t, .rs-t { border-collapse: separate; border-spacing: 0; }
  .pc-t th, .table-desktop th, .brd-t th, .rs-t th { background: var(--ch-vert); color: var(--ch-carte); font-size: 12px; font-weight: 700; text-transform: none; letter-spacing: 0; border: 0; }
  .pc-t tr:first-child > th:first-child, .table-desktop tr:first-child > th:first-child, .brd-t tr:first-child > th:first-child, .rs-t tr:first-child > th:first-child { border-top-left-radius: 12px; }
  .pc-t tr:first-child > th:last-child, .table-desktop tr:first-child > th:last-child, .brd-t tr:first-child > th:last-child, .rs-t tr:first-child > th:last-child { border-top-right-radius: 12px; }
  .pc-t td, .table-desktop td, .brd-t td, .rs-t td { border: 0; }
  .pc-t tbody tr:last-child td:first-child, .table-desktop tbody tr:last-child td:first-child, .brd-t tbody tr:last-child td:first-child, .rs-t tbody tr:last-child td:first-child { border-bottom-left-radius: 12px; }
  .pc-t tbody tr:last-child td:last-child, .table-desktop tbody tr:last-child td:last-child, .brd-t tbody tr:last-child td:last-child, .rs-t tbody tr:last-child td:last-child { border-bottom-right-radius: 12px; }
  /* lignes alternées : sans <thead> (en-tête = 1re ligne du corps) la 1re ligne de données est la 2e du corps ; avec <thead> c'est la 1re */
  .pc-t tbody tr:nth-child(even) td, .table-desktop tbody tr:nth-child(even) td, .brd-t tbody tr:nth-child(even) td, .rs-t tbody tr:nth-child(even) td, .pc-t thead + tbody tr:nth-child(odd) td, .table-desktop thead + tbody tr:nth-child(odd) td, .brd-t thead + tbody tr:nth-child(odd) td, .rs-t thead + tbody tr:nth-child(odd) td { background: var(--ch-ligne-alt); }
  .pc-t tbody tr:nth-child(odd) td, .table-desktop tbody tr:nth-child(odd) td, .brd-t tbody tr:nth-child(odd) td, .rs-t tbody tr:nth-child(odd) td, .pc-t thead + tbody tr:nth-child(even) td, .table-desktop thead + tbody tr:nth-child(even) td, .brd-t thead + tbody tr:nth-child(even) td, .rs-t thead + tbody tr:nth-child(even) td { background: var(--ch-carte); }
  .pc-t td:first-child:not(.cb), .pc-t td.cb + td, .table-desktop td:first-child, .brd-t td:first-child, .rs-t td:first-child { color: var(--ch-vert-fonce); font-weight: 700; }
  .table-desktop { width: 100%; }
  .table-desktop th, .table-desktop td { padding: 8px 12px; text-align: left; white-space: nowrap; }
  .table-desktop td { font-size: 13px; }
  .pc-t tbody tr:hover td, .table-desktop tbody tr:hover td, .pc-t thead + tbody tr:hover td, .table-desktop thead + tbody tr:hover td, .brd-t tbody tr.clic:hover td, .brd-t thead + tbody tr.clic:hover td { background: var(--ch-vert-pastel); }
  .pc-t tbody tr.sel td, .pc-t thead + tbody tr.sel td { background: var(--ch-vert-pastel); }
  .brd-t th.tot { background: var(--ch-vert-fonce); }
  .brd-t th.ant { color: var(--ch-ambre-pastel); }
  .brd-t tbody tr td.tot, .brd-t thead + tbody tr td.tot { background: var(--ch-vert-pastel); color: var(--ch-vert-texte); }
  .pc-lo { background: var(--amber-bg); color: var(--amber-fg); font-weight: 700; border-radius: 6px; padding: 2px 6px; }
```


#### 2.4 Boutons : principal, secondaire, danger, flottant

_Source : `www/index.html` L275–287, L600–601, L602–604, L1481–1481, L1482–1484, L1392–1392, L1381–1381, L222–222, L1289–1289, L1203–1205._ Correspondance :
- **Principal** = `button.btn.btn-primary` (pastille verte `--primary`, texte blanc, pleine largeur).
- **Secondaire** = `button.btn.btn-secondary` (fond blanc, contour `--border`).
- **Danger** = `button.btn.btn-secondary.btn-supprimer` (contour + texte rouges, jamais de fond rouge, uniquement pour une suppression définitive) ; variante historique `button.btn.prm-danger` dans Paramètres.
- **Contour vert** = `.btn.btn-contour-vert`, `.btn-mini`, `.btn-lien` (actions visibles mais non principales).
- **Flottant (FAB)** = `.fab` (cercle vert 56 px, « + », ancré en bas à droite, visible seulement sur la liste des brebis) : voir 2.4 bis.
- **Barre d'actions fixe mobile** = `.mn-barre` (Annuler | Enregistrer et suivante) ; bandeau sombre d'annulation = `.tri-snack` (2.8).
- Hauteurs : 44 px minimum sur mobile (`body:not(.desktop-shell) button.btn`), pastille 44 px sur PC, 48 px dans les barres fixes.
- Focus : cadre vert charte partout (champs : bord vert + halo `--ch-vert-pastel` ; boutons, liens, cases : contour vert 2 px).

```css
  button.btn {
    padding: 14px;
    font-size: 15px;
    font-weight: 600;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
  }
  button.btn-primary { background: var(--primary); color: white; width: 100%; }
  button.btn-secondary { background: white; border: 1px solid var(--border); color: var(--text); width: 100%; }
  /* Suppression définitive (Supprimer, Suppr., Retirer, Nettoyer le registre) : SEUL cas de rouge sur un bouton, en secondaire (contour et texte), jamais en plein */
  button.btn-secondary.btn-supprimer { border-color: var(--ch-rouge); color: var(--ch-rouge); }
  button.btn:disabled { background: var(--ch-bord-champ); color: var(--ch-icone); cursor: not-allowed; }
  /* Pilule secondaire à contour et texte verts (action visible mais non principale : « Terminer la session ») : 44 px, comme le gabarit. */
  .btn.btn-contour-vert { background: var(--ch-carte); color: var(--ch-vert); border: 2px solid var(--ch-vert); border-radius: 999px; font-weight: 700; min-height: 44px; width: auto; padding: 0 20px; }
  /* FOCUS : cadre vert charte partout, PC et mobile (sans cela le navigateur dessine son propre contour, orange ou noir selon la plateforme). Champs : bord vert + halo pastel ; boutons, liens, cases et zones cliquables : contour vert de 2 px. */
  body :is(input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]), select, textarea):focus { outline: none; border-color: var(--ch-vert); box-shadow: 0 0 0 3px var(--ch-vert-pastel); }
  body :is(button, a, summary, [tabindex]:not(input), input[type=checkbox], input[type=radio], input[type=range]):focus-visible { outline: 2px solid var(--ch-vert); outline-offset: 2px; }
  body.desktop-shell button.btn { min-height: 44px; border-radius: var(--radius-pill); }
  /* Mobile : tout bouton .btn fait au moins 44 px (charte, cible du doigt) ; le bouton « + » / « Ajouter » d'une ligne champ + bouton garde la hauteur du champ au lieu de s'étirer sur sa marge (audit charte H) */
  body:not(.desktop-shell) button.btn { min-height: 44px; }
  body:not(.desktop-shell) .row > input + button.btn { align-self: flex-start; min-height: 0; height: 45px; }
  button.btn.prm-danger { color: var(--danger); border-color: var(--danger); font-weight: 700; }
  button.btn-petit { width: auto; min-height: 36px; height: 36px; padding: 0 14px; font-size: 14px; }
  .btn-mini { height: 40px; border-radius: 999px; border: 1px solid var(--ch-vert); background: var(--ch-carte); color: var(--ch-vert); padding: 0 16px; font-size: 14px; font-weight: 700; cursor: pointer; }
  .btn-lien { min-height: 44px; padding: 0 4px; border: 0; background: none; color: var(--ch-vert); font-weight: 700; font-size: 14px; text-decoration: underline; cursor: pointer; }
  .mn-barre { position: sticky; bottom: 0; z-index: 5; display: grid; grid-template-columns: 1fr 1.6fr; gap: 10px; margin: 0 -16px -16px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px)); background: var(--ch-fond); border-top: 1px solid var(--ch-bord); }
  .mn-barre .btn { margin: 0; height: 48px; }
  .mn-barre.une { grid-template-columns: 1fr; }
```


#### 2.4 bis Bouton flottant `.fab`, `.hidden`, puces de choix (`.opt-btn`, `.chip`)

_Source : `www/index.html` L343–357, L291–299, L304–310, L358–368._

```css
  .fab {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--primary);
    color: white;
    font-size: 28px;
    border: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    cursor: pointer;
  }
  .hidden { display: none !important; }
  .opt-btn {
    padding: 12px;
    border: 2px solid var(--border);
    border-radius: var(--radius);
    background: white;
    font-size: 14px;
    cursor: pointer;
  }
  .opt-btn.selected { border-color: var(--primary); background: var(--green-bg); color: var(--green-fg); font-weight: 600; box-shadow: 0 0 0 2px var(--green-bg); }
  /* Puces de choix MOBILE (charte, règle unique) : pilule 44 px minimum, bordure de champ ; sélectionnée = vert pastel, bordure verte (2 px, le rembourrage compense : même taille), texte vert foncé, gras, quelle que soit la variante (warn, blue, coral, gray : une seule couleur, jamais de rouge). Le PC garde ses règles (.pc-seg2, .pc-onglets). */
  body:not(.desktop-shell) .opt-btn,
  body:not(.desktop-shell) .pc-seg2 .opt-btn { min-height: 44px; padding: 8px 12px; border: 1px solid var(--ch-bord-champ); border-radius: var(--radius-pill); background: var(--ch-carte); color: var(--ch-texte); font-size: 14px; font-weight: 500; line-height: 1.2; text-align: center; text-wrap: balance; box-shadow: none; }
  body:not(.desktop-shell) .opt-btn.selected,
  body:not(.desktop-shell) .opt-btn.selected.warn, body:not(.desktop-shell) .opt-btn.selected.coral, body:not(.desktop-shell) .opt-btn.selected.blue, body:not(.desktop-shell) .opt-btn.selected.gray,
  body:not(.desktop-shell) .pc-seg2 .opt-btn.selected,
  body:not(.desktop-shell) .pc-seg2 .opt-btn.selected.warn, body:not(.desktop-shell) .pc-seg2 .opt-btn.selected.coral, body:not(.desktop-shell) .pc-seg2 .opt-btn.selected.blue, body:not(.desktop-shell) .pc-seg2 .opt-btn.selected.gray { background: var(--ch-vert-pastel); border: 2px solid var(--ch-vert); padding: 7px 11px; color: var(--ch-vert-texte); font-weight: 700; box-shadow: none; }
  .chip-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
  .chip {
    padding: 8px 12px;
    border: 2px solid var(--border);
    border-radius: 20px;
    background: white;
    font-size: 13px;
    cursor: pointer;
  }
  .chip.selected { border-color: var(--ch-vert); background: var(--ch-vert-pastel); color: var(--ch-vert-texte); font-weight: 600; }   /* sélection en vert pastel, comme les puces (audit charte J) */
  .chip.chip-empty { color: var(--text-muted); border-style: dashed; cursor: default; }
```


#### 2.5 Badges / pastilles de statut

_Source : `www/index.html` L325–331, L397–404, L412–416, L1276–1279, L899–902, L916–917, L972–972, L1072–1072, L376–395._ Trois familles coexistent (même rendu, historique) : `.badge` (+ `.badge-green/amber/coral/blue/indigo/gray/muted`), `.mb-pastille` (+ `.vert/.bleu/.ambre`, utilisée par `carteListeHtml`), `.reg-pastille` (+ `.vert/.bleu/.ambre/.rouge/.gris`, Registre, états Entrée/Morte/Vendue). `.compact-tag` = micro-étiquette en majuscules pour les tableaux denses. Règle de couleur : pastel + texte foncé ; rouge **seulement** pour une vraie alerte.

```css
  .badge {
    font-size: 12px;
    padding: 3px 10px;
    border-radius: 20px;
    background: var(--ch-vert-pastel);
    color: var(--ch-vert-texte);
  }
  /* ---------- Badges colorés par catégorie ---------- */
  .badge.badge-green  { background: var(--green-bg);  color: var(--green-fg); }
  .badge.badge-amber  { background: var(--amber-bg);  color: var(--amber-fg); }
  .badge.badge-coral  { background: var(--coral-bg);  color: var(--coral-fg); }
  .badge.badge-blue   { background: var(--blue-bg);   color: var(--blue-fg); }
  .badge.badge-indigo { background: var(--indigo-bg); color: var(--indigo-fg); }
  .badge.badge-gray   { background: var(--gray-bg);   color: var(--gray-fg); }
  .badge.badge-muted  { background: var(--ch-onglets); color: var(--text-muted); }
  .compact-tag { display: inline-block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; padding: 2px 7px; border-radius: 6px; vertical-align: middle; }
  .compact-tag-green { background: var(--green-bg); color: var(--green-fg); }
  .compact-tag-amber { background: var(--amber-bg); color: var(--amber-fg); }
  .compact-tag-coral { background: var(--coral-bg); color: var(--coral-fg); }
  .compact-tag-gray { background: var(--gray-bg); color: var(--gray-fg); }
  .mb-pastille { font-size: 12px; font-weight: 500; border-radius: 999px; padding: 3px 10px; white-space: nowrap; background: var(--ch-onglets); color: var(--ch-texte2); }
  .mb-pastille.vert { background: var(--ch-vert-pastel); color: var(--ch-vert-texte); }
  .mb-pastille.bleu { background: var(--ch-bleu-pastel); color: var(--ch-bleu); }
  .mb-pastille.ambre { background: var(--ch-ambre-pastel); color: var(--ch-ambre-texte); }
  .reg-tuile.vert, .reg-pastille.vert { background: var(--ch-vert-pastel); border-color: var(--ch-vert-fonce); } .reg-tuile.vert .reg-tuile-v { color: var(--ch-vert-fonce); }
  .reg-tuile.bleu, .reg-pastille.bleu { background: var(--ch-bleu-pastel); border-color: var(--ch-bleu); } .reg-tuile.bleu .reg-tuile-v { color: var(--ch-bleu); }
  .reg-tuile.ambre, .reg-pastille.ambre { background: var(--ch-ambre-pastel); border-color: var(--ch-ambre); } .reg-tuile.ambre .reg-tuile-v { color: var(--ch-ambre); }
  .reg-tuile.rouge, .reg-pastille.rouge { background: var(--ch-rouge-pastel); border-color: var(--ch-rouge); } .reg-tuile.rouge .reg-tuile-v { color: var(--ch-rouge); }
  .reg-pastille { font-size: 12px; font-weight: 500; border: 0; border-radius: 999px; padding: 3px 9px; }
  .reg-pastille.vert { color: var(--ch-vert-texte); } .reg-pastille.bleu { color: var(--ch-bleu); } .reg-pastille.ambre { color: var(--ch-ambre-texte); } .reg-pastille.rouge { color: var(--ch-rouge); }
  .reg-pastille.gris { background: var(--ch-onglets); color: var(--ch-texte2); }
  .reg-pastille.rouge-clair { background: var(--ch-ambre-pastel); color: var(--ch-ambre-texte); }   /* « Vide » : ambre (nom de classe historique gardé) ; « Vide définitive » = .rouge */
  /* ---------- Icônes rondes colorées ---------- */
  .icon-circle { display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; flex-shrink: 0; }
  .icon-circle.ic-md { width: 44px; height: 44px; }
  .icon-circle.ic-md svg { width: 24px; height: 24px; }
  .icon-circle.ic-sm { width: 36px; height: 36px; }
  .icon-circle.ic-sm svg { width: 19px; height: 19px; }
  /* Taille réduite pour la barre d'onglets de la fiche brebis (icône
     au-dessus du libellé, voir .fiche-tab-btn) -- trop de catégories pour
     ic-sm dans une grille compacte. */
  .icon-circle.ic-xs { width: 22px; height: 22px; }
  .icon-circle.ic-xs svg { width: 12px; height: 12px; }
  .icon-circle.ic-lg { width: 52px; height: 52px; }
  .icon-circle.ic-lg svg { width: 28px; height: 28px; }
  .icon-circle.ic-green  { background: var(--green-bg);  color: var(--green-fg); }
  .icon-circle.ic-amber  { background: var(--amber-bg);  color: var(--amber-fg); }
  .icon-circle.ic-coral  { background: var(--ch-onglets); color: var(--ch-texte2); }   /* catégorie (sanitaire, mouvements, réforme) : neutre, le rouge est réservé aux alertes */
  .icon-circle.ic-alerte { background: var(--ch-rouge-pastel); color: var(--ch-rouge); }   /* message bloquant (erreur certaine) seulement */
  .icon-circle.ic-blue   { background: var(--blue-bg);   color: var(--blue-fg); }
  .icon-circle.ic-indigo { background: var(--indigo-bg); color: var(--indigo-fg); }
  .icon-circle.ic-gray   { background: var(--gray-bg);   color: var(--gray-fg); }
```


#### 2.6 Champs de formulaire : input, select, textarea, label, fichier, interrupteur

_Source : `www/index.html` L258–274, L1480–1480, L1488–1488, L1300–1303, L602–603._ Le focus des champs (bord vert + halo `--ch-vert-pastel`) est repris ici ; celui des boutons est en 2.4.

```css
  input, select, textarea {
    width: 100%;
    padding: 12px;
    font-size: 16px;
    font-family: inherit;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: white;
    color: var(--ch-texte);   /* texte saisi : couleur de la charte, jamais le noir pur du navigateur */
    margin-bottom: 12px;
  }
  textarea { resize: vertical; }
  #fp-viande::placeholder, #fp-lait::placeholder { font-size: 13px; }   /* fiche produit : « 0 = aucune attente » entier dans la colonne étroite */
  input:disabled, select:disabled, textarea:disabled { color: var(--ch-icone); -webkit-text-fill-color: var(--ch-icone); }   /* champ désactivé : gris de la charte (--ch-icone), pas le gris du navigateur */
  /* Champ fichier (imports) : le bouton du navigateur prend le style du bouton secondaire de la charte ; son texte suit la langue de l'appareil */
  input[type=file]::file-selector-button { margin-right: 10px; min-height: 36px; padding: 6px 16px; border: 1px solid var(--ch-bord-champ); border-radius: var(--radius-pill); background: var(--ch-carte); color: var(--ch-texte); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
  label { font-size: 13px; color: var(--text-muted); display: block; margin-bottom: 6px; }
  body.desktop-shell :where(input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=color]), select) { height: 44px; border-radius: 12px; border-color: var(--ch-bord-champ); font-size: 14px; }
  body.desktop-shell :where(td, th) :where(input:not([type=checkbox]):not([type=radio]), select) { height: 36px; border-radius: 10px; margin-bottom: 0; }
  .interrupteur { appearance: none; -webkit-appearance: none; flex: none; width: 44px; height: 26px; margin: 0; border-radius: 999px; background: var(--ch-bord-champ); position: relative; cursor: pointer; transition: background .15s; }
  .interrupteur::after { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: var(--ch-carte); transition: left .15s; }
  .interrupteur:checked { background: var(--ch-vert); }
  .interrupteur:checked::after { left: 21px; }
  /* FOCUS : cadre vert charte partout, PC et mobile (sans cela le navigateur dessine son propre contour, orange ou noir selon la plateforme). Champs : bord vert + halo pastel ; boutons, liens, cases et zones cliquables : contour vert de 2 px. */
  body :is(input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]), select, textarea):focus { outline: none; border-color: var(--ch-vert); box-shadow: 0 0 0 3px var(--ch-vert-pastel); }
```


#### 2.6 bis Champ mot de passe et champs de l'écran de connexion

_Source : `www/index.html` L195–196, L224–226._

```css
  .ecran-technique .colonne input { height: 48px; margin: 0; padding: 0 14px; border-radius: 12px; border-color: var(--ch-bord-champ); }
  body.desktop-shell .ecran-technique .colonne input { height: 44px; }
  .champ-mdp { position: relative; }
  .champ-mdp input { padding-right: 96px; }
  .champ-mdp .afficher { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); min-height: 40px; padding: 0 12px; border: 0; background: none; color: var(--ch-vert); font-size: 14px; font-weight: 700; cursor: pointer; }
```


#### 2.7 Modales (centrée) et bottom sheet

_Source : `www/index.html` L1446–1447, L1452–1454._ `.modal-overlay` / `.modal-card` : petite fenêtre centrée (380 px max). `.sheet-overlay` / `.sheet-card` : feuille remontant du bas (700 px max, 88 vh) avec bouton de fermeture `.sheet-close-btn`. Écran Lecteur ouvert par-dessus l'écran courant : `.surcouche-lecteur` (voir 2.1 bis).

```css
  .modal-overlay { position: fixed; inset: 0; background: rgba(43,38,28,0.5); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 1000; }
  .modal-card { background: var(--card); border-radius: var(--radius); padding: 20px; max-width: 380px; width: 100%; box-shadow: 0 12px 40px rgba(0,0,0,0.28); }
  .sheet-overlay { position: fixed; inset: 0; background: rgba(43,38,28,0.5); display: flex; align-items: flex-end; justify-content: center; z-index: 1000; }
  .sheet-card { background: var(--card); border-radius: var(--radius) var(--radius) 0 0; padding: 20px 20px 26px; width: 100%; max-width: 700px; max-height: 88vh; overflow-y: auto; box-shadow: 0 -12px 30px rgba(0,0,0,0.28); position: relative; }
  .sheet-close-btn { position: absolute; top: 14px; right: 14px; width: 30px; height: 30px; border-radius: 50%; border: none; background: var(--gray-bg); color: var(--gray-fg); font-size: 15px; cursor: pointer; z-index: 1; }
```


#### 2.8 Toasts, bandeaux et alertes

_Source : `www/index.html` L131–150, L1206–1213, L1245–1246, L1104–1106, L1460–1461, L1467–1471, L1377–1377, L181–184._ - `.toast` : toast discret auto-disparaissant (3 s, `showToast(message)`).
- `.tri-snack` : bandeau sombre avec bouton « Annuler » (6 s).
- `.msg-charte` / `.mb-msg` (`.ok` vert, `.alerte` ambre, `.bloc` rouge, `.neutre` gris) : message de charte à liseré gauche 5 px.
- `.bc-alerte`, `.alert-banner`, `.note-warn`, `.note-danger`, `.prm-alerte`, `.sync-bandeau`, `.error-box` : variantes d'encarts selon l'écran.

```css
  /* Petit toast discret et non bloquant (l'appli n'utilisait jusque-là que
     alert()/encarts d'erreur) — auto-disparaît, ne capte aucun clic. */
  .toast {
    position: fixed;
    left: 50%;
    bottom: 28px;
    transform: translateX(-50%) translateY(20px);
    background: rgba(43,38,28,0.92);
    color: white;
    padding: 10px 18px;
    border-radius: var(--radius-pill);
    font-size: 13px;
    z-index: 2000;
    opacity: 0;
    pointer-events: none;
    max-width: 85%;
    text-align: center;
    transition: opacity 0.25s, transform 0.25s;
  }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  /* Saisie des mises bas (mobile) : confirmation verte, blocage rouge, alerte ambre, agneaux, dernières saisies */
  .mb-msg, .msg-charte { border-left: 5px solid var(--mb-trait); background: var(--mb-fond); color: var(--mb-texte); border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; font-size: 14px; margin-bottom: 12px; }
  .mb-msg b, .msg-charte b { font-size: 15px; }
  .mb-msg.ok, .msg-charte.ok { --mb-trait: var(--ch-vert-fonce); --mb-fond: var(--ch-vert-pastel); --mb-texte: var(--ch-vert-texte); }
  .mb-msg.bloc, .msg-charte.bloc { --mb-trait: var(--ch-rouge); --mb-fond: var(--ch-rouge-pastel); --mb-texte: var(--ch-rouge); }
  .mb-msg.alerte, .msg-charte.alerte { --mb-trait: var(--ch-ambre); --mb-fond: var(--ch-ambre-pastel); --mb-texte: var(--ch-ambre-texte); }
  .mb-msg.neutre, .msg-charte.neutre { --mb-trait: var(--ch-icone); --mb-fond: var(--ch-onglets); --mb-texte: var(--ch-texte2); }
  .mb-msg .lien, .msg-charte .lien { align-self: flex-start; min-height: 44px; padding: 0; border: 0; background: none; color: inherit; font: inherit; font-weight: 700; text-decoration: underline; cursor: pointer; }
  .tri-snack { position: fixed; left: 16px; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); max-width: 520px; margin: 0 auto; z-index: 30; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 8px 4px 14px; min-height: 52px; border-radius: 14px; background: var(--ch-texte); color: var(--ch-carte); font-size: 14px; }
  .tri-snack button { min-height: 44px; padding: 0 12px; border: 0; background: none; color: var(--ch-vert-pastel); font: inherit; font-weight: 700; cursor: pointer; }
  .bc-alerte { margin: 0 0 14px; padding: 10px 14px; border-radius: 14px; background: var(--ch-onglets); color: var(--ch-texte2); font-size: 13px; }
  .bc-alerte.warn { background: var(--ch-ambre-pastel); color: var(--ch-ambre-texte); }
  .bc-alerte.err { background: var(--ch-rouge-pastel); color: var(--ch-rouge); } .bc-alerte.err summary { font-weight: 700; cursor: pointer; } .bc-alerte.err ul { margin: 8px 0 0; padding-left: 18px; color: var(--ch-texte2); }
  .note-warn { font-size: 12px; color: var(--amber-fg); background: var(--amber-bg); border-radius: 12px; padding: 9px 12px; margin-bottom: 12px; line-height: 1.4; }
  .note-danger { font-size: 12.5px; color: var(--coral-fg); background: var(--coral-bg); border-radius: 12px; padding: 9px 12px; margin: -2px 0 12px; line-height: 1.4; }
  .alert-banner { display: flex; gap: 10px; align-items: flex-start; background: var(--coral-bg); color: var(--coral-fg); border-radius: var(--radius); padding: 12px 14px; margin-bottom: 12px; font-size: 12.5px; line-height: 1.45; }
  .alert-banner b { display: block; font-size: 13px; margin-bottom: 2px; }
  .alert-banner.clickable { cursor: pointer; }
  .alert-banner .see-link { display: block; margin-top: 4px; font-weight: 600; text-decoration: underline; }
  .alert-banner.small { padding: 10px 12px; margin: 4px 0 14px; }
  .prm-alerte { background: var(--amber-bg); color: var(--amber-fg); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 12.5px; line-height: 1.45; margin-bottom: 10px; }
  .sync-bandeau { display: flex; flex-direction: row; align-items: baseline; flex-wrap: wrap; gap: 4px 6px; margin: 10px 16px 0; padding: 10px 14px; background: var(--ch-ambre-pastel); border-left: 5px solid var(--ch-ambre); border-radius: var(--ch-rayon); color: var(--ch-ambre-texte); font-size: 13.5px; line-height: 1.4; }
  .sync-bandeau strong::after { content: " ·"; font-weight: 400; }
  .sync-bandeau[hidden], header.hidden + .sync-bandeau { display: none; }
  .sync-bandeau strong { font-size: 14px; }
```


---

## 3. HTML d'exemple de chaque composant

Extraits **réels** (squelette statique de `www/index.html` et gabarits JS), raccourcis quand la ligne d'origine est très longue (`…`). Les valeurs affichées (n°, dates, libellés) sont des exemples neutres ; les numéros de ligne indiquent le gabarit d'origine.

### 3.1 En-tête (statique, `www/index.html` L1496–1520)

```html
<header>
  <div class="header-top">
    <div class="header-slot-g">
    <button id="btn-menu" class="icon-btn" aria-label="Menu">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" stroke="white" stroke-width="2.2" stroke-linecap="round"/></svg>
    </button>
    <button id="btn-back" class="icon-btn hidden" aria-label="Retour">&larr;</button>
    </div>
    <div class="brand-lockup" id="brand-lockup" style="cursor:pointer;">
      <img class="logo-img" width="30" height="30" src="data:image/png;base64,…">
      <p class="brand-name">OVILOG</p>
    </div>
    <div class="header-slot-d">
    <button id="btn-lecteur-lpr" class="icon-btn icon-btn-lecteur" aria-label="Lecteur" type="button"><span class="pastille-lecteur" id="led-lecteur-lpr" data-etat="absent"><span class="point"></span><span class="txt">Lecteur absent</span></span></button>
    </div>
  </div>
  <div class="header-farm-row">
    <span id="farm-name"></span>
    <span class="header-farm-right">
      <span id="sync-badge" class="sync-badge" title="Synchronisation en attente" aria-hidden="true"></span>
      <span id="farm-campagne"></span>
    </span>
  </div>
  <h1 id="page-title">Mon troupeau</h1>
</header>
<div id="sync-bandeau" class="sync-bandeau" role="status" hidden><strong>Synchro en attente</strong><span id="sync-bandeau-texte"></span></div>
```

### 3.2 Menu hamburger (statique L1523–1525 + gabarit JS L6152–6166)

```html
<div id="nav-drawer-overlay" class="drawer-overlay hidden">
  <nav id="nav-drawer" class="nav-drawer"></nav>
</div>
<main id="app"></main>
```

Contenu injecté dans `#nav-drawer` (`NAV_ITEMS`, L6127–6150 ; une entrée par vue : Accueil, Brebis, Béliers, Agneaux, Chantier de tri, Agnelles, Échographies, Mises-bas, Contrôle laitier, Inventaire, Mouvements d'animaux, Carnet sanitaire, Production laitière, Calendrier, Bilan de campagne, Registre d'élevage, Déclaration annuelle, Paramètres) :

```html
<div class="nav-drawer-header">
  <img class="logo-img" width="38" height="38" src="data:image/png;base64,…">
  <div class="brand-text">
    <p class="brand-name">OVILOG</p>
    <p class="brand-slogan">L’expertise ovine au bout du bâton.</p>
  </div>
</div>
<button type="button" class="nav-item" data-view="list">
  <span class="icon-circle ic-green ic-sm"><svg viewBox="0 0 48 48" …>…</svg></span>
  <span>Brebis</span>
</button>
<button type="button" class="nav-item" data-view="parametres">
  <span class="icon-circle ic-gray ic-sm"><svg …>…</svg></span>
  <span>Paramètres</span>
</button>
```

(Générés par `iconCircle(svg, color, size)` : `<span class="icon-circle ic-${color} ic-${size}">${svg}</span>`.)

### 3.3 Cartes / blocs

Carte générique :

```html
<div class="card">
  <div style="font-weight:700;font-size:15px;margin-bottom:8px;">Titre de la carte</div>
  <div style="font-size:13px;color:var(--text-muted);">Texte secondaire</div>
</div>
```

Ligne de liste (liste des agnelles, `www/index.html` L15064–15075) :

```html
<div class="sheep-item">
  <div class="sheep-item-left">
    <span class="icon-circle ic-amber ic-md"><svg …>…</svg></span>
    <div>
      <div class="num">Agnelle n°71001</div>
      <div class="sub">1 an(s)</div>
    </div>
  </div>
  <span class="badge badge-amber">Née sur l'exploitation</span>
</div>
```

Carte de liste mobile — gabarit `carteListeHtml(o)` (L12766–12775) :

```html
<div class="carte-liste ouvre" role="button" tabindex="0">
  <div class="carte-liste-l1">
    <span class="carte-liste-nm">71001</span>
    <span class="carte-liste-d"><span class="mb-pastille vert">Gestante</span> <!-- chevron SVG si .ouvre --></span>
  </div>
  <div class="carte-liste-l2">Née le 12/03/2025 · mère n°70234</div>
  <div class="carte-liste-l3"><span class="mb-pastille ambre">À surveiller</span></div>
  <div class="carte-liste-acts"><button type="button" class="btn btn-secondary">Modifier</button></div>
</div>
```

Tuiles (mobile `www/index.html` L12576–12577 ; PC `tuile` L7044) :

```html
<div class="tuiles-charte">
  <div class="tuile-charte vert"><div class="l">Pleines</div><div class="n">12</div></div>
  <div class="tuile-charte ambre"><div class="l">Vides</div><div class="n">3</div></div>
  <div class="tuile-charte"><div class="l">À revoir</div><div class="n">—</div><div class="s">neutre = vide</div></div>
</div>
<!-- PC -->
<div class="apc-tuile tuile-pc bleu" role="button" tabindex="0"><div class="l">Attendues à la traite</div><div class="n">24</div><div class="s">sous-texte</div></div>
```

Onglets segmentés (L12354) :

```html
<div class="tab-bar" style="margin-bottom:14px;">
  <button type="button" class="tab-btn active" data-val="a">À trier</button>
  <button type="button" class="tab-btn" data-val="b">Gardées</button>
  <button type="button" class="tab-btn" data-val="c">Écartées</button>
</div>
```

Tableau charte PC (L9586, simplifié) :

```html
<table class="pc-t">
  <tr><th class="l">Date</th><th class="l">N°</th><th class="l">Type</th><th style="text-align:right;">Actions</th></tr>
  <tr><td class="l">12/03/2025</td><td class="l">71001</td><td class="l">Entrée</td><td>…</td></tr>
</table>
```

### 3.4 Boutons

```html
<!-- principal -->
<button type="button" class="btn btn-primary" id="ce-save">Enregistrer le nouvel EID</button>
<!-- secondaire -->
<button type="button" class="btn btn-secondary" id="btn-passer-echo">Passer</button>
<!-- danger (suppression définitive uniquement) : L18099 -->
<button type="button" class="btn btn-secondary btn-supprimer" id="retrait-confirm" style="margin-bottom:8px;">Retirer</button>
<!-- contour vert : L13434 -->
<button type="button" class="btn btn-contour-vert" id="btn-fin-session-mb">Terminer la session</button>
<!-- flottant : L1529 (visible sur la liste des brebis) -->
<button class="fab hidden" id="fab-add">+</button>
<!-- barre d'actions fixe mobile : L12588 -->
<div class="mn-barre"><button type="button" class="btn btn-secondary" id="btn-passer-echo">Passer</button><button type="button" class="btn btn-primary" id="btn-valider-echo">Enregistrer et suivante</button></div>
```

### 3.5 Badges / pastilles de statut

```html
<span class="badge badge-blue">Attendue à la traite</span>
<span class="badge badge-amber">12/03 · 2 agn.</span>
<span class="badge badge-muted">Aucun agnelage</span>
<span class="badge badge-gray">Vide</span>
<span class="badge badge-coral">Avortée</span>
<span class="badge badge-green">Gestante</span>
<span class="reg-pastille bleu">Attendue à la traite</span>
<span class="mb-pastille vert">EID bippé</span>
<span class="compact-tag compact-tag-amber">Pleine</span>
```

### 3.6 Champs de formulaire

```html
<label for="rs-litres">Litres</label>
<input type="number" step="0.1" inputmode="decimal" id="rs-litres" value="12.5">

<label>Date</label>
<input type="date" id="lambsortie-date" value="2026-10-19" style="margin-bottom:14px;">

<label>Campagne</label>
<select id="bilan-lactation-campagne-select">
  <option value="2026">2026</option>
</select>

<label>Note</label>
<textarea id="f-texte" rows="4" placeholder="Observation libre..."></textarea>

<div class="error-box hidden" id="rs-err"></div>
```

### 3.7 Modales / bottom sheets

Modale centrée (`showLambSortieModal`, L10354–10375) :

```html
<div class="modal-overlay">
  <div class="modal-card">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
      <span class="icon-circle ic-coral ic-md"><svg …>…</svg></span>
      <div><div style="font-weight:700;font-size:15px;">Vendre l'agneau n°71001</div></div>
    </div>
    <label>Date</label>
    <input type="date" id="lambsortie-date" value="2026-10-19" style="margin-bottom:14px;">
    <div id="lambsortie-err" class="error-box hidden"></div>
    <!-- boutons .btn.btn-primary / .btn.btn-secondary -->
  </div>
</div>
```

Bottom sheet (`openCorrigerEidSheet`, L2704–2720) :

```html
<div class="sheet-overlay">
  <div class="sheet-card">
    <button type="button" class="sheet-close-btn" id="ce-close">✕</button>
    <div style="font-weight:700;font-size:15px;margin-bottom:4px;">Corriger l'EID</div>
    <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px;">EID actuel : n°71001 (250…)</div>
    <label>Nouvel EID — scanner ou saisir</label>
    <input type="text" id="ce-eid" placeholder="ex: 250 000000 000000">
    <div id="ce-err" class="error-box hidden"></div>
    <button type="button" class="btn btn-primary" id="ce-save">Enregistrer le nouvel EID</button>
  </div>
</div>
```

Les deux sont créées en JS (`document.createElement('div')`, `className = 'modal-overlay'|'sheet-overlay'`, `innerHTML = …`, `document.body.appendChild`) et retirées par `removeChild`.

### 3.8 Toasts / alertes

```html
<!-- toast : créé par showToast(message), L5986 ; classe .show posée 3 s -->
<div id="app-toast" class="toast show">Enregistré</div>

<!-- bandeau d'annulation (L14738) -->
<div id="tri-toast" class="tri-snack" role="status"><span>n°71001 gardée</span><button type="button" id="tri-toast-annuler">Annuler</button></div>

<!-- messages de charte (L13354, L13363) -->
<div class="mb-msg alerte" data-alerte="code">Message d'alerte (ambre)</div>
<div class="mb-msg bloc" id="mb-conflit"><b>EID déjà utilisé</b><span>…</span><button type="button" class="btn btn-secondary">OK</button></div>
<div class="msg-charte ok"><b>Enregistré</b><span>…</span></div>

<!-- bandeau de synchro (statique) -->
<div id="sync-bandeau" class="sync-bandeau" role="status"><strong>Synchro en attente</strong><span>…</span></div>
```

---

## 4. Palette

Toutes les couleurs sont des variables du `:root` (L35–70 du `<style>`, soit `www/index.html` L41–76). Les noms `--ch-*` sont la source.

### 4.1 Neutres (fonds, bords, texte)

| Variable | Hex | Usage |
|---|---|---|
| `--ch-fond` (`--bg`) | `#fbf8f1` | Fond de page (crème) ; fond des barres fixes |
| `--ch-carte` (`--card`) | `#ffffff` | Cartes, champs, bottom sheets, pastille d'onglet active |
| `--ch-bord` (`--border`) | `#e6ddc9` | Bord des cartes, séparateurs de listes |
| `--ch-bord-champ` | `#d9cfb8` | Bord des champs et boutons secondaires ; fond de bouton désactivé ; piste d'interrupteur |
| `--ch-separateur` | `#efe9da` | Séparateurs fins dans les cartes |
| `--ch-onglets` (`--gray-bg`) | `#efe9da` | Fond segmenté/onglets ; pastille neutre ; tuile neutre ; icône de catégorie neutre |
| `--ch-ligne-alt` | `#f6f1e4` | Lignes alternées de tableau ; survol de ligne |
| `--ch-texte` (`--text`) | `#2b261c` | Texte principal ; fond du toast/bandeau sombre (rgba .92) |
| `--ch-texte2` (`--text-muted`, `--gray-fg`) | `#5e5b47` | Texte secondaire, libellés |
| `--ch-icone` | `#8a8670` | Icônes, chevrons, champ désactivé, trait des tuiles neutres |

### 4.2 Accent, états et sens

| Variable | Hex | Usage |
|---|---|---|
| `--ch-vert` (`--primary`) | `#357f4b` | **Accent** : bandeau d'en-tête, bouton principal, en-tête de tableau, focus, FAB, lecteur connecté |
| `--ch-vert-fonce` | `#2f6e44` | Texte/chiffres verts, 1re colonne de tableau, n° des cartes, liseré des tuiles vertes |
| `--ch-vert-pastel` (`--green-bg`) | `#e3f3e6` | **Succès** : fond des pastilles/tuiles vertes, sélection de puce, halo de focus |
| `--ch-vert-texte` (`--green-fg`) | `#24613a` | Texte sur vert pastel |
| `--ch-bleu` (`--blue-fg`, `--indigo-fg`) | `#1f5a8a` | **Information** (contrôle laitier, béliers, « Attendue à la traite », Vendue) |
| `--ch-bleu-pastel` | `#e6f0fa` | Fond bleu pastel |
| `--ch-ambre` (`--accent`, `--warning`) | `#b5701c` | **À surveiller / avertissement** (liseré, point de synchro, lecteur en reconnexion) |
| `--ch-ambre-pastel` (`--amber-bg`) | `#fbeed7` | Fond d'alerte ambre, bandeaux, femelle |
| `--ch-ambre-texte` (`--amber-fg`) | `#8a5413` | Texte sur ambre pastel (chiffres de tuile ambre) |
| `--ch-rouge` (`--danger`, `--coral-fg`) | `#a33a31` | **Alerte avérée / suppression définitive** uniquement (jamais pour un simple zéro) |
| `--ch-rouge-pastel` (`--coral-bg`) | `#fbe3e0` | Fond d'erreur / blocage / pastille Morte |

### 4.3 Valeurs propres hors charte (alias historiques, peu utilisés)

| Variable | Hex | Usage |
|---|---|---|
| `--primary-light` | `#5a9968` | Résidu (vert clair) |
| `--success` | `#4f9c5f` | Résidu |
| `--blue-solid` | `#3f7fb0` | Bordure de l'ancienne variante `.opt-btn.selected.blue` |
| `--indigo-solid` | `#6f73d1` | Résidu |

### 4.4 Voiles et ombres (`rgba`, les seules couleurs non variabilisées du CSS)

| Valeur | Usage |
|---|---|
| `rgba(43,38,28,0.45)` | Voile du menu hamburger |
| `rgba(43,38,28,0.5)` | Voile des modales et bottom sheets |
| `rgba(43,38,28,0.92)` | Fond du toast |
| `rgba(255,255,255,0.15)` | Fond des boutons d'icône sur le bandeau vert |
| `rgba(0,0,0,0.12)` / `rgba(43,38,28,0.14)` | Ombre légère de la pastille d'onglet active |

### 4.5 Palette des PDF (constantes JS, L22360)

```js
const PDF_CHARTE = { vert: '#357f4b', vertFonce: '#2f6e44', vertPastel: '#e3f3e6', bleu: '#1f5a8a', bleuPastel: '#e6f0fa', ambre: '#b5701c', ambrePastel: '#fbeed7', rouge: '#a33a31', rougePastel: '#fbe3e0', ligneAlt: '#f6f1e4', texte: '#2b261c', texte2: '#5e5b47', icone: '#8a8670', bord: '#e6ddc9' };
```

Mêmes valeurs que le CSS (miroir volontaire) ; `PDF_COULEURS` en dérive en RVB 0..1 (L22947).

### 4.6 Hors webview (Android natif)

`android/app/src/main/res/values/ic_launcher_background.xml` : `#FDF6E3` (fond de l'icône d'application). Le thème Android (`styles.xml`) n'a pas de couleur de charte propre.

---

## 5. Rayons, ombres, espacements, tailles de police

### 5.1 Rayons d'arrondi

| Valeur | Variable / usage |
|---|---|
| `999px` / `--radius-pill` | **Pilules** : boutons, onglets, puces, pastilles, toast (≈ 63 occurrences) |
| `18px` | `--ch-rayon` = `--radius` : cartes, champs historiques, cartes de liste |
| `14px` | `--radius-sm`, `--ch-rayon-pc` (cartes et tuiles PC), tuiles mobile, messages de charte |
| `12px` | Champs 44 px, coins de tableau, `.btn` secondaires PC (20 occurrences) |
| `10px` | Petits blocs, champs dans les cellules de tableau |
| `6–8px` | `.compact-tag`, `.pc-lo`, swipe |
| `50%` | Disques : icônes rondes, FAB, points, fermeture de sheet |

### 5.2 Ombres

| Ombre | Usage |
|---|---|
| `0 1px 3px rgba(0,0,0,0.12)` | Pastille d'onglet active |
| `0 1px 2px rgba(43,38,28,0.14)` | Pastille de contrôle segmenté `.ac-seg button.on` |
| `0 2px 8px rgba(0,0,0,0.25)` | `.fab` |
| `4px 0 24px rgba(0,0,0,0.2)` | Panneau du menu |
| `0 -12px 30px rgba(0,0,0,0.28)` | Bottom sheet |
| `0 12px 40px rgba(0,0,0,0.28)` | Modale centrée |
| `0 0 0 3px var(--ch-vert-pastel)` | **Halo de focus** des champs |
| `0 0 0 2px var(--ch-vert-fonce)` | Carte sélectionnée (tri mobile) |
| `0 0 0 3px var(--amber-bg)` | Repère de scan |
| `0 4px 14px rgba(0,0,0,0.10)` | Survol d'une carte cliquable PC (`.card.cliquable:hover`, avec `translateY(-1px)`) |

Les cartes n'ont **pas** d'ombre : bord 1 px `--border` seulement.

### 5.3 Espacements récurrents

- **Gaps** (les plus fréquents) : 8 px (66×), 10 px (52×), 12 px (38×), 16 px (25×), 6 px, 4 px, 2 px.
- **Padding** : cartes `16px` (`.card`), carte de liste `12px 14px`, message de charte `12px 14px`, tuile `10px 12px` (mobile) / `12px 16px` (PC), bandeau d'en-tête `12px 16px 10px`, page `main` `16px` (max 700 px, 60 px en bas), PC large `24px`.
- **Marges** : `margin-bottom: 12px` (cartes, champs), `10px` (cartes de liste).
- **Cibles tactiles** : 44 px minimum (boutons mobile, puces `.opt-btn`, champs mobile 44–48 px), 48 px (boutons des barres fixes, champs de connexion), 56 px minimum (cartes de liste), 36 px (icônes d'en-tête, pastille lecteur, boutons de cellule 32 px sur PC).
- **Largeurs** : `main` 700 px max ; sidebar PC 240 px ; menu mobile `min(78vw, 300px)` ; modale 380 px ; sheet 700 px.
- **z-index** : 5 barre fixe, 10 en-tête, 30 `.tri-snack`, 500 sidebar PC, 900 surcouche lecteur, 1000 voile menu/modale/sheet, 2000 toast.

### 5.4 Tailles et graisses de police

| Taille | Usage |
|---|---|
| `24px` / 700 | Chiffre de tuile (`.n`) |
| `22px`, `28–30px` | Titres d'assistant, nom de campagne, wordmark de connexion |
| `20px` | Wordmark du menu, numéros de saisie |
| `19px` | Wordmark « OVILOG » du bandeau (Fredoka 700) |
| `16px` | Titre d'écran (`header h1`, 600), n° de carte de liste (700), **champs de saisie** (16 px évite le zoom iOS) |
| `15px` | Titres de carte, boutons `.btn`, entrées de menu (600) |
| `14px` | Corps de saisie PC, puces, `.mb-msg` |
| `13px` | **Taille la plus utilisée (89×)** : libellés `label`, infos secondaires, tableaux, onglets |
| `12px` | Pastilles, sous-textes, en-tête de tableau, ligne éleveur/campagne |
| `10.5–11.5px` | Étiquettes compactes, onglets de fiche brebis, badges |

Graisses : 700 (113×) titres/chiffres/boutons forts, 500 (49×) pastilles et libellés, 600 (24×) boutons/onglets, 400 (11×) corps. Interligne : 1.4–1.45 sur les textes d'aide.

---

## 6. Icônes

**Aucune bibliothèque d'icônes** : ni Font Awesome, ni Material Icons, ni Lucide, ni font d'icônes, aucune feuille de style ni script externe (le seul JS externe est `www/vendor/firebase.bundle.js`, hors UI). Aucune version à relever.

Les icônes sont des **SVG inline écrits à la main**, déclarés comme constantes JS (`www/index.html` L5910–5965) et dessinés avec `currentColor` (donc recolorés par le CSS) :

| Constante | Usage |
|---|---|
| `ICON_SHEEP` (viewBox 48), `ICON_RAM` (dérivée : + cornes) | Brebis, agneaux, agnelles, béliers |
| `ICON_ECHO`, `ICON_SANTE`, `ICON_MOUVEMENT`, `ICON_LAIT`, `ICON_CALENDAR`, `ICON_JOURNAL`, `ICON_SEARCH`, `ICON_BOX`, `ICON_SETTINGS`, `ICON_SYNC`, `ICON_WARNING`… (viewBox 24, trait 2–2.6, `stroke-linecap: round`) | Entrées du menu, en-têtes de carte |
| Hamburger, flèche retour (`&larr;`), croix de fermeture (`✕`), « + » | SVG/texte brut dans le HTML statique |

Mise en forme : `iconCircle(svg, color, size)` → `<span class="icon-circle ic-{green|amber|coral|alerte|blue|indigo|gray} ic-{xs|sm|md|lg}">`. Pastille ronde pastel (bg) + trait foncé (fg) ; tailles 22 / 36 / 44 / 52 px, SVG intérieur 12 / 19 / 24 / 28 px. `ic-coral` est **neutre** (gris) ; `ic-alerte` est le seul rouge. Pas d'emoji dans l'UI (quelques glyphes texte : `✕`, `←`, `+`).

Logo : image PNG en data-URI (30 px en-tête, 38 px menu), `assets/ovilog_logo_1024.png` en source, `border-radius: 50%`.

---

## 7. Mode sombre

**Il n'existe pas.** Vérifié :

- aucune règle `@media (prefers-color-scheme: dark)`, aucun `color-scheme`, aucune balise `<meta name="theme-color">`, aucun attribut `data-theme` ni classe `dark`, ni bascule dans Paramètres ;
- la charte est uniquement claire (crème `#fbf8f1`) et le fichier le revendique (« aucun thème sombre », commentaire du Bilan de reproduction PC) ; les seuls fonds sombres sont volontaires et fixes : le toast, `.tri-snack` (`--ch-texte`) et les voiles de modales ;
- côté natif, `android/.../styles.xml` hérite de `Theme.AppCompat.DayNight.NoActionBar` pour `AppTheme.NoActionBar`, mais l'interface est entièrement rendue dans la WebView avec les couleurs ci-dessus (aucune inversion forcée trouvée : pas de `forceDark` dans `android/app/src/main` ni `electron/`), et Electron ne définit pas de `nativeTheme`.

Si un thème sombre devait être ajouté un jour, le point d'entrée naturel est le `:root` : les composants lisent toutes leurs couleurs via `--ch-*` (et les alias), il suffirait de les redéfinir sous une condition ; les `rgba()` listés en 4.4 et les constantes PDF (`PDF_CHARTE`) resteraient à traiter à part.
