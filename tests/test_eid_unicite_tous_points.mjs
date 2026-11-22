/* Unicité de l'EID sur TOUS les points de création, d'import et de correction : un même animal enregistré sous l'autre forme (n° national
   11 chiffres ↔ EID 15 chiffres) est reconnu partout (conflitEidToutesFormes) — ajout de brebis, de bélier, d'agnelle, mise bas d'une brebis
   inconnue, rapprochement de l'inventaire (ni « en moins » ni « en plus »), bascule agnelle → brebis (l'agnelle ne se signale pas elle-même),
   correction d'EID ; garde-fou : plus aucun contrôle EXACT seul dans le code. saveData REMPLACÉ ; jeu synthétique (indicatif 000045). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
p.on('dialog', d => d.accept());
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
const jeu = () => p.evaluate(() => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2027; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  const f = (id, eid) => ({ id, eid, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
  DB.brebis = [f('a', '00004551001'), f('b', '250000004551002')];   // a : ancienne fiche sur 11 chiffres
  DB.brebis[1].agnelages = [{ date: '2026-11-02', campagne: 2027, lambs: [{ sexe: 'Mâle', eid: '00004561001', statutFinal: 'vendu', mouvements: [{ type: 'Vendu', date: '2026-11-20' }] }] }];   // agneau sorti, 11 chiffres
  DB.beliers = [{ id: 'z', eid: '00004531637', statut: 'actif', sanitaire: [], mouvements: [] }];
  DB.agnelles = [{ id: 'g', eid: '250000004571001', origine: 'née', mouvements: [], sanitaire: [] }];
  DB.registre = { brebis: { '00004581001': { mouvements: [{ type: 'Vente', date: '2025-05-01' }] } }, beliers: {}, agnelles: {} };
  DB.lots = [];
});

// 1. le contrôle commun reconnaît chaque animal sous l'autre forme
await jeu();
eq(await p.evaluate(() => ['250000004551001', '250000004561001', '250000004531637', '00004571001', '250000004581001', '250000004599999'].map(e => { const c = conflitEidToutesFormes(e); return c ? c.categorie : null; })),
  ['brebis', 'agneau', 'belier', 'agnelle', 'registre-brebis', null], 'brebis, agneau sorti, bélier, agnelle, registre reconnus sous l\'autre forme ; un EID libre passe');
eq(await p.evaluate(() => [conflitEidToutesFormes('00004571001', 'g'), (conflitEidToutesFormes('00004571001', 'a') || {}).categorie]), [null, 'agnelle'], 'l\'animal exclu (bascule, fiche modifiée) ne se signale pas lui-même, les autres oui');

// 2. ajout de brebis, de bélier, d'agnelle : refusé sous l'autre forme, rien de créé
for (const [vue, bouton, eid, liste] of [['add-sheep', '#btn-save-sheep', '250000004551001', 'brebis'], ['add-belier', '#btn-save-belier', '250000004561001', 'beliers'], ['add-agnelle', '#btn-save-agnelle', '250000004581001', 'agnelles']]) {
  await jeu();
  const avant = await p.evaluate(l => DB[l].length, liste);
  await p.evaluate(v => render(v), vue);
  if (vue === 'add-agnelle') await p.click('.origine-opt[data-val="achetée"]');
  await p.fill('#input-eid', eid);
  if (vue === 'add-agnelle' && await p.$('#f-date')) await p.fill('#f-date', '2026-11-01');
  await p.click(bouton);
  check(await p.isVisible('#err'), vue + ' : message d\'erreur');
  check(/appartient déjà/.test(await p.textContent('#err')), vue + ' : message « appartient déjà » : ' + await p.textContent('#err'));
  eq(await p.evaluate(l => DB[l].length, liste), avant, vue + ' : rien de créé');
}
console.log('OK 1-2 : contrôle commun, ajouts brebis / bélier / agnelle refusés sous l\'autre forme.');

// 3. mise bas d'une brebis inconnue : un n° déjà porté (registre, autre forme) est un conflit, jamais une brebis créée
await jeu();
eq(await p.evaluate(() => [chercherBrebisMiseBas('250000004581001').statut, chercherBrebisMiseBas('250000004561001').statut, chercherBrebisMiseBas('250000004599999').statut]), ['conflit', 'conflit', 'inconnue'], 'mise bas : registre et agneau sorti sous l\'autre forme = conflit');

// 4. inventaire : la brebis enregistrée sur 11 chiffres et bipée sur 15 est CONFIRMÉE (jamais « en moins » = sortie, ni « en plus »)
await jeu();
eq(await p.evaluate(() => { const r = calculerRapprochementInventaire(['250000004551001', '250000004551002']); return [r.confirmees.map(s => s.id), r.enMoins.map(s => s.id), r.enPlus.map(x => x.eid)]; }), [['a', 'b'], [], []], 'inventaire : brebis reconnue sous l\'autre forme');

// 5. garde-fou : le contrôle exact seul n'est plus appelé ailleurs que dans conflitEidToutesFormes
eq(await p.evaluate(() => {
  const tout = [...document.scripts].map(s => s.textContent).join('\n');
  return [...tout.matchAll(/verifierEidUnique\(([^)]*)\)/g)].map(m => m[1]).filter(a => a.trim() && !/^v, |^existant\.item\.eid|^eid, exclureId = null$/.test(a));
}), [], 'plus aucun appel direct au contrôle exact (tous les points passent par conflitEidToutesFormes)');
console.log('OK 3-5 : mise bas, inventaire, garde-fou du code.');
await browser.close();
console.log('test_eid_unicite_tous_points : OK');
