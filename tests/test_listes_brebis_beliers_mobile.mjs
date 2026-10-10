/* Listes MOBILES Brebis et Béliers (charte) : un champ de scan nu avec icône (texte visible, mêmes ids qu'avant ; Brebis : « Scanner ou saisir un n° », voir test_recherche_brebis), la ligne d'info, UNE carte blanche
   en lignes compactes (n° vert foncé gras + étiquette SIEOL, âge dessous, pastilles à droite, chevron), du plus âgé au plus jeune, ni filtres ni tuiles ; Béliers : « Actif » vert, autres statuts
   gris et atténués ; dates courtes avec l'année quand ce n'est pas l'année en cours. Toucher une ligne ou scanner un EID ouvre la fiche. Le PC garde son tableau (en-tête vert charte).
   Jeu SYNTHÉTIQUE, aucune écriture, aucune donnée réelle. */
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
  const A = fiche(eid(8, 8133), { id: 'A' });
  A.agnelages = [{ date: '2026-09-25', campagne: 2026, lambs: [{ eid: eid(6, 801), sexe: 'Mâle', sanitaire: [], mouvements: [] }, { eid: eid(6, 802), sexe: 'Femelle', sanitaire: [], mouvements: [] }] }];
  DB.brebis = [A, fiche(eid(9, 59), { id: 'B' }), fiche(eid(9, 152), { id: 'D', numeroCourtTravailSieol: '152' }), fiche(eid(0, 33), { id: 'E' }),
    fiche(eid(9, 99), { id: 'M', statut: 'vendue', mouvements: [{ type: 'Entrée', date: '2024-01-01' }, { type: 'Vente', acheteur: 'Natera', date: '2026-09-01' }] })];
  DB.beliers = [fiche(eid(9, 90), { id: 'bel1', statut: 'actif' }), fiche(eid(8, 91), { id: 'bel2', statut: 'actif', numeroTravailSieol: '91' }),
    fiche(eid(9, 92), { id: 'bel3', statut: 'vendu', mouvements: [{ type: 'Entrée', date: '2024-01-01' }, { type: 'Vente reproduction', acheteur: 'Bio Plus', date: '2026-10-02' }] })];
  DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} }; DB.mouvementsCollectifs = [];
  window.__avant = JSON.stringify(DB); window.__saves = 0;
}
async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1440, height: 1000 } : { width: 390, height: 900 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(jeu);
  return page;
}
const intact = page => page.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0);
const scan = async (page, sel, v) => { await page.evaluate(({ sel, v }) => { const el = document.querySelector(sel); el.value = v; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true })); }, { sel, v }); await page.waitForTimeout(350); };
const mob = await ouvrir(false);

