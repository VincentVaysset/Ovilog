/* Mise bas d'une brebis en lot IA / éponge : la règle suit les bornes RÉGLÉES du compte (Paramètres › Campagne). Avant G min : question IA (ou EP) / MN ;
   G min-G max : IA (ou EP) d'office ; entre G max et R min : question IA (ou EP) / RE / MN ; à partir de R min (même après R max) : RE d'office ; hors
   lot : MN. La question est obligatoire (aucun choix par défaut, rien d'enregistré sans réponse) sur les trois saisies (fiche brebis, saisie rapide
   mobile, saisie PC) ; le bilan des lots suit le code FIXÉ à la saisie (IA / EP = directe, RE = 1er retour, MN = hors lot). saveData REMPLACÉ ; jeu
   synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1400, height: 1000 } : { width: 390, height: 844 } })).newPage();
  await page.clock.setFixedTime(new Date('2027-03-20T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({}); window.__saves = 0; saveData = () => { window.__saves++; return true; };
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    window.E = n => '250000004569' + String(n).padStart(3, '0');
    const fiche = (n, extra) => Object.assign({ id: 'b' + n, eid: E(n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, extra || {});
    DB.brebis = [1, 2, 3, 4, 5, 6, 7, 8].map(n => fiche(n)); DB.beliers = []; DB.agnelles = []; DB.lots = [];
    // lot IA du 20/10/2026 (brebis 1 à 6), lot éponge du 20/10/2026 (brebis 7) ; brebis 8 hors lot
    const lotIA = { id: 'LIA', type: 'reproduction', nom: 'IA octobre', mode: 'IA', cible: 'Brebis', dateCreation: '2026-10-20', dateEvenement: '2026-10-20', campagneMisesBas: 2026, membres: [1, 2, 3, 4, 5, 6].map(E) };
    const lotEP = { id: 'LEP', type: 'reproduction', nom: 'Éponge octobre', mode: 'EP', cible: 'Brebis', dateCreation: '2026-10-04', dateEvenement: '2026-10-20', campagneMisesBas: 2026, membres: [E(7)] };
    DB.lots = [lotIA, lotEP];
    DB.brebis.forEach(b => { const n = +b.id.slice(1); if (n <= 6) b.modesRepro.push({ date: '2026-10-20', mode: 'IA', lotId: 'LIA', campagne: 2026 }); if (n === 7) b.modesRepro.push({ date: '2026-10-20', mode: 'EP', lotId: 'LEP', campagne: 2026 }); });
    window.J = j => { const d = new Date(Date.UTC(2026, 9, 20) + j * 86400000); return d.toISOString().slice(0, 10); };   // date = lot + j jours
  });
  return page;
}
const situ = (page, n, j) => page.evaluate(([n, j]) => { const s = situationReproMiseBas(DB.brebis.find(b => b.id === 'b' + n), J(j)); return s.question ? 'Q:' + s.question.choix.join('/') : s.code; }, [n, j]);

const page = await ouvrir(false);
// ================================================================ 1. règle, bornes par défaut (144-152 / 160-171)
const r1 = {}; for (const j of [130, 143, 144, 152, 153, 159, 160, 171, 190]) r1[j] = await situ(page, 1, j);
eq(r1, { 130: 'Q:IA/MN', 143: 'Q:IA/MN', 144: 'IA', 152: 'IA', 153: 'Q:IA/RE/MN', 159: 'Q:IA/RE/MN', 160: 'RE', 171: 'RE', 190: 'RE' }, 'lot IA, bornes par défaut');
const r2 = {}; for (const j of [120, 148, 156, 165]) r2[j] = await situ(page, 7, j);
eq(r2, { 120: 'Q:EP/MN', 148: 'EP', 156: 'Q:EP/RE/MN', 165: 'RE' }, 'lot éponge : EP au lieu de IA');
eq([await situ(page, 8, 148), await situ(page, 8, 130)], ['MN', 'MN'], 'brebis hors lot : MN, sans question');
console.log('OK 1 règle aux bornes par défaut : question avant G min et entre G max et R min ; IA/EP et RE d\'office ; hors lot MN.');

// ================================================================ 2. bornes réglées par le compte (145-150 / 158-170), puis bornes qui se touchent
await page.evaluate(() => { DB.reproGestationMin = 145; DB.reproGestationMax = 150; DB.reproRetourMin = 158; DB.reproRetourMax = 170; });
const r3 = {}; for (const j of [144, 145, 150, 151, 157, 158, 175]) r3[j] = await situ(page, 1, j);
eq(r3, { 144: 'Q:IA/MN', 145: 'IA', 150: 'IA', 151: 'Q:IA/RE/MN', 157: 'Q:IA/RE/MN', 158: 'RE', 175: 'RE' }, 'bornes réglées 145-150 / 158-170');
await page.evaluate(() => { DB.reproGestationMin = 144; DB.reproGestationMax = 155; DB.reproRetourMin = 156; DB.reproRetourMax = 171; });
eq([await situ(page, 1, 155), await situ(page, 1, 156)], ['IA', 'RE'], 'bornes qui se touchent : aucune question entre les deux');
const texteQ = await page.evaluate(() => { const s = situationReproMiseBas(DB.brebis[0], J(140)); return questionReproHtml(s, null).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); });
check(/lot « IA octobre »/.test(texteQ) && /140 j/.test(texteQ) && /144 à 155 j/.test(texteQ) && /IA ou monte naturelle/.test(texteQ), 'texte de la question avec les bornes du compte : ' + texteQ);
await page.evaluate(() => { DB.reproGestationMin = 144; DB.reproGestationMax = 152; DB.reproRetourMin = 160; DB.reproRetourMax = 171; });
console.log('OK 2 bornes réglées par le compte respectées (question, codes d\'office), bornes qui se touchent sans question.');

// ================================================================ 3. fiche brebis (mobile) : question obligatoire, rien d'enregistré sans réponse
await page.evaluate(() => { currentSheepId = 'b1'; editContext = null; render('add-agnelage', 'b1'); });
await page.fill('#f-date', await page.evaluate(() => J(138))); await page.dispatchEvent('#f-date', 'change');
const q1 = await page.evaluate(() => ({ boutons: [...document.querySelectorAll('#repro-question .repro-question-btn')].map(b => b.textContent), choisi: [...document.querySelectorAll('.repro-code-opt.selected')].length }));
eq(q1, { boutons: ['IA', 'Monte naturelle'], choisi: 0 }, 'fiche : question IA / Monte naturelle, aucun code choisi d\'office');
await page.click('#add-lamb'); await page.waitForTimeout(50);
await page.evaluate(() => { document.querySelectorAll('#lamb-list .sexe-opt[data-val="Mort-né"]').forEach(b => b.click()); });
const saves0 = await page.evaluate(() => window.__saves);
await page.click('#btn-save-agnelage');
check(/Choisissez le code Repro/.test(await page.textContent('#err')) && await page.evaluate(() => window.__saves) === saves0, 'fiche : enregistrement bloqué sans réponse');
await page.click('#repro-question .repro-question-btn[data-code="MN"]');
check(await page.evaluate(() => document.querySelector('.repro-code-opt.selected').dataset.val) === 'MN', 'la réponse sélectionne aussi le code dans le sélecteur');
await page.click('#btn-save-agnelage'); await page.waitForTimeout(100);
const ag1 = await page.evaluate(() => { const a = DB.brebis[0].agnelages[0]; return a ? [a.codeRepro, a.date] : (document.getElementById('err') || {}).textContent; });
eq(ag1, ['MN', await page.evaluate(() => J(138))], 'fiche : mise bas enregistrée avec le code choisi');
// entre les deux fenêtres : trois choix ; dans la fenêtre : pas de question
await page.evaluate(() => { currentSheepId = 'b2'; editContext = null; render('add-agnelage', 'b2'); });
await page.fill('#f-date', await page.evaluate(() => J(156))); await page.dispatchEvent('#f-date', 'change');
eq(await page.evaluate(() => [...document.querySelectorAll('#repro-question .repro-question-btn')].map(b => b.dataset.code)), ['IA', 'RE', 'MN'], 'fiche, entre les fenêtres : IA / RE / MN');
await page.fill('#f-date', await page.evaluate(() => J(148))); await page.dispatchEvent('#f-date', 'change');
eq(await page.evaluate(() => [document.getElementById('repro-question').innerHTML, document.querySelector('.repro-code-opt.selected').dataset.val]), ['', 'IA'], 'fiche, dans la fenêtre IA : IA d\'office, pas de question');
console.log('OK 3 fiche brebis : question obligatoire (2 ou 3 choix), enregistrement bloqué sans réponse, code choisi enregistré.');

// ================================================================ 4. saisie rapide mobile et PC
async function saisieRapide(p, n, j, reponse) {
  await p.evaluate(() => { resetMisebasRapideSession(); render('misebas-rapide'); });
  await p.fill('#scan-misebas', String(await p.evaluate(n => E(n).slice(-5), n))); await p.press('#scan-misebas', 'Enter');
  await p.waitForSelector('#f-date-rapide');
  await p.fill('#f-date-rapide', await p.evaluate(j => J(j), j)); await p.dispatchEvent('#f-date-rapide', 'change');
  await p.evaluate(() => { const c = document.querySelector('.mortne-check-rapide'); if (c && !c.checked) c.click(); });
  const avant = await p.evaluate(() => ({ boutons: [...document.querySelectorAll('#repro-question-rapide .repro-question-btn')].map(b => b.dataset.code), choisi: [...document.querySelectorAll('.repro-code-opt-rapide.active, .repro-code-opt-rapide.selected')].length }));
  const n0 = await p.evaluate(n => DB.brebis.find(b => b.id === 'b' + n).agnelages.length, n);
  await p.click('#btn-valider-misebas');
  const bloque = await p.evaluate(([n, n0]) => DB.brebis.find(b => b.id === 'b' + n).agnelages.length === n0 && /Choisissez le code Repro/.test(document.getElementById('err').textContent), [n, n0]);
  if (reponse) { await p.click(`#repro-question-rapide .repro-question-btn[data-code="${reponse}"]`); await p.click('#btn-valider-misebas'); await p.waitForTimeout(100); }
  const code = await p.evaluate(n => { const a = DB.brebis.find(b => b.id === 'b' + n).agnelages.slice(-1)[0]; return a ? a.codeRepro : null; }, n);
  return { avant, bloque, code };
}
eq(await saisieRapide(page, 3, 140, 'IA'), { avant: { boutons: ['IA', 'MN'], choisi: 0 }, bloque: true, code: 'IA' }, 'saisie rapide mobile : question, blocage, réponse IA enregistrée');
const pc = await ouvrir(true);
eq(await saisieRapide(pc, 4, 157, 'RE'), { avant: { boutons: ['IA', 'RE', 'MN'], choisi: 0 }, bloque: true, code: 'RE' }, 'saisie PC : question à 3 choix, blocage, réponse RE enregistrée');
console.log('OK 4 saisie rapide mobile et PC : même question obligatoire, réponse enregistrée.');

// ================================================================ 5. bilan des lots : suit le code fixé à la saisie
const bilan = await page.evaluate(() => {
  const mb = (n, j, code) => { DB.brebis.find(b => b.id === 'b' + n).agnelages = [{ date: J(j), campagne: 2026, codeRepro: code, lambs: [{ sexe: 'Mâle' }] }]; };
  mb(1, 138, 'MN'); mb(2, 156, 'RE'); mb(3, 140, 'IA'); mb(4, 157, 'IA'); mb(5, 148, 'IA'); mb(6, 200, 'RE'); mb(7, 130, 'EP');
  const s = statsLotIA(DB.lots[0]), e = statsLotEponge(DB.lots[1]);
  return { ia: s.ia.misesBas, retour: s.retour.misesBas, effectif: s.effectif, parAge: statsLotIAParAgeExact(DB.lots[0]).reduce((t, g) => t + g.ia.misesBas, 0), ep: e.misesBas };
});
eq(bilan, { ia: 3, retour: 2, effectif: 6, parAge: 3, ep: 1 }, 'bilan : IA = codes IA (140, 157, 148 j), 1er retour = codes RE (156, 200 j), MN hors lot ; éponge : code EP à 130 j compté');
const ancien = await page.evaluate(() => { DB.brebis.find(b => b.id === 'b1').agnelages = [{ date: J(148), campagne: 2026, lambs: [{}] }]; DB.brebis.find(b => b.id === 'b2').agnelages = [{ date: J(138), campagne: 2026, lambs: [{}] }]; const s = statsLotIA(DB.lots[0]); return [s.ia.misesBas, s.retour.misesBas]; });
eq(ancien, [4, 1], 'ancienne mise bas sans code : jugée sur les dates comme avant (148 j = IA, 138 j = hors lot)');
console.log('OK 5 bilan des lots selon le code fixé à la saisie ; anciennes mises bas sans code jugées comme avant.');

await browser.close();
console.log('OK test_repro_question_misebas');
