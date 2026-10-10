/* Liste MOBILE des Agneaux (charte) : segmenté En attente / Vendus / Morts avec effectifs, une carte par agneau (n° et sexe, pastille de statut, « Né le … · mère n°… »),
   deux boutons pilule côte à côte Vendu (bleu) / Mort (rouge) ou « Annuler cette sortie » en contour, ligne « Vendu le … · acheteur » / « Mort le … · cause » pour les sorties,
   toucher la carte ouvre la fiche (lien vers la mère dans la fiche), plus de gros boutons empilés. Le scan et l'arrivée depuis « Agneaux adoptés » basculent sur le bon onglet avant
   de surligner. Mêmes écritures qu'avant (statutFinal + mouvement). PC inchangé. Jeu SYNTHÉTIQUE, saveData REMPLACÉ, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

function jeu() {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  window.EID = eid;
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.acheteurs = ['Natera', 'Bio Plus']; DB.causesMortalite = ['Pneumonie'];
  const A = fiche(eid(8, 8133), { id: 'A' });
  const nais = { type: 'Entrée', cause: 'Naissance', date: '2026-09-25' };
  A.agnelages = [{ date: '2026-09-25', campagne: 2026, lambs: [
    { eid: eid(6, 801), sexe: 'Mâle', sanitaire: [], mouvements: [nais] },
    { eid: eid(6, 802), sexe: 'Femelle', sanitaire: [], mouvements: [nais] },
    { eid: eid(6, 803), sexe: 'Mâle', sanitaire: [], statutFinal: 'vendu', mouvements: [nais, { type: 'Vendu', acheteur: 'Natera', date: '2026-10-01' }] },
    { eid: eid(6, 804), sexe: 'Femelle', sanitaire: [], statutFinal: 'mort', mouvements: [nais, { type: 'Mort', cause: 'Pneumonie', date: '2026-10-02' }] },
    { eid: eid(6, 805), sexe: 'Mâle', sanitaire: [], statutFinal: 'mort', mouvements: [nais, { type: 'Mort', cause: 'Mort', date: '2025-12-02' }] }] }];
  DB.brebis = [A, fiche(eid(9, 59), { id: 'B' })];
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} }; DB.mouvementsCollectifs = [];
  window.__avant = JSON.stringify(DB); window.__saves = 0;
}
async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1440, height: 1000 } : { width: 390, height: 900 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.confirms = [];
  page.on('dialog', d => { page.confirms.push(d.message()); d.accept(); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(jeu);
  return page;
}
const scan = async (page, v) => { await page.evaluate(v => { const el = document.querySelector('#scan-open-agneau'); el.value = v; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true })); }, v); await page.waitForTimeout(400); };
const onglets = page => page.evaluate(() => [...document.querySelectorAll('.ag-onglets .tab-btn')].map(b => b.textContent + (b.classList.contains('active') ? '*' : '')));
const nums = page => page.evaluate(() => [...document.querySelectorAll('.ag-carte .al-num')].map(x => x.textContent));
const m = await ouvrir(false);

// ================================================================ 1. segmenté, cartes, onglet « En attente »
await m.evaluate(() => { agneauxMobileTab = 'attente'; render('agneaux'); });
eq(await onglets(m), ['En attente (2)*', 'Vendus (1)', 'Morts (2)'], 'segmenté avec effectifs, « En attente » actif');
eq(await m.evaluate(() => pageTitle.textContent), 'Agneaux (5)', 'titre inchangé');
check(await m.evaluate(() => !!document.querySelector('.al-scan #scan-open-agneau') && !!document.getElementById('scan-open-agneau-err') && document.getElementById('scan-open-agneau').placeholder === "Scanner ou saisir l'EID"), 'champ de scan nu, ids et texte conservés');
eq(await nums(m), ['n°00801', 'n°00802'], 'agneaux en attente');
const c1 = await m.evaluate(() => {
  const cartes = [...document.querySelectorAll('.ag-carte')];
  const b = (c, s) => { const e = c.querySelector(s); const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), bg: getComputedStyle(e).backgroundColor, txt: e.textContent }; };
  return { sexes: cartes.map(c => c.querySelector('.ag-sexe').textContent), statut: cartes.map(c => c.querySelector('.reg-pastille').className + '|' + c.querySelector('.reg-pastille').textContent),
    nee: cartes.map(c => c.querySelector('.al-age').textContent), sortie: cartes.map(c => !!c.querySelector('.ag-sortie')), v: b(cartes[0], '.btn-agneau-vendu'), mo: b(cartes[0], '.btn-agneau-mort'),
    annuler: cartes.map(c => !!c.querySelector('.btn-agneau-annuler')),
    gros: document.querySelectorAll('.btn-voir-fiche-agneau, .btn-voir-mere-agneau, .btn-voir-mere-adoptive-agneau, .ag-carte .btn').length, debord: document.documentElement.scrollWidth > 390 };
});
eq(c1.sexes, ['♂', '♀'], 'sexe');
eq(c1.statut, ['reg-pastille ambre|En attente', 'reg-pastille ambre|En attente'], 'pastille de statut');
eq(c1.nee, ['Né le 25/09 · mère n°08133', 'Né le 25/09 · mère n°08133'], 'Né le … · mère n°…');
eq(c1.sortie.concat(c1.annuler), [false, false, false, false], 'pas de ligne de sortie ni d\'annulation en attente');
check(c1.v.txt === 'Vendu' && c1.mo.txt === 'Mort' && Math.abs(c1.v.y - c1.mo.y) <= 1 && c1.v.x < c1.mo.x && c1.v.bg === 'rgb(31, 90, 138)' && c1.mo.bg === 'rgb(163, 58, 49)', 'deux pilules côte à côte : Vendu bleu, Mort rouge : ' + JSON.stringify([c1.v, c1.mo]));
eq(c1.gros, 0, 'plus de gros boutons empilés (Voir la fiche, Voir la fiche de la mère, mère adoptive)');
check(!c1.debord, 'aucun débordement horizontal à 390 px');
console.log('OK 1 segmenté, cartes, pilules Vendu / Mort.');

// ================================================================ 2. onglets Vendus / Morts : ligne de sortie, Annuler
await m.click('.ag-onglets [data-tab="vendus"]');
eq(await onglets(m), ['En attente (2)', 'Vendus (1)*', 'Morts (2)'], 'onglet Vendus actif');
const vd = await m.evaluate(() => ({ nums: [...document.querySelectorAll('.ag-carte .al-num')].map(x => x.textContent), ligne: document.querySelector('.ag-sortie').textContent, p: document.querySelector('.reg-pastille').className + '|' + document.querySelector('.reg-pastille').textContent,
  btns: [...document.querySelectorAll('.ag-carte button')].map(b => b.textContent), contour: getComputedStyle(document.querySelector('.btn-agneau-annuler')).backgroundColor }));
eq(vd.nums, ['n°00803'], 'agneau vendu'); eq(vd.ligne, 'Vendu le 01/10 · Natera', 'ligne « Vendu le … · acheteur »'); eq(vd.p, 'reg-pastille bleu|Vendu', 'pastille Vendu bleue');
eq(vd.btns, ['Annuler cette sortie'], 'seul « Annuler cette sortie »'); eq(vd.contour, 'rgb(255, 255, 255)', 'bouton en contour (fond blanc)');
await m.click('.ag-onglets [data-tab="morts"]');
const mo = await m.evaluate(() => ({ nums: [...document.querySelectorAll('.ag-carte .al-num')].map(x => x.textContent), lignes: [...document.querySelectorAll('.ag-sortie')].map(x => x.textContent), p: document.querySelector('.reg-pastille').className }));
eq(mo.nums, ['n°00804', 'n°00805'], 'agneaux morts'); eq(mo.lignes, ['Mort le 02/10 · Pneumonie', 'Mort le 02/12/2025'], 'ligne « Mort le … · cause » (cause générique « Mort » non répétée, année ajoutée si autre année)');
check(mo.p === 'reg-pastille rouge', 'pastille Mort rouge');
console.log('OK 2 Vendus / Morts : ligne de sortie, Annuler cette sortie.');

// ================================================================ 3. Vendu / Mort / Annuler : mêmes écritures qu'avant, comptes à jour
await m.click('.ag-onglets [data-tab="attente"]');
await m.click('.ag-carte >> nth=0 >> .btn-agneau-vendu');
check(await m.evaluate(() => currentView === 'agneaux' && !!document.getElementById('lambsortie-confirm')), 'Vendu : la fenêtre de vente s\'ouvre, la fiche ne s\'ouvre pas');
await m.click('#lambsortie-acheteur-list .chip >> text=Natera'); await m.click('#lambsortie-confirm');
eq(await onglets(m), ['En attente (1)*', 'Vendus (2)', 'Morts (2)'], 'après la vente : effectifs à jour');
const e1 = await m.evaluate(() => { const l = DB.brebis[0].agnelages[0].lambs[0]; return { f: l.statutFinal, mv: l.mouvements[l.mouvements.length - 1].type + '|' + l.mouvements[l.mouvements.length - 1].acheteur, saves: window.__saves }; });
eq(e1, { f: 'vendu', mv: 'Vendu|Natera', saves: 1 }, 'écriture : statutFinal + mouvement Vendu + acheteur, un enregistrement');
await m.click('.ag-carte >> nth=0 >> .btn-agneau-mort'); await m.click('#lambsortie-confirm');
eq(await onglets(m), ['En attente (0)*', 'Vendus (2)', 'Morts (3)'], 'après la mort : effectifs à jour');
check(await m.evaluate(() => /Aucun agneau en attente/.test(document.querySelector('.ag-liste').textContent)), 'onglet vide : message');
await m.click('.ag-onglets [data-tab="morts"]');
await m.click('.ag-carte >> nth=0 >> .btn-agneau-annuler');
check(m.confirms.some(c => /Annuler cette mort/.test(c)), 'confirmation d\'annulation');
eq(await onglets(m), ['En attente (1)', 'Vendus (2)', 'Morts (2)*'], 'après l\'annulation : l\'agneau repasse en attente');
const e2 = await m.evaluate(() => { const l = DB.brebis[0].agnelages[0].lambs[1]; return { f: l.statutFinal || null, mv: l.mouvements.map(x => x.type) }; });
eq(e2, { f: null, mv: ['Entrée'] }, 'annulation : statut et mouvement de sortie retirés');
console.log('OK 3 Vendu / Mort / Annuler : écritures et effectifs.');

// ================================================================ 4. carte -> fiche ; lien vers la mère dans la fiche
await m.evaluate(jeu); await m.evaluate(() => { agneauxMobileTab = 'attente'; render('agneaux'); });
await m.click('.ag-carte >> nth=0 >> .al-num');
check(await m.evaluate(() => currentView === 'agneau-detail' && currentAgneauEid === EID(6, 801)), 'toucher la carte ouvre la fiche de l\'agneau');
await m.click('.fiche-tab-btn >> text=Généalogie');
check(await m.evaluate(() => !!document.getElementById('btn-voir-mere-agneau-fiche')), 'le lien vers la mère est dans la fiche (onglet Généalogie)');
console.log('OK 4 carte -> fiche (lien vers la mère dans la fiche).');

// ================================================================ 5. scan et arrivée depuis « Agneaux adoptés » : bon onglet avant le surlignage
await m.evaluate(() => { agneauxMobileTab = 'attente'; render('agneaux'); });
await scan(m, await m.evaluate(() => EID(6, 803)));
check(await m.evaluate(() => agneauxMobileTab === 'vendus' && document.querySelector('.ag-onglets .tab-btn.active').dataset.tab === 'vendus' && !!document.querySelector('.ag-carte.scan-highlight')), 'scan d\'un agneau vendu : bascule sur Vendus puis surligne la carte');
await scan(m, await m.evaluate(() => EID(6, 801)));
check(await m.evaluate(() => agneauxMobileTab === 'attente' && !!document.querySelector('.ag-carte.scan-highlight .al-num')), 'scan d\'un agneau en attente : retour sur En attente, carte surlignée');
await scan(m, '250016299900000');
check(await m.evaluate(() => /Aucun agneau trouvé/.test(document.getElementById('scan-open-agneau-err').textContent)), 'EID inconnu : message');
await m.evaluate(() => { pendingHighlightLambEid = EID(6, 804); render('agneaux'); });
await m.waitForTimeout(200);
check(await m.evaluate(() => agneauxMobileTab === 'morts' && pendingHighlightLambEid === null && document.querySelector('.ag-carte.scan-highlight .al-num').textContent === 'n°00804'), 'arrivée depuis « Agneaux adoptés » : bascule sur Morts puis surligne');
console.log('OK 5 scan et pendingHighlightLambEid : bon onglet puis surlignage.');

// ================================================================ 6. rien n'est écrit en consultant
await m.evaluate(jeu); await m.evaluate(() => { render('agneaux'); });
await m.click('.ag-onglets [data-tab="vendus"]'); await m.click('.ag-carte >> nth=0 >> .al-num');
check(await m.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'consulter (onglets, carte, fiche) n\'écrit rien');
console.log('OK 6 aucune écriture en consultation.');

// ================================================================ 7. PC inchangé
const pc = await ouvrir(true);
await pc.evaluate(() => render('agneaux'));
const p = await pc.evaluate(() => ({ onglets: document.querySelectorAll('.ag-onglets').length, cartes: document.querySelectorAll('.ag-carte').length, voir: document.querySelectorAll('.btn-voir-fiche-agneau').length, mere: document.querySelectorAll('.btn-voir-mere-agneau').length, label: /Scanner un agneau pour le retrouver/.test(document.getElementById('app').textContent) }));
eq(p, { onglets: 0, cartes: 0, voir: 5, mere: 5, label: true }, 'PC : liste Agneaux d\'avant (cartes complètes, boutons Voir la fiche)');
console.log('OK 7 PC inchangé.');
await browser.close();
console.log('\nTOUS LES TESTS DE LA LISTE AGNEAUX MOBILE SONT PASSÉS.');
