/* Règle « mise bas sans contrôle laitier » : brebis ACTIVES ayant mis bas dans la campagne ET sans aucun
   contrôle laitier de la campagne. Fonction pure testée sur un jeu SYNTHÉTIQUE : contrôlée / jamais contrôlée /
   vendue / mise bas d'une autre campagne / contrôle d'une autre campagne / contrôle seulement au registre /
   brebis archivée / aucun contrôle importé. Cohérence avec le bilan de lactation (« brebis passées à la
   traite »), « attendue à la traite » au sens de l'appli, carte mobile et PC, aucune écriture. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';

const browser = await chromium.launch(LAUNCH);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

async function ouvrir(pc) {
  const ctx = await browser.newContext({ viewport: { width: pc ? 1400 : 420, height: 1000 } });
  const page = await ctx.newPage();
  if (pc) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({});
    window.__saves = 0;
    const o = saveData; saveData = function (...a) { window.__saves++; return o.apply(this, a); };
    const eid = (c, n) => '2500162999' + c + String(n).padStart(4, '0');
    const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
    const mb = (d, lambs, camp) => ({ date: d, campagne: camp === undefined ? 2026 : camp, lambs });
    const L = (sexe, o) => Object.assign({ sexe }, o || {});
    const vendu = (sexe) => L(sexe, { statutFinal: 'vendu', mouvements: [{ type: 'Vendu', date: '2027-01-30' }] });
    const cl = (n, camp) => ({ controle: n, quantite: 1.2, anomalie: null, date: '2027-01-15', campagne: camp });
    window.E = eid;
    window.jeuLait = (avecControle) => {
      DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
      DB.brebis = [
        /* A */ fiche(eid(6, 1), { agnelages: [mb('2026-11-05', [L('Mâle')])], controleLaitier: avecControle ? [cl(1, 2026)] : [] }),            // contrôlée : exclue
        /* B */ fiche(eid(6, 2), { agnelages: [mb('2026-11-12', [vendu('Mâle'), vendu('Femelle')])] }),                                         // jamais contrôlée, agneaux tous réglés : attendue -> signal fort
        /* C */ fiche(eid(6, 3), { agnelages: [mb('2026-11-20', [L('Femelle'), vendu('Mâle')])] }),                                            // jamais contrôlée, 1 agneau non réglé : signal faible
        /* D */ fiche(eid(6, 4), { agnelages: [mb('2026-12-02', [])] }),                                                                       // jamais contrôlée, aucun agneau : signal faible
        /* E */ fiche(eid(6, 5), { statut: 'vendue', agnelages: [mb('2026-11-25', [L('Mâle')])] }),                                            // vendue : exclue
        /* F */ fiche(eid(6, 6)),                                                                                                              // pas de mise bas : exclue
        /* G */ fiche(eid(6, 7), { agnelages: [mb('2025-11-25', [L('Mâle')], 2025)] }),                                                        // mise bas d'une autre campagne : exclue
        /* H */ fiche(eid(6, 8), { agnelages: [mb('2026-12-15', [L('Mâle')])], controleLaitier: [cl(1, 2025)] }),                              // contrôle d'une autre campagne seulement : listée
        /* K */ fiche(eid(6, 9), { agnelages: [mb('2026-12-20', [L('Femelle')])] }),                                                           // contrôle seulement au registre : exclue
        /* M */ fiche(eid(6, 10), { agnelages: [mb('2026-12-22', [L('Mort-né'), vendu('Mâle')])] }),                                           // mort-né + vendu : tous réglés -> signal fort
        /* N */ fiche(eid(6, 11), { controleLaitier: avecControle ? [cl(1, 2026)] : [] })                                                      // traite sans mise bas : exclue (mais passée à la traite)
      ];
      DB.beliers = []; DB.agnelles = []; DB.lots = [];
      DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
      // archivée (sortie) avec mise bas et sans contrôle : n'est pas active, exclue
      DB.registre.brebis[eid(6, 20)] = { agnelages: [mb('2026-11-30', [L('Mâle')])], controleLaitier: [], mouvements: [{ type: 'Vente', date: '2027-02-01' }] };
      // K : contrôle de la campagne uniquement dans l'archive du registre (fusionné avec la fiche active)
      if (avecControle) DB.registre.brebis[eid(6, 9)] = { controleLaitier: [cl(1, 2026)] };
    };
  });
  return page;
}

