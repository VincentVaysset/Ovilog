/* Chantier de tri, partie a : ORIGINE DE NAISSANCE d'une agnelle = mode de reproduction renseigné sur la mise bas de sa mère (IA, RE, EP, MN).
   Lue à l'affichage, jamais stockée ; mère inconnue ou vendue, mise bas sans code, achetée : « — ». La pastille ne porte que le code de 2 lettres
   (libellé complet en accessibilité seulement : aucun title, aucune légende). Rang de lactation seulement si le cahier SIEOL est importé. Jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

await page.evaluate(() => {
  DB = migrateData({}); saveData = function () { window.__saves = (window.__saves || 0) + 1; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  window.E = (d, n) => '2500162991' + d + String(n).padStart(4, '0');
  const f = (d, n, extra) => Object.assign({ id: 'b' + d + n, eid: E(d, n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, extra || {});
  const agn = (code, n, extra) => { const o = { campagne: 2025, date: '2026-01-1' + n, lambs: [{ eid: E(6, n), sexe: 'Femelle', sanitaire: [], mouvements: [] }] }; if (code) o.codeRepro = code; return Object.assign(o, extra || {}); };
  DB.brebis = [
    f(1, 1, { agnelages: [agn('IA', 1)] }), f(1, 2, { agnelages: [agn('RE', 2)] }), f(1, 3, { agnelages: [agn('EP', 3)] }), f(1, 4, { agnelages: [agn('MN', 4)] }),
    f(1, 5, { agnelages: [agn(null, 5)] }),                                  // mise bas sans code
    f(1, 6, { statut: 'vendue', agnelages: [agn('IA', 6)] }),                // mère vendue
    f(1, 7, { agnelages: [agn('XX', 7)] })                                   // code hors des 4 modes
  ];
  DB.agnelles = [{ id: 'ach', eid: E(5, 42), origine: 'achetée', dateEntree: '2026-09-10', mouvements: [{ type: 'Entrée', date: '2026-09-10' }], sanitaire: [] }];
  DB.cahierControleLaitier = [{ eid: E(1, 1), campagne: 2025, numLactation: '3', lactMoyen: 2.7, classeParQuart: '1' }];
  DB.lactationModele = [{ eid: E(1, 1), campagne: 2025, lactationTotale: 452, classeParQuart: '1' }, { eid: E(1, 2), campagne: 2025, lactationTotale: 300, classeParQuart: '2' }];
  window.__avant = JSON.stringify(DB);
});

const res = await page.evaluate(() => { const d = triAgnellesDonnees(); const m = x => [x.numero, x.origineNaissance, x.rangLactation]; return { aTrier: d.aTrier.map(m), gardees: d.gardees.map(m) }; });
const parNum = Object.fromEntries(res.aTrier.map(x => [x[0], x[1]]));
check(parNum['60001'] === 'IA' && parNum['60002'] === 'RE' && parNum['60003'] === 'EP' && parNum['60004'] === 'MN', 'les 4 modes : ' + JSON.stringify(parNum));
check(parNum['60005'] === null, 'mise bas sans code : « — » (null)');
check(parNum['60006'] === null, 'mère vendue : « — » (null)');
check(parNum['60007'] === null, 'code hors IA/RE/EP/MN : « — » (null)');
check(res.gardees.length === 1 && res.gardees[0][1] === null, 'achetée (sans mère) : « — » (null)');
check(await page.evaluate(() => origineNaissanceAgnelle(null, null, null) === null && origineNaissanceAgnelle(E(9, 99), null, '2026-01-11') === null), 'mère absente de la base ou non donnée : null');
check(await page.evaluate(() => origineNaissanceAgnelle(E(1, 1), null, '2026-01-11') === 'IA'), 'repli par la date de naissance quand l\'agneau n\'est pas donné');
// rang de lactation : seulement si le cahier SIEOL est importé
const rangs = Object.fromEntries(res.aTrier.map(x => [x[0], x[2]]));
check(rangs['60001'] === '3' && rangs['60002'] === null, 'rang de lactation : 3 (cahier importé pour la mère 80001), null sinon : ' + JSON.stringify(rangs));
// pastille : code de 2 lettres seul, libellé en accessibilité, ni title, ni pictogramme, ni légende
const html = await page.evaluate(() => ['IA', 'RE', 'EP', 'MN', null].map(c => origineNaissancePastilleHtml(c)));
const labels = html.map(h => (/aria-label="([^"]*)"/.exec(h) || [])[1]);
check(JSON.stringify(labels) === JSON.stringify(['Insémination artificielle', 'Retour IA', 'Éponge', 'Monte naturelle', 'Origine non renseignée']), 'libellés complets en accessibilité : ' + JSON.stringify(labels));
check(html.every(h => !/title=/.test(h) && !/<svg|<img/.test(h)), 'aucune infobulle (title), aucun pictogramme');
const texte = await page.evaluate(h => h.map(x => { const d = document.createElement('div'); d.innerHTML = x; return d.textContent; }), html);
check(JSON.stringify(texte) === JSON.stringify(['IA', 'RE', 'EP', 'MN', '—']), 'le texte visible est le code seul (ou « — ») : ' + JSON.stringify(texte));
// rien n'est écrit ni modifié
check(await page.evaluate(() => JSON.stringify(DB) === window.__avant && !window.__saves), 'l\'origine est calculée à l\'affichage : rien n\'est stocké ni écrit');
console.log('OK origine de naissance : IA / RE / EP / MN, « — » (sans code, mère vendue ou inconnue, achetée), pastille à code seul avec libellé en accessibilité, rang de lactation seulement avec cahier SIEOL.');
await browser.close();
