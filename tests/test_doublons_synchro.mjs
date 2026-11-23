/* Doublons de synchro (v464) : une brebis avec deux copies de la même mise bas (nées de la v463) et deux soins identiques. Accueil et Bilan
   comptent pareil (une mise bas par brebis et par campagne). Pastille « Doublons à vérifier », écran, « Réunir en une » (la copie la plus
   complète reçoit ce que l'autre est seule à avoir), « Annuler » = fiche exacte, puis réunion confirmée ; la copie retirée part en suppression
   MARQUÉE (fu) ; un appareil resté hors ligne avec l'ancienne copie ne la renvoie pas et finit identique. Faux backend local, comptes jetables. */
import { demarrerHarnais } from './lib/harnais_sync.mjs';

const h = await demarrerHarnais();
const { check } = h;
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const MDP = 'AuditTest12345!';
const mail = 'doublons-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '@ovilog-audit-jetable.test';
const fiches = async uid => (await h.fiches(uid, 'brebis')).docs;

const pc = await h.ouvrir({ desktop: true });
await h.inscrire(pc, mail, MDP);
await h.attendre(pc, () => window.OvilogSync.getState().loggedIn, { label: 'PC connecté' });
const uid = pc.uid;
await h.attendreServeur(uid, 'meta', r => r.exists && r.data && r.data.schemaDonnees === 3, 'compte neuf créé (format 3)');
await pc.page.evaluate(() => {
  DB.campagneDebut = 2027; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  const soin = id => ({ id, date: '2026-11-03', produit: 'Produit A', type: 'Traitement', dose: '2 cc' });
  DB.brebis = [{ id: 'd1', eid: '250000045651021', numeroCourtTravailSieol: '21', statut: 'active', createdAt: 1, echographies: [], notes: [], modesRepro: [], controleLaitier: [],
    mouvements: [{ id: 'm1', type: 'Entrée', date: '2024-01-01' }],
    sanitaire: [soin('hS1'), soin('hS2')],
    agnelages: [
      { id: 'hA1', date: '2026-11-02', campagne: 2027, lambs: [{ id: 'hL1', sexe: 'Mâle', eid: '250000045671021', sanitaire: [{ id: 'hLS', date: '2026-11-04', produit: 'Produit B', type: 'Traitement' }] }, { id: 'hL2', sexe: 'Femelle' }] },
      { id: 'hA2', date: '2026-11-02', campagne: 2027, lambs: [{ id: 'hL3', sexe: 'Mâle' }, { id: 'hL4', sexe: 'Femelle', statutFinal: 'mort' }] }] }];
  // d2 : deux copies STRICTEMENT identiques (même instant de saisie) : réunies d'office, sans rien demander
  const copie = id => ({ id, date: '2026-11-22', campagne: 2027, saisieA: 1795370519426, lambs: [{ id: 'hM' + id, sexe: 'Femelle', eid: '250000045672265' }] });
  DB.brebis.push({ id: 'd2', eid: '250000045651022', statut: 'active', createdAt: 1, echographies: [], notes: [], modesRepro: [], controleLaitier: [], sanitaire: [], mouvements: [], agnelages: [copie('hB1'), copie('hB1-2')] });
  DB.beliers = []; DB.agnelles = [];
  saveData(DB);
});
await (async () => { const d = Date.now(); while (Date.now() - d < 20000) { const f = await fiches(uid); if (f.d1 && f.d1.agnelages && f.d1.agnelages.length === 2) return; await h.dormir(150); } throw new Error('TIMEOUT : fiche d1 sur le serveur'); })();
await (async () => { const d = Date.now(); while (Date.now() - d < 20000) { const f = await fiches(uid); if (f.d2 && f.d2.agnelages && f.d2.agnelages.length === 1) return; await h.dormir(150); } throw new Error('TIMEOUT : copies identiques de d2 réunies d\'office'); })();
await h.attendreServeur(uid, 'brebis', r => { const el = (r.docs.d2 || {}).el || {}; return Object.values(el).some(ent => ent && ent.c && ent.c.indexOf('agnelages:') === 0 && ent.c.indexOf('>') < 0 && Object.values(ent.v || {}).some(v => v && v.s === 1 && v.fu === 1)); }, 'copie identique retirée d\'office : suppression marquée (fu)');
await h.attendreCalme(uid);
// Accueil et Bilan : une mise bas, ses 2 agneaux (la 2e copie n'est pas comptée deux fois)
eq(await pc.page.evaluate(() => { const s = dashboardStatsData(), b = bilanReproductionCampagne(2027); return [s.totalMisesBas, s.totalAgneaux, b.groupes.total.misesBas, b.groupes.total.nes.total, agneauxCampagneRestants().males + agneauxCampagneRestants().femelles]; }),
  [2, 3, 2, 3, 3], 'Accueil et Bilan : même compte (une mise bas par brebis : 2 mises bas, 3 agneaux)');

