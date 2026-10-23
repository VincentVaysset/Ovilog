/* Libellés et titres (chantier « accueil mobile ») : (1) « Vide confirmée » devient « Vide » à l'affichage (listes Brebis, statut), « Vide définitive » inchangé ; (2) « Nombre exact » devient
   « Nombre (1, 2, 3 et +) » (bouton de saisie, menu de session), valeurs stockées inchangées ; (3) sur MOBILE, le grand titre répété par le bandeau vert disparaît (Carnet sanitaire, Produits et
   délais, Soins sans indicateur bio, Traitements sur 12 mois) et la phrase d'info reste ; le PC garde ses titres. Jeu SYNTHÉTIQUE, aucune écriture, aucune donnée réelle. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

// ---- 0. le code n'écrit plus les anciens libellés
const html = readFileSync(new URL('../www/index.html', import.meta.url), 'utf8');
check(!/Nombre exact/.test(html), 'plus aucun « Nombre exact » dans le code (écrans, filtres, exports, PDF)');
check(!/Vide confirmée/.test(html), 'plus aucun « Vide confirmée » dans le code (écrans, filtres, exports, PDF)');
console.log('OK 0 plus de « Nombre exact » ni de « Vide confirmée » dans le code.');

function jeu() {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  const eid = (an, n) => '250000012' + '9' + an + String(n).padStart(5, '0');
  window.EID = eid;
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.brebis = [
    fiche(eid(8, 1), { id: 'V', echographies: [{ date: '2026-10-02', type: 'constat', stade: 'Vide', campagne: 2026 }] }),
    fiche(eid(9, 2), { id: 'D', videesDefinitives: [{ campagne: 2026, date: '2026-10-02' }] }),
    fiche(eid(7, 3), { id: 'G', echographies: [{ date: '2026-10-02', type: 'constat', stade: 'Pleine', campagne: 2026 }] })];
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} }; DB.mouvementsCollectifs = [];
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
const mob = await ouvrir(false), pc = await ouvrir(true);

// ---- 1. « Vide » (affichage), « Vide définitive » inchangé
eq(await mob.evaluate(() => ['V', 'D', 'G'].map(id => statutReproductionCampagne(DB.brebis.find(s => s.id === id)))), ['Vide', 'Vide définitive', 'Gestante (en cours)'], 'statuts de reproduction');
await mob.evaluate(() => render('list'));
const pastilles = await mob.evaluate(() => [...document.querySelectorAll('.al-ligne')].flatMap(l => [...l.querySelectorAll('.reg-pastille')].map(p => p.textContent)));
check(pastilles.includes('Vide') && !pastilles.some(p => /confirm/.test(p)), 'liste Brebis mobile : pastille « Vide » : ' + JSON.stringify(pastilles));
await pc.evaluate(() => render('list'));
const badges = await pc.evaluate(() => [...document.querySelectorAll('.list-table-row .badge')].map(p => p.textContent));
check(badges.includes('Vide') && !badges.some(p => /confirm/.test(p)), 'liste Brebis PC : badge « Vide » : ' + JSON.stringify(badges));
await mob.evaluate(() => { ficheBrebisTab = 'repro'; ficheBrebisTabSheepId = 'V'; currentSheepId = 'V'; detailOrigin = 'list'; render('detail', 'V'); });
check(await mob.evaluate(() => [...document.querySelectorAll('#app div')].some(e => e.children.length === 0 && e.textContent.trim() === 'Vide')), 'fiche (onglet Repro) : statut « Vide »');
console.log('OK 1 « Vide » à l\'affichage, « Vide définitive » inchangé.');

// ---- 2. « Nombre (1, 2, 3 et +) »
await mob.evaluate(() => { currentSheepId = 'G'; editContext = null; render('add-echo'); });
const bouton = await mob.evaluate(() => { const b = document.querySelector('.comptage-mode-opt[data-val="exact"]'); return { txt: b.textContent, val: b.dataset.val }; });
eq(bouton, { txt: 'Nombre (1, 2, 3 et +)', val: 'exact' }, 'bouton de comptage : libellé changé, valeur « exact » conservée');
await mob.evaluate(() => { resetEchoRapideSession(); render('echo-rapide'); });
const options = await mob.evaluate(() => [...document.querySelectorAll('#echo-comptage .tab-btn')].map(o => o.dataset.val + ' | ' + o.textContent));
eq(options.filter(o => /exact/.test(o)), ['exact | Nombre (1, 2, 3 et +)'], 'choix « Comptage des agneaux » de la session d\'échos');
console.log('OK 2 « Nombre (1, 2, 3 et +) », valeurs stockées inchangées.');

// ---- 3. titres répétés : supprimés sur mobile, gardés sur PC, phrase d'info conservée
const ecrans = [['sanitaire', 'Carnet sanitaire', /Le soin, puis les animaux/], ['produits-delais', 'Produits et délais', /Fiches produit/], ['soins-sans-bio', 'Soins sans indicateur bio', /Soins enregistrés avec la version 1\.0\.198/]];
for (const [vue, titre, info] of ecrans) {
  const lire = (page) => page.evaluate(([v, t]) => { render(v); return { bandeau: pageTitle.textContent, titres: [...document.querySelectorAll('#app .brd-title')].map(e => e.textContent), sub: (document.querySelector('#app .brd-sub') || {}).textContent || '' }; }, [vue, titre]);
  const m = await lire(mob), p = await lire(pc);
  eq([m.bandeau, m.titres], [titre, []], 'mobile « ' + titre + ' » : bandeau seul, plus de grand titre répété');
  check(info.test(m.sub), 'mobile « ' + titre + ' » : la phrase d\'info reste : ' + m.sub);
  eq(p.titres, [titre], 'PC « ' + titre + ' » : titre conservé');
}
const s12 = (page) => page.evaluate(() => { DB.elevageBio = false; render('traitements-12-mois'); return { bandeau: pageTitle.textContent, ttl: [...document.querySelectorAll('#app .brd-ttl')].map(e => e.textContent), note: document.querySelector('#app .brd-note').textContent.slice(0, 30) }; });
const m12 = await s12(mob), p12 = await s12(pc);
eq([m12.bandeau, m12.ttl], ['Traitements sur 12 mois', []], 'mobile « Traitements sur 12 mois » : plus de titre répété');
check(/Ce suivi est réservé/.test(m12.note), 'mobile : la phrase d\'info reste');
eq(p12.ttl, [], 'PC « Traitements sur 12 mois » : plus de titre de carte qui répète le bandeau');
console.log('OK 3 titres répétés supprimés sur mobile (4 écrans), PC inchangé.');
check(await mob.evaluate(() => window.__saves === 0), 'aucune écriture');
await browser.close();
console.log('\nTOUS LES TESTS DES LIBELLÉS ET TITRES MOBILE SONT PASSÉS.');
