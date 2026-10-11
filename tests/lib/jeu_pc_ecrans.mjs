/* Jeu SYNTHÉTIQUE partagé par les tests des écrans PC (tableaux, chantier de tri) : brebis, béliers, agnelles, lots, ordonnances, traitement collectif ; à passer à page.evaluate(jeuPcEcrans). Aucune donnée réelle. */
export function jeuPcEcrans() {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.acheteurs = ['Natera', 'Bio Plus']; DB.causesMortalite = ['Mammite', 'Boiterie'];
  DB.produits = { vaccins: ['Bravoxin 10'], antibiotiques: ['Intramicine'], antiparasitaires: ['Ivomec'], antiinflammatoires: [], autres: [] };
  DB.produitsInfo = { Intramicine: { posologie: null, delaiAttente: 7, delaiLait: 7, delaiViande: 28 } };
  const soin = (type, sousType, produit, date, dose) => ({ type, sousType, produit, date, dose, quantiteCc: dose, intervenant: 'Éleveur', dureeJours: 1, bio: false, delaiLaitJours: 7, delaiViandeJours: 28, numeroOrdonnance: '' });
  const cl = (n, q, an) => ({ controle: n, quantite: q, anomalie: an || null, date: '2026-12-10', campagne: 2026 });
  const B1 = fiche(eid(9, 17), { id: 'B1', numeroCourtTravailSieol: '17', numeroLongTravailSieol: '021017', dateEntree: '2024-01-01',
    echographies: [{ date: '2026-07-20', stade: 'Confirmée', agneaux: 'Double', campagne: 2026 }, { date: '2025-07-18', stade: 'Confirmée', agneaux: 'Simple', campagne: 2025 }],
    agnelages: [{ date: '2026-11-10', campagne: 2026, lambs: [
      { eid: eid(6, 801), sexe: 'Mâle', sanitaire: [soin('Traitement', null, 'Séléphérol', '2026-11-10', 2)], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-11-10' }] },
      { eid: eid(6, 802), sexe: 'Femelle', sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-11-10' }] }] },
      { date: '2025-11-02', campagne: 2025, lambs: [{ eid: eid(5, 701), sexe: 'Mâle', statutFinal: 'vendu', mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2025-11-02' }, { type: 'Vendu', acheteur: 'Natera', date: '2026-01-15' }] }] }],
    sanitaire: [soin('Traitement', 'Antibiotique', 'Intramicine', '2026-12-01', 8), soin('Vaccin', null, 'Bravoxin 10', '2026-09-12', 2)],
    controleLaitier: [cl(1, 1520), cl(2, 1640), cl(3, 1210, 2)],
    notes: [{ id: 'n1', categorie: 'Boiterie', texte: 'Boite de l\'arrière gauche, à surveiller.', date: '2026-11-20' }] });
  const reste = [[0, 23, 'Vide confirmée'], [1, 31], [2, 8], [3, 44], [9, 52], [0, 60], [4, 71]].map(([an, n, v], i) => fiche(eid(an, n), { id: 'B' + (i + 2), numeroCourtTravailSieol: i % 2 ? String(30 + i) : null,
    echographies: v ? [{ date: '2026-10-12', resultat: 'Vide', stade: 'Vide', campagne: 2026 }] : [], agnelages: i % 3 === 0 ? [{ date: '2026-11-0' + (i + 1), campagne: 2026, lambs: [{ eid: eid(6, 810 + i), sexe: 'Femelle', sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-11-0' + (i + 1) }] }] }] : [] }));
  DB.brebis = [B1].concat(reste);
  DB.beliers = [fiche(eid(9, 90), { id: 'bel1', statut: 'actif', numeroTravailSieol: '540', dateEntree: '2023-09-01', sanitaire: [soin('Traitement', 'Antiparasitaire', 'Ivomec', '2026-09-10', 4)], notes: [{ id: 'nb', categorie: 'Sinus', texte: 'Bon reproducteur.', date: '2026-10-01' }] }),
    fiche(eid(8, 91), { id: 'bel2', statut: 'actif' }), fiche(eid(7, 92), { id: 'bel3', statut: 'vendu', mouvements: [{ type: 'Entrée', date: '2023-01-01' }, { type: 'Vente reproduction', acheteur: 'Bio Plus', date: '2026-10-02' }] })];
  DB.agnelles = [fiche(eid(6, 41), { id: 'ag1', origine: 'née', motherEid: B1.eid, dateEntree: '2026-11-30', pere: '', mere: '', numeroCourtTravailSieol: '41', sanitaire: [soin('Traitement', 'Anti-inflammatoire', 'Finadyne', '2026-12-02', 2)], notes: [{ id: 'na', categorie: 'Mammite', texte: 'RAS.', date: '2026-12-05' }] }),
    fiche(eid(6, 42), { id: 'ag2', origine: 'achetée', dateEntree: '2026-09-20', pere: 'Bélier X', mere: 'Brebis Y', mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2026-09-20' }] })];
  DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} }; DB.mouvementsCollectifs = [];
  DB.ordonnances = [{ id: 'O1', numero: 'ORD-1', date: '2026-10-01', veterinaire: 'Dr Martin', produits: ['Intramicine'] }];
  DB.lots = [{ id: 'L1', nom: 'IA septembre', type: 'reproduction', mode: 'IA', cible: 'Brebis', campagneMisesBas: 2026, dateEvenement: '2026-07-01', membres: [B1.eid, reste[0].eid] }, { id: 'L2', nom: 'Réforme', type: 'reforme', cible: 'Brebis', membres: [reste[1].eid] }];
  DB.traitementsCollectifs = [{ id: 'TC1', date: '2026-09-01', produit: 'Ivomec', membres: [B1.eid, reste[0].eid] }];
  window.EID = eid; window.__avant = JSON.stringify(DB);
}
