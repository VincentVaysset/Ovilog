/* Bip du lecteur Allflex à la mise bas (onEidScanned) : le n° de l'agneau — ou de sa mère adoptive — arrive dans LA case qui a le
   curseur (saisie rapide mobile et fiche brebis « Ajouter un agnelage »), avec aperçu et pastille, exactement comme une frappe clavier.
   Jamais une nouvelle recherche de brebis : le champ de scan garde sa valeur, le formulaire en cours reste ouvert. Curseur au champ de
   scan : le bip cherche la brebis suivante exactement comme avant (enchaînement intact). Jeu synthétique, aucune donnée réelle.
   Contrôle : test_bip_agneau_misebas. */
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

// ================================================================ 1. mise bas rapide : le bip de l'agneau arrive dans SA case, pas dans le champ brebis
await saisir(E_(101));
await page.waitForSelector('#mb-formulaire');
await page.click('.sexe-opt-rapide[data-id="0"][data-val="Mâle"]');
await page.evaluate(() => document.querySelector('.eid-input-rapide[data-id="0"]').focus());
await bip(L_(1));
const b1 = await page.evaluate(() => ({
  agneau: document.querySelector('.eid-input-rapide[data-id="0"]').value,
  pastille: document.querySelector('[data-pastille="0"]').textContent,
  scan: document.getElementById('scan-misebas').value,
  form: document.getElementById('mb-formulaire') ? document.getElementById('mb-formulaire').textContent.includes('n°00101') : false,
  confirmation: !!document.getElementById('mb-confirmation'),
  inconnue: !!document.getElementById('mb-inconnue'),
  blocage: !!document.getElementById('mb-blocage')
}));
eq(b1.agneau, L_(1), 'bip de l\'agneau : sa case reçoit l\'EID');
eq(b1.pastille, 'EID bippé', 'bip de l\'agneau : pastille « EID bippé »');
eq([b1.scan, b1.form, b1.confirmation, b1.inconnue, b1.blocage], ['', true, false, false, false], 'bip de l\'agneau : AUCUNE nouvelle recherche de brebis (champ de scan vidé et non repris, formulaire en cours conservé)');
// ---- mère adoptive : le bip arrive dans sa case aussi
await page.check('.adopt-check-rapide[data-id="0"]');
await page.evaluate(() => document.querySelector('.adopt-eid-rapide[data-id="0"]').focus());
await bip(E_(102));
eq(await page.evaluate(() => document.querySelector('.adopt-eid-rapide[data-id="0"]').value), E_(102), 'mère adoptive : sa case reçoit l\'EID');
await page.waitForFunction(() => /Mère adoptive/.test(document.querySelector('.adopt-preview-rapide[data-id="0"]').textContent));
// ---- enregistrement : la portée bippée part telle quelle
await page.click('#btn-valider-misebas');
await page.waitForSelector('#mb-confirmation');
const a101 = await ag(101);
eq(a101.length, 1, 'une mise bas enregistrée');
check(a101[0].lambs[0].sexe === 'Mâle' && a101[0].lambs[0].eid === L_(1) && a101[0].lambs[0].adopte === true && a101[0].lambs[0].adoptiveEid === E_(102), 'agneau bippé et mère adoptive bippée enregistrés tels quels');

// ================================================================ 2. enchaînement intact : curseur au champ de scan, le bip cherche la brebis suivante comme avant
await page.evaluate(() => document.getElementById('scan-misebas').focus());
await bip(E_(103));
await page.waitForSelector('#mb-formulaire');
check(await page.evaluate(() => document.getElementById('mb-formulaire').textContent.includes('n°00103') && !document.getElementById('mb-confirmation')), 'bip au champ de scan : la brebis suivante ouvre son formulaire (le chaînage brebis est intact)');

// ================================================================ 3. fiche brebis « Ajouter un agnelage » : même règle pour l'agneau et sa mère adoptive
await page.evaluate(() => { currentSheepId = DB.brebis[2].id; editContext = null; render('add-agnelage'); });
await page.waitForSelector('#btn-save-agnelage');
await page.click('.sexe-opt[data-id="1"][data-val="Mâle"]');
await page.evaluate(() => document.querySelector('.eid-input[data-id="1"]').focus());
await bip(L_(2));
const b3 = await page.evaluate(() => ({
  agneau: document.querySelector('.eid-input[data-id="1"]').value,
  vue: currentView,
  apercu: document.querySelector('.eid-preview[data-id="1"]').textContent
}));
eq(b3.agneau, L_(2), 'fiche : la case de l\'agneau reçoit l\'EID');
check(b3.vue === 'add-agnelage' && /n°/.test(b3.apercu), 'fiche : toujours l\'écran agnelage, aperçu de l\'EID affiché');
// ---- mère adoptive
await page.check('.adopt-check[data-id="1"]');
await page.evaluate(() => document.querySelector('.adopt-eid[data-id="1"]').focus());
await bip(E_(104));
eq(await page.evaluate(() => document.querySelector('.adopt-eid[data-id="1"]').value), E_(104), 'fiche : la case de la mère adoptive reçoit l\'EID');
await page.waitForFunction(() => /Mère adoptive/.test(document.querySelector('.adopt-preview[data-id="1"]').textContent));
// ---- enregistrement depuis la fiche
await page.click('#btn-save-agnelage');
const a103 = await ag(103);
eq(a103.length, 1, 'agnelage enregistré depuis la fiche');
check(a103[0].lambs[0].sexe === 'Mâle' && a103[0].lambs[0].eid === L_(2) && a103[0].lambs[0].adopte === true && a103[0].lambs[0].adoptiveEid === E_(104), 'fiche : agneau et mère adoptive bippés enregistrés tels quels');

console.log('OK : bip agneau à la mise bas (case de l\'agneau, mère adoptive, chaînage brebis intact, fiche « Ajouter un agnelage »).');
await browser.close();
