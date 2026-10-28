/* Focus automatique après le choix du sexe (demande du 28/10/2026) : à la mise bas — saisie rapide comme fiche
   « Ajouter un agnelage » — sélectionner le sexe d'un agneau met le curseur dans SA case d'EID : le bip de l'agneau
   suit immédiatement, sans tap intermédiaire. Corriger le sexe remet le curseur dans la case (l'EID se re-bippe).
   Le champ de scan, la recherche de brebis et le chaînement brebis restent intacts. Jeu synthétique, aucune donnée
   réelle. Contrôle : test_focus_sexe_misebas. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

await page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; return true; };
  const eid = (an, n) => '250000012' + '9' + an + String(n).padStart(5, '0');
  window.E = eid;
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.brebis = [fiche(eid(3, 101)), fiche(eid(3, 102)), fiche(eid(3, 103)), fiche(eid(3, 104))];
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  resetMisebasRapideSession(); render('misebas-rapide');
});
const E_ = (n) => '250000012' + '9' + 3 + String(n).padStart(5, '0');
const L_ = (n) => '250000012' + '9' + 4 + String(n).padStart(5, '0');
const saisir = async (val) => { await page.fill('#scan-misebas', val); await page.press('#scan-misebas', 'Enter'); };
const bip = (e) => page.evaluate(x => onEidScanned(x), e);
const ag = (n) => page.evaluate((n) => JSON.parse(JSON.stringify(DB.brebis.find(b => b.eid === E(3, n)).agnelages)), n);

// ================================================================ 1. saisie rapide : le choix du sexe met le curseur dans la case EID de l'agneau
await saisir(E_(101));
await page.waitForSelector('#mb-formulaire');
await page.click('.sexe-opt-rapide[data-id="0"][data-val="Mâle"]');
check(await page.evaluate(() => document.activeElement === document.querySelector('.eid-input-rapide[data-id="0"]')), "saisie rapide : après le choix du sexe, le curseur est dans la case EID de l'agneau");
// ---- le bip suit immédiatement, SANS tap dans la case : le n° arrive dans SA case, pas de nouvelle recherche de brebis
await bip(L_(1));
const f1 = await page.evaluate(() => ({
  agneau: document.querySelector('.eid-input-rapide[data-id="0"]').value,
  pastille: document.querySelector('[data-pastille="0"]').textContent,
  scan: document.getElementById('scan-misebas').value,
  form: document.getElementById('mb-formulaire') ? document.getElementById('mb-formulaire').textContent.includes('n°00101') : false,
  confirmation: !!document.getElementById('mb-confirmation'),
  inconnue: !!document.getElementById('mb-inconnue'),
  blocage: !!document.getElementById('mb-blocage')
}));
eq(f1.agneau, L_(1), "bip direct : la case de l'agneau reçoit l'EID sans tap préalable");
eq(f1.pastille, 'EID bippé', "bip direct : pastille « EID bippé »");
eq([f1.scan, f1.form, f1.confirmation, f1.inconnue, f1.blocage], ['', true, false, false, false], "bip direct : aucune nouvelle recherche de brebis (formulaire en cours conservé)");
// ---- correction du sexe : le curseur revient dans la case, l'EID se re-bippe et reste cohérent
await page.click('.sexe-opt-rapide[data-id="0"][data-val="Femelle"]');
check(await page.evaluate(() => document.activeElement === document.querySelector('.eid-input-rapide[data-id="0"]')), "correction du sexe : le curseur revient dans la case EID de l'agneau");
await bip(L_(1));
eq(await page.evaluate(() => document.querySelector('.eid-input-rapide[data-id="0"]').value), L_(1), "correction du sexe : l'EID re-bippé est dans la case");
// ---- enregistrement : la portée part telle quelle (sexe corrigé, EID conservé)
await page.click('#btn-valider-misebas');
await page.waitForSelector('#mb-confirmation');
const a101 = await ag(101);
eq(a101.length, 1, "une mise bas enregistrée");
check(a101[0].lambs[0].sexe === 'Femelle' && a101[0].lambs[0].eid === L_(1), "agneau enregistré : sexe corrigé et EID bippé tels quels");

// ================================================================ 2. enchaînement intact : bip au champ de scan = brebis suivante comme avant
await page.evaluate(() => document.getElementById('scan-misebas').focus());
await bip(E_(103));
await page.waitForSelector('#mb-formulaire');
check(await page.evaluate(() => document.getElementById('mb-formulaire').textContent.includes('n°00103') && !document.getElementById('mb-confirmation')), "bip au champ de scan : la brebis suivante ouvre son formulaire (chaînage intact)");

// ================================================================ 3. fiche « Ajouter un agnelage » : le choix du sexe met aussi le curseur dans la case
await page.evaluate(() => { currentSheepId = DB.brebis[2].id; editContext = null; render('add-agnelage'); });
await page.waitForSelector('#btn-save-agnelage');
await page.click('.sexe-opt[data-id="1"][data-val="Mâle"]');
check(await page.evaluate(() => document.activeElement === document.querySelector('.eid-input[data-id="1"]')), "fiche : après le choix du sexe, le curseur est dans la case EID de l'agneau");
await bip(L_(2));
eq(await page.evaluate(() => ({ v: document.querySelector('.eid-input[data-id="1"]').value, vue: currentView })), { v: L_(2), vue: 'add-agnelage' }, "fiche : bip direct, la case de l'agneau reçoit l'EID (écran agnelage conservé)");
await page.click('#btn-save-agnelage');
const a103 = await ag(103);
eq(a103.length, 1, "fiche : un agnelage enregistré");
check(a103[0].lambs[0].sexe === 'Mâle' && a103[0].lambs[0].eid === L_(2), "fiche : agneau enregistré avec sexe et EID bippés");

console.log("OK : focus automatique dans la case EID de l'agneau après le choix du sexe (saisie rapide + fiche, correction de sexe, chaînage intact).");
await browser.close();
