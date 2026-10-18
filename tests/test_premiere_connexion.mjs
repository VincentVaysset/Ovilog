/* Non-régression « première connexion » : un appareil ne doit JAMAIS écrire ses valeurs par défaut sur un compte existant ; avant toute écriture
   (migration du registre, saveData), il attend l'état SERVEUR du compte ; si le compte contient des données, elles priment. Vrai code applicatif,
   faux backend Firestore local à réseau pilotable (lent / coupé), comptes jetables, aucune donnée réelle.
   Scénarios : A réseau lent · B réseau coupé · C deux appareils en même temps (compte existant / compte vide) · D compte réellement vide ·
   E migration du registre (attend la lecture, sauvegarde avant d'écrire) · F modifications locales pendant la lecture (appareil déjà appairé) ·
   G fiches locales : collision avec le compte (le compte prime, message, sauvegarde) et fiches nouvelles envoyées. */
import { demarrerHarnais, peuplerCompte } from './lib/harnais_sync.mjs';

const h = await demarrerHarnais();
const { check } = h;
const MDP = 'AuditTest12345!';
const email = tag => 'pc-' + tag + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '@ovilog-audit-jetable.test';
const eid = n => '25001629919' + String(n).padStart(5, '0');

// Le compte ne doit rien avoir perdu : meta, brebis, lot LC. Aucune écriture reçue, à aucun moment, ne retire le lot LC de meta.lots.
async function compteIntact(uid, qui) {
  const meta = await h.serveur(uid, 'meta');
  check(meta.exists && meta.data, qui + ' : le document meta du compte existe');
  check((meta.data.lots || []).some(l => l.id === 'LC'), qui + ' : le lot LC est toujours dans meta.lots du compte');
  check((meta.data.acheteurs || []).includes('Natera'), qui + ' : acheteurs du compte intacts : ' + JSON.stringify(meta.data.acheteurs));
  check((meta.data.causesMortalite || []).includes('Maladie'), qui + ' : causesMortalite du compte intactes');
  check(meta.data.exploitation && meta.data.exploitation.nom === 'GAEC du Compte', qui + ' : nom d\'exploitation du compte intact');
  const brebis = await h.serveur(uid, 'brebis');
  ['b1', 'b2', 'b3'].forEach(id => check(brebis.docs[id], qui + ' : brebis ' + id + ' toujours dans le compte'));
  const journal = await h.journal(uid);
  // (L'initialisation du compte, avant que le lot LC n'existe, écrit légitimement lots: [] : on ne juge que les écritures POSTÉRIEURES à la création du lot.)
  const premiere = journal.findIndex(e => e.ops.some(o => o.lots && o.lots.includes('LC')));
  const retraits = journal.slice(premiere < 0 ? journal.length : premiere).filter(e => e.ops.some(o => o.lots && !o.lots.includes('LC')));
  check(retraits.length === 0, qui + ' : aucune écriture reçue n\'a retiré le lot LC (écritures fautives : ' + JSON.stringify(retraits) + ')');
}
async function creerCompteExistant(tag) {
  const mail = email(tag);
  const d1 = await h.ouvrir({ desktop: true });
  await h.inscrire(d1, mail, MDP);
  await h.attendre(d1, () => window.OvilogSync.getState().loggedIn, { label: 'PC connecté' });
  await peuplerCompte(h, d1);
  return { mail, d1, uid: d1.uid };
}
const vue = dev => dev.page.evaluate(() => currentView);
// PC (audit charte U) : menu latéral affiché ? contenu centré dans la fenêtre ?
const menuPc = dev => dev.page.evaluate(() => { const r = document.getElementById('app').getBoundingClientRect(); return { menu: getComputedStyle(document.getElementById('nav-drawer-overlay')).display !== 'none', centre: Math.abs(r.left - (innerWidth - r.right)) <= 2 }; });
const sansMenu = async (dev, pc, qui) => { if (!pc) return; const m = await menuPc(dev); check(!m.menu && m.centre, qui + ' : PC sans menu latéral, contenu centré (audit charte U) : ' + JSON.stringify(m)); };
const nbEcritures = async (uid, dev) => { const cid = await h.clientId(dev); return (await h.journal(uid)).filter(e => e.clientId === cid).length; };
const enregistrerSauvegardes = dev => dev.page.evaluate(() => { window.__sauvegardes = []; window.exportBackupFile = async function (data, prefixe) { window.__sauvegardes.push({ prefixe, t: performance.now(), brebis: (data.brebis || []).length, acheteurs: JSON.stringify(data.acheteurs) }); }; });

