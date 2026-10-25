/* Taille du document principal (meta) du compte, plafonné à 1 Mo par Firestore : mesure seule, rien n'est modifié dans les données.
   1) mesure exacte (règle Firestore : chaîne = octets UTF-8 + 1, nombre 8, objet = noms des champs + valeurs) ;
   2) compte léger : aucun message ; détail « … sur 1 Mo » + 5 plus grosses rubriques dans Paramètres › Sauvegarde, pour l'administrateur seulement (PC) ;
   3) 70 % : message ambre pour l'éleveur (Accueil et Sauvegarde) ; 90 % : message rouge ;
   4) au-delà de 1 Mo, le faux serveur refuse l'écriture comme Firestore : « Synchro bloquée » à l'écran (plus seulement au journal technique), jamais d'alert() ;
      le document redescend, l'écriture passe et le message disparaît. Comptes jetables, aucune donnée réelle. */
import { demarrerHarnais } from './lib/harnais_sync.mjs';

const h = await demarrerHarnais();
const { check } = h;
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const preparer = async (dev, nom) => { await h.attendre(dev, () => currentView === 'premiere-configuration' || currentView === 'home', { label: 'écran d\'arrivée après connexion' }); await dev.page.waitForTimeout(200); return dev.page.evaluate(n => {
  DB.campagneDebut = 2026; DB.campagneInitialisee = true; DB.exploitation = Object.assign(DB.exploitation || {}, { nom: n, indicatifMarquage: '000456' });
  saveData(DB); render('home');
}, nom); };
// Remplit une rubrique sans effet sur les écrans testés (journalRegistre) jusqu'à la part voulue du plafond, puis redessine l'écran sans le cache de 30 s
const remplir = (dev, part) => dev.page.evaluate(p => {
  DB.journalRegistre = [];
  const base = window.OvilogSync.mesureMeta().total;
  const reste = Math.max(0, Math.round(p * 1048576) - base - 40);
  if (reste > 0) DB.journalRegistre = [{ note: 'x'.repeat(reste) }];
  saveData(DB); cacheTailleMeta = null;
  return Math.round(window.OvilogSync.mesureMeta().total / 1048576 * 1000) / 10;
}, part);
const alerte = (dev, vue) => dev.page.evaluate(v => { cacheTailleMeta = null; if (v === 'sauvegarde') { parametresRubrique = 'sauvegarde'; render('parametres'); } else render(v); const a = document.getElementById('alerte-taille-meta'); return a ? [a.className.replace('msg-charte ', ''), a.querySelector('b').textContent] : null; }, vue);

