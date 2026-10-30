/* « Modifier l'agnelage » (fiche brebis, et depuis la saisie rapide mobile / PC qui ouvrent le même écran) : chaque agneau repart de sa fiche
   enregistrée, seuls les champs du formulaire changent. Modifier sans rien changer = fiche identique (soins, mouvements, sortie, tri, sexe et cause
   du mort-né, mère adoptive). Retirer un agneau qui a des saisies, ou le passer en mort-né : message de la charte, rien d'enregistré, puis
   « Enregistrer quand même » applique le changement. Aucun champ technique du formulaire n'est enregistré. saveData REMPLACÉ ; jeu synthétique
   (EID d'exemple, indicatif 000456). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1400, height: 1000 } : { width: 390, height: 844 } })).newPage();
  await page.clock.setFixedTime(new Date('2027-03-20T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => { throw new Error('boîte native inattendue : ' + d.message()); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({}); window.__saves = 0; saveData = () => { window.__saves++; return true; };
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    const fiche = (n) => ({ id: 'b' + n, eid: '250000004569' + String(n).padStart(3, '0'), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
    DB.brebis = [fiche(1), fiche(2)]; DB.beliers = []; DB.agnelles = []; DB.lots = [];
    DB.brebis[0].agnelages = [{ date: '2026-11-01', campagne: 2026, codeRepro: 'MN', codeSieolRepro: REPRO_CODE_SIEOL.MN, lambs: [
      { sexe: 'Mâle', adopte: false, eid: '250000004561001', statutFinal: 'vendu', sanitaire: [{ date: '2026-11-03', produit: 'Produit A' }], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-11-01' }, { type: 'Vendu', date: '2026-12-01', acheteur: 'Acheteur C' }] },
      { sexe: 'Femelle', adopte: true, adoptiveEid: '250000004569002', eid: '250000004561002', sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-11-01' }] },
      { sexe: 'Mort-né', adopte: false, sexeMortNe: 'Femelle', cause: 'Faiblesse' }] }];
    DB.causesMortalite = ['Faiblesse'];
    window.__avant = JSON.stringify(DB.brebis[0].agnelages[0]);
  });
  return page;
}
const modifier = (p) => p.evaluate(() => { currentSheepId = 'b1'; editContext = { kind: 'agnelages', idx: 0 }; render('add-agnelage', 'b1'); });
const ag = (p) => p.evaluate(() => JSON.parse(JSON.stringify(DB.brebis[0].agnelages[0])));

for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  const p = await ouvrir(bureau);
  // ================================================================ 1. modifier sans rien changer : fiche identique
  await modifier(p); await p.click('#btn-save-agnelage');
  eq(await p.evaluate(() => JSON.stringify(DB.brebis[0].agnelages[0]) === window.__avant), true, nom + ' : modifier sans rien changer laisse la mise bas identique, à l\'octet près (soins, vente, mère adoptive, sexe et cause du mort-né, campagne)');
  await p.evaluate(() => { DB.brebis[0].agnelages[0].campagne = 2025; DB.brebis[0].agnelages[0].lotRepro = 'L1'; });
  await modifier(p); await p.click('#btn-save-agnelage');
  eq(await p.evaluate(() => [DB.brebis[0].agnelages[0].campagne, DB.brebis[0].agnelages[0].lotRepro]), [2025, 'L1'], nom + ' : une mise bas d\'une campagne passée garde sa campagne et ses autres champs');
  await p.evaluate(() => { DB.brebis[0].agnelages[0] = JSON.parse(window.__avant); });
  console.log('OK 1 ' + nom + ' : modifier sans rien changer = mise bas identique ; campagne gardée.');

  // ================================================================ 2. changer un champ : seul ce champ change
  await modifier(p);
  await p.click('.sexe-opt[data-id="1"][data-val="Femelle"]');
  await p.click('#btn-save-agnelage');
  const a2 = await ag(p);
  eq([a2.lambs[0].sexe, a2.lambs[0].sanitaire, a2.lambs[0].statutFinal, a2.lambs[0].mouvements.length], ['Femelle', [{ date: '2026-11-03', produit: 'Produit A' }], 'vendu', 2], nom + ' : sexe changé, soins et vente gardés');
  check(!('eidOriginal' in a2.lambs[0]) && !('adoptEidTouched' in a2.lambs[1]) && !('eidOriginal' in a2.lambs[2]), nom + ' : aucun champ technique du formulaire enregistré');
  console.log('OK 2 ' + nom + ' : un champ changé, le reste gardé, aucun champ technique.');

  // ================================================================ 3. agneau vendu passé en mort-né : message, rien d'enregistré, puis « Enregistrer quand même »
  await modifier(p);
  const s0 = await p.evaluate(() => window.__saves);
  await p.click('.sexe-opt[data-id="1"][data-val="Mort-né"]');
  await p.click('#btn-save-agnelage');
  const msg = await p.evaluate(() => document.getElementById('agnelage-pertes').innerText);
  check(/Des saisies seront effacées/.test(msg) && /n°61001 passé en mort-né : soins, vente ou mort effacés/.test(msg), nom + ' : message de la charte : ' + msg);
  eq([await p.evaluate(() => window.__saves) === s0, (await ag(p)).lambs[0].sexe], [true, 'Femelle'], nom + ' : rien enregistré tant que ce n\'est pas confirmé');
  await p.click('#btn-pertes-confirmer');
  const a3 = await ag(p);
  eq(a3.lambs[0], { sexe: 'Mort-né', adopte: false }, nom + ' : « Enregistrer quand même » : agneau passé en mort-né');
  console.log('OK 3 ' + nom + ' : passage en mort-né d\'un agneau avec saisies : message, puis « Enregistrer quand même ».');

  // ================================================================ 4. retirer un agneau sans saisies : pas de message ; mort-né redevenu vivant : sexe et cause du mort-né retirés
  await p.evaluate(() => { DB.brebis[0].agnelages[0] = JSON.parse(window.__avant); });
  await modifier(p);
  await p.click('.remove-lamb[data-id="2"]');   // agneau n°61002 : aucune saisie
  await p.click('.sexe-opt[data-id="3"][data-val="Mâle"]'); await p.fill('.eid-input[data-id="3"]', '250000004561004');
  await p.click('#btn-save-agnelage');
  const a4 = await ag(p);
  eq(a4.lambs.map(l => [l.sexe, l.eid || null, 'cause' in l, 'sexeMortNe' in l]), [['Mâle', '250000004561001', false, false], ['Mâle', '250000004561004', false, false]], nom + ' : agneau sans saisies retiré sans message ; mort-né devenu vivant sans sexe ni cause de mort-né');
  eq(a4.lambs[1].mouvements, [{ type: 'Entrée', cause: 'Naissance', date: '2026-11-01' }], nom + ' : mort-né devenu vivant : entrée de naissance posée');
  // ---- retirer l'agneau vendu (avec saisies) : message
  await modifier(p);
  await p.click('.remove-lamb[data-id="1"]'); await p.click('#btn-save-agnelage');
  check(/n°61001 retiré : soins, vente ou mort effacés/.test(await p.evaluate(() => document.getElementById('agnelage-pertes').innerText)) && (await ag(p)).lambs.length === 2, nom + ' : retirer un agneau avec saisies : message, rien enregistré');
  await p.click('#btn-pertes-confirmer');
  eq((await ag(p)).lambs.map(l => l.eid), ['250000004561004'], nom + ' : « Enregistrer quand même » : agneau retiré');
  console.log('OK 4 ' + nom + ' : retrait sans saisies direct, avec saisies après confirmation ; mort-né redevenu vivant nettoyé.');
}
await browser.close();
console.log('TOUT OK test_modif_agnelage');
