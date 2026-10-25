/* Isolation entre comptes sur un même appareil. La base locale n'est pas rattachée à un compte : sans garde-fou, un deuxième compte créé sur le même appareil recevait la
   configuration et les fiches du premier. Vrai code applicatif, faux backend Firestore local, comptes jetables, aucune donnée réelle.
   A. A se déconnecte (appareil appairé) -> fichier « avant-deconnexion » contenant ses données, base locale vidée (fiches, lots, exploitation, clés de synchro, drapeau d'appairage),
      réglages du lecteur conservés ; B s'inscrit sur le même appareil -> compte VIDE (assistant de première configuration), rien de A n'arrive sur le serveur de B ; A se reconnecte et retrouve tout.
   B. Appli arrêtée sans déconnexion (base locale de A + drapeau d'appairage de A) : C s'inscrit -> sauvegarde « avant-changement-de-compte », base vidée, rien de A chez C.
   C. Appareil jamais appairé (données locales d'avant le cloud, aucun drapeau) : le comportement d'origine est conservé (le premier compte adopte ces données).
   D. Garde-fou : une écriture vers un compte différent du propriétaire de la base locale est refusée. */
import { demarrerHarnais, peuplerCompte } from './lib/harnais_sync.mjs';
import { readFileSync } from 'fs';

const h = await demarrerHarnais();
const { check } = h;
const MDP = 'AuditTest12345!';
const email = tag => 'iso-' + tag + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '@ovilog-audit-jetable.test';
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));

// Suit les téléchargements (les sauvegardes sur navigateur sont des téléchargements) ; garde le contenu JSON pour les vérifier.
function suivreTelechargements(dev) {
  dev.fichiers = [];
  dev.page.on('download', async d => { try { const chemin = await d.path(); dev.fichiers.push({ nom: d.suggestedFilename(), contenu: chemin ? JSON.parse(readFileSync(chemin, 'utf8')) : null }); } catch (e) { dev.fichiers.push({ nom: d.suggestedFilename(), contenu: null }); } });
}
const stockage = dev => dev.page.evaluate(() => {
  const cles = []; for (let i = 0; i < localStorage.length; i++) cles.push(localStorage.key(i));
  const base = JSON.parse(localStorage.getItem('troupeau_data_v1') || 'null') || {};
  return { cles, brebis: (base.brebis || []).length, lots: (base.lots || []).length, nom: (base.exploitation || {}).nom || '', acheteurs: base.acheteurs || [], lecteur: base.lecteurBluetooth || null, proprietaire: localStorage.getItem('ovilog_sync_bootstrapped_uid') };
});
// Le test pose un marqueur dans la page AVANT l'action qui la recharge ; la page rechargée ne l'a plus.
async function attendreRechargement(dev, label) {
  const debut = Date.now();
  while (Date.now() - debut < 30000) {
    try { if (await dev.page.evaluate(() => !window.__avantRechargement && !!window.OvilogSync && typeof currentView !== 'undefined' && document.readyState === 'complete')) return; } catch (e) { /* navigation en cours */ }
    await dev.page.waitForTimeout(150);
  }
  throw new Error('TIMEOUT en attendant : ' + (label || 'page rechargée'));
}
const marquer = dev => dev.page.evaluate(() => { window.__avantRechargement = true; });