// ================================================================ 1. fonction pure
const page = await ouvrir(false);
await page.evaluate(() => jeuLait(true));
const avant = await page.evaluate(() => JSON.stringify(DB));
const r = await page.evaluate(() => JSON.parse(JSON.stringify(brebisMiseBasSansControleLaitier(2026))));
const num = n => '2500162999' + '6' + String(n).padStart(4, '0');
const cles = r.liste.map(l => parseInt(l.eid.slice(-4), 10));
check(r.controleImporte === true, 'contrôle importé détecté');
check(JSON.stringify(cles) === JSON.stringify([2, 10, 3, 4, 8]), 'liste : B, M (signaux forts, par date) puis C, D, H (par date) : ' + JSON.stringify(cles));
check(r.sansControle === 5 && r.signauxForts === 2 && r.controlees === 2 && r.misesBasActives === 7, 'compteurs 5 sans contrôle / 2 signaux forts / 2 contrôlées (A, K) / 7 actives avec mise bas : ' + JSON.stringify({ s: r.sansControle, f: r.signauxForts, c: r.controlees, m: r.misesBasActives }));
const par = Object.fromEntries(r.liste.map(l => [parseInt(l.eid.slice(-4), 10), l]));
check(par[2].attendueTraite && par[2].signalFort && par[2].agneauxNonRegles === 0 && par[2].nes === 2 && par[2].dateMiseBas === '2026-11-12', 'B : agneaux tous réglés = attendue à la traite = signal fort : ' + JSON.stringify(par[2]));
check(!par[3].attendueTraite && !par[3].signalFort && par[3].agneauxNonRegles === 1, 'C : un agneau non réglé = pas encore attendue : ' + JSON.stringify(par[3]));
check(!par[4].attendueTraite && par[4].agneauxSousElle === 0 && par[4].nes === 0, 'D : aucun agneau enregistré = pas attendue : ' + JSON.stringify(par[4]));
check(par[8] && !par[8].attendueTraite, 'H : un contrôle d\'une AUTRE campagne ne compte pas : listée');
check(par[10].attendueTraite && par[10].mortNes === 1 && par[10].nes === 2, 'M : mort-né + vendu = tous réglés : ' + JSON.stringify(par[10]));
check(!cles.includes(1) && !cles.includes(5) && !cles.includes(6) && !cles.includes(7) && !cles.includes(9) && !cles.includes(11) && !cles.includes(20), 'exclues : contrôlée (A), vendue (E), sans mise bas (F, N), autre campagne (G), contrôle au registre (K), archivée');
check(await page.evaluate(() => JSON.stringify(DB)) === avant && await page.evaluate(() => window.__saves) === 0, 'fonction pure : DB inchangée, 0 saveData');
console.log('OK 1 fonction pure : contrôlée / jamais contrôlée / vendue / autre campagne / contrôle au registre / archivée ; signaux forts d\'abord ; aucune écriture.');

// ---- campagne précédente (2025) : contrôle d\'une autre campagne, pas de contrôle importé en 2025 -> règle muette
const r25 = await page.evaluate(() => { const x = brebisMiseBasSansControleLaitier(2025); return { imp: x.controleImporte, n: x.liste.length }; });
check(r25.imp === true && r25.n === 1, 'campagne 2025 : un contrôle importé (H), G a mis bas sans contrôle : ' + JSON.stringify(r25));

