/* Verrous de version gérés par l'ADMINISTRATEUR depuis son compte (27/11) — deux comptes : l'administrateur (A) et un éleveur (B).
   (1) sans verrou : rien d'automatique, aucune conversion, écritures comme avant ; (2) Administration de A : liste des comptes (registre comptes/,
   nom de l'exploitation et versions des appareils, aucune donnée d'animal) ; « Activer » refusé si l'appareil de A n'est pas à jour ou si un appareil
   connu de B est plus ancien ; (3) verrou de B posé dans verrous/B par A, format de B passé à 4 par SES appareils ; (4) un appareil de B plus ancien
   consulte mais n'écrit rien (« Mise à jour obligatoire ») ; un appareil d'avant ce code est refusé par la règle du serveur ; (5) aperçu en lecture
   seule du compte B depuis A, sauvegarde, autorisation pour UN appareil de B : c'est lui qui convertit (nouvel aperçu, contrôle avant / après),
   résultat renvoyé à A ; A n'écrit jamais dans les données de B ; un nombre attendu différent = rien n'est fait ; (6) aucune fiche sortie ne repasse
   « active ». Faux backend local (mêmes règles que firestore.rules), comptes jetables, aucune donnée réelle. */
import { demarrerHarnais } from './lib/harnais_sync.mjs';
const h = await demarrerHarnais();
const { check } = h;
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const MDP = 'AuditTest12345!';
const jetable = p => p + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '@ovilog-audit-jetable.test';
const mailA = jetable('admin'), mailB = jetable('eleveur');
const ouvrirEnVersion = async (v, desktop) => {
  const d = await h.ouvrir({ desktop });
  await d.page.addInitScript(n => { window.__versionAppTest = n; window.__delaiConversionMs = 100; }, v);
  await d.page.evaluate(n => { window.__versionAppTest = n; window.__delaiConversionMs = 100; localStorage.setItem('__fakePersister', '1'); }, v);
  return d;
};
const racine = async (col, id) => (await (await fetch('http://127.0.0.1:' + h.port + '/getdoc?racine=' + col + '&id=' + id + '&test=1')).json()).data;
const batchBrut = (uid, ops, client) => fetch('http://127.0.0.1:' + h.port + '/batch', { method: 'POST', body: JSON.stringify({ uid, clientId: client || 'ancien-appareil', ops }) });