// ---------------- A. réseau lent : lecture du compte AVANT toute écriture ----------------
{
  const { mail, uid } = await creerCompteExistant('lent');
  const d2 = await h.ouvrir({ reseau: { delaiLectureMs: 3000 } });
  await h.connecter(d2, mail, MDP);
  await h.attendre(d2, () => currentView === 'attente-compte' && document.body.innerText.includes('Lecture de votre compte'), { label: 'A : écran « Lecture de votre compte… » pendant la lecture lente' });
  // Pendant la lecture, du code applicatif écrit ses valeurs par défaut (migration, saisie…) : rien ne doit partir.
  await d2.page.evaluate(() => { DB.lots = []; DB.acheteurs = []; DB.brebis = []; saveData(DB); });
  await h.dormir(1500);
  check(await nbEcritures(uid, d2) === 0, 'A : aucune écriture de ce 2e appareil tant que le compte n\'est pas lu');
  await h.attendre(d2, () => currentView === 'home' && DB.lots.some(l => l.id === 'LC') && DB.brebis.length === 3, { timeout: 30000, label: 'A : le 2e appareil reçoit le compte (lot LC, 3 brebis)' });
  await compteIntact(uid, 'A');
  console.log('OK A réseau lent : écran « Lecture de votre compte… », aucune écriture avant la lecture, les données du compte priment, lot LC intact.');
}

// ---------------- B. réseau coupé : message clair, aucune écriture, reprise au retour du réseau ----------------
let pairePourB = null;
{
  const { mail, uid } = await creerCompteExistant('coupe');
  const d3 = await h.ouvrir({ reseau: { coupe: true } });
  await h.connecter(d3, mail, MDP);
  await h.attendre(d3, () => currentView === 'attente-compte', { label: 'B : écran d\'attente hors ligne' });
  await d3.page.evaluate(() => { DB.lots = []; DB.acheteurs = ['Défaut']; saveData(DB); });
  await h.attendre(d3, () => document.body.innerText.includes('n\'a pas encore pu être lu') && !!document.getElementById('btn-reessayer-compte') && !!document.getElementById('btn-deconnexion-compte'), { timeout: 20000, label: 'B : message « réseau lent ou coupé » + Réessayer + Se déconnecter' });
  const texte = await d3.page.evaluate(() => document.body.innerText);
  check(/Rien n.est envoy/.test(texte), 'B : le message dit que rien n\'est envoyé tant que le compte n\'est pas lu');
  // Un instantané VIDE venant du cache (appareil qui n'a jamais rien lu) ne doit pas passer pour « compte vide » : aucune initialisation, aucune écriture.
  check(await d3.page.evaluate(() => (window.__ecrituresLog || []).length) === 0, 'B : aucune écriture envoyée ni mise en file pendant la coupure');
  await d3.page.click('#btn-reessayer-compte');
  await h.dormir(500);
  check(await vue(d3) === 'attente-compte', 'B : « Réessayer » hors ligne reste sur l\'écran d\'attente (rien ne casse)');
  await h.reseau(d3, { coupe: false });
  await h.attendre(d3, () => currentView === 'home' && DB.lots.some(l => l.id === 'LC') && DB.brebis.length === 3, { timeout: 30000, label: 'B : retour du réseau, le compte est lu' });
  await compteIntact(uid, 'B');
  check(await nbEcritures(uid, d3) === 0, 'B : aucune écriture de ce 2e appareil (ses valeurs par défaut n\'ont jamais été envoyées)');
  console.log('OK B réseau coupé : message clair, aucune écriture (pas même en file d\'attente), reprise automatique au retour du réseau, lot LC intact.');
  pairePourB = { mail, uid, d3 };
}

