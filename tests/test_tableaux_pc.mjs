/* Tableaux PC à la charte (CLAUDE.md, « Tableaux ») : sur chaque écran PC qui affiche un tableau, l'en-tête est vert #357f4b à texte blanc gras, les lignes sont alternées (1re ligne de données #f6f1e4, la suivante blanche),
   la 1re colonne de données est en vert foncé gras (#2f6e44), le coin haut gauche est arrondi ; tableaux concernés : .pc-t (Mouvements, Chantier de tri, Carnet sanitaire, Produits et délais, Contrôle laitier, Registre),
   .table-desktop (Ordonnances, Sous délai d'attente), .brd-t (Bilan de campagne, Mise bas rapide, aperçus des imports), plus Inventaire et Échographies (déjà conformes). Jeu SYNTHÉTIQUE, saveData REMPLACÉ, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { jeuPcEcrans } from './lib/jeu_pc_ecrans.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const pc = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
await pc.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
await pc.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
pc.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
pc.on('dialog', d => d.accept());
await pc.goto(URL_APP, { waitUntil: 'load' }); await pc.waitForTimeout(300);
await pc.evaluate(jeuPcEcrans);
// [écran, code d'ouverture, nombre de tableaux attendus]
const VUES = [
  ['Tri des agnelles', 'triPcEtat=null;render("agnelles")', 1], ['Lots existants', 'lotsPcEtat=null;render("lots")', 1], ['Chantier de tri, étape 2', 'lotsPcEtat=lotsPcEtatInitial();lotsPcEtat.lotId="L1";currentLotId="L1";render("edit-lot")', 2],
  ['Lot de reproduction (création)', 'render("add-lot-repro")', 2], ['Mouvements d\'animaux + passés', 'render("mouvement-groupe")', 2], ['Carnet sanitaire', 'render("sanitaire")', 2], ['Produits et délais', 'render("produits-delais")', 3],
  ['Ordonnances', 'render("ordonnances")', 1], ['Sous délai d\'attente', 'render("sous-delai")', 1], ['Contrôle laitier', 'render("controle-laitier")', 1], ['Registre', 'render("registre")', 1],
  ['Inventaire (actifs)', 'render("inventaire-actifs")', 1], ['Échographies', 'render("echo-rapide")', 2], ['Historique des échos', 'render("historique-echo")', 1], ['Mise bas rapide', 'render("misebas-rapide")', 1],
  ['Bilan de reproduction', 'bilanCampagneTab="reproduction";render("bilan-campagne")', 5], ['Bilan de lactation', 'bilanCampagneTab="lactation";render("bilan-campagne")', 1], ['Bilan économique', 'bilanCampagneTab="economique";render("bilan-campagne")', 1],
  ['Paramètres › Imports', 'parametresTab="imports";render("parametres")', 3]];
const BEIGE = 'rgb(246, 241, 228)', BLANC = 'rgb(255, 255, 255)';
let total = 0;
for (const [nom, code, n] of VUES) {
  await pc.evaluate(code); await pc.waitForTimeout(120);
  const tabs = await pc.evaluate(() => [...document.querySelectorAll('#app table')].filter(t => t.getBoundingClientRect().width > 0).map(t => {
    const cs = e => getComputedStyle(e), th = t.querySelector('th'), rows = [...t.querySelectorAll('tr')], entetes = rows.filter(r => r.querySelector('th') && !r.querySelector('td')), data = rows.filter(r => r.querySelector('td'));
    const premTd = r => [...r.children].find(c => c.tagName === 'TD' && !c.classList.contains('cb')) || r.querySelector('td');
    const t1 = data[0] && cs(data[0].querySelector('td')).backgroundColor, t2 = data[1] && cs(data[1].querySelector('td')).backgroundColor;
    return { cls: t.className, id: t.id || t.className, th: [cs(th).backgroundColor, cs(th).color, cs(th).fontWeight, cs(th).textTransform], rayon: cs(entetes[0].querySelector('th')).borderTopLeftRadius, nEntetes: entetes.length,
      l1: t1, l2: t2, cellules: data[0] ? data[0].querySelectorAll('td').length : 0, col1: data[0] ? [cs(premTd(data[0])).color, cs(premTd(data[0])).fontWeight] : null, nLignes: data.length };
  }));
  eq(tabs.length, n, nom + ' : nombre de tableaux affichés');
  for (const t of tabs) {
    const m = nom + ' (' + t.id + ')';
    eq(t.th, ['rgb(53, 127, 75)', BLANC, '700', 'none'], m + ' : en-tête vert #357f4b, texte blanc gras, sans majuscules forcées');
    if (/\b(pc-t|table-desktop|brd-t|rs-t)\b/.test(t.cls)) check(parseFloat(t.rayon) >= 12, m + ' : coin haut gauche arrondi (' + t.rayon + ')');
    if (t.l1 && t.l2) { check(t.l1 !== t.l2 && [t.l1, t.l2].every(c => c === BEIGE || c === BLANC), m + ' : lignes alternées #f6f1e4 / blanc : ' + t.l1 + ' / ' + t.l2); if (t.nEntetes === 1) eq(t.l1, BEIGE, m + ' : 1re ligne de données #f6f1e4'); }
    if (t.col1 && t.cellules > 1) eq(t.col1, ['rgb(47, 110, 68)', '700'], m + ' : 1re colonne en vert foncé gras');
    total++;
  }
}
console.log('OK tableaux PC : ' + total + ' tableaux sur ' + VUES.length + ' écrans à la charte (en-tête vert, lignes alternées, 1re colonne en vert foncé gras, coins arrondis).');
// le #fff en dur de .inv-table est remplacé par la variable de charte
const html = (await import('fs')).readFileSync(new URL('../www/index.html', import.meta.url), 'utf8');
check(!/table\.inv-table[^{]*\{[^}]*#fff\b/.test(html), '.inv-table : plus de #fff en dur (var(--ch-carte))');
console.log('OK .inv-table : blanc par var(--ch-carte).');
await browser.close();
console.log('\nTOUS LES TESTS « TABLEAUX PC À LA CHARTE » SONT PASSÉS.');
