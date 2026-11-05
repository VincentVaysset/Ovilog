/* Identifier les agneaux (mobile) : sexe corrigé, adoption, « Mort sans n° ». Sexe et adoption partent avec le n° (« Enregistrer et suivant »), rien avant ;
   adoption : brebis active, jamais sa propre mère, déjà notée = interrupteur allumé ; mort sans n° : date (jamais avant la mise bas ni future), cause facultative,
   l'agneau quitte « Sans n° » sans compter dans « Identifiés », bandeau « Annuler » = fiche exacte d'avant ; aucune boîte native. Jeu synthétique (indicatif 000456). */
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
  DB = migrateData({}); window.__saves = 0; saveData = () => { window.__saves++; return true; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  const fiche = (n, id) => ({ id, eid: '250000045' + n, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
  DB.brebis = [fiche('669002', 'b1'), fiche('669045', 'b2'), fiche('670118', 'b3')];
  DB.causesMortaliteAgneaux = ['Faiblesse', 'Écrasement']; DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  DB.brebis[0].agnelages = [{ date: '2026-11-05', campagne: 2026, codeRepro: 'MN', saisieA: 2, lambs: [{ sexe: 'Mâle', adopte: false }, { sexe: 'Femelle', adopte: false }, { sexe: 'Mâle', adopte: true, adoptiveEid: '250000045669045' }] }];
  DB.brebis[2].agnelages = [{ date: '2026-11-03', campagne: 2026, codeRepro: 'MN', saisieA: 1, lambs: [{ sexe: 'Femelle', adopte: false, sanitaire: [{ id: 'S-1', date: '2026-11-04', type: 'Traitement', produit: 'Produit A' }] }] }];
  identEtat = null; render('identifier-agneaux');
});
await p.fill('#id-q', '69002'); await p.press('#id-q', 'Enter');
await p.waitForSelector('#id-mere');

// 1. agneau choisi : sexe de sa fiche, adoption éteinte ; l'agneau déjà adopté : interrupteur allumé avec la mère adoptive
await p.click('.id-agneau[data-li="2"]');
eq(await p.evaluate(() => [document.querySelector('.id-sexe-opt.active').textContent, document.getElementById('id-adopte').checked, document.getElementById('id-adopt').value, /69045/.test(document.getElementById('id-adopt-apercu').textContent)]), ['Mâle', true, '250000045669045', true], 'adoption déjà notée : interrupteur allumé, mère adoptive affichée');
await p.click('.id-agneau[data-li="0"]');
eq(await p.evaluate(() => [document.querySelector('.id-sexe-opt.active').textContent, document.getElementById('id-adopte').checked, getComputedStyle(document.getElementById('id-adopt-zone')).display]), ['Mâle', false, 'none'], 'agneau sans adoption : interrupteur éteint, case cachée');

// 2. sexe corrigé + adoption : rien n'est écrit avant « Enregistrer et suivant »
const saves0 = await p.evaluate(() => window.__saves);
await p.click('.id-sexe-opt[data-val="Femelle"]');
await p.click('#id-adopte');
await p.fill('#id-adopt', '69002');
check(await p.evaluate(() => /69002/.test(document.getElementById('id-adopt-apercu').textContent)), 'aperçu de la mère adoptive');
eq(await p.evaluate(() => [DB.brebis[0].agnelages[0].lambs[0].sexe, window.__saves]), ['Mâle', saves0], 'rien d\'écrit avant Enregistrer');
// sa propre mère : refusé, rien d'écrit
await p.fill('#id-eid', '71001');
await p.click('#btn-id-enregistrer');
eq(await p.evaluate(() => [/propre mère/.test(document.getElementById('id-erreur').textContent), DB.brebis[0].agnelages[0].lambs[0].eid || '', window.__saves]), [true, '', saves0], 'mère adoptive = sa propre mère : refusé, rien d\'écrit');
await p.fill('#id-adopt', '69045');
await p.click('#btn-id-enregistrer');
eq(await p.evaluate(() => { const l = DB.brebis[0].agnelages[0].lambs[0]; return [l.eid, l.sexe, l.adopte, l.adoptiveEid]; }), ['250000045671001', 'Femelle', true, '250000045669045'], 'enregistré : n°, sexe corrigé, adoption');
// Annuler : fiche exacte d'avant, sexe et adoption compris
await p.click('#id-snack-annuler');
eq(await p.evaluate(() => JSON.stringify(DB.brebis[0].agnelages[0].lambs[0])), JSON.stringify({ sexe: 'Mâle', adopte: false }), 'Annuler : fiche exacte d\'avant (sexe et adoption compris)');

// 3. retirer une adoption déjà notée : interrupteur éteint
await p.click('.id-agneau[data-li="2"]');
await p.click('#id-adopte');
await p.fill('#id-eid', '71002'); await p.click('#btn-id-enregistrer');
eq(await p.evaluate(() => { const l = DB.brebis[0].agnelages[0].lambs[2]; return [l.eid, l.adopte, 'adoptiveEid' in l]; }), ['250000045671002', false, false], 'interrupteur éteint : adoption retirée');

// 4. Mort sans n° : fenêtre, date contrôlée, cause facultative
await p.click('.id-agneau[data-li="1"]');
await p.click('#btn-id-mort');
await p.waitForSelector('#id-mort-sheet');
eq(await p.evaluate(() => [document.getElementById('id-mort-date').value, document.querySelector('#id-mort-sheet').textContent.includes('Femelle de n°69002 · mort sans n°')]), ['2026-11-20', true], 'fenêtre : titre, date du jour');
await p.fill('#id-mort-date', '2026-11-01'); await p.click('#id-mort-ok');
eq(await p.evaluate(() => [/avant la mise bas/.test(document.getElementById('id-mort-err').textContent), DB.brebis[0].agnelages[0].lambs[1].statutFinal || '']), [true, ''], 'date avant la mise bas : refusée');
await p.fill('#id-mort-date', '2026-11-10');
const restantsAvant = await p.evaluate(() => [document.getElementById('id-restants').textContent, document.getElementById('id-faits').textContent]);
await p.selectOption('#id-mort-sheet select.id-mort-cause', 'Écrasement');
const cause = await p.evaluate(() => document.querySelector('#id-mort-sheet select.id-mort-cause').value);
await p.click('#id-mort-ok');
eq(await p.evaluate(() => { const l = DB.brebis[0].agnelages[0].lambs[1]; return [l.statutFinal, l.eid || '', (l.mouvements || []).map(m => m.type + '/' + m.cause + '/' + m.date)]; }), ['mort', '', ['Mort/' + cause + '/2026-11-10']], 'mort enregistrée, toujours sans n°, cause choisie');
eq(await p.evaluate(() => [!document.getElementById('id-mort-sheet'), document.getElementById('id-restants').textContent, document.getElementById('id-faits').textContent, /Femelle de n°69002 mort/.test(document.getElementById('id-snack').textContent)]), [true, String(Number(restantsAvant[0]) - 1), restantsAvant[1], true], 'quitte « Sans n° », pas compté dans Identifiés, bandeau');
eq(await p.evaluate(() => agneauxSansNumero().some(it => it.sheep.id === 'b1' && it.li === 1)), false, 'plus à identifier');
await p.click('#id-snack-annuler');
eq(await p.evaluate(() => [JSON.stringify(DB.brebis[0].agnelages[0].lambs[1]), document.getElementById('id-faits').textContent]), [JSON.stringify({ sexe: 'Femelle', adopte: false }), restantsAvant[1]], 'Annuler : fiche exacte d\'avant, Identifiés inchangé');

// 5. mort sans cause, puis « Annuler » de la fenêtre : rien d'écrit
await p.click('#btn-id-mort'); await p.click('#id-mort-annuler');
eq(await p.evaluate(() => [!document.getElementById('id-mort-sheet'), DB.brebis[0].agnelages[0].lambs[1].statutFinal || '']), [true, ''], 'Annuler de la fenêtre : rien d\'écrit');
await p.click('#btn-id-mort'); await p.click('#id-mort-ok');
eq(await p.evaluate(() => { const l = DB.brebis[0].agnelages[0].lambs[1]; return [l.statutFinal, l.mouvements.slice(-1)[0].cause]; }), ['mort', 'Mort'], 'sans cause : « Mort » (affiché « Non renseignée »)');
await browser.close();
console.log('\nTOUS LES TESTS « IDENTIFIER LES AGNEAUX : SEXE, ADOPTION, MORT SANS N° » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
