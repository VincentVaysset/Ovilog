/* Type de sortie « Mise à jour inventaire » (mobile et PC). Ce n'est pas une mort : jamais dans la mortalité ni les causes de mortalité ;
   compté avec les pertes dans le Bilan de campagne (brebis, agnelles, ligne « Pertes (inventaire) » des agneaux, seulement s'il y en a) ;
   pastille neutre ; jamais proposé à la saisie, mais une sortie existante se modifie (date) sans perdre son type et s'annule comme les autres.
   Bipage complet des brebis : les absentes sortent avec ce type (plus « Morte ») ; les anciennes sorties « Morte » à ce motif restent telles quelles.
   saveData REMPLACÉ ; jeu synthétique (EID d'exemple, indicatif 000456). */
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
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({}); saveData = () => true;
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    const E = n => '250000004569' + String(n).padStart(3, '0');
    const fiche = (n, x) => Object.assign({ id: 'b' + n, eid: E(n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, x || {});
    const agneau = (n, sexe, x) => Object.assign({ sexe, adopte: false, eid: '250000004561' + String(n).padStart(3, '0'), sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-10-12' }] }, x || {});
    DB.brebis = [
      fiche(1, { agnelages: [{ date: '2026-10-12', campagne: 2026, codeRepro: 'MN', lambs: [agneau(1, 'Mâle'), agneau(2, 'Femelle')] }] }),
      fiche(2),
      fiche(3, { statut: 'morte', mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }, { type: 'Morte', cause: 'Mise à jour inventaire', date: '2025-06-01' }] })   // ancienne sortie : reste « Morte »
    ];
    DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.mouvementsCollectifs = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  });
  return page;
}