// ===== comptes : A administrateur (PC 1.0.490) ; B éleveur (mobile 1.0.490, PC 1.0.488)
const pcA = await ouvrirEnVersion(490, true);
await h.inscrire(pcA, mailA, MDP);
await h.attendre(pcA, () => window.OvilogSync.getState().loggedIn, { label: 'PC A connecté' });
const uidA = pcA.uid;
await h.ecrireServeur(uidA, [{ type: 'set', path: 'admins/' + uidA, data: { role: 'admin' } }]);
const mobB = await ouvrirEnVersion(490, false);
await h.inscrire(mobB, mailB, MDP);
await h.attendre(mobB, () => window.OvilogSync.getState().loggedIn, { label: 'mobile B connecté' });
const uidB = mobB.uid;
await h.attendreServeur(uidB, 'meta', r => r.data && r.data.schemaDonnees === 3, 'compte B neuf (format 3)');
const ANCIEN = await mobB.page.evaluate(() => Object.keys(CONVERSION_TYPES_MOUVEMENT).find(k => CONVERSION_TYPES_MOUVEMENT[k] === TYPE_MVT.MORT));
const VIEUX_VENDU = await mobB.page.evaluate(() => Object.keys(CONVERSION_TYPES_MOUVEMENT).find(k => CONVERSION_TYPES_MOUVEMENT[k] === TYPE_MVT.VENTE && !/e$/.test(k)));
await mobB.page.evaluate(([ancien, vendu]) => {
  DB.campagneDebut = 2027; DB.campagneInitialisee = true; DB.campagneDateDemarrage = '2026-09-29';
  DB.exploitation = Object.assign(DB.exploitation || {}, { nom: 'Ferme B' });
  const f = (id, n, sortie, statut, extra) => Object.assign({ id, eid: '2500000129' + String(60000 + n), statut: statut || 'active', createdAt: 1, agnelages: [], sanitaire: [], notes: [], echographies: [], controleLaitier: [], modesRepro: [],
    mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }].concat(sortie ? [sortie] : []) }, extra || {});
  DB.brebis = [
    f('b1', 1, null, null, { agnelages: [{ id: 'mb1', date: '2026-11-05', campagne: 2027, lambs: [{ id: 'ag1', sexe: 'Mâle', eid: '250000045671001', statutFinal: 'vendu', mouvements: [{ id: 'mva', type: vendu, acheteur: 'Acheteur C', date: '2026-11-20' }] }] }] }),
    f('b2', 2, { type: ancien, cause: 'Mammite', date: '2026-10-12' }, 'morte'),
    f('b3', 3, { type: 'Vente', acheteur: 'Acheteur C', date: '2026-10-15' }, 'vendue')];
  saveData(DB);
}, [ANCIEN, VIEUX_VENDU]);
await h.attendreServeur(uidB, 'brebis', r => Object.keys(r.docs || {}).length === 3, '3 brebis de B au serveur');
await mobB.page.reload({ waitUntil: 'load' });   // nouvelle ouverture : annonce avec le nom de l'exploitation
await h.attendre(mobB, () => window.OvilogSync.getState().loggedIn && (DB.brebis || []).length === 3, { label: 'mobile B rouvert', timeout: 30000 });
const pcB = await ouvrirEnVersion(488, true);
await h.connecter(pcB, mailB, MDP);
await h.attendre(pcB, () => window.OvilogSync.getState().loggedIn && (DB.brebis || []).length === 3, { label: 'PC B (1.0.488) lit le compte', timeout: 30000 });
await pcA.page.reload({ waitUntil: 'load' });
await h.attendre(pcA, () => window.OvilogSync.getState().loggedIn && contactAdministrateur(), { label: 'PC A administrateur', timeout: 30000 });
const debutAttente = Date.now();
while (Date.now() - debutAttente < 20000) { const c = await racine('comptes', uidB); if (c && c.exploitation === 'Ferme B' && Object.keys(c.appareils || {}).length === 2) break; await h.dormir(200); }
const compteB = await racine('comptes', uidB);
eq([compteB.exploitation, Object.values(compteB.appareils).map(a => a.type + ' ' + a.version).sort()], ['Ferme B', ['android 490', 'pc 488']], 'registre des comptes : nom et versions des appareils de B');
check(!JSON.stringify(compteB).includes('2500000129'), 'registre des comptes : aucun n° ni donnée d\'animal');
await h.attendreCalme(uidB, 1500);
const fichesB = async () => (await h.fiches(uidB, 'brebis')).docs;
const statutsB = async () => { const d = await fichesB(); return ['b1', 'b2', 'b3'].map(id => d[id] && d[id].statut); };
const typesB = async () => { const d = await fichesB(); return [d.b2.mouvements.map(m => m.type).pop(), d.b1.agnelages[0].lambs[0].mouvements[0].type]; };

// ===== 1. sans verrou : rien d'automatique, écritures sans jeton comme avant
await h.dormir(2000);
eq(await typesB(), [ANCIEN, VIEUX_VENDU], 'sans verrou ni autorisation : aucune conversion');
check(await mobB.page.evaluate(() => !document.getElementById('question-charte')), 'aucune question sur l\'appareil de B');
eq((await batchBrut(uidB, [{ type: 'update', path: 'users/' + uidB + '/brebis/b1', data: { note: 'avant verrou' } }])).status, 200, 'sans verrou : écriture sans jeton acceptée');
check(await mobB.page.evaluate(() => ![...document.querySelectorAll('.tab-bar .tab-btn')].some(b => b.dataset.tab === 'administration')), 'B : aucun onglet Administration');
console.log('OK 1 sans verrou : rien d\'automatique, rien de changé pour les appareils ; B ne voit rien de l\'administration.');

