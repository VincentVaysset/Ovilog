/* Soins au bouclage des agneaux (mobile et PC) : réglage de COMPTE (Paramètres › Exploitation, DB.soinsBouclage, synchronisé), vide pour un compte
   neuf. Chaque agneau qui reçoit son n° à la saisie de la mise bas (saisie rapide mobile / PC, fiche brebis) reçoit ces soins, datés de la mise bas,
   comme un soin du Carnet (délais de la fiche produit, intervenant « Éleveur », marque bouclage) ; jamais un mort-né, jamais un agneau déjà bouclé
   (modification d'un agnelage : seuls les agneaux qui reçoivent leur n° maintenant). Une seule ligne grise fixe sur l'écran de saisie, aucun message
   à chaque bouclage. Produit sans délais ou réservé au vétérinaire : refusé au réglage. saveData REMPLACÉ ; jeu synthétique (indicatif 000456). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
import { readFileSync } from 'fs';
const SOURCE = readFileSync(new URL('../www/index.html', import.meta.url), 'utf8');
const browser = await chromium.launch(LAUNCH);

async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1400, height: 1000 } : { width: 390, height: 844 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => { throw new Error('boîte native inattendue : ' + d.message()); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({}); window.__saves = 0; saveData = () => { window.__saves++; return true; };
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
    window.E = n => '250000004569' + String(n).padStart(3, '0');
    const fiche = n => ({ id: 'b' + n, eid: E(n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
    DB.brebis = [1, 2, 3].map(fiche); DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    // agnelage déjà enregistré : un agneau bouclé (sans soin), un mort-né
    DB.brebis[2].agnelages = [{ date: '2026-11-02', campagne: 2026, codeRepro: 'MN', codeSieolRepro: REPRO_CODE_SIEOL.MN, lambs: [
      { sexe: 'Mâle', adopte: false, eid: '250000004566031', sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-11-02' }] },
      { sexe: 'Mort-né', adopte: false }] }];
    DB.produits = { vaccins: ['Vaccin X'], antibiotiques: ['Antibio Veto'], antiparasitaires: [], antiinflammatoires: [], autres: ['Séléphérol', 'Produit sans fiche'] };
    const info = (lait, viande, x) => Object.assign({ delaiAttente: lait, delaiLait: lait, delaiViande: viande }, x || {});
    DB.produitsInfo = { 'Séléphérol': info(0, 0), 'Vaccin X': info(0, 0), 'Antibio Veto': info(3, 10, { reserveVeterinaire: true }) };
  });
  return page;
}
const soinsAgneaux = (p, n) => p.evaluate(n => DB.brebis[n - 1].agnelages.slice(-1)[0].lambs.map(l => (l.sanitaire || []).map(s => [s.produit, s.date, s.quantiteCc, s.voie || null, s.type, s.sousType || null, s.intervenant, s.bouclage, s.delaiLaitLegalJours, s.delaiViandeLegalJours, /^S-/.test(s.id)])), n);

for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  const p = await ouvrir(bureau);
  // ================================================================ 1. compte neuf : aucun réglage, aucune ligne, aucun soin
  eq(await p.evaluate(() => [DB.soinsBouclage, migrateData({}).soinsBouclage, ligneSoinsBouclageHtml()]), [[], [], ''], nom + ' : compte neuf sans soin au bouclage');
  check(/const META_FIELDS = \[[^\]]*'soinsBouclage'/.test(SOURCE), 'réglage de compte synchronisé (META_FIELDS)');

  // ================================================================ 2. réglage dans Paramètres › Exploitation
  await p.evaluate(() => { parametresTab = 'exploitation'; parametresRubrique = 'exploitation'; render('parametres'); });
  await p.evaluate(() => { const r = document.querySelector('[data-prm-rubrique="exploitation"], [data-onglet="exploitation"]'); if (r && !document.getElementById('card-soins-bouclage')) r.click(); });
  check(await p.evaluate(() => /Aucun soin au bouclage/.test(document.getElementById('card-soins-bouclage').innerText)), nom + ' : carte « Soins au bouclage des agneaux », vide');
  const ajouter = async (produit, dose, voie) => {
    await p.selectOption('#f-sb-produit', produit); await p.fill('#f-sb-dose', dose); if (voie) await p.selectOption('#f-sb-voie', voie);
    await p.click('#btn-sb-ajouter');
    return p.evaluate(() => { const m = document.querySelector('#sb-msg .msg-charte'); return m ? m.innerText : null; });
  };
  eq(await ajouter('Antibio Veto', '2', 'Intramusculaire'), 'Produit réservé au vétérinaire : à saisir par le Carnet sanitaire.', nom + ' : produit réservé au vétérinaire refusé');
  eq(await ajouter('Produit sans fiche', '2', ''), "Délais lait et viande à renseigner d'abord dans Produits et délais.", nom + ' : produit sans délais refusé');
  eq(await ajouter('Vaccin X', '', 'Sous-cutanée'), 'Indiquez la dose par agneau (cc).', nom + ' : dose obligatoire');
  eq(await ajouter('Séléphérol', '2', 'Orale'), null, nom + ' : Séléphérol 2 cc ajouté');
  eq(await ajouter('Séléphérol', '3', 'Orale'), 'Ce produit est déjà dans les soins au bouclage.', nom + ' : pas deux fois le même produit');
  eq(await p.evaluate(() => [DB.soinsBouclage, document.getElementById('card-soins-bouclage').querySelectorAll('.sb-ligne').length]), [[{ produit: 'Séléphérol', doseCc: 2, voie: 'Orale' }], 1], nom + ' : réglage enregistré');
  console.log('OK 1-2 ' + nom + ' : compte neuf vide ; réglage (refus, dose, doublon, ajout).');

  // ================================================================ 3. saisie rapide : ligne grise fixe, soin sur chaque agneau bouclé, jamais sur le mort-né
  await p.evaluate(() => { resetMisebasRapideSession(); render('misebas-rapide'); });
  await p.fill('#scan-misebas', '69001'); await p.press('#scan-misebas', 'Enter');
  await p.waitForSelector('#f-date-rapide');
  await p.evaluate(() => { const q = document.querySelector('#repro-question-rapide .repro-question-btn[data-code="MN"]'); if (q) q.click(); else { const b = document.querySelector('.repro-code-opt-rapide[data-val="MN"]'); if (b) b.click(); } });
  eq(await p.evaluate(() => [...document.querySelectorAll('.soins-bouclage-ligne')].map(e => e.innerText)), ['Au bouclage : Séléphérol 2 cc'], nom + ' : une seule ligne grise fixe sur l\'écran de saisie');
  await p.fill('#f-date-rapide', '2026-11-18');
  await p.click('.sexe-opt-rapide[data-id="0"][data-val="Mâle"]'); await p.fill('.eid-input-rapide[data-id="0"]', '61001');
  await p.click('#add-lamb-rapide'); await p.check('.mortne-check-rapide[data-id="1"]');
  await p.click('#add-lamb-rapide'); await p.click('.sexe-opt-rapide[data-id="2"][data-val="Femelle"]'); await p.fill('.eid-input-rapide[data-id="2"]', '61002');
  await p.click('#btn-valider-misebas'); await p.waitForSelector('#mb-confirmation');
  const soin = ['Séléphérol', '2026-11-18', 2, 'Orale', 'Autre', null, 'Éleveur', true, 0, 0, true];
  eq(await soinsAgneaux(p, 1), [[soin], [], [soin]], nom + ' : saisie rapide : un soin par agneau bouclé, daté de la mise bas ; rien sur le mort-né');
  check(!/Séléphérol/.test(await p.evaluate(() => document.getElementById('mb-confirmation').innerText)), nom + ' : aucun message de soin à chaque bouclage');
  // soin visible comme les autres (fiche de l'agneau), modifiable et supprimable par le Carnet
  eq(await p.evaluate(() => { const l = DB.brebis[0].agnelages[0].lambs[0]; return [datesDuSoin(l.sanitaire[0]).derniere, animauxEligiblesCarnet().some(a => a.eid === l.eid && a.dernierSoin && a.dernierSoin.produit === 'Séléphérol')]; }), ['2026-11-18', true], nom + ' : soin lu comme un soin du Carnet');
  // « Annuler cette saisie » : la mise bas et ses soins disparaissent ensemble
  await p.click('#btn-annuler-derniere');
  eq(await p.evaluate(() => DB.brebis[0].agnelages.length), 0, nom + ' : annuler la saisie retire la mise bas et ses soins');
  console.log('OK 3 ' + nom + ' : saisie rapide (ligne grise, soins, mort-né, annulation).');

  // ================================================================ 4. fiche brebis : création, puis modification (seul l'agneau qui reçoit son n° maintenant)
  await p.evaluate(() => { currentSheepId = 'b2'; editContext = null; render('add-agnelage', 'b2'); });
  eq(await p.evaluate(() => document.querySelector('.soins-bouclage-ligne').innerText), 'Au bouclage : Séléphérol 2 cc', nom + ' : fiche : ligne grise');
  await p.evaluate(() => { document.querySelector('.repro-code-opt[data-val="MN"]').click(); const q = document.querySelector('#repro-question .repro-question-btn[data-code="MN"]'); if (q) q.click(); });
  await p.fill('#f-date', '2026-11-15');
  await p.click('.sexe-opt[data-id="1"][data-val="Femelle"]'); await p.fill('.eid-input[data-id="1"]', '61021');
  await p.click('#btn-save-agnelage');
  eq(await soinsAgneaux(p, 2), [[Object.assign([], soin, { 1: '2026-11-15' })]], nom + ' : fiche, création : soin au bouclage');
  // modification de l'agnelage de b3 : l'agneau déjà bouclé ne reçoit rien ; le mort-né devenu vivant et un nouvel agneau en reçoivent
  await p.evaluate(() => { currentSheepId = 'b3'; editContext = { kind: 'agnelages', idx: 0 }; render('add-agnelage', 'b3'); });
  await p.click('.sexe-opt[data-id="2"][data-val="Mâle"]'); await p.fill('.eid-input[data-id="2"]', '61032');
  await p.click('#add-lamb'); await p.click('.sexe-opt[data-id="3"][data-val="Femelle"]'); await p.fill('.eid-input[data-id="3"]', '61033');
  await p.click('#btn-save-agnelage');
  const s2 = Object.assign([], soin, { 1: '2026-11-02' });
  eq(await soinsAgneaux(p, 3), [[], [s2], [s2]], nom + ' : modification : jamais rétroactif sur un agneau déjà bouclé ; les agneaux qui reçoivent leur n° maintenant sont soignés');
  // modifier sans rien changer : aucun soin en double
  await p.evaluate(() => { currentSheepId = 'b3'; editContext = { kind: 'agnelages', idx: 0 }; render('add-agnelage', 'b3'); });
  await p.click('#btn-save-agnelage');
  eq((await soinsAgneaux(p, 3)).map(x => x.length), [0, 1, 1], nom + ' : modifier sans rien changer n\'ajoute aucun soin');
  console.log('OK 4 ' + nom + ' : fiche brebis (création, modification non rétroactive, pas de doublon).');

  // ================================================================ 5. réglage retiré : plus de ligne, plus de soin ; les soins déjà donnés restent
  await p.evaluate(() => { parametresTab = 'exploitation'; parametresRubrique = 'exploitation'; render('parametres'); });
  await p.evaluate(() => { const r = document.querySelector('[data-prm-rubrique="exploitation"], [data-onglet="exploitation"]'); if (r && !document.getElementById('card-soins-bouclage')) r.click(); });
  await p.click('.sb-retirer[data-idx="0"]');
  eq(await p.evaluate(() => [DB.soinsBouclage, ligneSoinsBouclageHtml(), DB.brebis[1].agnelages[0].lambs[0].sanitaire.length]), [[], '', 1], nom + ' : réglage retiré : plus de ligne ni de soin, les soins déjà donnés restent');
  console.log('OK 5 ' + nom + ' : retrait du réglage.');
  await p.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS « SOINS AU BOUCLAGE » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
