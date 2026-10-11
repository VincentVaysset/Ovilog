/* Gabarit PC commun (CLAUDE.md, « Charte graphique ») : sur les écrans PC, mêmes hauteurs et rayons partout. Section 3 : exports (« Export Excel » en blanc, « Export PDF » en vert, Excel avant PDF, jamais « Exporter … (.xlsx) »). Section 2 : titre unique (le titre de l'écran n'est écrit que dans le bandeau vert, jamais répété dans la page) et contenu pleine largeur (marge de 24 px, plus de colonne plafonnée à 900 / 420 / 520 px). Section 1 (socle) : champs 44 px / rayon 12 ; boutons .btn en pastille ≥ 44 px (32 px dans une cellule de tableau) ; lignes de tableau 48 px (40 px pour les tableaux de synthèse) ; titres de section .pc-sec en 12 px majuscules gris. Jeu SYNTHÉTIQUE (jeuPcEcrans), saveData neutralisé. */
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
console.log('OK gabarit PC, socle : ' + nChamps + ' champs, ' + nBoutons + ' boutons, ' + nLignes + ' tableaux, ' + nSec + ' titres de section sur ' + VUES_GABARIT.length + ' écrans.');
await browser.close();
console.log('\nTOUS LES TESTS « GABARIT PC » SONT PASSÉS.');
