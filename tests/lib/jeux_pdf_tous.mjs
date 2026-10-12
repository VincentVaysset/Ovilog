/* Tous les PDF de l'application, sur jeux SYNTHÉTIQUES : window.CAS_PDF_TOUS = { nom: async () => octets } (les 11 cas de jeux_pdf.mjs + Tank, Calendrier du tank, Rapport de campagne, Inventaire, Échographies, Déclaration annuelle).
   Fonction AUTONOME (sérialisée dans la page par page.evaluate, après installerCasPdf). Le nom d'exploitation « Ferme du Test » est posé dans chaque jeu (migrateData enveloppée), sauf si window.__nomExploitation est '' (cas du repli « Ovilog »). saveData et saveOrShareBinaryFile sont REMPLACÉS ; aucune donnée réelle. */
export function installerCasPdfTous() {   // à appeler APRÈS page.evaluate(installerCasPdf)
  window.__nomExploitation = 'Ferme du Test';
  const migrer = migrateData;
  migrateData = function (d) { const r = migrer(d); r.exploitation = Object.assign(r.exploitation || {}, { nom: window.__nomExploitation }); return r; };
  const u8 = (x) => x;
  const prod = () => {
    DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
    DB.campagneDebut = 2026; DB.campagneInitialisee = true;
    DB.laitTank = [{ date: '2025-10-01', quantite: 200 }, { date: '2025-12-04', quantite: 300 }, { date: '2026-07-31', quantite: 130 }];
    DB.prelevementsQualite = [{ id: 'p1', date: '2025-12-05', volumeLait: 310, tb: 70, tp: 55, cellules: 400000, floreTotale: 20000, coliformes: 40, butyriques: 100, listeria: 'negatif', salmonelles: 'negatif', campagne: 2026 }];
    DB.penalitesBacterio = [{ id: 'pen1', dateDebut: '2026-07-30', dateFin: '2026-07-31', cause: 'salmonelles', litrageL: 1200, commentaire: 'test' }];
    DB.parametresPrixLait = [{ campagne: 0, coefficientMsu: 12, prixReference: null, msuReference: null }];
  };
  Object.assign(window.CAS_PDF, {
    tank: async () => { prod(); return u8(buildTankPdfBytes(2025)); },
    calendrier: async () => { prod(); return u8(buildCalendrierTankPdfBytes(2025)); },
    rapport: async () => { prod(); return u8(buildRapportCampagnePdfBytes(2025)); },
    inventaire: async () => { window.jeuBilanSynth(); return u8(buildInventairePdfBytes('brebis', DB.brebis.filter(s => (s.statut || 'active') === 'active').slice(0, 30), '')); },
    echographies: async () => { window.jeuBilanSynth(); DB.brebis.slice(0, 20).forEach((b, i) => { b.echographies = [{ date: '2026-08-01', campagne: 2026, type: 'constat', stade: i % 3 ? 'Pleine' : 'Vide' }]; }); return u8(buildEchosPcPdfBytes(donneesEchosPc())); },
    declaration: async () => { window.jeuBilanSynth(); return u8(buildDeclarationAnnuellePdfBytes(2026, declarationAnnuelleChiffres(2026))); }
  });
  window.CAS_PDF_TOUS = window.CAS_PDF;
}
