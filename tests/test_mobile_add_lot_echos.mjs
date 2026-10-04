/* Lots échographies, partie 4 : écran mobile « Nouveau lot » (recherche ET réforme) harmonisé avec l'onglet PC « Échographies ».
   Même ordre et mêmes libellés (Nom → Date → Critères d'échographie : Type, Campagne, Stade, Nombre d'agneaux, Cas particuliers → Brebis du lot), date prérenseignée et éditable
   (recherche), aide « Vide » + comptage sans rien effacer ni griser, création journalisée, et PARITÉ STRICTE avec le PC : mêmes critères posés par clics des deux côtés → mêmes brebis.
   saveData REMPLACÉ ; jeu synthétique ; export réel en LECTURE SEULE. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, EXPORT_ORIGINAL, exportPresent, lireExport } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
async function ouvrir(desktop) {
  const page = await (await browser.newContext({ viewport: desktop ? { width: 1700, height: 2000 } : { width: 420, height: 2400 }, locale: 'en-US' })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
  if (desktop) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  return page;
}
const mob = await ouvrir(false), pc = await ouvrir(true);
const jeu = pg => pg.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  window.E = (d, n) => '2500162991' + d + String(n).padStart(4, '0');
  const e = (date, extra) => Object.assign({ type: 'stade', date, stade: null, agneaux: null, nombreAgneaux: null, special: null, parasitisme: false, campagne: 2026 }, extra);
  const b = (d, n, echos, extra) => Object.assign({ id: 'b' + d + n, eid: E(d, n), statut: 'active', createdAt: 1, echographies: echos, agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, extra || {});
  DB.brebis = [
    b(8, 1, [e('2026-09-01', { type: 'constat', stade: 'Pleine' })]),
    b(8, 2, [e('2026-09-01', { type: 'constat', stade: 'Vide' })]),
    b(8, 3, [e('2026-09-01', { stade: 'Milieu', agneaux: 'Double' })]),
    b(9, 4, [e('2026-09-01', { stade: 'Fin', nombreAgneaux: 3 })]),
    b(9, 5, [e('2026-09-01', { stade: 'Début', nombreAgneaux: 1 })]),
    b(9, 6, [e('2026-08-01', { stade: 'Vide' }), e('2026-09-01', { stade: 'Milieu', agneaux: 'Simple' })]),
    b(0, 7, []),
    b(0, 8, [e('2026-10-02', { stade: 'Milieu', agneaux: 'Double', campagne: 2027 })]),
    b(0, 9, [e('2026-09-03', { special: 'Avortée', parasitisme: true })]),
    b(0, 10, [e('2026-09-03', { special: 'Boiterie' })]),
    b(0, 11, [e('2026-09-04', { type: 'constat', stade: 'Pleine', agneaux: 'Double' })]),
    b(0, 12, [e('2026-09-05', { stade: 'IA', agneaux: 'Simple' })]),
    b(0, 13, [e('2026-09-02', { stade: 'Fin', parasitisme: true })]),
    b(0, 14, [e('2026-09-01', { stade: 'Vide' })], { statut: 'vendue' })
  ];
  DB.casParticuliers = ['Pseudogestation', 'Avortée'];
  DB.lots = []; DB.evenementsLots = []; DB.agnelles = [];
  lotsPcEtat = null; window.__avant = JSON.stringify(DB.brebis);
});
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const num = id => id.slice(-5);

// ================================================================ 1. ordre et libellés des deux écrans
await jeu(mob);
for (const [ecran, vue] of [['recherche', 'add-lot'], ['réforme', 'add-lot-reforme']]) {
  await mob.evaluate(v => render(v), vue);
  const labels = await mob.evaluate(() => [...document.querySelectorAll('#app label, #app #echo-stade-label, #app .card > div[style*="font-size:12px"]')].map(x => x.textContent.replace(/\s+/g, ' ').replace(/ⓘ|i$/, '').trim()).filter(t => t && t.length < 60));
  const ordre = ['Nom du lot', 'Critères d\'échographie (facultatif)', 'Type d\'échographie', 'Campagne de l\'écho', 'Stade', 'Nombre d\'agneaux', 'Cas particuliers', ecran === 'recherche' ? 'Brebis du lot' : 'Brebis à réformer'];
  if (ecran === 'recherche') ordre.splice(1, 0, 'Date');
  let pos = -1;
  ordre.forEach(l => { const k = labels.findIndex((t, i) => i > pos && t.startsWith(l)); check(k > pos, ecran + ' : libellé « ' + l + ' » absent ou hors ordre : ' + JSON.stringify(labels)); pos = k; });
  eq(await mob.evaluate(() => [...document.querySelectorAll('#echo-type-list .chip')].map(b => b.textContent)), ['Toutes', 'Constat', 'Stades'], ecran + ' : types');
  eq(await mob.evaluate(() => [...document.querySelectorAll('#echo-campagne-list .chip')].map(b => b.textContent)), ['2027 · en cours', '2028 · à venir'], ecran + ' : campagnes');
  eq(await mob.evaluate(() => [...document.querySelectorAll('#echo-cas-list .chip')].map(b => b.textContent)), ['Parasitisme', 'Pseudogestation', 'Avortée', 'Boiterie'], ecran + ' : cas particuliers (Parasitisme fixe + liste + valeurs présentes)');
}
check(await mob.evaluate(() => { render('add-lot'); return document.getElementById('f-lot-date').value; }) === '2026-10-03', 'date prérenseignée à aujourd\'hui');
check(await mob.evaluate(() => { render('add-lot-reforme'); return !document.getElementById('f-lot-date'); }), 'réforme : pas de date (comme sur PC)');
console.log('OK 1 ordre et libellés identiques au PC sur les deux écrans (Nom → Date (recherche) → Critères → Brebis) ; date prérenseignée.');

// ================================================================ 2. type → critères proposés, « Vide » + comptage
await mob.evaluate(() => render('add-lot'));
const stades = () => mob.evaluate(() => [...document.querySelectorAll('#echo-stade-list .chip')].map(b => b.textContent));
const clic = sel => mob.click(sel);
await clic('#echo-type-list [data-val="constat"]');
eq(await stades(), ['Gestante', 'Vide'], 'Constat → Gestante / Vide');
check(await mob.evaluate(() => document.getElementById('echo-stade-label').textContent) === 'Résultat', 'libellé Résultat pour un constat');
await clic('#echo-type-list [data-val="stades"]');
eq(await stades(), ['Vide', 'Début', 'Milieu', 'Fin', 'IA', 'Retour 1', 'Retour 2', 'Tardive'], 'Stades → 8 stades');
await clic('#echo-type-list [data-val="toutes"]');
eq(await stades(), ['Gestante', 'Vide', 'Début', 'Milieu', 'Fin', 'IA', 'Retour 1', 'Retour 2', 'Tardive'], 'Toutes');
await clic('#echo-stade-list [data-val="Vide"]'); await clic('#echo-agneaux-list [data-val="Double"]');
const v = await mob.evaluate(() => ({ aide: document.getElementById('echo-aide').textContent, vis: !document.getElementById('echo-aide').classList.contains('hidden'), dis: [...document.querySelectorAll('#echo-agneaux-list .chip, #echo-stade-list .chip')].some(b => b.disabled || b.style.opacity || b.style.pointerEvents === 'none'), agn: document.querySelectorAll('#echo-agneaux-list .selected').length, sel: document.querySelectorAll('.sp-check:checked').length, cpt: document.getElementById('echo-compteur').textContent }));
check(v.vis && /Vide n'a pas d'agneaux : aucun résultat pour Vide avec ce critère/.test(v.aide) && !v.dis && v.agn === 1 && v.sel === 0, '« Vide » + comptage : aide, aucun chip effacé ni grisé, 0 sélectionnée : ' + JSON.stringify(v));
console.log('OK 2 type → Gestante/Vide, 8 stades, Toutes ; « Vide » + comptage : aide visible, rien d\'effacé ni grisé, aucun résultat.');

// ================================================================ 3. PARITÉ PC / mobile : mêmes critères, mêmes brebis (clics des deux côtés)
await jeu(pc);
const combos = [
  { nom: 'Constat', type: 'constat' }, { nom: 'Stades', type: 'stades' },
  { nom: 'Milieu ou Fin ET Double', stades: ['Milieu', 'Fin'], agneaux: ['Double'] }, { nom: 'Simple', agneaux: ['Simple'] }, { nom: 'Gestante ET Double', stades: ['Gestante'], agneaux: ['Double'] },
  { nom: 'Vide ET Double', stades: ['Vide'], agneaux: ['Double'] }, { nom: 'Vide ou Milieu ET Double', stades: ['Vide', 'Milieu'], agneaux: ['Double'] },
  { nom: 'Parasitisme ou Boiterie', cas: ['__parasitisme', 'Boiterie'] }, { nom: 'Avortée', cas: ['Avortée'] }, { nom: 'Fin ET Parasitisme', stades: ['Fin'], cas: ['__parasitisme'] },
  { nom: 'campagne à venir', campagne: 2027 }, { nom: 'à venir + Milieu', campagne: 2027, stades: ['Milieu'] }, { nom: 'Constat + Milieu (critère choisi avant de changer de type : conservé, zéro résultat)', type: 'constat', stades: ['Milieu'], stadesAvant: true },
  { nom: 'IA ou Début', stades: ['IA', 'Début'] }
];
const poserMobile = async (c) => {
  await mob.evaluate(() => render('add-lot'));
  if (c.stadesAvant) for (const s of c.stades) await mob.click(`#echo-stade-list [data-val="${s}"]`);
  if (c.type) await mob.click(`#echo-type-list [data-val="${c.type}"]`);
  if (c.campagne) await mob.click(`#echo-campagne-list [data-val="${c.campagne}"]`);
  for (const s of c.stadesAvant ? [] : (c.stades || [])) await mob.click(`#echo-stade-list [data-val="${s}"]`);
  for (const a of c.agneaux || []) await mob.click(`#echo-agneaux-list [data-val="${a}"]`);
  for (const k of c.cas || []) await mob.click(`#echo-cas-list [data-val="${k}"]`);
  return mob.evaluate(() => [...document.querySelectorAll('.sp-check:checked')].map(x => x.dataset.id).map(id => DB.brebis.find(b => b.id === id).eid.slice(-5)).sort());
};
const poserPc = async (c) => {
  await pc.evaluate(() => { DB.lots = [{ id: 'LP', nom: 'Parité', dateCreation: '2026-10-03', membres: [], journal: 1, membresEmpreinte: empreinteMembresLot([]), journalN: 0 }]; lotsPcEtat = lotsPcEtatInitial(); lotsPcEtat.lotId = 'LP'; lotsPcEtat.onglet = 'echos'; render('lots'); });
  await pc.waitForSelector('#lt-table');
  if (c.stadesAvant) for (const s of c.stades) await pc.click(`.lt-echo-stade[data-val="${s}"]`);
  if (c.type) await pc.click(`#lt-echo-type .opt-btn[data-val="${c.type}"]`);
  if (c.campagne) await pc.selectOption('#lt-echo-campagne', String(c.campagne));
  for (const s of c.stadesAvant ? [] : (c.stades || [])) await pc.click(`.lt-echo-stade[data-val="${s}"]`);
  for (const a of c.agneaux || []) await pc.click(`.lt-echo-agn[data-val="${a}"]`);
  for (const k of c.cas || []) await pc.click(`.lt-echo-cas-chip[data-val="${k}"]`);
  return pc.evaluate(() => [...document.querySelectorAll('#lt-table tr[data-eid]')].map(r => r.children[1].textContent.trim()).sort());
};
await jeu(mob);
for (const c of combos) {
  const m = await poserMobile(c), p = await poserPc(c);
  const actif = !!(c.type || c.stades || c.agneaux || c.cas);
  // l'écran mobile sélectionne les brebis qui correspondent (vide sans critère actif : la campagne seule ne sélectionne rien) ; le PC liste les brebis qui correspondent (toutes sans critère actif)
  const attendu = await pc.evaluate(cc => DB.brebis.filter(s => (s.statut || 'active') === 'active' && echoCorrespond(s, Object.assign(criteresEchoVides(), cc.c, { campagne: cc.c.campagne || 2026 }))).map(s => s.eid.slice(-5)).sort(), { c });
  if (actif) { eq(m, p, 'PARITÉ « ' + c.nom + ' » : mobile vs PC'); eq(m, attendu, 'fonction commune « ' + c.nom + ' »'); }
  else eq(m, [], '« ' + c.nom + ' » : la campagne seule ne sélectionne rien sur mobile');
}
console.log('OK 3 parité stricte PC / mobile sur ' + combos.length + ' combinaisons (type, campagne, stades, comptage, cas particuliers, « ou » / « et », critère conservé hors type) : mêmes brebis des deux côtés, identiques à la fonction commune.');

// ================================================================ 4. création : recherche (date saisie au clavier), réforme ; journal ; sélection recalculée
await jeu(mob);
await mob.evaluate(() => render('add-lot'));
await mob.click('#f-lot-nom'); await mob.keyboard.type('Doubles du jour', { delay: 25 });
await mob.click('#f-lot-date'); await mob.keyboard.type('10042026', { delay: 40 });
check(await mob.evaluate(() => document.getElementById('f-lot-nom').value + '|' + document.getElementById('f-lot-date').value) === 'Doubles du jour|2026-10-04', 'nom et date tapés au clavier : ' + await mob.evaluate(() => document.getElementById('f-lot-nom').value + '|' + document.getElementById('f-lot-date').value));
await mob.click('#echo-agneaux-list [data-val="Double"]');
check(await mob.evaluate(() => document.getElementById('f-lot-nom').value) === 'Doubles du jour' && /correspondent aux critères/.test(await mob.evaluate(() => document.getElementById('echo-compteur').textContent)), 'les critères n\'effacent ni le nom ni la date ; compteur : ' + await mob.evaluate(() => document.getElementById('echo-compteur').textContent));
await mob.click('#echo-agneaux-list [data-val="Double"]');
check(await mob.evaluate(() => document.querySelectorAll('.sp-check:checked').length) === 0 && await mob.evaluate(() => document.getElementById('echo-compteur').textContent) === '', 'critère décoché : la sélection redevient vide');
await mob.click('#echo-agneaux-list [data-val="Double"]');
await mob.click('#btn-save-lot'); await mob.waitForTimeout(100);
const lot = await mob.evaluate(() => { const l = DB.lots[0]; return { nom: l.nom, date: l.dateCreation, type: l.type || null, j: l.journal, m: l.membres.map(e => e.slice(-5)).sort(), ev: DB.evenementsLots.length }; });
eq(lot, { nom: 'Doubles du jour', date: '2026-10-04', type: null, j: 1, m: ['00011', '80003', '90004'].sort(), ev: 1 }, 'lot de recherche créé (date saisie, 3 doubles, journalisé)');
await mob.evaluate(() => render('add-lot-reforme'));
await mob.click('#echo-type-list [data-val="constat"]'); await mob.click('#echo-stade-list [data-val="Vide"]');
await mob.click('#btn-save-lot-reforme'); await mob.waitForTimeout(100);
const lf = await mob.evaluate(() => { const l = DB.lots[1]; return { type: l.type, date: l.dateCreation, j: l.journal, m: l.membres.map(e => e.slice(-5)) }; });
eq(lf, { type: 'reforme', date: '2026-10-03', j: 1, m: ['80002'] }, 'lot de réforme créé par critères (constat Vide)');
check(await mob.evaluate(() => { render('add-lot'); document.getElementById('f-lot-nom').value = 'X'; document.getElementById('f-lot-date').value = ''; document.getElementById('btn-save-lot').click(); return document.getElementById('err').textContent; }) === 'Renseigne la date.', 'date obligatoire sur le lot de recherche');
console.log('OK 4 création : recherche (nom et date tapés au clavier, 3 doubles, journalisé) ; réforme (constat Vide) ; critères sans effet sur nom / date ; date obligatoire.');

// ================================================================ 5. aucune écriture sur les brebis ; données réelles en lecture seule
check(await mob.evaluate(() => JSON.stringify(DB.brebis) === window.__avant), 'les brebis ne sont jamais modifiées');
if (exportPresent(EXPORT_ORIGINAL)) {
  const j = JSON.stringify(lireExport(EXPORT_ORIGINAL));
  const out = await mob.evaluate(async (json) => {
    DB = migrateData(JSON.parse(json)); window.__saves = 0; saveData = function () { window.__saves++; };
    const avant = JSON.stringify(DB.brebis);
    render('add-lot');
    document.querySelector('#echo-campagne-list [data-val="' + (DB.campagneDebut + 1) + '"]').click();
    document.querySelector('#echo-agneaux-list [data-val="Double"]').click();
    const m = document.querySelectorAll('.sp-check:checked').length;
    const attendu = DB.brebis.filter(s => (s.statut || 'active') === 'active' && echoCorrespond(s, Object.assign(criteresEchoVides(), { campagne: DB.campagneDebut + 1, agneaux: ['Double'] }))).length;
    return { m, attendu, cpt: document.getElementById('echo-compteur').textContent, intact: JSON.stringify(DB.brebis) === avant && window.__saves === 0 };
  }, j);
  check(out.m === out.attendu && out.intact, 'données réelles : sélection mobile = fonction commune, sans écriture : ' + JSON.stringify(out));
  console.log('OK 5 données réelles (lecture seule) : ' + out.m + ' doubles en campagne à venir sélectionnées (« ' + out.cpt + ' »).');
}
await browser.close();
console.log('\nTOUS LES TESTS DU « NOUVEAU LOT » MOBILE (CRITÈRES D\'ÉCHOGRAPHIE) SONT PASSÉS');
