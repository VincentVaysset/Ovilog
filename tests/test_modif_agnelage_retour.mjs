/* « Modifier l'agnelage » ouvert depuis l'écran Mises bas (« Modifier l'agnelage existant » après un n° tapé, mobile et PC ; carte de la liste, mobile) :
   « Enregistrer » et « Retour » ramènent sur l'écran Mises bas ; ouvert depuis la fiche : retour sur la fiche. Dans la modification d'une mise bas de la
   campagne en cours, l'agneau vivant sans n° reçoit le n° suivant proposé (numeroBoucleSuivant), avec la ligne grise ; jamais un mort-né, un agneau déjà
   bouclé ni un agneau sorti ; une case vidée = aucun n° enregistré. saveData REMPLACÉ ; jeu synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1400, height: 1000 } : { width: 390, height: 844 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => { throw new Error('boîte native inattendue : ' + d.message()); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({}); saveData = () => true;
    DB.campagneDebut = 2027; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
    const fiche = (n) => ({ id: 'b' + n, eid: '250000004569' + String(n).padStart(3, '0'), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
    DB.brebis = [fiche(501), fiche(502)]; DB.beliers = []; DB.agnelles = []; DB.lots = [];
    const mb = (lambs) => ({ date: '2026-11-15', campagne: 2027, codeRepro: 'MN', codeSieolRepro: REPRO_CODE_SIEOL.MN, saisieA: 1, lambs });
    DB.brebis[0].agnelages = [mb([
      { sexe: 'Mâle', adopte: false, eid: '', sanitaire: [] },                                   // vivant sans n° : proposition
      { sexe: 'Femelle', adopte: false, eid: '', statutFinal: 'mort', sanitaire: [] },           // mort sans n° : jamais
      { sexe: 'Mort-né', adopte: false }])];                                                       // mort-né : jamais
    DB.brebis[1].agnelages = [mb([{ sexe: 'Femelle', adopte: false, eid: '250000045667005', sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-11-15' }] }])];
  });
  return page;
}
const vue = (p) => p.evaluate(() => currentView);
const eidChamps = (p) => p.evaluate(() => [...document.querySelectorAll('.eid-input')].slice(0, 2).map(x => x.value));
const ouvrirDepuisMisesBas = async (p) => {
  await p.evaluate(() => render('misebas-rapide'));
  await p.fill('#scan-misebas', '69501'); await p.press('#scan-misebas', 'Enter');
  await p.waitForSelector('#btn-edit-existing-agnelage-rapide');
  await p.click('#btn-edit-existing-agnelage-rapide');
  eq(await vue(p), 'add-agnelage', 'Modifier l\'agnelage existant ouvre la modification');
};

for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  const p = await ouvrir(bureau);

  // ============ 1. n° suivant proposé à l'agneau vivant sans n°, jamais au mort, au mort-né ni au bouclé
  await ouvrirDepuisMisesBas(p);
  eq(await eidChamps(p), ['67006', ''], nom + ' : vivant sans n° = n° suivant proposé (après 67005) ; mort sans n° laissé vide (mort-né : pas de case)');
  check(await p.isVisible('#agnelage-boucle-proposee'), nom + ' : ligne grise « videz la case » affichée');

  // ============ 2. « Retour » ramène sur l'écran Mises bas, rien n'est écrit
  await p.evaluate(() => btnBack.onclick());
  eq(await vue(p), 'misebas-rapide', nom + ' : Retour depuis la modification = écran Mises bas');
  eq(await p.evaluate(() => DB.brebis[0].agnelages[0].lambs[0].eid), '', nom + ' : rien écrit sans « Enregistrer »');

  // ============ 3. « Enregistrer » : n° posé, entrée Naissance, retour sur l'écran Mises bas
  await ouvrirDepuisMisesBas(p);
  await p.click('#btn-save-agnelage');
  eq(await vue(p), 'misebas-rapide', nom + ' : Enregistrer = retour sur l\'écran Mises bas');
  const l0 = await p.evaluate(() => DB.brebis[0].agnelages[0].lambs[0]);
  eq([l0.eid, (l0.mouvements || []).map(m => m.cause)], ['250000045667006', ['Naissance']], nom + ' : n° enregistré avec son entrée Naissance');
  eq(await p.evaluate(() => DB.brebis[0].agnelages[0].lambs[1].eid), '', nom + ' : agneau mort sans n° jamais numéroté');
  eq(await p.evaluate(() => agneauxSansNumero().length), 0, nom + ' : l\'agneau quitte « sans n° » (Identifier les agneaux)');

  // ============ 4. agneau déjà bouclé : aucune proposition ; case vidée = aucun n°
  await ouvrirDepuisMisesBas(p);
  check(!(await p.isVisible('#agnelage-boucle-proposee')), nom + ' : agneau déjà bouclé = pas de proposition');
  await p.evaluate(() => { DB.brebis[0].agnelages[0].lambs[0].eid = ''; DB.brebis[0].agnelages[0].lambs[0].mouvements = []; render('misebas-rapide'); });
  await ouvrirDepuisMisesBas(p);
  await p.fill('.eid-input[data-id="1"]', '');
  await p.click('#btn-save-agnelage');
  eq(await p.evaluate(() => DB.brebis[0].agnelages[0].lambs[0].eid || ''), '', nom + ' : case vidée = aucun n° enregistré');

  // ============ 5. carte de la liste (mobile) : même retour
  if (!bureau) {
    await p.evaluate(() => render('misebas-rapide'));
    await p.click('.mb-der[data-sheep-id="b501"]');
    eq(await vue(p), 'add-agnelage', nom + ' : toucher la carte ouvre la modification');
    await p.click('#btn-save-agnelage');
    eq(await vue(p), 'misebas-rapide', nom + ' : carte de la liste : Enregistrer = retour sur l\'écran Mises bas');
  }

  // ============ 6. ouvert depuis la fiche : retour sur la fiche (inchangé)
  await p.evaluate(() => { DB.brebis[0].agnelages[0].lambs[0].eid = ''; currentSheepId = 'b501'; editContext = { kind: 'agnelages', idx: 0 }; render('add-agnelage', 'b501'); });
  await p.click('#btn-save-agnelage');
  eq(await vue(p), 'detail', nom + ' : ouvert depuis la fiche : Enregistrer = fiche');
  await p.evaluate(() => { currentSheepId = 'b501'; editItem('agnelages', 0); });
  await p.evaluate(() => btnBack.onclick());
  eq(await vue(p), 'detail', nom + ' : ouvert depuis la fiche : Retour = fiche');
  console.log('OK ' + nom + ' : retour sur Mises bas (Enregistrer, Retour), n° suivant proposé au seul agneau vivant sans n°, fiche inchangée.');
  await p.context().close();
}
await browser.close();
console.log('test_modif_agnelage_retour : OK');
