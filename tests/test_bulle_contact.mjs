/* Bulle de contact : deux comptes réels du faux serveur (éleveur A sur mobile, administrateur B sur PC, document admins/<B> posé comme dans la console).
   1) bulle verte : visible sur les écrans de consultation, cachée sur les écrans de saisie / à barre fixe / aux portes d'authentification / clavier ouvert,
      au-dessus du « + » de la liste des brebis, masquable sur l'appareil (Paramètres › Exploitation), aucun bouton sous elle une fois en bas de page ;
   2) panneau : Envoyer seulement avec un type et un texte (2 000 car.), liste FERMÉE des champs envoyés (aucun EID ni n° même sur une fiche brebis) ;
   3) scan : panneau ouvert, un bip n'écrit rien dans l'écran dessous ; fermé, le scan revient au champ ; la bulle ne prend pas le curseur ;
   4) hors réseau : bandeau, « En attente d'envoi », envoi au retour du réseau ;
   5) règles non publiées : « Non envoyé », Renvoyer une fois les règles en place ;
   6) administrateur : onglet « Messages reçus » (absent chez A), Nouveaux / Lus / Traités, toucher = Lu, Répondre (encart vert + pastille rouge chez A, éteinte à
      la lecture), Marquer traité, Supprimer avec confirmation (disparaît aussi chez A) ; 7) déconnexion : plus de bulle. Comptes jetables, aucune donnée réelle. */
import { demarrerHarnais } from './lib/harnais_sync.mjs';

const h = await demarrerHarnais();
const { check } = h;
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const racine = async () => (await (await fetch('http://127.0.0.1:' + h.port + '/snapshot?racine=feedback&test=1')).json()).docs;
const attendreRacine = async (pred, label, timeout = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { const d = await racine(); if (pred(d)) return d; await h.dormir(100); } throw new Error('TIMEOUT serveur : ' + label); };
const bulleVisible = dev => dev.page.evaluate(() => { const b = document.getElementById('bulle-contact'); return getComputedStyle(b).display !== 'none' && !b.classList.contains('hidden'); });
const preparer = async (dev, nom) => { await h.attendre(dev, () => currentView === 'premiere-configuration' || currentView === 'home', { label: 'écran d\'arrivée après connexion' }); await dev.page.waitForTimeout(200); return dev.page.evaluate(n => {
  DB.campagneDebut = 2026; DB.campagneInitialisee = true; DB.exploitation = Object.assign(DB.exploitation || {}, { nom: n, indicatifMarquage: '000456' });
  const eid = k => '250000004560' + String(k).padStart(3, '0');
  DB.brebis = Array.from({ length: 30 }, (_, i) => ({ id: 'b' + i, eid: eid(i + 1), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }));
  saveData(DB); render('home');
}, nom); };