// ---------------- B2. appareil DÉJÀ appairé hors ligne : on ne bloque pas le travail ----------------
{
  const { mail, uid, d3 } = pairePourB;
  await d3.page.evaluate(() => window.OvilogSync.deconnecterSansVider());
  await h.attendre(d3, () => currentView === 'auth', { label: 'B2 : déconnecté' });
  await h.reseau(d3, { coupe: true });
  await h.connecter(d3, mail, MDP);
  await h.attendre(d3, () => currentView === 'home' && DB.lots.some(l => l.id === 'LC'), { timeout: 10000, label: 'B2 : appareil déjà appairé : l\'accueil s\'ouvre hors ligne avec ses données' });
  await d3.page.evaluate(() => { DB.acheteurs.push('Bio Plus'); saveData(DB); });
  await h.reseau(d3, { coupe: false });
  await h.attendreServeur(uid, 'meta', r => (r.data.acheteurs || []).includes('Bio Plus') && (r.data.acheteurs || []).includes('Natera'), 'B2 : la saisie hors ligne part au retour du réseau, sans rien écraser');
  await compteIntact(uid, 'B2');
  console.log('OK B2 appareil déjà appairé : travail hors ligne possible, saisie envoyée au retour du réseau, rien écrasé.');
}

// ---------------- C1. deux appareils se connectent EN MÊME TEMPS à un compte existant ----------------
{
  const { mail, uid } = await creerCompteExistant('deux');
  const [d4, d5] = [await h.ouvrir({ reseau: { delaiLectureMs: 400 } }), await h.ouvrir({ desktop: true, reseau: { delaiLectureMs: 400 } })];
  await Promise.all([h.connecter(d4, mail, MDP), h.connecter(d5, mail, MDP)]);
  for (const d of [d4, d5]) await h.attendre(d, () => currentView === 'home' && DB.lots.some(l => l.id === 'LC') && DB.brebis.length === 3, { timeout: 30000, label: 'C1 : appareil connecté, compte reçu' });
  await h.dormir(800);
  await compteIntact(uid, 'C1');
  const [m4, m5] = await Promise.all([d4, d5].map(d => d.page.evaluate(() => JSON.stringify({ a: DB.acheteurs, l: DB.lots.map(x => x.id), b: DB.brebis.map(x => x.id).sort() }))));
  check(m4 === m5, 'C1 : les 2 appareils convergent : ' + m4 + ' / ' + m5);
  console.log('OK C1 deux appareils en même temps sur un compte existant : aucun n\'écrit ses défauts, convergence identique, lot LC intact.');
}

// ---------------- C2. deux appareils en même temps sur un compte VIDE : une seule initialisation ----------------
{
  const mail = email('vide2');
  const posseder = (dev, tag, ids) => dev.page.evaluate(({ tag, ids }) => {
    const f = (id, e) => ({ id, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [], controleLaitier: [], modesRepro: [] });
    DB.campagneDebut = 2026; DB.campagneInitialisee = true; DB.acheteurs = [tag]; DB.brebis = ids.map(([id, e]) => f(id, e)); saveData(DB);
  }, { tag, ids });
  const d6 = await h.ouvrir({ reseau: { delaiLectureMs: 700 } });
  await posseder(d6, 'A', [['x1', eid(11)], ['x2', eid(12)]]);
  await h.inscrire(d6, mail, MDP);
  const d7 = await h.ouvrir({ reseau: { delaiLectureMs: 700 } });
  await posseder(d7, 'B', [['y1', eid(21)], ['y2', eid(22)]]);
  await h.connecter(d7, mail, MDP);
  const uid = d6.uid;
  for (const d of [d6, d7]) await h.attendre(d, () => ['home', 'premiere-configuration'].includes(currentView) && DB.brebis.length === 4, { timeout: 40000, label: 'C2 : chaque appareil voit les 4 brebis (union)' });
  await h.attendreServeur(uid, 'brebis', r => Object.keys(r.docs).length === 4, 'C2 : 4 brebis sur le serveur');
  const j = await h.journal(uid);
  const initMeta = j.filter(e => e.ops.some(o => o.type === 'set' && o.path.endsWith('/meta/main')));
  check(initMeta.length === 1, 'C2 : une seule initialisation de meta (transaction « créer seulement si absent »), vue : ' + initMeta.length);
  const meta = await h.serveur(uid, 'meta');
  const [a6, a7] = await Promise.all([d6, d7].map(d => d.page.evaluate(() => JSON.stringify(DB.acheteurs))));
  check(a6 === a7 && a6 === JSON.stringify(meta.data.acheteurs), 'C2 : les 2 appareils et le serveur ont la même meta (celle du gagnant) : ' + a6 + ' / ' + a7 + ' / ' + JSON.stringify(meta.data.acheteurs));
  console.log('OK C2 deux appareils en même temps sur un compte vide : une seule initialisation de meta, les fiches des deux appareils sont réunies, états identiques.');
}

