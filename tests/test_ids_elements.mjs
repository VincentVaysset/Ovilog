/* Identifiant technique de chaque élément de liste (lot 4, livraison 1) : à la lecture de la base (migrateData), chaque élément sans id reçoit
   un id CALCULÉ d'après son contenu, le même sur tous les appareils ; deux éléments identiques d'une même liste sont départagés par leur rang
   (aucun ne disparaît) ; un id déjà présent est gardé ; les agneaux et leurs soins, et les fiches du registre, en ont aussi ; aucun n° modifié ;
   un nouvel élément reçoit à l'enregistrement un id unique tiré au hasard. Garde-fou : un compte au format plus récent que l'appli = rien
   n'est envoyé, bandeau « Mettre à jour l'application ». Jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
const r = await p.evaluate(() => {
  const soin = (prod, d) => ({ date: d, produit: prod, type: 'Traitement', dose: '2 cc' });
  const base = () => ({ brebis: [{ id: 'b1', eid: '250 000045651001', numeroCourtTravailSieol: '0117', statut: 'active', createdAt: 1, echographies: [{ date: '2026-09-01', type: 'gestante' }],
    agnelages: [{ date: '2026-11-02', campagne: 2027, lambs: [{ sexe: 'Mâle', eid: '250000045661001', sanitaire: [soin('Produit A', '2026-11-05')] }, { sexe: 'Mort-né' }] }],
    sanitaire: [soin('Produit A', '2026-11-01'), soin('Produit A', '2026-11-01'), Object.assign(soin('Produit B', '2026-11-02'), { id: 'S-garde' })],
    notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [{ controle: 1, quantite: 900, campagne: 2027 }], modesRepro: [], videesDefinitives: [] }],
    beliers: [], agnelles: [], registrePurgeExceptionnelle20260902: true, registre: { brebis: { '250000045659999': { eid: '250000045659999', sanitaire: [soin('Produit C', '2025-01-01')], mouvements: [{ type: 'Vente', date: '2025-02-01' }], statut: 'vendue' } }, beliers: {}, agnelles: {} } });
  const d1 = migrateData(base()), d2 = migrateData(base());
  const idsDe = d => JSON.stringify(d.brebis.map(f => [f.sanitaire, f.echographies, f.agnelages, f.mouvements, f.controleLaitier].map(l => (l || []).map(x => [x.id, (x.lambs || []).map(a => [a.id, (a.sanitaire || []).map(z => z.id)])]))));
  const memes = idsDe(d1) === idsDe(d2) && JSON.stringify(d1.registre) === JSON.stringify(d2.registre);
  const b = d1.brebis[0];
  const ids = l => (l || []).map(x => x.id);
  // nouvel élément ajouté puis enregistré : id tiré au hasard
  DB = d1; b.sanitaire.push(soin('Produit D', '2026-11-20'));
  saveData(DB);
  return {
    memes,
    soins: ids(b.sanitaire), echo: ids(b.echographies), mb: ids(b.agnelages), agneaux: ids(b.agnelages[0].lambs), soinAgneau: ids(b.agnelages[0].lambs[0].sanitaire),
    mvt: ids(b.mouvements), cl: ids(b.controleLaitier), reg: ids(d1.registre.brebis['250000045659999'].sanitaire),
    numeros: [b.eid, b.numeroCourtTravailSieol, b.agnelages[0].lambs[0].eid],
    idempotent: (() => { const c = JSON.parse(JSON.stringify(d2)); poserIdsElements(c, 'contenu'); return JSON.stringify(c) === JSON.stringify(d2); })()
  };
});
check(r.memes, 'deux appareils lisant la même base calculent les mêmes id');
check(/^h\w+$/.test(r.soins[0]) && r.soins[1] === r.soins[0] + '-2', 'deux soins identiques : même empreinte, départagés par leur rang (aucun ne disparaît) : ' + JSON.stringify(r.soins));
eq(r.soins[2], 'S-garde', 'un id déjà présent est gardé');
check(/^e\w+$/.test(r.soins[3]), 'nouveau soin enregistré : id tiré au hasard : ' + r.soins[3]);
check([r.echo, r.mb, r.agneaux, r.soinAgneau, r.mvt, r.cl, r.reg].every(l => l.length && l.every(x => typeof x === 'string' && x.length > 3)), 'écho, mise bas, agneaux (mort-né compris), soin d\'agneau, mouvement, contrôle, fiche du registre : tous ont un id');
eq(r.numeros, ['250 000045651001', '0117', '250000045661001'], 'aucun n° modifié (EID avec espace, zéro de tête du n° de travail)');
check(r.idempotent, 'poser les id une seconde fois ne change rien');
console.log('OK ids : mêmes id sur deux appareils, doublons départagés, id existants gardés, agneaux et registre compris, nouveaux tirés au hasard, aucun n° modifié.');

// garde-fou : compte au format plus récent que l'appli
eq(await p.evaluate(() => { DB.schemaDonnees = schemaDonneesVersionCourante() + 1; return [donneesVerrouillees(), schemaDonneesVersionCourante() >= 1]; }), [true, true], 'compte au format plus récent : écriture vers le cloud bloquée');
eq(await p.evaluate(() => { DB.schemaDonnees = undefined; return donneesVerrouillees(); }), false, 'format connu : rien de bloqué');
console.log('OK garde-fou du format des données.');
await browser.close();
console.log('test_ids_elements : OK');
