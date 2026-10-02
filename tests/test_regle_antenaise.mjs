/* Règle antenaise/brebis du Bilan de reproduction : antenaises = millésime le
   plus jeune parmi les brebis présentes dans la campagne (actives + registre),
   brebis = toutes les autres ; plus d'exclusion « âge 0 ». Avertissement
   (information seule) si aucune agnelle n'est entrée à la date réelle de
   bascule (campagneDateDemarrage). Appliquée à l'écran mobile, aux cartes de
   lots et au PDF « bilan par âge ».
   1. Jeux SYNTHÉTIQUES (aucun EID réel) : renouvellement normal, absence de
      renouvellement, bornes de date, EID illisible, brebis qui met bas puis
      passe au registre, entrée après le démarrage, brebis isolée plus jeune,
      troupeau vide, cohérence lots / tableau / PDF, aucune écriture.
   2. Export réel du 29/09 en LECTURE SEULE (SKIP si absent) : 115 agnelles
      entrées à la date de bascule ; avant (URL_AVANT) / après. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, EXPORT_ORIGINAL, EXPORT_CORRIGE, exportPresent, lireExport } from './lib/config.mjs';
const URL_AVANT = process.env.URL_AVANT || null;
const browser = await chromium.launch(LAUNCH);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

async function ouvrir(url, data) {
  const page = await browser.newPage();
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.evaluate((data) => {
    DB = migrateData(JSON.parse(JSON.stringify(data)));
    window.__saveCalls = 0;
    const o = saveData;
    saveData = function (...a) { window.__saveCalls++; return o.apply(this, a); };
  }, data);
  return page;
}

// ---------------------------------------------------------------- 1. synthétique
const page = await ouvrir(URL_APP, {});
const R = (fn, arg) => page.evaluate(fn, arg);

// Fabrique un troupeau synthétique : tout se passe dans le navigateur.
await R(() => {
  // chiffre d'année = index 10 de l'EID : 4 -> 2024, 5 -> 2025, 6 -> 2026
  window.eid = (chiffre, n) => '2500162999' + chiffre + String(n).padStart(4, '0');
  window.fiche = (eid, o) => Object.assign({
    id: 'f' + eid, eid, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [],
    mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: []
  }, o || {});
  window.miseBas = (lambs) => ({ date: '2026-11-20', campagne: 2026, lambs: lambs.map(s => ({ sexe: s })) });
  window.reset = (brebis, registre) => {
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-09-29';
    DB.brebis = brebis; DB.beliers = []; DB.agnelles = []; DB.lots = [];
    DB.registre = { brebis: registre || {}, beliers: {}, agnelles: {} };
    window.__saveCalls = 0;
  };
  window.renouvelee = (n, o) => fiche(eid(6, n), Object.assign({ mouvements: [{ type: 'Entrée', cause: 'Renouvellement (agnelle devenue brebis)', date: '2026-09-29' }] }, o || {}));
});

// S1 -- renouvellement normal : 3 agnelles 2026, 4 brebis 2025, 2 brebis 2023
let r = await R(() => {
  reset([
    renouvelee(1), renouvelee(2, { agnelages: [miseBas(['Mâle', 'Femelle'])] }), renouvelee(3),
    fiche(eid(5, 1), { agnelages: [miseBas(['Mâle'])] }), fiche(eid(5, 2), { agnelages: [miseBas(['Femelle', 'Femelle', 'Mort-né'])] }),
    fiche(eid(5, 3)), fiche(eid(5, 4)),
    fiche(eid(3, 1), { agnelages: [miseBas(['Mâle', 'Mâle'])] }), fiche(eid(3, 2))
  ]);
  const cohort = campagneCohortPresente();
  const c = classementAntenaisesCampagne(cohort);
  const [a, b] = statsDetailleesParGroupeAge(cohort, c);
  return { n: cohort.length, m: c.millesimeAntenaise, ea: c.effectifAntenaises, eb: c.effectifBrebis, w: c.avertissement, ren: c.renouvellement, a, b, par: statsParAgeExactTroupeau(cohort, c) };
});
check(r.n === 9 && r.m === 2026 && r.ea === 3 && r.eb === 6 && r.w === null && r.ren === true, 'S1 classement : ' + JSON.stringify(r));
check(r.a.presentes === 3 && r.b.presentes === 6 && r.a.presentes + r.b.presentes === r.n, 'S1 plus aucune exclusion : 3 + 6 = 9, obtenu ' + r.a.presentes + ' + ' + r.b.presentes);
check(r.a.misesBas === 1 && r.a.nesTotal === 2 && r.b.misesBas === 3 && r.b.nesTotal === 6 && r.b.mortNes === 1, 'S1 mises bas / nés par groupe : ' + JSON.stringify([r.a, r.b]));
check(r.par.map(l => l.millesime).join() === '2023,2025,2026' && r.par.find(l => l.millesime === 2026).antenaises === true && r.par.filter(l => l.antenaises).length === 1
  && r.par.reduce((s, l) => s + l.presentes, 0) === 9, 'S1 détail par millésime : le millésime le plus jeune apparaît (avant : masqué), somme = population : ' + JSON.stringify(r.par));
console.log('OK S1 renouvellement : antenaises = millésime 2026 (3), brebis 6 ; aucune exclusion ; PDF par millésime contient 2023/2025/2026 (somme 9).');

// S2 -- bornes de l'avertissement (date réelle de bascule, pas le 1er octobre)
r = await R(() => {
  const out = {};
  for (const [nom, date] of [['veille', '2026-09-28'], ['jour', '2026-09-29'], ['lendemain', '2026-09-30']]) {
    reset([fiche(eid(5, 1)), fiche(eid(3, 1)), fiche(eid(6, 1), { mouvements: [{ type: 'Entrée', cause: 'Achat', date }] })]);
    const c = classementAntenaisesCampagne(campagneCohortPresente());
    out[nom] = { ren: c.renouvellement, w: !!c.avertissement, m: c.millesimeAntenaise };
  }
  // aucune agnelle du tout : le millésime 2025 reste classé antenaises, avec avertissement
  reset([fiche(eid(5, 1), { mouvements: [{ type: 'Entrée', cause: 'Renouvellement', date: '2025-09-30' }] }), fiche(eid(3, 1)), fiche(eid(3, 2))]);
  const cohort = campagneCohortPresente(); const c = classementAntenaisesCampagne(cohort);
  const [a, b] = statsDetailleesParGroupeAge(cohort, c);
  out.sansRenouv = { m: c.millesimeAntenaise, w: c.avertissement, a: a.presentes, b: b.presentes, html: bilanReproductionHtml() };
  return out;
});
check(r.veille.ren === false && r.veille.w, 'S2 entrée la veille de la bascule : pas un renouvellement, avertissement');
check(r.jour.ren === true && !r.jour.w && r.lendemain.m === 2025, 'S2 entrée le jour de la bascule : renouvellement ; (lendemain : exclue de la population, millésime 2025)');
check(r.sansRenouv.m === 2025 && r.sansRenouv.a === 1 && r.sansRenouv.b === 2 && /pas de renouvellement/.test(r.sansRenouv.w), 'S2 sans renouvellement : millésime 2025 reste classé antenaises, avertissement, aucun reclassement : ' + JSON.stringify(r.sansRenouv).slice(0, 200));
check(/Aucune agnelle n&#39;est entrée|Aucune agnelle n'est entrée/.test(r.sansRenouv.html), 'S2 l\'avertissement s\'affiche dans l\'écran du bilan');
console.log('OK S2 avertissement : comparé à campagneDateDemarrage (28/09 non, 29/09 oui) ; sans renouvellement le millésime 2025 reste antenaises (1) / brebis (2), bandeau affiché.');

// S3 -- EID illisible : rangée avec les brebis, comptée à part, totaux justes
r = await R(() => {
  reset([renouvelee(1), fiche(eid(5, 1)), fiche('1234', { agnelages: [miseBas(['Mâle'])] })]);
  const cohort = campagneCohortPresente(); const c = classementAntenaisesCampagne(cohort);
  const [a, b] = statsDetailleesParGroupeAge(cohort, c);
  const par = statsParAgeExactTroupeau(cohort, c);
  return { sa: c.sansAnnee, a: a.presentes, b: b.presentes, bMb: b.misesBas, last: par[par.length - 1], total: par.reduce((s, l) => s + l.presentes, 0), html: bilanReproductionHtml() };
});
check(r.sa === 1 && r.a === 1 && r.b === 2 && r.bMb === 1 && r.last.millesime === null && r.last.presentes === 1 && r.total === 3, 'S3 EID illisible : ' + JSON.stringify(r).slice(0, 300));
check(/sans année de naissance lisible/.test(r.html), 'S3 mention affichée dans le bilan');
console.log('OK S3 EID illisible : rangée avec les brebis (2), ligne « Année inconnue » dans le détail, total = 3, mention affichée.');

// S4 -- brebis qui met bas PUIS passe au registre (fiche retirée en cours de campagne)
r = await R(() => {
  const entreeAvant = { type: 'Entrée', cause: 'Achat', date: '2024-01-01' };
  const base = () => [renouvelee(1), fiche(eid(5, 1), { agnelages: [miseBas(['Mâle'])] }), fiche(eid(5, 2)), fiche(eid(5, 3), { videesDefinitives: [{ campagne: 2026 }] })];
  reset(base());
  const sans = { n: campagneCohortPresente().length, taux: tauxReussiteGlobal(campagneCohortPresente()) };
  const partie = fiche(eid(5, 9), { agnelages: [miseBas(['Femelle', 'Mâle'])], mouvements: [entreeAvant, { type: 'Vente', date: '2026-11-25' }] });
  // la même brebis, archivée dans le registre (fiche retirée en entier) -- à côté de 3 autres cas
  const registre = {
    [partie.eid]: { eid: partie.eid, mouvements: partie.mouvements, agnelages: partie.agnelages, dateEntree: '2024-01-01' },
    [eid(5, 8)]: { eid: eid(5, 8), mouvements: [entreeAvant, { type: 'Vente', date: '2026-05-01' }], agnelages: [] },          // sortie AVANT la bascule : absente
    [eid(5, 7)]: { eid: eid(5, 7), mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2026-10-05' }], agnelages: [] },      // entrée APRÈS : absente
    [eid(5, 1)]: { eid: eid(5, 1), mouvements: [entreeAvant], agnelages: [miseBas(['Mâle'])] }                                 // aussi dans DB.brebis : jamais doublée
  };
  reset(base(), registre);
  const cohort = campagneCohortPresente();
  const c = classementAntenaisesCampagne(cohort); const [a, b] = statsDetailleesParGroupeAge(cohort, c);
  const taux = tauxReussiteGlobal(cohort);
  const eids = cohort.map(s => s.eid);
  return { sans, n: cohort.length, presente: eids.includes(partie.eid), sortieAvant: eids.includes(eid(5, 8)), entreeApres: eids.includes(eid(5, 7)), doublon: eids.filter(e => e === eid(5, 1)).length,
    b: b, taux, depuisRegistre: cohort.filter(s => s.depuisRegistre).length, dbIntact: DB.brebis.length };
});
check(r.n === r.sans.n + 1 && r.presente && !r.sortieAvant && !r.entreeApres && r.doublon === 1 && r.depuisRegistre === 1 && r.dbIntact === 4,
  'S4 population : la brebis du registre (mise bas puis vente) est comptée, pas celle sortie avant ni celle entrée après, pas de doublon : ' + JSON.stringify(r));
check(r.b.presentes === 4 && r.b.misesBas === 2 && r.b.nesTotal === 3 && r.b.males === 2 && r.b.femelles === 1, 'S4 ses 2 agneaux comptent dans les mises bas de la campagne : ' + JSON.stringify(r.b));
check(r.sans.taux.misesBas === 1 && r.taux.misesBas === 2 && r.taux.videsDefinitives === 1 && r.sans.taux.taux === 50 && r.taux.taux === 66.7,
  'S4 le taux de réussite change (50 % -> 66,7 %) : une mise bas de plus qui existait déjà, mais n\'était plus visible une fois la fiche retirée : ' + JSON.stringify([r.sans.taux, r.taux]));
console.log('OK S4 brebis qui met bas puis passe au registre : comptée (mises bas +1, agneaux 2), sortie avant / entrée après / doublon DB-registre écartés ; taux de réussite 50 % -> 66,7 % (il pourra changer sur les futures campagnes).');

// S5 -- une brebis isolée plus jeune bascule le classement (comportement documenté), troupeau vide
r = await R(() => {
  reset([renouvelee(1), renouvelee(2), fiche(eid(5, 1)), fiche(eid(6, 99), { mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }] })]);
  const c = classementAntenaisesCampagne(campagneCohortPresente());
  const sansAvert = c.effectifAntenaises;
  reset([]);
  const vide = classementAntenaisesCampagne(campagneCohortPresente());
  const [va, vb] = statsDetailleesParGroupeAge(campagneCohortPresente());
  return { sansAvert, vide: { m: vide.millesimeAntenaise, w: vide.avertissement }, va: va.presentes, vb: vb.presentes, html: bilanReproductionHtml().length > 100, pdf: buildBilanAgeExactPdfBytes().length > 100 };
});
check(r.sansAvert === 3, 'S5 les ewes du millésime le plus jeune (y compris une isolée) sont les antenaises : ' + r.sansAvert);
check(r.vide.m === null && r.vide.w === null && r.va === 0 && r.vb === 0 && r.html && r.pdf, 'S5 troupeau vide : pas d\'erreur, pas d\'avertissement : ' + JSON.stringify(r));
console.log('OK S5 limites : le millésime le plus jeune fait foi (affiché avec son effectif) ; troupeau vide sans erreur ni avertissement.');

// S6 -- cohérence lots / tableau / PDF, aucune écriture
r = await R(() => {
  reset([
    renouvelee(1, { agnelages: [miseBas(['Mâle'])] }), renouvelee(2), renouvelee(3, { agnelages: [miseBas(['Femelle', 'Mâle'])] }),
    fiche(eid(5, 1), { agnelages: [miseBas(['Mâle'])] }), fiche(eid(5, 2)), fiche(eid(3, 1), { agnelages: [miseBas(['Mâle'])] }), fiche(eid(3, 2))
  ]);
  const membres = [eid(6, 1), eid(6, 2), eid(5, 1), eid(3, 1), eid(3, 2)];
  DB.lots = [{ id: 'lot1', type: 'reproduction', mode: 'EP', cible: 'Brebis', nom: 'Lot test', membres, dateCreation: '2026-07-01' }];
  const avant = JSON.stringify(DB);
  const cohort = campagneCohortPresente(); const c = classementAntenaisesCampagne(cohort);
  const [a] = statsDetailleesParGroupeAge(cohort, c);
  const resume = resumeLotParGroupeAge(DB.lots[0], statsLotEpongeParAgeExact(DB.lots[0]), c);
  const html = bilanReproductionHtml();
  const pdf = buildBilanAgeExactPdfBytes();
  const texte = Array.from(pdf).map(x => String.fromCharCode(x)).join('');
  return { resume, antTableau: a.presentes, effLotAnt: resume[0].effectif, effLotBr: resume[1].effectif, html: html.includes('millésime 2026'), ancien: /1 an, première|2 ans et plus/.test(html),
    pdfMarque: /antenaises\\\)/.test(texte), pdfNote: /Antenaises = mill/.test(texte), intact: JSON.stringify(DB) === avant, saves: window.__saveCalls };
});
check(r.effLotAnt === 2 && r.effLotBr === 3 && r.resume[0].label === 'Antenaises (millésime 2026)', 'S6 lot : 2 antenaises (2026) + 3 brebis, même millésime que le tableau : ' + JSON.stringify(r.resume));
check(r.antTableau === 3 && r.html && !r.ancien, 'S6 écran : libellés « millésime 2026 », plus de « 1 an / 2 ans et plus »');
check(r.pdfMarque && r.pdfNote, 'S6 PDF : ligne « (antenaises) » et note de règle présentes');
check(r.intact && r.saves === 0, 'S6 aucune écriture : DB identique après écran + PDF, 0 saveData');
console.log('OK S6 cohérence : lot (2 + 3), tableau (3 antenaises), PDF (ligne antenaises + note) ; DB intacte, 0 saveData.');
await page.close();

// ---------------------------------------------------------------- 2. export réel (lecture seule)
for (const [nom, chemin] of [['corrigé', EXPORT_CORRIGE], ['original', EXPORT_ORIGINAL]]) {
  if (!exportPresent(chemin)) { console.log('SKIP : export ' + nom + ' absent (' + chemin + ')'); continue; }
  const data = lireExport(chemin);
  const apres = await ouvrir(URL_APP, data);
  const m = await apres.evaluate(() => {
    const cohort = campagneCohortPresente(); const c = classementAntenaisesCampagne(cohort);
    const [a, b] = statsDetailleesParGroupeAge(cohort, c);
    const renouvelees = cohort.filter(s => anneeNaissance(s.eid) === c.millesimeAntenaise && (s.mouvements || []).some(x => x.type === 'Entrée' && x.date === DB.campagneDateDemarrage)).length;
    return { n: cohort.length, m: c.millesimeAntenaise, ea: c.effectifAntenaises, eb: c.effectifBrebis, w: c.avertissement, renouvelees, a: a.presentes, b: b.presentes, debut: DB.campagneDateDemarrage };
  });
  console.log('[' + nom + '] cohorte ' + m.n + ' ; millésime ' + m.m + ' : ' + m.ea + ' antenaises / ' + m.eb + ' brebis ; entrées datées du ' + m.debut + ' : ' + m.renouvelees);
  check(m.m === 2026 && m.w === null && m.renouvelees >= 115 && m.ea === m.a && m.eb === m.b && m.a + m.b === m.n, nom + ' : classement attendu (millésime 2026, ≥ 115 entrées datées de la bascule, pas d\'avertissement) : ' + JSON.stringify(m));
  if (nom === 'corrigé') check(m.a === 115 && m.b === 313 && m.n === 428, 'corrigé : 115 antenaises / 313 brebis / 428 présentes, obtenu ' + JSON.stringify(m));
  if (URL_AVANT) {
    const avant = await ouvrir(URL_AVANT, data);
    const ancien = await avant.evaluate(() => {
      const cohort = campagneCohortPresente(); const [a, b] = statsDetailleesParGroupeAge(cohort, campagneRefDate());
      return { n: cohort.length, a: a.presentes, b: b.presentes, taux: tauxReussiteGlobal(cohort) };
    });
    const nouveau = await apres.evaluate(() => { const c = campagneCohortPresente(); return { n: c.length, taux: tauxReussiteGlobal(c) }; });
    check(ancien.n === nouveau.n && JSON.stringify(ancien.taux) === JSON.stringify(nouveau.taux), nom + ' : population et taux de réussite identiques avant/après (registre sans effet sur ces données) : ' + JSON.stringify([ancien, nouveau]));
    console.log('  AVANT : ' + ancien.a + ' antenaises / ' + ancien.b + ' brebis (' + (ancien.n - ancien.a - ancien.b) + ' exclues, âge 0)  ->  APRÈS : ' + m.ea + ' / ' + m.eb + ' (0 exclue) ; population ' + ancien.n + ' = ' + nouveau.n + ', taux de réussite identique.');
    await avant.close();
  }
  // rendu de l'écran et du PDF sans rien écrire
  const ecr = await apres.evaluate(() => {
    const avant = JSON.stringify(DB);
    const html = bilanReproductionHtml(); const pdf = buildBilanAgeExactPdfBytes();
    return { intact: JSON.stringify(DB) === avant, saves: window.__saveCalls, ok: html.length > 500 && pdf.length > 500 };
  });
  check(ecr.intact && ecr.saves === 0 && ecr.ok, nom + ' : écran + PDF sans écriture (DB identique, 0 saveData)');
  await apres.close();
}
console.log('\nTOUS LES TESTS DE LA RÈGLE ANTENAISE SONT PASSÉS (jeux synthétiques ; exports réels en lecture seule s\'ils sont présents)');
await browser.close();