// ================================================================ 1. Brebis mobile
await mob.evaluate(() => render('list'));
const br = await mob.evaluate(() => ({
  titre: document.getElementById('page-title') ? document.getElementById('page-title').textContent : pageTitle.textContent,
  champ: !!document.querySelector('.al-scan #scan-open'), icone: !!document.querySelector('.al-scan .al-scan-ic'), placeholder: document.getElementById('scan-open').placeholder,
  ancienLabel: /Scanner une brebis pour ouvrir/.test(document.getElementById('app').textContent), erreur: !!document.getElementById('scan-open-err'),
  info: (document.querySelector('.reg-info.al-info') || {}).textContent, cartes: document.querySelectorAll('.al-carte').length, lignes: document.querySelectorAll('.al-carte .al-ligne').length,
  ancien: document.querySelectorAll('.sheep-item').length, filtres: document.querySelectorAll('#app select, .reg-tuile, .bc-filtres').length, fab: !!document.getElementById('fab-add') && !document.getElementById('fab-add').classList.contains('hidden'),
  chev: document.querySelectorAll('.al-ligne .bc-chev').length, debord: document.documentElement.scrollWidth > 390,
  ordre: [...document.querySelectorAll('.al-ligne .al-num')].map(x => x.firstChild.textContent.trim()),
  attendu: sortByAge(DB.brebis.filter(s => (s.statut || 'active') === 'active')).map(s => s.numeroCourtTravailSieol || 'n°' + numeroVisuel(s.eid)),
  ages: [...document.querySelectorAll('.al-ligne .al-age')].map(x => x.textContent),
  pastilles: [...document.querySelectorAll('.al-ligne')].map(l => [...l.querySelectorAll('.reg-pastille')].map(p => p.className.replace('reg-pastille ', '') + ':' + p.textContent)),
  sieol: [...document.querySelectorAll('.al-ligne')].map(l => !!l.querySelector('.compact-tag')),
  numCouleur: getComputedStyle(document.querySelector('.al-num')).color, numPoids: getComputedStyle(document.querySelector('.al-num')).fontWeight
}));
check(br.champ && br.icone && br.erreur, 'champ de scan nu avec icône, ids conservés (#scan-open, #scan-open-err) : ' + JSON.stringify(br));
eq(br.placeholder, 'Scanner ou saisir un n°', 'texte du champ visible');
check(!br.ancienLabel, 'plus de libellé au-dessus du champ');
eq(br.info, 'Tape un n° pour filtrer, du plus âgé au plus jeune. Touche une brebis pour ouvrir sa fiche.', 'ligne d\'info');
check(br.cartes === 1 && br.lignes === 4 && br.ancien === 0, 'une seule carte, 4 lignes (brebis actives), plus de cartes par animal : ' + JSON.stringify([br.cartes, br.lignes, br.ancien]));
check(br.filtres === 0, 'ni filtres ni tuiles');
check(br.fab, 'bouton « + » conservé');
eq(br.chev, 4, 'un chevron par ligne');
check(!br.debord, 'aucun débordement horizontal à 390 px');
eq(br.ordre, br.attendu, 'du plus âgé au plus jeune (même tri qu\'avant)');
check(br.ages.every(a => /^\d+ an\(s\)$/.test(a)), 'âge sous le numéro : ' + JSON.stringify(br.ages));
check(br.numCouleur === 'rgb(47, 110, 68)' && Number(br.numPoids) >= 700, 'n° en vert foncé gras : ' + br.numCouleur + ' ' + br.numPoids);
check(br.sieol.filter(Boolean).length === 1, 'étiquette SIEOL sur la seule brebis renseignée');
const ligneA = br.pastilles[br.ordre.indexOf('n°08133')];
eq(ligneA, ['ambre:25/09 · 2 agn.'], 'mise bas de la campagne : pastille ambre, date courte « 25/09 · 2 agn. »');
check(br.pastilles.filter((p, i) => br.ordre[i] !== 'n°08133').every(p => p[0] === 'gris:Aucun agnelage'), 'sans mise bas : pastille grise « Aucun agnelage »');
eq(await mob.evaluate(() => [dateCourteMobile('2026-09-25'), dateCourteMobile('2025-11-10'), dateCourteMobile('')]), ['25/09', '10/11/2025', ''], 'dates courtes : année ajoutée si ce n\'est pas l\'année en cours');
console.log('OK 1 liste Brebis mobile : champ nu, info, une carte, lignes compactes, tri, pastilles, SIEOL, dates courtes.');

// ================================================================ 2. ouverture de la fiche (ligne et scan)
await mob.click('.al-ligne >> nth=0');
let v = await mob.evaluate(() => ({ vue: currentView, id: DB.brebis.find(s => s.id === window.__ouvert) ? 1 : 0 }));
eq(v.vue, 'detail', 'toucher une ligne ouvre la fiche');
await mob.evaluate(() => render('list'));
await scan(mob, '#scan-open', await mob.evaluate(() => EID(9, 59)));
eq(await mob.evaluate(() => currentView), 'detail', 'scan d\'un EID ouvre la fiche');
await mob.evaluate(() => render('list'));
await scan(mob, '#scan-open', '250016299900000');
check(await mob.evaluate(() => /Aucune brebis trouvée/.test(document.getElementById('scan-open-err').textContent) && currentView === 'list'), 'EID inconnu : message, on reste sur la liste');
console.log('OK 2 fiche : ligne et scan.');

