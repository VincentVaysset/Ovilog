/* Rapports d'erreurs automatiques (collection racine « erreurs ») : deux comptes du faux serveur (éleveur A sur mobile, administrateur B sur PC, document
   admins/<B> posé comme dans la console), MÊMES règles que firestore.rules (champs fermés, typés, bornés, jamais modifiés).
   1) nettoyage : un message qui contient un NOM DE BREBIS et un EID DE 15 CHIFFRES (collé, espacé, n° national) ne laisse sortir ni l'un ni l'autre ;
      entre guillemets → "…", chiffres → #, un seul mot non technique → seul le type part ; un message purement technique est gardé ;
   2) une vraie erreur JavaScript provoquée chez A arrive au serveur nettoyée (liste fermée de champs, pile « fonction:ligne:colonne », écran = nom de vue),
      une seule fois par jour pour la même erreur ;
   3) interrupteur de l'appareil coupé (Paramètres › Exploitation) : rien n'est envoyé ;
   4) hors réseau : le rapport part au retour du réseau ;
   5) administrateur : onglet « Erreurs » de Messages reçus (absent chez A), regroupement, Supprimer avec confirmation. Comptes jetables, aucune donnée réelle. */
import { readFileSync } from 'fs';
import { demarrerHarnais } from './lib/harnais_sync.mjs';