try {
  // ================================================================ comptes : B administrateur (document admins/B posé avant sa connexion), A éleveur
  const B = await h.ouvrir({ desktop: true, contexte: { viewport: { width: 1500, height: 950 } } });
  await h.inscrire(B, 'admin@example.fr', 'secret1');
  await h.attendre(B, () => !!window.OvilogSync.contactEtat().connecte, { label: 'B connecté' });
  await h.ecrireServeur(B.uid, [{ type: 'set', path: 'admins/' + B.uid, data: { role: 'admin' } }]);
  await B.page.evaluate(() => window.OvilogSync.deconnecterSansVider());
  await h.connecter(B, 'admin@example.fr', 'secret1');
  await h.attendre(B, () => window.OvilogSync.contactEtat().estAdmin === true, { label: 'B reconnu administrateur' });
  await preparer(B, 'Ferme du Concepteur');

  const A = await h.ouvrir({ contexte: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } });
  await h.inscrire(A, 'eleveur@example.fr', 'secret1');
  await h.attendre(A, () => !!window.OvilogSync.contactEtat().connecte, { label: 'A connecté' });
  await preparer(A, 'Ferme du Test');
  await h.attendre(A, () => window.OvilogSync.contactEtat().prets, { label: 'A : mes messages lus' });
  eq(await A.page.evaluate(() => [window.OvilogSync.contactEtat().estAdmin, window.OvilogSync.contactEtat().tous.length]), [false, 0], 'A n\'est pas administrateur et ne voit aucun message d\'autrui');

  // ================================================================ 1. où la bulle apparaît
  check(await bulleVisible(A), 'A : bulle visible sur l\'Accueil');
  const geo = await A.page.evaluate(() => { const r = document.getElementById('bulle-contact').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(innerWidth - r.right), Math.round(innerHeight - r.bottom), getComputedStyle(document.getElementById('bulle-contact')).backgroundColor]; });
  eq(geo, [56, 56, 16, 16, 'rgb(53, 127, 75)'], 'bulle verte charte 56 px, en bas à droite');
  const vues = {};
  for (const v of ['list', 'beliers', 'agneaux', 'sanitaire', 'journal', 'parametres', 'registre', 'controle-laitier', 'qualite', 'inventaire', 'lots']) { await A.page.evaluate(x => render(x), v); vues[v] = await bulleVisible(A); }
  check(Object.values(vues).every(Boolean), 'bulle sur les écrans de consultation : ' + JSON.stringify(vues));
  await A.page.evaluate(() => render('list'));
  const fab = await A.page.evaluate(() => { const b = document.getElementById('bulle-contact').getBoundingClientRect(), f = document.getElementById('fab-add').getBoundingClientRect(); return { chevauche: !(b.bottom <= f.top || b.top >= f.bottom || b.right <= f.left || b.left >= f.right), auDessus: b.bottom <= f.top }; });
  eq(fab, { chevauche: false, auDessus: true }, 'liste des brebis : la bulle monte au-dessus du « + »');
  const cachee = {};
  for (const v of ['add-sheep', 'misebas-rapide', 'echo-rapide', 'auth', 'verifier-email', 'premiere-configuration']) { await A.page.evaluate(x => render(x), v); cachee[v] = await bulleVisible(A); }
  eq(Object.values(cachee).filter(Boolean).length, 0, 'bulle cachée sur les écrans de saisie et les portes d\'authentification : ' + JSON.stringify(cachee));
  // barre fixe en bas apparue après le rendu (ex. sélection d'une brebis) : la bulle s'efface
  await A.page.evaluate(() => { render('home'); const d = document.createElement('div'); d.className = 'mn-barre'; d.id = 'barre-test'; document.getElementById('app').appendChild(d); });
  check(!(await bulleVisible(A)), 'barre fixe en bas : bulle effacée');
  await A.page.evaluate(() => document.getElementById('barre-test').remove());
  // champ de scan qui a le curseur dès l'ouverture (liste des brebis) : la bulle reste ; clavier ouvert (la fenêtre perd sa moitié basse) : effacée, puis revient
  await A.page.evaluate(() => render('list'));
  check(await A.page.evaluate(() => { const i = document.getElementById('scan-open'); i.focus(); return document.activeElement === i; }), 'liste des brebis : le champ de scan a le curseur');
  check(await bulleVisible(A), 'champ de scan avec le curseur, sans clavier : bulle visible');
  await A.page.setViewportSize({ width: 390, height: 420 }); await A.page.waitForTimeout(150);
  check(!(await bulleVisible(A)), 'clavier ouvert : bulle effacée');
  await A.page.setViewportSize({ width: 390, height: 844 }); await A.page.waitForTimeout(150);
  check(await bulleVisible(A), 'clavier fermé : bulle revenue');
  // aucun élément cliquable sous la bulle une fois en bas de page, sur mobile et PC
  const sousBulle = dev => dev.page.evaluate(() => {
    window.scrollTo(0, document.scrollingElement.scrollHeight); const b = document.getElementById('bulle-contact').getBoundingClientRect(), trouves = [];
    for (const [x, y] of [[b.left + 4, b.top + 28], [b.right - 4, b.top + 28], [b.left + 28, b.top + 4], [b.left + 28, b.bottom - 4], [b.left + 28, b.top + 28]])
      document.elementsFromPoint(x, y).forEach(e => { if (!e.closest('#bulle-contact') && e.closest('button, a, input, select, textarea, [role="button"], .carte-liste.ouvre')) trouves.push(e.tagName + '.' + e.className); });
    return trouves;
  });
  for (const v of ['home', 'list', 'beliers', 'sanitaire', 'parametres', 'registre', 'qualite', 'inventaire']) { await A.page.evaluate(x => render(x), v); await A.page.waitForTimeout(80); eq(await sousBulle(A), [], 'mobile ' + v + ' : rien de cliquable sous la bulle en bas de page'); }
  for (const v of ['home', 'list', 'beliers', 'sanitaire', 'parametres', 'registre', 'qualite', 'inventaire', 'lots', 'controle-laitier', 'bilan-campagne', 'declaration-annuelle', 'journal']) {
    await B.page.evaluate(x => render(x), v); await B.page.waitForTimeout(80);
    check(await bulleVisible(B), 'PC ' + v + ' : bulle visible');
    eq(await sousBulle(B), [], 'PC ' + v + ' : rien de cliquable sous la bulle en bas de page');
  }
  // masquable sur l'appareil seulement
  await A.page.evaluate(() => { parametresRubrique = 'exploitation'; render('parametres'); });
  await A.page.click('#f-bulle-contact');
  check(!(await bulleVisible(A)) && await A.page.evaluate(() => localStorage.getItem('ovilog_bulle_contact_masquee') === '1'), 'Paramètres : bulle masquée sur cet appareil');
  await A.page.evaluate(() => render('home'));
  check(!(await bulleVisible(A)), 'masquée : absente aussi à l\'Accueil');
  check(await B.page.evaluate(() => { render('home'); return !document.getElementById('bulle-contact').classList.contains('hidden'); }), 'masquage propre à l\'appareil : toujours visible sur le PC de B');
  await A.page.evaluate(() => { parametresRubrique = 'exploitation'; render('parametres'); });
  await A.page.click('#f-bulle-contact');
  await A.page.evaluate(() => render('home'));
  check(await bulleVisible(A), 'réaffichée');
  console.log('OK 1 bulle : écrans de consultation oui, saisie / barre fixe / authentification / clavier non, au-dessus du « + », rien dessous, masquable par appareil.');

  // ================================================================ 2. panneau et envoi : liste fermée des champs
  await A.page.evaluate(() => render('detail', 'b0'));   // fiche brebis : n° et EID à l'écran, rien ne doit partir
  await A.page.evaluate(() => { document.getElementById('bulle-contact').classList.remove('hidden'); });
  await A.page.click('#bulle-contact');
  await A.page.waitForSelector('.contact-panneau');
  check(await A.page.evaluate(() => document.getElementById('contact-envoyer').disabled), 'Envoyer désactivé sans type ni texte');
  const typesUi = await A.page.evaluate(() => [...document.querySelectorAll('.contact-types .opt-btn')].map(b => b.textContent));
  eq(typesUi, ['Bug', 'Question', 'Idée'], 'trois types');
  await A.page.click('.contact-types [data-type="question"]');
  check(await A.page.evaluate(() => document.getElementById('contact-envoyer').disabled), 'Envoyer désactivé sans texte');
  eq(await A.page.evaluate(() => document.getElementById('contact-texte').maxLength), 2000, 'texte limité à 2 000 caractères');
  await A.page.fill('#contact-texte', 'Comment saisir une adoption ?');
  check(await A.page.evaluate(() => /Aucune donnée d'animal/.test(document.querySelector('.contact-joint').textContent)), 'mention des informations jointes');
  await A.page.click('#contact-envoyer');
  check(/Message envoyé/.test(await A.page.textContent('#contact-corps .msg-charte')), 'confirmation « Message envoyé »');
  const docs1 = await attendreRacine(d => Object.keys(d).length === 1, 'message de A reçu');
  const m1 = Object.values(docs1)[0], id1 = Object.keys(docs1)[0];
  eq(Object.keys(m1).sort(), ['appareil', 'campagne', 'date', 'dateServeur', 'ecran', 'exploitation', 'reponse', 'reponseDate', 'reponseLue', 'statut', 'texte', 'type', 'uid', 'version'], 'liste fermée des champs');
  eq([m1.uid, m1.exploitation, m1.type, m1.campagne, m1.ecran, m1.statut, m1.texte], [A.uid, 'Ferme du Test', 'question', '2027', 'Fiche brebis', 'nouveau', 'Comment saisir une adoption ?'], 'contenu du message');
  check(!/\d{5,}/.test(JSON.stringify(Object.assign({}, m1, { uid: '', date: '', dateServeur: '' }))), 'aucun n° ni EID dans le message : ' + JSON.stringify(m1));
  check(id1.startsWith(A.uid + '_'), 'identifiant du message préfixé par le compte');
  console.log('OK 2 envoi : type + texte obligatoires, 2 000 car., champs fermés, écran nommé sans n°, aucune donnée d\'animal.');

  // ================================================================ 3. scan : panneau ouvert = bip ignoré ; fermé = bip vers le champ ; curseur jamais pris
  await A.page.evaluate(() => { fermerPanneauContact(); render('home'); const i = document.createElement('input'); i.id = 'cible-scan'; document.getElementById('app').appendChild(i); setActiveScanTarget(i); });
  await A.page.click('#bulle-contact');
  await A.page.evaluate(() => onEidScanned('250000004560001'));
  eq(await A.page.evaluate(() => [document.getElementById('cible-scan').value, activeScanTarget && activeScanTarget.id]), ['', 'cible-scan'], 'panneau ouvert : le bip n\'écrit rien, la cible de scan est gardée');
  await A.page.click('#contact-fermer');
  await A.page.evaluate(() => onEidScanned('250000004560001'));
  eq(await A.page.evaluate(() => document.getElementById('cible-scan').value), '250000004560001', 'panneau fermé : le bip revient au champ');
  // PC : le toucher de la bulle ne retire pas le curseur du champ en cours
  await B.page.evaluate(() => { render('home'); const i = document.createElement('input'); i.id = 'champ-pc'; document.getElementById('app').appendChild(i); i.focus(); });
  const avant = await B.page.evaluate(() => document.activeElement.id);
  await B.page.dispatchEvent('#bulle-contact', 'pointerdown');
  eq([avant, await B.page.evaluate(() => document.activeElement.id)], ['champ-pc', 'champ-pc'], 'PC : appuyer sur la bulle ne prend pas le curseur');
  console.log('OK 3 scan : ignoré panneau ouvert (cible gardée), rendu au champ à la fermeture ; la bulle ne prend pas le curseur.');

  // ================================================================ 4. hors réseau : bandeau, « En attente d'envoi », envoi au retour
  await h.reseau(A, { coupe: true });
  await A.page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); window.dispatchEvent(new Event('offline')); });
  await A.page.click('#bulle-contact');
  check(/Hors réseau : envoyé au retour de la connexion/.test(await A.page.textContent('#contact-corps')), 'hors réseau : bandeau avant envoi');
  await A.page.click('.contact-types [data-type="bug"]');
  await A.page.fill('#contact-texte', 'Le calendrier ne s\'ouvre pas');
  await A.page.click('#contact-envoyer');
  check(/Hors réseau : envoyé au retour de la connexion/.test(await A.page.textContent('#contact-corps .msg-charte')), 'hors réseau : confirmation ambre');
  await A.page.click('.contact-panneau .tab-btn[data-onglet="mes"]');
  await h.attendre(A, () => /En attente d'envoi/.test(document.getElementById('contact-corps').textContent), { label: 'carte « En attente d\'envoi »' });
  await h.dormir(500);
  eq(Object.keys(await racine()).length, 1, 'hors réseau : rien n\'est encore arrivé au serveur');
  await h.reseau(A, { coupe: false });
  await A.page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }); window.dispatchEvent(new Event('online')); });
  await attendreRacine(d => Object.values(d).some(m => m.type === 'bug'), 'message hors réseau arrivé au retour du réseau');
  await h.attendre(A, () => !/En attente d'envoi/.test(document.getElementById('contact-corps').textContent) && /Envoyé/.test(document.getElementById('contact-corps').textContent), { label: 'carte « Envoyé »' });
  await A.page.click('#contact-fermer');
  console.log('OK 4 hors réseau : bandeau, « En attente d\'envoi », envoyé au retour du réseau.');

  // ================================================================ 5. règles non publiées : « Non envoyé », puis Renvoyer
  await fetch('http://127.0.0.1:' + h.port + '/racine/config', { method: 'POST', body: JSON.stringify({ refuserFeedback: true }) });
  await A.page.click('#bulle-contact');
  await A.page.click('.contact-panneau .tab-btn[data-onglet="nouveau"]');
  await A.page.click('.contact-types [data-type="idee"]');
  await A.page.fill('#contact-texte', 'Un export des pesées');
  await A.page.click('#contact-envoyer');
  await A.page.click('.contact-panneau .tab-btn[data-onglet="mes"]');
  await h.attendre(A, () => /Non envoyé/.test(document.getElementById('contact-corps').textContent), { label: 'carte « Non envoyé »' });
  eq(Object.values(await racine()).filter(m => m.type === 'idee').length, 0, 'refusé : rien sur le serveur');
  await fetch('http://127.0.0.1:' + h.port + '/racine/config', { method: 'POST', body: JSON.stringify({ refuserFeedback: false }) });
  await A.page.click('[data-renvoyer]');
  await attendreRacine(d => Object.values(d).some(m => m.type === 'idee' && m.texte === 'Un export des pesées'), 'message renvoyé');
  await h.attendre(A, () => !/Non envoyé/.test(document.getElementById('contact-corps').textContent), { label: 'plus de « Non envoyé »' });
  await A.page.click('#contact-fermer');
  console.log('OK 5 règles non publiées : « Non envoyé » gardé sur l\'appareil, « Renvoyer » une fois les règles en place.');

  // ================================================================ 6. administrateur : Messages reçus
  check(!(await A.page.evaluate(() => { parametresRubrique = null; render('parametres'); return document.getElementById('app').textContent.includes('Messages reçus'); })), 'A (éleveur) : pas de « Messages reçus »');
  await B.page.evaluate(() => { parametresTab = 'messages'; render('parametres'); });
  await h.attendre(B, () => document.querySelectorAll('#messages-recus .mr-carte').length === 3, { label: 'B : 3 messages nouveaux' });
  const onglets = await B.page.evaluate(() => [...document.querySelectorAll('#messages-recus .tab-btn')].map(b => b.textContent));
  eq(onglets, ['Nouveaux (3)', 'Lus (0)', 'Traités (0)', 'Erreurs (0)'], 'filtres Nouveaux / Lus / Traités, puis Erreurs (rapports automatiques)');
  const pastilles = await B.page.evaluate(() => [...document.querySelectorAll('#messages-recus .mr-carte')].map(c => { const p = c.querySelector('.carte-liste-d .mb-pastille'); return p.textContent + '|' + getComputedStyle(p).backgroundColor; }).sort());
  eq(pastilles, ['Bug|rgb(251, 227, 224)', 'Idée|rgb(251, 238, 215)', 'Question|rgb(230, 240, 250)'], 'pastilles de type : Bug rouge, Question bleu, Idée ambre');
  const carteQ = `#messages-recus .mr-carte[data-id="${id1}"]`;
  const txtQ = (await B.page.textContent(carteQ)).replace(/\s+/g, ' ');
  check(/Ferme du Test/.test(txtQ) && /Navigateur/.test(txtQ) && /Fiche brebis/.test(txtQ) && /version /.test(txtQ) && /Comment saisir une adoption/.test(txtQ), 'carte : exploitation, appareil, écran, version, texte : ' + txtQ);
  // toucher = Lu (la carte reste sous Nouveaux jusqu'au changement de filtre)
  await B.page.click(carteQ + ' .contact-texte');
  await attendreRacine(d => d[id1].statut === 'lu', 'statut lu sur le serveur');
  await h.attendre(B, a => !!document.querySelector(a) && /Lu/.test(document.querySelector(a).textContent), { label: 'carte marquée Lu, toujours affichée', arg: carteQ });
  // répondre
  await B.page.click(carteQ + ' [data-repondre]');
  await B.page.fill('#mr-reponse', 'Fiche de l\'agneau › Mère adoptive.');
  await B.page.click(carteQ + ' [data-envoyer-reponse]');
  await attendreRacine(d => d[id1].reponse === 'Fiche de l\'agneau › Mère adoptive.' && d[id1].reponseLue === false, 'réponse sur le serveur');
  await h.attendre(B, a => { const c = document.querySelector(a); return c && /Votre réponse/.test(c.textContent); }, { label: 'réponse en encart chez B', arg: carteQ });
  // chez A : pastille rouge, panneau ouvert sur « Mes messages », réponse en encart vert, pastille éteinte
  await A.page.evaluate(() => render('home'));
  await h.attendre(A, () => !document.querySelector('#bulle-contact .bulle-contact-pastille').hidden, { label: 'A : pastille rouge (réponse non lue)' });
  eq(await A.page.evaluate(() => getComputedStyle(document.querySelector('#bulle-contact .bulle-contact-pastille')).backgroundColor), 'rgb(163, 58, 49)', 'pastille rouge charte');
  await A.page.click('#bulle-contact');
  check(await A.page.evaluate(() => document.querySelector('.contact-panneau .tab-btn.active').dataset.onglet === 'mes'), 'réponse non lue : le panneau s\'ouvre sur « Mes messages »');
  const encart = await A.page.evaluate(() => { const r = document.querySelector('.contact-reponse'); return r ? [r.textContent.includes('Mère adoptive'), getComputedStyle(r).backgroundColor] : null; });
  eq(encart, [true, 'rgb(227, 243, 230)'], 'réponse affichée en encart vert');
  await attendreRacine(d => d[id1].reponseLue === true, 'réponse marquée lue sur le serveur');
  await h.attendre(A, () => document.querySelector('#bulle-contact .bulle-contact-pastille').hidden, { label: 'pastille éteinte' });
  await A.page.click('#contact-fermer');
  // marquer traité, puis supprimer (confirmation)
  await B.page.click('#messages-recus .tab-btn[data-filtre="lu"]');
  await h.attendre(B, a => !!document.querySelector(a), { label: 'message sous « Lus »', arg: carteQ });
  await B.page.click(carteQ + ' [data-traiter]');
  await attendreRacine(d => d[id1].statut === 'traite', 'statut traité');
  await B.page.click('#messages-recus .tab-btn[data-filtre="traite"]');
  await h.attendre(B, a => !!document.querySelector(a), { label: 'message sous « Traités »', arg: carteQ });
  B.dialogues.length = 0;
  await B.page.click(carteQ + ' [data-supprimer]');
  check(B.dialogues.length === 1 && /Supprimer définitivement/.test(B.dialogues[0]), 'suppression : confirmation demandée');
  await attendreRacine(d => !d[id1], 'message supprimé du serveur');
  await A.page.click('#bulle-contact'); await A.page.click('.contact-panneau .tab-btn[data-onglet="mes"]');
  await h.attendre(A, () => !/Comment saisir une adoption/.test(document.getElementById('contact-corps').textContent), { label: 'supprimé aussi chez A' });
  await A.page.click('#contact-fermer');
  // A ne peut pas faire d'action administrateur
  const idBug = Object.keys(await racine()).find(k => (k.startsWith(A.uid)));
  check(!(await A.page.evaluate(id => window.OvilogSync.adminContact('supprimer', id), idBug)), 'A ne peut pas supprimer');
  console.log('OK 6 administrateur : Nouveaux/Lus/Traités, pastilles de type, toucher = Lu, réponse (encart vert, pastille rouge chez A puis éteinte), traité, suppression confirmée.');

  // ================================================================ 7. déconnexion : plus de bulle
  await A.page.evaluate(() => window.OvilogSync.deconnecterSansVider());
  await h.attendre(A, () => document.getElementById('bulle-contact').classList.contains('hidden'), { label: 'bulle cachée après déconnexion' });
  eq(await A.page.evaluate(() => window.OvilogSync.contactEtat().mes.length), 0, 'déconnexion : messages oubliés');
  console.log('OK 7 déconnexion : bulle et messages retirés.');

  check(A.erreurs.length === 0 && B.erreurs.length === 0, 'aucune erreur de page : ' + JSON.stringify([A.erreurs, B.erreurs]));
  console.log('OK test_bulle_contact');
} finally { await h.fin(); }
