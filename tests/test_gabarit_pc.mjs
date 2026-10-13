/* Gabarit PC commun (CLAUDE.md, « Charte graphique ») : sur les écrans PC, mêmes hauteurs et rayons partout. Section 5 : menu latéral (chaque entrée sur une seule ligne, y compris « Mouvements d'animaux »). Section 4 : Mouvements d'animaux (pas de bandeau rose : barre neutre, puces en vert pastel, bouton « Valider » vert, ligne ambre pour les sorties définitives Morte / Perte / Autoconsommation). Section 3 : exports (« Export Excel » en blanc, « Export PDF » en vert, Excel avant PDF, jamais « Exporter … (.xlsx) »). Section 2 : titre unique (le titre de l'écran n'est écrit que dans le bandeau vert, jamais répété dans la page) et contenu pleine largeur (marge de 24 px, plus de colonne plafonnée à 900 / 420 / 520 px). Section 1 (socle) : champs 44 px / rayon 12 ; boutons .btn en pastille ≥ 44 px (32 px dans une cellule de tableau) ; lignes de tableau 48 px (40 px pour les tableaux de synthèse) ; titres de section .pc-sec en 12 px majuscules gris. Jeu SYNTHÉTIQUE (jeuPcEcrans), saveData neutralisé. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { jeuPcEcrans } from './lib/jeu_pc_ecrans.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const pc = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
await pc.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
await pc.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
pc.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
pc.on('dialog', d => d.accept());
await pc.goto(URL_APP, { waitUntil: 'load' }); await pc.waitForTimeout(300);
await pc.evaluate(jeuPcEcrans);
export const VUES_GABARIT = [
  ['Échographies', 'render("echo-rapide")'], ['Tri des agnelles', 'render("agnelles")'], ['Lots', 'lotsPcEtat=null;render("lots")'], ['Mouvements d\'animaux', 'render("mouvement-groupe")'],
  ['Carnet sanitaire', 'render("sanitaire")'], ['Produits et délais', 'render("produits-delais")'], ['Ordonnances', 'render("ordonnances")'], ['Sous délai d\'attente', 'render("sous-delai")'],
  ['Contrôle laitier', 'render("controle-laitier")'], ['Registre', 'render("registre")'], ['Inventaire', 'render("inventaire-actifs")'], ['Mise bas rapide', 'render("misebas-rapide")'],
  ['Bilan de campagne', 'bilanCampagneTab="reproduction";render("bilan-campagne")'], ['Paramètres', 'parametresTab="imports";render("parametres")'], ['Déclaration annuelle', 'render("declaration-annuelle")']];
let nChamps = 0, nBoutons = 0, nLignes = 0, nSec = 0;
for (const [nom, code] of VUES_GABARIT) {
  await pc.evaluate(code); await pc.waitForTimeout(120);
  const r = await pc.evaluate(() => {
    const vis = e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; }, cs = e => getComputedStyle(e), h = e => Math.round(e.getBoundingClientRect().height);
    const app = document.getElementById('app'), q = s => [...app.querySelectorAll(s)].filter(vis);
    const champs = q('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=color]):not([type=hidden]), select').filter(e => !e.closest('td, th')).map(e => ({ id: e.id || e.className || e.tagName, h: h(e), r: cs(e).borderTopLeftRadius }));
    const boutons = q('button.btn').map(e => ({ id: e.id || e.textContent.trim().slice(0, 20), h: h(e), r: cs(e).borderTopLeftRadius, cellule: !!e.closest('td, th') }));
    const lignes = q('table').map(t => { const tr = [...t.querySelectorAll('tbody tr')].find(x => x.querySelector('td') && vis(x)); return tr ? { cls: t.className, h: h(tr) } : null; }).filter(Boolean);
    const sec = q('.pc-sec').map(e => [cs(e).fontSize, cs(e).fontWeight, cs(e).textTransform, cs(e).color]);
    return { champs, boutons, lignes, sec };
  });
  for (const c of r.champs) { check(c.h === 44 || c.h === 36, nom + ' : champ ' + c.id + ' de hauteur 44 px (obtenu ' + c.h + ')'); check(c.r === '12px' || c.r === '10px', nom + ' : champ ' + c.id + ' de rayon 12 px (obtenu ' + c.r + ')'); nChamps++; }
  for (const b of r.boutons) { check(b.h >= (b.cellule ? 32 : 44), nom + ' : bouton ' + b.id + ' trop bas (' + b.h + ' px)'); check(parseFloat(b.r) >= 16, nom + ' : bouton ' + b.id + ' en pastille (' + b.r + ')'); nBoutons++; }
  for (const l of r.lignes) { check(l.h >= 40 && l.h <= 56, nom + ' : ligne de tableau ' + l.cls + ' à 40-56 px (obtenu ' + l.h + ')'); nLignes++; }
  for (const s of r.sec) { check(s[0] === '12px' && s[1] === '500' && s[2] === 'uppercase' && s[3] === 'rgb(94, 91, 71)', nom + ' : titre de section .pc-sec en 12 px / 500 / majuscules / gris : ' + JSON.stringify(s)); nSec++; }
}
// Section 2 : titre unique + pleine largeur
let nTitres = 0, nLarges = 0;
for (const [nom, code] of VUES_GABARIT.concat([['Agneaux', 'render("agneaux")'], ['Agnelles', 'render("agnelles-inventaire")'], ['Production laitière', 'render("qualite")'], ['Brebis', 'render("list")'], ['Béliers', 'render("beliers")']])) {
  await pc.evaluate(code); await pc.waitForTimeout(120);
  const r = await pc.evaluate(() => {
    const vis = e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; }, a = document.getElementById('app'), R = a.getBoundingClientRect(), cs = getComputedStyle(a);
    const banniere = document.getElementById('page-title').textContent.trim();
    const titres = [...a.querySelectorAll('h1, h2, .brd-title')].filter(vis).map(e => e.textContent.trim());
    const plafonnes = [...a.children].filter(vis).map(e => getComputedStyle(e).maxWidth).filter(m => /^(900|420|520)px$/.test(m));
    const interne = [...a.querySelectorAll('.pc-onglets, .list-table-contain')].filter(vis).map(e => getComputedStyle(e).maxWidth).filter(m => m !== 'none');
    return { banniere, titres, plafonnes, interne, gauche: Math.round(R.left), droite: Math.round(innerWidth - R.right), pad: [cs.paddingLeft, cs.paddingRight] };
  });
  check(!r.titres.includes(r.banniere), nom + ' : le titre « ' + r.banniere + ' » est répété dans la page (' + JSON.stringify(r.titres) + ')'); nTitres++;
  check(r.plafonnes.length === 0 && r.interne.length === 0, nom + ' : bloc plafonné en largeur ' + JSON.stringify(r.plafonnes.concat(r.interne)));
  check(r.gauche === 240 && r.droite === 0 && r.pad[0] === '24px' && r.pad[1] === '24px', nom + ' : contenu pleine largeur avec 24 px de marge (' + JSON.stringify(r) + ')'); nLarges++;
}
console.log('OK gabarit PC, titre unique : ' + nTitres + ' écrans sans titre répété ; pleine largeur : ' + nLarges + ' écrans (marge 24 px, aucun bloc plafonné).');
// Section 3 : exports
const VUES_EXPORTS = VUES_GABARIT.concat([['Échographies, résultats', 'echoPcEtat=null;render("echo-rapide")'], ['Traitements 12 mois', 'render("traitements-12-mois")'], ['Production laitière', 'render("qualite")'], ['Bilan de lactation', 'bilanCampagneTab="lactation";render("bilan-campagne")'], ['Tri des agnelles', 'render("agnelles")']]);
let nExp = 0;
for (const [nom, code] of VUES_EXPORTS) {
  await pc.evaluate(code); await pc.waitForTimeout(120);
  const r = await pc.evaluate(() => {
    const vis = e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
    return [...document.getElementById('app').querySelectorAll('button')].filter(vis).filter(e => /export/i.test(e.id) || /^export|\(pdf\)|\.xlsx/i.test(e.textContent.trim())).map(e => ({ id: e.id, t: e.textContent.trim(), bg: getComputedStyle(e).backgroundColor, x: Math.round(e.getBoundingClientRect().left), y: Math.round(e.getBoundingClientRect().top) }));
  });
  const BLANC = 'rgb(255, 255, 255)', VERT = 'rgb(53, 127, 75)';
  for (const b of r) {
    check(!/\.xlsx|^Exporter/.test(b.t), nom + ' : libellé d\'export à l\'ancienne « ' + b.t + ' »');
    if (/excel|xlsx/i.test(b.id + b.t) && !/pdf/i.test(b.id + b.t)) check(b.bg === BLANC && /^Export Excel$/.test(b.t), nom + ' : « ' + b.t + ' » doit être « Export Excel » en blanc (' + b.bg + ')');
    else if (/pdf/i.test(b.id + b.t) && !/ce lot|bilan par âge/i.test(b.t)) check(b.bg === VERT, nom + ' : « ' + b.t + ' » doit être un bouton PDF vert (' + b.bg + ')');
    nExp++;
  }
  const xl = r.find(b => /^Export Excel$/.test(b.t)), pdf = r.find(b => /^Export PDF$/.test(b.t));
  if (xl && pdf && Math.abs(xl.y - pdf.y) < 20) check(xl.x < pdf.x, nom + ' : « Export Excel » doit être à gauche de « Export PDF »');
}
console.log('OK gabarit PC, exports : ' + nExp + ' boutons d\'export (Excel blanc, PDF vert, Excel avant PDF).');
// Section 4 : Mouvements d'animaux
{
  const lire = () => pc.evaluate(() => { const cs = e => getComputedStyle(e), b = document.getElementById('mv-barre'), amb = document.getElementById('mv-ambre'), v = document.getElementById('mv-valider'), cat = document.querySelector('.mv-cat.selected'), typ = document.querySelector('.mv-type.on');
    return { barre: cs(b).backgroundColor, bord: cs(b).borderTopWidth, ambreVisible: amb.getBoundingClientRect().height > 0, ambreTxt: amb.textContent, ambreBg: cs(amb).backgroundColor, vertBg: cs(v).backgroundColor, cat: cs(cat).backgroundColor, typ: typ ? cs(typ).backgroundColor : null, rouges: [...document.querySelectorAll('#pc-mouvements *')].filter(e => e.getBoundingClientRect().width > 150 && ['rgb(251, 227, 224)', 'rgb(163, 58, 49)'].includes(cs(e).backgroundColor)).length }; });
  const VERT = 'rgb(53, 127, 75)', PASTEL = 'rgb(227, 243, 230)', BLANC = 'rgb(255, 255, 255)', AMBRE = 'rgb(251, 238, 215)';
  for (const [type, ambre] of [['Vente', false], ['Morte', true], ['Perte', true], ['Autoconsommation', true]]) {
    await pc.evaluate(t => { mvPcEtat = mvPcEtatInitial(); mvPcEtat.type = t; render('mouvement-groupe'); }, type); await pc.waitForTimeout(120);
    const m = await lire();
    check(m.barre === BLANC && m.bord === '1px', type + ' : barre de validation neutre (blanc à bord) : ' + m.barre);
    check(m.vertBg === VERT, type + ' : bouton « Valider » vert : ' + m.vertBg);
    check(m.cat === PASTEL && m.typ === PASTEL, type + ' : puces catégorie / type en vert pastel : ' + m.cat + ' / ' + m.typ);
    check(m.rouges === 0, type + ' : plus aucun grand bloc rose ou rouge (' + m.rouges + ')');
    check(m.ambreVisible === ambre, type + ' : ligne ambre ' + (ambre ? 'visible' : 'absente'));
    if (ambre) check(m.ambreBg === AMBRE && /Sortie définitive/.test(m.ambreTxt), type + ' : ligne ambre « Sortie définitive » : ' + m.ambreBg + ' / ' + m.ambreTxt);
  }
  console.log('OK gabarit PC, Mouvements d\'animaux : barre neutre, puces vert pastel, « Valider » vert, ligne ambre pour Morte / Perte / Autoconsommation seulement.');
}
// Section 5 : menu latéral sur une seule ligne
{
  const items = await pc.evaluate(() => [...document.querySelectorAll('#nav-drawer-overlay .nav-item')].map(e => { const cs = getComputedStyle(e), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2, t = e.querySelector('span:last-child') || e; const r = document.createRange(); r.selectNodeContents(t); return { t: e.textContent.trim(), lignes: r.getClientRects().length, debord: e.scrollWidth > e.clientWidth }; }));
  check(items.length >= 10, 'menu latéral : ' + items.length + ' entrées');
  check(items.some(i => /Mouvements d'animaux/.test(i.t)), 'menu latéral : entrée « Mouvements d\'animaux » présente');
  for (const i of items) check(i.lignes <= 1 && !i.debord, 'menu latéral : « ' + i.t + ' » sur une seule ligne (' + i.lignes + ' lignes, débordement ' + i.debord + ')');
  console.log('OK gabarit PC, menu : ' + items.length + ' entrées sur une seule ligne.');
}
// Section 6 : tuiles uniformes (même composant que l'Accueil : liseré 5 px + fond pastel, libellé 13 px minuscules, chiffre 24 px gras ; « — » ou vide = neutre)
{
  const PASTELS = { vert: 'rgb(227, 243, 230)', bleu: 'rgb(230, 240, 250)', ambre: 'rgb(251, 238, 215)', rouge: 'rgb(251, 227, 224)', neutre: 'rgb(239, 233, 218)', gris: 'rgb(239, 233, 218)' };
  const VUES_TUILES = [['Accueil', 'render("home")'], ['Échographies', 'echoPcEtat=null;render("echo-rapide")'], ['Saisie de mises bas', 'render("misebas-rapide")'], ['Contrôle laitier', 'render("controle-laitier")'], ['Inventaire', 'render("inventaire-actifs")'],
    ['Produits et délais', 'render("produits-delais")'], ['Production laitière, Tank', 'plOnglet="tank";render("qualite")'], ['Production laitière, Qualité', 'plOnglet="qualite";render("qualite")'], ['Bilan de reproduction', 'bilanCampagneTab="reproduction";render("bilan-campagne")'],
    ['Bilan de lactation', 'bilanCampagneTab="lactation";render("bilan-campagne")'], ['Bilan économique', 'bilanCampagneTab="economique";render("bilan-campagne")'], ['Registre', 'render("registre")'], ['Déclaration annuelle', 'render("declaration-annuelle")']];
  let nTuiles = 0, nNeutres = 0;
  for (const [nom, code] of VUES_TUILES) {
    await pc.evaluate(code); await pc.waitForTimeout(150);
    const t = await pc.evaluate(() => {
      const vis = e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; }, cs = e => getComputedStyle(e);
      const app = document.getElementById('app');
      return [...app.querySelectorAll('.tuile-pc')].filter(vis).map(e => {
        const l = e.querySelector('.l, .brd-kpi-l, .reg-tuile-l, .decl-tuile-l'), v = e.querySelector('.n, .brd-kpi-v, .reg-tuile-v, .decl-tuile-v');
        return { cls: e.className, bg: cs(e).backgroundColor, bl: cs(e).borderLeftWidth, lab: l ? l.textContent.trim() : '', lfs: l ? cs(l).fontSize : '', ltt: l ? cs(l).textTransform : '', lfw: l ? cs(l).fontWeight : '', val: v ? v.textContent.trim() : '', vfs: v ? cs(v).fontSize : '', vfw: v ? cs(v).fontWeight : '' };
      }).concat([...app.querySelectorAll('.brd-kpi:not(.tuile-pc), .decl-tuile:not(.tuile-pc), .apc-tuile:not(.tuile-pc)')].filter(vis).map(e => ({ cls: 'HORS COMPOSANT ' + e.className, bg: '', bl: '', lab: e.textContent.trim().slice(0, 30), lfs: '', ltt: '', lfw: '', val: '', vfs: '', vfw: '' })));
    });
    check(t.length >= 3, nom + ' : au moins 3 tuiles (' + t.length + ')');
    for (const x of t) {
      check(!/HORS COMPOSANT/.test(x.cls), nom + ' : tuile « ' + x.lab + ' » hors du composant unique (' + x.cls + ')');
      const ton = (x.cls.match(/\b(vert|bleu|ambre|rouge|neutre|gris)\b/) || [])[1];
      check(!!ton, nom + ' : tuile « ' + x.lab + ' » sans ton (' + x.cls + ')');
      check(x.bg === PASTELS[ton] && x.bg !== 'rgb(255, 255, 255)', nom + ' : tuile « ' + x.lab + ' » en fond pastel ' + ton + ' (obtenu ' + x.bg + ')');
      check(x.bl === '5px', nom + ' : tuile « ' + x.lab + ' » avec liseré gauche de 5 px (' + x.bl + ')');
      check(x.lfs === '13px' && x.ltt === 'none' && x.lfw === '400', nom + ' : libellé « ' + x.lab + ' » en 13 px, minuscules, normal : ' + [x.lfs, x.ltt, x.lfw]);
      check(!(x.lab === x.lab.toUpperCase() && /[A-ZÀ-Ý]{3,}/.test(x.lab)), nom + ' : libellé « ' + x.lab + ' » pas tout en majuscules');
      check(x.vfs === '24px' && x.vfw === '700', nom + ' : chiffre de « ' + x.lab + ' » en 24 px gras : ' + [x.vfs, x.vfw]);
      if (/^[—–-]$/.test(x.val) || x.val === '') { check(/neutre|gris/.test(x.cls), nom + ' : « ' + x.lab + ' » vaut « ' + x.val + ' » donc neutre (' + x.cls + ')'); nNeutres++; }
      nTuiles++;
    }
  }
  // Valeur vide ou « — » : neutre ; « 0 » garde sa couleur
  const h = await pc.evaluate(() => [pcKpi('a', '—', '', 'vert'), pcKpi('a', '', '', 'bleu'), pcKpi('a', '<b>–</b>', '', 'ambre'), pcKpi('a', 0, '', 'vert'), pcKpi('a', '0 L', '', 'bleu'), pcKpi('a', 4, '', 'rouge'), pcKpi('a', 4)]);
  check(/neutre/.test(h[0]) && /neutre/.test(h[1]) && /neutre/.test(h[2]), 'pcKpi : « — » ou vide donne une tuile neutre');
  check(/tuile-pc vert/.test(h[3]) && /tuile-pc bleu/.test(h[4]) && /tuile-pc rouge/.test(h[5]) && /neutre/.test(h[6]), 'pcKpi : 0 garde son ton, rouge accepté, ton absent = neutre');
  console.log('OK gabarit PC, tuiles : ' + nTuiles + ' tuiles sur ' + VUES_TUILES.length + ' écrans, même composant (fond pastel, liseré 5 px, libellé 13 px minuscules, chiffre 24 px gras), ' + nNeutres + ' neutres (« — »).');
}
// Section 7 : doublons de libellés (titre de page repris dans la page, sous quelque forme que ce soit)
{
  let n = 0;
  for (const [nom, code] of [['Chantier de tri, Lots', 'lotsPcEtat=null;render("lots")'], ['Chantier de tri, Tri des agnelles', 'render("agnelles")'], ['Traitements sur 12 mois', 'render("traitements-12-mois")'], ['Déclaration annuelle', 'render("declaration-annuelle")'], ['Production laitière', 'render("qualite")'], ['Contrôle laitier', 'render("controle-laitier")'], ['Carnet sanitaire', 'render("sanitaire")']]) {
    await pc.evaluate(code); await pc.waitForTimeout(150);
    const r = await pc.evaluate(() => {
      const vis = e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
      const ban = document.getElementById('page-title').textContent.trim().toLowerCase();
      const feuilles = [...document.getElementById('app').querySelectorAll('*')].filter(e => vis(e) && !e.children.length && !e.closest('button, option, select, .pc-onglets, th, td'));
      return { ban, memes: feuilles.filter(e => e.textContent.trim().toLowerCase() === ban).map(e => e.tagName + '.' + e.className), textes: feuilles.map(e => e.textContent.trim()).filter(t => t.length > 3) };
    });
    check(r.memes.length === 0, nom + ' : le bandeau « ' + r.ban + ' » est répété dans la page (' + JSON.stringify(r.memes) + ')');
    n++;
  }
  // Déclaration : « Agneaux nés » une seule fois, l'année seulement dans le titre de carte, plus de sous-titre qui répète les cartes
  await pc.evaluate('render("declaration-annuelle")'); await pc.waitForTimeout(150);
  const d = await pc.evaluate(() => ({ tuiles: [...document.querySelectorAll('#pc-declaration .decl-tuile-l')].map(e => e.textContent.trim()), sous: [...document.querySelectorAll('#pc-declaration .brd-sub')].map(e => e.textContent.trim()), titres: [...document.querySelectorAll('#pc-declaration .prm-titre')].map(e => e.textContent.trim()) }));
  check(d.tuiles.filter(t => /Agneaux nés/.test(t)).length === 1, 'Déclaration : « Agneaux nés » une seule fois (' + JSON.stringify(d.tuiles) + ')');
  check(!d.tuiles.some(t => /Brebis présentes au 1er janvier \d{4}|Agneaux vendus en/.test(t)), 'Déclaration : plus d\'année dans les libellés de la carte Ratio (' + JSON.stringify(d.tuiles) + ')');
  check(d.sous.length === 1 && !/Recensement/.test(d.sous[0]), 'Déclaration : sous-titre sans répétition des titres de cartes (' + JSON.stringify(d.sous) + ')');
  console.log('OK gabarit PC, doublons : ' + n + ' écrans sans titre de page répété ; Déclaration sans doublon.');
}
// Section 8 : focus vert (charte) sur les champs, les boutons et les cases, jamais le contour du navigateur
{
  const VERT = 'rgb(53, 127, 75)', PASTEL = 'rgb(227, 243, 230)';
  let n = 0;
  for (const [nom, code, sel] of [['Saisie de mises bas', 'render("misebas-rapide")', '#scan-misebas'], ['Contrôle laitier', 'render("controle-laitier")', 'input[type=text], input[type=date], select'], ['Production laitière', 'plOnglet="tank";render("qualite")', 'select, input'], ['Chantier de tri', 'lotsPcEtat=null;render("lots")', 'input[type=text], input[type=date]'], ['Paramètres', 'parametresTab="exploitation";render("parametres")', 'input[type=text]']]) {
    await pc.evaluate(code); await pc.waitForTimeout(150);
    const r = await pc.evaluate(sel => { const e = [...document.getElementById('app').querySelectorAll(sel)].find(x => { const b = x.getBoundingClientRect(); return b.width > 0 && b.height > 0 && !x.disabled; }); if (!e) return null; e.focus(); const c = getComputedStyle(e); return { bord: c.borderTopColor, ombre: c.boxShadow, contour: c.outlineStyle }; }, sel);
    check(!!r, nom + ' : un champ à tester');
    check(r.bord === VERT && r.ombre.includes(PASTEL) && r.contour === 'none', nom + ' : focus du champ en cadre vert charte (bord ' + r.bord + ', halo ' + r.ombre + ', contour ' + r.contour + ')');
    n++;
  }
  // bouton atteint au clavier : contour vert de 2 px
  await pc.evaluate('render("misebas-rapide")'); await pc.waitForTimeout(150);
  await pc.focus('#scan-misebas'); await pc.keyboard.press('Shift+Tab'); await pc.keyboard.press('Shift+Tab');
  const b = await pc.evaluate(() => { const e = document.activeElement, c = getComputedStyle(e); return { tag: e.tagName, id: e.id, couleur: c.outlineColor, style: c.outlineStyle, largeur: c.outlineWidth }; });
  check(b.style === 'solid' && b.couleur === VERT && b.largeur === '2px', 'focus clavier (' + b.tag + '#' + b.id + ') : contour vert de 2 px (' + JSON.stringify(b) + ')');
  console.log('OK gabarit PC, focus : ' + n + ' champs en cadre vert charte, bouton au clavier en contour vert.');
}
console.log('OK gabarit PC, socle : ' + nChamps + ' champs, ' + nBoutons + ' boutons, ' + nLignes + ' tableaux, ' + nSec + ' titres de section sur ' + VUES_GABARIT.length + ' écrans.');
await browser.close();
console.log('\nTOUS LES TESTS « GABARIT PC » SONT PASSÉS.');
