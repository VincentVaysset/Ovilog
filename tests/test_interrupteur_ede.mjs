/* Interrupteur « Notification EDE » (chantier Documents de circulation en test) : réglage du COMPTE, désactivé par défaut, réservé à l'administrateur
   (document admins/<uid>), rangé dans users/<uid>/reglagesAdmin/chantiers (écriture refusée par le serveur à un compte non administrateur) ;
   une seule fonction, chantierEdeActif(). Faux serveur, deux comptes jetables (éleveur A, administrateur B), n° fictifs.
   1) éleveur A : pas d'onglet Administration ; désactivé = comme avant (N° EDE et son contrôle, adresse en 3 champs ; pas de SIREN, de base locale,
      de « Fiches partenaires », titre « Acheteurs », écran Partenaires inaccessible) ; aucune donnée du chantier écrite ; écriture du réglage refusée
      (appli et serveur) ; 2) valeur inconnue (pas encore lue) = désactivé ; 3) administrateur B : onglet Administration, activer (date « Notifier à partir
      du » = début de la campagne, ligne grise « hors périmètre »), fiche partenaire, désactiver (tout masqué, rien supprimé), renommer l'acheteur
      désactivé, réactiver : fiche reliée au nouveau nom ; date changée enregistrée. */
import { demarrerHarnais } from './lib/harnais_sync.mjs';

const h = await demarrerHarnais();
const { check } = h;
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const preparer = async dev => { await h.attendre(dev, () => currentView === 'premiere-configuration' || currentView === 'home', { label: 'écran d\'arrivée' }); await dev.page.waitForTimeout(200); return dev.page.evaluate(() => {
  DB.campagneDebut = 2027; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { nom: 'Exploitation B', numeroCheptel: 'FR12345678', indicatifMarquage: '000456', adresse: '1 chemin du Test' });
  DB.acheteurs = ['Acheteur C']; saveData(DB); render('home');
}); };
const vueParametres = (dev, tab) => dev.page.evaluate(t => { parametresTab = t; parametresRubrique = t; render('parametres'); }, tab);
const etatEcrans = async dev => {
  await vueParametres(dev, 'exploitation');
  const exp = await dev.page.evaluate(() => ({ libelle: document.querySelector('label[for="f-exp-cheptel"]').textContent, siren: !!document.getElementById('f-exp-siren'), base: !!document.getElementById('prm-ede-base'), cp: !!document.getElementById('f-exp-cp'), commune: !!document.getElementById('f-exp-commune') }));
  await vueParametres(dev, 'listes');
  const lis = await dev.page.evaluate(() => ({ titre: document.querySelector('.prm-liste .prm-titre').textContent, bouton: !!document.getElementById('btn-gerer-partenaires') }));
  await dev.page.evaluate(() => render('partenaires'));
  const vue = await dev.page.evaluate(() => currentView);
  return Object.assign(exp, lis, { vue });
};

