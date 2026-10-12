/* Jeu synthétique + cas PDF pour le chantier « PDF harmonisés » : installe dans la page window.CAS_PDF = { nom: async () => octets } pour tous les PDF concernés
   (Registre x3, Traitements 12 mois, Sous délai, Contrôle laitier, Bilan de lactation, Bilan par âge, Bilan complet, Lot IA, Lot Éponge). Fonction AUTONOME
   (sérialisée dans la page par page.evaluate). saveOrShareBinaryFile et saveData sont REMPLACÉS ; aucune donnée réelle. */
export function installerCasPdf() {
  window.__saves = 0; saveData = function () { window.__saves++; return true; };
  window.__sorties = [];
  saveOrShareBinaryFile = async function (nom, bytes) { window.__sorties.push({ nom, bytes: new Uint8Array(bytes) }); };
  window.__vers = async (fn) => { window.__sorties = []; const r = await fn(); return r instanceof Uint8Array ? r : window.__sorties[0].bytes; };
  window.eid = (c, n) => '2500162999' + c + String(n).padStart(4, '0');
  window.fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  window.jeu = (nSemaines) => {
    const plans = {
      adultes: { n: 296, doubles: 59, mortNes: 8, femelles: 175, males: 172, mortsF: 13, mortsM: 12, vides: 30, chiffres: [3, 4], entree: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }] },
      antenaises: { n: 67, doubles: 5, mortNes: 6, femelles: 38, males: 28, mortsF: 7, mortsM: 6, vides: 8, chiffres: [5], entree: [{ type: 'Entrée', cause: 'Renouvellement (agnelle devenue brebis)', date: '2025-10-01' }] }
    };
    const poids = nSemaines ? Array.from({ length: nSemaines }, (_, i) => 1 + (i % 7)) : [12, 38, 71, 84, 63, 41, 26, 15, 9, 4];
    const jours = []; poids.forEach((w, i) => { for (let k = 0; k < w; k++) jours.push(new Date(Date.UTC(2026, 0, 5 + i * 7 + (k % 7))).toISOString().slice(0, 10)); });
    while (jours.length < 363) jours.push('2026-02-20');
    const brebis = []; let c = 0, ji = 0;
    for (const nom of ['adultes', 'antenaises']) {
      const p = plans[nom];
      const sexes = [].concat(Array(p.mortNes).fill('Mort-né'), Array(p.femelles).fill('Femelle'), Array(p.males).fill('Mâle'));
      let mF = p.mortsF, mM = p.mortsM;
      const lambs = sexes.map(s => { const l = { sexe: s }; if (s === 'Femelle' && mF > 0) { l.statutFinal = 'mort'; l.mouvements = [{ type: 'Mort', date: '2026-02-20' }]; mF--; } else if (s === 'Mâle' && mM > 0) { l.statutFinal = 'mort'; l.mouvements = [{ type: 'Mort', date: '2026-02-21' }]; mM--; } return l; });
      let k = 0;
      for (let i = 0; i < p.n; i++) { const nb = i < p.doubles ? 2 : 1; brebis.push(fiche(eid(p.chiffres[i % p.chiffres.length], ++c), { mouvements: p.entree, agnelages: [{ date: jours[ji++], campagne: 2025, lambs: lambs.slice(k, k + nb) }] })); k += nb; }
      for (let i = 0; i < p.vides; i++) brebis.push(fiche(eid(p.chiffres[i % p.chiffres.length], ++c), { mouvements: p.entree }));
    }
    DB.campagneDebut = 2025; DB.campagneDateDemarrage = '2025-10-01'; DB.campagneInitialisee = true;
    DB.brebis = brebis; DB.beliers = []; DB.agnelles = []; DB.lots = [];
    DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  };
  window.jeuBilanSynth = () => { DB = migrateData({}); window.jeu(); window.__saves = 0; saveData = function () { window.__saves++; return true; }; };
  window.jeuRegistreSynth = () => { window.__jeuRegistre(); };
  window.CAS_PDF = {
    registre_agnelage: async () => { jeuRegistreSynth(); registreView = 'agnelage'; registreFiltre = ''; return window.__vers(() => exportRegistrePdf()); },
    registre_mouvements: async () => { jeuRegistreSynth(); registreView = 'mouvements'; registreFiltre = ''; return window.__vers(() => exportRegistrePdf()); },
    registre_sanitaire: async () => { jeuRegistreSynth(); registreView = 'sanitaire'; registreFiltre = ''; return window.__vers(() => exportRegistrePdf()); },
    registre_sanitaire_filtre: async () => { jeuRegistreSynth(); registreView = 'sanitaire'; registreFiltre = '17'; return window.__vers(() => exportRegistrePdf()); },
    traitements12: async () => { jeuRegistreSynth(); return window.__vers(() => exportTraitements12Pdf()); },
    sous_delai: async () => { jeuRegistreSynth(); DB.produitsInfo = { Intramicine: { delaiAttente: 30 }, Ivomec: { delaiAttente: 20 } }; DB.brebis[1].sanitaire.push({ type: 'Traitement', sousType: 'Antiparasitaire', produit: 'Ivomec', date: '2026-09-25', dose: '4 cc' });
      render('sous-delai'); return window.__vers(async () => { document.getElementById('btn-export-sous-delai-pdf').click(); }); },
    controle_laitier: async () => window.__vers(() => exportControleLaitierPdf([
      { courtSieol: '17', c1: 1200, c2: 1350, c3: null, dateMab: '2026-02-10', cumul: 2550 }, { courtSieol: '18', c1: null, c2: null, c3: null, dateMab: null, cumul: 0 }, { courtSieol: '1021', c1: 980, c2: 1010, c3: 995, dateMab: '2026-01-05', cumul: 2985 }])),
    bilan_lactation: async () => { jeuBilanSynth(); DB.laitTank = [{ date: '2025-11-02', quantite: 4200 }, { date: '2026-01-02', quantite: 5100 }]; return window.__vers(() => exportBilanLactationPdf(2025)); },
    bilan_age: async () => { jeuBilanSynth(); return buildBilanAgeExactPdfBytes(); },
    bilan_complet: async () => { jeuBilanSynth(); return buildBilanCompletPdfBytes(2025); },
    lot_ia: async () => { jeuBilanSynth(); DB.lots = [{ id: 'lia', nom: 'Lot IA test', type: 'reproduction', mode: 'IA', cible: 'Brebis', membres: DB.brebis.slice(0, 60).map(b => b.eid), dateEvenement: '2025-09-05', dateCreation: '2025-09-05' }]; return window.__vers(() => exportLotIaPdf(DB.lots[0])); },
    lot_eponge: async () => { jeuBilanSynth(); DB.lots = [{ id: 'lep', nom: 'Lot éponge test', type: 'reproduction', mode: 'EP', cible: 'Brebis', membres: DB.brebis.slice(0, 60).map(b => b.eid), dateEvenement: '2025-09-05', dateCreation: '2025-09-05' }]; return window.__vers(() => exportLotEpongePdf(DB.lots[0])); }
  };
}
