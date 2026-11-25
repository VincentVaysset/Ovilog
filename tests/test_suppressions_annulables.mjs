/* Suppressions annulables (mobile) : un élément de fiche (mise bas, soin…) se supprime en UN geste, sans boîte native ; un animal entier
   (brebis, bélier, agnelle) passe par le message de la charte. Bandeau 6 s « … supprimé · Annuler » = base EXACTE d'avant (fiche, lots,
   traitements collectifs, notes archivées). Le n° d'un animal supprimé est retiré des lots (« retirée de 1 lot »). Une brebis ou une agnelle
   ou un bélier qui a des soins, une sortie ou des infos de repro ou de lait ne se supprime jamais (ligne grise, sortie par un mouvement) ; une mise bas
   dont un agneau est bouclé non plus (message de la charte). saveData REMPLACÉ ; jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
p.on('dialog', d => { throw new Error('boîte native inattendue : ' + d.message()); });
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
await p.evaluate(() => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2027; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  const f = (id, eid, opts) => Object.assign({ id, eid, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, opts);
  DB.brebis = [
    f('a', '250000004551001', { notes: [{ date: '2026-11-01', texte: 'Note A' }] }),   // créée par erreur : supprimable
    f('b', '250000004551002', { agnelages: [{ date: '2026-11-02', campagne: 2027, codeRepro: 'MN', lambs: [{ sexe: 'Mâle', eid: '250000004561001', sanitaire: [{ date: '2026-11-05', produit: 'Produit A' }] }, { sexe: 'Mort-né' }] }] }),
    f('c', '250000004551003', { controleLaitier: [{ controle: 1, quantite: 900, campagne: 2027 }] })];
  DB.beliers = [{ id: 'z', eid: '250000004531001', statut: 'actif', sanitaire: [], mouvements: [], notes: [] }];
  DB.agnelles = [{ id: 'g', eid: '250000004571001', origine: 'achetée', mouvements: [], sanitaire: [], notes: [] },
    { id: 'h', eid: '250000004571002', origine: 'achetée', mouvements: [], sanitaire: [], notes: [], modesRepro: [{ mode: 'IA', date: '2026-06-01' }] }];
  DB.lots = [{ id: 'L1', nom: 'Lot test', type: 'recherche', membres: ['250000004551001', '250000004551002'], dateCreation: '2026-11-01' }];
  window.__avant = JSON.stringify(DB);
});
const pareil = () => p.evaluate(() => JSON.stringify(DB) === window.__avant);
const snack = () => p.textContent('.sup-snack');

// 1. brebis sans repro ni lait : message de la charte, suppression, n° retiré du lot, Annuler = base exacte
await p.evaluate(() => { currentSheepId = 'a'; ficheBrebisTab = 'ident'; ficheBrebisTabSheepId = 'a'; render('detail', 'a'); });
await p.click('#btn-delete-sheep');
check(await p.isVisible('#sup-confirm'), 'brebis : message de la charte avant la suppression');
await p.click('#sup-ok');
eq(await p.evaluate(() => [DB.brebis.map(s => s.id), DB.lots[0].membres, (DB.notesArchiveesBrebis['250000004551001'] || []).length]), [['b', 'c'], ['250000004551002'], 1], 'brebis supprimée, retirée du lot, notes archivées');
check(/supprimée · retirée de 1 lot/.test(await snack()), 'bandeau : « … supprimée · retirée de 1 lot » : ' + await snack());
await p.click('#sup-snack-annuler');
eq(await pareil(), true, 'Annuler = base exacte d\'avant (fiche à sa place, lot, notes archivées)');

// 2. brebis avec repro, lait, soins ou sortie : jamais supprimable (le registre garde tout)
await p.evaluate(() => { DB.brebis.push({ id: 'd', eid: '250000004551004', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [{ date: '2026-11-05', produit: 'Produit A' }], notes: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
  DB.beliers.push({ id: 'y', eid: '250000004531002', statut: 'actif', sanitaire: [{ date: '2026-11-05', produit: 'Produit A' }], mouvements: [], notes: [] }); window.__avant = JSON.stringify(DB); currentSheepId = 'd'; ficheBrebisTab = 'ident'; ficheBrebisTabSheepId = 'd'; render('detail', 'd'); });
check(!(await p.$('#btn-delete-sheep')) && /soins/.test(await p.textContent('.sup-impossible')), 'brebis traitée : suppression impossible (registre sanitaire)');
await p.evaluate(() => { currentBelierId = 'y'; ficheBelierTab = 'ident'; render('belier-detail'); });
check(!(await p.$('#btn-delete-belier')) && /Suppression impossible/.test(await p.textContent('body')), 'bélier traité : suppression impossible');
for (const id of ['b', 'c']) {
  await p.evaluate(id => { currentSheepId = id; ficheBrebisTab = 'ident'; ficheBrebisTabSheepId = id; render('detail', id); }, id);
  check(!(await p.$('#btn-delete-sheep')) && /Suppression impossible/.test(await p.textContent('.sup-impossible')), 'brebis ' + id + ' : suppression impossible (repro / lait)');
}
eq(await p.evaluate(() => { const before = DB.brebis.length; supprimerAnimalEntier('brebis', DB.brebis[1], 'brebis', 'x', null, () => {}); return DB.brebis.length === before; }), true, 'garde-fou : même appelée directement, rien n\'est supprimé');

// 3. mise bas avec un agneau bouclé : jamais supprimée (son n° ne doit pas resservir) ; mise bas sans agneau bouclé : un geste, Annuler exact
await p.evaluate(() => { currentSheepId = 'b'; render('detail', 'b'); deleteItem('agnelages', 0); });
eq(await p.evaluate(() => DB.brebis.find(s => s.id === 'b').agnelages.length), 1, 'mise bas avec agneau bouclé : rien n\'est supprimé');
check(/Suppression impossible/.test(await p.textContent('#message-charte')) && /1 agneau bouclé \(n°61001\)/.test(await p.textContent('#message-charte')), 'message de la charte : agneau bouclé : ' + await p.textContent('#message-charte'));
await p.click('#mc-ok');
await p.evaluate(() => { const b = DB.brebis.find(s => s.id === 'b'); b.agnelages.push({ date: '2026-11-10', campagne: 2027, codeRepro: 'MN', lambs: [{ sexe: 'Femelle', eid: '' }, { sexe: 'Mort-né' }] }); window.__avant = JSON.stringify(DB); render('detail', 'b'); deleteItem('agnelages', 1); });
eq(await p.evaluate(() => DB.brebis.find(s => s.id === 'b').agnelages.length), 1, 'mise bas sans agneau bouclé (saisie sur la mauvaise brebis) : supprimée sans boîte native');
check(/Mise bas du 10\/11\/2026 supprimée/.test(await snack()), 'bandeau de la mise bas : ' + await snack());
await p.click('#sup-snack-annuler');
eq(await pareil(), true, 'Annuler : mise bas exacte');

// 4. soin d'un agneau supprimé puis rétabli
await p.evaluate(() => { currentAgneauEid = '250000004561001'; render('agneau-detail'); deleteAgneauItem('sanitaire', 0); });
eq(await p.evaluate(() => findLambByEid('250000004561001').sanitaire.length), 0, 'soin de l\'agneau supprimé');
await p.click('#sup-snack-annuler');
eq(await pareil(), true, 'Annuler : soin de l\'agneau exact');

// 5. bélier, agnelle : message de la charte puis Annuler ; agnelle avec IA : impossible
await p.evaluate(() => { currentBelierId = 'z'; ficheBelierTab = 'ident'; render('belier-detail'); });
await p.evaluate(() => document.getElementById('btn-delete-belier').click());
await p.click('#sup-ok');
eq(await p.evaluate(() => DB.beliers.map(b => b.id)), ['y'], 'bélier sans saisie supprimé (le bélier traité reste)');
await p.click('#sup-snack-annuler');
eq(await pareil(), true, 'Annuler : bélier exact');
await p.evaluate(() => { currentAgnelleId = 'g'; agnelleDetailOrigin = 'agnelles'; render('agnelle-detail'); });
await p.evaluate(() => document.getElementById('btn-delete-agnelle-fiche').click());
await p.click('#sup-ok');
eq(await p.evaluate(() => DB.agnelles.map(a => a.id)), ['h'], 'agnelle supprimée');
await p.click('#sup-snack-annuler');
eq(await pareil(), true, 'Annuler : agnelle exacte, à sa place');
await p.evaluate(() => { currentAgnelleId = 'h'; render('agnelle-detail'); });
check(!(await p.$('#btn-delete-agnelle-fiche')) && /Suppression impossible/.test(await p.textContent('body')), 'agnelle avec IA : suppression impossible');
console.log('OK : suppressions en un geste ou par message de la charte, Annuler exact, n° retiré des lots, repro / lait jamais supprimés.');
await browser.close();
console.log('test_suppressions_annulables : OK');