// ================================================================ 3. Béliers mobile
await mob.evaluate(() => render('beliers'));
const be = await mob.evaluate(() => ({
  champ: !!document.querySelector('.al-scan #scan-open-belier'), erreur: !!document.getElementById('scan-open-belier-err'),
  info: (document.querySelector('.reg-info.al-info') || {}).textContent, cartes: document.querySelectorAll('.al-carte').length, lignes: document.querySelectorAll('.al-ligne').length, ancien: document.querySelectorAll('.sheep-item').length,
  ajout: (document.getElementById('btn-add-belier') || {}).textContent, pastilles: [...document.querySelectorAll('.al-ligne')].map(l => [l.querySelector('.reg-pastille').className.replace('reg-pastille ', ''), l.querySelector('.reg-pastille').textContent, getComputedStyle(l).opacity]),
  sieol: [...document.querySelectorAll('.al-ligne')].map(l => !!l.querySelector('.compact-tag')), filtres: document.querySelectorAll('#app select, .reg-tuile').length
}));
check(be.champ && be.erreur && be.cartes === 1 && be.lignes === 3 && be.ancien === 0 && be.filtres === 0, 'Béliers : champ nu, une carte, 3 lignes : ' + JSON.stringify(be));
eq(be.info, 'Du plus âgé au plus jeune. Touche un bélier pour ouvrir sa fiche.', 'info Béliers');
eq(be.ajout, '+ Ajouter un bélier', 'bouton conservé');
eq(be.pastilles.map(p => p.slice(0, 2)), [['vert', 'Actif'], ['vert', 'Actif'], ['gris', 'vendu']], 'Actif en vert, autre statut en gris');
check(be.pastilles[2][2] === '0.6' && be.pastilles[0][2] === '1', 'statut autre que actif atténué comme avant');
check(be.sieol.filter(Boolean).length === 1, 'étiquette SIEOL du bélier renseigné');
await mob.click('.al-ligne >> nth=0');
eq(await mob.evaluate(() => currentView), 'belier-detail', 'toucher une ligne ouvre la fiche du bélier');
await mob.evaluate(() => render('beliers'));
await scan(mob, '#scan-open-belier', await mob.evaluate(() => EID(9, 90)));
eq(await mob.evaluate(() => [currentView, currentBelierId]), ['belier-detail', 'bel1'], 'scan d\'un EID ouvre la fiche du bélier');
console.log('OK 3 liste Béliers mobile.');
check(await intact(mob), 'aucune écriture : DB identique, aucun saveData');
console.log('OK 4 aucune écriture.');

// ================================================================ 5. PC : tableau conservé, en-tête vert charte
const pc = await ouvrir(true);
await pc.evaluate(() => render('list'));
const p1 = await pc.evaluate(() => ({ tete: getComputedStyle(document.querySelector('.list-table-head')).backgroundColor, texte: getComputedStyle(document.querySelector('.list-table-head')).color, lignes: document.querySelectorAll('.list-table-row').length, mobile: document.querySelectorAll('.al-carte, .al-scan').length, label: /Scanner une brebis ou taper un n°/.test(document.getElementById('app').textContent) }));
eq(p1, { tete: 'rgb(53, 127, 75)', texte: 'rgb(255, 255, 255)', lignes: 4, mobile: 0, label: true }, 'PC Brebis : tableau, en-tête vert charte, carte de scan inchangée');
await pc.evaluate(() => render('beliers'));
const p2 = await pc.evaluate(() => ({ tete: getComputedStyle(document.querySelector('.list-table-head')).backgroundColor, lignes: document.querySelectorAll('.list-table-row').length, mobile: document.querySelectorAll('.al-carte, .al-scan').length }));
eq(p2, { tete: 'rgb(53, 127, 75)', lignes: 3, mobile: 0 }, 'PC Béliers : tableau, en-tête vert charte');
await pc.click('.list-table-row >> nth=0');
eq(await pc.evaluate(() => currentView), 'belier-detail', 'PC : toucher une ligne ouvre la fiche');
console.log('OK 5 PC inchangé hors en-têtes verts.');
await browser.close();
console.log('\nTOUS LES TESTS DES LISTES BREBIS / BÉLIERS MOBILE SONT PASSÉS.');
