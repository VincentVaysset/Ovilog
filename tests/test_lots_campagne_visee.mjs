/* Bilans et PDF des lots IA / éponge : calculés sur la campagne VISÉE par le lot (campagneMisesBasDuLot), jamais sur la campagne en cours.
   Un lot de la campagne passée garde son bilan après la bascule ; un lot « à venir » ne compte pas les mises bas de la campagne en cours.
   saveData REMPLACÉ ; jeu synthétique (indicatif 000456). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
await p.evaluate(() => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2027; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  const E = n => '2500000456' + (51000 + n);
  const mb = (date, campagne, code, n) => ({ date, campagne, codeRepro: code, lambs: Array.from({ length: n }, () => ({ sexe: 'Mâle', statutFinal: 'vendu' })) });
  // deux brebis : une mise bas IA en 2026 (campagne passée) et une mise bas MN en 2027 (campagne en cours)
  DB.brebis = [1, 2, 3, 4].map(n => ({ id: 'b' + n, eid: E(n), statut: 'active', createdAt: 1, echographies: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', date: '2020-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [],
    agnelages: [mb('2025-11-0' + n, 2026, n <= 2 ? 'IA' : 'EP', 2), mb('2026-11-0' + n, 2027, 'MN', 1)] }));   // 3 et 4 : lot éponge
  DB.lots = [
    { id: 'P', type: 'reproduction', mode: 'IA', cible: 'Brebis', nom: 'IA passée', dateCreation: '2025-06-01', dateEvenement: '2025-06-01', campagneMisesBas: 2026, membres: [E(1), E(2)] },
    { id: 'EP', type: 'reproduction', mode: 'EP', cible: 'Brebis', nom: 'Éponge passée', dateCreation: '2025-06-01', dateEvenement: '2025-06-01', campagneMisesBas: 2026, membres: [E(3), E(4)] },
    { id: 'F', type: 'reproduction', mode: 'IA', cible: 'Brebis', nom: 'IA à venir', dateCreation: '2027-06-01', dateEvenement: '2027-06-01', campagneMisesBas: 2028, membres: [E(1), E(2)] }];
});
const ia = id => p.evaluate(id => { const s = statsLotIA(DB.lots.find(l => l.id === id)); return [s.global.misesBas, s.global.prolificite]; }, id);
eq(await ia('P'), [2, 2], 'lot IA de la campagne passée : ses 2 mises bas (2 agneaux chacune), même après la bascule');
eq(await ia('F'), [0, null], 'lot IA à venir : aucune mise bas de la campagne en cours comptée');
eq(await p.evaluate(() => { const s = statsLotEponge(DB.lots.find(l => l.id === 'EP')); return [s.misesBas, s.prolificite]; }), [2, 2], 'lot éponge de la campagne passée : ses mises bas');
eq(await p.evaluate(() => [statsLotIAParAgeExact(DB.lots.find(l => l.id === 'P')).reduce((t, g) => t + (g.global ? g.global.misesBas : g.misesBas || 0), 0),
  statsLotEpongeParAgeExact(DB.lots.find(l => l.id === 'EP')).reduce((t, g) => t + (g.misesBas || 0), 0)]), [2, 2], 'détail par âge (écran et PDF) : même campagne');
console.log('OK : bilans des lots sur la campagne visée (passée, à venir), détail par âge compris.');
await browser.close();
console.log('test_lots_campagne_visee : OK');
