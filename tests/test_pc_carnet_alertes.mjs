/* Carnet sanitaire PC, alertes (information SEULEMENT, jamais bloquantes, jamais de correction automatique) :
   - vente / autoconsommation (et « Vendu » d'un agneau) d'un animal encore sous délai viande, comparée à la DATE du mouvement ;
     « Vente reproduction », « Morte », « Perte » : aucune alerte ; mouvement individuel (brebis), collectif, agneau, agnelle ;
   - Séléphérol : traitement comme un autre (délais depuis sa fiche, jamais créée d'office, « — » + alerte pour créer la fiche, délais
     obligatoires, copiés sur le soin à la création) ;
   - import contrôle laitier : liste (sans rien modifier) des contrôles tombant pendant un délai d'attente du lait (PC) ;
   - mobile : alerte de vente aussi (individuel, collectif, agneau, agnelle), jamais bloquante ; sans alerte l'écran reste identique (test_alertes_mobile_reference).
   saveData est REMPLACÉ par un compteur (rien n'est persisté). Jeu synthétique, aucun EID réel. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';

const browser = await chromium.launch(LAUNCH);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1300 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
const confirms = [];
page.on('dialog', d => { if (d.type() === 'confirm') confirms.push(d.message()); d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
const jeu = () => page.evaluate(() => {
  DB = migrateData({});
  window.__saves = 0; saveData = function () { window.__saves++; };
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  const soin = (o) => Object.assign({ type: 'Traitement', sousType: 'Antibiotique', produit: 'Intramicine', date: '2026-09-30', quantiteCc: 8, voie: 'Intramusculaire', intervenant: 'Éleveur', commentaire: '', dureeJours: 1, delaiLaitJours: 7, delaiViandeJours: 28 }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.produits = { vaccins: [], antibiotiques: ['Intramicine'], antiparasitaires: [], antiinflammatoires: [], autres: [] }; DB.produitsInfo = {};
  DB.acheteurs = ['Acheteur test'];
  DB.brebis = [
    fiche(eid(3, 1), { id: 'A', sanitaire: [soin()] }),                                                   // viande dès le 29/10, lait dès le 08/10
    fiche(eid(3, 2), { id: 'B' }),                                                                         // aucun soin
    fiche(eid(3, 3), { id: 'C', sanitaire: [soin({ date: '2026-10-01', produit: 'Ivomec' })] }),           // viande dès le 30/10
    fiche(eid(3, 4), { id: 'D', sanitaire: [soin({ delaiViandeJours: 0 })] })                              // lait seul : pas d'alerte de vente
  ];
  DB.brebis[1].agnelages = [{ date: '2026-09-25', campagne: 2026, lambs: [{ eid: eid(6, 801), sexe: 'Mâle', statut: 'vivant', sanitaire: [{ type: 'Traitement', sousType: null, produit: 'Séléphérol', dose: '2 cc', date: '2026-09-25', commentaire: 'Injection systématique à la naissance' }], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-09-25' }] }] }];
  DB.beliers = [fiche(eid(2, 90), { id: 'BEL', statut: 'actif' })];
  DB.agnelles = [fiche(eid(6, 70), { id: 'AG', sanitaire: [soin({ date: '2026-09-28' })] })];            // viande dès le 27/10
  DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  window.E = eid; window.soinModele = soin;
  window.__avant = JSON.stringify(DB);
});
await jeu();

// ================================================================ 1. fonction pure : types, bornes
const m = await page.evaluate(() => {
  const A = { label: 'n°00001', obj: DB.brebis[0] }, D = { label: 'n°00004', obj: DB.brebis[3] }, B = { label: 'n°00002', obj: DB.brebis[1] };
  const r = (an, type, date) => { const x = alertesVenteDelai(an, type, date); return [x.actif, x.lignes.length, x.lignes[0] ? x.lignes[0].venteDes : null]; };
  return {
    vente: r([A], 'Vente', '2026-10-10'), auto: r([A], 'Autoconsommation', '2026-10-10'), vendu: r([A], 'Vendu', '2026-10-10'),
    repro: r([A], 'Vente reproduction', '2026-10-10'), morte: r([A], 'Morte', '2026-10-10'), mort: r([A], 'Mort', '2026-10-10'), perte: r([A], 'Perte', '2026-10-10'),
    veille: r([A], 'Vente', '2026-10-28'), jourJ: r([A], 'Vente', '2026-10-29'), apres: r([A], 'Vente', '2026-11-15'),
    avantSoin: r([A], 'Vente', '2026-09-29'), laitSeul: r([D], 'Vente', '2026-10-10'), sansSoin: r([B], 'Vente', '2026-10-10'), sansDate: r([A], 'Vente', '')
  };
});
check(JSON.stringify(m.vente) === '[true,1,"2026-10-29"]' && JSON.stringify(m.auto) === '[true,1,"2026-10-29"]' && JSON.stringify(m.vendu) === '[true,1,"2026-10-29"]', 'Vente, Autoconsommation, Vendu (agneau) : alerte, vente dès le 29/10 : ' + JSON.stringify([m.vente, m.auto, m.vendu]));
check(!m.repro[0] && !m.morte[0] && !m.mort[0] && !m.perte[0], 'Vente reproduction, Morte, Mort, Perte : aucune alerte');
check(m.veille[1] === 1 && m.jourJ[1] === 0 && m.apres[1] === 0, 'la veille du 29/10 : alerte ; le 29/10 et après : rien (jour de la reprise = libre)');
check(m.avantSoin[1] === 0 && m.laitSeul[1] === 0 && m.sansSoin[1] === 0 && m.sansDate[0] === false, 'vente avant le soin, délai viande 0 (lait seul), animal sans soin, date vide : rien');
console.log('OK 1 règles : Vente / Autoconsommation / Vendu alertent, pas Vente reproduction / Morte / Perte ; frontière le jour de la reprise ; lait seul sans alerte de vente.');

// ================================================================ 2. mouvement individuel (brebis) : alerte, jamais bloquante
await page.evaluate(() => { currentSheepId = 'A'; editContext = null; render('add-mouvement'); });
await page.waitForSelector('.type-opt');
check(await page.evaluate(() => !document.getElementById('alerte-vente-delai')), 'avant le choix du type : pas d\'alerte');
const t = type => page.click(`.type-opt[data-val="${type}"]`);
await t('Vente');
await page.fill('#f-date', '2026-10-10');
let al = await page.evaluate(() => { const e = document.getElementById('alerte-vente-delai'); return e ? e.textContent.replace(/\s+/g, ' ') : null; });
check(al && /n°00001 est encore sous délai d'attente viande/.test(al) && /Intramicine/.test(al) && /30-09-2026/.test(al) && /29-10-2026/.test(al) && /rien n'est bloqué/.test(al), 'alerte de vente : ' + al);
await page.fill('#f-date', '2026-10-29');
check(await page.evaluate(() => !document.getElementById('alerte-vente-delai')), 'le 29/10 : alerte disparue');
await page.fill('#f-date', '2026-10-28');
check(await page.evaluate(() => !!document.getElementById('alerte-vente-delai')), 'le 28/10 : alerte');
await t('Vente reproduction'); check(await page.evaluate(() => !document.getElementById('alerte-vente-delai')), 'Vente reproduction : pas d\'alerte');
await t('Autoconsommation'); check(await page.evaluate(() => !!document.getElementById('alerte-vente-delai')), 'Autoconsommation : alerte');
await t('Morte'); check(await page.evaluate(() => !document.getElementById('alerte-vente-delai')), 'Morte : pas d\'alerte');
await t('Perte'); check(await page.evaluate(() => !document.getElementById('alerte-vente-delai')), 'Perte : pas d\'alerte');
// jamais bloquante : on valide la vente malgré l'alerte, la date saisie n'est pas corrigée
await t('Vente'); await page.fill('#f-date', '2026-10-10');
await page.click('#acheteur-list .chip');
await page.click('#btn-save-mouvement');
await page.waitForFunction(() => DB.brebis[0].mouvements.some(x => x.type === 'Vente'));
const mv = await page.evaluate(() => DB.brebis[0].mouvements.find(x => x.type === 'Vente'));
check(mv.date === '2026-10-10' && mv.acheteur === 'Acheteur test', 'la vente est enregistrée telle que saisie (alerte non bloquante, date non corrigée) : ' + JSON.stringify(mv));
console.log('OK 2 mouvement individuel : alerte en direct (type, date), frontière, jamais bloquante ni corrigée.');

// ================================================================ 3. mouvement collectif : liste des animaux concernés
await jeu();   // jeu remis à neuf (la brebis A a été vendue en 2)
await page.evaluate(() => { mvPcEtat = null; render('inventaire'); });          // PC : la page « Mouvements d'animaux » (saisie collective)
await page.waitForSelector('#mv-table');
await page.click('.mv-type[data-val="Vente"]'); await page.fill('#mv-date', '2026-10-10');
await page.click('tr.clic[data-id="B"]'); await page.click('tr.clic[data-id="C"]');
al = await page.evaluate(() => { const e = document.getElementById('alerte-vente-delai'); return e ? e.textContent.replace(/\s+/g, ' ') : null; });
check(al && /n°00003 est encore sous délai/.test(al) && /Ivomec/.test(al) && /30-10-2026/.test(al) && !/n°00002/.test(al), 'collectif : seul n°00003 (sélectionné ET sous délai) est signalé : ' + al);
await page.click('tr.clic[data-id="A"]');
al = await page.evaluate(() => { const e = document.getElementById('alerte-vente-delai'); return e ? e.textContent.replace(/\s+/g, ' ') : null; });
check(/2 animaux sont encore sous délai/.test(al) && /n°00001/.test(al) && /n°00003/.test(al), 'collectif : 2 animaux listés après ajout à la sélection : ' + al);
await page.click('.mv-type[data-val="Morte"]');
check(await page.evaluate(() => !document.getElementById('alerte-vente-delai')), 'collectif Morte : pas d\'alerte');
console.log('OK 3 mouvement collectif : seuls les animaux sélectionnés sous délai sont listés, mis à jour avec la date et le type.');

// ================================================================ 4. agneau vendu + Séléphérol (fiche absente puis créée)
await page.evaluate(() => { const l = DB.brebis[1].agnelages[0].lambs[0]; window.__lamb = l; showLambSortieModal(l, 'vendu', () => {}); });
await page.waitForSelector('#lambsortie-date');
al = await page.evaluate(() => { const e = document.getElementById('alerte-selepherol'); return e ? e.textContent.replace(/\s+/g, ' ') : null; });
check(al && /Séléphérol/.test(al) && /inconnu/.test(al) && /Créer la fiche/.test(al) && await page.evaluate(() => !document.getElementById('alerte-vente-delai')), 'Séléphérol sans fiche : « — » (aucune date), alerte pour créer la fiche, rien d\'inventé : ' + al);
check(await page.evaluate(() => !JSON.stringify(DB.produitsInfo).includes('Séléphérol') && !JSON.stringify(DB.produits).includes('Séléphérol')), 'aucune fiche créée d\'office');
await page.click('#btn-creer-fiche-selepherol');
await page.waitForSelector('#fp-ok');
check(await page.evaluate(() => document.getElementById('fp-nom').value === 'Séléphérol'), 'fiche proposée au nom de Séléphérol');
await page.click('#fp-ok');
check(/délai viande est obligatoire/.test(await page.evaluate(() => document.getElementById('fp-err').textContent)), 'délais obligatoires : refusé sans délai');
await page.fill('#fp-viande', '28'); await page.fill('#fp-lait', '0');
await page.click('#fp-ok');
await page.waitForFunction(() => !document.getElementById('fp-ok'));
al = await page.evaluate(() => { const e = document.getElementById('alerte-vente-delai'); return e ? e.textContent.replace(/\s+/g, ' ') : null; });
check(al && /Agneau n°00801 est encore sous délai/.test(al) && /Séléphérol/.test(al) && /24-10-2026/.test(al) && await page.evaluate(() => !document.getElementById('alerte-selepherol')), 'fiche créée (viande 28, lait 0) : alerte de vente de l\'agneau, vente dès le 24/10 (25/09 + 28 + 1) : ' + al);
check(await page.evaluate(() => DB.produits.autres.includes('Séléphérol') && ficheProduit('Séléphérol').complete), 'fiche créée par l\'éleveur dans « Autre »');
await page.fill('#lambsortie-date', '2026-10-24');
check(await page.evaluate(() => !document.getElementById('alerte-vente-delai')), 'le 23/10 : plus d\'alerte');
await page.fill('#lambsortie-date', '2026-10-05');
await page.click('#lambsortie-acheteur-list .chip');
await page.click('#lambsortie-confirm');
await page.waitForFunction(() => window.__lamb.mouvements.some(x => x.type === 'Vendu'));
check(await page.evaluate(() => window.__lamb.mouvements.find(x => x.type === 'Vendu').date === '2026-10-05'), 'vente de l\'agneau enregistrée malgré l\'alerte, date non corrigée');
// le soin Séléphérol existant n'a pas été modifié
check(await page.evaluate(() => { const s = window.__lamb.sanitaire[0]; return s.dureeJours === undefined && s.delaiViandeJours === undefined; }), 'le soin Séléphérol déjà enregistré n\'est pas modifié (lu d\'après la fiche à l\'affichage seulement)');
console.log('OK 4 agneau + Séléphérol : sans fiche = « — » et alerte pour créer la fiche ; délais obligatoires ; fiche créée = alerte de vente des agneaux ; vente jamais bloquée.');

// ================================================================ 5. modifier la fiche ne change pas un soin qui a sa copie ; snapshot à la création
const sn = await page.evaluate(() => {
  const avant = delaisSelepherolSnapshot();
  const soinCopie = Object.assign({ type: 'Traitement', produit: 'Séléphérol', date: '2026-09-25', dose: '2 cc' }, avant);
  const lamb = { eid: 'x', sanitaire: [soinCopie] };
  ecrireFicheProduit('Séléphérol', { posologie: '', delaiLait: 0, delaiViande: 5, surOrdonnance: false, reserveVeterinaire: false });
  const apres = alertesVenteDelai([{ label: 'l', obj: lamb }], 'Vendu', '2026-10-10');
  return { avant, venteDes: apres.lignes[0] && apres.lignes[0].venteDes };
});
check(sn.avant.dureeJours === 1 && sn.avant.delaiViandeJours === 28 && sn.avant.delaiLaitJours === 0 && sn.venteDes === '2026-10-24', 'soin avec copie des délais : modifier ensuite la fiche (28 → 5 j) ne change pas son alerte : ' + JSON.stringify(sn));
await page.evaluate(() => ecrireFicheProduit('Séléphérol', { posologie: '', delaiLait: 0, delaiViande: 28, surOrdonnance: false, reserveVeterinaire: false }));
console.log('OK 5 copie des délais sur le soin Séléphérol : la fiche modifiée ensuite ne change pas les soins enregistrés.');

// ================================================================ 6. création d'un agnelage (saisie de mises bas PC) : copie des délais de la fiche
await page.evaluate(() => { window.__avantNaissance = DB.brebis[0].agnelages.length; resetMisebasRapideSession(); render('misebas-rapide'); });
await page.fill('#scan-misebas', '00001'); await page.press('#scan-misebas', 'Enter');
await page.waitForSelector('#f-date-rapide');
await page.click('.pc-st-btn[data-sexe="Mâle"][data-delta="1"]');
await page.fill('#f-date-rapide', '2026-10-01'); await page.dispatchEvent('#f-date-rapide', 'change');
await page.click('.repro-code-opt-rapide[data-val="IA"]');
await page.click('#btn-valider-misebas');
await page.waitForFunction(() => DB.brebis[0].agnelages.length > window.__avantNaissance);
const nais = await page.evaluate(() => JSON.parse(JSON.stringify(DB.brebis[0].agnelages[DB.brebis[0].agnelages.length - 1].lambs[0].sanitaire[0])));
check(nais.produit === 'Séléphérol' && nais.dose === '2 cc' && nais.dureeJours === 1 && nais.delaiViandeJours === 28 && nais.delaiLaitJours === 0, 'Séléphérol de naissance : délais de la fiche copiés sur le soin : ' + JSON.stringify(nais));
console.log('OK 6 naissance : le Séléphérol automatique copie les délais de la fiche (sans fiche : aucun champ ajouté, vérifié en 4).');

// ================================================================ 7. agnelle vendue (bouton « Vendre ») et mobile
await page.evaluate(() => { window.__ag = DB.agnelles[0]; showVendreAgnelleModal(window.__ag, () => {}); });
await page.waitForSelector('#vendre-date');
await page.fill('#vendre-date', '2026-10-10');
al = await page.evaluate(() => { const e = document.getElementById('alerte-vente-delai'); return e ? e.textContent.replace(/\s+/g, ' ') : null; });
check(al && /Agnelle n°00070 est encore sous délai/.test(al) && /27-10-2026/.test(al), 'agnelle : alerte de vente, vente dès le 27/10 : ' + al);
await page.click('#vendre-cancel');
const mob = await page.evaluate(() => {
  window.electronAPI.isDesktop = false;       // écrans MOBILE
  const r = {};
  const vente = (date) => { document.querySelector('.type-opt[data-val="Vente"]').click(); document.getElementById('f-date').value = date; document.getElementById('f-date').dispatchEvent(new Event('input')); };
  currentSheepId = 'C'; editContext = null; render('add-mouvement'); vente('2026-10-10');
  r.individuel = !!document.getElementById('alerte-vente-delai') && /n°00003 est encore sous délai/.test(document.getElementById('zone-alerte-vente-delai').textContent) && /30-10-2026/.test(document.getElementById('zone-alerte-vente-delai').textContent);
  document.getElementById('f-date').value = '2026-10-30'; document.getElementById('f-date').dispatchEvent(new Event('input'));
  r.disparaitLe30 = !document.getElementById('zone-alerte-vente-delai');
  currentSheepId = 'B'; render('add-mouvement'); vente('2026-10-10');
  r.zoneSansAlerte = !!document.getElementById('zone-alerte-vente-delai');      // animal sans soin : aucune zone créée
  window.__mouvementGroupeSelected = { brebis: new Set(['C']), beliers: new Set(), agnelles: new Set(), agneaux: new Set() };
  render('mouvement-groupe'); document.querySelector('.cat-mc-opt[data-val="brebis"]').click(); vente('2026-10-10');
  r.collectif = !!document.getElementById('alerte-vente-delai');
  showLambSortieModal(DB.brebis[1].agnelages[0].lambs[0], 'vendu', () => {});
  r.agneau = !!document.querySelector('.modal-overlay #alerte-vente-delai') && /Séléphérol/.test(document.querySelector('.modal-overlay').textContent);   // fiche Séléphérol créée en 4 : délai viande de l'injection de naissance
  document.querySelectorAll('.modal-overlay').forEach(o => o.remove());
  showVendreAgnelleModal(DB.agnelles[0], () => {}); document.getElementById('vendre-date').value = '2026-10-10'; document.getElementById('vendre-date').dispatchEvent(new Event('input'));
  r.agnelle = !!document.querySelector('.modal-overlay #alerte-vente-delai');
  document.querySelectorAll('.modal-overlay').forEach(o => o.remove());
  window.electronAPI.isDesktop = true;
  return r;
});
check(mob.individuel && mob.disparaitLe30 && !mob.zoneSansAlerte && mob.collectif && mob.agneau && mob.agnelle, 'mobile : alerte de vente (individuel, collectif, agneau, agnelle), sans zone quand il n\'y a rien à signaler : ' + JSON.stringify(mob));
// jamais bloquante sur mobile non plus : la vente est enregistrée telle que saisie
const venteMobile = await page.evaluate(async () => {
  window.electronAPI.isDesktop = false;
  currentSheepId = 'C'; editContext = null; render('add-mouvement');
  document.querySelector('.type-opt[data-val="Vente"]').click(); document.getElementById('f-date').value = '2026-10-10'; document.getElementById('f-date').dispatchEvent(new Event('input'));
  document.querySelector('#acheteur-list .chip').click(); document.getElementById('btn-save-mouvement').click();
  await new Promise(r => setTimeout(r, 100));
  window.electronAPI.isDesktop = true;
  const m = DB.brebis[2].mouvements.find(x => x.type === 'Vente'); return m ? m.date : null;
});
check(venteMobile === '2026-10-10', 'mobile : vente enregistrée malgré l\'alerte, date non corrigée : ' + venteMobile);
console.log('OK 7 agnelle : alerte de vente ; mobile : alerte aussi (individuel, collectif, agneau, agnelle), jamais bloquante, aucune zone sans alerte.');

// ================================================================ 8. carte « Séléphérol à créer » dans Produits et délais
await jeu();
await page.evaluate(() => { DB.brebis[1].agnelages[0].lambs[0].sanitaire = []; render('produits-delais'); });
await page.waitForSelector('#pc-produits-delais');
check(await page.evaluate(() => !document.getElementById('pd-selepherol')), 'sans Séléphérol utilisé : pas de carte');
await page.evaluate(() => { DB.brebis[1].agnelages[0].lambs[0].sanitaire.push({ type: 'Traitement', produit: 'Séléphérol', dose: '2 cc', date: '2026-09-25' }); render('produits-delais'); });
check(await page.evaluate(() => !!document.getElementById('pd-selepherol') && /Rien n'est créé d'office/.test(document.getElementById('pd-selepherol').textContent)), 'Séléphérol utilisé sans fiche : carte « fiche à créer », rien créé d\'office');
check(await page.evaluate(() => !JSON.stringify(DB.produits).includes('Séléphérol') && window.__saves === 0), 'toujours aucune fiche, rien écrit');
await page.click('#pd-creer-selepherol');
await page.waitForSelector('#fp-ok');
await page.fill('#fp-viande', '0'); await page.fill('#fp-lait', '0');
await page.click('#fp-ok');
await page.waitForFunction(() => !!document.getElementById('pc-produits-delais') && !document.getElementById('pd-selepherol'));
check(await page.evaluate(() => ficheProduit('Séléphérol').complete && ficheProduit('Séléphérol').delaiViande === 0), 'fiche Séléphérol créée avec délais 0 / 0 (0 autorisé), carte disparue');
console.log('OK 8 « Produits et délais » : carte Séléphérol seulement s\'il est utilisé et sans fiche ; délais 0 autorisés.');

// ================================================================ 9. import contrôle laitier : contrôles pendant un délai d'attente du lait
await jeu();
const cl = await page.evaluate(() => {
  const A = DB.brebis[0], C = DB.brebis[2], B = DB.brebis[1];
  A.sanitaire = [soinModele({ date: '2026-10-01' })];   // dernière 01/10, lait 7 -> reprise 09/10
  C.sanitaire = [soinModele({ date: '2026-10-20', delaiLaitJours: 3 })];   // reprise 24/10
  const items = [
    { sheep: A, controle: 1, date: '2026-10-05' },      // pendant le délai : signalé
    { sheep: A, controle: 2, date: '2026-10-09' },      // jour de la reprise : libre
    { sheep: A, controle: 3, date: '2026-09-30' },      // avant le soin : rien
    { sheep: C, controle: 1, date: '2026-10-05' },      // avant le début du soin du 20/10 : rien
    { sheep: B, controle: 1, date: '2026-10-05' }       // aucun soin : rien
  ];
  const avant = JSON.stringify(DB);
  const l = controlesDansDelaiLait(items);
  const h = htmlAlerteControlesDelaiLait(items);
  const intact = JSON.stringify(DB) === avant;
  window.electronAPI.isDesktop = false; const hm = htmlAlerteControlesDelaiLait(items); window.electronAPI.isDesktop = true;
  return { n: l.length, premier: l[0] && [numeroVisuel(l[0].sheep.eid), l[0].controle, l[0].repriseLait], h: h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), intact, hm };
});
check(cl.n === 1 && JSON.stringify(cl.premier) === '["00001",1,"2026-10-09"]', 'seul le contrôle 1 du n°00001 (05/10, reprise du lait 09/10) est signalé : ' + JSON.stringify(cl));
check(/Contrôles pendant un délai d'attente du lait \(1\)/.test(cl.h) && /contrôle 1 du 05-10-2026/.test(cl.h) && /reprise du lait le 09-10-2026/.test(cl.h) && /rien n'est modifié ni retiré/.test(cl.h), 'liste affichée : ' + cl.h);
check(cl.intact && cl.hm === '', 'aucune donnée modifiée ; mobile : rien');
// imports réels (fichier chargé) : le bloc d'alerte s'affiche dans l'aperçu, rien n'est écrit
const apercu = await page.evaluate(() => { const A = DB.brebis[0]; A.sanitaire = [soinModele({ date: '2026-10-01' })]; A.numeroCourtTravailSieol = '1234'; window.__avant9 = JSON.stringify(DB); window.__saves = 0; return eidAffichageCourt(A.eid); });
// a) import « Cahier de contrôle laitier » SIEOL (CSV résumé + CSV cahier)
await page.evaluate(() => render('import-controle-laitier-sieol'));
await page.waitForSelector('#import-cl-resume-file');
await page.setInputFiles('#import-cl-resume-file', { name: 'resume.csv', mimeType: 'text/csv', buffer: Buffer.from('num_controle;date_controle;lait_total;nb_brebis\n1;05/10/2026;100;10\n') });
await page.setInputFiles('#import-cl-cahier-file', { name: 'cahier.csv', mimeType: 'text/csv', buffer: Buffer.from('numero_visuel_sieol;ctl1_ml;ctl1_anomalie\n1234;800;\n') });
await page.waitForSelector('#alerte-cl-delai-lait', { timeout: 5000 });
let blocCl = await page.evaluate(() => document.getElementById('alerte-cl-delai-lait').textContent.replace(/\s+/g, ' '));
check(/\(1\)/.test(blocCl) && /n°00001 — contrôle 1 du 05-10-2026/.test(blocCl) && /reprise du lait le 09-10-2026/.test(blocCl), 'import SIEOL : contrôle du 05/10 listé : ' + blocCl);
check(await page.evaluate(() => JSON.stringify(DB) === window.__avant9 && window.__saves === 0), 'import SIEOL : aperçu seul, rien modifié');
// b) import « modèle Ovilog » (xlsx)
const xlsx = await page.evaluate(async (eidCourt) => {
  const rows = [['Modèle'], [''], [''], ['', '', '05/10/2026', '', ''], ['EID', 'SIEOL', 'C1', 'C2', 'C3'], [eidCourt, '', '800', '', '']];
  const b = await buildXlsxWorkbook([{ name: CONTROLE_LAITIER_MODELE_SHEET, rows }]);
  return Array.from(b);
}, apercu);
await page.evaluate(() => render('import-controle-laitier-modele'));
await page.waitForSelector('#import-cl-modele-file');
await page.setInputFiles('#import-cl-modele-file', { name: 'modele.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(xlsx) });
await page.waitForSelector('#alerte-cl-delai-lait', { timeout: 5000 });
blocCl = await page.evaluate(() => document.getElementById('alerte-cl-delai-lait').textContent.replace(/\s+/g, ' '));
check(/n°00001 — contrôle 1 du 05-10-2026/.test(blocCl), 'import modèle : contrôle du 05/10 listé : ' + blocCl);
check(await page.evaluate(() => JSON.stringify(DB) === window.__avant9 && window.__saves === 0), 'import modèle : aperçu seul, rien modifié');
// mobile : même import, aucun bloc
await page.evaluate(() => { window.electronAPI.isDesktop = false; render('import-controle-laitier-modele'); });
await page.setInputFiles('#import-cl-modele-file', { name: 'modele.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(xlsx) });
await page.waitForFunction(() => /À écrire/.test(document.getElementById('import-cl-modele-preview').textContent), null, { timeout: 5000 });
check(await page.evaluate(() => !document.getElementById('alerte-cl-delai-lait')), 'mobile : aperçu d\'import sans bloc d\'alerte');
await page.evaluate(() => { window.electronAPI.isDesktop = true; });
console.log('OK 9 import contrôle laitier : seul le contrôle tombant entre le début du soin et la reprise du lait est listé ; rien modifié ; mobile : rien.');
await browser.close();
console.log('\nTOUS LES TESTS DES ALERTES DU CARNET SONT PASSÉS (jeu synthétique, saveData remplacé, aucune donnée réelle)');
