/* Vérification de l'adresse e-mail (PC et mobile), vrai code applicatif sur le faux serveur local, qui applique ici la règle Firestore « email_verified »
   (un jeton non vérifié ne peut rien écrire). Comptes jetables, aucune donnée réelle.
   1. Inscription : un e-mail de vérification est envoyé (une fois), l'écran « Vérifiez votre e-mail » s'affiche (adresse, « J'ai vérifié », « Renvoyer l'e-mail »
      désactivé 60 s, « Se déconnecter »), ni en-tête ni menu ; rien n'est lu ni écrit sur le compte.
   2. « J'ai vérifié » sans avoir vérifié : message ambre, on reste sur l'écran, rien n'est écrit.
   3. Session non vérifiée retrouvée au démarrage : même écran, rien n'est écrit ; « Renvoyer l'e-mail » renvoie (2e envoi) puis se désactive.
   4. Sans réseau, « J'ai vérifié » : message clair, rien ne casse.
   5. Adresse vérifiée puis « J'ai vérifié » : user.reload() puis getIdToken(true) (jeton rafraîchi), l'appli se charge (première configuration d'un compte neuf),
      le compte est créé sur le serveur (accepté parce que le jeton porte la vérification).
   6. « Se déconnecter » ramène à la connexion. 7. Un compte déjà vérifié se connecte sans voir l'écran. */
import { demarrerHarnais } from './lib/harnais_sync.mjs';

const h = await demarrerHarnais();
const { check } = h;
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const base = 'http://127.0.0.1:' + h.port;
const post = (chemin, corps) => fetch(base + chemin, { method: 'POST', body: JSON.stringify(corps) }).then(r => r.json());
const etatServeur = uid => fetch(base + '/auth/user?uid=' + uid).then(r => r.json());
const MDP = 'AuditTest12345!';
const email = tag => 'verif-' + tag + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '@ovilog-audit-jetable.test';
await post('/auth/config', { exigerVerification: true });

const ecran = dev => dev.page.evaluate(() => {
  const e = document.getElementById('verifier-email-ecran'), m = document.getElementById('verifier-email-msg');
  return { vue: currentView, ecran: !!e, titre: e ? e.querySelector('.attente-titre').textContent : null, adresse: e ? document.getElementById('verifier-email-adresse').textContent : null,
    verifie: document.getElementById('btn-email-verifie') ? document.getElementById('btn-email-verifie').textContent : null,
    renvoyer: document.getElementById('btn-renvoyer-email') ? [document.getElementById('btn-renvoyer-email').textContent, document.getElementById('btn-renvoyer-email').disabled, getComputedStyle(document.getElementById('btn-renvoyer-email')).backgroundColor] : null,
    deconnexion: document.getElementById('btn-deconnexion-verification') ? document.getElementById('btn-deconnexion-verification').textContent : null,
    principal: e ? getComputedStyle(document.getElementById('btn-email-verifie')).backgroundColor : null,
    msg: m && !m.classList.contains('hidden') ? { classe: m.className, texte: m.textContent, fond: getComputedStyle(m).backgroundColor } : null,
    entete: getComputedStyle(document.querySelector('header')).display, menu: getComputedStyle(document.getElementById('nav-drawer-overlay')).display, porteAuth: document.body.classList.contains('porte-auth'),
    connecte: window.OvilogSync.getState().loggedIn };
});
const rienEcrit = async (uid, qui) => { eq((await h.journal(uid)).length, 0, qui + ' : aucune écriture reçue par le serveur'); const meta = await h.serveur(uid, 'meta'); check(!meta.exists, qui + ' : aucun compte créé sur le serveur'); };