// ===== 2. Administration de A : liste des comptes ; « Activer » refusé si A n'est pas à jour, ou si un appareil connu de B est plus ancien
const ouvrirAdmin = async () => {
  await pcA.page.evaluate(() => { adminVerrous = { charge: false, enCours: false, comptes: [], erreur: null, apercu: null }; parametresTab = 'administration'; render('parametres'); });
  await h.attendre(pcA, uid => !!document.querySelector('.verrou-compte[data-uid="' + uid + '"]'), { label: 'compte B listé', arg: uidB });
};
await ouvrirAdmin();
const ligneB = await pcA.page.evaluate(uid => document.querySelector('.verrou-compte[data-uid="' + uid + '"]').textContent.replace(/\s+/g, ' '), uidB);
check(/Ferme B/.test(ligneB) && /Verrou désactivé/.test(ligneB) && /PC 1\.0\.488/.test(ligneB) && /Mobile 1\.0\.490/.test(ligneB), 'ligne du compte B : état, versions des appareils : ' + ligneB);
const essaiActiver = async rel => {
  await pcA.page.evaluate(([r, uid]) => { derniereReleaseDisponible = async () => r; document.querySelector('.btn-verrou-activer[data-uid="' + uid + '"]').click(); }, [rel, uidB]);
  await h.attendre(pcA, () => !!document.getElementById('message-charte') || !!document.getElementById('question-charte'), { label: 'réponse au bouton' });
  return pcA.page.evaluate(() => { const q = document.getElementById('message-charte') || document.getElementById('question-charte'); const t = q.id + '|' + q.textContent; if (q.id === 'message-charte') q.querySelector('button').click(); return t; });
};
let t = await essaiActiver({ ok: true, best: { versionCode: 492 } });
check(/message-charte/.test(t) && /pas à jour.*1\.0\.492/.test(t), 'refus : appareil de l\'administrateur pas à jour : ' + t);
t = await essaiActiver({ ok: false, best: null });
check(/Impossible de vérifier/.test(t), 'refus : vérification impossible : ' + t);
t = await essaiActiver({ ok: true, best: { versionCode: 490 } });
check(/message-charte/.test(t) && /plus ancien/.test(t) && /PC 1\.0\.488/.test(t), 'refus : un appareil connu de B est plus ancien : ' + t);
check(!(await racine('verrous', uidB)), 'refusé : aucun verrou écrit');
console.log('OK 2 liste des comptes (nom, versions) ; « Activer » refusé : administrateur pas à jour, vérification impossible, appareil de B plus ancien.');

// ===== 3. le PC de B est mis à jour : verrou posé par A, format de B passé à 4 par ses appareils
await pcB.page.addInitScript(() => { window.__versionAppTest = 490; });
await pcB.page.reload({ waitUntil: 'load' });
await h.attendre(pcB, () => window.OvilogSync.getState().loggedIn && (DB.brebis || []).length === 3, { label: 'PC B rouvert en 1.0.490', timeout: 30000 });
while (true) { const c = await racine('comptes', uidB); if (Object.values(c.appareils).every(a => a.version === 490)) break; await h.dormir(200); }
await ouvrirAdmin();
t = await essaiActiver({ ok: true, best: { versionCode: 490 } });
check(/question-charte/.test(t) && /Activer le verrou de version/.test(t) && /Ferme B/.test(t), 'question d\'activation : ' + t);
await pcA.page.evaluate(() => document.querySelector('#question-charte .btn-primary').click());
await h.attendre(pcA, () => /Verrou confirmé par le serveur/.test((document.getElementById('verrou-message') || {}).textContent || ''), { label: 'verrou confirmé', timeout: 20000 });
eq((await racine('verrous', uidB)).versionMinimale, 490, 'verrous/B : version minimale 490, posée par l\'administrateur');
check(!(await racine('verrous', uidA)), 'compte par compte : A n\'a pas de verrou');
await h.attendreServeur(uidB, 'meta', r => r.data && r.data.schemaDonnees === 4, 'format de B passé à 4 par ses appareils', 20000);
eq(await typesB(), [ANCIEN, VIEUX_VENDU], 'verrou posé : toujours aucune conversion');
eq((await batchBrut(uidB, [{ type: 'set', path: 'verrous/' + uidB, data: { versionMinimale: 999 } }], 'eleveur')).status, 403, 'B ne touche pas à son verrou');
console.log('OK 3 verrou de B posé par A (verrous/B), confirmé ; format de B passé à 4 par ses propres appareils ; aucune conversion.');

