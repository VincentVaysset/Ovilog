/* Puces de choix MOBILE (.opt-btn, charte graphique, règle CSS unique) : sur tous les écrans mobiles qui en portent (échographie, mise bas, contrôle laitier, nouvelle agnelle, mouvement,
   import du contrôle laitier, rapprochement d'inventaire, traitements 12 mois, fenêtres Qualité / Pénalité / Retrait de lot / Nouveau produit), à 360 et 390 px :
   hauteur 44 px minimum, pilule, état normal = fond blanc + bordure #d9cfb8 + texte #2b261c, état sélectionné = vert pastel #e3f3e6 + bordure verte #357f4b + texte #24613a + gras,
   quelle que soit la variante (warn, blue, coral : une seule couleur), JAMAIS de rouge, rien de coupé ni de débordant, même hauteur choisie ou non (pas de saut de mise en page ; la largeur d'une colonne de grille peut bouger de 1-2 px avec le gras).
   Le PC ne change pas (styles calculés d'avant). Libellés, positions et logique de sélection inchangés (data-val, classes). Jeu SYNTHÉTIQUE, saveData REMPLACÉ, aucune écriture. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const BLANC = 'rgb(255, 255, 255)', CHAMP = 'rgb(217, 207, 184)', TEXTE = 'rgb(43, 38, 28)', PASTEL = 'rgb(227, 243, 230)', VERT = 'rgb(53, 127, 75)', VERT_TEXTE = 'rgb(36, 97, 58)';
const ROUGES = ['rgb(163, 58, 49)', 'rgb(251, 227, 224)'];
const browser = await chromium.launch(LAUNCH);

async function nouveau(largeur, pc) {
  const page = await (await browser.newContext({ viewport: { width: largeur, height: 780 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
  if (pc) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({}); saveData = function () { return true; };
    const eid = n => '2500000129' + '3' + String(n).padStart(5, '0'); window.EID = eid;
    const fiche = e => ({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controlesLaitiers: [], notes: [] });
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    DB.brebis = [fiche(eid(101)), fiche(eid(102))]; DB.beliers = []; DB.agnelles = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    currentSheepId = DB.brebis[0].id; DB.exploitation = Object.assign({}, DB.exploitation, { elevageBio: true });
  });
  return page;
}

// [nom, code d'ouverture, puces à choisir (sélecteurs)]
const ECRANS = [
  ['Échographie (stade, nombre exact)', `render('add-echo')`, ['.type-echo-opt[data-val="stade"]', '.stade-opt', '.comptage-mode-opt[data-val="exact"]', '#nombre-agneaux-group .opt-btn[data-val="2"]']],
  ['Échographie (constat, simple / double)', `render('add-echo')`, ['.type-echo-opt[data-val="constat"]', '.stade-opt', '.comptage-mode-opt[data-val="simple_double"]', '#agneaux-group .opt-btn[data-val="Double"]']],
  ['Mise bas (repro, sexe)', `render('add-agnelage')`, ['.repro-code-opt[data-val="EP"]', '.sexe-opt[data-val="Mâle"]']],
  ['Contrôle laitier (1er/2e/3e)', `render('add-controle')`, ['.ctrl-opt[data-val="2"]']],
  ['Nouvelle agnelle (origine)', `render('add-agnelle')`, ['.origine-opt[data-val="née"]']],
  ['Mouvement (type)', `render('add-mouvement')`, ['.type-opt']],
  ['Import contrôle laitier', `render('import-controle-laitier-sieol')`, ['.cl-controle-opt[data-controle="1"]']],
  ['Rapprochement inventaire', `DB.majInventaireSession = { eids: [EID(901), EID(902)] }; render('maj-inventaire-validation')`, []],
  ['Traitements 12 mois', `render('traitements-12-mois')`, ['#m12-vue-interv']],
  ['Fenêtre Qualité', `render('qualite'); openQualiteSheet(null)`, ['#qs-listeria .opt-btn[data-val="negatif"]']],
  ['Fenêtre Pénalité', `openPenaliteSheet(null, '2026-11', function () {})`, ['.cause-opt[data-val="listeria"]']],
  ['Fenêtre Retrait de lot', `ouvrirModalRetraitLot({ id: 'l1', nom: 'Lot test', membres: [EID(101)] }, EID(101), function () {})`, ['.motif-retrait[data-val="Malade"]']],
];
const mesure = () => [...document.querySelectorAll('.opt-btn')].filter(b => b.offsetParent !== null).map(b => {
  const s = getComputedStyle(b), r = b.getBoundingClientRect(), p = (b.parentElement || b).getBoundingClientRect();
  return { t: b.textContent.trim(), sel: b.classList.contains('selected'), h: Math.round(r.height * 10) / 10, w: Math.round(r.width * 10) / 10, rayon: parseFloat(s.borderTopLeftRadius), fond: s.backgroundColor, bord: s.borderTopColor, bordL: s.borderTopWidth, col: s.color, fw: parseInt(s.fontWeight, 10), ombre: s.boxShadow,
    coupe: b.scrollWidth > b.clientWidth + 1, deborde: r.left < p.left - 1 || r.right > p.right + 1, large: r.right > innerWidth + 1 };
});
let total = 0;
for (const largeur of [360, 390]) {
  const page = await nouveau(largeur, false);
  for (const [nom, code, choix] of ECRANS) {
    await page.evaluate(() => { document.querySelectorAll('.modal-overlay, .sheet-overlay').forEach(o => o.remove()); window.scrollTo(0, 0); });
    await page.evaluate(code); await page.waitForTimeout(150);
    for (const c of choix) { await page.click(c); await page.waitForTimeout(60); }
    const L = await page.evaluate(mesure);
    check(L.length >= 2, `${nom} (${largeur}) : des puces sont affichées (${L.length})`);
    for (const b of L) {
      const id = `${nom} (${largeur} px) « ${b.t} »`;
      check(b.h >= 43.9, `${id} : hauteur ≥ 44 px (${b.h})`);
      check(b.rayon >= b.h / 2, `${id} : pilule (rayon ${b.rayon}, hauteur ${b.h})`);
      check(!b.coupe && !b.deborde && !b.large, `${id} : rien de coupé ni de débordant`);
      check(!ROUGES.includes(b.fond) && !ROUGES.includes(b.bord) && !ROUGES.includes(b.col), `${id} : jamais de rouge`);
      if (b.sel) { eq([b.fond, b.bord, b.col], [PASTEL, VERT, VERT_TEXTE], `${id} : sélectionnée = vert pastel, bordure verte, texte vert foncé`); check(b.fw >= 700, `${id} : sélectionnée en gras`); check(b.ombre === 'none', `${id} : sans halo`); }
      else { eq([b.fond, b.bord, b.bordL, b.col], [BLANC, CHAMP, '1px', TEXTE], `${id} : normale = blanc, bordure #d9cfb8, texte #2b261c`); }
      total++;
    }
    // choisie ou non : même taille (pas de saut de mise en page) -- on compare une puce normale devenue sélectionnée
    const delta = await page.evaluate(() => { const b = [...document.querySelectorAll('.opt-btn')].find(x => x.offsetParent !== null && !x.classList.contains('selected')); if (!b) return 0; const r0 = b.getBoundingClientRect(); b.classList.add('selected'); const r1 = b.getBoundingClientRect(); b.classList.remove('selected'); return [Math.abs(r1.width - r0.width), Math.abs(r1.height - r0.height)]; });
    check(delta[1] < 0.6 && delta[0] <= 3, `${nom} (${largeur}) : même taille choisie ou non (écart largeur/hauteur ${delta}) ; la largeur peut bouger de 1-2 px quand le gras élargit une colonne de grille`);
  }
  // variantes warn / blue / coral / gray : une seule couleur sélectionnée
  const V = await page.evaluate(() => { const out = []; for (const v of ['', 'warn', 'blue', 'coral', 'gray']) { const b = document.createElement('button'); b.className = 'opt-btn selected ' + v; b.textContent = 'x'; document.getElementById('app').appendChild(b); const s = getComputedStyle(b); out.push([s.backgroundColor, s.borderTopColor, s.color].join('|')); b.remove(); } return out; });
  check(new Set(V).size === 1 && V[0] === [PASTEL, VERT, VERT_TEXTE].join('|'), 'variantes warn/blue/coral/gray : une seule couleur ' + JSON.stringify(V));
  await page.context().close();
}
console.log(total + ' puces vérifiées sur ' + ECRANS.length + ' écrans à 360 et 390 px');

// PC inchangé : les anciens styles calculés (règle générale .opt-btn, .pc-seg2, .pc-onglets) ne bougent pas
{
  const pc = await nouveau(1400, true);
  const R = await pc.evaluate(() => {
    const app = document.getElementById('app'), out = {};
    const mk = (nom, parent, cls) => { const w = document.createElement('div'); if (parent) w.className = parent; const b = document.createElement('button'); b.className = cls; b.textContent = 'x'; w.appendChild(b); app.appendChild(w); const s = getComputedStyle(b); const n = { rayon: s.borderTopLeftRadius, bord: s.borderTopWidth + ' ' + s.borderTopColor, pad: s.paddingTop + ' ' + s.paddingLeft, fs: s.fontSize }; b.classList.add('selected'); const t = getComputedStyle(b); out[nom] = Object.assign(n, { sel: [t.backgroundColor, t.borderTopColor, t.color].join('|') }); w.remove(); };
    mk('general', '', 'opt-btn'); mk('seg2', 'pc-seg2', 'opt-btn'); mk('seg2-coral', 'pc-seg2', 'opt-btn coral'); mk('onglets', 'pc-onglets', 'opt-btn'); mk('general-warn', '', 'opt-btn warn');
    return out;
  });
  eq(R.general, { rayon: '18px', bord: '2px rgb(230, 221, 201)', pad: '12px 12px', fs: '14px', sel: [PASTEL, VERT, VERT_TEXTE].join('|') }, 'PC : .opt-btn général inchangé');
  eq(R['general-warn'].sel, 'rgb(251, 238, 215)|rgb(181, 112, 28)|rgb(138, 84, 19)', 'PC : variante warn en ambre de la charte (audit charte J)');
  eq([R.seg2.rayon, R.seg2.bord, R.seg2.pad, R.seg2.fs], ['999px', '1px rgb(217, 207, 184)', '8px 6px', '12.5px'], 'PC : .pc-seg2 inchangé');
  eq(R['seg2-coral'].sel, 'rgb(227, 243, 230)|rgb(227, 243, 230)|rgb(36, 97, 58)', 'PC : .pc-seg2 coral sélectionné en vert pastel (audit charte F, jamais de rouge)');
  eq([R.onglets.rayon, R.onglets.bord, R.onglets.pad], ['999px', '0px rgb(94, 91, 71)', '9px 10px'], 'PC : .pc-onglets inchangé');
  console.log('PC inchangé');
}
await browser.close();
console.log('OK');