for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  const p = await ouvrir(bureau);
  const causesAvant = await p.evaluate(() => DB.causesMortalite.slice());

  // ================================================================ 1. bipage complet : l'absente sort en « Mise à jour inventaire »
  await p.evaluate(() => { DB.majInventaireSession = { eids: [DB.brebis[0].eid] }; render('maj-inventaire-validation'); });
  await p.click('#btn-valider-maj-inventaire');
  const b2 = await p.evaluate(() => { const s = DB.brebis[1], m = s.mouvements[s.mouvements.length - 1], lot = DB.mouvementsCollectifs[0];
    return { type: m.type, cause: m.cause, statut: s.statut, lib: libelleStatutBrebis(s), lot: [lot.type, lot.cause, estLotSystemeMv(lot)], causes: DB.causesMortalite.slice(), b1: DB.brebis[0].statut, b3: DB.brebis[2].mouvements[1].type }; });
  eq([b2.type, b2.cause, b2.statut, b2.lib], ['Mise à jour inventaire', null, 'sortie inventaire', 'Mise à jour inventaire'], nom + ' : brebis absente du bipage sortie en « Mise à jour inventaire », sans cause');
  eq(b2.lot, ['Mise à jour inventaire', null, true], nom + ' : lot collectif du nouveau type, reconnu comme lot système');
  eq([b2.causes, b2.b1, b2.b3], [causesAvant, 'active', 'Morte'], nom + ' : causes de mortalité inchangées, brebis bipée active, ancienne sortie « Morte » intacte');
  eq(await p.evaluate(() => { const m = mortaliteSanitaireData(); return [m.brebisMortesCount, Object.keys(m.causesCount)]; }), [0, []], nom + ' : la sortie inventaire n\'est pas une mort de brebis (accueil)');
  eq(await p.evaluate(() => { const r = bilanReproductionCampagne(2026); const B = r.mouvements.brebis; return [B.adultes.sorties.pertes + B.antenaises.sorties.pertes, B.adultes.sorties.mortes + B.antenaises.sorties.mortes]; }), [1, 0], nom + ' : Bilan de campagne : comptée avec les pertes, pas avec les mortes');
  console.log('OK 1 ' + nom + ' : bipage complet → « Mise à jour inventaire », hors mortalité, avec les pertes.');

  // ================================================================ 2. agneau sorti en « Mise à jour inventaire »
  const ag = await p.evaluate(() => {
    const l = DB.brebis[0].agnelages[0].lambs[0];
    l.mouvements.push({ type: SORTIE_INVENTAIRE, cause: null, acheteur: null, date: '2027-03-01' });
    recalculerStatutFinalAgneau(l);
    const bilan = bilanReproductionCampagne(2026).mouvements.agneaux;
    const mort = mortaliteSanitaireData();
    return { statut: l.statutFinal, regle: isLambResolved(l), sorti: agneauSorti(l), actifs: getAgneauxActifsInventaire().map(x => x.eid.slice(-3)), collectif: CATEGORIE_ANIMAL_CONFIG.agneaux.isActive(l),
      pertes: (bilan.adultes.males.pertes || 0) + (bilan.antenaises.males.pertes || 0), presents: bilan.adultes.males.presents + bilan.antenaises.males.presents, morts: bilan.adultes.males.morts + bilan.antenaises.males.morts, mortsAccueil: mort.agneauxMorts };
  });
  eq([ag.statut, ag.regle, ag.sorti, ag.actifs, ag.collectif], ['inventaire', true, true, ['002'], false], nom + ' : agneau réglé (sorti), plus dans les actifs ni dans les mouvements collectifs');
  eq([ag.pertes, ag.presents, ag.morts], [1, 0, 0], nom + ' : Bilan de campagne : compté en pertes (inventaire), ni mort ni présent');
  check(ag.mortsAccueil === 0, nom + ' : pas dans la mortalité des agneaux (accueil) : ' + ag.mortsAccueil);
  if (!bureau) {
    await p.evaluate(() => { agneauxMobileTab = 'attente'; render('agneaux'); });
    const ong = await p.evaluate(() => [...document.querySelectorAll('.ag-onglets .tab-btn')].map(b => b.textContent));
    eq(ong, ['En attente (1)', 'Vendus (0)', 'Morts (0)', 'Inventaire (1)'], nom + ' : onglet « Inventaire » affiché seulement s\'il y en a');
    await p.click('.ag-onglets .tab-btn[data-tab="inventaire"]');
    const carte = await p.evaluate(() => ({ pastille: document.querySelector('.ag-carte .reg-pastille').className, texte: document.querySelector('.ag-carte').innerText }));
    check(/gris/.test(carte.pastille) && /Sorti en mise à jour inventaire le 01\/03/.test(carte.texte) && /Annuler cette sortie/.test(carte.texte), nom + ' : carte neutre avec date et « Annuler cette sortie » : ' + JSON.stringify(carte));
    await p.click('.btn-agneau-annuler');
    eq(await p.evaluate(() => [DB.brebis[0].agnelages[0].lambs[0].statutFinal || null, DB.brebis[0].agnelages[0].lambs[0].mouvements.length, agneauxMobileTab]), [null, 1, 'attente'], nom + ' : annulée : l\'agneau repasse en attente, onglet Inventaire masqué');
    await p.evaluate(() => { const l = DB.brebis[0].agnelages[0].lambs[0]; l.mouvements.push({ type: SORTIE_INVENTAIRE, cause: null, acheteur: null, date: '2027-03-01' }); recalculerStatutFinalAgneau(l); });
  }
  console.log('OK 2 ' + nom + ' : agneau sorti en mise à jour inventaire (réglé, pertes, hors mortalité' + (bureau ? '' : ', onglet Inventaire, annulation') + ').');

  // ================================================================ 3. jamais proposé à la saisie ; modification d'une sortie existante
  await p.evaluate(() => { currentSheepId = 'b1'; editContext = null; render('add-mouvement', 'b1'); });
  eq(await p.evaluate(() => [...document.querySelectorAll('.type-opt')].map(b => b.dataset.val).includes('Mise à jour inventaire')), false, nom + ' : type jamais proposé à la saisie');
  await p.evaluate(() => { const s = DB.brebis[1]; currentSheepId = s.id; editContext = { kind: 'mouvements', idx: s.mouvements.length - 1 }; render('add-mouvement', s.id); });
  const edit = await p.evaluate(() => ({ sel: [...document.querySelectorAll('.type-opt.selected')].map(b => b.dataset.val), cause: document.getElementById('cause-block').classList.contains('hidden') }));
  eq(edit, { sel: ['Mise à jour inventaire'], cause: true }, nom + ' : modification : type gardé et sélectionné, sans bloc cause');
  await p.fill('#f-date', '2027-03-15');
  await p.click('#btn-save-mouvement');
  eq(await p.evaluate(() => { const s = DB.brebis[1], m = s.mouvements[s.mouvements.length - 1]; return [m.type, m.cause, m.date, s.statut]; }), ['Mise à jour inventaire', null, '2027-03-15', 'sortie inventaire'], nom + ' : date modifiée, type et statut gardés');
  console.log('OK 3 ' + nom + ' : jamais proposé à la saisie ; modification sans perte du type.');

  // ================================================================ 4. registre et Mouvements : pastille neutre ; annulation du lot
  eq(await p.evaluate(() => [registreTeinteMouvement('Mise à jour inventaire'), PILL_TYPE_MV('Mise à jour inventaire'), TYPES_SORTIE.includes('Mise à jour inventaire'), TYPES_SORTIE_MV.includes('Mise à jour inventaire')]), ['gris', 'neutral', true, true], nom + ' : pastilles neutres ; reconnu comme sortie partout');
  await p.evaluate(() => { registreView = 'mouvements'; render('registre'); });
  const reg = await p.evaluate(() => ({ pastilles: [...document.querySelectorAll('.reg-pastille')].filter(x => x.textContent === 'Mise à jour inventaire').map(x => x.className), texte: document.getElementById('app').innerText }));
  check(/Mise à jour inventaire/.test(reg.texte), nom + ' : registre : mouvement listé');
  check(reg.pastilles.every(c => /gris/.test(c)) && (bureau || reg.pastilles.length >= 1), nom + ' : registre : pastille neutre : ' + JSON.stringify(reg.pastilles));
  if (bureau) check(/Autres sorties\s*0\b/.test(reg.texte) && /Morts et pertes\s*[1-9]/.test(reg.texte), nom + ' : registre PC : comptée dans « Morts et pertes », pas dans « Autres sorties »');
  eq(await p.evaluate(() => { annulerLotMv(DB.mouvementsCollectifs[0]); const s = DB.brebis[1]; return [s.statut, s.mouvements.some(m => m.type === SORTIE_INVENTAIRE)]; }), ['active', false], nom + ' : « Annuler le lot » remet la brebis active');
  console.log('OK 4 ' + nom + ' : registre et Mouvements.');
  await p.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS « MISE À JOUR INVENTAIRE » (type de sortie) SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