// ===== 4. appareil de B plus ancien (480) : consultation seule ; appareil d'avant ce code : refusé par la règle du serveur
const vieux = await ouvrirEnVersion(480, false);
await h.connecter(vieux, mailB, MDP);
await h.attendre(vieux, () => window.OvilogSync.getState().loggedIn && (DB.brebis || []).length === 3 && ecrituresBloqueesVersion(), { label: 'mobile 480 bloqué', timeout: 30000 });
const clientVieux = await h.clientId(vieux), nJ = (await h.journal(uidB)).length;
const v4 = await vieux.page.evaluate(() => {
  const avant = localStorage.getItem(DB_KEY);
  const b = DB.brebis.find(x => x.id === 'b1'); b.notes = (b.notes || []).concat([{ texte: 'note du vieux', date: '2026-11-27' }]);
  const ok = saveData(DB), verifie = enregistrerVerifie(null, 'Note', [['b1', 1]]), bandeau = document.getElementById('sync-bandeau');
  return { ok, verifie, inchange: localStorage.getItem(DB_KEY) === avant, bandeau: !bandeau.hidden && bandeau.textContent, bouton: !!document.getElementById('sync-bandeau-maj'), lecture: DB.brebis.length };
});
eq([v4.ok, v4.verifie, v4.inchange, v4.bouton, v4.lecture], [false, false, true, true, 3], 'mobile 480 : rien d\'enregistré, bouton « Mettre à jour », lecture possible');
check(/Mise à jour obligatoire/.test(v4.bandeau), 'bandeau « Mise à jour obligatoire » : ' + v4.bandeau);
await h.dormir(1500);
check(!(await h.journal(uidB)).slice(nJ).some(e => e.clientId === clientVieux), 'mobile 480 : aucune écriture envoyée');
eq((await batchBrut(uidB, [{ type: 'update', path: 'users/' + uidB + '/brebis/b2', data: { statut: 'active' } }])).status, 403, 'serveur : écriture sans jeton refusée');
eq((await batchBrut(uidB, [{ type: 'update', path: 'users/' + uidB + '/brebis/b2', data: { statut: 'active' } }, { type: 'set', path: 'users/' + uidB + '/ecritures/jeton', data: { vApp: 480, vEcrit: { __op: 'serverTimestamp' } } }])).status, 403, 'serveur : jeton d\'une version 480 refusé');
eq((await batchBrut(uidB, [{ type: 'delete', path: 'users/' + uidB + '/brebis/b3' }])).status, 403, 'serveur : suppression sans jeton refusée');
const avantCode = await h.ouvrir({ desktop: false });
await avantCode.page.evaluate(() => { schemaDonneesVersionCourante = () => 3; });
await h.connecter(avantCode, mailB, MDP);
await h.attendre(avantCode, () => window.OvilogSync.getState().loggedIn && (DB.brebis || []).length === 3, { label: 'appareil d\'avant ce code', timeout: 30000 });
check(await avantCode.page.evaluate(() => donneesVerrouillees()), 'format 4 inconnu : un ancien code n\'envoie plus rien');
eq(await statutsB(), ['active', 'morte', 'vendue'], 'aucune fiche repassée active au serveur');
console.log('OK 4 appareil plus ancien : consulte, n\'enregistre ni n\'envoie rien ; ancien code arrêté par le format 4 et refusé par la règle.');

