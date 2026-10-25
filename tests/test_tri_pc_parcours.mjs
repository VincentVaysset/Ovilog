/* Chantier de tri, partie c : PARCOURS PC à 1200 et 1400 px -- saisie au clavier d'un n° ou EID (aucun scan, aucun « bip » à l'écran), Entrée SÉLECTIONNE la ligne sans la valider, tableau sans coupure
   ni défilement horizontal (en-têtes jamais coupés), Garder / Écarter / Reconsidérer + « Annuler » (restauration EXACTE de la fiche), origine IA / RE / EP / MN en code seul, Export Excel (suit l'onglet)
   puis Export PDF (charte : tuiles, tableau vert, pied « Ovilog — … · Campagne », même PDF sur PC et mobile). Jeu synthétique, saveData remplacé. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { lirePdfMots } from './lib/pdf_texte.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
let reponse = true; const confirms = [];
const JEU = () => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true; DB.exploitation = { nom: 'Exploitation B' };
  window.E = (d, n) => '2500000121' + d + String(n).padStart(4, '0');
  const f = (d, n, extra) => Object.assign({ id: 'b' + d + n, eid: E(d, n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, extra || {});
  const l = (n, extra) => Object.assign({ eid: E(6, n), sexe: 'Femelle', sanitaire: [], mouvements: [] }, extra || {});
  DB.brebis = [
    f(8, 1, { agnelages: [{ campagne: 2025, date: '2026-01-14', codeRepro: 'IA', lambs: [l(1), l(2), l(3)] }] }),
    f(8, 2, { agnelages: [{ campagne: 2025, date: '2026-01-20', codeRepro: 'EP', lambs: [l(4), l(5, { statutFinal: 'vendu' })] }] }),
    f(8, 3, { agnelages: [{ campagne: 2025, date: '2026-01-25', codeRepro: 'RE', lambs: [l(6)] }] }),
    f(8, 4, { agnelages: [{ campagne: 2025, date: '2026-01-27', codeRepro: 'MN', lambs: [l(7, { triStatut: 'écartée' })] }] }),
    f(8, 5, { statut: 'vendue', agnelages: [{ campagne: 2025, date: '2026-02-01', codeRepro: 'IA', lambs: [l(8)] }] })      // mère vendue : origine « — »
  ];
  DB.lactationModele = [{ eid: E(8, 1), campagne: 2025, lactationTotale: 452, classeParQuart: '1' }];
  DB.agnelles = [];
  const mk = (id, n, extra) => Object.assign({ id, eid: E(6, n), origine: 'née', motherEid: E(8, 1), dateEntree: '2026-09-01', sanitaire: [], notes: [], mouvements: [{ type: 'Naissance', cause: null, date: '2026-01-14' }, { type: 'Entrée', cause: 'Tri (renouvellement)', date: '2026-09-01' }] }, extra || {});
  const a2 = mk('a2', 2, { sanitaire: [{ date: '2026-09-15', produit: 'Vitamine B12' }], notes: [{ date: '2026-09-18', texte: 'Petite' }], mouvements: [{ type: 'Naissance', cause: null, date: '2026-01-14' }, { type: 'Entrée', cause: 'Tri (renouvellement)', date: '2026-09-01' }, { type: 'Transfert', cause: 'Lot', date: '2026-09-25' }] });
  DB.agnelles = [mk('a1', 1), a2];
  findLambByEid(E(6, 1)).triStatut = 'gardée'; findLambByEid(E(6, 2)).triStatut = 'gardée';
  window.__avant = JSON.stringify(DB);
};
let pdfPc = null;
for (const largeur of [1200, 1400]) {
  const page = await (await browser.newContext({ viewport: { width: largeur, height: 900 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
  await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponse ? d.accept() : d.dismiss(); } else d.accept(); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(JEU);
  const ouvrir = async (o) => { await page.evaluate((o) => { triPcEtat = null; render('agnelles'); if (o) { triPcEtat.onglet = o; render('agnelles'); } }, o); await page.waitForSelector('#pc-tri-agnelles'); };
  const sansCoupure = async (m) => { const r = await page.evaluate(() => { const t = document.querySelector('#pc-tri-agnelles .pc-t'), z = document.querySelector('.tri-pc-tableau');
    return { page: document.documentElement.scrollWidth <= innerWidth, tableau: z.scrollWidth <= z.clientWidth + 1 && t.scrollWidth <= z.clientWidth + 1, entetes: [...t.querySelectorAll('th')].every(h => h.scrollWidth <= h.clientWidth + 1), cellules: [...t.querySelectorAll('td')].every(h => h.scrollWidth <= h.clientWidth + 1), lignes: [...t.querySelectorAll('tr[data-eid]')].every(tr => tr.getBoundingClientRect().height >= 47 && tr.getBoundingClientRect().height <= 60) }; });
    check(r.page && r.tableau && r.entetes && r.cellules && r.lignes, largeur + ' px : tableau sans coupure ni défilement horizontal, lignes de 48 px (' + m + ') ' + JSON.stringify(r)); };
  await ouvrir(); await sansCoupure('À trier');
  // pas de scan sur PC : aucun libellé « Scanner » ni « bip »
  check(await page.evaluate(() => !/scann|bip/i.test(document.getElementById('app').innerText)), largeur + ' px : aucun libellé « Scanner » ni « bip » sur PC');
  // origine en code seul (aucune légende, aucune infobulle), « — » pour une mère vendue
  const orig = await page.evaluate(() => [...document.querySelectorAll('#ta-table-atrier tr[data-eid]')].map(r => [r.children[0].textContent, r.children[4].textContent.trim(), r.children[4].querySelector('[title]') ? 'title' : '']));
  check(JSON.stringify(orig) === JSON.stringify([['60003', 'IA', ''], ['60004', 'EP', ''], ['60006', 'RE', ''], ['60008', '—', '']]), largeur + ' px : origine IA / EP / RE, « — » mère vendue, sans infobulle : ' + JSON.stringify(orig));
  check(await page.evaluate(() => !/Insémination|Monte naturelle|Éponge/.test(document.getElementById('app').innerText) && !!document.querySelector('.tri-origine[aria-label="Insémination artificielle"]')), 'libellé complet seulement en accessibilité (aria-label), aucune légende à l\'écran');
  // saisie : Entrée sélectionne sans valider
  await page.fill('#ta-q', '60004');
  check(await page.evaluate(() => document.querySelectorAll('tr.sel').length) === 0, 'frappe seule : aucune sélection');
  await page.press('#ta-q', 'Enter');
  check(await page.evaluate(() => document.querySelectorAll('tr.sel').length) === 1 && await page.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), largeur + ' px : Entrée sélectionne la ligne, rien n\'est validé');
  await page.fill('#ta-q', await page.evaluate(() => E(6, 7))); await page.press('#ta-q', 'Enter');
  check(/Écartées/.test(await page.evaluate(() => document.querySelector('.tri-onglet.active').textContent)) && await page.evaluate(() => document.querySelector('tr.sel').dataset.eid === E(6, 7)), 'un EID complet saisi trouve l\'écartée dans son onglet');
  // Garder / Écarter / Annuler
  await ouvrir(); confirms.length = 0;
  await page.click('.ta-garder >> nth=0');
  check(confirms.length === 0 && await page.evaluate(() => DB.agnelles.length) === 3 && /gardée/.test(await page.evaluate(() => document.getElementById('tri-toast').textContent)), largeur + ' px : Garder en un geste, bandeau « Annuler »');
  await page.click('#tri-toast-annuler'); check(await page.evaluate(() => DB.agnelles.length) === 2, 'Annuler');
  await page.click('.ta-ecarter >> nth=0'); check(await page.evaluate(() => DB.brebis.flatMap(b => b.agnelages.flatMap(a => a.lambs)).filter(x => x.triStatut === 'écartée').length) === 2, 'Écarter');
  await page.click('#tri-toast-annuler'); check(await page.evaluate(() => DB.brebis.flatMap(b => b.agnelages.flatMap(a => a.lambs)).filter(x => x.triStatut === 'écartée').length) === 1, 'Annuler l\'écartement');
  // RESTAURATION EXACTE : Reconsidérer une gardée qui porte des saisies (confirmation) puis Annuler
  await ouvrir('gardees'); await sansCoupure('Gardées');
  await page.evaluate(() => { window.__fiches = JSON.stringify(DB.agnelles); window.__lambs = JSON.stringify([1, 2].map(n => findLambByEid(E(6, n)))); });
  reponse = false; confirms.length = 0;
  await page.click('.ta-reconsiderer[data-eid="' + await page.evaluate(() => E(6, 2)) + '"]');
  check(confirms.length === 1 && await page.evaluate(() => DB.agnelles.length) === 2, largeur + ' px : fiche avec soins, notes, mouvements : confirmation ; refus = rien');
  reponse = true;
  await page.click('.ta-reconsiderer[data-eid="' + await page.evaluate(() => E(6, 2)) + '"]');
  check(await page.evaluate(() => DB.agnelles.map(a => a.id).join()) === 'a1', 'accord : la fiche quitte les gardées');
  await page.click('#tri-toast-annuler');
  const apres = await page.evaluate(() => ({ fiches: JSON.stringify(DB.agnelles) === window.__fiches, lambs: JSON.stringify([1, 2].map(n => findLambByEid(E(6, n)))) === window.__lambs, ordre: DB.agnelles.map(a => a.id).join() }));
  check(apres.fiches && apres.lambs && apres.ordre === 'a1,a2', largeur + ' px : « Annuler » restaure la fiche EXACTEMENT (soins, notes, mouvements, place) : ' + JSON.stringify(apres));
  // exports : Excel suit l'onglet, PDF à la charte
  await ouvrir('gardees');
  const labels = await page.evaluate(() => [...document.querySelectorAll('.tri-pc-exports button')].map(b => [b.textContent, b.className]));
  check(JSON.stringify(labels) === JSON.stringify([['Export Excel', 'btn btn-secondary'], ['Export PDF', 'btn btn-primary']]), 'boutons : « Export Excel » (blanc) puis « Export PDF » (vert)');
  await page.evaluate(() => { window.__noms = []; window.__xl = []; buildXlsxWorkbook = async (f) => { window.__xl.push(f); return new Uint8Array([1]); }; saveOrShareBinaryFile = async (nom, bytes) => { window.__noms.push(nom); window.__pdf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); }; });
  for (const [onglet, xlsx, pdf] of [['aTrier', 'agnelles-a-trier_2026-10-03.xlsx', 'chantier-de-tri_a-trier_2026-10-03.pdf'], ['gardees', 'agnelles-triees_2026-10-03.xlsx', 'chantier-de-tri_triees_2026-10-03.pdf'], ['ecartees', 'agnelles-ecartees_2026-10-03.xlsx', 'chantier-de-tri_ecartees_2026-10-03.pdf']]) {
    await page.evaluate((o) => { triPcEtat.onglet = o; render('agnelles'); window.__noms = []; }, onglet);
    await page.click('#ta-export'); await page.waitForTimeout(80); await page.click('#ta-export-pdf'); await page.waitForTimeout(150);
    check(JSON.stringify(await page.evaluate(() => window.__noms)) === JSON.stringify([xlsx, pdf]), largeur + ' px : exports de l\'onglet ' + onglet + ' : ' + JSON.stringify(await page.evaluate(() => window.__noms)));
    const octets = await page.evaluate(() => Array.from(window.__pdf));
    const r = lirePdfMots(octets);
    const txt = r.mots.join(' ');
    check(r.pages === 1 && r.tailles[0][0] > r.tailles[0][1] && /Chantier de tri/.test(txt) && /À trier/.test(txt) && /Gardées/.test(txt) && /Écartées/.test(txt) && /Page 1\/1/.test(txt) && /Campagne 2027/.test(txt) && /Ovilog/.test(txt) && r.vert > 0, largeur + ' px : PDF « ' + onglet + ' » : paysage, titre, tuiles, pied « Page 1/1 », bandeau vert : ' + txt.slice(0, 200));
    if (onglet === 'aTrier') { check(['N°', 'Naissance', 'Portée', 'Mère', 'Origine', 'État', 'Classe', 'Lactation'].every(m => r.mots.some(w => w.startsWith(m))) && r.mots.includes('IA') && r.mots.includes('EP') && r.mots.includes('RE'), 'PDF À trier : en-têtes et codes d\'origine IA / EP / RE'); if (largeur === 1200) pdfPc = octets; }
  }
  await page.context().close();
  console.log('OK ' + largeur + ' px : saisie clavier (Entrée = sélection), tableau sans coupure, origine en code seul, Garder / Écarter / Reconsidérer + Annuler, fiche restaurée exactement, exports Excel par onglet et PDF charte.');
}
// même PDF sur mobile
const mob = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();
await mob.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
await mob.goto(URL_APP, { waitUntil: 'load' }); await mob.waitForTimeout(300);
await mob.evaluate(JEU);
const octetsMob = await mob.evaluate(() => Array.from(buildTriAgnellesPdfBytes('aTrier', triAgnellesDonnees())));
check(octetsMob.length === pdfPc.length && octetsMob.every((v, i) => v === pdfPc[i]), 'le PDF est identique octet pour octet sur PC et sur mobile');
console.log('OK PDF identique sur PC et mobile.');
await browser.close();