const tel = await h.ouvrir();
await h.connecter(tel, mail, MDP);
await h.attendre(tel, () => (DB.brebis || []).length === 2 && DB.brebis[0].agnelages.length === 2 && DB.brebis[1].agnelages.length === 1, { timeout: 30000, label: 'le téléphone a les deux copies' });
await h.attendreCalme(uid);
await h.reseau(tel, { coupe: true });     // le téléphone reste hors réseau avec les anciennes copies

// PC : pastille, écran, réunion, Annuler, réunion confirmée
await pc.page.evaluate(() => render('home'));
check(/Doublons à vérifier : 2/.test(await pc.page.textContent('#pastille-doublons')), 'pastille ambre « Doublons à vérifier : 2 »');
await pc.page.click('#pastille-doublons');
eq(await pc.page.evaluate(() => [currentView, document.querySelectorAll('.cf-carte').length]), ['doublons-synchro', 2], 'écran : 2 doublons (mise bas, soin)');
const clicReunir = () => pc.page.evaluate(() => [...document.querySelectorAll('.cf-carte')].find(c => /mises bas/.test(c.textContent)).querySelector('.db-reunir').click());
await pc.page.evaluate(() => { window.__avant = JSON.stringify(DB.brebis[0]); });
await clicReunir();
check(/Mises bas réunies/.test(await pc.page.textContent('.sup-snack')), 'bandeau « Mises bas réunies · Annuler »');
await pc.page.click('#sup-snack-annuler');
eq(await pc.page.evaluate(() => JSON.stringify(DB.brebis[0]) === window.__avant), true, 'Annuler : fiche exacte d\'avant');
await h.attendreCalme(uid);
await pc.page.evaluate(() => render('doublons-synchro'));
await clicReunir();
const reunie = await pc.page.evaluate(() => DB.brebis[0].agnelages.map(a => ({ id: a.id, lambs: a.lambs.map(l => [l.sexe, l.eid || '', l.statutFinal || '', (l.sanitaire || []).length]) })));
eq(reunie, [{ id: 'hA1', lambs: [['Mâle', '250000045671021', '', 1], ['Femelle', '', 'mort', 0]] }], 'réunie : la copie la plus complète (n°, soin) reçoit le devenir que seule l\'autre connaissait');
await pc.page.evaluate(() => [...document.querySelectorAll('.cf-carte')].find(c => /Soin/.test(c.textContent)).querySelector('.db-reunir').click());
eq(await pc.page.evaluate(() => [DB.brebis[0].sanitaire.length, doublonsSynchro().length]), [1, 0], 'soin identique : un seul gardé ; plus aucun doublon');
const fin = await (async () => { const d = Date.now(); let f; while (Date.now() - d < 20000) { f = await fiches(uid); if (f.d1.agnelages.length === 1 && f.d1.sanitaire.length === 1) return f; await h.dormir(150); } throw new Error('TIMEOUT serveur : ' + JSON.stringify(f && f.d1).slice(0, 300)); })();
eq(fin.d1.agnelages[0].lambs.map(l => l.statutFinal || ''), ['', 'mort'], 'serveur : une mise bas réunie');
const brut = (await h.serveur(uid, 'brebis')).docs.d1;
const marque = Object.values(brut.el).find(ent => ent.c === 'agnelages:hA2');
check(marque && Object.values(marque.v).some(v => v && v.s === 1 && v.fu === 1), 'la copie retirée est une suppression MARQUÉE (fu), synchronisée');
await h.attendreCalme(uid);

// le téléphone revient : il avait encore l'ancienne copie (jamais modifiée) et ajoute une note hors réseau ; il ne renvoie pas la copie
await tel.page.evaluate(() => { DB.brebis[0].notes.push({ date: '2026-11-20', texte: 'Note du téléphone' }); saveData(DB); });
await h.reseau(tel, { coupe: false });
await h.attendre(tel, () => DB.brebis[0].agnelages.length === 1 && DB.brebis[0].sanitaire.length === 1 && DB.brebis[0].agnelages[0].lambs[1].statutFinal === 'mort', { timeout: 30000, label: 'le téléphone reçoit la réunion' });
await h.attendreCalme(uid);
const apres = (await fiches(uid)).d1;
eq([apres.agnelages.length, apres.sanitaire.length, apres.notes.map(n => n.texte)], [1, 1, ['Note du téléphone']], 'serveur : l\'ancienne copie n\'est pas revenue, la note du téléphone est arrivée');
eq(await tel.page.evaluate(() => [dashboardStatsData().totalMisesBas, doublonsSynchro().length]), [2, 0], 'téléphone : une mise bas par brebis, aucun doublon');
console.log('OK doublons : copies strictement identiques réunies d\'office ; Accueil = Bilan, pastille, réunion (plus complète + devenir de l\'autre), Annuler exact, suppression marquée, pas de résurrection.');
await h.fin();
console.log('test_doublons_synchro : OK');
