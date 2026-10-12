/* Teste le chantier "Brebis à régulariser" (Bilan de campagne > Incohérences) :
   1. Une brebis avec échographie SEULE (gestante) cette campagne doit
      apparaître dans "À régulariser".
   2. Une brebis avec mise bas cette campagne ne doit PAS apparaître (doit
      apparaître dans "Ont mis bas").
   3. Une brebis avec vide définitive cette campagne ne doit PAS apparaître
      (doit apparaître dans "Vides définitives").
   4. Compte sur les vraies données corrigées (428 actives) : les 428
      doivent apparaître dans "À régulariser" (aucune mise bas/vide
      définitive encore taguée campagne 2026 dans ces données).
   5. statutReproductionCampagne(), les badges de l'onglet Brebis et de la
      fiche brebis restent STRICTEMENT inchangés (aucune régression).
   6. Les groupes "Ont mis bas"/"Vides définitives" et l'alerte
      d'incohérence (mise bas + vide définitive la même campagne) restent
      inchangés.
   Aucune synchro cloud nécessaire ici (test de logique/affichage pur, DB
   manipulée directement) -- aucune donnée réelle modifiée. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR, EXPORT_ORIGINAL, EXPORT_CORRIGE, lireExport, exportPresent } from './lib/config.mjs';
import { readFileSync } from 'fs';

const correctJson = lireExport(EXPORT_CORRIGE);
const actives428 = correctJson.brebis.filter(s => (s.statut || 'active') === 'active');
console.log('Données réelles corrigées chargées : ' + actives428.length + ' brebis actives, campagneDebut=' + correctJson.campagneDebut + '.');
if (actives428.length !== 428) throw new Error('FAIL (infra test) : attendu 428 actives dans le fichier corrigé, obtenu ' + actives428.length);

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage();
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

function brebisVide(id, eid, extra) {
  return Object.assign({
    id, eid, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [],
    controleLaitier: [], modesRepro: [], mouvements: [], videesDefinitives: []
  }, extra || {});
}

// ============================================================
// 1-3) Cas synthétiques précis.
// ============================================================
await page.evaluate(() => {
  DB.campagneDebut = 2026;
  DB.campagneInitialisee = true;
  DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
}, );
await page.evaluate((args) => {
  DB.brebis = [
    args.brebisEchoSeule,
    args.brebisMiseBas,
    args.brebisVideDef,
    args.brebisSansRien
  ];
  saveData(DB);
}, {
  brebisEchoSeule: brebisVide('echo-seule', '250016200000001', { echographies: [{ campagne: 2026, date: '2026-10-05', stade: 'Confirmée' }] }),
  brebisMiseBas: brebisVide('mise-bas', '250016200000002', { agnelages: [{ id: 'ag1', date: '2026-11-01', campagne: 2026, lambs: [{ sexe: 'Femelle' }] }] }),
  brebisVideDef: brebisVide('vide-def', '250016200000003', { videesDefinitives: [{ campagne: 2026, date: '2026-10-10' }] }),
  brebisSansRien: brebisVide('sans-rien', '250016200000004')
});

// Isole le contenu de CHAQUE carte par son badge (À régulariser / Ont mis
// bas / Vides définitives) -- vérifier juste "l'id apparaît quelque part
// dans la page" ne suffit pas, une brebis avec mise bas apparaît forcément
// QUELQUE PART (dans sa propre carte) ; ce qui compte est la carte exacte.
const resultatSynthetique = await page.evaluate(() => {
  parametresTab = undefined;
  bilanCampagneTab = 'incoherences';
  render('bilan-campagne');
  return {
    html: document.getElementById('app').innerHTML,
    idsParBadge: (() => {
      const out = {};
      document.querySelectorAll('.badge').forEach(badge => {
        const label = badge.textContent.trim();
        const card = badge.closest('.card');
        if (!card) return;
        const ids = Array.from(card.querySelectorAll('.bilan-eid-link')).map(el => el.dataset.id);
        out[label] = (out[label] || []).concat(ids);
      });
      return out;
    })(),
    statutsReels: {
      'echo-seule': statutReproductionCampagne(DB.brebis.find(s => s.id === 'echo-seule')),
      'mise-bas': statutReproductionCampagne(DB.brebis.find(s => s.id === 'mise-bas')),
      'vide-def': statutReproductionCampagne(DB.brebis.find(s => s.id === 'vide-def')),
      'sans-rien': statutReproductionCampagne(DB.brebis.find(s => s.id === 'sans-rien'))
    }
  };
});

// statutReproductionCampagne() -- jamais modifiée -- doit renvoyer ses VRAIES valeurs d'origine.
if (resultatSynthetique.statutsReels['echo-seule'] !== 'Gestante (en cours)') {
  throw new Error('FAIL point 5: statutReproductionCampagne doit rester inchangée (Gestante (en cours) attendu pour echo-seule), obtenu ' + resultatSynthetique.statutsReels['echo-seule']);
}
if (resultatSynthetique.statutsReels['mise-bas'] !== 'Mise bas' || resultatSynthetique.statutsReels['vide-def'] !== 'Vide définitive' || resultatSynthetique.statutsReels['sans-rien'] !== 'Aucune info repro') {
  throw new Error('FAIL point 5: statutReproductionCampagne doit rester inchangée pour les 3 autres cas, obtenu ' + JSON.stringify(resultatSynthetique.statutsReels));
}
console.log('OK point 5: statutReproductionCampagne() renvoie EXACTEMENT les mêmes valeurs qu\'avant ce chantier (Gestante/Mise bas/Vide définitive/Aucune info repro) -- jamais modifiée.');

// Vérifie la présence des 4 brebis dans les CARTES exactes (badge précis),
// pas juste "quelque part sur la page".
const aRegulariserIds = resultatSynthetique.idsParBadge['À régulariser'] || [];
const ontMisBasIds = resultatSynthetique.idsParBadge['Ont mis bas'] || [];
const videsDefIds = resultatSynthetique.idsParBadge['Vides définitives'] || [];

if (!aRegulariserIds.includes('echo-seule')) {
  throw new Error('FAIL point 1: la brebis avec échographie SEULE (gestante) doit apparaître dans la carte "À régulariser", obtenu ' + JSON.stringify(resultatSynthetique.idsParBadge));
}
console.log('OK point 1: une brebis avec échographie seule (gestante) cette campagne apparaît bien dans la carte "À régulariser".');

if (aRegulariserIds.includes('mise-bas')) {
  throw new Error('FAIL point 2: la brebis avec mise bas cette campagne ne doit PAS apparaître dans "À régulariser".');
}
if (!ontMisBasIds.includes('mise-bas')) {
  throw new Error('FAIL point 2: la brebis avec mise bas cette campagne doit apparaître dans "Ont mis bas", obtenu ' + JSON.stringify(resultatSynthetique.idsParBadge));
}
console.log('OK point 2: une brebis avec mise bas cette campagne N\'apparaît PAS dans "À régulariser" -- elle apparaît bien dans "Ont mis bas".');

if (aRegulariserIds.includes('vide-def')) {
  throw new Error('FAIL point 3: la brebis avec vide définitive cette campagne ne doit PAS apparaître dans "À régulariser".');
}
if (!videsDefIds.includes('vide-def')) {
  throw new Error('FAIL point 3: la brebis avec vide définitive cette campagne doit apparaître dans "Vides définitives", obtenu ' + JSON.stringify(resultatSynthetique.idsParBadge));
}
console.log('OK point 3: une brebis avec vide définitive cette campagne N\'apparaît PAS dans "À régulariser" -- elle apparaît bien dans "Vides définitives".');

if (!aRegulariserIds.includes('sans-rien')) {
  throw new Error('FAIL (sanity) : une brebis sans aucune info doit évidemment apparaître dans "À régulariser".');
}

// Vérifie la présence des libellés attendus et l'absence de l'ancien libellé trompeur.
if (!resultatSynthetique.html.includes('À régulariser')) throw new Error('FAIL: le libellé "À régulariser" doit apparaître.');
if (resultatSynthetique.html.includes('Aucune info repro')) throw new Error('FAIL: l\'ancien libellé trompeur "Aucune info repro" ne doit plus apparaître dans cet onglet (une brebis gestante y est maintenant incluse).');
if (!resultatSynthetique.html.includes('Ont mis bas') || !resultatSynthetique.html.includes('Vides définitives')) {
  throw new Error('FAIL point 6: les groupes "Ont mis bas"/"Vides définitives" doivent rester affichés tels quels.');
}
console.log('OK point 6: les groupes "Ont mis bas" et "Vides définitives" restent affichés avec leurs libellés inchangés.');

// ============================================================
// 6 (suite) : l'alerte d'incohérence (mise bas + vide définitive la même
// campagne) reste inchangée -- ajoute un 5e cas contradictoire.
// ============================================================
await page.evaluate(() => {
  DB.brebis.push(Object.assign({
    id: 'incoherente', eid: '250016200000005', statut: 'active', createdAt: 1, echographies: [], sanitaire: [],
    controleLaitier: [], modesRepro: [], mouvements: []
  }, {
    agnelages: [{ id: 'ag2', date: '2026-11-05', campagne: 2026, lambs: [{ sexe: 'Mâle' }] }],
    videesDefinitives: [{ campagne: 2026, date: '2026-11-10' }]
  }));
  saveData(DB);
  render('bilan-campagne');
});
const htmlApresIncoherente = await page.evaluate(() => document.getElementById('app').innerHTML);
if (!htmlApresIncoherente.includes('Incohérences fin de campagne (1)')) {
  throw new Error('FAIL point 6: l\'alerte "Incohérences fin de campagne" doit toujours se déclencher pour une brebis mise-bas + vide-définitive la même campagne.');
}
console.log('OK point 6: l\'alerte "Incohérences fin de campagne" (mise bas + vide définitive la même campagne) reste inchangée.');

// ============================================================
// 4) Compte sur les vraies données corrigées (428 actives attendues).
// ============================================================
await page.evaluate((brebisReelles) => {
  DB.campagneDebut = 2026;
  DB.campagneInitialisee = true;
  DB.brebis = brebisReelles;
  DB.beliers = []; DB.agnelles = [];
  DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  saveData(DB);
  bilanCampagneTab = 'incoherences';
  render('bilan-campagne');
}, actives428);

const compteReel = await page.evaluate(() => {
  const actives = DB.brebis.filter(s => (s.statut || 'active') === 'active');
  const aRegulariser = actives.filter(s => agnelageCampagneActuelleIdx(s) === -1 && !estVideDefinitiveCampagne(s));
  const match = document.getElementById('app').textContent.match(/(\d+) brebis \(([\d.]+)%\)/);
  return { totalActives: actives.length, aRegulariserCalcule: aRegulariser.length, premierChiffreAffiche: match ? parseInt(match[1], 10) : null };
});
console.log('Résultat sur les vraies données corrigées : ' + compteReel.totalActives + ' actives, ' + compteReel.aRegulariserCalcule + ' à régulariser (calcul), ' + compteReel.premierChiffreAffiche + ' affiché à l\'écran.');
if (compteReel.totalActives !== 428) throw new Error('FAIL (infra test) : attendu 428 actives chargées, obtenu ' + compteReel.totalActives);
if (compteReel.aRegulariserCalcule !== 428) throw new Error('FAIL point 4: attendu 428 brebis "à régulariser" sur les données réelles corrigées, obtenu ' + compteReel.aRegulariserCalcule);
if (compteReel.premierChiffreAffiche !== 428) throw new Error('FAIL point 4: l\'écran doit afficher "428 brebis (100%)" pour le groupe "À régulariser", obtenu ' + compteReel.premierChiffreAffiche);
console.log('OK point 4: sur les vraies données corrigées (428 actives), les 428 apparaissent bien dans "À régulariser" -- conforme à l\'attendu (0 mise bas/vide définitive encore taguée campagne 2026).');

await browser.close();
console.log('\nTOUS LES TESTS "BREBIS À RÉGULARISER" SONT PASSÉS (données réelles corrigées en lecture seule, aucune écriture, aucune donnée modifiée)');
