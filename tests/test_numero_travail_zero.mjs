/* N° de travail avec un zéro de tête : « 0117 » et « 117 » sont DEUX brebis différentes (millésimes différents). Le n° de travail (court,
   complet, bélier) est comparé EXACTEMENT, zéro compris, partout : n° tapé (resoudreNumeroTape), mère adoptive, Vérifier mères et agneaux,
   imports (retrouverAnimalImport : l'exact gagne ; sans zéros seulement si aucun n'est exact), n° retenu à l'import (« 0117 » n'est pas
   « pris » par la 117). Le n° d'ordre (5 chiffres de l'EID) ignore toujours ses zéros de tête. Jeu synthétique (indicatif 000045). */
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
  const f = (id, eid, court) => ({ id, eid, numeroCourtTravailSieol: court, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', date: '2015-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
  DB.brebis = [f('z', '250000004502117', '0117'), f('u', '250000004511017', '117'), f('s', '250000004553001', '')];
});
const tape = v => p.evaluate(v => { const r = resoudreNumeroTape(DB.brebis, v); return r.statut === 'trouve' ? r.item.id : r.statut; }, v);
eq([await tape('0117'), await tape('117'), await tape('02117'), await tape('2117'), await tape('11017')], ['z', 'u', 'z', 'z', 'u'], 'n° tapé : 0117 et 117 distincts ; n° d\'ordre sans zéros de tête');
eq(await p.evaluate(() => [trouverBrebisActivesParNumero('0117').map(b => b.id), trouverBrebisActivesParNumero('117').map(b => b.id)]), [['z'], ['u']], 'mère adoptive : la bonne brebis');
eq(await p.evaluate(() => [resoudreAnimalMereAgneau('0117', []).brebis.id, resoudreAnimalMereAgneau('117', []).brebis.id, resoudreAnimalMereAgneau('53', []).type]), ['z', 'u', 'ambigu'],
  'Vérifier mères et agneaux : n° exact ; un morceau de n° n\'est jamais pris d\'office');
eq(await p.evaluate(() => [retrouverAnimalImport('0117', DB.brebis), retrouverAnimalImport('117', DB.brebis)].map(r => r.type + ':' + (r.animal ? r.animal.id : ''))), ['direct:z', 'direct:u'], 'import : la correspondance exacte gagne');
eq(await p.evaluate(() => { const seule = DB.brebis.filter(b => b.id !== 'u'); const r = retrouverAnimalImport('117', seule); return r.type + ':' + (r.animal ? r.animal.id : ''); }), 'direct:z', 'import : sans correspondance exacte, le n° sans zéro retrouve la 0117 (comme avant)');
eq(await p.evaluate(() => [retenirNumeroImport(DB.brebis[2], '0117', DB.brebis, false), retenirNumeroImport(DB.brebis[2], '117', DB.brebis, false), retenirNumeroImport(DB.brebis[2], '0118', DB.brebis, false)]), ['pris', 'pris', 'retenu'],
  'n° retenu à l\'import : pris seulement s\'il est porté EXACTEMENT');
eq(await p.evaluate(() => DB.brebis.map(b => b.numeroCourtTravailSieol)), ['0117', '117', ''], 'aucun numéro modifié');
console.log('OK : 0117 ≠ 117 (n° tapé, mère adoptive, Vérifier mères et agneaux, imports, n° retenu) ; n° d\'ordre sans zéros.');
await browser.close();
console.log('test_numero_travail_zero : OK');
