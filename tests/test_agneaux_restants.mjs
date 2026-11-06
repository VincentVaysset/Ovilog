/* Accueil (mobile et PC) : agneaux de la CAMPAGNE en cours, deux lignes « Nés » et « Restants » (agneauxCampagneRestants, une seule règle) :
   restants = nés vivants ni morts (avant ou après bouclage), ni vendus, ni sortis en inventaire, ni gardés au tri ; bouclés ou pas (« dont N sans n° ») ;
   une mise bas d'une campagne précédente ne compte pas ; tuile PC « Agneaux actifs » = mêmes restants. Lecture seule. Jeu synthétique (indicatif 000456). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const jeu = () => {
  DB = migrateData({}); saveData = () => true; DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  const fiche = (n, id) => ({ id, eid: '250000045' + n, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
  const l = (sexe, o) => Object.assign({ sexe, adopte: false }, o || {});
  DB.brebis = [fiche('669001', 'b1'), fiche('669002', 'b2'), fiche('669003', 'b3')]; DB.beliers = []; DB.agnelles = []; DB.lots = [];
  DB.brebis[0].agnelages = [{ date: '2026-11-02', campagne: 2026, lambs: [l('Mâle', { eid: '250000045671001' }), l('Femelle'), l('Mort-né')] }];
  DB.brebis[1].agnelages = [{ date: '2026-11-03', campagne: 2026, lambs: [l('Mâle', { eid: '250000045671002', statutFinal: 'vendu' }), l('Mâle', { statutFinal: 'mort' }), l('Femelle', { eid: '250000045671003', triStatut: 'gardée' })] },];
  DB.brebis[2].agnelages = [{ date: '2025-11-03', campagne: 2025, lambs: [l('Mâle', { eid: '250000045561004' })] },
    { date: '2026-11-04', campagne: 2026, lambs: [l('Femelle', { eid: '250000045671005', statutFinal: 'inventaire' }), l('Mâle', { eid: '250000045671006', statutFinal: 'mort' })] }];
  window.__avant = JSON.stringify(DB);
};
for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  const p = await (await browser.newContext(bureau ? { viewport: { width: 1440, height: 1000 } } : { viewport: { width: 390, height: 900 } })).newPage();
  await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
  if (bureau) await p.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(jeu);
  eq(await p.evaluate(() => agneauxCampagneRestants()), { males: 1, femelles: 1, total: 2, sansNumero: 1, morts: 2, vendus: 1, inventaire: 1, gardees: 1 }, nom + ' : restants, morts (avant et après bouclage), vendus, inventaire, gardées ; campagne précédente exclue');
  await p.evaluate(() => render('home'));
  const t = await p.evaluate((pc) => pc ? [document.getElementById('apc-agneaux-nes').textContent, document.getElementById('apc-agneaux-sortis').textContent, document.getElementById('apc-agneaux-restants').textContent, document.getElementById('compteur-agneaux-actifs').textContent.replace(/\s+/g, ' ').trim()]
    : [document.getElementById('ac-agneaux-nes').textContent, document.getElementById('ac-agneaux-sortis').textContent, document.getElementById('ac-agneaux-restants').textContent], bureau);
  eq(t.slice(0, 3), ['Nés : 1 mort-né · 4 mâles / 3 femelles', 'Sortis : 2 morts · 1 vendu · 1 en inventaire · 1 gardée au tri', 'Restants : 1 mâle / 1 femelle · dont 1 sans n°'], nom + ' : lignes Nés, Sortis, Restants (4 + 3 = 7 nés vivants = 5 sortis + 2 restants)');
  if (bureau) check(/Agneaux actifs\s*2\s*1 mâle · 1 femelle · dont 1 sans n°/.test(t[3]), 'PC : tuile « Agneaux actifs » = restants de la campagne : ' + t[3]);
  check(await p.evaluate(() => JSON.stringify(DB) === window.__avant), nom + ' : lecture seule');
  await p.evaluate(() => { DB.brebis.forEach(b => (b.agnelages || []).forEach(ag => ag.lambs.forEach(l => { delete l.statutFinal; delete l.triStatut; }))); render('home'); });
  check(await p.evaluate((pc) => !document.getElementById((pc ? 'apc' : 'ac') + '-agneaux-sortis') && /Restants : 4 mâles \/ 3 femelles/.test(document.getElementById((pc ? 'apc' : 'ac') + '-agneaux-restants').textContent), bureau), nom + ' : aucune sortie, pas de ligne « Sortis »');
  console.log('OK ' + nom);
  await p.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS « AGNEAUX RESTANTS DE LA CAMPAGNE » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
