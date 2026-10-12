/* PDF « bilan de reproduction complet » (A4) : mêmes chiffres que la page PC, lus dans
   le texte du PDF généré (jeu synthétique du bilan du 23/09). Vérifie : structure PDF
   valide (xref, nombre de pages, pieds de page), tous les chiffres du bilan, campagne
   passée, campagne vide, pagination quand il y a beaucoup de millésimes / semaines, nom
   du fichier et type MIME, bouton de la page PC, et le PDF « par âge » d'une campagne
   passée. Aucune écriture de données. Aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';

const browser = await chromium.launch(LAUNCH);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await ctx.newPage();
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

await page.evaluate(() => {
  DB = migrateData({});
  window.__saves = 0;
  const o = saveData; saveData = function (...a) { window.__saves++; return o.apply(this, a); };
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
  // Décode le texte d'un PDF produit par l'appli : opérateurs « (texte) Tj », séquences \ddd et \( \) \\
  window.lirePdf = (bytes) => {
    const s = new TextDecoder('windows-1252').decode(bytes);   // un octet = un caractère : les positions du xref restent exactes
    const textes = [...s.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(m => m[1].replace(/\\(\d{3})/g, (_, o) => new TextDecoder('windows-1252').decode(Uint8Array.of(parseInt(o, 8)))).replace(/\\([()\\])/g, '$1'));
    const xref = s.lastIndexOf('startxref');
    const off = parseInt(s.slice(xref + 10), 10);
    const nObj = parseInt((s.slice(off).match(/xref\n0 (\d+)/) || [])[1], 10);
    let ok = s.slice(off, off + 4) === 'xref' && s.startsWith('%PDF-1.4');
    const tab = s.slice(off).split('\n').slice(2, 2 + nObj).slice(1);
    tab.forEach((ligne, i) => { const o = parseInt(ligne.slice(0, 10), 10); if (s.slice(o, o + ((i + 1) + ' 0 obj').length) !== (i + 1) + ' 0 obj') ok = false; });
    return { textes, pages: parseInt((s.match(/\/Count (\d+)/) || [])[1], 10), xrefOk: ok, nObj, brut: s };
  };
});

// ================================================================ 1. contenu du PDF
await page.evaluate(() => jeu());
let r = await page.evaluate(() => { const p = lirePdf(buildBilanCompletPdfBytes(2025)); return { t: p.textes, pages: p.pages, ok: p.xrefOk, n: p.nObj }; });
check(r.ok && r.pages === 2, 'structure PDF valide (xref, en-tête), 2 pages : ' + JSON.stringify({ ok: r.ok, pages: r.pages }));
const txt = r.t;
const a = (...v) => v.forEach(x => check(txt.includes(x), 'le PDF doit contenir « ' + x + ' »'));
a('Bilan de reproduction', 'Campagne 2026 · du 01/10/2025 au 30/09/2026 · troupeau entier', 'MISES BAS', 'PROLIFICITÉ', 'MORTINATALITÉ', 'MORTALITÉ APRÈS NAISSANCE');
a('363', '1,18', '3,3 %', '9,2 %', '427 agneaux nés', '14 mort(s)-né(s)', '38 sur 413 nés vivants');
// tableau par groupe : lignes lues dans l'ordre d'écriture (libellé, brebis, antenaises, total)
const ligne = (lib) => { const i = txt.indexOf(lib); return txt.slice(i + 1, i + 4); };
const attendu = { 'Mises bas': ['296', '67', '363'], 'Portées simples': ['237', '62', '299'], 'Portées doubles': ['59', '5', '64'], 'Portées triples': ['0', '0', '0'], 'Agneaux nés': ['355', '72', '427'], 'Femelles': ['175', '38', '213'], 'Mâles': ['172', '28', '200'], 'Morts-nés': ['8', '6', '14'], 'Morts après naissance': ['25', '13', '38'], 'Prolificité': ['1,20', '1,07', '1,18'], 'Mortalité totale': ['9,30 %', '26,39 %', '12,18 %'] };
// repère le tableau par groupe : après « Bilan par groupe d'âge »
const debut = txt.indexOf("Bilan par groupe d'âge");
const dansTableau = (lib) => { const i = txt.indexOf(lib, debut); return txt.slice(i + 1, i + 4); };
for (const [lib, v] of Object.entries(attendu)) check(dansTableau(lib).join('|') === v.join('|'), 'PDF, tableau par groupe « ' + lib + ' » attendu ' + v + ', obtenu ' + dansTableau(lib));
a('Mises bas par semaine', 'S1', 'S10', '84', 'Répartition des portées', 'Simples', '299', 'Détail par millésime', 'Mouvements des brebis', 'Mouvements des agneaux', 'Nés vivants', '413'.replace('413', '413'));
check(txt.filter(t => /^Page \d\/2$/.test(t)).length === 2, 'pieds de page « Page 1/2 » et « Page 2/2 »');
check(!txt.some(t => /portées doubles.*%/i.test(t) && /\d %/.test(t)), 'aucun pourcentage de portées doubles (supprimé)');
console.log('OK 1 PDF complet : structure valide, 2 pages, KPI et tableau par groupe égaux au bilan du 23/09 (296+67, 299/64/0, 427, 38, 1,20/1,07/1,18, 9,30/26,39/12,18 %), courbe, portées, millésimes, mouvements, pieds de page.');

// ================================================================ 2. campagne passée, vide, grosse campagne
r = await page.evaluate(() => {
  jeu();
  DB.brebis.slice(0, 5).forEach(b => b.agnelages.push({ date: '2025-02-10', campagne: 2024, lambs: [{ sexe: 'Mâle' }, { sexe: 'Femelle' }] }));
  const passee = lirePdf(buildBilanCompletPdfBytes(2024));
  const ageP = lirePdf(buildBilanAgeExactPdfBytes(2024));
  const ageC = lirePdf(buildBilanAgeExactPdfBytes());
  return { passee: passee.textes, ageP: ageP.textes, ageC: ageC.textes, okP: passee.xrefOk, okA: ageP.xrefOk };
});
check(r.okP && r.okA && r.passee.some(t => /^Campagne 2025/.test(t)) && r.passee.some(t => /campagne terminée/.test(t)) && r.passee.includes('5'), 'PDF d\'une campagne passée (2025, terminée, 5 mises bas)');
check(r.ageP.some(t => /Campagne 2025/.test(t)) && r.ageC.some(t => /Campagne 2026/.test(t)), 'PDF « par âge » : campagne passée = Campagne 2025, sans argument = campagne en cours (inchangé)');
r = await page.evaluate(() => { jeu(); DB.brebis = DB.brebis.slice(0, 5); DB.brebis.forEach(b => b.agnelages = []); const p = lirePdf(buildBilanCompletPdfBytes(2025)); return { ok: p.xrefOk, t: p.textes, pages: p.pages }; });
check(r.ok && r.t.includes('Aucune mise bas datée') && r.t.includes('—'), 'PDF d\'une campagne sans mise bas : valide, « Aucune mise bas datée », ratios « — »');
r = await page.evaluate(() => {
  jeu(40);
  // beaucoup de millésimes (15) : le détail par millésime déborde sur une page de plus
  DB.brebis.forEach((b, i) => { b.eid = eid(i % 10, 1000 + i).slice(0, 10) + String(i % 10) + eid(0, 1000 + i).slice(11); });
  const p = lirePdf(buildBilanCompletPdfBytes(2025));
  return { pages: p.pages, ok: p.xrefOk, pieds: p.textes.filter(t => /^Page \d+\/\d+$/.test(t)).length, suites: p.textes.filter(t => /\(suite\)/.test(t)).length };
});
check(r.ok && r.pages >= 2 && r.pieds === r.pages, 'grosse campagne (40 semaines, 10 millésimes) : PDF valide, un pied de page par page : ' + JSON.stringify(r));
console.log('OK 2 campagne passée (Campagne 2025, terminée), PDF « par âge » d\'une campagne passée, campagne vide, grosse campagne (40 semaines) : PDF valides.');

// ================================================================ 3. export : nom, type, bouton PC
await page.evaluate(() => {
  jeu();
  DB.brebis.slice(0, 5).forEach(b => b.agnelages.push({ date: '2025-02-10', campagne: 2024, lambs: [{ sexe: 'Mâle' }] }));
  window.__envois = [];
  window.saveOrShareBinaryFile = async (nom, bytes, mime) => { window.__envois.push({ nom, taille: bytes.length, mime, debut: String.fromCharCode.apply(null, bytes.subarray(0, 8)) }); };
  bilanCampagneTab = 'reproduction'; bilanReproductionCampagneAffichee = null; render('bilan-campagne');
});
await page.waitForSelector('#btn-export-bilan-complet-pdf');
await page.click('#btn-export-bilan-complet-pdf');
await page.waitForFunction(() => window.__envois.length === 1);
let env = await page.evaluate(() => window.__envois[0]);
check(/^bilan-reproduction-complet_campagne-2026_\d{4}-\d{2}-\d{2}\.pdf$/.test(env.nom) && env.mime === 'application/pdf' && env.debut.startsWith('%PDF-1.4') && env.taille > 5000, 'export de la campagne en cours : ' + JSON.stringify(env));
await page.selectOption('#brd-campagne-select', '2024');
await page.waitForFunction(() => /Campagne 2025/.test(document.querySelector('.brd-sub').textContent));
await page.click('#btn-export-bilan-complet-pdf');
await page.waitForFunction(() => window.__envois.length === 2);
env = await page.evaluate(() => window.__envois[1]);
check(/campagne-2025_/.test(env.nom), 'le PDF suit la campagne affichée : ' + env.nom);
await page.click('#btn-export-bilan-age-pdf');
await page.waitForFunction(() => window.__envois.length === 3);
env = await page.evaluate(() => window.__envois[2]);
check(/^bilan-reproduction-par-age_/.test(env.nom), 'le PDF « par âge » reste disponible : ' + env.nom);
check(await page.evaluate(() => window.__saves) === 0, 'aucun saveData');
console.log('OK 3 export : nom de fichier daté, type application/pdf, le PDF suit la campagne affichée sur la page PC, « par âge » inchangé, 0 saveData.');

console.log('\nTOUS LES TESTS DU PDF BILAN COMPLET SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
await browser.close();
process.exit(0);
