/* N° de boucle suivant proposé à la mise bas (saisies rapides mobile et PC, fiche brebis) : plus grand n° individuel des agneaux de la CAMPAGNE en cours
   (indicatif de l'élevage) et de ceux déjà saisis dans la mise bas, + 1, en sautant un n° déjà pris ; rien avant le premier agneau bouclé ; jamais pour un
   mort-né ; réglage de compte « Proposer le n° de boucle suivant » (Paramètres › Exploitation, boucleSuivanteAuto, actif par défaut).
   saveData REMPLACÉ ; jeu synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { readFileSync } from 'fs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  const p = await (await browser.newContext({ viewport: bureau ? { width: 1400, height: 1000 } : { width: 390, height: 844 } })).newPage();
  await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
  if (bureau) await p.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  p.on('dialog', d => d.accept());
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(() => {
    DB = migrateData({}); saveData = () => true;
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
    window.E = n => '250000004569' + String(n).padStart(3, '0');
    const fiche = n => ({ id: 'b' + n, eid: E(n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
    DB.brebis = [1, 2, 3, 4, 5].map(fiche); DB.beliers = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    // campagne en cours : dernier agneau bouclé 71012 ; campagne passée : 71099 (ignoré) ; 71013 déjà pris par une agnelle (sauté)
    DB.brebis[0].agnelages = [
      { date: '2025-11-02', campagne: 2025, codeRepro: 'MN', lambs: [{ sexe: 'Mâle', adopte: false, eid: '250000045671099' }] },
      { date: '2026-11-02', campagne: 2026, codeRepro: 'MN', lambs: [{ sexe: 'Mâle', adopte: false, eid: '250000045671012' }, { sexe: 'Mort-né', adopte: false }] }];
    DB.agnelles = [{ id: 'ag1', eid: '250000045671013', statut: 'active', origine: 'achetée', sanitaire: [], mouvements: [] }];
  });
  // ================================================================ 1. calcul
  eq(await p.evaluate(() => [numeroBoucleSuivant([]), numeroBoucleSuivant(['71014']), numeroBoucleSuivant(['71020', '71014'])]), ['71014', '71015', '71021'],
    nom + ' : plus grand n° de la campagne + 1, n° déjà pris sauté, n° déjà saisis dans la mise bas comptés');
  eq(await p.evaluate(() => { const a = DB.brebis[0].agnelages[1]; a.campagne = 2025; const r = numeroBoucleSuivant([]); a.campagne = 2026; return r; }), '', nom + ' : rien avant le premier agneau bouclé de la campagne');
  eq(await p.evaluate(() => { const i = DB.exploitation.indicatifMarquage; DB.exploitation.indicatifMarquage = ''; const r = numeroBoucleSuivant([]); DB.exploitation.indicatifMarquage = i; return r; }), '', nom + ' : rien sans indicatif de marquage');

  // ================================================================ 2. saisie rapide : proposé, un de plus par agneau, jamais pour un mort-né, modifiable
  await p.evaluate(() => { resetMisebasRapideSession(); render('misebas-rapide'); });
  await p.fill('#scan-misebas', '69002'); await p.press('#scan-misebas', 'Enter');
  await p.waitForSelector('#f-date-rapide');
  eq(await p.inputValue('.eid-input-rapide[data-id="0"]'), '71014', nom + ' : saisie rapide : 1er agneau = n° suivant');
  await p.click('#add-lamb-rapide');
  eq(await p.inputValue('.eid-input-rapide[data-id="1"]'), '71015', nom + ' : 2e agneau = le suivant encore');
  await p.click('#add-lamb-rapide');
  await p.check('.mortne-check-rapide[data-id="2"]');
  eq(await p.evaluate(() => !document.querySelector('.eid-input-rapide[data-id="2"]')), true, nom + ' : mort-né : pas de n°');
  await p.uncheck('.mortne-check-rapide[data-id="2"]');
  eq(await p.inputValue('.eid-input-rapide[data-id="2"]'), '71016', nom + ' : plus mort-né : un n° proposé à nouveau');
  await p.fill('.eid-input-rapide[data-id="2"]', '71030');   // n° changé à la main (boucle sautée)
  for (const [i, sexe] of [[0, 'Mâle'], [1, 'Femelle'], [2, 'Femelle']]) await p.click(`.sexe-opt-rapide[data-id="${i}"][data-val="${sexe}"]`);
  await p.click('#btn-valider-misebas');
  await p.waitForSelector('#mb-confirmation');
  eq(await p.evaluate(() => DB.brebis[1].agnelages[0].lambs.map(l => l.eid)), ['250000045671014', '250000045671015', '250000045671030'], nom + ' : n° enregistrés (proposés ou changés à la main)');
  // la suite repart du plus grand : 71031
  await p.fill('#scan-misebas', '69003'); await p.press('#scan-misebas', 'Enter');
  await p.waitForSelector('#f-date-rapide');
  eq(await p.inputValue('.eid-input-rapide[data-id="0"]'), '71031', nom + ' : après une boucle sautée, la suite repart de là');

  // ================================================================ 3. fiche brebis : nouvel agnelage
  await p.evaluate(() => { currentSheepId = 'b4'; editContext = null; render('add-agnelage', 'b4'); });
  eq(await p.inputValue('.eid-input[data-id="1"]'), '71031', nom + ' : fiche brebis : 1er agneau = n° suivant');
  await p.click('#add-lamb');
  eq(await p.inputValue('.eid-input[data-id="2"]'), '71032', nom + ' : fiche brebis : 2e agneau = le suivant');
  // modification d'un agnelage existant : aucun n° ajouté aux agneaux enregistrés
  await p.evaluate(() => { currentSheepId = 'b1'; editContext = { kind: 'agnelages', idx: 1 }; render('add-agnelage', 'b1'); });
  eq(await p.evaluate(() => [...document.querySelectorAll('.eid-input')].map(i => i.value)), ['250000045671012', ''], nom + ' : modification : n° enregistrés inchangés, rien proposé au mort-né');

  // ================================================================ 4. réglage de compte : désactivé = rien proposé
  await p.evaluate(() => { editContext = null; parametresTab = 'exploitation'; parametresRubrique = 'exploitation'; render('parametres'); });
  check(await p.isChecked('#f-exp-boucle-suivante'), nom + ' : réglage actif par défaut');
  await p.uncheck('#f-exp-boucle-suivante');
  eq(await p.evaluate(() => DB.boucleSuivanteAuto), false, nom + ' : réglage de compte enregistré');
  await p.evaluate(() => { resetMisebasRapideSession(); render('misebas-rapide'); });
  await p.fill('#scan-misebas', '69005'); await p.press('#scan-misebas', 'Enter');
  await p.waitForSelector('#f-date-rapide');
  eq(await p.inputValue('.eid-input-rapide[data-id="0"]'), '', nom + ' : désactivé : case vide');
  console.log('OK ' + nom + ' : n° de boucle suivant (calcul, saisie rapide, fiche, réglage).');
  await p.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS « N° DE BOUCLE SUIVANT » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
// réglage de compte : synchronisé (dans META_FIELDS du module de synchro)
const src = readFileSync(new URL('../www/index.html', import.meta.url), 'utf8').match(/const META_FIELDS = \[[\s\S]*?\];/);
if (!src || !/'boucleSuivanteAuto'/.test(src[0])) throw new Error('FAIL: boucleSuivanteAuto absent de META_FIELDS');
console.log('OK : boucleSuivanteAuto synchronisé (META_FIELDS).');