// ===== 5. aperçu en lecture seule depuis A, sauvegarde, autorisation pour le mobile de B : c'est lui qui convertit
const journalAvant = (await h.journal(uidB)).length, clientA = await h.clientId(pcA), dbAAvant = await pcA.page.evaluate(() => JSON.stringify(DB.brebis));
await ouvrirAdmin();
await pcA.page.evaluate(uid => document.querySelector('.btn-verrou-apercu[data-uid="' + uid + '"]').click(), uidB);
await h.attendre(pcA, () => !!document.querySelector('.verrou-apercu-nb'), { label: 'aperçu affiché', timeout: 20000 });
const ap = await pcA.page.evaluate(() => ({ nb: document.querySelector('.verrou-apercu-nb').textContent, lignes: [...document.querySelectorAll('.verrou-apercu-table tbody tr')].map(r => [...r.children].map(c => c.textContent)) }));
eq(ap.nb, '2 mouvement(s) à convertir', 'aperçu : nombre');
check(ap.lignes.some(l => l[2] === ANCIEN && l[3] === 'Mort' && l[1] === '12/10/2026') && ap.lignes.some(l => /Agneau/.test(l[0]) && l[2] === VIEUX_VENDU && l[3] === 'Vente'), 'aperçu : animal, date, ancien mot, nouveau mot : ' + JSON.stringify(ap.lignes));
check(!(await pcA.page.evaluate(() => !!document.querySelector('.btn-verrou-autoriser'))), 'pas d\'autorisation possible avant la sauvegarde');
await pcA.page.evaluate(() => { window.__sauvegardes = []; sauvegardeVisibleAvantMutation = async (nom, data) => { window.__sauvegardes.push({ nom, texte: JSON.stringify(data) }); return { ok: true }; }; });
await pcA.page.evaluate(uid => document.querySelector('.btn-verrou-sauvegarde[data-uid="' + uid + '"]').click(), uidB);
await h.attendre(pcA, () => !!document.querySelector('.verrou-sauvegarde-ok'), { label: 'sauvegarde faite' });
const sauv = await pcA.page.evaluate(() => window.__sauvegardes[0]);
check(/^ovilog_compte_Ferme-B_avant_libelles_\d{8}_\d{6}\.json$/.test(sauv.nom) && sauv.texte.includes(ANCIEN) && JSON.parse(sauv.texte).brebis.length === 3, 'sauvegarde JSON horodatée du compte B (données d\'avant) : ' + sauv.nom);
const idMobB = await mobB.page.evaluate(() => idAppareil());
await pcA.page.evaluate(id => { document.querySelector('input[name="verrou-appareil"][value="' + id + '"]').click(); document.querySelector('.btn-verrou-autoriser').click(); }, idMobB);
await h.attendre(pcA, () => /Autoriser la conversion/.test((document.getElementById('question-charte') || {}).textContent || ''), { label: 'question d\'autorisation' });
await pcA.page.evaluate(() => document.querySelector('#question-charte .btn-primary').click());
const debutConv = Date.now();
while (Date.now() - debutConv < 25000 && !((await racine('comptes', uidB)).conversion || {}).etat) await h.dormir(200);
const res = (await racine('comptes', uidB)).conversion;
check(res && res.etat === 'faite' && res.n === 2 && res.appareil === idMobB, 'résultat renvoyé : conversion faite par le mobile désigné : ' + JSON.stringify(res));
const debutT = Date.now();
while (Date.now() - debutT < 15000 && (await typesB())[0] !== 'Mort') await h.dormir(200);
eq(await typesB(), ['Mort', 'Vente'], 'serveur : « Mort » et « Vente » (seul le type change)');
eq(await statutsB(), ['active', 'morte', 'vendue'], 'statuts intacts');
check(!(await h.journal(uidB)).slice(journalAvant).some(e => e.clientId === clientA), 'A n\'a rien écrit dans les données de B');
check(await pcA.page.evaluate(av => JSON.stringify(DB.brebis) === av, dbAAvant), 'la base de A n\'est pas touchée par la lecture de B');
await ouvrirAdmin();
check(/Conversion faite : 2 mouvement/.test(await pcA.page.evaluate(uid => document.querySelector('.verrou-compte[data-uid="' + uid + '"]').textContent, uidB)), 'résultat affiché chez l\'administrateur');
// nouvelle autorisation avec un nombre attendu faux : rien n'est fait, raison renvoyée
await pcA.page.evaluate(async ([uid, id]) => { await window.OvilogSync.autoriserConversionCompte(uid, 5, id, 'test'); }, [uidB, idMobB]);
const debutR = Date.now();
while (Date.now() - debutR < 20000 && ((await racine('comptes', uidB)).conversion || {}).etat !== 'annulee') await h.dormir(200);
check(/aperçu différent/.test((await racine('comptes', uidB)).conversion.raison || ''), 'nombre attendu différent : annulée, raison renvoyée');
console.log('OK 5 aperçu en lecture seule et sauvegarde chez A, autorisation pour le mobile de B, conversion faite par lui, contrôlée, résultat chez A ; A n\'écrit rien chez B.');

// ===== 6. aucune fiche sortie ne repasse « active »
eq(await mobB.page.evaluate(() => { const b = DB.brebis.find(x => x.id === 'b2'); b.statut = 'active'; b.notes = (b.notes || []).concat([{ texte: 'après', date: '2026-11-27' }]); saveData(DB); return b.statut; }), 'morte', 'statut recalculé d\'après le dernier mouvement avant l\'envoi');
await vieux.page.evaluate(() => { const db = JSON.parse(localStorage.getItem(DB_KEY)); db.brebis.find(x => x.id === 'b3').statut = 'active'; localStorage.setItem(DB_KEY, JSON.stringify(db)); });
await vieux.page.addInitScript(() => { window.__versionAppTest = 490; });
await vieux.page.reload({ waitUntil: 'load' });
await h.attendre(vieux, () => window.OvilogSync.getState().loggedIn && (DB.brebis || []).length === 3 && !ecrituresBloqueesVersion(), { label: 'mobile mis à jour', timeout: 30000 });
await vieux.page.evaluate(() => saveData(DB));
await h.dormir(1500); await h.attendreCalme(uidB, 1500);
eq(await vieux.page.evaluate(() => DB.brebis.find(x => x.id === 'b3').statut), 'vendue', 'mobile mis à jour : la saisie « active » d\'une vendue est corrigée');
eq(await statutsB(), ['active', 'morte', 'vendue'], 'serveur : aucune fiche repassée active');
for (const d of [pcA, mobB, pcB, vieux, avantCode]) check(!d.erreurs.length, 'erreurs JS : ' + d.erreurs.slice(0, 3).join(' | '));
console.log('OK 6 aucune fiche sortie ne repasse « active ».');
await h.fin();
console.log('TOUS LES TESTS « VERROUS DE VERSION » SONT PASSÉS (faux backend, comptes jetables, aucune donnée réelle)');
