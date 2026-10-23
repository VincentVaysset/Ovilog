/* Jeu SYNTHÉTIQUE « Soins sans indicateur bio » (élevage bio, soins de la 1.0.198 sans indicateur, un soin d'un registre archivé, un soin d'agneau) ; à passer à page.evaluate(jeuSoinsSansBio, bio). Aucune donnée réelle. */
export function jeuSoinsSansBio(bio) {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  window.__backups = []; window.__backupOk = { ok: true };
  sauvegardeVisibleAvantMutation = async (nom, data) => { window.__backups.push({ nom, avant: JSON.stringify(data) }); return window.__backupOk; };
  const eid = (an, n) => '250000012' + '9' + an + String(n).padStart(5, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign({}, DB.exploitation, { elevageBio: !!bio });
  DB.produits = { vaccins: [], antibiotiques: ['Intramicine'], antiparasitaires: [], antiinflammatoires: [], autres: ['Séléphérol'] };
  const info = (l, v) => ({ posologie: null, delaiAttente: l, delaiLait: l, delaiViande: v, surOrdonnance: false, reserveVeterinaire: false });
  DB.produitsInfo = { Intramicine: info(7, 28), 'Séléphérol': info(0, 28) };
  const soin = (date, duree, lait, viande, o) => Object.assign({ type: 'Traitement', sousType: 'Antibiotique', produit: 'Intramicine', date, quantiteCc: 8, voie: 'Intramusculaire', dureeJours: duree, intervenant: 'Éleveur', commentaire: '', delaiLaitJours: lait, delaiViandeJours: viande }, o || {});
  const A = fiche(eid(3, 1), { id: 'A', sanitaire: [
    soin('2026-09-20', 1, 7, 28),                                                    // 1.0.198, identique à la fiche : coché
    soin('2026-09-25', 2, 14, 56),                                                   // 1.0.198, délai ≠ fiche (doublé à la main ?) : décoché, à vérifier
    { type: 'Traitement', sousType: 'Antibiotique', produit: 'Intramicine', date: '2026-08-01', quantiteCc: 8, intervenant: 'Éleveur' },   // ancien soin (avant 1.0.198) : non concerné
    soin('2026-09-10', 1, 7, 28, { bio: true, delaiLaitLegalJours: 7, delaiViandeLegalJours: 28, delaiLaitJours: 14, delaiViandeJours: 56, min48h: 'oui' })   // déjà bio : non concerné
  ] });
  A.agnelages = [{ date: '2026-09-25', campagne: 2026, lambs: [{ eid: eid(6, 801), sexe: 'Mâle', sanitaire: [{ type: 'Traitement', sousType: null, produit: 'Séléphérol', dose: '2 cc', date: '2026-09-25', commentaire: 'Injection systématique à la naissance', dureeJours: 1, delaiLaitJours: 0, delaiViandeJours: 28 }] }] }];
  DB.brebis = [A, fiche(eid(3, 2), { id: 'B' })];
  DB.beliers = []; DB.agnelles = []; DB.lots = [];
  DB.registre = { brebis: { [eid(3, 9)]: { eid: eid(3, 9), sanitaire: [soin('2026-09-15', 1, 7, 28)], mouvements: [], agnelages: [] } }, beliers: {}, agnelles: {} };
  window.E = eid;
  window.__avant = JSON.stringify(DB);
}
