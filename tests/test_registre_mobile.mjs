/* Registre d'élevage, MOBILE (3 onglets Agnelage, Mouvements, Sanitaire ; modèle de la maquette mobile) : tuiles 2×2 aux mêmes chiffres que la page PC (registreIndicateursPc), carte avec recherche
   et filtres sur UNE ligne, liste en cartes (numéro, catégorie, pastille de type colorée, date, cause / détail sur sa propre ligne sans coupure, campagne), 20 cartes puis « Voir tout », exports
   en bas (Excel en contour, PDF en vert plein), plus de « ? » (❔) : l'information tient en une ligne sous les filtres. Mêmes lignes et même tri que le tableau d'avant et que la page PC ;
   recherche et filtres ; exports Excel et PDF inchangés (PDF = onglet affiché, filtré). La page PC n'est pas modifiée (test_pc_registre). saveData REMPLACÉ, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { jeuRegistre } from './lib/jeu_registre_cl.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 400, height: 900 } })).newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
await page.evaluate(jeuRegistre);
await page.evaluate(() => {
  window.__saves = 0; saveData = function () { window.__saves++; return true; };
  // 30 soins de plus sur une brebis (au-delà des 20 cartes) : traitements de septembre 2026
  const soins = Array.from({ length: 30 }, (_, i) => ({ type: 'Traitement', sousType: 'Antibiotique', produit: 'Produit ' + i, date: '2026-09-' + String(1 + (i % 28)).padStart(2, '0'), dose: i + ' cc', numeroOrdonnance: '' }));
  DB.brebis[1].sanitaire = DB.brebis[1].sanitaire.concat(soins);
  window.__avant = JSON.stringify(DB);
  window.__sorties = [];
  saveOrShareBinaryFile = async function (nom, bytes, mime) { window.__sorties.push({ nom, mime, n: bytes.length }); };
  window.__pdf = []; const o = buildPdfTableCharte; buildPdfTableCharte = function (a) { window.__pdf.push({ title: a.title, rows: a.rows.length, premiere: a.rows[0] }); return o(a); };
  window.__xlsx = []; const ox = buildXlsxWorkbook; buildXlsxWorkbook = async function (f) { window.__xlsx.push(f.map(x => x.name + ':' + x.rows.length)); return ox(f); };
  registreFiltre = ''; registreColFiltres = { agnelage: { sexe: '', campagne: '' }, mouvements: { categorie: '', type: '', campagne: '' }, sanitaire: { categorie: '', type: '', campagne: '' } };
});
const ouvrir = (v) => page.evaluate((v) => { registreView = v; render('registre'); }, v);
const cartes = () => page.evaluate(() => [...document.querySelectorAll('.reg-ligne')].map(c => ({ num: c.querySelector('.reg-num').textContent, cat: (c.querySelector('.reg-cat') || {}).textContent || '', past: c.querySelector('.reg-pastille').textContent, date: c.querySelector('.reg-date').textContent, l2: (c.querySelector('.reg-l2') || {}).textContent || '', l3: c.querySelector('.reg-l3').textContent })));
const box = (sel) => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }, sel);

// ================================================================ 1. structure commune (3 onglets)
for (const v of ['mouvements', 'sanitaire', 'agnelage']) {
  await ouvrir(v);
  check(await page.evaluate(() => !document.querySelector('.info-bulle-btn') && !document.getElementById('app').textContent.includes('❔')), v + ' : plus aucun « ? » (❔)');
  eq(await page.evaluate(() => document.querySelector('.tab-btn.active').dataset.tab), v, v + ' : onglet actif');
  // tuiles 2×2, mêmes chiffres que la page PC
  const tuiles = await page.evaluate(() => [...document.querySelectorAll('.reg-tuile')].map(t => { const r = t.getBoundingClientRect(); return [t.querySelector('.reg-tuile-l').textContent, t.querySelector('.reg-tuile-v').textContent, Math.round(r.x), Math.round(r.y)]; }));
  eq(tuiles.length, 4, v + ' : 4 tuiles');
  check(new Set(tuiles.map(t => t[2])).size === 2 && new Set(tuiles.map(t => t[3])).size === 2, v + ' : tuiles en 2 colonnes × 2 lignes');
  const ind = await page.evaluate(() => registreIndicateursPc());
  const attendu = v === 'mouvements' ? [['Animaux au registre', ind.animaux.total], ['Actifs', ind.animaux.actifs], ['Entrées', ind.mouvements.entrees], ['Sorties', ind.mouvements.total - ind.mouvements.entrees]]
    : v === 'sanitaire' ? [['Soins enregistrés', ind.sanitaire.soins], ['Traitements', ind.sanitaire.traitements], ['Vaccins', ind.sanitaire.vaccins], ['Autres', ind.sanitaire.autres]]
    : [['Agneaux enregistrés', ind.agnelage.agneaux], ['Mâles', ind.agnelage.males], ['Femelles', ind.agnelage.femelles], ['Morts-nés', ind.agnelage.mortNes]];
  eq(tuiles.map(t => [t[0], t[1]]), attendu.map(a => [a[0], String(a[1])]), v + ' : tuiles = chiffres de la page PC');
  eq(await page.evaluate(() => [...document.querySelectorAll('.reg-tuile')].map(t => t.classList[1])), ['vert', 'bleu', 'ambre', 'rouge'], v + ' : couleurs vert, bleu, ambre, rouge');
  // carte de filtres : recherche puis filtres sur une seule ligne
  const sels = await page.evaluate(() => [...document.querySelectorAll('#registre-filtres select')].map(s => { const r = s.getBoundingClientRect(); return [Math.round(r.y), Math.round(r.x), Math.round(r.width)]; }));
  eq(sels.length, v === 'agnelage' ? 2 : 3, v + ' : nombre de filtres');
  check(new Set(sels.map(s => s[0])).size === 1, v + ' : les filtres sont sur une seule ligne');
  check((await box('#registre-filtre')).y < sels[0][0], v + ' : recherche au-dessus des filtres');
  check(await page.evaluate(() => document.querySelector('.reg-carte-filtres').contains(document.querySelector('.reg-info')) && /lecture seule/.test(document.querySelector('.reg-info').textContent) && /conditionnalité PAC/.test(document.querySelector('.reg-info').textContent)), v + ' : l\'information des « ? » tient dans une ligne sous les filtres');
  // exports en bas : Excel en contour, PDF en vert plein
  eq(await page.evaluate(() => [document.getElementById('btn-export-registre').className, document.getElementById('btn-export-registre-pdf').className, document.getElementById('btn-export-registre').textContent, document.getElementById('btn-export-registre-pdf').textContent]), ['btn btn-secondary', 'btn btn-primary', 'Exporter (.xlsx)', 'Export PDF'], v + ' : boutons d\'export');
  check((await box('#btn-export-registre')).y > (await box('.reg-carte-liste')).y, v + ' : exports sous la liste');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), v + ' : aucun défilement horizontal');
  // cartes : rien de coupé
  check(await page.evaluate(() => [...document.querySelectorAll('.reg-ligne')].every(c => c.scrollWidth <= c.clientWidth + 1 && [...c.querySelectorAll('.reg-l2')].every(l => getComputedStyle(l).textOverflow !== 'ellipsis' && l.scrollWidth <= l.clientWidth + 1))), v + ' : aucune carte coupée');
}
console.log('OK 1 structure : tuiles 2×2 (chiffres de la page PC), recherche et filtres sur une ligne, plus de « ? », exports en bas, rien de coupé.');

// ================================================================ 2. Mouvements : cartes = lignes du tableau d'avant, mêmes tris
await ouvrir('mouvements');
const lignesMvt = await page.evaluate(() => registreMouvementsFilteredRows('', registreColFiltres.mouvements).map(r => ['n°' + numeroVisuel(r.eid), r.categorie, r.type, formatDateFr(r.date), r.detail, registreCampagneLabelTexte(r)]));
const cm = await cartes();
eq(cm.map(c => [c.num, c.cat, c.past, c.date, c.l2, c.l3]), lignesMvt.map(l => [l[0], l[1], l[2], l[3], l[4], l[5]]), 'Mouvements : mêmes lignes, même tri, même contenu que la page PC');
eq(await page.evaluate(() => document.querySelector('.reg-liste-n').textContent), lignesMvt.length + ' mouvements', 'Mouvements : compte');
check(await page.evaluate(() => document.querySelector('.reg-liste-tri').textContent === 'Du plus récent au plus ancien'), 'Mouvements : mention du tri');
const teintes = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.reg-pastille')].map(p => [p.textContent, p.classList[1]])));
eq([teintes['Entrée'], teintes['Vente'], teintes['Mort']], ['vert', 'bleu', 'rouge'], 'Mouvements : pastilles Entrée verte, Vente bleue, Mort rouge');
console.log('OK 2 Mouvements : ' + cm.length + ' cartes = lignes de la page PC, pastilles colorées.');

// ================================================================ 3. Sanitaire : 20 cartes puis « Voir tout »
await ouvrir('sanitaire');
const tot = await page.evaluate(() => registreSanitaireFilteredRows('', registreColFiltres.sanitaire).length);
check(tot > 20, 'jeu : plus de 20 soins (' + tot + ')');
eq((await cartes()).length, 20, 'Sanitaire : 20 cartes avant « Voir tout »');
eq(await page.evaluate(() => document.getElementById('btn-registre-voir-tout').textContent), 'Voir tout (' + tot + ')', 'Sanitaire : bouton « Voir tout »');
await page.click('#btn-registre-voir-tout');
eq((await cartes()).length, tot, 'Sanitaire : « Voir tout » affiche toutes les lignes');
check(await page.evaluate(() => !document.getElementById('btn-registre-voir-tout')), 'Sanitaire : le bouton disparaît');
const csn = await cartes();
const lignesSan = await page.evaluate(() => registreSanitaireFilteredRows('', registreColFiltres.sanitaire).map(r => ['n°' + numeroVisuel(r.eid), r.categorie, formatDateFr(r.date)]));
eq(csn.map(c => [c.num, c.cat, c.date]), lignesSan, 'Sanitaire : mêmes lignes et même tri que la page PC');
check(csn.some(c => /Bravoxin 10 · 2 cc · ordonnance ORD-1/.test(c.l2)) && csn.some(c => /Antibiotique · Intramicine · 8 cc/.test(c.l2)), 'Sanitaire : produit, dose, ordonnance et sous-type sur leur ligne');
console.log('OK 3 Sanitaire : 20 cartes puis « Voir tout » (' + tot + ' lignes), produit / dose / ordonnance présents.');

// ================================================================ 4. recherche (frappe réelle) et filtres
await ouvrir('mouvements');
await page.click('#registre-filtre'); await page.keyboard.type('00061', { delay: 20 });
check(await page.evaluate(() => document.activeElement.id === 'registre-filtre'), 'recherche : le champ garde le focus');
const rech = await cartes();
check(rech.length > 0 && rech.every(c => c.num === 'n°00061'), 'recherche « 00061 » : seulement ce numéro (' + rech.length + ')');
await page.fill('#registre-filtre', '99999'); await page.dispatchEvent('#registre-filtre', 'input');
eq(await page.evaluate(() => document.querySelector('#registre-body .empty').textContent), 'Aucun mouvement ne correspond aux filtres.', 'recherche sans résultat : message conservé');
await page.fill('#registre-filtre', ''); await page.dispatchEvent('#registre-filtre', 'input');
await page.selectOption('#registre-filtres select[data-col="type"]', 'Vente');
check((await cartes()).length > 0 && (await cartes()).every(c => c.past === 'Vente'), 'filtre Type = Vente');
await page.selectOption('#registre-filtres select[data-col="categorie"]', 'Brebis');
check((await cartes()).every(c => c.past === 'Vente' && c.cat === 'Brebis'), 'filtres Type + Catégorie combinés');
eq(await page.evaluate(() => document.querySelector('.reg-liste-n').textContent), (await cartes()).length + ' mouvement' + ((await cartes()).length > 1 ? 's' : ''), 'compte filtré');
console.log('OK 4 recherche au clavier et filtres combinés.');

// ================================================================ 5. exports : inchangés, PDF = onglet affiché filtré
await page.evaluate(() => { window.__sorties = []; window.__pdf = []; window.__xlsx = []; });
await page.click('#btn-export-registre-pdf'); await page.waitForFunction(() => window.__sorties.length === 1);
const exp = await page.evaluate(() => ({ s: window.__sorties[0], p: window.__pdf[0] }));
check(/^registre_mouvements_/.test(exp.s.nom) && exp.s.mime === 'application/pdf' && exp.p.title === "Registre d'élevage — Mouvements", 'PDF : nom de fichier et titre inchangés : ' + exp.s.nom);
eq(exp.p.rows, (await cartes()).length, 'PDF : les lignes du PDF sont celles de la liste affichée (filtrée)');
await page.click('#btn-export-registre'); await page.waitForFunction(() => window.__sorties.length === 2);
const feuilles = await page.evaluate(() => window.__xlsx[0]);
check(feuilles.length === 3 && /^Agnelage:/.test(feuilles[0]) && /^Mouvements:/.test(feuilles[1]) && /^Sanitaire:/.test(feuilles[2]), 'Excel : 3 onglets comme avant : ' + feuilles.join(' | '));
check(await page.evaluate(() => window.__saves === 0 && JSON.stringify(DB) === window.__avant), 'aucune écriture de données');
console.log('OK 5 exports : PDF = onglet filtré, Excel = 3 onglets, inchangés ; lecture seule.');

// ================================================================ 6. Agnelage : cartes mère / agneau / sexe
await ouvrir('agnelage');
const ca = await cartes();
const lignesAgn = await page.evaluate(() => registreAgnelageFilteredRows('', registreColFiltres.agnelage).map(r => ['n°' + numeroVisuel(r.mereEid), r.sexe, formatDateFr(r.date), r.agneauEid ? 'Agneau n°' + numeroVisuel(r.agneauEid) : 'Mort-né']));
eq(ca.map(c => [c.num, c.past, c.date, c.l2]), lignesAgn, 'Agnelage : mêmes lignes que la page PC (mère, sexe, date, agneau ou Mort-né)');
check(ca.length > 0 && ca.every(c => c.cat === 'mère'), 'Agnelage : « mère » précisé');
await page.selectOption('#registre-filtres select[data-col="sexe"]', 'Mâle');
check((await cartes()).length > 0 && (await cartes()).every(c => c.past === 'Mâle'), 'Agnelage : filtre Sexe');
console.log('OK 6 Agnelage : cartes mère / agneau / sexe, filtre.');
await browser.close();
console.log('\nTOUS LES TESTS DU REGISTRE MOBILE SONT PASSÉS');