// ---------------- D. compte réellement vide : le premier appareil initialise normalement ----------------
{
  const mail = email('vide');
  const d8 = await h.ouvrir({ desktop: true });
  await d8.page.evaluate(() => {
    const f = (id, e) => ({ id, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [], controleLaitier: [], modesRepro: [] });
    DB.campagneDebut = 2026; DB.campagneInitialisee = true; DB.acheteurs = ['Natera']; DB.exploitation = Object.assign(DB.exploitation || {}, { nom: 'GAEC Neuf' });
    DB.brebis = [f('n1', '25001629919' + '00031'), f('n2', '25001629919' + '00032'), f('n3', '25001629919' + '00033')]; saveData(DB);
  });
  await h.inscrire(d8, mail, MDP);
  const uid = (await h.attendre(d8, () => window.OvilogSync.getState().loggedIn, { label: 'D connecté' }), d8.uid);
  await h.attendreServeur(uid, 'meta', r => r.exists && (r.data.acheteurs || []).includes('Natera') && r.data.exploitation.nom === 'GAEC Neuf', 'D : meta initialisée par le premier appareil');
  await h.attendreServeur(uid, 'brebis', r => Object.keys(r.docs).length === 3, 'D : 3 brebis envoyées');
  const d9 = await h.ouvrir({});
  await h.connecter(d9, mail, MDP);
  await h.attendre(d9, () => currentView === 'home' && DB.brebis.length === 3 && DB.exploitation.nom === 'GAEC Neuf', { timeout: 30000, label: 'D : un 2e appareil reçoit tout' });
  console.log('OK D compte vide : le premier appareil initialise normalement (meta + 3 brebis), un 2e appareil reçoit tout.');
}

// ---------------- E. migration du registre : attend la lecture, sauvegarde avant d'écrire ----------------
{
  const { mail, uid } = await creerCompteExistant('migr');
  // Compte « à l'ancienne » : le registre n'existe que dans meta.registre, le drapeau de migration n'est pas posé, aucune fiche dans la collection registre.
  const entree = { sanitaire: [], agnelages: [], mouvements: [{ type: 'Entrée', date: '2020-01-01' }], echographies: [], controleLaitier: [], modesRepro: [], derniereMiseAJour: '2026-01-01' };
  await h.ecrireServeur(uid, [{ type: 'update', path: 'users/' + uid + '/meta/main', data: { registre: { brebis: { [eid(91)]: entree, [eid(92)]: entree }, beliers: {}, agnelles: {} }, registreCollectionMigree20260930: false } }]);
  const d10 = await h.ouvrir({ reseau: { delaiLectureMs: 800 } });
  await enregistrerSauvegardes(d10);
  await h.connecter(d10, mail, MDP);
  await h.attendre(d10, () => currentView === 'home' && DB.lots.some(l => l.id === 'LC'), { timeout: 30000, label: 'E : compte lu' });
  await h.attendreServeur(uid, 'registre', r => Object.keys(r.docs).length === 2, 'E : les 2 fiches du registre sont migrées');
  const trace = await d10.page.evaluate(() => ({ sauv: window.__sauvegardes, ecr: window.__ecrituresLog }));
  const premiereEcritureRegistre = trace.ecr.find(e => e.chemins.some(c => c.includes('/registre/')));
  const sauvMigration = trace.sauv.find(s => s.prefixe === 'avant-migration-registre');
  const jr = await h.journal(uid), c10 = await h.clientId(d10);
  const ecrituresRegistre = jr.filter(e => e.ops.some(o => o.path.includes('/registre/'))).map(e => ({ n: e.n, par: e.clientId === c10 ? 'nouvel appareil' : 'autre appareil', nb: e.ops.length }));
  const metaLog = await d10.page.evaluate(() => window.__metaLog);
  const histo = jr.map(e => ({ n: e.n, par: e.clientId === c10 ? 'nouvel' : 'autre', ops: e.ops.map(o => o.type + ':' + o.path.split('/').slice(-2).join('/') + (o.drapeauMigration !== undefined ? ' drapeau=' + o.drapeauMigration : '')) }));
  check(!!sauvMigration, 'E : une sauvegarde « avant-migration-registre » a été faite avant la migration qui écrit (sauvegardes : ' + JSON.stringify(trace.sauv.map(s => s.prefixe)) + ' ; écritures du registre : ' + JSON.stringify(ecrituresRegistre) + ' ; journal serveur : ' + JSON.stringify(histo) + ' ; meta reçues par le nouvel appareil : ' + JSON.stringify(metaLog) + ' ; envois du nouvel appareil : ' + JSON.stringify(trace.ecr.map(e => ({ chemins: e.chemins.map(c => c.split('/').slice(-2).join('/')), pile: e.pile }))) + ')');
  check(sauvMigration.t < premiereEcritureRegistre.t, 'E : la sauvegarde précède la première écriture du registre');
  await compteIntact(uid, 'E');
  // Compte déjà migré : aucune migration, aucune sauvegarde de migration, aucune écriture du registre par le nouvel appareil.
  const { mail: mail2, uid: uid2 } = await creerCompteExistant('migr2');
  const d11 = await h.ouvrir({ reseau: { delaiLectureMs: 400 } });
  await enregistrerSauvegardes(d11);
  await h.connecter(d11, mail2, MDP);
  await h.attendre(d11, () => currentView === 'home' && DB.lots.some(l => l.id === 'LC'), { timeout: 30000, label: 'E : 2e compte lu' });
  await h.dormir(800);
  const t2 = await d11.page.evaluate(() => ({ sauv: window.__sauvegardes.map(s => s.prefixe), ecr: (window.__ecrituresLog || []).length }));
  check(!t2.sauv.includes('avant-migration-registre'), 'E : compte déjà migré : aucune sauvegarde de migration (' + JSON.stringify(t2.sauv) + ')');
  check(t2.ecr === 0, 'E : compte déjà migré : aucune écriture du nouvel appareil');
  console.log('OK E migration : attend la lecture du compte ; sauvegarde avant d\'écrire ; rien à écrire = ni sauvegarde ni écriture.');
}

