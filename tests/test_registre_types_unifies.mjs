/* Registre › Mouvements (mobile et PC) : UN nom par événement, à l'affichage seulement (écran, Excel, PDF) : Naissance (agnelles « Naissance »
   et agneaux « Entrée / Naissance »), Achat, Passage agnelle → brebis, Autre entrée, Vente (Vente, Vendu, Vente reproduction), Mort (Mort,
   Morte), Perte / inventaire, Autoconsommation. Catégorie en quatre choix : Brebis, Béliers, Agneaux nés (agneaux ET agnelles de
   renouvellement), Agnelles de renouvellement. Sexe affiché sur les lignes d'agneaux (« Naissance · femelle »). Données jamais converties.
   saveData REMPLACÉ ; jeu synthétique (indicatif 000456). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1400, height: 1000 } : { width: 390, height: 844 } })).newPage();
  await page.clock.setFixedTime(new Date('2027-03-20T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({}); saveData = () => true;
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    const E = (p, n) => '25000000456' + p + String(n).padStart(3, '0');
    const fiche = (n, mvts) => ({ id: 'b' + n, eid: E(9, n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: mvts, controleLaitier: [], modesRepro: [], videesDefinitives: [] });
    const lamb = (n, sexe, mvts, x) => Object.assign({ sexe, adopte: false, eid: E(1, n), sanitaire: [], mouvements: mvts }, x || {});
    DB.brebis = [
      fiche(1, [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }, { type: 'Vente reproduction', acheteur: 'Acheteur C', date: '2026-11-02' }]),
      fiche(2, [{ type: 'Entrée', cause: 'Renouvellement (agnelle devenue brebis)', date: '2026-10-05' }, { type: 'Morte', cause: 'Maladie', date: '2026-12-01' }]),
      fiche(3, [{ type: 'Entrée', cause: 'Création (ajout manuel)', date: '2024-01-01' }])
    ];
    DB.brebis[2].agnelages = [{ date: '2026-11-10', campagne: 2026, codeRepro: 'MN', lambs: [
      lamb(1, 'Mâle', [{ type: 'Entrée', cause: 'Naissance', date: '2026-11-10' }, { type: 'Vendu', acheteur: 'Acheteur C', date: '2027-01-15' }], { statutFinal: 'vendu' }),
      lamb(2, 'Femelle', [{ type: 'Entrée', cause: 'Naissance', date: '2026-11-10' }, { type: 'Mort', cause: 'Faiblesse', date: '2026-11-20' }], { statutFinal: 'mort' }),
      lamb(3, 'Femelle', [{ type: 'Entrée', cause: 'Naissance', date: '2026-11-10' }], { triStatut: 'gardée' })] }];
    DB.agnelles = [{ id: 'ag3', eid: E(1, 3), statut: 'active', origine: 'née', sanitaire: [], mouvements: [{ type: 'Naissance', date: '2026-11-10' }, { type: 'Entrée', cause: 'Import (fichier généalogie UNOTEC)', date: '2026-11-10' }] }];
    DB.beliers = [{ id: 'be1', eid: E(8, 1), statut: 'actif', sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2025-01-01' }, { type: 'Mise à jour inventaire', date: '2027-02-01' }] }];
    DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    window.__avant = JSON.stringify(DB);
  });
  const lignes = (f) => page.evaluate(f => registreMouvementsFilteredRows('', Object.assign({ categorie: '', type: '', campagne: '' }, f)).map(r => [numeroVisuel(r.eid), r.categorie, typeAfficheRegistre(r), r.detail]), f || {});
  // ================================================================ 1. un seul nom par événement
  eq(await page.evaluate(() => Array.from(new Set(registreMouvementsRows().map(r => r.type))).sort()),
    ['Achat', 'Autre entrée', 'Mort', 'Naissance', 'Passage agnelle → brebis', 'Perte / inventaire', 'Vente'], nom + ' : menu Type sans doublon (Vente/Vendu, Mort/Morte, Naissance/Entrée)');
  eq(await lignes({ type: 'Naissance' }), [['61003', 'Agnelle', 'Naissance', ''], ['61001', 'Agneau', 'Naissance · mâle', ''], ['61002', 'Agneau', 'Naissance · femelle', '']], nom + ' : Naissance : agneaux et agnelle, sexe affiché');
  eq(await lignes({ type: 'Vente' }), [['61001', 'Agneau', 'Vente · mâle', 'Acheteur C'], ['69001', 'Brebis', 'Vente', 'reproduction · Acheteur C']], nom + ' : Vente : Vendu et Vente reproduction réunis, « reproduction » au détail');
  eq(await lignes({ type: 'Mort' }), [['69002', 'Brebis', 'Mort', 'Maladie'], ['61002', 'Agneau', 'Mort · femelle', 'Faiblesse']], nom + ' : Mort : Mort et Morte réunis');
  eq(await lignes({ type: 'Perte / inventaire' }), [['68001', 'Bélier', 'Perte / inventaire', 'Mise à jour inventaire']], nom + ' : inventaire : regroupé avec les pertes, motif gardé au détail');
  // ================================================================ 2. quatre catégories
  eq(await lignes({ categorie: 'Agneaux nés', type: 'Naissance', campagne: '2026' }).then(x => x.length), 3, nom + ' : Agneaux nés + Naissance + campagne 2027 : tous les agneaux nés, renouvellement compris');
  eq(await lignes({ categorie: 'Agnelle', type: 'Naissance' }).then(x => x.map(l => l[0])), ['61003'], nom + ' : Agnelles de renouvellement seules');
  eq(await lignes({ categorie: 'Agneaux nés', type: 'Vente' }).then(x => x.map(l => l[0])), ['61001'], nom + ' : Agneaux nés + Vente');
  // ================================================================ 3. écran : menus
  await page.evaluate(() => { registreView = 'mouvements'; render('registre'); });
  const menus = await page.evaluate(() => [...document.querySelectorAll('select.registre-col-filter[data-col="categorie"] option')].map(o => o.textContent));
  eq(menus, [bureau ? 'Toutes' : 'Catégorie', 'Brebis', 'Béliers', 'Agneaux nés', 'Agnelles de renouvellement'], nom + ' : menu Catégorie en quatre choix');
  await page.selectOption('select.registre-col-filter[data-col="categorie"]', 'Agneaux nés');
  await page.selectOption('select.registre-col-filter[data-col="type"]', 'Naissance');
  check(/Naissance · femelle/.test(await page.evaluate(() => document.getElementById('app').innerText)), nom + ' : écran : « Naissance · femelle » affiché');
  // ================================================================ 4. compteurs ; données jamais converties
  eq(await page.evaluate(() => { const m = registreIndicateursPc().mouvements; return [m.total, m.entrees, m.ventes, m.morts]; }), [13, 7, 1, 3], nom + ' : compteurs inchangés (types d\'origine)');
  check(await page.evaluate(() => JSON.stringify(DB) === window.__avant), nom + ' : rien n\'est écrit (affichage seul)');
  console.log('OK ' + nom + ' : registre Mouvements unifié (types, catégories, sexe, compteurs, lecture seule).');
  await page.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS « REGISTRE : TYPES UNIFIÉS » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
