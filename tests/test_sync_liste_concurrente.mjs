/* Test 7 de l'audit (lot 4) : deux appareils HORS RÉSEAU sur la même brebis ; l'un SUPPRIME un soin, l'autre en AJOUTE un. Au retour du
   réseau (l'appareil qui ajoute repart en premier), la liste des soins est réécrite d'un bloc par le second : c'est la PERTE constatée avant
   la livraison 2 du lot 4 (rangement élément par élément). Ce test FIXE ce constat (l'ajout de l'autre appareil est perdu, sans message) ;
   la livraison 2 le retournera en « aucune perte ». Faux backend Firestore local, comptes jetables, aucune donnée réelle. */
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
await h.attendreServeur(uid, 'brebis', r => produits(r).join() === 'Produit A,Produit B', 'brebis b1 et ses 2 soins sur le serveur');
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
await h.attendreServeur(uid, 'brebis', r => produits(r).includes('Produit C'), 'l\'ajout du téléphone arrive sur le serveur');
await h.reseau(pc, { coupe: false });
await h.attendreServeur(uid, 'brebis', r => !produits(r).includes('Produit A'), 'la suppression du PC arrive sur le serveur');
await h.attendreCalme(uid);
const fin = produits(await h.serveur(uid, 'brebis'));
// CONSTAT avant la livraison 2 : la suppression du PC a réécrit toute la liste ; l'ajout du téléphone (« Produit C ») est perdu, sans message.
check(fin.join() === 'Produit B', 'constat (avant la livraison 2) : l\'ajout de l\'autre appareil est perdu : ' + JSON.stringify(fin));
console.log('CONSTAT test 7 : un appareil supprime un soin, l\'autre en ajoute un hors réseau → serveur = ' + JSON.stringify(fin) + ' (« Produit C » perdu). À corriger par la livraison 2.');
await h.fin();
console.log('test_sync_liste_concurrente : OK (constat fixé)');
