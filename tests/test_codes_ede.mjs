/* Documents de circulation, étape 1, point 3 : correspondance mouvements d'Ovilog → causes officielles de notification EDE (causeSortieEde,
   causeEntreeEde). Fonctions pures, seul point où vivent les codes : rien n'est écrit sur les fiches, aucun code affiché à l'écran (libellés en mots).
   Prêt / pension : marqueurs sans écran. Agneau vendu sans destination = boucherie présumée. N° fictifs. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage();
const erreurs = [];
page.on('pageerror', e => erreurs.push(e.message));
await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);

const r = await page.evaluate(() => {
  const s = (mv, cat) => { const c = causeSortieEde(mv, cat); return c ? c.code + (c.presume ? '?' : '') : null; };
  const e = mv => { const c = causeEntreeEde(mv); return c ? c.code : null; };
  return {
    brebis: ['Vente', 'Vente reproduction', 'Morte', 'Autoconsommation', 'Perte', SORTIE_INVENTAIRE, 'Vendue', 'Vendue reproduction'].map(t => s({ type: t, date: '2026-11-20' }, 'brebis')),
    beliers: ['Vente', 'Vente reproduction', 'Mort', 'Autoconsommation'].map(t => s({ type: t }, 'beliers')),
    agneaux: [s({ type: 'Vendu' }, 'agneaux'), s({ type: 'Vendu', destination: 'boucherie' }, 'agneaux'), s({ type: 'Vendu', destination: 'reproduction' }, 'agneaux'), s({ type: 'Mort', cause: 'Diarrhée' }, 'agneaux'), s({ type: SORTIE_INVENTAIRE }, 'agneaux')],
    pret: [s({ type: 'Vente', pret: true }, 'brebis'), e({ type: 'Entrée', cause: 'Achat', retourPret: true })],
    entrees: [e({ type: 'Entrée', cause: 'Achat', date: '2026-11-20' }), e({ type: 'Entrée', cause: 'Naissance' }), e({ type: 'Entrée', cause: 'Création (ajout manuel)' }), e({ type: 'Entrée', cause: 'Tri (renouvellement)' }), e({ type: 'Naissance' })],
    vides: [causeSortieEde(null), causeSortieEde('x'), causeEntreeEde(undefined)],
    libelles: ['B', 'E', 'M', 'C', 'H', 'A', 'P'].map(c => LIBELLES_CAUSES_EDE[c]),
    objet: causeSortieEde({ type: 'Vendu' }, 'agneaux')
  };
});
eq(r.brebis, ['B', 'E', 'M', 'C', null, null, 'B', 'E'], 'brebis : vente = boucherie, vente reproduction = élevage, morte, autoconsommation ; perte et inventaire sans code ; anciens noms reconnus');
eq(r.beliers, ['B', 'E', 'M', 'C'], 'béliers');
eq(r.agneaux, ['B?', 'B', 'E', 'M', null], 'agneau vendu : boucherie présumée sans destination, destination respectée ; mort ; inventaire sans code');
eq(r.pret, ['H', 'P'], 'prêt / pension : marqueurs sans écran');
eq(r.entrees, ['A', null, null, null, null], 'entrées : seul l\'achat est notifié (naissance, création, tri : rien)');
eq(r.vides, [null, null, null], 'valeurs vides : rien');
eq(r.libelles, ['Boucherie', 'Élevage (reproduction)', 'Mort', 'Autoconsommation', 'Prêt ou pension', 'Achat', 'Retour de prêt ou pension'], 'libellés en mots simples');
eq(r.objet, { code: 'B', libelle: 'Boucherie', presume: true }, 'forme du résultat');

// fonction pure : une fiche passée n'est jamais modifiée
eq(await page.evaluate(() => { const mv = { type: 'Vendu', acheteur: 'Acheteur C', date: '2026-11-20' }; const avant = JSON.stringify(mv); causeSortieEde(mv, 'agneaux'); causeEntreeEde(mv); return JSON.stringify(mv) === avant; }), true, 'mouvement inchangé');
eq(erreurs, [], 'aucune erreur de page');
await browser.close();
console.log('test_codes_ede : OK');
