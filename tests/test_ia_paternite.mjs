/* Paternité d'une IA (centre d'insémination) : bloc `ia` rangé sur l'évènement modesRepro de la brebis / de l'agnelle (orientation lait / viande, paternité connue / inconnue,
   n° officiel et code court du père, index ISOL en lait, index viande en texte libre). Couvre la normalisation commune (saisie et import), l'écran de saisie (mobile et PC), la carte
   de la fiche brebis et de la fiche agnelle, l'échappement HTML et le respect des numéros existants. Jeu synthétique, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const tri = v => Array.isArray(v) ? v.map(tri) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, tri(v[k])])) : v;   // ordre des clés sans importance
const eq = (a, b, msg) => check(JSON.stringify(tri(a)) === JSON.stringify(tri(b)), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

async function ouvrir(desktop) {
  const ctx = await browser.newContext({ viewport: desktop ? { width: 1500, height: 1200 } : { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
  if (desktop) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; return true; };
    const fiche = (n, o) => Object.assign({ id: 'f' + n, eid: '250000012' + '9' + 3 + String(n).padStart(5, '0'), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    DB.lots = [{ id: 'lot1', type: 'reproduction', mode: 'IA', cible: 'Brebis', nom: 'IA octobre', dateEvenement: '2026-10-01', dateCreation: '2026-10-01', campagneMisesBas: 2027, membres: [] }];
    const evt = { date: '2026-10-01', mode: 'IA', campagne: 2027, codeSieol: 1, lotId: 'lot1' };
    DB.brebis = [fiche(101, { modesRepro: [Object.assign({}, evt)] }), fiche(102), fiche(103, { modesRepro: [Object.assign({}, evt)] })];
    DB.agnelles = [{ id: 'ag1', eid: '250000012' + '9' + 3 + '00201', origine: 'née', dateEntree: '2026-01-10', sanitaire: [], mouvements: [], statut: 'active', modesRepro: [Object.assign({}, evt)] }];
    DB.beliers = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  });
  return page;
}

// ================================================================ 1. la normalisation commune
{
  const page = await ouvrir(false);
  const r = await page.evaluate(() => {
    const n = c => normaliserPaterniteIa(c);
    return {
      sans: n({}), sansPat: n({ orientation: 'lait' }), connueSansNum: n({ orientation: 'lait', paternite: 'connue' }),
      lait: n({ orientation: 'lait', paternite: 'connue', pereNumero: '000123 45678', pereCourt: '45678', pereNom: ' Rex ', indexIsol: '112,5', indexViande: 'ignoré', centre: ' Centre A ', source: 'import' }),
      viande: n({ orientation: 'viande', paternite: 'connue', pereCourt: '4567', indexViande: 'prolif 3 · bouch. 2', indexIsol: '99' }),
      inconnue: n({ orientation: 'viande', paternite: 'inconnue', pereNumero: '12345', pereNom: 'X', indexIsol: '10', indexViande: 'x' }),
      lettres: n({ orientation: 'lait', paternite: 'connue', pereNumero: 'AB123' }),
      isolMauvais: n({ orientation: 'lait', paternite: 'connue', pereCourt: '45678', indexIsol: 'beaucoup' }),
      long: n({ orientation: 'lait', paternite: 'connue', pereCourt: '4567812' }),
      texte: { lait: paterniteIaPereTexte(n({ orientation: 'lait', paternite: 'connue', pereNumero: '00012345678', pereNom: 'Rex' }).ia), court: paterniteIaPereTexte(n({ orientation: 'lait', paternite: 'connue', pereCourt: '45678' }).ia), inconnue: paterniteIaPereTexte(n({ orientation: 'lait', paternite: 'inconnue' }).ia) },
      idx: { lait: paterniteIaIndexTexte(n({ orientation: 'lait', paternite: 'connue', pereCourt: '1', indexIsol: '0,84' }).ia), viande: paterniteIaIndexTexte(n({ orientation: 'viande', paternite: 'connue', pereCourt: '1', indexViande: 'bouch. 2' }).ia), aucun: paterniteIaIndexTexte(n({ orientation: 'lait', paternite: 'connue', pereCourt: '1' }).ia) }
    };
  });
  check(r.sans.erreur && /orientation/i.test(r.sans.erreur), 'orientation obligatoire');
  check(r.sansPat.erreur && /paternité/i.test(r.sansPat.erreur), 'paternité obligatoire');
  check(r.connueSansNum.erreur && /n° officiel/.test(r.connueSansNum.erreur), 'paternité connue sans numéro : refusée');
  eq(r.lait.ia, { orientation: 'lait', paternite: 'connue', centre: 'Centre A', source: 'import', pereNumero: '00012345678', pereCourt: '45678', pereNom: 'Rex', indexIsol: 112.5 }, 'lait connue : n° nettoyés, ISOL en nombre, index viande écarté');
  eq(r.viande.ia, { orientation: 'viande', paternite: 'connue', pereCourt: '4567', indexViande: 'prolif 3 · bouch. 2' }, 'viande connue : code court de 4 chiffres accepté (jamais limité à 5), ISOL écarté');
  eq(r.inconnue.ia, { orientation: 'viande', paternite: 'inconnue' }, 'paternité inconnue : ni père ni index');
  check(r.lettres.erreur && /chiffres/.test(r.lettres.erreur), 'n° du père : chiffres seulement');
  check(r.isolMauvais.erreur && /ISOL/.test(r.isolMauvais.erreur), 'index ISOL non numérique refusé');
  eq(r.long.ia.pereCourt, '4567812', 'code court de 7 chiffres accepté (pas bloqué à 5)');
  eq(r.texte, { lait: 'Rex · 000123 45678', court: '45678', inconnue: null }, 'texte du père');
  eq(r.idx, { lait: 'ISOL 0,84', viande: 'bouch. 2', aucun: null }, 'texte des index');
  console.log('OK 1 normalisation commune (saisie et import).');
  await page.close();
}

// ================================================================ 2. écran de saisie et carte de fiche, mobile puis PC
for (const desktop of [false, true]) {
  const nom = desktop ? 'PC' : 'MOBILE';
  const page = await ouvrir(desktop);
  const aller = async (id, kind) => { await page.evaluate(([i, k]) => { if (k === 'agnelle') { currentAgnelleId = i; render('agnelle-detail'); } else { ficheBrebisTab = 'repro'; ficheBrebisTabSheepId = i; render('detail', i); } }, [id, kind]); await page.waitForTimeout(150); };

  // brebis sans IA : pas de carte
  await aller('f102', 'brebis');
  check(await page.locator('#carte-paternite-ia').count() === 0, nom + ' : aucune carte sans IA / éponge');

  // brebis avec IA, père pas encore renseigné
  await aller('f101', 'brebis');
  check(await page.locator('#carte-paternite-ia').count() === 1, nom + ' : carte présente avec une IA');
  check(/pas encore renseignés/.test(await page.locator('#carte-paternite-ia').innerText()), nom + ' : père et index pas encore renseignés');
  await page.click('#btn-edit-paternite-ia');
  await page.waitForTimeout(150);
  check(await page.locator('#btn-save-paternite-ia').count() === 1, nom + ' : écran de saisie ouvert');
  check(await page.locator('#pia-pere').isHidden(), nom + ' : champs du père cachés tant que la paternité n\'est pas connue');

  // enregistrer sans rien choisir : message, rien d'écrit
  await page.click('#btn-save-paternite-ia');
  check(/orientation/i.test(await page.locator('#err').innerText()), nom + ' : message sans orientation');
  check((await page.evaluate(() => DB.brebis[0].modesRepro[0].ia)) === undefined, nom + ' : rien d\'écrit sur une erreur');

  // lait, connue, avec un nom piégé
  await page.click('#pia-orientation [data-val="lait"]');
  await page.click('#pia-paternite [data-val="connue"]');
  check(await page.locator('#pia-pere').isVisible() && await page.locator('#pia-bloc-isol').isVisible() && await page.locator('#pia-bloc-viande').isHidden(), nom + ' : lait = index ISOL, pas d\'index viande');
  await page.fill('#pia-numero', '000123 45678');
  await page.fill('#pia-court', '45678');
  await page.fill('#pia-nom', '<img src=x onerror="window.__pwn=1">');
  await page.fill('#pia-isol', '112,5');
  const savesAvant = await page.evaluate(() => window.__saves);
  await page.click('#btn-save-paternite-ia');
  await page.waitForTimeout(200);
  const ia = await page.evaluate(() => DB.brebis[0].modesRepro[0].ia);
  eq(ia, { orientation: 'lait', paternite: 'connue', source: 'saisie', pereNumero: '00012345678', pereCourt: '45678', pereNom: '<img src=x onerror="window.__pwn=1">', indexIsol: 112.5 }, nom + ' : bloc ia enregistré sur l\'évènement');
  check(await page.evaluate(() => window.__saves) === savesAvant + 1, nom + ' : un seul enregistrement');
  check(await page.locator('#btn-edit-paternite-ia').count() === 1, nom + ' : retour sur la fiche');
  const carte = await page.locator('#carte-paternite-ia').innerText();
  check(/Lait/.test(carte) && /paternité connue/.test(carte) && /000123 45678/.test(carte) && /ISOL 112,5/.test(carte), nom + ' : carte renseignée : ' + carte);
  check(await page.evaluate(() => window.__pwn) === undefined && await page.locator('#carte-paternite-ia img').count() === 0, nom + ' : nom du père échappé (aucun HTML injecté)');
  check(/Modifier/.test(await page.locator('#btn-edit-paternite-ia').innerText()), nom + ' : bouton Modifier une fois renseignée');

  // rouvrir : valeurs reprises, puis passer en viande + inconnue
  await page.click('#btn-edit-paternite-ia');
  await page.waitForTimeout(150);
  eq(await page.inputValue('#pia-numero'), '00012345678', nom + ' : n° repris');
  eq(await page.inputValue('#pia-nom'), '<img src=x onerror="window.__pwn=1">', nom + ' : nom repris tel quel (aller-retour)');
  await page.click('#pia-orientation [data-val="viande"]');
  await page.click('#pia-paternite [data-val="inconnue"]');
  await page.click('#btn-save-paternite-ia');
  await page.waitForTimeout(200);
  eq(await page.evaluate(() => DB.brebis[0].modesRepro[0].ia), { orientation: 'viande', paternite: 'inconnue', source: 'saisie' }, nom + ' : viande + inconnue = ni père ni index');

  // Annuler : rien ne change
  await page.click('#btn-edit-paternite-ia');
  await page.waitForTimeout(150);
  await page.click('#pia-orientation [data-val="lait"]');
  await page.click('#btn-annuler-paternite-ia');
  await page.waitForTimeout(150);
  eq(await page.evaluate(() => DB.brebis[0].modesRepro[0].ia.orientation), 'viande', nom + ' : Annuler ne change rien');

  // numéros existants jamais touchés
  eq(await page.evaluate(() => DB.brebis.map(b => b.eid)), ['25000001293' + '00101', '25000001293' + '00102', '25000001293' + '00103'], nom + ' : EID inchangés');

  // erreur de saisie : numéro avec des lettres
  await page.click('#btn-edit-paternite-ia');
  await page.waitForTimeout(150);
  await page.click('#pia-paternite [data-val="connue"]');
  await page.fill('#pia-court', 'AB1');
  await page.click('#btn-save-paternite-ia');
  check(/chiffres/.test(await page.locator('#err').innerText()), nom + ' : lettres refusées dans le n° du père');

  // agnelle : même carte, même écran
  await aller('ag1', 'agnelle');
  check(await page.locator('#carte-paternite-ia').count() === 1, nom + ' : carte sur la fiche agnelle');
  await page.click('#btn-edit-paternite-ia');
  await page.waitForTimeout(150);
  await page.click('#pia-orientation [data-val="lait"]');
  await page.click('#pia-paternite [data-val="connue"]');
  await page.fill('#pia-court', '90001');
  await page.click('#btn-save-paternite-ia');
  await page.waitForTimeout(200);
  eq(await page.evaluate(() => DB.agnelles[0].modesRepro[0].ia), { orientation: 'lait', paternite: 'connue', source: 'saisie', pereCourt: '90001' }, nom + ' : IA d\'agnelle (paternité connue même pour une agnelle)');
  check(/90001/.test(await page.locator('#carte-paternite-ia').innerText()), nom + ' : carte agnelle renseignée');
  console.log('OK 2 ' + nom + ' : écran de saisie et carte de fiche (brebis, agnelle, échappement, annulation).');
  await page.close();
}

// ================================================================ 3. import de la liste de l'inséminateur (PC)
{
  const page = await ouvrir(true);
  await page.evaluate(() => {
    const eid = n => '2500000121' + String(n).padStart(5, '0');
    const fiche = (n, o) => Object.assign({ id: 'g' + n, eid: eid(n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
    const evt = (o) => Object.assign({ date: '2026-10-01', mode: 'IA', campagne: 2027, codeSieol: 1, lotId: 'lot1' }, o || {});
    DB.brebis = [fiche(101, { modesRepro: [evt()] }), fiche(102, { modesRepro: [evt()] }), fiche(103), fiche(104, { modesRepro: [evt({ ia: { orientation: 'lait', paternite: 'connue', pereCourt: '11111', source: 'saisie' } })] }),
      fiche(105, { modesRepro: [evt({ ia: { orientation: 'viande', paternite: 'inconnue', source: 'saisie' } })] }), fiche(106, { modesRepro: [evt()] }), fiche(107, { modesRepro: [evt()] }), fiche(108, { modesRepro: [evt()] })];
    DB.agnelles = []; DB.beliers = [];
    parametresTab = 'imports'; render('parametres');
  });
  const EIDS_AVANT = await page.evaluate(() => DB.brebis.map(b => b.eid));
  // ---- la carte et le modèle téléchargeable
  await page.waitForSelector('#import-inseminations');
  const dl = page.waitForEvent('download', { timeout: 10000 });
  await page.click('#import-inseminations .btn-modele-import');
  const d = await dl;
  eq(d.suggestedFilename(), 'Modele_Inseminations.xlsx', 'nom du modèle téléchargé');
  await page.evaluate(() => render('import-inseminations'));
  await page.waitForSelector('#import-ia-file');

  const entete = 'N° brebis;Date IA;Orientation;Paternité;N° officiel du père;Code court du père;Nom du père;Index ISOL;Index viande;Centre';
  const lignes = [
    '00012100101;01/10/2026;Lait;Connue;00099900001;12345;Bélier <b>A</b>;112,5;;Centre A',      // 101 : à importer (nom piégé)
    '12100102;;Viande;Inconnue;;;;;;',                                                          // 102 : zéros de tête perdus par Excel, sans date, paternité inconnue
    '00012100103;01/10/2026;Lait;Connue;00099900002;22222;;;;',                                  // 103 : aucune IA en lot
    '99999999999;01/10/2026;Lait;Connue;;33333;;;;',                                             // introuvable
    '00012100104;01/10/2026;Viande;Connue;;44444;;;prolif 3;',                                   // 104 : déjà renseignée autrement
    '00012100105;01/10/2026;Viande;Inconnue;;;;;;',                                              // 105 : identique
    '00012100101;01/10/2026;Lait;Connue;;55555;;;;',                                             // doublon dans le fichier
    '00012100106;01/10/2026;Chevre;Connue;;66666;;;;',                                           // orientation illisible
    '00012100107;15/10/2026;Lait;Connue;;77777;;;;',                                             // date à plus de 3 jours de l\'IA
    '00012100108;01/10/2026;Lait;Connue;;;;;;'                                                   // connue sans numéro
  ];
  const csv = [entete, ...lignes].join('\n');
  await page.setInputFiles('#import-ia-file', { name: 'ia.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') });
  await page.waitForSelector('#import-ia-preview .pc-kpis');
  const kpis = await page.evaluate(() => [...document.querySelectorAll('#import-ia-preview .pc-kpis .brd-kpi')].map(k => k.querySelector('.brd-kpi-l').textContent + '=' + k.querySelector('.brd-kpi-v').textContent));
  eq(kpis, ['IA à renseigner=2', 'Déjà à jour=1', 'Déjà renseignées autrement=1', 'Lignes laissées de côté=6'], 'aperçu : tuiles');
  const txt = await page.locator('#import-ia-preview').innerText();
  check(/Sans IA dans un lot \(2\)/.test(txt) && /Brebis introuvables \(1\)/.test(txt) && /Lignes invalides \(3\)/.test(txt), 'aperçu : rubriques des lignes laissées de côté : ' + txt.slice(0, 600));
  check(/déjà plus haut dans le fichier/.test(txt) && /orientation « Chevre » non reconnue/.test(txt) && /n° officiel du père ou son code court/.test(txt), 'aperçu : motifs des lignes invalides');
  check(await page.locator('#import-ia-preview img').count() === 0 && !/Bélier <b>/.test(await page.locator('#import-ia-preview').innerHTML()), 'aperçu : texte du fichier échappé');
  eq(await page.evaluate(() => DB.brebis[0].modesRepro[0].ia), undefined, 'rien d\'écrit avant la confirmation');

  // ---- orientation par défaut : un fichier sans colonne Orientation
  // ---- remplacer les IA déjà renseignées
  await page.check('#import-ia-remplacer');
  const kpis2 = await page.evaluate(() => [...document.querySelectorAll('#import-ia-preview .pc-kpis .brd-kpi-v')].map(k => k.textContent));
  eq(kpis2, ['3', '1', '0', '6'], 'case Remplacer : la ligne en conflit devient à importer');
  await page.uncheck('#import-ia-remplacer');

  // ---- confirmation
  const saves = await page.evaluate(() => window.__saves);
  await page.click('#btn-confirm-import-ia');
  await page.waitForTimeout(200);
  const ia = await page.evaluate(() => DB.brebis.map(b => b.modesRepro[0] && b.modesRepro[0].ia));
  eq(ia[0], { orientation: 'lait', paternite: 'connue', source: 'import', centre: 'Centre A', pereNumero: '00099900001', pereCourt: '12345', pereNom: 'Bélier <b>A</b>', indexIsol: 112.5 }, '101 : IA renseignée par l\'import');
  eq(ia[1], { orientation: 'viande', paternite: 'inconnue', source: 'import' }, '102 : retrouvée malgré les zéros de tête perdus, paternité inconnue');
  eq(ia[2], undefined, '103 : pas de lot, rien créé');
  eq(ia[3], { orientation: 'lait', paternite: 'connue', pereCourt: '11111', source: 'saisie' }, '104 : IA déjà renseignée autrement, intacte');
  eq(ia[4], { orientation: 'viande', paternite: 'inconnue', source: 'saisie' }, '105 : identique, intacte (source d\'origine gardée)');
  eq([ia[5], ia[6], ia[7]], [undefined, undefined, undefined], '106 / 107 / 108 : lignes invalides ou hors fenêtre, rien d\'écrit');
  check(await page.evaluate(() => window.__saves) === saves + 1, 'un seul enregistrement pour tout l\'import');
  eq(await page.evaluate(() => DB.brebis.map(b => b.eid)), EIDS_AVANT, 'aucun EID modifié');
  eq(await page.evaluate(() => DB.brebis.length), 8, 'aucune fiche créée');
  check(/2 IA renseignées · 7 lignes laissées de côté/.test(await page.locator('#import-ia-message').innerText()), 'message de fin : ' + await page.locator('#import-ia-message').innerText());
  check(await page.locator('#btn-confirm-import-ia').isHidden(), 'rien à reconfirmer après l\'import');
  check(/2 lignes/.test(await page.evaluate(() => texteDernierImport('inseminations'))), 'dernier import mémorisé : ' + await page.evaluate(() => texteDernierImport('inseminations')));

  // ---- fichier Excel : titres cherchés sous des lignes de titre, colonnes dans un autre ordre, sans colonne Orientation (choisie à l'écran)
  await page.evaluate(() => { DB.brebis[2].modesRepro = [{ date: '2026-10-01', mode: 'IA', campagne: 2027, codeSieol: 1, lotId: 'lot1' }]; render('import-inseminations'); });
  await page.waitForSelector('#import-ia-file');
  const xlsx = await page.evaluate(async () => Array.from(await buildXlsxWorkbook([{ name: 'Inséminations', rows: [['Liste des IA du 01/10/2026'], [], ['Centre d\'insémination', 'Bélier', 'Brebis', 'ISOL'], ['Centre B', 'Bélier B', '00012100103', '0,84'], ['Centre B', '00088800001', '00012100103', '1']] }])));
  await page.setInputFiles('#import-ia-file', { name: 'ia.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(xlsx) });
  await page.waitForSelector('#import-ia-preview .pc-kpis');
  check(/orientation absente/.test(await page.locator('#import-ia-preview').innerText()), 'sans colonne Orientation et sans choix : lignes refusées avec le motif');
  await page.click('#import-ia-orientation [data-val="lait"]');
  const kp = await page.evaluate(() => [...document.querySelectorAll('#import-ia-preview .pc-kpis .brd-kpi-v')].map(k => k.textContent));
  eq(kp, ['1', '0', '0', '1'], 'orientation choisie : la 2e ligne est lue, la 1re (père donné par son nom seul) est refusée');
  await page.click('#btn-confirm-import-ia');
  await page.waitForTimeout(200);
  eq(await page.evaluate(() => DB.brebis[2].modesRepro[0].ia), { orientation: 'lait', paternite: 'connue', source: 'import', centre: 'Centre B', pereNumero: '00088800001', indexIsol: 1 }, 'xlsx : titres sous un bandeau, colonnes dans un autre ordre, n° de père dans la colonne « Bélier »');
  console.log('OK 3 import des inséminations (csv et xlsx, aperçu, remplacement, doublons, EID intacts).');
  await page.close();
}

await browser.close();
console.log('OK test_ia_paternite');
