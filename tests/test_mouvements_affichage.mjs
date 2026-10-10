/* Écran "Mouvements d'animaux" : filtre d'AFFICHAGE par campagne (agnelles,
   agneaux), comparé AVANT (version précédente, URL_AVANT) et APRÈS (URL_APRES)
   sur l'export du 29/09 chargé en lecture seule dans un navigateur de test.
   Vérifie : nombre de lignes par onglet, identité parfaite des données (DB,
   registre, aucun saveData), effectif PAC / effectifEntriesFor identiques,
   mouvements saisis après la bascule affichés, annulation d'un mouvement
   collectif intacte. Aucune donnée réelle modifiée. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR, EXPORT_ORIGINAL, EXPORT_CORRIGE, lireExport, exportPresent } from './lib/config.mjs';
const EXPORTS = { corrige: EXPORT_CORRIGE, original: EXPORT_ORIGINAL };
// URL_AVANT (facultative) : version PRÉCÉDENTE de l'appli servie sur un autre port
// (ex. git archive <commit-avant> www, voir tests/README.md). Sans elle, seuls les
// attendus de la version actuelle sont vérifiés.
const URL_AVANT = process.env.URL_AVANT || null;
const URL_APRES = process.env.URL_APRES || URL_APP;
const browser = await chromium.launch(LAUNCH);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

async function ouvrir(url, data) {
  const page = await browser.newPage();
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.evaluate((data) => {
    DB = migrateData(JSON.parse(JSON.stringify(data)));
    window.__saveCalls = 0;
    const o = saveData;
    saveData = function (...a) { window.__saveCalls++; return o.apply(this, a); };
  }, data);
  return page;
}
// Mouvements de SORTIE affichés par catégorie dans la campagne en cours : la liste de l'écran « Mouvements d'animaux » (mobile ET PC : mouvementsPassesPc + filtrerMouvementsPassesMv).
// Sur la version AVANT (URL_AVANT, ancien écran à 4 onglets) : le nombre de lignes de chaque onglet.
const lignes = (page) => page.evaluate(() => {
  if (typeof inventaireBrebisHtml === 'function') {
    const n = h => (h.match(/class="sheep-item[ "]/g) || []).length;
    return { brebis: n(inventaireBrebisHtml()), beliers: n(inventaireBeliersHtml()), agnelles: n(inventaireAgnellesHtml()), agneaux: n(inventaireAgneauxHtml()) };
  }
  const toutes = mouvementsPassesPc();
  const n = k => filtrerMouvementsPassesMv(toutes, { cats: { [k]: true }, type: '', periode: 'courante', acheteur: '', q: '' }).length;
  return { brebis: n('brebis'), beliers: n('beliers'), agnelles: n('agnelles'), agneaux: n('agneaux') };
});
const empreinte = (page) => page.evaluate(() => ({
  db: JSON.stringify(DB), registre: JSON.stringify(DB.registre), saves: window.__saveCalls,
  effectif: JSON.stringify(['2025-01-01', '2025-10-01', '2026-01-01', '2026-09-28', '2026-10-15'].map(d => [effectifADate('brebis', d), effectifADate('belier', d), effectifADate('agnelle', d)])),
  entries: JSON.stringify(['brebis', 'beliers', 'agnelles'].map(c => effectifEntriesFor(c))),
  registreEntries: JSON.stringify(['brebis', 'beliers', 'agnelles'].map(c => registreEntriesFor(c)))
}));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

for (const [nom, fichier] of Object.entries(EXPORTS)) {
  if (!exportPresent(fichier)) { console.log('SKIP [' + nom + '] : export absent (' + fichier + ')'); continue; }
  const data = lireExport(fichier);
  const avant = URL_AVANT ? await ouvrir(URL_AVANT, data) : null, apres = await ouvrir(URL_APRES, data);
  const la = avant ? await lignes(avant) : null, lb = await lignes(apres);
  console.log('[' + nom + '] lignes AVANT ' + JSON.stringify(la) + '  ->  APRÈS ' + JSON.stringify(lb));
  if (avant) check(eq(la, { brebis: 5, beliers: 4, agnelles: 115, agneaux: 0 }), nom + ' : état avant attendu 5/4/115/0, obtenu ' + JSON.stringify(la));
  // les 115 agnelles entrées à la date de bascule ne sont PAS des sorties : jamais listées (la liste ne contient que des sorties)
  check(lb.agnelles === 0 && lb.agneaux === 0, nom + ' : aucune agnelle ni aucun agneau sorti dans la campagne en cours, obtenu ' + JSON.stringify(lb));
  // Identité des données : le rendu ne touche à rien, et rien ne diffère entre les deux versions
  const ea = avant ? await empreinte(avant) : null, eb = await empreinte(apres);
  await apres.evaluate(() => {
    ['brebis', 'beliers', 'agneaux', 'agnelles'].forEach(c => { mvMobEtat.cat = c; renderInventaire(); });
    mvMobEtat.cat = 'brebis';
  });
  const ec = await empreinte(apres);
  check(eb.db === ec.db && eb.registre === ec.registre && ec.saves === 0, nom + ' : le rendu des 4 catégories ne modifie ni DB ni registre et n\'appelle jamais saveData (saves=' + ec.saves + ')');
  if (ea) {
    check(ea.db === eb.db && ea.registre === eb.registre, nom + ' : DB et registre strictement identiques entre les deux versions');
    check(ea.effectif === eb.effectif && ea.entries === eb.entries && ea.registreEntries === eb.registreEntries, nom + ' : effectifADate (5 dates, 3 catégories), effectifEntriesFor et registreEntriesFor identiques avant/après');
  }
  console.log('OK [' + nom + '] : agnelles 115 -> 0, brebis 5 / béliers 4 / agneaux 0 inchangés ; DB + registre identiques octet pour octet, 0 saveData ; effectif PAC (5 dates) et entrées de registre identiques.');

  if (nom === 'corrige') {
    // ---- mouvements saisis APRÈS la bascule (29/09/2026) ----
    const scenario = async (page) => page.evaluate(() => {
      const actives = DB.brebis.filter(s => (s.statut || 'active') === 'active');
      CATEGORIE_ANIMAL_CONFIG.brebis.applySortie(actives[0], 'Vente', null, 'Acheteur', '2026-10-05');
      const be = DB.beliers.find(b => (b.statut || 'actif') === 'actif');
      CATEGORIE_ANIMAL_CONFIG.beliers.applySortie(be, 'Vente', null, 'Acheteur', '2026-10-05');
      // agnelle vendue APRÈS la bascule, et une autre AVANT
      DB.agnelles = DB.agnelles || [];
      const mkAg = (id, eid) => ({ id, eid, motherEid: null, pere: '', mere: '', sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2026-01-10' }], modesRepro: [] });
      DB.agnelles.push(mkAg('agA', '250016299990001'), mkAg('agB', '250016299990002'));
      CATEGORIE_ANIMAL_CONFIG.agnelles.applySortie(DB.agnelles.find(a => a.id === 'agA'), 'Vente', null, 'Acheteur', '2026-10-06');
      CATEGORIE_ANIMAL_CONFIG.agnelles.applySortie(DB.agnelles.find(a => a.id === 'agB'), 'Vente', null, 'Acheteur', '2026-03-01');
      // agneaux : vendu après (affiché), vendu avant (masqué après), vendu sans date (affiché), mort-né (jamais)
      const mere = actives[1];
      mere.agnelages = mere.agnelages || [];
      const lamb = (eid, sexe, statut, mouv) => ({ eid, sexe, statutFinal: statut, mouvements: mouv });
      mere.agnelages.push({ date: '2026-02-01', campagne: 2025, lambs: [
        lamb('250016299990011', 'Mâle', 'vendu', [{ type: 'Vendu', date: '2026-10-07', acheteur: 'X' }]),
        lamb('250016299990012', 'Mâle', 'vendu', [{ type: 'Vendu', date: '2026-03-01', acheteur: 'X' }]),
        lamb('250016299990013', 'Femelle', 'mort', []),
        { eid: null, sexe: 'Mort-né', mouvements: [] }
      ] });
      return 1;
    });
    const sa = avant ? await scenario(avant).then(() => lignes(avant)) : null, sb = await scenario(apres).then(() => lignes(apres));
    if (sa) check(eq(sa, { brebis: 6, beliers: 5, agnelles: 117, agneaux: 3 }), 'scénario avant attendu 6/5/117/3, obtenu ' + JSON.stringify(sa));
    // après : +1 brebis, +1 bélier, +1 agnelle (celle vendue APRÈS la bascule ; celle vendue avant est masquée), +1 agneau vendu après la bascule (celui vendu avant est masqué ; un agneau « mort » sans mouvement daté n'est pas une ligne de mouvement)
    check(eq(sb, { brebis: lb.brebis + 1, beliers: lb.beliers + 1, agnelles: lb.agnelles + 1, agneaux: lb.agneaux + 1 }), 'scénario après attendu +1 / +1 / +1 / +1 sur ' + JSON.stringify(lb) + ', obtenu ' + JSON.stringify(sb));
    console.log('OK scénario post-bascule : AVANT ' + JSON.stringify(sa) + '  ->  APRÈS ' + JSON.stringify(sb) + ' : vente brebis (+1), vente bélier (+1), agnelle vendue après le 29/09 affichée / avant masquée, agneau vendu après affiché, agneau sans date affiché, agneau vendu avant masqué, mort-né jamais.');
    // les données masquées existent toujours (rien supprimé)
    const intacts = await apres.evaluate(() => ({
      agB: !!(DB.registre.agnelles && Object.values(DB.registre.agnelles).some(e => e && (e.mouvements || []).some(m => m.date === '2026-03-01'))),
      agneauAvant: DB.brebis.some(s => (s.agnelages || []).some(a => a.lambs.some(l => l.eid === '250016299990012')))
    }));
    check(intacts.agB && intacts.agneauAvant, 'les lignes masquées (agnelle vendue avant, agneau vendu avant) doivent rester dans le registre / la fiche');
    console.log('OK masqué n\'est pas supprimé : l\'agnelle vendue le 01/03 reste dans registre.agnelles, l\'agneau vendu le 01/03 reste sur la fiche de sa mère.');

    // ---- annulation d'un mouvement collectif après la bascule ----
    const annul = await apres.evaluate(() => {
      const actives = DB.brebis.filter(s => (s.statut || 'active') === 'active');
      const [a, b] = [actives[2], actives[3]];
      const id = 'MC-test';
      [a, b].forEach(s => CATEGORIE_ANIMAL_CONFIG.brebis.applySortie(s, 'Vente', null, 'Acheteur', '2026-10-08', id));
      DB.mouvementsCollectifs.push({ id, categorie: 'brebis', annulable: true, type: 'Vente', cause: null, acheteur: 'Acheteur', date: '2026-10-08', membres: [a.eid, b.eid], createdAt: Date.now() });
      window.__ids = [a.id, b.id];
      return { statuts: [a.statut, b.statut] };
    });
    const avantAnnul = (await lignes(apres)).brebis;
    check(annul.statuts.every(s => s !== 'active') && (await lignes(apres)).brebis === avantAnnul, 'après le mouvement collectif : 2 brebis sorties');
    await apres.evaluate(() => { mvMobEtat = { cat: 'brebis', type: '', q: '', nb: 20, etendu: false, ouverts: new Set(), message: '' }; render('inventaire'); });
    await apres.waitForSelector('.mm-lot[data-lot="MC-test"] .mm-annuler-lot');   // un mouvement collectif = UNE carte, annulée depuis cette carte
    await apres.click('.mm-lot[data-lot="MC-test"] .mm-annuler-lot');
    await apres.waitForTimeout(250);
    const fin = await apres.evaluate(() => {
      const cibles = window.__ids.map(id => DB.brebis.find(s => s.id === id));
      return { statuts: cibles.map(s => s.statut), mvtRestants: cibles.map(s => (s.mouvements || []).some(m => m.collectifId === 'MC-test')), entree: DB.mouvementsCollectifs.some(m => m.id === 'MC-test') };
    });
    const lignesFin = (await lignes(apres)).brebis;
    check(fin.statuts.every(s => s === 'active') && fin.mvtRestants.every(x => !x) && !fin.entree && lignesFin === avantAnnul - 2, 'annulation : statuts redevenus actifs, mouvements retirés, entrée supprimée, 2 lignes de moins, obtenu ' + JSON.stringify(fin) + ' ' + lignesFin + '/' + avantAnnul);
    console.log('OK annulation d\'un mouvement collectif après la bascule : 2 brebis sorties (une carte), annulation depuis la carte -> statuts actifs, mouvements retirés, lignes revenues à l\'état d\'avant.');
  }
  if (avant) await avant.close();
  await apres.close();
}
console.log('\nTOUS LES TESTS DE L\'AFFICHAGE DES MOUVEMENTS SONT PASSÉS (export du 29/09 en lecture seule, navigateur de test, aucune donnée réelle modifiée)');
await browser.close();