// ================= A. déconnexion de A, inscription de B sur le même appareil =================
{
  const dev = await h.ouvrir({ desktop: true });
  suivreTelechargements(dev);
  const mailA = email('a'), mailB = email('b');
  await h.inscrire(dev, mailA, MDP);
  await h.attendre(dev, () => window.OvilogSync.getState().loggedIn, { label: 'A connecté' });
  const uidA = dev.uid;
  await peuplerCompte(h, dev);
  await dev.page.evaluate(() => { DB.lecteurBluetooth = { address: 'AA:BB:CC:DD:EE:FF', name: 'Bâton test' }; DB.lecteurOptions = { reconnexionAuto: true, bip: true }; saveData(DB); });
  const avant = await stockage(dev);
  check(avant.brebis === 3 && avant.proprietaire === uidA, 'A : 3 brebis en local et appareil appairé à A : ' + JSON.stringify(avant));

  // déconnexion (le test appelle directement logout : la confirmation de l'écran Paramètres est un simple oui/non en amont)
  await marquer(dev);
  await dev.page.evaluate(() => { window.OvilogSync.logout(); });
  await attendreRechargement(dev, 'rechargement après déconnexion');
  await h.dormir(500);
  const sauv = dev.fichiers.find(f => /^avant-deconnexion-/.test(f.nom));
  check(sauv, 'A : une sauvegarde « avant-deconnexion » a été enregistrée avant le vidage : ' + JSON.stringify(dev.fichiers.map(f => f.nom)));
  check(sauv.contenu && sauv.contenu.brebis.length === 3 && sauv.contenu.exploitation.nom === 'GAEC du Compte' && (sauv.contenu.lots || []).some(l => l.id === 'LC'), 'A : la sauvegarde contient bien ses 3 brebis, son exploitation et son lot');
  const apres = await stockage(dev);
  check(apres.brebis === 0 && apres.lots === 0 && apres.nom === '' && apres.acheteurs.length === 0 && apres.proprietaire === null, 'A : base locale vidée (fiches, lots, exploitation, drapeau d\'appairage) : ' + JSON.stringify(apres));
  check(!apres.cles.some(k => /^ovilog_sync_(connu|last_synced)_/.test(k) || k === 'ovilog_sync_journal' || /^ovilog_lot_trouvees_/.test(k) || k === 'ovilog_pre_campagne_snapshot'), 'A : clés de synchro et de lots supprimées : ' + apres.cles.join(','));
  eq(apres.lecteur, { address: 'AA:BB:CC:DD:EE:FF', name: 'Bâton test' }, 'A : réglage du lecteur (propre à l\'appareil) conservé');
  eq(await dev.page.evaluate(() => currentView), 'auth', 'A : retour sur l\'écran de connexion');

  // B s'inscrit sur LE MÊME appareil
  await h.inscrire(dev, mailB, MDP);
  await h.attendre(dev, () => window.OvilogSync.getState().loggedIn && currentView === 'premiere-configuration', { label: 'B : compte vide, assistant de première configuration', timeout: 30000 });
  const uidB = dev.uid;
  check(uidB && uidB !== uidA, 'B a son propre uid');
  const b = await dev.page.evaluate(() => ({ brebis: DB.brebis.length, lots: DB.lots.length, nom: DB.exploitation.nom, acheteurs: DB.acheteurs, mortalite: DB.causesMortalite }));
  eq(b, { brebis: 0, lots: 0, nom: '', acheteurs: [], mortalite: [] }, 'B voit un compte VIDE (aucune fiche, aucun lot, aucune configuration de A)');
  await h.attendreCalme(uidB);
  const metaB = await h.serveur(uidB, 'meta'), brebisB = await h.serveur(uidB, 'brebis'), lotsB = await h.serveur(uidB, 'evenementsLots');
  const tout = JSON.stringify([metaB, brebisB, lotsB, await h.journal(uidB)]);
  check(Object.keys(brebisB.docs || {}).length === 0 && Object.keys(lotsB.docs || {}).length === 0, 'B : aucune brebis ni évènement de lot sur son serveur');
  check(!/GAEC du Compte|Acheteur C|Maladie|"LC"|25000001219/.test(tout), 'B : rien de A (nom, acheteur, cause de mortalité, lot, EID) n\'a été écrit sur le compte de B');

  // A se reconnecte et retrouve tout depuis son compte
  await marquer(dev);
  await dev.page.evaluate(() => { window.OvilogSync.logout(); });
  await attendreRechargement(dev, 'rechargement après la déconnexion de B');
  await h.connecter(dev, mailA, MDP);
  await h.attendre(dev, () => window.OvilogSync.getState().loggedIn && currentView === 'home' && DB.brebis.length === 3 && DB.lots.some(l => l.id === 'LC') && DB.exploitation.nom === 'GAEC du Compte', { label: 'A retrouve ses données', timeout: 30000 });
  check((await h.serveur(uidA, 'brebis')) && Object.keys((await h.serveur(uidA, 'brebis')).docs).length === 3, 'A : ses 3 brebis sont toujours sur son serveur');
  console.log('OK A : sauvegarde puis vidage à la déconnexion, réglage du lecteur gardé, B voit un compte vide et rien de A n\'arrive chez lui, A retrouve ses données.');
}