for (const pc of [true, false]) {
  const nom = pc ? 'PC' : 'MOBILE';
  const mail = email(pc ? 'pc' : 'mob');
  const dev = await h.ouvrir({ desktop: pc, contexte: { viewport: pc ? { width: 1300, height: 900 } : { width: 390, height: 844 } } });
  await dev.page.evaluate(() => localStorage.setItem('__fakePersister', '1'));   // session retrouvée au rechargement, comme le vrai SDK
  // 1. inscription
  await h.inscrire(dev, mail, MDP);
  await h.attendre(dev, () => currentView === 'verifier-email', { label: nom + ' : écran de vérification' });
  await h.attendre(dev, () => !!document.getElementById('btn-renvoyer-email') && document.getElementById('btn-renvoyer-email').disabled, { label: nom + ' : renvoi désactivé après le premier envoi' });
  const e1 = await ecran(dev);
  check(e1.ecran && e1.titre === 'Vérifiez votre e-mail' && e1.adresse === mail && e1.verifie === "J'ai vérifié" && e1.deconnexion === 'Se déconnecter', nom + ' : écran « Vérifiez votre e-mail » complet : ' + JSON.stringify(e1));
  eq(e1.renvoyer, ["Renvoyer l'e-mail", true, 'rgb(217, 207, 184)'], nom + ' : « Renvoyer l\'e-mail » désactivé juste après l\'envoi');
  eq([e1.principal, e1.entete, e1.menu === 'none' || !pc, e1.porteAuth, e1.connecte], ['rgb(53, 127, 75)', 'none', true, true, false], nom + ' : bouton principal vert, ni en-tête ni menu, compte pas chargé');
  eq((await etatServeur(dev.uid)).envois, 1, nom + ' : un e-mail de vérification envoyé à l\'inscription');
  await h.dormir(800); await rienEcrit(dev.uid, nom + ' (inscription)');
  // 2. « J'ai vérifié » sans avoir vérifié
  await dev.page.click('#btn-email-verifie');
  await h.attendre(dev, () => !document.getElementById('verifier-email-msg').classList.contains('hidden'), { label: nom + ' : message' });
  const e2 = await ecran(dev);
  check(e2.vue === 'verifier-email' && /alerte/.test(e2.msg.classe) && e2.msg.fond === 'rgb(251, 238, 215)' && /pas encore confirmée/.test(e2.msg.texte), nom + ' : pas encore vérifiée = message ambre, on reste : ' + JSON.stringify(e2.msg));
  await rienEcrit(dev.uid, nom + ' (J\'ai vérifié trop tôt)');
  // 3. session non vérifiée retrouvée au démarrage, puis « Renvoyer l'e-mail »
  await dev.page.reload({ waitUntil: 'load' });
  await h.attendre(dev, () => currentView === 'verifier-email', { label: nom + ' : écran au démarrage' });
  const e3 = await ecran(dev);
  check(e3.adresse === mail && !e3.connecte, nom + ' : session non vérifiée au démarrage = écran de vérification, compte pas chargé : ' + JSON.stringify(e3));
  eq(e3.renvoyer, ["Renvoyer l'e-mail", false, 'rgb(255, 255, 255)'], nom + ' : après redémarrage, « Renvoyer l\'e-mail » disponible');
  await dev.page.click('#btn-renvoyer-email');
  await h.attendre(dev, () => /renvoyé/.test(document.getElementById('verifier-email-msg').textContent), { label: nom + ' : renvoi confirmé' });
  const e3b = await ecran(dev);
  check(/ok/.test(e3b.msg.classe) && e3b.renvoyer[1] === true, nom + ' : « E-mail renvoyé » (vert), bouton désactivé : ' + JSON.stringify(e3b));
  eq((await etatServeur(dev.uid)).envois, 2, nom + ' : deuxième e-mail envoyé');
  await rienEcrit(dev.uid, nom + ' (redémarrage)');
  // 4. sans réseau
  await h.reseau(dev, { coupe: true });
  await dev.page.click('#btn-email-verifie');
  await h.attendre(dev, () => /réseau/.test(document.getElementById('verifier-email-msg').textContent), { label: nom + ' : message hors ligne' });
  check((await ecran(dev)).vue === 'verifier-email', nom + ' : sans réseau, on reste sur l\'écran');
  await h.reseau(dev, { coupe: false });
  // 5. vérification faite, puis « J'ai vérifié »
  await post('/auth/verifier', { email: mail });
  await dev.page.click('#btn-email-verifie');
  await h.attendre(dev, () => currentView === 'premiere-configuration' && window.OvilogSync.getState().loggedIn, { label: nom + ' : appli chargée', timeout: 30000 });
  check((await dev.page.evaluate(() => window.__fakeIdTokenForce || 0)) >= 1, nom + ' : jeton rafraîchi (getIdToken(true)) avant le chargement');
  await h.attendreServeur(dev.uid, 'meta', r => r.exists && r.data, nom + ' : compte créé sur le serveur après vérification');
  const meta = await h.serveur(dev.uid, 'meta');
  eq([meta.data.bilanEconomiqueActif, meta.data.bilanEconomiqueDisponible], [false, false], nom + ' : compte neuf initialisé normalement');
  console.log('OK ' + nom + ' : inscription → e-mail envoyé, écran, rien d\'écrit ; trop tôt (ambre) ; redémarrage ; renvoi ; hors ligne ; vérifié → jeton rafraîchi, appli chargée, compte créé.');
  // 6. « Se déconnecter »
  const mail2 = email('dec' + (pc ? 'pc' : 'mob'));
  await dev.page.evaluate(() => localStorage.removeItem('__fakePersister'));
  const dev2 = await h.ouvrir({ desktop: pc, contexte: { viewport: pc ? { width: 1300, height: 900 } : { width: 390, height: 844 } } });
  await h.inscrire(dev2, mail2, MDP);
  await h.attendre(dev2, () => currentView === 'verifier-email', { label: nom + ' : écran (compte 2)' });
  await dev2.page.click('#btn-deconnexion-verification');
  await h.attendre(dev2, () => currentView === 'auth' && !!document.getElementById('btn-auth-submit'), { label: nom + ' : retour à la connexion' });
  await rienEcrit(dev2.uid, nom + ' (Se déconnecter)');
  // 7. compte vérifié : connexion directe, sans l'écran
  await post('/auth/verifier', { email: mail2 });
  await h.connecter(dev2, mail2, MDP);
  await h.attendre(dev2, () => ['premiere-configuration', 'home'].includes(currentView) && window.OvilogSync.getState().loggedIn, { label: nom + ' : compte vérifié chargé', timeout: 30000 });
  check(!(await dev2.page.evaluate(() => !!document.getElementById('verifier-email-ecran'))), nom + ' : compte vérifié, pas d\'écran de vérification');
  console.log('OK ' + nom + ' : « Se déconnecter » ramène à la connexion ; un compte vérifié se connecte sans l\'écran.');
}
for (const d of h.appareils) check(d.erreurs.length === 0, 'aucune erreur JavaScript : ' + JSON.stringify(d.erreurs));
await h.fin();
console.log('OK test_verification_email');