try {
  const B = await h.ouvrir({ desktop: true, contexte: { viewport: { width: 1500, height: 950 } } });
  await h.inscrire(B, 'admin@example.fr', 'secret1');
  await h.attendre(B, () => !!window.OvilogSync.contactEtat().connecte, { label: 'B connecté' });
  await h.ecrireServeur(B.uid, [{ type: 'set', path: 'admins/' + B.uid, data: { role: 'admin' } }]);
  await B.page.evaluate(() => window.OvilogSync.deconnecterSansVider());
  await h.connecter(B, 'admin@example.fr', 'secret1');
  await h.attendre(B, () => window.OvilogSync.contactEtat().estAdmin === true, { label: 'B reconnu administrateur' });
  await preparer(B, 'Ferme du Concepteur');

  const A = await h.ouvrir({ contexte: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } });
  A.page.on('dialog', d => { throw new Error('FAIL: boîte native inattendue : ' + d.message()); });
  await h.inscrire(A, 'eleveur@example.fr', 'secret1');
  await h.attendre(A, () => !!window.OvilogSync.contactEtat().connecte, { label: 'A connecté' });
  await preparer(A, 'Ferme du Test');

  // ================================================================ 1. mesure exacte (règle Firestore)
  const exacte = await A.page.evaluate(() => {
    const avant = JSON.stringify(DB.journalRegistre);
    DB.journalRegistre = ['a'.repeat(1000)];
    const r1 = window.OvilogSync.mesureMeta().rubriques.find(r => r.cle === 'journalRegistre').octets;
    DB.journalRegistre = [{ n: 3, texte: 'été' }];
    const r2 = window.OvilogSync.mesureMeta().rubriques.find(r => r.cle === 'journalRegistre').octets;
    DB.journalRegistre = JSON.parse(avant);
    return [r1, r2];
  });
  // « journalRegistre » = 15 octets + 1 ; [chaîne de 1000] = 1001 ; { n: 3, texte: 'été' } = (1+1+8) + (5+1 + 5+1)
  eq(exacte, [16 + 1001, 16 + 10 + 12], 'mesure : octets UTF-8 + 1 par chaîne, 8 par nombre, noms des champs comptés');
  console.log('OK 1 mesure selon la règle Firestore (accents sur 2 octets, noms des champs, nombres).');

  // ================================================================ 2. compte léger : rien pour l'éleveur, détail pour l'administrateur seulement
  eq(await alerte(A, 'home'), null, 'compte léger : aucun message sur l\'Accueil');
  eq(await alerte(A, 'sauvegarde'), null, 'compte léger : aucun message dans Sauvegarde');
  check(!(await A.page.$('#bloc-taille-meta')), 'éleveur : pas de détail de taille');
  await B.page.evaluate(() => { parametresRubrique = 'sauvegarde'; render('parametres'); const t = document.querySelector('.pc-onglets [data-key="sauvegarde"], [data-tab="sauvegarde"]'); if (t) t.click(); });
  await B.page.waitForTimeout(150);
  const detail = await B.page.evaluate(() => { const t = document.getElementById('taille-meta-total'); return t ? [/^\d+ Ko sur 1 Mo · \d+ %$/.test(t.textContent.trim()), document.querySelectorAll('#taille-meta-rubriques li').length] : null; });
  eq(detail, [true, 5], 'administrateur (PC) : « … Ko sur 1 Mo · … % » et les 5 plus grosses rubriques');
  console.log('OK 2 compte léger : aucun message ; détail réservé à l\'administrateur dans Paramètres › Sauvegarde.');

  // ================================================================ 3. seuils : 70 % ambre, 90 % rouge
  const p75 = await remplir(A, 0.75);
  eq(await alerte(A, 'home'), ['alerte', 'Données du compte : ' + Math.round(p75) + ' % de la place'], 'à ' + p75 + ' % : message ambre sur l\'Accueil');
  eq((await alerte(A, 'sauvegarde'))[0], 'alerte', 'à ' + p75 + ' % : message ambre dans Sauvegarde');
  const p92 = await remplir(A, 0.92);
  eq(await alerte(A, 'home'), ['bloc', 'Données du compte presque pleines (' + Math.round(p92) + ' %)'], 'à ' + p92 + ' % : message rouge');
  console.log('OK 3 seuils : ambre à ' + p75 + ' %, rouge à ' + p92 + ' %.');

  // ================================================================ 4. au-delà de 1 Mo : écriture refusée, signalée à l'écran ; puis retour à la normale
  await remplir(A, 1.05);
  await h.attendre(A, () => window.OvilogSync.mesureMeta().refusTaille === true, { label: 'refus de taille reçu du serveur', timeout: 20000 });
  eq(await alerte(A, 'home'), ['bloc', 'Synchro bloquée : données du compte trop volumineuses'], 'refus de Firestore : « Synchro bloquée » sur l\'Accueil');
  eq((await alerte(A, 'sauvegarde'))[1], 'Synchro bloquée : données du compte trop volumineuses', 'refus : même message dans Sauvegarde');
  await remplir(A, 0.1);
  await h.attendre(A, () => window.OvilogSync.mesureMeta().refusTaille === false, { label: 'écriture de nouveau acceptée', timeout: 30000 });
  eq(await alerte(A, 'home'), null, 'document redescendu : écriture acceptée, message disparu');
  console.log('OK 4 au-delà de 1 Mo : refus signalé à l\'écran (sans boîte native) ; message retiré dès que l\'écriture repasse.');

  console.log('OK test_taille_meta');
} finally {
  await h.fin();
}
