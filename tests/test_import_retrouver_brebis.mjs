/* Retrouver les brebis à l'import : UNE recherche (retrouverAnimalImport) et UNE carte « Brebis à retrouver »
   (carteRetrouverImportHtml) pour le contrôle laitier SIEOL, la Lactation, le contrôle laitier (modèle Excel) et les Inséminations :
   - ordre : EID / n° national, n° de travail, n° de travail complet (ou son n° de travail déduit), n° d'ordre, n° national sans zéros ;
     un seul animal = retrouvé, plusieurs = à choisir ; la règle de numérotation de l'élevage (808 → 80008) n'est qu'une proposition, à confirmer ;
   - aucune brebis : champ « n° d'ordre, n° de travail ou EID », brebis reconnue en direct, « Associer » (ou Entrée), « Changer » ;
   - rien n'est écrit avant la confirmation ; à la confirmation, le n° du fichier est retenu sur la brebis associée à la main (jamais un n°
     déjà renseigné remplacé, jamais un n° pris par une autre bête) : elle est retrouvée toute seule à l'import suivant.
   Jeu SYNTHÉTIQUE (indicatifs 000456 / 000012), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const prep = () => {
  DB = migrateData({}); window.__saves = 0; saveData = () => { window.__saves++; return true; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456', nom: 'Exploitation exemple', typeSuivi: 'cls', nbControlesSuivi: 4 });
  const mk = (id, eid, court, long) => ({ id, eid, numeroCourtTravailSieol: court, numeroLongTravailSieol: long, statut: 'active', createdAt: 1, echographies: [], sanitaire: [], notes: [], mouvements: [],
    modesRepro: [{ date: '2026-10-20', mode: 'IA', lotId: 'LIA', campagne: 2026 }], agnelages: [{ date: '2026-11-02', campagne: 2026, codeRepro: 'IA', lambs: [] }], controleLaitier: [] });
  DB.brebis = [mk('b1', '250000045620043', '543', '250043'), mk('b2', '250000045620101', '601', '250101'), mk('b3', '250000045620612', '', '250612'),
    mk('b4', '250000045680008', '', ''), mk('b5', '250000001280008', '', ''), mk('b6', '250000045620488', '', ''), mk('b7', '250000045620777', '777', '')];
  DB.beliers = []; DB.agnelles = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} }; DB.lactationModele = [];
  DB.lots = [{ id: 'LIA', type: 'reproduction', nom: 'IA octobre', mode: 'IA', cible: 'Brebis', dateCreation: '2026-10-20', dateEvenement: '2026-10-20', campagneMisesBas: 2026, membres: DB.brebis.map(x => x.eid) }];
};
async function ouvrir() {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1400 } });
  await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date('2027-03-25T09:00:00'));
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  p.on('dialog', d => d.accept());
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(prep);
  return p;
}
const NUMS = ['543', '601', '250612', '808', '488'];
const XM = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const xl = async (p, sheets) => Buffer.from(await p.evaluate(async s => Array.from(await buildXlsxWorkbook(s)), sheets));
const tuiles = (p, zone) => p.evaluate(z => [...document.querySelectorAll('#' + z + ' .retrouver-tuiles .tuile-pc')].map(t => t.querySelector('.brd-kpi-l').textContent + ' ' + t.querySelector('.brd-kpi-v').textContent), zone);
const nums = (p, zone, sel) => p.evaluate(([z, s]) => [...document.querySelectorAll('#' + z + ' ' + s + ' .rt-n')].map(e => e.textContent), [zone, sel]);
// choisit la brebis 000456 80008 pour 808, tape 20488 pour 488 (aperçu en direct, puis Entrée)
async function retrouver(p, zone) {
  eq(await tuiles(p, zone), ['brebis retrouvées 3', 'à choisir 1', 'à retrouver 1'], zone + ' : tuiles avant');
  eq(await nums(p, zone, '.retrouver-carte .rt-ligne'), ['808', '488'], zone + ' : lignes à retrouver');
  const q = await p.textContent('#' + zone + ' .rt-ligne[data-cle] .rt-q');
  check(/808 n'est noté sur aucune fiche/.test(q) && /80008/.test(q), zone + ' : proposition par la numérotation de l\'élevage : ' + q);
  const choix = await p.$$eval('#' + zone + ' .rt-choisir', bs => bs.map(b => b.textContent));
  eq(choix, ['n°80008 · FR 000456 80008', 'n°80008 · FR 000012 80008 · achetée'], zone + ' : brebis à choisir');
  await p.click('#' + zone + ' .rt-choisir >> nth=0'); await p.waitForTimeout(150);
  const champ = '#' + zone + ' .retrouver-carte .rt-champ';
  await p.fill(champ, '99999'); await p.waitForTimeout(80);
  check(/Aucune brebis ne porte ce n°/.test(await p.textContent('#' + zone + ' .retrouver-carte .rt-apercu')), zone + ' : n° inconnu signalé');
  await p.fill(champ, '20101'); await p.waitForTimeout(80);
  check(/déjà sur une autre ligne/.test(await p.textContent('#' + zone + ' .retrouver-carte .rt-apercu')), zone + ' : brebis déjà prise par une autre ligne');
  await p.press(champ, 'Enter'); await p.waitForTimeout(150);
  eq(await nums(p, zone, '.retrouver-carte .rt-ligne'), ['488'], zone + ' : une brebis déjà prise ne s\'associe pas');
  await p.fill(champ, '20488'); await p.waitForTimeout(80);
  check(/n°20488/.test(await p.textContent('#' + zone + ' .retrouver-carte .rt-apercu')), zone + ' : brebis reconnue en direct');
  await p.press(champ, 'Enter'); await p.waitForTimeout(200);
  eq(await tuiles(p, zone), ['brebis retrouvées 5', 'à choisir 0', 'à retrouver 0'], zone + ' : tuiles après');
  check(!(await p.$('#' + zone + ' .retrouver-carte')), zone + ' : plus rien à retrouver');
  eq(await nums(p, zone, '.retrouver-associees .rt-ligne'), ['808', '488'], zone + ' : associées à la main');
  check(/n° 808 retenu pour les prochains imports/.test(await p.textContent('#' + zone + ' .retrouver-associees')), zone + ' : n° retenu annoncé');
  // Changer puis re-choisir
  await p.click('#' + zone + ' .rt-changer >> nth=0'); await p.waitForTimeout(150);
  eq(await nums(p, zone, '.retrouver-carte .rt-ligne'), ['808'], zone + ' : Changer remet la ligne à choisir');
  await p.click('#' + zone + ' .rt-choisir >> nth=0'); await p.waitForTimeout(150);
  eq(await p.evaluate(() => window.__saves), 0, zone + ' : rien d\'écrit avant la confirmation');
}
const numerosFiches = p => p.evaluate(() => DB.brebis.map(b => [b.eid.slice(-5) + (b.eid.slice(4, 10) === '000012' ? 'a' : ''), b.numeroCourtTravailSieol || '', b.numeroLongTravailSieol || '']));
const APRES = [['20043', '543', '250043'], ['20101', '601', '250101'], ['20612', '', '250612'], ['80008', '808', '180008'], ['80008a', '', ''], ['20488', '488', ''], ['20777', '777', '']];

// 1. Règles pures
{
  const p = await ouvrir();
  const r = await p.evaluate(() => {
    const f = (v, o) => { const x = retrouverAnimalImport(v, DB.brebis, o); return x.type + (x.par ? ':' + x.par : '') + (x.animal ? ':' + x.animal.id : '') + (x.candidats ? ':' + x.candidats.map(a => a.id).join('+') : ''); };
    return {
      travail: f('543'), zeros: f('0543'), complet: f('250043'), completDeduit: f('170077'), ordre: f('20612'), eid15: f('250000045620101'), national: f('000456 20101'), fr: f('FR 000012 80008'),
      sansZeros: f('45620101'), deduit: f('808'), deduitAucune: f('808', { deduire: false }), aucune: f('488'), vide: f('  '), texte: f('abc'),
      lpts: f('55109')
    };
  });
  eq(r.travail, 'direct:travail:b1', 'n° de travail'); eq(r.zeros, 'direct:travail:b1', 'zéros de tête ignorés');
  eq(r.complet, 'direct:complet:b1', 'n° de travail complet'); eq(r.completDeduit, 'direct:complet:b7', 'n° de travail complet → n° de travail déduit');
  eq(r.ordre, 'direct:ordre:b3', 'n° d\'ordre'); eq(r.eid15, 'direct:eid:b2', 'EID'); eq(r.national, 'direct:eid:b2', 'n° national avec espace');
  eq(r.fr, 'direct:eid:b5', 'n° officiel « FR »'); eq(r.sansZeros, 'direct:eid:b2', 'n° national sans zéros de tête');
  eq(r.deduit, 'choix:deduit:b4+b5', 'numérotation de l\'élevage : à choisir, jamais d\'office'); eq(r.deduitAucune, 'aucune', 'champ manuel : sans déduction');
  eq(r.aucune, 'aucune', 'n° inconnu'); eq(r.vide, 'vide', 'vide'); eq(r.texte, 'aucune', 'texte');
  eq(r.lpts, 'aucune', '55109 : 51109 inconnue');
  const unique = await p.evaluate(() => { const x = retrouverAnimalImport('808', DB.brebis.filter(b => b.id !== 'b5')); return x.type + ':' + x.candidats.length; });
  eq(unique, 'choix:1', 'une seule brebis proposée par la numérotation : toujours à confirmer');
  const ret = await p.evaluate(() => {
    const B = id => DB.brebis.find(b => b.id === id), out = {};
    out.ordre = retenirNumeroImport(B('b3'), '20612', DB.brebis, true);
    out.eid = retenirNumeroImport(B('b3'), '250000045620612', DB.brebis, true);
    out.deja = retenirNumeroImport(B('b1'), '543', DB.brebis, true);
    out.different = retenirNumeroImport(B('b1'), '544', DB.brebis, true);
    out.pris = retenirNumeroImport(B('b6'), '601', DB.brebis, true);
    out.lecture = retenirNumeroImport(B('b6'), '488', DB.brebis, false);
    out.apresLecture = B('b6').numeroCourtTravailSieol;
    out.retenu = retenirNumeroImport(B('b4'), '808', DB.brebis, true);
    out.b4 = [B('b4').numeroCourtTravailSieol, B('b4').numeroLongTravailSieol];
    out.complet = retenirNumeroImport(B('b6'), '220488', DB.brebis, true);
    out.b6 = [B('b6').numeroCourtTravailSieol, B('b6').numeroLongTravailSieol];
    out.b1 = [B('b1').numeroCourtTravailSieol, B('b1').numeroLongTravailSieol];
    out.b3 = [B('b3').numeroCourtTravailSieol, B('b3').numeroLongTravailSieol];
    return out;
  });
  eq([ret.ordre, ret.eid, ret.deja, ret.different, ret.pris, ret.lecture, ret.apresLecture], [null, null, 'deja', 'different', 'pris', 'retenu', ''], 'retenir le n° : cas');
  eq([ret.retenu, ret.b4], ['retenu', ['808', '180008']], 'n° de travail retenu, n° complet déduit');
  eq([ret.complet, ret.b6], ['retenu', ['2488', '220488']], 'n° de travail complet retenu, n° de travail déduit');
  eq(ret.b1, ['543', '250043'], 'jamais un n° déjà renseigné remplacé'); eq(ret.b3, ['', '250612'], 'n° d\'ordre / EID : rien à retenir');
  await p.context().close();
}

// 2. Contrôle laitier SIEOL : carte, confirmation, n° retenus, puis réimport retrouvé tout seul
{
  const p = await ouvrir();
  const cahier = 'numero_visuel_sieol;num_lactation;ctl1_ml;ctl1_anomalie\n' + NUMS.map((n, i) => n + ';2;' + (1400 + i * 10) + ';').join('\n') + '\n';
  const resume = 'num_controle;date_controle;lait_total;nb_brebis\n1;20/01/2027;1500;10\n';
  const charger = async () => {
    await p.evaluate(() => render('import-controle-laitier-sieol')); await p.waitForTimeout(150);
    await p.setInputFiles('#import-cl-resume-file', { name: 'resume.csv', mimeType: 'text/csv', buffer: Buffer.from(resume) }); await p.waitForTimeout(200);
    await p.setInputFiles('#import-cl-cahier-file', { name: 'cahier.csv', mimeType: 'text/csv', buffer: Buffer.from(cahier) }); await p.waitForTimeout(300);
  };
  await charger();
  await retrouver(p, 'import-cl-preview');
  await p.click('#btn-confirm-import-cl'); await p.waitForTimeout(300);
  eq(await numerosFiches(p), APRES, 'SIEOL : n° retenus');
  eq(await p.evaluate(() => DB.brebis.map(b => (b.controleLaitier || []).length)), [1, 1, 1, 1, 0, 1, 0], 'SIEOL : contrôles écrits sur les brebis retrouvées');
  await charger();
  eq(await tuiles(p, 'import-cl-preview'), ['brebis retrouvées 5', 'à choisir 0', 'à retrouver 0'], 'SIEOL : réimport retrouvé tout seul');
  check(!(await p.$('#import-cl-preview .retrouver-carte')), 'SIEOL : rien à retrouver au réimport');
  check(!(await p.$('#import-cl-preview .stat-card')), 'SIEOL : plus d\'anciennes tuiles');
  await p.context().close();
}

// 3. Lactation (modèle Excel)
{
  const p = await ouvrir();
  await p.evaluate(() => render('import-lactation-modele')); await p.waitForTimeout(150);
  await p.setInputFiles('#import-lact-modele-file', { name: 'lact.xlsx', mimeType: XM, buffer: await xl(p, [{ name: 'Lactation', rows: [['Lactation'], [], [], ['N° de travail', 'Lait total', 'Jours', 'Moyenne', 'Indice', 'Classe'], ...NUMS.map((n, i) => [n, 300 + i * 10, 200, 1.5, 2, '3'])] }]) });
  await p.waitForTimeout(400);
  await retrouver(p, 'import-lact-modele-preview');
  check(/5 à enregistrer/.test(await p.textContent('#import-lact-modele-preview')), 'Lactation : 5 à enregistrer');
  await p.click('#btn-confirm-import-lact-modele'); await p.waitForTimeout(300);
  eq(await p.evaluate(() => DB.lactationModele.map(l => l.eid.slice(-5) + ':' + l.lactationTotale).sort()), ['20043:300', '20101:310', '20488:340', '20612:320', '80008:330'], 'Lactation : écrite sur les brebis retrouvées');
  eq(await p.evaluate(() => DB.lactationModele.find(l => l.eid.endsWith('80008')).eid.slice(4, 10)), '000456', 'Lactation : la brebis choisie, pas l\'autre 80008');
  eq(await numerosFiches(p), APRES, 'Lactation : n° retenus');
  await p.context().close();
}

// 4. Contrôle laitier (modèle Excel Ovilog)
{
  const p = await ouvrir();
  await p.evaluate(() => render('import-controle-laitier-modele')); await p.waitForTimeout(150);
  await p.setInputFiles('#import-cl-modele-file', { name: 'cl.xlsx', mimeType: XM, buffer: await xl(p, [{ name: 'Contrôle laitier', rows: [['Contrôle laitier'], [], [], ['', '', '05-12-2026'], ['EID', 'N° de travail', 'Contrôle 1 (mL[/code])'], ...NUMS.map(n => ['', n, '1400'])] }]) });
  await p.waitForTimeout(400);
  await retrouver(p, 'import-cl-modele-preview');
  await p.click('#btn-confirm-import-cl-modele'); await p.waitForTimeout(300);
  eq(await p.evaluate(() => DB.brebis.map(b => (b.controleLaitier || []).length)), [1, 1, 1, 1, 0, 1, 0], 'Modèle : contrôles écrits sur les brebis retrouvées');
  eq(await numerosFiches(p), APRES, 'Modèle : n° retenus');
  await p.context().close();
}

// 5. Inséminations
{
  const p = await ouvrir();
  await p.evaluate(() => render('import-inseminations')); await p.waitForTimeout(150);
  await p.selectOption('#import-ia-lot', 'LIA');
  await p.setInputFiles('#import-ia-file', { name: 'ia.xlsx', mimeType: XM, buffer: await xl(p, [{ name: 'Béliers', rows: [['Code IA', 'N° officiel', 'ISOL'], ['641', 'FR00001200101', '112']] }, { name: 'Brebis inséminées', rows: [['N° brebis', 'Code IA'], ...NUMS.map(n => [n, '641'])] }]) });
  await p.waitForSelector('#import-ia-table');
  eq(await p.$$eval('#import-ia-table tbody tr', trs => trs.map(t => t.dataset.etat)), ['relie', 'relie', 'relie', 'aChoisir', 'aRetrouver'], 'IA : états avant');
  await retrouver(p, 'import-ia-preview');
  eq(await p.$$eval('#import-ia-table tbody tr', trs => trs.map(t => t.dataset.etat)), ['relie', 'relie', 'relie', 'relie', 'relie'], 'IA : états après');
  check(/5 brebis reliées à un père · 1 bélier utilisé/.test(await p.textContent('#import-ia-resume')), 'IA : résumé');
  await p.click('#btn-confirm-import-ia'); await p.waitForTimeout(300);
  eq(await p.evaluate(() => DB.brebis.map(b => b.modesRepro[0].ia ? b.modesRepro[0].ia.pereCourt : '')), ['641', '641', '641', '641', '', '641', ''], 'IA : pères posés sur les brebis retrouvées');
  eq(await numerosFiches(p), APRES, 'IA : n° retenus');
  await p.context().close();
}

await browser.close();
console.log('OK test_import_retrouver_brebis');
