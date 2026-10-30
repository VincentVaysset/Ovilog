/* Page PC « Saisie de mises bas » (maquette « Grands écrans de saisie ») : 6 tuiles (Mises bas, Agneaux nés, Mâles, Femelles, Morts-nés, Restantes), « Terminer la session » en haut à droite, carte « Nouvelle mise bas » (n° ou EID
   TAPÉ, jamais de scan ; date ; Repro déduite et modifiable ; TABLEAU des agneaux : EID, Mâle / Femelle, case mort-né, adoption) puis, EN DESSOUS et pleine largeur, « Dernières mises bas » (10 dernières, « Voir toutes »,
   totaux, avancement, portées), contrôles discrets (blocage : déjà mis bas, brebis inconnue ; alertes : date future à confirmer, vide définitive signalée jamais corrigée), « restantes » = (actives − vides définitives) − mises bas,
   annulation en un geste (sans confirmation, bandeau « Mise bas annulée »), aucun tableau coupé ni défilant à 1200 et 1400 px. Jeu synthétique, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';

const browser = await chromium.launch(LAUNCH);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1200 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));   // horloge figée : les âges lus dans l'EID ne dépendent pas de l'année du jour
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
let reponseConfirm = true; const confirms = [];
page.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponseConfirm ? d.accept() : d.dismiss(); } else d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

await page.evaluate(() => {
  DB = migrateData({});
  window.__saves = 0;
  const o = saveData; saveData = function (...a) { window.__saves++; return o.apply(this, a); };
  const eid = (an, n) => '250000012' + '9' + an + String(n).padStart(5, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  window.E = eid;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  const b = [];
  for (let i = 1; i <= 6; i++) b.push(fiche(eid(3, 100 + i)));                                   // 6 brebis à régulariser (3 ans)
  b.push(fiche(eid(3, 200), { agnelages: [{ date: '2026-11-10', campagne: 2026, lambs: [{ sexe: 'Mâle' }] }] }));
  b.push(fiche(eid(3, 201), { agnelages: [{ date: '2099-12-31', campagne: 2026, lambs: [{ sexe: 'Femelle' }, { sexe: 'Mort-né' }] }] }));   // date future
  b.push(fiche(eid(3, 300), { videesDefinitives: [{ date: '2026-12-05', campagne: 2026 }] }));      // vide définitive
  b.push(fiche(eid(3, 400), { statut: 'vendue' }));                                                  // non active
  DB.brebis = b; DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  window.ouvrirSaisie = () => { resetMisebasRapideSession(); render('misebas-rapide'); };
});
const kpis = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#pc-saisie-misebas .pc-kpis .brd-kpi')].map(k => [k.querySelector('.brd-kpi-l').textContent, [k.querySelector('.brd-kpi-v').textContent.trim(), (k.querySelector('.brd-kpi-s') || { textContent: '' }).textContent.trim()]])));
const saisir = async (val) => { await page.fill('#scan-misebas', val); await page.press('#scan-misebas', 'Enter'); };

// ================================================================ 1. indicateurs
await page.evaluate(() => ouvrirSaisie());
await page.waitForSelector('#pc-saisie-misebas');
let k = await kpis();
// actives : 6 + 2 (mises bas) + 1 (vide) = 9 ; à mettre bas = 9 − 1 vide = 8 ; restantes = 8 − 2 = 6
check(k['Mises bas'][0] === '2' && /sur 8 attendues/.test(k['Mises bas'][1]), 'mises bas 2 sur 8 attendues : ' + JSON.stringify(k['Mises bas']));
check(k['Agneaux nés'][0] === '3' && /prolificité 1,50/.test(k['Agneaux nés'][1]), 'agneaux nés 3, prolificité 1,50 : ' + JSON.stringify(k['Agneaux nés']));
check(k['Mâles'][0] === '1' && k['Femelles'][0] === '1' && k['Morts-nés'][0] === '1', 'mâles / femelles / morts-nés 1 / 1 / 1');
check(k['Restantes'][0] === '6' && /25,0 % réalisé/.test(k['Restantes'][1]), 'restantes 6 (9 actives − 1 vide − 2 mises bas), 25,0 % réalisé : ' + JSON.stringify(k['Restantes']));
check(Object.keys(k).join() === 'Mises bas,Agneaux nés,Mâles,Femelles,Morts-nés,Restantes', '6 tuiles de la charte : ' + Object.keys(k).join());
const cohe = await page.evaluate(() => { const c = campagneBilanChiffres(DB.brebis.filter(s => (s.statut || 'active') === 'active')); return [c.misesBasRestantes, c.troupeauAMettreBas]; });
check(JSON.stringify(cohe) === '[6,8]', 'même calcul que le bilan de campagne : ' + cohe);
const texte = await page.evaluate(() => document.getElementById('pc-saisie-misebas').textContent);
check(!/bip|Scanner|scanner/i.test(texte), 'aucune mention de bip ni de scan sur PC : on saisit un numéro');
check(/Saisir le n° de la brebis \(court ou EID complet\)/.test(texte), 'consigne : saisir le n°');
check(await page.evaluate(() => !document.getElementById('lamb-list-rapide') && !!document.querySelector('.btn-annuler-mb-campagne') && /Total \(2 mises bas\)/.test(document.getElementById('mb-totaux').textContent)), 'tableau des mises bas de la campagne et ligne de totaux');
const rowsTxt = await page.evaluate(() => [...document.querySelectorAll('#pc-saisie-misebas table.brd-t tr')].slice(1, 3).map(r => r.textContent.replace(/\s+/g, ' ').trim()));
check(rowsTxt.some(t => /31-12-2099 date à vérifier/.test(t)), 'mise bas à date future : « date à vérifier » sans correction : ' + JSON.stringify(rowsTxt));
// plus de carte « Contrôles automatiques » (les contrôles restent actifs : messages seulement quand ils se déclenchent) ; « Terminer la session » : pilule visible de 44 px, contour et texte verts, en haut à droite
{
  const r = await page.evaluate(() => { const b = document.getElementById('btn-fin-session-mb'), c = getComputedStyle(b), R = b.getBoundingClientRect(), A = document.getElementById('app').getBoundingClientRect(); return { carte: /Contrôles automatiques|Blocage|Alerte/.test(document.getElementById('pc-saisie-misebas').textContent), h: Math.round(R.height), rayon: parseFloat(c.borderTopLeftRadius), bord: c.borderTopColor, bordL: c.borderTopWidth, texte: c.color, fond: c.backgroundColor, droite: Math.round(A.right - R.right), haut: Math.round(R.top - A.top) }; });
  check(!r.carte, 'plus de carte « Contrôles automatiques » (Blocage / Alerte) sur la page');
  check(r.h === 44 && r.rayon >= 22 && r.bord === 'rgb(53, 127, 75)' && r.texte === 'rgb(53, 127, 75)' && r.fond === 'rgb(255, 255, 255)' && r.bordL === '2px', '« Terminer la session » : pilule 44 px, contour et texte verts : ' + JSON.stringify(r));
  check(r.droite <= 40 && r.haut <= 80, '« Terminer la session » en haut à droite : ' + JSON.stringify(r));
}
console.log('OK 1 indicateurs : 2 mises bas, 3 agneaux (prolificité 1,50), restantes 6 sur 8 = calcul du bilan de campagne ; aucune mention de bip ; date future signalée.');

// ================================================================ 2. saisie : numéro, compteurs, repro
await saisir('00101');
await page.waitForSelector('#f-date-rapide');
const bar = await page.evaluate(() => document.getElementById('pc-brebis-trouvee').textContent.replace(/\s+/g, ' '));
check(/n°00101/.test(bar) && /3 an\(s\)/.test(bar), 'brebis trouvée par son n° : ' + bar);
check(await page.evaluate(() => !document.getElementById('mb-blocage') && document.querySelectorAll('#mb-alertes .mb-msg').length === 0), 'contrôles discrets : aucun message tant qu\'aucune règle ne se déclenche');
check(await page.evaluate(() => window.__saves) === 0, 'rien n\'est enregistré tant qu\'on ne valide pas');
const entetes = await page.evaluate(() => [...document.querySelectorAll('#mb-table-agneaux th')].map(t => t.textContent.trim()));
check(entetes.slice(0, 5).join() === 'Agneau,EID,Sexe,Mort-né,Adoption / cause', 'tableau des agneaux : ' + entetes.join());
check(await page.evaluate(() => document.querySelectorAll('#lamb-list-rapide tr').length) === 1, 'un agneau à saisir au départ');
const sexe = async (i, v) => page.click(`.sexe-opt-rapide[data-id="${i}"][data-val="${v}"]`);
await sexe(0, 'Mâle'); await page.click('#add-lamb-rapide'); await sexe(1, 'Femelle');
let cpt = await page.evaluate(() => ({ lignes: document.querySelectorAll('#lamb-list-rapide tr').length, portee: document.getElementById('pc-portee').textContent, actifs: [...document.querySelectorAll('.sexe-opt-rapide.active')].map(b => b.dataset.val), ph: [...document.querySelectorAll('.eid-input-rapide')].map(i => i.placeholder) }));
check(cpt.lignes === 2 && cpt.portee === 'Portée double · 2 agneaux' && cpt.actifs.join() === 'Mâle,Femelle' && cpt.ph.every(p => p === "Saisir le n° (ex. 71001) ou l'EID"), '2 lignes, portée double, sexes choisis, EID tapé (pas de scan) : ' + JSON.stringify(cpt));
// mort-né : plus d'EID ni d'adoption sur la ligne ; adoption : un champ pour la mère apparaît
await page.check('.mortne-check-rapide[data-id="1"]');
check(await page.evaluate(() => !document.querySelector('.eid-input-rapide[data-id="1"]') && !document.querySelector('.adopt-check-rapide[data-id="1"]') && /pas de boucle/.test(document.querySelector('#lamb-list-rapide tr:nth-child(2)').textContent) && !!document.querySelector('.sexe-opt-rapide[data-id="1"][data-val="Femelle"].active')), 'mort-né : pas de boucle ni d\'adoption, le sexe reste facultatif');
await page.uncheck('.mortne-check-rapide[data-id="1"]');
check(await page.evaluate(() => { const c = document.querySelector('.adopt-check-rapide[data-id="0"]'), f = document.querySelector('.adopt-field-rapide[data-id="0"]'); return getComputedStyle(f).display === 'none' && !!c; }), 'adoption : champ de la mère masqué tant que la case n\'est pas cochée');
await page.check('.adopt-check-rapide[data-id="0"]');
check(await page.evaluate(() => getComputedStyle(document.querySelector('.adopt-field-rapide[data-id="0"]')).display === 'block'), 'adoption : le champ « N° ou EID de la mère » apparaît');
await page.uncheck('.adopt-check-rapide[data-id="0"]');
// retirer une ligne
await page.click('.remove-lamb-rapide[data-id="1"]'); await page.click('#add-lamb-rapide'); await sexe(1, 'Femelle');
// repro : déduite (MN par défaut), modifiable
const repro = await page.evaluate(() => ({ sel: [...document.querySelectorAll('.repro-code-opt-rapide.selected')].map(b => b.dataset.val), chip: document.getElementById('pc-repro-chip').textContent }));
check(repro.sel.join() === 'MN' && repro.chip === 'déduit, modifiable', 'repro déduite MN : ' + JSON.stringify(repro));
await page.click('.repro-code-opt-rapide[data-val="IA"]');
check(await page.evaluate(() => document.getElementById('pc-repro-chip').textContent) === 'choisi à la main', 'repro modifiée à la main');
console.log('OK 2 brebis trouvée par son n° ; tableau des agneaux (sexe, mort-né sans boucle, adoption) ; portée double ; Repro déduite puis modifiée ; rien d\'enregistré avant validation.');

// ================================================================ 3. date future : alerte à confirmer
const futur = '2099-01-15';
await page.fill('#f-date-rapide', futur);
await page.dispatchEvent('#f-date-rapide', 'change');
reponseConfirm = false; confirms.length = 0;
await page.click('#btn-valider-misebas');
await page.waitForTimeout(200);
check(confirms.length === 1 && /postérieure à aujourd'hui/.test(confirms[0]) && await page.evaluate(() => window.__saves) === 0 && await page.evaluate(() => DB.brebis.find(b => b.eid === E(3, 101)).agnelages.length) === 0, 'date future : confirmation demandée, refus = rien enregistré : ' + confirms[0]);
console.log('OK 3 date future : alerte à confirmer, refus = rien enregistré.');

// ================================================================ 4. validation
await page.fill('#f-date-rapide', '2026-11-15');
await page.dispatchEvent('#f-date-rapide', 'change');
await page.click('.repro-code-opt-rapide[data-val="IA"]');
reponseConfirm = true; confirms.length = 0;
await page.click('#btn-valider-misebas');
await page.waitForFunction(() => window.__saves >= 1 && !document.getElementById('f-date-rapide'));
const ag = await page.evaluate(() => JSON.parse(JSON.stringify(DB.brebis.find(b => b.eid === E(3, 101)).agnelages)));
check(ag.length === 1 && ag[0].campagne === 2026 && ag[0].date === '2026-11-15' && ag[0].codeRepro === 'IA' && ag[0].codeSieolRepro === 1, 'agnelage : campagne 2026, date, repro IA : ' + JSON.stringify(ag[0]).slice(0, 200));
check(ag[0].lambs.map(l => l.sexe).join() === 'Mâle,Femelle' && ag[0].lambs.every(l => l.eid === '' && l.sanitaire.length === 0), 'agneaux : Mâle + Femelle, aucun soin d\'office comme sur mobile : ' + JSON.stringify(ag[0].lambs));
k = await kpis();
check(k['Mises bas'][0] === '3' && k['Agneaux nés'][0] === '5' && k['Restantes'][0] === '5', 'indicateurs mis à jour : 3 mises bas, 5 agneaux, 5 restantes : ' + JSON.stringify(k));
check(await page.evaluate(() => /1 mise bas saisie dans cette session/.test(document.querySelector('.brd-sub').textContent)), 'compteur de session');
const ligneNouvelle = await page.evaluate(() => [...document.querySelectorAll('#pc-saisie-misebas table.brd-t tr')].some(r => /15-11-2026/.test(r.textContent)));
check(ligneNouvelle, 'la mise bas apparaît dans le tableau');
const av = await page.evaluate(() => document.querySelector('#pc-saisie-misebas .pc-legend').parentElement.textContent.replace(/\s+/g, ' '));
check(/37,5 % réalisé/.test(av) && !/brebis à mettre bas/.test(av) && /Portées : 1 simple, 2 doubles/.test(av), 'avancement (« restantes / attendues » n\'est dit que par la tuile) : ' + av);
console.log('OK 4 validation : agnelage enregistré (campagne, date, repro IA, 2 agneaux, aucun soin d\'office) ; indicateurs, tableau et avancement mis à jour.');

// ================================================================ 5. contrôles : déjà une mise bas, inconnue, vide définitive
await saisir('00200');
const dej = await page.evaluate(() => ({ blocage: document.getElementById('mb-blocage').innerText.replace(/\s+/g, ' '), form: !!document.getElementById('f-date-rapide'), edit: !!document.getElementById('btn-edit-existing-agnelage-rapide'), boutons: [document.getElementById('btn-ouvrir-fiche-mb').textContent, document.getElementById('btn-autre-brebis-mb').textContent] }));
check(/a déjà mis bas cette campagne/.test(dej.blocage) && /Le 10-11-2026 · 1 agneau\. Une seule mise bas par campagne\./.test(dej.blocage) && !dej.form && dej.edit && dej.boutons.join() === 'Ouvrir la fiche,Autre brebis', 'blocage : déjà mis bas : ' + JSON.stringify(dej));
await saisir('99999');
check(await page.evaluate(() => /Brebis inconnue/.test(document.getElementById('pc-saisie-misebas').textContent) && !document.getElementById('f-date-rapide')), 'brebis inconnue : blocage, rien n\'est créé sans accord');
await page.click('#btn-cancel-unknown-mb');
const nBrebis = await page.evaluate(() => DB.brebis.length);
check(nBrebis === 10, 'aucune fiche créée : ' + nBrebis);
await saisir('00300');
await page.waitForSelector('#f-date-rapide');
check(/vide définitive cette campagne.*jamais corrigée seule/.test(await page.evaluate(() => document.querySelector('#mb-alertes [data-alerte="vide-definitive"]').textContent)), 'vide définitive : alerte, pas de blocage');
await sexe(0, 'Femelle');
await page.click('#btn-valider-misebas');
await page.waitForFunction(() => DB.brebis.find(b => b.eid === E(3, 300)).agnelages.length === 1);
const inco = await page.evaluate(() => ({ vd: DB.brebis.find(b => b.eid === E(3, 300)).videesDefinitives.length, inco: bilanARegulariserData().groupes.incoherentes.length }));
check(inco.vd === 1 && inco.inco === 1, 'incohérence créée (vide définitive ET mise bas), signalée dans Brebis à régulariser, vide définitive NON corrigée : ' + JSON.stringify(inco));
console.log('OK 5 contrôles : déjà une mise bas (blocage, bouton de modification), brebis inconnue (blocage), vide définitive (alerte -> incohérence signalée, jamais corrigée seule).');

// ================================================================ 6. annuler : saisie en cours et mise bas enregistrée
await saisir('00102');
await page.waitForSelector('#f-date-rapide');
await sexe(0, 'Mâle');
const avantAnnul = await page.evaluate(() => window.__saves);
await page.click('#btn-annuler-saisie-pc');
check(await page.evaluate(() => !document.getElementById('f-date-rapide')) && await page.evaluate(() => window.__saves) === avantAnnul && await page.evaluate(() => DB.brebis.find(b => b.eid === E(3, 102)).agnelages.length) === 0, 'Annuler : saisie abandonnée, rien enregistré');
reponseConfirm = true; confirms.length = 0;
const nAvant = await page.evaluate(() => misebasCampagneRows().length);
await page.click('.btn-annuler-mb-campagne >> nth=0');
await page.waitForFunction((n) => misebasCampagneRows().length === n - 1, nAvant);
check(confirms.length === 0, 'annuler une mise bas : AUCUNE confirmation (un geste) : ' + JSON.stringify(confirms));
check(await page.evaluate(() => /Mise bas annulée/.test(document.getElementById('mb-annulee').textContent)), 'bandeau « Mise bas annulée »');
check(await page.evaluate(n => misebasCampagneRows().length === n - 1 && window.__saves >= 1, nAvant), 'annuler une mise bas : la mise bas est bien retirée et enregistrée');
console.log('OK 6 annulation : saisie en cours abandonnée sans rien écrire ; annuler une mise bas enregistrée se fait en un geste, sans confirmation.');

const En = (an, n) => '250000012' + '9' + an + String(n).padStart(5, '0');
// ================================================================ 7. enregistrement complet au clavier : EID tapé, mort-né sans boucle (sexe facultatif), adoption vers une brebis ACTIVE seulement
await page.evaluate(() => { DB.brebis.find(b => b.eid === E(3, 103)).agnelages = []; render('misebas-rapide'); });
await saisir('00103');
await page.waitForSelector('#f-date-rapide');
await sexe(0, 'Mâle'); await page.fill('.eid-input-rapide[data-id="0"]', En(4, 1));
await page.check('.adopt-check-rapide[data-id="0"]');
await page.fill('.adopt-eid-rapide[data-id="0"]', En(3, 400));        // brebis vendue : refusée
await page.click('#btn-valider-misebas');
check(/Aucune brebis active/.test(await page.evaluate(() => document.getElementById('err').textContent)) && await page.evaluate(() => DB.brebis.find(b => b.eid === E(3, 103)).agnelages.length) === 0, 'adoption vers une brebis non active : refusée, rien enregistré');
await page.fill('.adopt-eid-rapide[data-id="0"]', '00104');
await page.waitForFunction(() => /Mère adoptive/.test(document.querySelector('.adopt-preview-rapide[data-id="0"]').textContent));
await page.click('#add-lamb-rapide'); await sexe(1, 'Femelle'); await page.check('.mortne-check-rapide[data-id="1"]');
await page.click('#btn-valider-misebas');
await page.waitForSelector('#mb-confirmation');
const a103 = await page.evaluate(() => JSON.parse(JSON.stringify(DB.brebis.find(b => b.eid === E(3, 103)).agnelages[0])));
check(a103.lambs[0].eid === En(4, 1) && a103.lambs[0].adopte === true && a103.lambs[0].adoptiveEid === En(3, 104) && a103.lambs[0].sanitaire.length === 0, 'agneau : EID tapé, mère adoptive, aucun soin d\'office : ' + JSON.stringify(a103.lambs[0]).slice(0, 220));
check(a103.lambs[1].sexe === 'Mort-né' && a103.lambs[1].sexeMortNe === 'Femelle' && a103.lambs[1].eid === undefined && !(a103.lambs[1].sanitaire || []).length, 'mort-né : sexe facultatif conservé (sexeMortNe), jamais d\'EID ni de soin');
check(await page.evaluate(() => /Mise bas enregistrée/.test(document.getElementById('mb-confirmation').innerText) && /1 mâle, 1 femelle mort-née/.test(document.getElementById('mb-confirmation').innerText)), 'confirmation verte avec le résumé');
confirms.length = 0;
await page.click('#btn-annuler-derniere');
await page.waitForSelector('#mb-annulee');
check(confirms.length === 0 && await page.evaluate(() => DB.brebis.find(b => b.eid === E(3, 103)).agnelages.length) === 0, '« Annuler cette saisie » : un geste, sans confirmation');
console.log('OK 7 saisie complète au clavier : EID tapé, adoption (brebis active seulement), mort-né sans boucle avec sexe facultatif, aucun soin d\'office, annulation en un geste.');

// ================================================================ 8. mise en page : carte « Nouvelle mise bas » AU-DESSUS de « Dernières mises bas » (pleine largeur), 10 dernières + « Voir toutes », aucun tableau coupé ni défilant à 1200 et 1400 px
await page.evaluate(() => {
  const base = DB.brebis.filter(b => b.statut === 'active' && !(b.agnelages || []).length).slice(0, 3);
  for (let i = 0; i < 12; i++) DB.brebis.push(Object.assign({}, JSON.parse(JSON.stringify(DB.brebis[0])), { id: 'x' + i, eid: E(3, 700 + i), numeroCourtTravailSieol: String(900 + i), agnelages: [{ date: '2026-12-' + String(1 + i).padStart(2, '0'), campagne: 2026, lambs: [{ sexe: 'Mâle', eid: '' }, { sexe: 'Femelle', eid: '' }] }] }));
  void base; resetMisebasRapideSession(); render('misebas-rapide');
});
for (const largeur of [1200, 1400]) {
  await page.setViewportSize({ width: largeur, height: 1000 });
  await page.evaluate(() => render('misebas-rapide'));
  await saisir('00105'); await page.waitForSelector('#f-date-rapide');
  await page.click('#add-lamb-rapide'); await page.check('.adopt-check-rapide[data-id="0"]');   // ligne la plus large : adoption ouverte
  await page.fill('.adopt-eid-rapide[data-id="0"]', '00104');
  await page.waitForTimeout(200);
  const m = await page.evaluate(() => {
    const r = (q) => document.querySelector(q).getBoundingClientRect();
    const tables = [...document.querySelectorAll('#pc-saisie-misebas table')].map(t => { const c = t.parentElement; return { id: t.id, tw: Math.round(t.getBoundingClientRect().width), cw: c.clientWidth, sw: c.scrollWidth, dep: Math.round(t.getBoundingClientRect().right - c.getBoundingClientRect().right) }; });
    const a = r('#pc-nouvelle-misebas'), b = r('#pc-dernieres-misebas'), app = document.getElementById('app').getBoundingClientRect();
    const lignes = document.querySelectorAll('#mb-table-campagne tr').length - 2;
    return { tables, haut: a.bottom <= b.top + 1, memeLarg: Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1, pleine: Math.round(app.width - a.width), page: document.documentElement.scrollWidth <= window.innerWidth, lignes, voir: (document.getElementById('btn-voir-toutes-mb') || {}).textContent, totaux: document.getElementById('mb-totaux').textContent.replace(/\s+/g, ' ').trim().slice(0, 40) };
  });
  check(m.tables.length === 2 && m.tables.every(t => t.sw <= t.cw + 1 && t.dep <= 1), largeur + ' px : aucun tableau coupé ni défilant : ' + JSON.stringify(m.tables));
  check(m.haut && m.memeLarg && m.pleine <= 80, largeur + ' px : « Nouvelle mise bas » au-dessus de « Dernières mises bas », pleine largeur : ' + JSON.stringify({ haut: m.haut, memeLarg: m.memeLarg, pleine: m.pleine }));
  check(m.page, largeur + ' px : aucun défilement horizontal de la page');
  check(m.lignes === 10 && m.voir === 'Voir toutes (15)' && /Total \(15 mises bas\)/.test(m.totaux), largeur + ' px : 10 dernières mises bas, « Voir toutes (15) », totaux sur les 15 : ' + JSON.stringify({ l: m.lignes, v: m.voir, t: m.totaux }));
  await page.click('#btn-annuler-saisie-pc');
}
await page.click('#btn-voir-toutes-mb');
check(await page.evaluate(() => document.querySelectorAll('#mb-table-campagne tr').length - 2) === 15 && /Réduire/.test(await page.evaluate(() => document.getElementById('btn-voir-toutes-mb').textContent)), '« Voir toutes » : les 15 mises bas, puis « Réduire aux 10 dernières »');
// gabarit PC : titre unique dans le bandeau, champs de 44 px, pas de scan, « Terminer la session » en haut à droite
check(await page.evaluate(() => document.getElementById('page-title').textContent === 'Saisie de mises bas' && getComputedStyle(document.querySelector('#pc-saisie-misebas .brd-doublon')).display === 'none' && document.getElementById('scan-misebas').getBoundingClientRect().height === 44), 'gabarit PC : titre dans le bandeau seulement, champ de 44 px');
console.log('OK 8 mise en page : « Nouvelle mise bas » au-dessus de « Dernières mises bas » (pleine largeur), 10 dernières + « Voir toutes (15) », totaux sur tout, aucun tableau coupé ni défilant à 1200 et 1400 px.');
await browser.close();
console.log('\nTOUS LES TESTS DE LA PAGE PC « SAISIE DE MISES BAS » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