// ================================================================ 2. aucun contrôle importé : rien n'est signalé
await page.evaluate(() => jeuLait(false));
const r0 = await page.evaluate(() => JSON.parse(JSON.stringify(brebisMiseBasSansControleLaitier(2026))));
check(r0.controleImporte === false && r0.liste.length === 0 && r0.sansControle === 0 && r0.signauxForts === 0, 'aucun contrôle importé : liste vide (sinon toutes les brebis seraient signalées à tort) : ' + JSON.stringify(r0));
check(await page.evaluate(() => carteSansControleLaitierHtml(brebisMiseBasSansControleLaitier(2026))) === '', 'aucune carte avant l\'import du 1er contrôle');
// Import du 1er contrôle (sur une seule brebis) : la règle s'enclenche
await page.evaluate(() => { DB.brebis[0].controleLaitier.push({ controle: 1, quantite: 1, anomalie: null, date: '2027-01-15', campagne: 2026 }); });
const r1 = await page.evaluate(() => brebisMiseBasSansControleLaitier(2026).liste.map(l => parseInt(l.eid.slice(-4), 10)));
check(JSON.stringify(r1) === JSON.stringify([2, 10, 3, 4, 8, 9]), 'après le 1er contrôle importé : toutes les autres brebis ayant mis bas sont listées (K sans contrôle ici) : ' + JSON.stringify(r1));
// Une brebis contrôlée dans au moins un contrôle sort de la liste
await page.evaluate(() => { DB.brebis.find(b => b.eid === E(6, 3)).controleLaitier.push({ controle: 2, quantite: 0.8, anomalie: null, date: '2027-02-15', campagne: 2026 }); });
const r2 = await page.evaluate(() => brebisMiseBasSansControleLaitier(2026).liste.map(l => parseInt(l.eid.slice(-4), 10)));
check(!r2.includes(3) && r2.length === 5, 'C contrôlée au 2e contrôle seulement : sort de la liste : ' + JSON.stringify(r2));
console.log('OK 2 aucun contrôle importé : liste vide et pas de carte ; après le 1er import la règle s\'enclenche ; une brebis contrôlée (même au 2e contrôle) sort de la liste.');

// ================================================================ 3. cohérence avec le bilan de lactation
await page.evaluate(() => jeuLait(true));
const coh = await page.evaluate(() => {
  const sans = new Set(brebisMiseBasSansControleLaitier(2026).liste.map(l => l.eid));
  const traites = new Set(registreEntriesFor('brebis').filter(e => (e.controleLaitier || []).some(c => c.campagne === 2026)).map(e => e.eid));
  const ind = bilanLactationIndicateurs(2026);
  const inter = [...sans].filter(e => traites.has(e));
  // toute brebis active ayant mis bas est soit « passée à la traite », soit « sans contrôle »
  const actives = DB.brebis.filter(b => (b.statut || 'active') === 'active' && agnelageDeCampagne(b, 2026));
  const partition = actives.every(b => sans.has(b.eid) !== traites.has(b.eid));
  return { inter: inter.length, brebisTraite: ind.brebisTraite, traites: traites.size, partition, actives: actives.length };
});
check(coh.inter === 0 && coh.brebisTraite === coh.traites && coh.partition, 'aucune brebis à la fois sans contrôle et passée à la traite ; partition mises bas actives = traites + sans contrôle ; lactation : ' + JSON.stringify(coh));
console.log('OK 3 cohérence avec le bilan de lactation : « brebis passées à la traite » (' + coh.brebisTraite + ') et « sans contrôle » ne se recoupent jamais ; chaque brebis active ayant mis bas est dans l\'un ou l\'autre.');