// ---------------- F. appareil déjà appairé SANS références : modifications locales pendant la lecture ----------------
{
  const { mail, uid } = await creerCompteExistant('fenetre');
  const d12 = await h.ouvrir({ reseau: { delaiLectureMs: 2500 } });
  await enregistrerSauvegardes(d12);
  await d12.page.evaluate(u => { localStorage.setItem('ovilog_sync_bootstrapped_uid', u); }, uid);   // appairé de longue date : drapeau présent, références jamais persistées
  await h.connecter(d12, mail, MDP);
  await h.attendre(d12, () => currentView === 'home', { timeout: 10000, label: 'F : appareil déjà appairé : on ne bloque pas le travail (accueil affiché)' });
  await d12.page.evaluate(() => { DB.acheteurs = ['SaisiePendantLaLecture']; saveData(DB); });
  await h.attendre(d12, () => window.__syncAttenteCompte === true && !document.getElementById('sync-bandeau').hidden, { label: 'F : bandeau « Synchro en attente » affiché pendant la lecture' });
  await h.dormir(800);
  check(await nbEcritures(uid, d12) === 0, 'F : la saisie faite pendant la lecture n\'est pas envoyée avant la lecture');
  await h.attendre(d12, () => DB.lots.some(l => l.id === 'LC') && !window.__syncAttenteCompte, { timeout: 30000, label: 'F : compte lu' });
  const etat = await d12.page.evaluate(() => ({ ach: DB.acheteurs, sauv: window.__sauvegardes }));
  check(JSON.stringify(etat.ach) === JSON.stringify(['Natera']), 'F : les données du compte priment : ' + JSON.stringify(etat.ach));
  check(etat.sauv.some(s => s.acheteurs === JSON.stringify(['SaisiePendantLaLecture'])), 'F : sauvegarde locale (contenant la saisie) faite AVANT que la lecture ne la remplace');
  check(d12.dialogues.some(m => /modifications/.test(m) && /sauvegarde/i.test(m)), 'F : message clair à l\'utilisateur (modifications remplacées + sauvegarde) : ' + JSON.stringify(d12.dialogues));
  await compteIntact(uid, 'F');
  console.log('OK F fenêtre de lecture : bandeau, rien envoyé, saisie sauvegardée avant remplacement par le compte, message clair.');
}

