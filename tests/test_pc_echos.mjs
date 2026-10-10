/* Lots échographies, partie 3 : onglet PC « Échographies » (premier onglet, défaut pour les lots de recherche et de réforme ; Mises bas reste le défaut de la reproduction).
   Critères communs (type Toutes / Constat / Stades, campagne en cours / à venir, dates, stades, nombre d'agneaux, cas particuliers dynamiques, « ou » / « et »),
   « Vide » + comptage (aide, rien d'effacé ni grisé), colonnes, ligne d'information, saisie RÉELLE au clavier (dates, n°), sélection conservée entre onglets, affectation
   depuis 2 onglets, brebis déjà dans le lot signalées, filtres rapides inchangés. saveData REMPLACÉ par un compteur ; jeu synthétique ; export réel en LECTURE SEULE. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, EXPORT_ORIGINAL, exportPresent, lireExport } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 1700, height: 2000 }, locale: 'en-US' })).newPage();
await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
let reponse = true; const confirms = [];
page.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponse ? d.accept() : d.dismiss(); } else d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

const jeu = () => page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  window.E = (d, n) => '2500162991' + d + String(n).padStart(4, '0');
  const e = (date, extra) => Object.assign({ type: 'stade', date, stade: null, agneaux: null, nombreAgneaux: null, special: null, parasitisme: false, campagne: 2026 }, extra);
  const b = (d, n, echos, extra) => Object.assign({ id: 'b' + d + n, eid: E(d, n), statut: 'active', createdAt: 1, echographies: echos, agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, extra || {});
  DB.brebis = [
    b(8, 1, [e('2026-09-01', { type: 'constat', stade: 'Pleine' })]),                                  // 80001 gestante (constat)
    b(8, 2, [e('2026-09-01', { type: 'constat', stade: 'Vide' })]),                                    // 80002 vide (constat)
    b(8, 3, [e('2026-09-01', { stade: 'Milieu', agneaux: 'Double' })]),                                // 80003
    b(9, 4, [e('2026-09-01', { stade: 'Fin', nombreAgneaux: 3 })]),                                    // 90004 (Double)
    b(9, 5, [e('2026-09-01', { stade: 'Début', nombreAgneaux: 1 })]),                                  // 90005 (Simple)
    b(9, 6, [e('2026-08-01', { stade: 'Vide' }), e('2026-09-01', { stade: 'Milieu', agneaux: 'Simple' })], {}),   // 90006 : la dernière écho (Milieu Simple) fait foi
    b(0, 7, []),                                                                                       // 00007 sans écho
    b(0, 8, [e('2026-10-02', { stade: 'Milieu', agneaux: 'Double', campagne: 2027 })]),                // 00008 écho « à venir »
    b(0, 9, [e('2026-09-03', { special: 'Avortée', parasitisme: true })]),                             // 00009
    b(0, 10, [e('2026-09-03', { special: 'Boiterie' })]),                                              // 00010 cas ajouté par l'éleveur
    b(0, 11, [e('2026-09-04', { type: 'constat', stade: 'Pleine', agneaux: 'Double' })]),              // 00011 constat compté
    b(0, 12, [e('2026-09-05', { stade: 'IA', agneaux: 'Simple' })]),                                   // 00012
    b(0, 13, [e('2026-09-02', { stade: 'Fin', campagne: undefined })]),                                // 00013 écho sans campagne
    b(0, 14, [e('2026-09-01', { stade: 'Vide' })], { statut: 'vendue' })                               // 00014 non active : jamais proposée
  ];
  DB.casParticuliers = ['Pseudogestation', 'Avortée'];
  DB.lots = []; DB.evenementsLots = []; DB.agnelles = [];
  lotsPcEtat = null; window.__avant = JSON.stringify(DB.brebis);
  render('lots');
});
const att = ms => page.waitForTimeout(ms || 450);
const $t = sel => page.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null, sel);
const nums = () => page.evaluate(() => [...document.querySelectorAll('#lt-table tr[data-eid]')].map(r => r.children[1].textContent.trim()));
const onglet = v => page.click(`#lt-onglets .opt-btn[data-val="${v}"]`);
const chip = (cls, v) => page.click(`.${cls}[data-val="${v}"]`);
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const creer = async (type, nom) => { await page.click(`#lt-type .opt-btn[data-val="${type}"]`); await page.fill('#lt-nom', nom); await page.click('#lt-creer'); await page.waitForSelector('#lt-table'); };

// ================================================================ 1. premier onglet, défaut selon le type de lot
await jeu();
await creer('recherche', 'Doubles à suivre');
const o1 = await page.evaluate(() => [...document.querySelectorAll('#lt-onglets .opt-btn')].map(b => b.textContent + (b.classList.contains('selected') ? '*' : '')));
eq(o1, ['Échographies*', 'Contrôles', 'Lactations et classes', 'Réussite à l\'IA', 'Mises bas'], 'Échographies = premier onglet et onglet par défaut d\'un lot de recherche');
check(await page.evaluate(() => DB.lots[0].membres.length === 0 && DB.lots[0].journal === 1), 'lot de recherche créé VIDE et journalisé');
await page.click('#lt-terminer');
await creer('reforme', 'Réforme test');
eq(await page.evaluate(() => document.querySelector('#lt-onglets .selected').textContent), 'Échographies', 'défaut d\'un lot de réforme');
await page.click('#lt-terminer');
await page.click('#lt-type .opt-btn[data-val="reproduction"]'); await page.fill('#lt-nom', 'IA test'); await page.click('#lt-creer'); await page.waitForSelector('#lt-table');
eq(await page.evaluate(() => document.querySelector('#lt-onglets .selected').textContent), 'Mises bas', 'défaut d\'un lot de reproduction = Mises bas (Échographies reste le premier onglet)');
await onglet('echos');
eq(await page.evaluate(() => document.querySelector('#lt-onglets .opt-btn').textContent), 'Échographies', 'la barre commence par Échographies même pour la reproduction');
await page.click('#lt-terminer');
console.log('OK 1 Échographies = premier onglet ; défaut : recherche et réforme → Échographies, reproduction → Mises bas ; lots créés vides.');

// ================================================================ 2. colonnes, tri âge décroissant puis n°, ligne d'info
await jeu();
await creer('recherche', 'Lot A');
const th = await page.evaluate(() => [...document.querySelectorAll('#lt-table th')].map(x => x.textContent.replace(/[▲▼]/g, '').trim()).filter(Boolean));
eq(th, ['N°', 'Millésime · âge', 'Dernière écho', 'Type', 'Stade', 'Agneaux', 'Cas particuliers', 'Lots'], 'colonnes de l\'onglet');
eq(await nums(), ['80001', '80002', '80003', '90004', '90005', '90006', '00007', '00008', '00009', '00010', '00011', '00012', '00013'], 'sans critère : les 13 brebis actives (la vendue exclue), âge décroissant puis n° croissant');
const info = await $t('#lt-echo-resume');
check(info === 'Dernière écho de la campagne 2027 : vides 1 · simples 3 · doubles 3 · gestantes sans comptage 1 · cas particuliers 2 · sans écho 3 (13 brebis actives) — dont 1 avec des échos sans campagne, non rattachées', 'ligne d\'information : ' + info);
check(/dont 1 avec des échos sans campagne/.test(info), 'les échos sans campagne sont signalés, jamais rattachés : ' + info);
const ligne1 = await page.evaluate(() => [...document.querySelector('#lt-table tr[data-eid="' + E(8, 3) + '"]').children].slice(1, -1).map(c => c.textContent.replace(/\s+/g, ' ').trim()).join('|'));
check(/80003\|.*\|01-09-2026\|Stades\|Milieu\|2\+\|—/.test(ligne1), 'ligne : date, type, stade, agneaux « 2+ », cas : ' + ligne1);
const ligne9 = await page.evaluate(() => [...document.querySelector('#lt-table tr[data-eid="' + E(0, 9) + '"]').children].slice(1, -1).map(c => c.textContent.replace(/\s+/g, ' ').trim()).join('|'));
check(/PARASIT\. Avortée/.test(ligne9), 'pastilles de cas particuliers : ' + ligne9);
console.log('OK 2 colonnes, ordre, ligne d\'information (vides · simples · doubles · … · sans écho, échos sans campagne signalés).');

// ================================================================ 3. type, stades, comptage, ou / et
await page.click('#lt-echo-type .opt-btn[data-val="constat"]'); await att(100);
eq(await nums(), ['80001', '80002', '00011'], 'type Constat');
eq(await page.evaluate(() => [...document.querySelectorAll('.lt-echo-stade')].map(b => b.dataset.val)), ['Gestante', 'Vide'], 'Constat → Gestante / Vide');
check(/Type : Constat/.test(await $t('#lt-tags')), 'étiquette du critère');
await page.click('#lt-echo-type .opt-btn[data-val="stades"]'); await att(100);
eq(await page.evaluate(() => [...document.querySelectorAll('.lt-echo-stade')].map(b => b.dataset.val)), ['Vide', 'Début', 'Milieu', 'Fin', 'IA', 'Retour 1', 'Retour 2', 'Tardive'], 'Stades → Vide, Début, Milieu, Fin, IA, Retour 1, Retour 2, Tardive');
await page.click('#lt-echo-type .opt-btn[data-val="toutes"]'); await att(100);
eq(await page.evaluate(() => [...document.querySelectorAll('.lt-echo-stade')].map(b => b.dataset.val)), ['Gestante', 'Vide', 'Début', 'Milieu', 'Fin', 'IA', 'Retour 1', 'Retour 2', 'Tardive'], 'Toutes : tous les groupes');
await chip('lt-echo-stade', 'Milieu'); await chip('lt-echo-stade', 'Fin'); await chip('lt-echo-agn', 'Double'); await att(100);
eq(await nums(), ['80003', '90004'], '(Milieu ou Fin) ET Double : comptage exact 3 = Double, Milieu Simple exclu');
check(/Stade : Milieu ou Fin/.test(await $t('#lt-tags')) && /Agneaux : Double/.test(await $t('#lt-tags')), 'étiquettes : Stade : Milieu ou Fin · Agneaux : Double');
await page.click('#lt-reinit'); await att(100);
await chip('lt-echo-agn', 'Simple'); await att(100);
eq(await nums(), ['90005', '90006', '00012'], 'Simple = agneaux Simple ou nombreAgneaux 1');
await page.click('#lt-reinit'); await att(100);
await chip('lt-echo-stade', 'Gestante'); await chip('lt-echo-agn', 'Double'); await att(100);
eq(await nums(), ['00011'], 'Gestante ET Double : un constat peut être compté (le groupe Nombre d\'agneaux est toujours proposé)');
console.log('OK 3 type → critères proposés, « ou » dans un groupe, « et » entre groupes, comptage exact, constat compté.');

// ================================================================ 4. « Vide » + comptage : aide, rien d'effacé ni grisé, zéro résultat
await page.click('#lt-reinit'); await att(100);
await chip('lt-echo-stade', 'Vide'); await chip('lt-echo-agn', 'Double'); await att(100);
eq(await nums(), [], 'Vide + Double : aucun résultat');
check(/Vide n'a pas d'agneaux : aucun résultat pour Vide avec ce critère/.test(await $t('#lt-echo-aide') || ''), 'aide visible : ' + await $t('#lt-echo-aide'));
const etat4 = await page.evaluate(() => ({ stades: DB && lotsPcEtat.F.echo.stades, agn: lotsPcEtat.F.echo.agneaux, dis: [...document.querySelectorAll('.lt-echo-agn, .lt-echo-stade')].some(b => b.disabled || b.style.opacity || b.style.pointerEvents === 'none') }));
check(JSON.stringify(etat4.stades) === '["Vide"]' && JSON.stringify(etat4.agn) === '["Double"]' && !etat4.dis, 'aucun critère effacé, aucun bouton grisé : ' + JSON.stringify(etat4));
await chip('lt-echo-stade', 'Milieu'); await att(100);
eq(await nums(), ['80003'], 'Vide ou Milieu, ET Double : seuls les non vides comptent');
console.log('OK 4 « Vide » avec un nombre d\'agneaux : aide visible, aucun critère effacé ni grisé, zéro résultat pour Vide.');

// ================================================================ 5. cas particuliers dynamiques, campagne à venir
await page.click('#lt-reinit'); await att(100);
eq(await page.evaluate(() => [...document.querySelectorAll('.lt-echo-cas-chip')].map(b => b.dataset.val)), ['__parasitisme', 'Pseudogestation', 'Avortée', 'Boiterie'], 'cas : Parasitisme fixe + liste + valeur réellement présente sur une écho (cas de l\'éleveur)');
await chip('lt-echo-cas-chip', '__parasitisme'); await chip('lt-echo-cas-chip', 'Boiterie'); await att(100);
eq(await nums(), ['00009', '00010'], 'Parasitisme ou Boiterie');
await page.evaluate(() => { DB.casParticuliers.push('Mammite'); render('lots'); });
await page.waitForSelector('#lt-table');
check(await page.evaluate(() => !!document.querySelector('.lt-echo-cas-chip[data-val="Mammite"]')), 'une valeur ajoutée à la liste apparaît aussitôt (liste lue dynamiquement)');
await page.click('#lt-reinit'); await att(100);
await page.selectOption('#lt-echo-campagne', '2027'); await att(100);
eq(await nums(), ['00008', '80001', '80002', '80003', '90004', '90005', '90006', '00007', '00009', '00010', '00011', '00012', '00013'].filter(n => false).length ? [] : await nums(), 'campagne à venir sélectionnée');
await chip('lt-echo-stade', 'Milieu'); await att(100);
eq(await nums(), ['00008'], 'campagne à venir (2028) : seule l\'écho taguée à venir ; l\'écho de la campagne en cours n\'y entre pas');
check(/Campagne de l'écho : 2028 · à venir/.test(await $t('#lt-tags')), 'étiquette de la campagne');
console.log('OK 5 cas particuliers lus dynamiquement (+ valeurs présentes), campagne de l\'écho en cours / à venir.');

// ================================================================ 6. SAISIE RÉELLE : dates et n°, caractère par caractère, focus conservé
await page.click('#lt-reinit'); await att(100);
await page.click('#lt-echo-du'); await page.keyboard.type('09012026', { delay: 40 });
await page.click('#lt-echo-au'); await page.keyboard.type('09012026', { delay: 40 });          // clic dans le champ suivant juste après la frappe : il doit prendre le focus
await att(1500);                                                   // le redessin attend la fin de la frappe dans un champ date
check(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'lt-echo-au' && await page.evaluate(() => document.getElementById('lt-echo-du').value + '|' + document.getElementById('lt-echo-au').value) === '2026-09-01|2026-09-01', 'dates tapées au clavier, focus resté dans le 2e champ : ' + await page.evaluate(() => document.getElementById('lt-echo-du').value + '|' + document.getElementById('lt-echo-au').value));
eq(await nums(), ['80001', '80002', '80003', '90004', '90005', '90006'], 'écho du 01/09 au 01/09 : la dernière écho de la brebis 90006 est du 01/09 (son Vide du 01/08 est ignoré)');
check(/Écho du 01-09-2026 au 01-09-2026/.test(await $t('#lt-tags')), 'étiquette des dates');
await page.click('#lt-q'); await page.keyboard.type('9000', { delay: 60 }); await att(600);
check(await page.evaluate(() => document.activeElement.id) === 'lt-q' && await page.evaluate(() => document.getElementById('lt-q').value) === '9000', 'n° tapé caractère par caractère, focus conservé');
eq(await nums(), ['90004', '90005', '90006'], 'recherche n° « 9000 » combinée aux dates');
await page.keyboard.type('4', { delay: 60 }); await att(600);
eq(await nums(), ['90004'], 'n° « 90004 »');
await page.click('#lt-reinit'); await att(100);
console.log('OK 6 saisie réelle au clavier : dates (clic immédiat dans le champ suivant) et n° caractère par caractère, focus conservé.');

// ================================================================ 7. sélection, affectation depuis 2 onglets, déjà dans le lot, filtres rapides inchangés
await page.click('tr[data-eid="' + await page.evaluate(() => E(8, 3)) + '"]'); await page.click('tr[data-eid="' + await page.evaluate(() => E(9, 4)) + '"]');
check(/2 sélectionnées sur cet onglet/.test(await $t('#lt-compte')), 'sélection : ' + await $t('#lt-compte'));
await onglet('misesbas'); await page.click('tr[data-eid="' + await page.evaluate(() => E(9, 5)) + '"]');
await onglet('echos');
check(/3 sélectionnées sur cet onglet/.test(await $t('#lt-compte')) && /Affecter 3 brebis au lot/.test(await $t('#lt-affecter')), 'sélection conservée entre onglets : ' + await $t('#lt-affecter'));
await page.click('#lt-affecter'); await att(100);
eq(await page.evaluate(() => DB.lots.find(l => l.nom === 'Lot A').membres.map(cleanEid).sort()), await page.evaluate(() => [E(8, 3), E(9, 4), E(9, 5)].map(cleanEid).sort()), 'affectation depuis 2 onglets : 3 brebis ajoutées');
check(await page.evaluate(() => { const l = DB.lots.find(x => x.nom === 'Lot A'); return l.journal === 1 && DB.evenementsLots.filter(ev => ev.lotId === l.id).length === 1; }), 'un événement groupé au journal');
const dej = await page.evaluate(() => { const r = document.querySelector('tr[data-eid="' + E(8, 3) + '"]'); return [r.textContent.includes('dans ce lot'), r.querySelector('input').disabled]; });
check(dej[0] && dej[1], 'brebis déjà dans le lot : signalée et non cochable');
await page.click('#lt-tout'); await att(100);
check(/Affecter 10 brebis au lot/.test(await $t('#lt-affecter')), 'Tout cocher : sur le résultat filtré, sans les brebis déjà dans le lot : ' + await $t('#lt-affecter'));
await page.click('#lt-rien'); await att(100);
await page.click('#lt-rapide-reforme'); await att(100);
check(await page.evaluate(() => document.querySelector('#lt-onglets .selected').dataset.val) === 'controles' && /Au moins une anomalie|Une anomalie/.test(await $t('#lt-tags')), 'filtre rapide « Critères réforme » inchangé (onglet Contrôles, anomalie)');
await page.click('#lt-rapide-ia'); await att(100);
check(await page.evaluate(() => document.querySelector('#lt-onglets .selected').dataset.val === 'misesbas' && lotsPcEtat.F.sansDeuxEchecs === true && lotsPcEtat.F.mbMode === 'avant'), 'filtre rapide « Critères IA » inchangé (onglet Mises bas, pas 2 échecs de suite, mise bas avant)');
check(await page.evaluate(() => lotsPcEtat.selection.size) === 0, 'les filtres rapides ne cochent rien');
console.log('OK 7 sélection conservée entre onglets, affectation depuis 2 onglets (1 événement), brebis déjà dans le lot signalée, Tout cocher sur le filtré, filtres rapides inchangés.');

// ================================================================ 8. aucune écriture sur les brebis
check(await page.evaluate(() => JSON.stringify(DB.brebis) === window.__avant), 'les brebis ne sont jamais modifiées par l\'onglet');
console.log('OK 8 aucune modification des brebis.');

// ================================================================ 9. données réelles, LECTURE SEULE
if (exportPresent(EXPORT_ORIGINAL)) {
  const j = JSON.stringify(lireExport(EXPORT_ORIGINAL));
  const out = await page.evaluate((json) => {
    DB = migrateData(JSON.parse(json)); window.__saves = 0; saveData = function () { window.__saves++; }; lotsPcEtat = null;
    const avant = JSON.stringify(DB.brebis);
    DB.lots = DB.lots || [];
    const lot = { id: 'LTEST', nom: 'Test lecture', dateCreation: '2026-10-03', membres: [], journal: 1, membresEmpreinte: empreinteMembresLot([]), journalN: 0 };
    DB.lots.push(lot);
    lotsPcEtat = lotsPcEtatInitial(); lotsPcEtat.lotId = 'LTEST'; lotsPcEtat.onglet = 'echos'; lotsPcEtat.F.echo.campagne = DB.campagneDebut + 1;
    render('lots');
    const lignes = document.querySelectorAll('#lt-table tr[data-eid]').length;
    const actives = DB.brebis.filter(s => (s.statut || 'active') === 'active').length;
    lotsPcEtat.F.echo.agneaux = ['Double']; render('lots');
    const doubles = document.querySelectorAll('#lt-table tr[data-eid]').length;
    const attendus = DB.brebis.filter(s => (s.statut || 'active') === 'active' && echoCorrespond(s, Object.assign(criteresEchoVides(), { campagne: DB.campagneDebut + 1, agneaux: ['Double'] }))).length;
    const resume = document.getElementById('lt-echo-resume').textContent;
    return { lignes, actives, doubles, attendus, resume, intact: JSON.stringify(DB.brebis) === avant && window.__saves === 0 };
  }, j);
  check(out.intact && out.lignes === out.actives && out.doubles === out.attendus, 'données réelles : onglet affiché sans écriture ; liste = brebis actives, filtre Double = fonction commune : ' + JSON.stringify(out));
  console.log('OK 9 données réelles (lecture seule) : ' + out.lignes + ' brebis actives, ' + out.doubles + ' doubles en campagne à venir ; ' + out.resume);
}
await browser.close();
console.log('\nTOUS LES TESTS DE L\'ONGLET PC « ÉCHOGRAPHIES » SONT PASSÉS');
