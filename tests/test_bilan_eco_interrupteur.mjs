/* Interrupteur « Afficher le Bilan économique » (Paramètres › Exploitation) : il n'existe que sur un compte DISPONIBLE (bilanEconomiqueDisponible), un compte neuf
   ne peut donc jamais activer le Bilan économique. PC et mobile.
   1. Compte neuf, vrai parcours (inscription sur le faux serveur local) : bilanEconomiqueDisponible = false sur le serveur, carte absente, avant ET après un premier relevé de tank.
   2. Ancien compte avec données de lait, réglage absent (cas du compte d'origine) : carte visible et cochée ; décocher la garde visible (disponible = vrai, enregistré),
      le Bilan économique est masqué ; recocher le rend.
   3. Compte créé avant ce réglage avec « faux » explicite (compte neuf d'une version précédente), données de lait ajoutées ensuite : carte absente.
   4. Compte avec « vrai » explicite : carte visible.
   5. Compte non disponible avec une valeur « vrai » forcée : rien ne s'affiche (onglet, lien de la Qualité, montants).
   6. Le réglage « disponible » se synchronise (champ de meta). Jeu synthétique, comptes jetables, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { demarrerHarnais } from './lib/harnais_sync.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));

const parametres = p => p.evaluate(() => { parametresTab = 'exploitation'; parametresRubrique = 'exploitation'; render('parametres'); });
const carte = p => p.evaluate(() => { const c = document.getElementById('card-bilan-economique'), i = document.getElementById('f-exp-bilan-eco'); return { carte: !!c, coche: i ? i.checked : null }; });
const ongletEco = p => p.evaluate(() => { bilanCampagneTab = 'incoherences'; render('bilan-campagne'); return /Bilan économique|Économique/.test([...document.querySelectorAll('#app button')].map(b => b.textContent).join('|')); });

// ================= 1. compte neuf : vrai parcours (faux serveur), PC et mobile
{
  const h = await demarrerHarnais();
  for (const pc of [true, false]) {
    const nom = pc ? 'PC' : 'MOBILE';
    const dev = await h.ouvrir({ desktop: pc, contexte: { viewport: pc ? { width: 1400, height: 900 } : { width: 390, height: 844 } } });
    await h.inscrire(dev, 'eco-int-' + (pc ? 'pc' : 'mob') + '-' + Date.now() + '@ovilog-audit-jetable.test', 'AuditTest12345!');
    await h.attendre(dev, () => window.OvilogSync.getState().loggedIn && currentView === 'premiere-configuration', { label: nom + ' compte neuf', timeout: 30000 });
    await h.attendreServeur(dev.uid, 'meta', r => r.exists && r.data, 'meta du compte neuf');
    const meta = await h.serveur(dev.uid, 'meta');
    eq([meta.data.bilanEconomiqueActif, meta.data.bilanEconomiqueDisponible], [false, false], nom + ' : compte neuf, Bilan économique inactif et non disponible sur le serveur');
    await parametres(dev.page);
    eq(await carte(dev.page), { carte: false, coche: null }, nom + ' : compte neuf, pas d\'interrupteur « Afficher le Bilan économique »');
    await dev.page.evaluate(() => { DB.laitTank = [{ date: '2026-10-02', quantite: 120 }]; DB.prelevementsQualite = [{ id: 'p1', date: '2026-10-02', volumeLait: 120, tb: 70, tp: 55 }]; });
    await parametres(dev.page);
    eq(await carte(dev.page), { carte: false, coche: null }, nom + ' : compte neuf, toujours pas d\'interrupteur après un premier relevé de tank et un prélèvement');
    check(!(await dev.page.evaluate(() => bilanEconomiqueActif())) && !(await ongletEco(dev.page)), nom + ' : compte neuf, Bilan économique masqué');
    console.log('OK 1 ' + nom + ' : compte neuf (vrai parcours), interrupteur absent, avant et après les premières données de lait.');
  }
  // 6. synchro du réglage : un compte qui a l'interrupteur et le touche enregistre « disponible = vrai » sur le serveur
  const dev = h.appareils[0];
  await dev.page.evaluate(() => { DB.bilanEconomiqueDisponible = true; DB.bilanEconomiqueActif = true; saveData(DB); });
  await h.attendreServeur(dev.uid, 'meta', r => r.exists && r.data && r.data.bilanEconomiqueDisponible === true, 'réglage disponible synchronisé');
  console.log('OK 6 : le réglage « disponible » se synchronise avec le compte.');
  for (const d of h.appareils) check(d.erreurs.length === 0, 'aucune erreur JavaScript : ' + JSON.stringify(d.erreurs));
  await h.fin();
}

// ================= 2 à 5 : cas de comptes existants (jeu synthétique, saveData remplacé)
const browser = await chromium.launch(LAUNCH);
async function ouvrir(pc, prep) {
  const page = await (await browser.newContext({ viewport: pc ? { width: 1400, height: 900 } : { width: 390, height: 844 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
  if (pc) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate((prep) => {
    DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; return true; };
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    DB.laitTank = [{ date: '2026-10-01', quantite: 1200 }, { date: '2026-10-02', quantite: 1250 }];
    delete DB.bilanEconomiqueActif; delete DB.bilanEconomiqueDisponible;
    Object.assign(DB, prep);
  }, prep);
  return page;
}
for (const pc of [false, true]) {
  const nom = pc ? 'PC' : 'MOBILE';
  // 2. ancien compte avec lait, réglage absent (compte d'origine)
  let p = await ouvrir(pc, {});
  await parametres(p);
  eq(await carte(p), { carte: true, coche: true }, nom + ' : compte avec lait, réglage absent : interrupteur visible et coché');
  await p.uncheck('#f-exp-bilan-eco');
  eq(await p.evaluate(() => [DB.bilanEconomiqueActif, DB.bilanEconomiqueDisponible, window.__saves > 0, bilanEconomiqueActif()]), [false, true, true, false], nom + ' : décoché = masqué, « disponible » enregistré à vrai');
  await parametres(p);
  eq(await carte(p), { carte: true, coche: false }, nom + ' : après désactivation, l\'interrupteur reste là');
  check(!(await ongletEco(p)), nom + ' : désactivé, pas d\'onglet Bilan économique');
  await parametres(p); await p.check('#f-exp-bilan-eco');
  check(await p.evaluate(() => bilanEconomiqueActif()) && await ongletEco(p), nom + ' : recoché, le Bilan économique revient');
  await p.context().close();
  // 3. compte neuf d'une version précédente : « faux » explicite, sans réglage « disponible », données de lait ajoutées ensuite
  p = await ouvrir(pc, { bilanEconomiqueActif: false });
  await parametres(p);
  eq(await carte(p), { carte: false, coche: null }, nom + ' : « faux » explicite + lait ajouté ensuite : pas d\'interrupteur');
  await p.context().close();
  // 4. « vrai » explicite
  p = await ouvrir(pc, { bilanEconomiqueActif: true, laitTank: [] });
  await parametres(p);
  eq(await carte(p), { carte: true, coche: true }, nom + ' : « vrai » explicite : interrupteur visible');
  await p.context().close();
  // 5. compte non disponible avec une valeur « vrai » forcée : rien ne s'affiche
  p = await ouvrir(pc, { bilanEconomiqueActif: true, bilanEconomiqueDisponible: false, prelevementsQualite: [{ id: 'p1', date: '2026-10-02', volumeLait: 1250, tb: 70, tp: 55 }] });
  check(!(await p.evaluate(() => bilanEconomiqueActif())), nom + ' : non disponible, inactif même avec « vrai » forcé');
  await parametres(p);
  eq(await carte(p), { carte: false, coche: null }, nom + ' : non disponible : pas d\'interrupteur');
  check(!(await ongletEco(p)), nom + ' : non disponible : pas d\'onglet Bilan économique');
  check(!/€/.test(await p.evaluate(() => document.getElementById('app').innerText)), nom + ' : non disponible : aucun montant en euros dans Bilan de campagne');
  await p.evaluate(() => { render('qualite'); });
  check(await p.evaluate(() => !document.getElementById('pl-lien-eco')), nom + ' : non disponible : pas de lien « Bilan économique » dans la Qualité');
  await p.context().close();
  console.log('OK 2-5 ' + nom + ' : compte avec lait (visible, reste visible une fois désactivé), « faux » explicite (absent), « vrai » explicite (visible), non disponible forcé (rien).');
}
await browser.close();
console.log('OK test_bilan_eco_interrupteur');
