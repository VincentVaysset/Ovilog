/* Test 7 de l'audit (lot 4) : deux appareils HORS RÉSEAU sur la même brebis ; l'un SUPPRIME un soin, l'autre en AJOUTE un. Avant la livraison 2,
   la liste des soins était réécrite d'un bloc par le second appareil revenu au réseau : l'ajout de l'autre était PERDU, sans message. Depuis le
   rangement par versions (lot 4, livraison 2), chaque soin est rangé à part : la suppression ET l'ajout sont gardés, sur le serveur et sur les
   deux appareils, sans conflit. Faux backend Firestore local, comptes jetables, aucune donnée réelle. */
import { demarrerHarnais } from './lib/harnais_sync.mjs';

const h = await demarrerHarnais();
const { check } = h;
const MDP = 'AuditTest12345!';
const mail = 'sync-liste-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '@ovilog-audit-jetable.test';
const produits = r => ((r.docs.b1 || {}).sanitaire || []).map(x => x.produit).sort();

const pc = await h.ouvrir({ desktop: true });
await h.inscrire(pc, mail, MDP);
await h.attendre(pc, () => window.OvilogSync.getState().loggedIn, { label: 'PC connecté' });
await pc.page.evaluate(() => {
  const soin = (p, d) => ({ date: d, produit: p, type: 'Traitement', dose: '2 cc' });
  DB.campagneDebut = 2027; DB.campagneInitialisee = true;
  DB.brebis = [{ id: 'b1', eid: '250000045651001', statut: 'active', createdAt: 1, echographies: [], agnelages: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [],
    sanitaire: [soin('Produit A', '2026-11-01'), soin('Produit B', '2026-11-02')] }];
  DB.beliers = []; DB.agnelles = [];
  saveData(DB);
});
const uid = pc.uid;
const fiches = () => h.fiches(uid, 'brebis');
const attendreFiches = async (pred, label) => { const d = Date.now(); while (Date.now() - d < 20000) { if (pred(await fiches())) return; await h.dormir(150); } throw new Error('TIMEOUT côté serveur : ' + label); };
await attendreFiches(r => produits(r).join() === 'Produit A,Produit B', 'brebis b1 et ses 2 soins sur le serveur');
await h.attendreCalme(uid);

const tel = await h.ouvrir();
await h.connecter(tel, mail, MDP);
await h.attendre(tel, () => (DB.brebis || []).some(b => b.id === 'b1' && b.sanitaire.length === 2), { timeout: 30000, label: 'le téléphone reçoit b1 et ses 2 soins' });
await h.attendreCalme(uid);

// hors réseau : le PC supprime « Produit A », le téléphone ajoute « Produit C »
await h.reseau(pc, { coupe: true }); await h.reseau(tel, { coupe: true });
await pc.page.evaluate(() => { const b = DB.brebis.find(x => x.id === 'b1'); b.sanitaire = b.sanitaire.filter(s => s.produit !== 'Produit A'); saveData(DB); });
await tel.page.evaluate(() => { const b = DB.brebis.find(x => x.id === 'b1'); b.sanitaire.push({ date: '2026-11-20', produit: 'Produit C', type: 'Traitement', dose: '1 cc' }); saveData(DB); });
await h.dormir(500);
// retour du réseau : le téléphone d'abord, puis le PC
await h.reseau(tel, { coupe: false });
await attendreFiches(r => produits(r).includes('Produit C'), 'l\'ajout du téléphone arrive sur le serveur');
await h.reseau(pc, { coupe: false });
await attendreFiches(r => !produits(r).includes('Produit A'), 'la suppression du PC arrive sur le serveur');
await h.attendreCalme(uid);
const fin = produits(await fiches());
check(fin.join() === 'Produit B,Produit C', 'aucune perte : la suppression du PC et l\'ajout du téléphone sont gardés : ' + JSON.stringify(fin));
const local = d => d.page.evaluate(() => DB.brebis.find(x => x.id === 'b1').sanitaire.map(x => x.produit).sort().join());
await h.attendre(pc, () => DB.brebis.find(x => x.id === 'b1').sanitaire.map(x => x.produit).sort().join() === 'Produit B,Produit C', { label: 'le PC a les deux changements' });
await h.attendre(tel, () => DB.brebis.find(x => x.id === 'b1').sanitaire.map(x => x.produit).sort().join() === 'Produit B,Produit C', { label: 'le téléphone a les deux changements' });
check(await pc.page.evaluate(() => window.OvilogSync.conflits().length) === 0 && await tel.page.evaluate(() => window.OvilogSync.conflits().length) === 0, 'éléments différents : aucun conflit signalé');
console.log('OK test 7 : un appareil supprime un soin, l\'autre en ajoute un hors réseau → serveur et appareils = ' + JSON.stringify(fin) + ' (' + await local(pc) + '), aucun conflit.');
await h.fin();
console.log('test_sync_liste_concurrente : OK');