// ================================================================ 4. carte mobile : plus dans « Brebis à régulariser » (remplacée par la bande ambre du Contrôle laitier)
await page.evaluate(() => { bilanCampagneTab = 'incoherences'; render('bilan-campagne'); });
check(await page.evaluate(() => !document.getElementById('carte-sans-controle-laitier') && !/sans contrôle laitier/i.test(document.getElementById('app').textContent)), 'mobile : plus de carte « sans contrôle laitier » dans Brebis à régulariser');
// la même carte (5 lignes) s'ouvre depuis la bande ambre de l'écran Contrôle laitier
await page.evaluate(() => render('controle-laitier'));
await page.click('#btn-cl-bande-sans');
const mob = await page.evaluate(() => {
  const c = document.getElementById('carte-sans-controle-laitier');
  return c ? { texte: c.textContent.replace(/\s+/g, ' '), lignes: [...c.querySelectorAll('.sans-controle-ligne')].map(l => l.textContent.replace(/\s+/g, ' ').trim()), nb: c.querySelectorAll('.bilan-eid-link').length } : null;
});
check(mob && mob.lignes.length === 5 && mob.nb === 5, 'carte mobile : 5 lignes : ' + JSON.stringify(mob));
check(/Ont mis bas, sans contrôle laitier/.test(mob.texte) && /5 brebis/.test(mob.texte) && /2 attendues à la traite : signal fort/.test(mob.texte), 'titre, compteur, signal fort : ' + mob.texte);
check(/n°0002 .*mise bas le 12\/11 · 2 agneaux.*attendue à la traite.*Ouvrir la fiche/.test(mob.lignes[0]) || /mise bas le 12\/11 · 2 agneaux/.test(mob.lignes[0]) && /attendue à la traite/.test(mob.lignes[0]) && !/pas encore/.test(mob.lignes[0]) && /Ouvrir la fiche/.test(mob.lignes[0]), 'ligne B : date, agneaux, attendue (fort), lien : ' + mob.lignes[0]);
check(/mise bas le 20\/11 · 2 agneaux/.test(mob.lignes[2]) && /pas encore attendue \(1 agneau non réglé\)/.test(mob.lignes[2]), 'ligne C : pas encore attendue (1 agneau non réglé) : ' + mob.lignes[2]);
check(/mise bas le 02\/12 · 0 agneau/.test(mob.lignes[3]) && /aucun agneau enregistré/.test(mob.lignes[3]), 'ligne D : aucun agneau enregistré : ' + mob.lignes[3]);
check(/\(dont 1 mort-né\)/.test(mob.lignes[1]), 'ligne M : « dont 1 mort-né » : ' + mob.lignes[1]);
// « Ouvrir la fiche » ouvre la fiche de la brebis, sans rien écrire
await page.click('#carte-sans-controle-laitier .sans-controle-ligne >> nth=0');
const vue = await page.evaluate(() => ({ view: currentView, id: currentSheepId || (typeof currentId !== 'undefined' ? currentId : null), saves: window.__saves, titre: document.getElementById('app').textContent.slice(0, 300).replace(/\s+/g, ' ') }));
check(vue.view === 'detail' && vue.saves === 0 && /0002/.test(vue.titre), 'clic = fiche de la brebis B ouverte, 0 saveData : ' + JSON.stringify(vue));
console.log('OK 4 carte mobile : retirée de Brebis à régulariser ; dans Contrôle laitier (bande ambre) : 5 lignes (n°, date, agneaux, état), signal fort compté, « Ouvrir la fiche » ouvre la fiche, 0 écriture.');
await page.context().close();

// ================================================================ 5. PC : même carte dans « Brebis à régulariser »
const pc = await ouvrir(true);
await pc.evaluate(() => { jeuLait(true); bilanCampagneTab = 'incoherences'; render('bilan-campagne'); });
const nbPc = await pc.evaluate(() => document.querySelectorAll('#carte-sans-controle-laitier .sans-controle-ligne').length);
check(nbPc === 5, 'carte PC : 5 lignes : ' + nbPc);
await pc.evaluate(() => { jeuLait(false); bilanCampagneTab = 'incoherences'; render('bilan-campagne'); });
check(await pc.evaluate(() => !document.getElementById('carte-sans-controle-laitier')), 'PC : pas de carte tant qu\'aucun contrôle n\'est importé');
console.log('OK 5 PC : même carte dans « Brebis à régulariser », absente avant l\'import du 1er contrôle.');
await browser.close();
console.log('\nTOUS LES TESTS DE LA RÈGLE « SANS CONTRÔLE LAITIER » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