try {
  // ================================================================ 1. éleveur A (non administrateur, PC)
  const A = await h.ouvrir({ desktop: true, contexte: { viewport: { width: 1500, height: 950 } } });
  await h.inscrire(A, 'eleveur@example.fr', 'secret1');
  await h.attendre(A, () => !!window.OvilogSync.contactEtat().connecte && window.OvilogSync.reglagesAdmin().connu, { label: 'A connecté, réglages lus' });
  await preparer(A);
  eq(await A.page.evaluate(() => [chantierEdeActif(), window.OvilogSync.contactEtat().estAdmin]), [false, false], 'A : chantier désactivé par défaut, pas administrateur');
  await vueParametres(A, 'exploitation');
  check(!(await A.page.evaluate(() => [...document.querySelectorAll('.tab-bar .tab-btn')].some(b => b.dataset.tab === 'administration'))), 'A : pas d\'onglet Administration');
  const ecransA = await etatEcrans(A);
  eq(ecransA, { libelle: 'N° EDE', siren: false, base: false, cp: true, commune: true, titre: 'Acheteurs', bouton: false, vue: 'parametres' }, 'désactivé : N° EDE et adresse en 3 champs seulement, carte « Acheteurs » comme avant, écran Partenaires inaccessible');
  await vueParametres(A, 'exploitation');
  // (la synchro du compte neuf peut redessiner l'écran juste après l'arrivée : on retape si le champ a été remis à zéro)
  let formatVu = false;
  for (let i = 0; i < 5 && !formatVu; i++) { await A.page.fill('#f-exp-cheptel', '1234567'); formatVu = await A.page.waitForSelector('#prm-ede-format', { state: 'visible', timeout: 1000 }).then(() => true, () => false); }
  check(formatVu, 'désactivé : contrôle du format du N° EDE toujours là');
  await A.page.evaluate(() => { parametresTab = 'administration'; render('parametres'); });
  eq(await A.page.evaluate(() => [!!document.getElementById('card-chantiers'), !!document.getElementById('f-adm-ede')]), [false, false], 'A : rubrique Administration forcée = vide');
  const refusApp = await A.page.evaluate(() => window.OvilogSync.ecrireReglagesAdmin({ notificationEde: true }).then(() => 'écrit', e => 'refusé'));
  eq(refusApp, 'refusé', 'A : l\'appli refuse d\'écrire le réglage');
  const r = await fetch('http://127.0.0.1:' + h.port + '/batch', { method: 'POST', body: JSON.stringify({ uid: A.uid, authUid: A.uid, clientId: 'appareil-A', ops: [{ type: 'set', path: 'users/' + A.uid + '/reglagesAdmin/chantiers', data: { notificationEde: true } }] }) });
  eq(r.status, 403, 'A : écriture directe du réglage refusée par le serveur');
  await A.page.evaluate(() => { DB.acheteurs.push('Acheteur E'); saveData(DB); });
  await h.attendreCalme(A.uid);
  const serveurA = await h.serveur(A.uid, 'listesCompte');
  check(!Object.keys(serveurA.docs || {}).includes('partenairesInfo'), 'désactivé : aucune fiche partenaire écrite au serveur');
  const metaA = await h.serveur(A.uid, 'meta');
  check(metaA.exists && Array.isArray(metaA.data.acheteurs) || metaA.exists, 'document principal présent');
  check(!JSON.stringify(metaA).includes('partenairesInfo'), 'désactivé : aucun champ partenairesInfo dans le document principal');
  eq(Object.keys((await h.serveur(A.uid, 'reglagesAdmin')).docs || {}), [], 'A : aucun réglage administrateur au serveur');
  console.log('OK 1 éleveur : désactivé = comme avant, rien du chantier écrit, réglage refusé (appli et serveur).');

  // ================================================================ 2. valeur inconnue (hors ligne, premier démarrage) = désactivé
  eq(await A.page.evaluate(() => { const vrai = window.OvilogSync.reglagesAdmin; window.OvilogSync.reglagesAdmin = () => ({ connu: false, data: { notificationEde: true } }); const v = [chantierEdeActif(), reglagesAdminCompte()]; window.OvilogSync.reglagesAdmin = vrai; return v; }), [false, null], 'réglage pas encore lu : désactivé');
  console.log('OK 2 valeur inconnue = désactivé.');

  // ================================================================ 3. administrateur B
  const B = await h.ouvrir({ desktop: true, contexte: { viewport: { width: 1500, height: 950 } } });
  await h.inscrire(B, 'admin@example.fr', 'secret1');
  await h.attendre(B, () => !!window.OvilogSync.contactEtat().connecte, { label: 'B connecté' });
  await h.ecrireServeur(B.uid, [{ type: 'set', path: 'admins/' + B.uid, data: { role: 'admin' } }]);
  await B.page.evaluate(() => window.OvilogSync.deconnecterSansVider());
  await h.connecter(B, 'admin@example.fr', 'secret1');
  await h.attendre(B, () => window.OvilogSync.contactEtat().estAdmin === true && window.OvilogSync.reglagesAdmin().connu, { label: 'B administrateur, réglages lus' });
  await preparer(B);
  check(!(await B.page.evaluate(() => chantierEdeActif())), 'B : désactivé par défaut');
  eq(await etatEcrans(B), { libelle: 'N° EDE', siren: false, base: false, cp: true, commune: true, titre: 'Acheteurs', bouton: false, vue: 'parametres' }, 'B désactivé : comme pour tout compte');
  await vueParametres(B, 'exploitation');
  await B.page.click('.tab-bar .tab-btn[data-tab="administration"]');
  const debut = await B.page.evaluate(() => campagneDebutISO(DB.campagneDebut));
  eq(await B.page.evaluate(() => [document.getElementById('f-adm-ede').checked, document.getElementById('f-adm-ede-date').value]), [false, debut], 'Administration : interrupteur éteint, « Notifier à partir du » = début de la campagne');
  await B.page.click('label[for="f-adm-ede"]');
  await h.attendreServeur(B.uid, 'reglagesAdmin', d => d.docs && d.docs.chantiers && d.docs.chantiers.notificationEde === true, 'réglage activé au serveur');
  eq((await h.serveur(B.uid, 'reglagesAdmin')).docs.chantiers.notifierAPartirDu, debut, 'date de référence enregistrée = début de la campagne');
  await h.attendre(B, () => chantierEdeActif() && /hors périmètre/.test(document.getElementById('adm-ede-etat').textContent), { label: 'B : activé, ligne grise' });
  const etat = await B.page.textContent('#adm-ede-etat');
  check(etat.includes('mouvements d\'avant le ' + await B.page.evaluate(d => formatDateFr(d), debut) + ' : hors périmètre'), 'ligne grise « mouvements d\'avant le [date] : hors périmètre » : ' + etat);
  check(await B.page.isVisible('#sup-snack-annuler'), 'bandeau Annuler après activation');
  eq(await etatEcrans(B), { libelle: 'N° EDE', siren: true, base: true, cp: true, commune: true, titre: 'Partenaires', bouton: true, vue: 'partenaires' }, 'activé : SIREN, base locale, Partenaires et leur écran');
  // fiche partenaire, puis désactivation : rien n'est supprimé
  await B.page.evaluate(() => { ecrirePartenaireInfo('Acheteur C', { categorie: 'eleveur', numero: 'FR12345678' }); saveData(DB); });
  await h.attendreServeur(B.uid, 'listesCompte', d => !!(d.docs && d.docs.partenairesInfo), 'fiche partenaire au serveur');
  await vueParametres(B, 'administration');
  await B.page.click('label[for="f-adm-ede"]');
  await h.attendreServeur(B.uid, 'reglagesAdmin', d => d.docs && d.docs.chantiers && d.docs.chantiers.notificationEde === false, 'réglage désactivé au serveur');
  await h.attendre(B, () => !chantierEdeActif(), { label: 'B : désactivé' });
  eq(await etatEcrans(B), { libelle: 'N° EDE', siren: false, base: false, cp: true, commune: true, titre: 'Acheteurs', bouton: false, vue: 'parametres' }, 'désactivé : tout masqué');
  eq(await B.page.evaluate(() => partenaireInfo('Acheteur C').categorie), 'eleveur', 'désactivé : la fiche reste (rien supprimé)');
  // renommer l'acheteur, interrupteur désactivé : la fiche suit le nom
  eq(await B.page.evaluate(() => { const r = renommerValeurListe('acheteurs', 'Acheteur C', 'Acheteur D'); saveData(DB); return r.ok; }), true, 'renommage pendant la désactivation');
  await h.attendreCalme(B.uid);
  // réactivation : tout réapparaît, fiche reliée au nouveau nom
  await vueParametres(B, 'administration');
  await B.page.click('label[for="f-adm-ede"]');
  await h.attendre(B, () => chantierEdeActif(), { label: 'B : réactivé' });
  eq(await B.page.evaluate(() => [partenaireInfo('Acheteur D').categorie, partenaireInfo('Acheteur D').numero, Object.prototype.hasOwnProperty.call(DB.partenairesInfo, 'Acheteur C'), DB.acheteurs]), ['eleveur', 'FR12345678', false, ['Acheteur D']], 'réactivé : fiche reliée au nouveau nom, rien perdu');
  eq((await h.serveur(B.uid, 'reglagesAdmin')).docs.chantiers.notifierAPartirDu, debut, 'réactivation : date de référence gardée');
  await h.attendre(B, () => /hors périmètre/.test((document.getElementById('adm-ede-etat') || {}).textContent || ''), { label: 'écran Administration relu après réactivation' });
  // « Notifier à partir du » changé
  await vueParametres(B, 'administration');
  await B.page.fill('#f-adm-ede-date', '2026-12-01');
  await h.attendreServeur(B.uid, 'reglagesAdmin', d => d.docs && d.docs.chantiers && d.docs.chantiers.notifierAPartirDu === '2026-12-01', 'date changée au serveur');
  await h.attendre(B, () => dateReferenceEde() === '2026-12-01', { label: 'date relue' });
  eq((await h.serveur(B.uid, 'reglagesAdmin')).docs.chantiers.notificationEde, true, 'date changée : interrupteur gardé (écriture fusionnée)');
  eq(await B.page.evaluate(() => [horsPerimetreEde('2026-11-30'), horsPerimetreEde('2026-12-01'), horsPerimetreEde('2027-01-10')]), [true, false, false], 'hors périmètre : mouvements d\'avant la date seulement');
  console.log('OK 3 administrateur : activer (date = début de campagne), fiche, désactiver (rien supprimé), renommer désactivé, réactiver (fiche au nouveau nom), date changée.');

  check(A.erreurs.length === 0 && B.erreurs.length === 0, 'aucune erreur de page : ' + JSON.stringify([A.erreurs, B.erreurs]));
  console.log('OK test_interrupteur_ede');
} finally { await h.fin(); }
