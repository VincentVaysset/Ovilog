/* Refonte Production laitière, partie 5 : retouches de la page PC « Bilan économique ». Tableau « Mois par mois » cliquable (mêmes colonnes ET mêmes valeurs que la page 1 du rapport de
   campagne : ecoCampagneData) qui remplace les pastilles de mois et alimente « Détail du mois » ; carte « Pénalités bactério » à côté de « Composition du gain qualité » : liste, ajout
   (date au clavier), modification, suppression avec confirmation, totaux et gain mis à jour partout. Aucun changement de calcul. saveData REMPLACÉ ; jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1300 }, locale: 'en-US' })).newPage();
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
await page.clock.setFixedTime(new Date('2027-02-20T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
let reponse = true; const confirms = [];
page.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponse ? d.accept() : d.dismiss(); } else d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const $t = sel => page.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').replace(/ /g, ' ').trim() : null, sel);

const jeu = () => page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.parametresPrixLait = [{ campagne: 0, coefficientMsu: 12, prixReference: null, msuReference: null }];
  const bon = (date, extra) => Object.assign({ id: 'p' + date, date, volumeLait: 1000, tb: 70, tp: 55, cellules: 300000, coliformes: 50, floreTotale: 50000, butyriques: 1000, listeria: 'negatif', salmonelles: 'negatif' }, extra || {});
  DB.prelevementsQualite = [bon('2026-12-10'), bon('2027-01-10', { tb: 75, cellules: 700000 })];
  DB.laitTank = [{ id: 't1', date: '2026-12-15', quantite: 12000 }, { id: 't2', date: '2027-01-15', quantite: 20000 }, { id: 't3', date: '2027-02-15', quantite: 5000 }];
  DB.penalitesBacterio = [{ id: 'pe1', dateDebut: '2027-01-10', dateFin: '2027-01-10', litrageL: 1000, cause: 'autre', commentaire: 'labo' }];
  DB.brebis = []; DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  bilanCampagneTab = 'economique'; bilanEconomiqueCampagneAffichee = 2026; bilanEconomiqueMoisAffiche = null; render('bilan-campagne');
});
const tableau = () => page.evaluate(() => [...document.querySelectorAll('#pc-eco-mois tbody tr')].map(tr => [...tr.cells].map(c => c.textContent.replace(/\s+/g, ' ').replace(/ /g, ' ').trim())));
const attendu = () => page.evaluate(() => {
  const e = ecoCampagneData(2026), T = e.totaux, g = fmtGroupe;
  const mille = (v, sg) => v === null || v === undefined ? '—' : (v < 0 ? '−' : (sg && v > 0 ? '+' : '')) + g(Math.abs(v), 2);
  const l = e.mois.map(m => m.visible
    ? [m.libelle, fmtLitres(m.volume), m.msu !== null && m.msu !== undefined ? fmtDecimal(m.msu, 2) : '—', mille(m.prixHors), m.gradesEuroMille === null ? '—' : mille(m.gradesEuroMille, true), m.superAEuroMille === null ? '—' : (m.superAEuroMille === 0 ? '0,00' : mille(m.superAEuroMille, true)), mille(m.prixAvec), m.penalites ? mille(-m.penalites) : '—', m.total !== null ? g(m.total, 2) : '—']
    : [m.libelle, '—', '—', '—', '—', '—', '—', '—', '—']);
  l.push([e.titre, fmtLitres(T.litres), T.msu !== null && T.msu !== undefined ? fmtDecimal(T.msu, 2) : '—', mille(T.prixMoyenHors), '', '', mille(T.prixMoyenAvec), T.montantPenalitesCampagne ? mille(-T.montantPenalitesCampagne) : '—', T.montantAvec !== null ? g(T.montantAvec, 2) : '—']);
  return l.map(r => r.map(c => c.replace(/\u00a0/g, ' ')));
});

// ================================================================ 1. tableau Mois par mois = mêmes valeurs que le rapport (ecoCampagneData)
await jeu();
check(await page.evaluate(() => !document.querySelector('#bilan-eco-mois, .chip-list')), 'plus de pastilles de mois');
const t1 = await tableau(), a1 = await attendu();
t1.forEach((r, i) => { if (JSON.stringify(r) !== JSON.stringify(a1[i])) console.log('DIFF ligne', i, JSON.stringify(r), JSON.stringify(a1[i])); });
eq(t1, a1, 'chaque cellule du tableau = valeur de la fonction de données commune (celle du PDF)');
eq(await page.evaluate(() => [...document.querySelectorAll('#pc-eco-mois thead th')].map(th => th.textContent.replace(/\s+/g, ' ').trim())), ['Mois', 'VolumeL', 'MSU', 'Prix hors qualité€ / 1000 L', 'Grades€ / 1000 L', 'Super A€ / 1000 L', 'Prix avec qualité€ / 1000 L', 'Pénalités€', 'Total du mois€'], 'colonnes identiques à la page 1 du PDF');
eq(t1.length, 13, '12 mois + total');
console.log('OK 1 tableau « Mois par mois » : 12 mois + total, colonnes et valeurs = rapport de campagne.');

// ================================================================ 2. clic sur un mois -> Détail du mois
check(/Détail du mois : Déc 26/.test(await $t('#bilan-eco-prix-mois-card')), 'premier mois avec prélèvement sélectionné par défaut');
await page.click('.pc-eco-row[data-cle="2027-01"]');
await page.waitForFunction(() => /Détail du mois : Jan 27/.test(document.getElementById('bilan-eco-prix-mois-card').textContent));
check(await page.evaluate(() => document.querySelector('.pc-eco-row.sel').dataset.cle) === '2027-01', 'ligne sélectionnée en surbrillance');
await page.focus('.pc-eco-row[data-cle="2026-12"]'); await page.keyboard.press('Enter');
await page.waitForFunction(() => /Détail du mois : Déc 26/.test(document.getElementById('bilan-eco-prix-mois-card').textContent));
console.log('OK 2 clic (et Entrée) sur un mois : son détail.');

// ================================================================ 3. carte Pénalités bactério : liste existante, à côté de la composition du gain
const place = await page.evaluate(() => { const p = document.getElementById('pc-eco-penalites'), c = [...document.querySelectorAll('#pc-economique .card')].find(x => /Composition du gain/.test(x.textContent)); return { memeRangee: p.parentElement === c.parentElement, texte: p.textContent.replace(/\s+/g, ' ').replace(/ /g, ' ').trim() }; });
check(place.memeRangee, 'carte Pénalités à côté de « Composition du gain qualité »');
check(/Pénalités bactério/.test(place.texte) && /1 pénalité sur la campagne/.test(place.texte) && /10-01-2027/.test(place.texte) && /Autre · 1 000 L · labo/.test(place.texte) && /−200,00 €/.test(place.texte) && /Total des pénalités/.test(place.texte), 'liste des pénalités : ' + place.texte);
console.log('OK 3 carte Pénalités bactério : à côté de la composition du gain, liste + total.');

// ================================================================ 4. ajout au clavier : tableau, carte, gain mis à jour
const gain0 = await page.evaluate(() => ecoCampagneData(2026).totaux.gain);
await page.click('#pc-pen-add');
check(await page.evaluate(() => !!document.querySelector('.sheet-card')), 'la fiche de pénalité s\'ouvre');
await page.focus('#ps-date-debut'); await page.keyboard.type('12102026', { delay: 40 });
await page.click('#ps-cause [data-val="salmonelles"]');
await page.click('#ps-litrage'); await page.keyboard.type('500', { delay: 40 });
await page.click('#ps-save'); await page.waitForTimeout(150);
const apres = await page.evaluate(() => ({ n: DB.penalitesBacterio.length, p: DB.penalitesBacterio.find(x => x.dateDebut === '2026-12-10'), e: ecoCampagneData(2026), saves: window.__saves }));
check(apres.n === 2 && apres.p.litrageL === 500 && apres.p.cause === 'salmonelles' && apres.saves === 1, 'pénalité enregistrée une fois : ' + JSON.stringify(apres.p));
eq(await tableau(), await attendu(), 'tableau recalculé (même fonction)');
const dec = (await tableau())[2];
check(dec[7] === '−100,00' && dec[5] === '0,00', 'décembre : pénalité −100,00 € (500 L × 200 €/1000 L) et Super A annulé par le Salmonelles : ' + dec.join('|'));
check(/2 pénalités sur la campagne/.test(await $t('#pc-eco-penalites')) && /−300,00 €/.test(await $t('#pc-eco-penalites')), 'carte : 2 pénalités, total −300,00 €');
check(apres.e.totaux.gain < gain0, 'gain de la campagne diminué');
check(/Détail du mois : Déc 26/.test(await $t('#bilan-eco-prix-mois-card')), 'retour sur le Bilan économique, mois conservé');
console.log('OK 4 ajout d\'une pénalité (date et litres au clavier) : carte, tableau, détail et gain mis à jour, une seule écriture.');

// ================================================================ 5. modification, suppression avec confirmation
await page.click('.pc-pen[data-id="pe1"]');
check(await page.evaluate(() => document.getElementById('ps-litrage').value) === '1000', 'fiche de modification préremplie');
await page.fill('#ps-litrage', '1500'); await page.click('#ps-save'); await page.waitForTimeout(150);
eq(await page.evaluate(() => DB.penalitesBacterio.find(x => x.id === 'pe1').litrageL), 1500, 'litrage modifié');
check(/−300,00 €/.test((await tableau())[3][7] ? '−300,00 €' : '') && (await tableau())[3][7] === '−300,00', 'janvier : pénalité −300,00 € : ' + (await tableau())[3].join('|'));
await page.click('.pc-pen[data-id="pe1"]');
reponse = false; confirms.length = 0; await page.click('#ps-delete');
check(confirms.length === 1 && /Supprimer cette pénalité/.test(confirms[0]) && await page.evaluate(() => DB.penalitesBacterio.some(x => x.id === 'pe1')), 'refus : pénalité conservée');
reponse = true; await page.click('#ps-delete'); await page.waitForTimeout(150);
check(await page.evaluate(() => !DB.penalitesBacterio.some(x => x.id === 'pe1')) && (await tableau())[3][7] === '—', 'accord : pénalité supprimée, tableau mis à jour');
eq(await tableau(), await attendu(), 'tableau toujours égal à la fonction de données');
console.log('OK 5 modification (fiche préremplie) et suppression avec confirmation (refus / accord).');

// ================================================================ 6. campagne sans pénalité
await page.evaluate(() => { DB.penalitesBacterio = []; render('bilan-campagne'); });
check(/Aucune pénalité bactério sur cette campagne/.test(await $t('#pc-eco-penalites')), 'état vide de la carte Pénalités');
console.log('OK 6 campagne sans pénalité : état vide.');
await browser.close();
console.log('\nTOUS LES TESTS DES RETOUCHES PC DU BILAN ÉCONOMIQUE SONT PASSÉS');
