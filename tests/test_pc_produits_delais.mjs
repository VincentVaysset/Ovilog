/* Fiche produit « Produits et délais » (PC) : modèle (delaiLait, delaiViande, surOrdonnance, reserveVeterinaire), anciennes
   valeurs à confirmer / corriger (delaiAttente = lait seul, clés héritées de l'ANMV jamais lues), délais obligatoires à la
   création (0 autorisé), fusion des écritures de l'écran mobile « Gérer les produits », modifier une fiche ne change aucun
   soin déjà enregistré, rien d'écrit sans action. saveData est REMPLACÉ par un compteur (rien n'est persisté). Jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';

const browser = await chromium.launch(LAUNCH);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1200 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
let reponse = true; const confirms = [];
page.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponse ? d.accept() : d.dismiss(); } else d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.evaluate(() => {
  DB = migrateData({});
  window.__saves = 0; saveData = function () { window.__saves++; };      // rien n'est persisté
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.produits = { vaccins: ['Bravoxin 10'], antibiotiques: ['Intramicine', 'Cefalex'], antiparasitaires: ['Ivomec'], antiinflammatoires: ['Finadyne'], autres: [] };
  DB.produitsInfo = {
    Intramicine: { posologie: '8 cc', delaiAttente: 7 },                                                       // ancienne valeur déclarative (lait)
    Ivomec: { posologie: null, delaiAttente: 3 },
    Cefalex: { lait: 4, viande: 20, anmvNom: 'CEFALEX', posologie: 'texte RCP très long', declined: false },   // héritage ANMV
    Finadyne: { posologie: '2 cc', delaiAttente: 0, delaiLait: 0, delaiViande: 5, surOrdonnance: true, reserveVeterinaire: false }  // fiche déjà complète
  };
  DB.brebis = [fiche(eid(1, 17), { sanitaire: [{ type: 'Traitement', sousType: 'Antibiotique', produit: 'Intramicine', date: '2026-09-20', quantiteCc: 8, intervenant: 'Éleveur', commentaire: '', numeroOrdonnance: null }] })];
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  window.__soinsAvant = JSON.stringify(DB.brebis.map(b => b.sanitaire));
});

// ================================================================ 1. fonction pure ficheProduit
const f = await page.evaluate(() => Object.fromEntries(['Intramicine', 'Ivomec', 'Cefalex', 'Finadyne', 'Bravoxin 10'].map(n => [n, ficheProduit(n)])));
check(f.Intramicine.aConfirmer && f.Intramicine.ancienLait === 7 && f.Intramicine.delaiLait === null && f.Intramicine.delaiViande === null && !f.Intramicine.complete && f.Intramicine.posologie === '8 cc', 'ancienne valeur : à confirmer, lait 7 jamais repris d\'office : ' + JSON.stringify(f.Intramicine));
check(f.Cefalex.heritageAnmv && f.Cefalex.delaiLait === null && f.Cefalex.delaiViande === null && f.Cefalex.ancienLait === null && f.Cefalex.posologie === null && f.Cefalex.posologieAncienne === 'texte RCP très long' && f.Cefalex.aConfirmer, 'héritage ANMV : lait 4 / viande 20 jamais lus, posologie signalée à confirmer, pas reprise : ' + JSON.stringify(f.Cefalex));
check(f.Finadyne.complete && f.Finadyne.delaiLait === 0 && f.Finadyne.delaiViande === 5 && f.Finadyne.surOrdonnance === true && !f.Finadyne.aConfirmer, 'fiche complète (délai lait 0 autorisé) : ' + JSON.stringify(f.Finadyne));
check(!f['Bravoxin 10'].existe && !f['Bravoxin 10'].complete && !f['Bravoxin 10'].aConfirmer && f['Bravoxin 10'].categorie === 'vaccins', 'produit sans fiche : incomplet, rien à confirmer');
check(await page.evaluate(() => produitsAConfirmer().map(x => x.nom).join()) === 'Intramicine,Cefalex,Ivomec' || await page.evaluate(() => produitsAConfirmer().map(x => x.nom).sort().join()) === 'Cefalex,Intramicine,Ivomec', 'produits à confirmer : Intramicine, Ivomec, Cefalex');
console.log('OK 1 modèle : ancienne valeur = lait à confirmer, héritage ANMV jamais lu (lait 4 / viande 20 ignorés), fiche complète avec délai 0, produit sans fiche.');

// ================================================================ 2. écran Produits et délais
await page.evaluate(() => render('produits-delais'));
await page.waitForSelector('#pc-produits-delais');
const kp = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#pc-produits-delais .pc-kpis .brd-kpi')].map(k => [k.querySelector('.brd-kpi-l').textContent, k.querySelector('.brd-kpi-v').textContent])));
check(kp['Produits'] === '5' && kp['Fiches complètes'] === '1' && kp['À confirmer'] === '3' && kp['Incomplètes'] === '1', 'indicateurs 5 produits / 1 complète / 3 à confirmer / 1 incomplète : ' + JSON.stringify(kp));
check(await page.evaluate(() => document.querySelectorAll('#pd-anciennes tr[data-nom]').length) === 3 && await page.evaluate(() => /ANMV : ignoré/.test(document.getElementById('pd-anciennes').textContent)), 'liste d\'un coup des 3 anciennes valeurs, héritage ANMV signalé « ignoré »');
check(await page.evaluate(() => window.__saves) === 0, 'rien d\'écrit à l\'affichage');
// Confirmer sans délai viande : refus, rien écrit
await page.click('#pd-anciennes tr[data-nom="Intramicine"] .pd-confirmer');
check(/saisis le délai viande/.test(await page.evaluate(() => document.getElementById('pd-err').textContent)) && await page.evaluate(() => window.__saves) === 0 && await page.evaluate(() => DB.produitsInfo.Intramicine.delaiLait === undefined), 'Confirmer sans délai viande : refusé, rien écrit');
// Confirmer avec viande 28
await page.fill('#pd-anciennes tr[data-nom="Intramicine"] .pd-viande', '28');
await page.click('#pd-anciennes tr[data-nom="Intramicine"] .pd-confirmer');
await page.waitForFunction(() => DB.produitsInfo.Intramicine.delaiLait === 7);
const intr = await page.evaluate(() => JSON.parse(JSON.stringify(DB.produitsInfo.Intramicine)));
check(intr.delaiLait === 7 && intr.delaiViande === 28 && intr.delaiAttente === 7 && intr.posologie === '8 cc' && intr.surOrdonnance === false && intr.reserveVeterinaire === false, 'Confirmer : lait 7 conservé, viande 28, delaiAttente = lait (mobile inchangé), posologie conservée : ' + JSON.stringify(intr));
check(await page.evaluate(() => window.__saves) === 1 && await page.evaluate(() => document.querySelectorAll('#pd-anciennes tr[data-nom]').length) === 2, 'une écriture, 2 anciennes valeurs restantes');
// l'écran mobile « Sous délai d'attente » lit toujours delaiAttente
check(await page.evaluate(() => { const o = isDesktopMode; return sousDelaiBrebisRows().length; }) === 0, 'sous délai (lait 7 j depuis le 20/09) : terminé au 02/10 : 0 ligne, calcul mobile inchangé');
console.log('OK 2 écran Produits et délais : 3 anciennes valeurs listées d\'un coup, Confirmer exige le délai viande, écrit lait + viande, delaiAttente conservé égal au lait.');

// ================================================================ 3. Corriger (fiche complète)
await page.click('#pd-anciennes tr[data-nom="Ivomec"] .pd-corriger');
await page.waitForSelector('#fp-ok');
check(await page.evaluate(() => document.getElementById('fp-lait').value === '3' && document.getElementById('fp-viande').value === '' && document.getElementById('fp-cat').disabled), 'Corriger : fiche préremplie avec l\'ancien lait (3), viande vide, catégorie verrouillée');
await page.click('#fp-ok');
check(/délai viande est obligatoire/.test(await page.evaluate(() => document.getElementById('fp-err').textContent)), 'viande vide : refusé');
await page.fill('#fp-viande', '0'); await page.fill('#fp-lait', '');
await page.click('#fp-ok');
check(/délai lait est obligatoire/.test(await page.evaluate(() => document.getElementById('fp-err').textContent)), 'lait vide : refusé');
await page.fill('#fp-lait', '2.5');
await page.click('#fp-ok');
check(/délai lait est obligatoire/.test(await page.evaluate(() => document.getElementById('fp-err').textContent)), 'lait non entier : refusé');
await page.fill('#fp-lait', '4'); await page.check('#fp-ord'); await page.check('#fp-veto');
const sauvAvant = await page.evaluate(() => window.__saves);
await page.click('#fp-ok');
await page.waitForFunction(() => DB.produitsInfo.Ivomec.delaiViande === 0);
const ivo = await page.evaluate(() => JSON.parse(JSON.stringify(DB.produitsInfo.Ivomec)));
check(ivo.delaiLait === 4 && ivo.delaiViande === 0 && ivo.delaiAttente === 4 && ivo.surOrdonnance && ivo.reserveVeterinaire && await page.evaluate(() => window.__saves) === sauvAvant + 1, 'Corriger : lait 4 / viande 0 (0 autorisé), ordonnance + réservé vétérinaire : ' + JSON.stringify(ivo));
// héritage ANMV : la posologie n'est pas préremplie, les clés ANMV disparaissent à la validation
await page.click('#pd-anciennes tr[data-nom="Cefalex"] .pd-corriger');
await page.waitForSelector('#fp-ok');
check(await page.evaluate(() => document.getElementById('fp-poso').value === '' && document.getElementById('fp-lait').value === '' && document.getElementById('fp-viande').value === ''), 'Cefalex : aucun délai ni posologie ANMV prérempli');
await page.fill('#fp-viande', '21'); await page.fill('#fp-lait', '5'); await page.fill('#fp-poso', '1 cc / 10 kg');
await page.click('#fp-ok');
await page.waitForFunction(() => DB.produitsInfo.Cefalex.delaiLait === 5);
const cef = await page.evaluate(() => JSON.parse(JSON.stringify(DB.produitsInfo.Cefalex)));
check(JSON.stringify(Object.keys(cef).sort()) === JSON.stringify(['delaiAttente', 'delaiLait', 'delaiViande', 'posologie', 'reserveVeterinaire', 'surOrdonnance']) && cef.posologie === '1 cc / 10 kg' && cef.delaiViande === 21, 'fiche Cefalex saisie par l\'éleveur : clés ANMV retirées de CE produit à sa validation : ' + JSON.stringify(cef));
check(await page.evaluate(() => !document.getElementById('pd-anciennes')), 'plus aucune ancienne valeur à confirmer');
console.log('OK 3 Corriger : fiche complète préremplie (lait ancien, viande vide), refus des délais vides / non entiers, 0 autorisé, ordonnance et réservé vétérinaire ; héritage ANMV jamais prérempli.');

// ================================================================ 4. nouveau produit
await page.click('#pd-nouveau');
await page.waitForSelector('#fp-ok');
await page.fill('#fp-nom', 'Intramicine');
await page.fill('#fp-viande', '1'); await page.fill('#fp-lait', '1');
await page.click('#fp-ok');
check(/existe déjà/.test(await page.evaluate(() => document.getElementById('fp-err').textContent)), 'doublon de nom : refusé');
await page.fill('#fp-nom', 'Nouveau produit test'); await page.selectOption('#fp-cat', 'vaccins'); await page.fill('#fp-viande', '0'); await page.fill('#fp-lait', '0');
await page.click('#fp-ok');
await page.waitForFunction(() => (DB.produits.vaccins || []).includes('Nouveau produit test'));
const np = await page.evaluate(() => ficheProduit('Nouveau produit test'));
check(np.complete && np.delaiLait === 0 && np.delaiViande === 0 && np.categorie === 'vaccins', 'nouveau produit : délais 0 / 0 acceptés, rangé dans Vaccins : ' + JSON.stringify(np));
console.log('OK 4 nouveau produit : nom unique, catégorie, délais obligatoires (0 autorisé).');

// ================================================================ 5. écran mobile « Gérer les produits » : fusion, jamais d'effacement
const mob = await page.evaluate(() => {
  ecrireInfoProduitMobile('Intramicine', '9 cc', 10);                  // modification du lait côté mobile
  const a = JSON.parse(JSON.stringify(DB.produitsInfo.Intramicine));
  ecrireInfoProduitMobile('Finadyne', '', null);                       // vider côté mobile : la fiche complète n'est pas supprimée
  return { a, finadyne: !!DB.produitsInfo.Finadyne, f: JSON.parse(JSON.stringify(DB.produitsInfo.Finadyne)) };
});
check(mob.a.delaiLait === 10 && mob.a.delaiAttente === 10 && mob.a.delaiViande === 28 && mob.a.posologie === '9 cc', 'écriture mobile : delaiLait suit delaiAttente, délai viande conservé : ' + JSON.stringify(mob.a));
check(mob.finadyne && mob.f.delaiViande === 5 && mob.f.surOrdonnance === true, 'écriture mobile vide : la fiche complète n\'est pas supprimée : ' + JSON.stringify(mob.f));
console.log('OK 5 écran mobile « Gérer les produits » : écritures fusionnées (nouveaux champs jamais effacés), delaiLait suit delaiAttente.');

// ================================================================ 6. soins déjà enregistrés inchangés
check(await page.evaluate(() => JSON.stringify(DB.brebis.map(b => b.sanitaire)) === window.__soinsAvant), 'modifier / confirmer des fiches produit n\'a changé AUCUN soin déjà enregistré');
check(confirms.length === 0, 'aucune confirmation inattendue (pas de renommage)');
console.log('OK 6 soins déjà enregistrés strictement inchangés.');
await browser.close();
console.log('\nTOUS LES TESTS DE LA FICHE PRODUIT « PRODUITS ET DÉLAIS » SONT PASSÉS (jeu synthétique, saveData remplacé, aucune donnée réelle)');