const h = await demarrerHarnais();
const { check } = h;
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const rapports = async () => Object.values((await (await fetch('http://127.0.0.1:' + h.port + '/snapshot?racine=erreurs&test=1')).json()).docs);
const attendreRapports = async (pred, label, timeout = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { const d = await rapports(); if (pred(d)) return d; await h.dormir(100); } throw new Error('TIMEOUT serveur : ' + label + ' (' + JSON.stringify(await rapports()) + ')'); };
const NOM = 'Marguerite', EID = '250000004560123';
const INTERDITS = [NOM, EID, '4560123', '000456', '60123', 'Rex', 'boite', 'Martin'];
const fuite = obj => { const t = JSON.stringify(obj); return INTERDITS.filter(x => t.includes(x)); };
const preparer = async (dev, nom) => { await h.attendre(dev, () => currentView === 'premiere-configuration' || currentView === 'home', { label: 'écran d\'arrivée après connexion' }); await dev.page.waitForTimeout(200); return dev.page.evaluate(n => {
  DB.campagneDebut = 2026; DB.campagneInitialisee = true; DB.exploitation = Object.assign(DB.exploitation || {}, { nom: n, indicatifMarquage: '000456' });
  saveData(DB); render('home');
}, nom); };

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
  await h.inscrire(A, 'eleveur@example.fr', 'secret1');
  await h.attendre(A, () => !!window.OvilogSync.contactEtat().connecte, { label: 'A connecté' });
  await preparer(A, 'Ferme du Test');

  // ================================================================ 1. nettoyage : nom de brebis et EID de 15 chiffres ne sortent jamais
  const cas = await A.page.evaluate(({ nom, eid }) => {
    const essais = [
      `Cannot read properties of undefined (reading '${nom}') ${eid}`,                 // nom entre guillemets + EID collé
      `${nom} n°${eid} introuvable`,                                                    // nom sans guillemets
      `TypeError: brebis ${nom} 250 000004 560123 boite`,                               // EID espacé
      `Note « ${nom} : boite de l'arrière » sur 000456 60123`,                          // guillemets français + n° national
      `L'agneau "Rex" de ${nom} vendu à Martin ${eid}`,                                 // apostrophe non fermée
      `Unexpected token < in JSON at position ${eid}`,
    ];
    return essais.map(m => { const e = new TypeError(m); return preparerRapportErreur(e); });
  }, { nom: NOM, eid: EID });
  cas.forEach((r, i) => eq(fuite(r), [], 'cas ' + (i + 1) + ' : rien ne sort (' + r.message + ')'));
  eq(cas.map(r => r.message), [
    'Cannot read properties of undefined (reading "…") #',
    '(message masqué)', '(message masqué)', '(message masqué)', '(message masqué)',
    'Unexpected token < in JSON at position #'
  ], 'messages nettoyés : guillemets → "…", chiffres → #, un mot non technique → seul le type part');
  eq(cas.map(r => r.type), Array(6).fill('TypeError'), 'le type d\'erreur part toujours');
  const tech = await A.page.evaluate(() => [nettoyerMessageErreur('renderHome is not defined'), nettoyerMessageErreur("Cannot set properties of null (setting 'innerHTML')"), nettoyerMessageErreur('DB.brebis.find is not a function')]);
  eq(tech, ['renderHome is not defined', 'Cannot set properties of null (setting "…")', 'DB.brebis.find is not a function'], 'un message purement technique est gardé');
  console.log('OK 1 nettoyage : nom de brebis, EID (collé, espacé, n° national), note et nom de personne ne sortent jamais ; message technique gardé.');

  // ================================================================ 2. vraie erreur JavaScript chez A : un seul rapport nettoyé, une fois par jour
  // la même fonction plante deux fois (même type, même message, même endroit du code) : un seul rapport
  await A.page.evaluate(({ nom, eid }) => { window.__planter = function lireFicheBrebis() { throw new TypeError(`Cannot read properties of undefined (reading '${nom}') ${eid}`); }; render('list'); setTimeout(() => window.__planter(), 0); }, { nom: NOM, eid: EID });
  let docs = await attendreRapports(d => d.length === 1, 'premier rapport');
  const r0 = docs[0];
  eq(Object.keys(r0).sort(), ['appareil', 'date', 'ecran', 'message', 'nombre', 'pile', 'type', 'uid', 'version'], 'liste fermée de champs');
  eq([r0.uid === A.uid, r0.type, r0.message, r0.ecran, r0.appareil, r0.nombre], [true, 'TypeError', 'Cannot read properties of undefined (reading "…") #', 'list', 'android', 1], 'rapport reçu nettoyé');
  check(r0.pile[0] && r0.pile[0].startsWith('lireFicheBrebis:'), 'pile : la fonction qui a planté en tête : ' + JSON.stringify(r0.pile));
  check(Array.isArray(r0.pile) && r0.pile.length <= 5 && r0.pile.every(l => /^[\w$.<>]+:\d+:\d+$/.test(l) && !/http|index\.html/.test(l)), 'pile « fonction:ligne:colonne », sans adresse de fichier : ' + JSON.stringify(r0.pile));
  eq(fuite(r0), [], 'aucun nom ni n° dans le document envoyé');
  await A.page.evaluate(() => { setTimeout(() => window.__planter(), 0); });
  await A.page.waitForTimeout(1500);
  eq((await rapports()).length, 1, 'la même erreur n\'est envoyée qu\'une fois par jour');
  console.log('OK 2 erreur réelle : un rapport nettoyé (champs fermés, pile sans adresse, écran = nom de vue), une seule fois par jour.');

  // ================================================================ 3. interrupteur coupé sur l'appareil : rien ne part
  await A.page.evaluate(() => { parametresTab = 'sauvegarde'; parametresRubrique = 'sauvegarde'; render('parametres'); });
  check(await A.page.evaluate(() => document.getElementById('f-erreurs-auto').checked), 'interrupteur activé par défaut');
  await A.page.click('#f-erreurs-auto');
  eq(await A.page.evaluate(() => localStorage.getItem('ovilog_erreurs_coupees')), '1', 'réglage propre à l\'appareil (localStorage)');
  check(!/erreurs_coupees|CLE_ERREURS/.test(readFileSync(new URL('../www/index.html', import.meta.url), 'utf8').match(/const META_FIELDS = \[[\s\S]*?\];/)[0]), 'réglage jamais synchronisé (hors META_FIELDS)');
  await A.page.evaluate(() => { setTimeout(() => { throw new RangeError('Maximum call stack size exceeded'); }, 0); });
  await A.page.waitForTimeout(1500);
  eq((await rapports()).length, 1, 'interrupteur coupé : aucun rapport envoyé');
  await A.page.click('#f-erreurs-auto');
  console.log('OK 3 interrupteur coupé sur l\'appareil : rien n\'est envoyé.');

  // ================================================================ 4. hors réseau : le rapport part au retour du réseau
  await h.reseau(A, { coupe: true });
  await A.page.evaluate(() => { setTimeout(() => { throw new SyntaxError('Unexpected end of JSON input'); }, 0); });
  await A.page.waitForTimeout(1500);
  eq((await rapports()).length, 1, 'hors réseau : rien n\'arrive au serveur');
  await h.reseau(A, { coupe: false });
  docs = await attendreRapports(d => d.length === 2, 'rapport envoyé au retour du réseau');
  check(docs.some(d => d.type === 'SyntaxError' && d.message === 'Unexpected end of JSON input'), 'rapport hors réseau reçu');
  console.log('OK 4 hors réseau : le rapport part au retour du réseau.');

  // ================================================================ 5. administrateur : onglet « Erreurs », regroupement, suppression confirmée
  check(!(await A.page.evaluate(() => { parametresRubrique = null; render('parametres'); return document.getElementById('app').textContent.includes('Messages reçus'); })), 'A (éleveur) : pas de « Messages reçus »');
  await B.page.evaluate(() => { parametresTab = 'messages'; render('parametres'); });
  await h.attendre(B, () => !!document.querySelector('#messages-recus [data-filtre="erreurs"]'), { label: 'B : onglet Erreurs' });
  await h.attendre(B, () => /Erreurs \(2\)/.test(document.querySelector('#messages-recus [data-filtre="erreurs"]').textContent), { label: 'B : 2 erreurs reçues' });
  await B.page.click('#messages-recus [data-filtre="erreurs"]');
  const vues = await B.page.evaluate(() => [...document.querySelectorAll('#messages-recus .mr-erreur')].map(c => c.textContent.replace(/\s+/g, ' ')));
  check(vues.length === 2 && vues.some(t => t.includes('TypeError') && t.includes('Cannot read properties of undefined')) && vues.some(t => t.includes('SyntaxError')), 'B voit les 2 erreurs regroupées : ' + JSON.stringify(vues));
  eq(vues.map(fuite).flat(), [], 'rien de personnel à l\'écran de l\'administrateur');
  await B.page.click('#messages-recus .mr-erreur [data-supprimer-erreurs]');
  check(B.dialogues.some(d => /Supprimer définitivement cette erreur/.test(d)), 'suppression confirmée');
  await attendreRapports(d => d.length === 1, 'erreur supprimée');
  console.log('OK 5 administrateur : onglet « Erreurs » (absent chez l\'éleveur), regroupement, suppression confirmée.');

  check(A.erreurs.length >= 3, 'les erreurs provoquées ont bien eu lieu');
  console.log('OK test_rapports_erreurs');
} finally { await h.fin(); }
