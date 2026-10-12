/* Jeux synthétiques (aucun EID réel) partagés par les tests Registre d'élevage et Contrôle laitier.
   Fonctions AUTONOMES : sérialisées dans la page par page.evaluate(fn). */
export function jeuRegistre() {
  DB = migrateData({});
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  const soin = (type, sousType, produit, date, dose, ord) => ({ type, sousType, produit, date, dose, numeroOrdonnance: ord || '' });
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.brebis = [
    fiche(eid(1, 17), { sanitaire: [soin('Traitement', 'Antibiotique', 'Intramicine', '2026-09-20', '8 cc'), soin('Vaccin', null, 'Bravoxin 10', '2026-01-12', '2 cc', 'ORD-1')],
      agnelages: [{ date: '2026-02-10', campagne: 2025, lambs: [{ sexe: 'Mâle', eid: eid(6, 501), sanitaire: [soin('Traitement', null, 'Séléphérol', '2026-02-10', '2 cc')], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-02-10' }] }, { sexe: 'Mort-né' }] }] }),
    fiche(eid(2, 18), { sanitaire: [soin('Traitement', 'Antiparasitaire', 'Ivomec', '2026-09-18', '4 cc')] }),
    fiche(eid(3, 21), { sanitaire: [soin('Autre', 'Soin de plaie', 'Aluspray', '2025-11-10', '')],
      mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }, { type: 'Vente', cause: 'Réforme', date: '2026-08-01' }], statut: 'vendue' })
  ];
  DB.beliers = [fiche(eid(4, 31), { sanitaire: [soin('Autre', 'Soin de plaie', 'Aluspray', '2026-09-10', '')] })];
  DB.agnelles = [fiche(eid(5, 41), { sanitaire: [soin('Traitement', 'Anti-inflammatoire', 'Finadyne', '2026-09-05', '2 cc')] })];
  DB.lots = [];
  // animaux sortis, conservés au registre (archive) : une brebis morte, un bélier vendu
  DB.registre = {
    brebis: { [eid(6, 51)]: { sanitaire: [soin('Vaccin', null, 'Bravoxin 10', '2025-12-01', '2 cc')], agnelages: [{ date: '2025-12-20', campagne: 2025, lambs: [{ sexe: 'Femelle', eid: eid(7, 502) }] }], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2023-01-01' }, { type: 'Mort', cause: 'Maladie', date: '2026-03-01' }], controleLaitier: [], modesRepro: [] } },
    beliers: { [eid(7, 61)]: { sanitaire: [], agnelages: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2022-01-01' }, { type: 'Vente', cause: 'Réforme', date: '2025-09-01' }], controleLaitier: [], modesRepro: [] } },
    agnelles: {}
  };
}
export function jeuControleLaitier(avecControles) {
  DB = migrateData({});
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  const cl = (n, q, an) => ({ controle: n, quantite: q, anomalie: an || null, date: '2027-01-20', campagne: 2026 });
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  const mb = (d, lambs) => ({ date: d, campagne: 2026, lambs: lambs || [{ sexe: 'Mâle' }] });
  const valeurs = [[1520, 1640, 1210], [1380, 960, 880], [1710, 1820, 1340], [1250, 820, 690], [1460, 1530, null], [1340, 980, 760], [1800, 1910, 1480]];
  const brebis = valeurs.map((v, i) => fiche(eid(3, 100 + i), {
    numeroCourtTravailSieol: String(950 + i), agnelages: [mb('2026-11-' + String(10 + i).padStart(2, '0'))],
    controleLaitier: avecControles ? v.map((q, k) => q === null ? null : cl(k + 1, q, i === 1 && k === 1 ? 2 : null)).filter(Boolean) : []
  }));
  brebis.push(fiche(eid(3, 200), { numeroCourtTravailSieol: '8133', agnelages: [mb('2026-11-20', [{ sexe: 'Mâle', statutFinal: 'vendu' }])] }));   // sans contrôle, attendue
  brebis.push(fiche(eid(3, 201), { numeroCourtTravailSieol: '8134', agnelages: [mb('2026-12-01')] }));                                        // sans contrôle, pas encore attendue
  brebis.push(fiche(eid(3, 202), { numeroCourtTravailSieol: '8135' }));                                                                       // pas de mise bas
  brebis.push(fiche(eid(3, 300), { statut: 'vendue', agnelages: [mb('2026-11-25')] }));                                                       // vendue : hors liste
  DB.brebis = brebis; DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  DB.resumeControleLaitier = [];
}