// ================= B. appli arrêtée sans déconnexion : la base locale de A est encore là quand C s'inscrit =================
{
  const dev = await h.ouvrir({ desktop: true });
  suivreTelechargements(dev);
  await dev.page.evaluate(() => {
    DB.brebis = [{ id: 'resteA', eid: '250000012199999', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [], controleLaitier: [], modesRepro: [] }];
    DB.exploitation.nom = 'GAEC de A (reste)'; DB.acheteurs = ['AcheteurDeA'];
    saveData(DB);
    localStorage.setItem('ovilog_sync_bootstrapped_uid', 'uid-de-A-hors-ligne');
  });
  const mailC = email('c');
  await marquer(dev);
  await h.inscrire(dev, mailC, MDP).catch(() => {});
  await attendreRechargement(dev, 'rechargement du garde-fou');
  // Le faux SDK ne conserve pas la session d'un rechargement à l'autre (le vrai Firebase la conserve) : on se reconnecte avec le compte C.
  if (!(await dev.page.evaluate(() => window.OvilogSync.getState().loggedIn))) await h.connecter(dev, mailC, MDP);
  await h.attendre(dev, () => window.OvilogSync.getState().loggedIn && currentView === 'premiere-configuration', { label: 'C : compte vide', timeout: 30000 });
  const uidC = dev.uid || await dev.page.evaluate(() => null);
  const c = await dev.page.evaluate(() => ({ brebis: DB.brebis.length, nom: DB.exploitation.nom, acheteurs: DB.acheteurs }));
  eq(c, { brebis: 0, nom: '', acheteurs: [] }, 'C : compte vide malgré la base locale laissée par A');
  const sauv = dev.fichiers.find(f => /^avant-changement-de-compte-/.test(f.nom));
  check(sauv && sauv.contenu && sauv.contenu.brebis.length === 1 && sauv.contenu.exploitation.nom === 'GAEC de A (reste)', 'C : la base laissée par A a été sauvegardée (« avant-changement-de-compte ») avant d\'être vidée : ' + JSON.stringify(dev.fichiers.map(f => f.nom)));
  if (uidC) { await h.attendreCalme(uidC); check(!/GAEC de A|AcheteurDeA|250000012199999/.test(JSON.stringify([await h.serveur(uidC, 'meta'), await h.serveur(uidC, 'brebis'), await h.journal(uidC)])), 'C : rien de A sur le serveur de C'); }
  console.log('OK B : changement de compte détecté à la connexion (base laissée par un autre compte) : sauvegarde, vidage, compte vide.');
}

// ================= C. appareil jamais appairé : comportement d'origine conservé =================
{
  const dev = await h.ouvrir({ desktop: true });
  await dev.page.evaluate(() => {
    DB.campagneDebut = 2026; DB.campagneInitialisee = true;
    DB.brebis = [{ id: 'localeAvantCloud', eid: '250000012188888', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [], controleLaitier: [], modesRepro: [] }];
    DB.acheteurs = ['AcheteurLocal']; DB.exploitation.nom = 'Élevage d\'avant le cloud'; saveData(DB);
  });
  check(await dev.page.evaluate(() => localStorage.getItem('ovilog_sync_bootstrapped_uid')) === null, 'D : aucun propriétaire connu');
  await h.inscrire(dev, email('d'), MDP);
  await h.attendre(dev, () => window.OvilogSync.getState().loggedIn, { label: 'D connecté' });
  await h.attendreServeur(dev.uid, 'brebis', r => Object.keys(r.docs).length === 1, 'les données locales d\'avant le cloud sont adoptées par le premier compte', 30000);
  check(await dev.page.evaluate(() => DB.brebis.length === 1 && DB.exploitation.nom === 'Élevage d\'avant le cloud'), 'D : la fiche locale reste en place');
  console.log('OK C : un appareil jamais appairé garde le comportement d\'origine (les données locales d\'avant le cloud sont adoptées).');
}

// ================= D. garde-fou d'écriture =================
{
  const dev = await h.ouvrir({ desktop: true });
  await h.inscrire(dev, email('e'), MDP);
  await h.attendre(dev, () => window.OvilogSync.getState().loggedIn, { label: 'E connecté' });
  await h.attendreCalme(dev.uid);
  const avant = (await h.journal(dev.uid)).length;
  await dev.page.evaluate(() => {
    localStorage.setItem('ovilog_sync_bootstrapped_uid', 'un-autre-compte');   // la base locale est déclarée appartenir à un autre compte
    DB.acheteurs = ['NeDoitPasPartir']; saveData(DB);
  });
  await h.dormir(2500);
  const apres = await h.journal(dev.uid);
  check(apres.length === avant && !JSON.stringify(apres).includes('NeDoitPasPartir'), 'D : aucune écriture vers un compte différent du propriétaire de la base locale (' + avant + ' -> ' + apres.length + ')');
  console.log('OK D : le garde-fou refuse d\'écrire vers un autre compte.');
}

await h.fin();
console.log('OK test_isolation_comptes');