// ---------------- G. fiches locales : collision avec le compte (le compte prime) / fiches nouvelles envoyées ----------------
{
  const { mail, uid } = await creerCompteExistant('collision');
  const d13 = await h.ouvrir({});
  await enregistrerSauvegardes(d13);
  await d13.page.evaluate(() => {
    const f = (id, e, extra) => Object.assign({ id, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [], controleLaitier: [], modesRepro: [] }, extra || {});
    DB.campagneDebut = 2026; DB.campagneInitialisee = true;
    DB.brebis = [
      f('x1', '25001629919' + '00041'),                                              // nouvelle : doit être envoyée
      f('x2', '25001629919' + '00001'),                                              // même EID que b1 du compte, id différent : collision
      f('x3', '25001629919' + '00043', { numeroCourtTravailSieol: '23' })];          // même n° court que b2 du compte : collision
    saveData(DB);
  });
  await h.connecter(d13, mail, MDP);
  await h.attendre(d13, () => currentView === 'home' && DB.lots.some(l => l.id === 'LC') && DB.brebis.some(b => b.id === 'x1'), { timeout: 30000, label: 'G : compte lu, fiche nouvelle conservée' });
  await h.attendreServeur(uid, 'brebis', r => !!r.docs.x1, 'G : la fiche nouvelle x1 est envoyée au compte');
  await h.dormir(800);
  const brebis = await h.serveur(uid, 'brebis');
  check(!brebis.docs.x2 && !brebis.docs.x3, 'G : les fiches en collision (x2, x3) ne sont pas envoyées : ' + Object.keys(brebis.docs));
  check(brebis.docs.b1.eid === eid(1) && brebis.docs.b2.numeroCourtTravailSieol === '23', 'G : les fiches b1 et b2 du compte sont intactes');
  const local = await d13.page.evaluate(() => DB.brebis.map(b => b.id).sort());
  check(JSON.stringify(local) === JSON.stringify(['b1', 'b2', 'b3', 'x1']), 'G : sur l\'appareil, les doublons sont écartés (le compte prime), jamais en double : ' + JSON.stringify(local));
  const msg = d13.dialogues.find(m => /collision|déjà dans le compte/i.test(m));
  check(msg && msg.includes(eid(1)) && msg.includes('23'), 'G : message listant les fiches écartées (EID et n°) : ' + JSON.stringify(d13.dialogues));
  const sauv = await d13.page.evaluate(() => window.__sauvegardes);
  const avant = sauv.find(s => s.brebis === 3);
  check(!!avant, 'G : sauvegarde locale (avec les 3 fiches locales, dont les 2 écartées) faite avant la fusion : ' + JSON.stringify(sauv));
  await compteIntact(uid, 'G');
  console.log('OK G fiches locales : la fiche nouvelle est envoyée ; les fiches en collision (même EID, même n°) cèdent au compte, listées dans un message, sauvegardées avant.');
}

// ---------------- H. rendu des écrans techniques (maquette « Écrans techniques ») : connexion, lecture du compte (8 s, Réessayer, Se déconnecter), bannière ----------------
for (const pc of [false, true]) {
  const nom = pc ? 'PC' : 'mobile';
  const { mail, uid } = await creerCompteExistant('rendu' + (pc ? 'pc' : 'mob'));
  const d = await h.ouvrir({ desktop: pc, reseau: { coupe: false }, contexte: { viewport: pc ? { width: 1300, height: 900 } : { width: 390, height: 844 } } });
  await h.attendre(d, () => currentView === 'auth', { label: nom + ' : écran de connexion' });
  await sansMenu(d, pc, 'H ' + nom + ' : connexion à froid');
  const c = await d.page.evaluate(() => { const r = q => document.querySelector(q), h = q => Math.round(r(q).getBoundingClientRect().height);
    return { logo: !!r('#ecran-connexion img[alt="Ovilog"]'), marque: r('#ecran-connexion .nom').textContent, sous: r('#ecran-connexion .sous').textContent, labels: [...document.querySelectorAll('#ecran-connexion label')].map(l => l.textContent), hEmail: h('#f-auth-email'), hMdp: h('#f-auth-password'), hBtn: h('#btn-auth-submit'),
      boutons: [...document.querySelectorAll('#ecran-connexion .btn-primary')].length, mdpOublie: r('#link-forgot').textContent, afficher: r('.champ-mdp .afficher').textContent, type: r('#f-auth-password').type, vert: getComputedStyle(r('#btn-auth-submit')).backgroundColor }; });
  check(c.logo && c.marque === 'OVILOG' && c.sous === 'Gestion de troupeau ovin lait', 'H ' + nom + ' : logo brebis, OVILOG et la phrase d\'accueil');
  check(c.labels.join() === 'Email,Mot de passe' && c.mdpOublie === 'Mot de passe oublié ?' && c.afficher === 'Afficher' && c.type === 'password', 'H ' + nom + ' : Email, Mot de passe (Afficher), Mot de passe oublié ? : ' + JSON.stringify(c));
  const hAttendue = pc ? 44 : 48;
  check(c.hEmail === hAttendue && c.hMdp === hAttendue && c.hBtn === hAttendue && c.boutons === 1 && c.vert === 'rgb(53, 127, 75)', 'H ' + nom + ' : champs et bouton de ' + hAttendue + ' px, un seul bouton principal vert : ' + JSON.stringify(c));
  await d.page.click('.champ-mdp .afficher');
  check(await d.page.evaluate(() => document.getElementById('f-auth-password').type === 'text' && document.querySelector('.champ-mdp .afficher').textContent === 'Masquer'), 'H ' + nom + ' : « Afficher » montre le mot de passe');
  await d.page.click('.champ-mdp .afficher');
  // champs vides : indication en AMBRE (pas une erreur) ; mauvais mot de passe : la seule vraie erreur, en ROUGE
  await d.page.click('#btn-auth-submit');
  const ambre = await d.page.evaluate(() => { const e = document.getElementById('auth-err'); return { cls: e.className, fond: getComputedStyle(e).backgroundColor, txt: e.textContent }; });
  check(/alerte/.test(ambre.cls) && ambre.fond === 'rgb(251, 238, 215)' && /Renseigne/.test(ambre.txt), 'H ' + nom + ' : champs vides = indication ambre : ' + JSON.stringify(ambre));
  await d.page.fill('#f-auth-email', mail); await d.page.fill('#f-auth-password', 'mauvais-mot-de-passe');
  await d.page.click('#btn-auth-submit');
  await h.attendre(d, () => /bloc/.test(document.getElementById('auth-err').className), { label: 'H ' + nom + ' : erreur rouge' });
  const rouge = await d.page.evaluate(() => { const e = document.getElementById('auth-err'); return { fond: getComputedStyle(e).backgroundColor, txt: e.innerText.replace(/\s+/g, ' ') }; });
  check(rouge.fond === 'rgb(251, 227, 224)' && rouge.txt === 'Email ou mot de passe incorrect Vérifiez la saisie et réessayez.', 'H ' + nom + ' : « Email ou mot de passe incorrect » en rouge : ' + JSON.stringify(rouge));
  check(await d.page.evaluate(() => currentView === 'auth' && !document.getElementById('btn-auth-submit').disabled), 'H ' + nom + ' : on reste sur la connexion, le bouton se réactive');
  // lecture du compte : réseau coupé -> 8 s -> « Connexion lente » + Réessayer / Se déconnecter
  await h.reseau(d, { coupe: true });
  await d.page.fill('#f-auth-password', MDP);
  await d.page.click('#btn-auth-submit');
  await h.attendre(d, () => currentView === 'attente-compte', { label: 'H ' + nom + ' : écran de lecture du compte' });
  await sansMenu(d, pc, 'H ' + nom + ' : lecture du compte');
  const avant8 = await d.page.evaluate(() => ({ logo: !!document.querySelector('#attente-compte-ecran img[alt="Ovilog"]'), txt: document.getElementById('attente-compte-ecran').innerText.replace(/\s+/g, ' '), alerte: !document.getElementById('attente-alerte').classList.contains('hidden'), actions: !document.getElementById('attente-actions').classList.contains('hidden'), roue: !!document.querySelector('.attente-roue') }));
  check(avant8.logo && avant8.roue && /Lecture de votre compte…/.test(avant8.txt) && /Rien n'est modifié tant que la lecture n'est pas terminée\./.test(avant8.txt) && !avant8.alerte && !avant8.actions, 'H ' + nom + ' : avant 8 s : logo, indicateur, message de sécurité, ni alerte ni boutons : ' + avant8.txt);
  await h.dormir(8300);
  const apres8 = await d.page.evaluate(() => { const a = document.querySelector('#attente-alerte .msg-charte'); return { alerte: !document.getElementById('attente-alerte').classList.contains('hidden'), titre: a.querySelector('b').textContent, fond: getComputedStyle(a).backgroundColor, boutons: [...document.querySelectorAll('#attente-actions .btn')].map(b => b.textContent + ':' + b.classList.contains('btn-primary')), txt: a.innerText.replace(/\s+/g, ' ') }; });
  check(apres8.alerte && apres8.titre === 'Connexion lente' && apres8.fond === 'rgb(251, 238, 215)' && /Rien n'est envoyé tant que ce n'est pas fait/.test(apres8.txt) && /vos données sont en sécurité/.test(apres8.txt), 'H ' + nom + ' : après 8 s : carte ambre « Connexion lente » : ' + JSON.stringify(apres8));
  check(apres8.boutons.join() === 'Réessayer:true,Se déconnecter:false', 'H ' + nom + ' : « Réessayer » (principal) et « Se déconnecter » : ' + apres8.boutons);
  check(await d.page.evaluate(() => (window.__ecrituresLog || []).length) === 0 && await nbEcritures(uid, d) === 0, 'H ' + nom + ' : aucune écriture pendant l\'attente');
  await d.page.click('#btn-reessayer-compte'); await h.dormir(400);
  check(await vue(d) === 'attente-compte', 'H ' + nom + ' : « Réessayer » sans réseau : on reste sur l\'écran, rien ne casse');
  await d.page.click('#btn-deconnexion-compte');
  await h.attendre(d, () => currentView === 'auth', { label: 'H ' + nom + ' : « Se déconnecter » ramène à la connexion' });
  check(await d.page.evaluate(() => !window.OvilogSync.getState().loggedIn), 'H ' + nom + ' : déconnecté');
  await sansMenu(d, pc, 'H ' + nom + ' : retour à la connexion');
  check(await nbEcritures(uid, d) === 0, 'H ' + nom + ' : toujours aucune écriture de cet appareil');
  // bannière « Synchro en attente » : une ligne ambre sous l'en-tête, disparaît seule
  await h.reseau(d, { coupe: false });
  await d.page.evaluate(() => { window.__syncEnAttente = true; window.updateHeaderSyncBadge(); });
  const ban = await d.page.evaluate(() => { const b = document.getElementById('sync-bandeau'); return { cache: b.hidden, txt: b.innerText.replace(/\s+/g, ' '), fond: getComputedStyle(b).backgroundColor, point: getComputedStyle(b.querySelector('strong'), '::after').content }; });
  check(!ban.cache && /^Synchro en attente/.test(ban.txt) && ban.point === '" ·"' && /vos saisies sont gardées sur cet appareil/.test(ban.txt) && ban.fond === 'rgb(251, 238, 215)', 'H ' + nom + ' : bannière ambre « Synchro en attente · vos saisies sont gardées sur cet appareil » : ' + JSON.stringify(ban));
  await d.page.evaluate(() => { window.__syncEnAttente = false; window.updateHeaderSyncBadge(); });
  check(await d.page.evaluate(() => document.getElementById('sync-bandeau').hidden), 'H ' + nom + ' : la bannière disparaît seule quand la synchro reprend');
  if (pc) {   // reconnexion : le menu latéral revient avec l'accueil
    await d.page.fill('#f-auth-email', mail); await d.page.fill('#f-auth-password', MDP); await d.page.click('#btn-auth-submit');
    await h.attendre(d, () => currentView === 'home', { timeout: 30000, label: 'H PC : reconnecté, accueil' });
    const m = await menuPc(d); check(m.menu, 'H PC : le menu latéral revient à la connexion (audit charte U) : ' + JSON.stringify(m));
  }
  console.log('OK H ' + nom + ' : connexion (logo, Afficher, ambre / rouge), lecture du compte (8 s, Connexion lente, Réessayer, Se déconnecter), bannière — aucune écriture.');
}

for (const d of h.appareils) check(d.erreurs.length === 0, 'aucune erreur JavaScript sur un appareil : ' + JSON.stringify(d.erreurs));
await h.fin();
console.log('\nTOUS LES TESTS DE PREMIÈRE CONNEXION SONT PASSÉS (comptes jetables, faux backend local, aucune donnée réelle)');
