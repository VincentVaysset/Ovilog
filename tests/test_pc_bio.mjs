/* Élevage bio (réglage Paramètres > Exploitation) : délais légaux saisis sur la fiche produit, DOUBLÉS dans les calculs ; délai légal 0 :
   minimum 48 h (2 jours) seulement si l'option « minimum 48 h bio » du produit = oui (non : rien ; à confirmer : non appliqué, mention visible) ;
   délais APPLIQUÉS + indicateur bio figés dans le soin (changer le réglage ou la fiche ne modifie jamais un soin passé) ; option « compte dans les
   3 traitements » par produit ; mobile « Sous délai d'attente » et fiche brebis en bio. saveData est REMPLACÉ par un compteur. Jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1500 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
const jeu = (bio) => page.evaluate((bio) => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign({}, DB.exploitation, { elevageBio: !!bio });
  DB.produits = { vaccins: ['Bravoxin 10'], antibiotiques: ['Intramicine', 'Zero'], antiparasitaires: ['Ivomec'], antiinflammatoires: [], autres: ['Aluspray'] };
  const info = (lait, viande, o) => Object.assign({ posologie: null, delaiAttente: lait, delaiLait: lait, delaiViande: viande, surOrdonnance: false, reserveVeterinaire: false }, o || {});
  DB.produitsInfo = { Intramicine: info(7, 28), Zero: info(0, 0), Ivomec: info(3, 14), 'Bravoxin 10': info(0, 0), Aluspray: info(0, 0) };
  DB.brebis = [1, 2, 3].map(i => fiche(eid(3, i), { id: 'B' + i }));
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} }; DB.intervenants = ['Éleveur'];
  window.E = eid;
}, bio);
const $t = sel => page.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null, sel);
const dates = async () => ((await $t('#cs-dates')).match(/\d{2}-\d{2}-\d{4}/g) || []);
const ouvrir = async () => { await page.evaluate(() => { carnetSanitairePcEtat = null; carnetDernierLot = null; render('sanitaire'); }); await page.waitForSelector('#cs-produit'); };
const preparer = async (type, categorie, produit) => {
  await page.click(`.cs-type[data-val="${type}"]`);
  if (categorie) await page.selectOption('#cs-categorie', categorie);
  if (produit) await page.selectOption('#cs-produit', produit);
  await page.fill('#cs-date', '2026-09-20'); await page.fill('#cs-duree', '1');
  await page.fill('#cs-dose', '8'); await page.selectOption('#cs-voie', { index: 1 });
};

// ================================================================ 1. calcul pur
await jeu(true);
const m = await page.evaluate(() => {
  const r = (legalLait, legalViande, bio, min48h) => { const x = delaisAppliques({ legalLait, legalViande, bio, min48h }); return [x.lait, x.viande, x.modeLait, x.modeViande, x.min48AConfirmer]; };
  return {
    horsBio: r(7, 28, false, 'oui'), horsBioZero: r(0, 0, false, 'oui'),
    bio: r(7, 28, true, 'oui'), bioZeroOui: r(0, 0, true, 'oui'), bioZeroNon: r(0, 0, true, 'non'), bioZeroConfirmer: r(0, 0, true, 'a_confirmer'),
    bioMixte: r(3, 0, true, 'oui'), bioInconnuOui: r(null, null, true, 'oui'), bioInconnuConfirmer: r(null, null, true, 'a_confirmer'), bioUn: r(1, 1, true, 'non')
  };
});
check(JSON.stringify(m.horsBio) === '[7,28,"legal","legal",false]' && JSON.stringify(m.horsBioZero) === '[0,0,"legal","legal",false]', 'hors bio : délais légaux inchangés, 0 reste 0 : ' + JSON.stringify([m.horsBio, m.horsBioZero]));
check(JSON.stringify(m.bio) === '[14,56,"double","double",false]', 'bio : 7 → 14, 28 → 56 : ' + JSON.stringify(m.bio));
check(JSON.stringify(m.bioZeroOui) === '[2,2,"min48","min48",false]', 'bio, légal 0, minimum 48 h = oui : 2 jours : ' + JSON.stringify(m.bioZeroOui));
check(JSON.stringify(m.bioZeroNon) === '[0,0,"zero","zero",false]', 'bio, légal 0, minimum 48 h = non : 0 : ' + JSON.stringify(m.bioZeroNon));
check(JSON.stringify(m.bioZeroConfirmer) === '[0,0,"min48-a-confirmer","min48-a-confirmer",true]', 'bio, légal 0, à confirmer : non appliqué (0) + mention : ' + JSON.stringify(m.bioZeroConfirmer));
check(JSON.stringify(m.bioMixte) === '[6,2,"double","min48",false]', 'bio : lait 3 → 6, viande 0 → 2 (minimum 48 h) : ' + JSON.stringify(m.bioMixte));
check(m.bioInconnuOui[0] === 2 && m.bioInconnuConfirmer[0] === null && m.bioInconnuConfirmer[4] === true && m.bioUn[0] === 2, 'délai non défini : minimum 48 h seulement si oui ; à confirmer : rien + mention ; 1 j → 2 j');
console.log('OK 1 calcul : ×2 en bio, minimum 48 h (oui / non / à confirmer), hors bio inchangé.');

// ================================================================ 2. options du produit : défauts par catégorie, valeurs choisies
const f = await page.evaluate(() => Object.fromEntries(['Intramicine', 'Ivomec', 'Bravoxin 10', 'Aluspray'].map(n => { const x = ficheProduit(n); return [n, [x.compte, x.min48h, x.compteDefaut, x.min48hDefaut]]; })));
check(JSON.stringify(f.Intramicine) === '["oui","oui",true,true]' && JSON.stringify(f.Ivomec) === '["non","oui",true,true]' && JSON.stringify(f['Bravoxin 10']) === '["non","a_confirmer",true,true]' && JSON.stringify(f.Aluspray) === '["a_confirmer","a_confirmer",true,true]', 'défauts : antibiotique oui/oui, antiparasitaire non/oui, vaccin non/à confirmer, soin de plaie à confirmer/à confirmer : ' + JSON.stringify(f));
check(await page.evaluate(() => JSON.stringify(DB.produitsInfo).indexOf('minimum48hBio') === -1 && window.__saves === 0), 'les défauts ne sont jamais écrits tant que l\'éleveur n\'a pas validé une fiche');
console.log('OK 2 options du produit : défauts de la catégorie, non écrits.');

// ================================================================ 3. écran 1 en bio : maquette (20/09, 7 j / 28 j → reprise 05/10, vente 16/11)
await ouvrir();
await preparer('Traitement', 'Antibiotique', 'Intramicine');
check(await page.evaluate(() => document.getElementById('cs-lait').value === '7' && document.getElementById('cs-viande').value === '28'), 'les champs gardent les délais LÉGAUX (7 / 28), pas les doubles');
check((await dates()).join() === '20-09-2026,05-10-2026,16-11-2026', 'dates bio : dernière 20/09, reprise du lait 05/10, vente dès le 16/11 : ' + (await dates()).join());
const dtxt = await $t('#cs-dates');
check(/20\/09 \+ 14 jours \(7 × 2, bio\), reprise le lendemain/.test(dtxt) && /20\/09 \+ 56 jours \(28 × 2, bio\), vente le lendemain/.test(dtxt) && /Élevage bio : délais légaux ×2/.test(dtxt), 'formules bio et pastille : ' + dtxt);
check(/Délais légaux/.test(await $t('.pc-main')) && /Délai viande \(légal\)/.test(await $t('#cs-fiche')) && /Minimum 48 h bio[^a-z]*Oui/.test(await $t('#cs-fiche')) && /Compte dans les 3 traitements[^a-z]*Oui/.test(await $t('#cs-fiche')), 'libellés « légal », options du produit sur la fiche');
// modification d'un délai dans le formulaire : suit en direct
await page.fill('#cs-lait', '3');
check((await dates())[1] === '27-09-2026', 'lait légal modifié à 3 → 6 j appliqués : reprise 27/09 : ' + (await dates())[1]);
await page.fill('#cs-lait', '7');
console.log('OK 3 écran 1 : maquette exacte (05/10 et 16/11), formules « × 2, bio », pastille, libellés légaux, délais modifiables.');

// ================================================================ 4. légal 0 : minimum 48 h oui / à confirmer / non ; soin de plaie sans produit
await ouvrir();
await preparer('Traitement', 'Antibiotique', 'Zero');
check((await dates()).join() === '20-09-2026,23-09-2026,23-09-2026' && /minimum 48 h bio\), le lendemain/.test(await $t('#cs-dates')) && !/minimum 48 h bio à confirmer/.test(await $t('#cs-dates')), 'antibiotique légal 0 / 0, minimum 48 h = oui (défaut) : 20/09 + 2 j → 23/09 : ' + (await dates()).join());
await ouvrir();
await preparer('Vaccin', null, 'Bravoxin 10');
let dv = await $t('#cs-dates');
check(/aucune attente/.test(dv) && /minimum 48 h bio à confirmer/.test(dv) && /non appliqué/.test(dv) && /minimum 48 h bio à confirmer/i.test(await $t('#cs-alertes')), 'vaccin légal 0, à confirmer (défaut) : non appliqué, mention visible (dates + alertes) : ' + dv);
await page.click('#cs-suivant'); await page.waitForSelector('#cs-table');
check(/minimum 48 h bio à confirmer/.test(await $t('#cs-recap')), 'mention aussi dans le récapitulatif de l\'écran 2');
await page.click('#cs-modifier');
await ouvrir();
await page.click('.cs-type[data-val="Autre"]');
await page.fill('#cs-date', '2026-09-20');
check(/minimum 48 h bio à confirmer/.test(await $t('#cs-dates')) && (await dates()).length === 1, 'soin de plaie sans délai : à confirmer, aucune date de reprise inventée : ' + (await dates()).join());
await page.evaluate(() => { DB.produitsInfo.Zero.minimum48hBio = 'non'; });
await ouvrir(); await preparer('Traitement', 'Antibiotique', 'Zero');
check((await dates()).join() === '20-09-2026' && /aucune attente/.test(await $t('#cs-dates')), 'minimum 48 h = non : aucune attente');
console.log('OK 4 légal 0 : minimum 48 h appliqué si oui, rien si non, mention « à confirmer » visible (dates, alertes, récapitulatif), soin de plaie sans date.');

// ================================================================ 5. enregistrement : délais appliqués et indicateur bio FIGÉS dans le soin
await jeu(true);
await ouvrir(); await preparer('Traitement', 'Antibiotique', 'Intramicine');
await page.click('#cs-suivant'); await page.waitForSelector('#cs-table'); await page.click('#cs-tout'); await page.click('#cs-enregistrer');
await page.waitForSelector('#cs-dernier-lot');
await ouvrir(); await preparer('Vaccin', null, 'Bravoxin 10');
await page.click('#cs-suivant'); await page.waitForSelector('#cs-table'); await page.click('tr[data-eid="' + await page.evaluate(() => E(3, 1)) + '"]'); await page.click('#cs-enregistrer');
await page.waitForSelector('#cs-dernier-lot');
const soins = await page.evaluate(() => DB.brebis[0].sanitaire.map(s => JSON.parse(JSON.stringify(s))));
const sA = soins.find(s => s.produit === 'Intramicine'), sV = soins.find(s => s.produit === 'Bravoxin 10');
check(sA.bio === true && sA.delaiLaitLegalJours === 7 && sA.delaiViandeLegalJours === 28 && sA.delaiLaitJours === 14 && sA.delaiViandeJours === 56 && sA.min48h === 'oui' && !sA.min48hAConfirmer, 'soin Intramicine : bio, légal 7/28, appliqué 14/56 : ' + JSON.stringify(sA));
check(sV.bio === true && sV.delaiLaitJours === 0 && sV.delaiViandeJours === 0 && sV.min48h === 'a_confirmer' && sV.min48hAConfirmer === true, 'soin vaccin : 0/0 appliqués, minimum 48 h à confirmer figé dans le soin : ' + JSON.stringify(sV));
// tableaux : délais appliqués, mentions
await page.waitForSelector('#cs-en-delai');
const enDelai = await $t('#cs-en-delai'), derniers = await $t('#cs-derniers');
check(/05-10-2026/.test(enDelai) && /16-11-2026/.test(enDelai) && /bio/.test(enDelai), 'tableau « En délai » : reprise 05/10, vente 16/11 (délais appliqués) : ' + enDelai.slice(0, 260));
check(/minimum 48 h bio à confirmer/.test(derniers) && /bio/.test(derniers), 'tableau « Derniers soins » : mention « minimum 48 h bio à confirmer » sur le vaccin');
console.log('OK 5 enregistrement : délais appliqués (14 / 56), légaux (7 / 28), indicateur bio et mention 48 h figés dans le soin ; tableaux cohérents.');

// ================================================================ 6. figé : ni le réglage ni la fiche ne changent un soin passé
const avant6 = await page.evaluate(() => JSON.stringify(DB.brebis.map(b => b.sanitaire)));
const datesAvant = await page.evaluate(() => JSON.stringify(soinsEnDelaiCarnet().map(r => [r.soin.produit, r.dates.repriseLait, r.dates.venteDes])));
await page.evaluate(() => { DB.exploitation.elevageBio = false; ecrireFicheProduit('Intramicine', { posologie: '', delaiLait: 1, delaiViande: 2, surOrdonnance: false, reserveVeterinaire: false }); });
const apres6 = await page.evaluate(() => JSON.stringify(DB.brebis.map(b => b.sanitaire)));
const datesApres = await page.evaluate(() => JSON.stringify(soinsEnDelaiCarnet().map(r => [r.soin.produit, r.dates.repriseLait, r.dates.venteDes])));
check(avant6 === apres6 && datesAvant === datesApres, 'réglage bio désactivé + fiche modifiée : soins et dates inchangés');
await page.evaluate(() => { DB.exploitation.elevageBio = false; });
await ouvrir(); await preparer('Traitement', 'Antiparasitaire', 'Ivomec');
await page.click('#cs-suivant'); await page.waitForSelector('#cs-table'); await page.click('tr[data-eid="' + await page.evaluate(() => E(3, 2)) + '"]'); await page.click('#cs-enregistrer');
await page.waitForSelector('#cs-dernier-lot');
const sNon = await page.evaluate(() => JSON.parse(JSON.stringify(DB.brebis[1].sanitaire.find(s => s.produit === 'Ivomec'))));
check(sNon.bio === false && sNon.delaiLaitJours === 3 && sNon.delaiViandeJours === 14 && sNon.delaiLaitLegalJours === 3 && !('min48h' in sNon), 'soin enregistré hors bio : bio false, délais appliqués = légaux (3 / 14) : ' + JSON.stringify(sNon));
console.log('OK 6 figé : changer le réglage ou la fiche ne modifie aucun soin passé ; soin hors bio = bio false, délais légaux.');

// ================================================================ 7. Paramètres : réglage réversible, ne touche aucun soin
await jeu(false);
await page.evaluate(() => { DB.brebis[0].sanitaire.push({ type: 'Traitement', produit: 'Intramicine', date: '2026-09-30', quantiteCc: 8, intervenant: 'Éleveur', dureeJours: 1, delaiLaitJours: 7, delaiViandeJours: 28 }); window.__soinsAvant = JSON.stringify(DB.brebis); parametresTab = 'exploitation'; render('parametres'); });
await page.waitForSelector('#f-exp-bio');
check(await page.evaluate(() => !document.getElementById('f-exp-bio').checked && /délais LÉGAUX/.test(document.getElementById('card-elevage-bio').textContent)), 'carte « Élevage bio » : décochée par défaut, explication');
await page.check('#f-exp-bio');
check(await page.evaluate(() => DB.exploitation.elevageBio === true && window.__saves === 1 && JSON.stringify(DB.brebis) === window.__soinsAvant), 'activation : réglage écrit (1 sauvegarde), aucun soin modifié');
await page.uncheck('#f-exp-bio');
check(await page.evaluate(() => DB.exploitation.elevageBio === false && JSON.stringify(DB.brebis) === window.__soinsAvant), 'désactivation : réversible, aucun soin modifié');
console.log('OK 7 Paramètres : réglage Élevage bio réversible, aucun soin modifié.');

// ================================================================ 8. Produits et délais : colonnes bio, fenêtre de fiche
await jeu(false);
await page.evaluate(() => render('produits-delais')); await page.waitForSelector('#pc-produits-delais');
check(await page.evaluate(() => !document.querySelector('.pd-min48') && !/Minimum 48 h bio/.test(document.getElementById('pc-produits-delais').textContent)), 'hors bio : pas de colonnes bio');
await page.evaluate(() => { DB.exploitation.elevageBio = true; render('produits-delais'); });
check(await page.evaluate(() => document.querySelectorAll('.pd-min48').length === 5 && /Viande \(légal\)/.test(document.getElementById('pc-produits-delais').textContent)), 'en bio : colonnes « Minimum 48 h bio » et « Compte » pour les 5 produits, délais « (légal) »');
const lig = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#pc-produits-delais tr')].filter(r => r.querySelector('.pd-min48')).map(r => [r.querySelector('b').textContent, [r.querySelector('.pd-min48').textContent.replace(/\s+/g, ' ').trim(), r.querySelector('.pd-compte').textContent.replace(/\s+/g, ' ').trim()]])));
check(/Oui \(défaut\)/.test(lig.Intramicine[0]) && /minimum 48 h bio à confirmer/.test(lig['Bravoxin 10'][0]) && /Non \(défaut\)/.test(lig['Bravoxin 10'][1]) && /à confirmer/.test(lig.Aluspray[1]), 'liste : Intramicine oui, vaccin « minimum 48 h bio à confirmer » visible, soin de plaie à confirmer : ' + JSON.stringify(lig));
check(await page.evaluate(() => /Bio à confirmer/.test(document.getElementById('pc-produits-delais').textContent)), 'indicateur « Bio à confirmer »');
await page.click('.pd-modifier[data-nom="' + encodeURIComponent('Bravoxin 10') + '"]');
await page.waitForSelector('#fp-min48');
check(await page.evaluate(() => document.getElementById('fp-min48').value === 'a_confirmer' && document.getElementById('fp-compte').value === 'non'), 'fenêtre de fiche : options bio préremplies avec le défaut de la catégorie');
await page.selectOption('#fp-min48', 'oui'); await page.selectOption('#fp-compte', 'non');
await page.click('#fp-ok');
await page.waitForFunction(() => DB.produitsInfo['Bravoxin 10'].minimum48hBio === 'oui');
check(await page.evaluate(() => DB.produitsInfo['Bravoxin 10'].compteTraitements === 'non' && ficheProduit('Bravoxin 10').min48hDefaut === false), 'options écrites sur validation de la fiche par l\'éleveur');
// hors bio : modifier une fiche ne perd pas les options déjà choisies
await page.evaluate(() => { DB.exploitation.elevageBio = false; });
await page.evaluate(() => ouvrirFicheProduitModal({ nom: 'Bravoxin 10' }));
await page.waitForSelector('#fp-ok');
check(await page.evaluate(() => !document.getElementById('fp-min48')), 'hors bio : pas de sélecteurs bio dans la fenêtre');
await page.fill('#fp-poso', '3 cc'); await page.click('#fp-ok');
await page.waitForFunction(() => DB.produitsInfo['Bravoxin 10'].posologie === '3 cc');
check(await page.evaluate(() => DB.produitsInfo['Bravoxin 10'].minimum48hBio === 'oui' && DB.produitsInfo['Bravoxin 10'].compteTraitements === 'non'), 'hors bio : options bio déjà choisies conservées');
// création d'un produit en bio : le choix de la catégorie propose les défauts
await page.evaluate(() => { DB.exploitation.elevageBio = true; ouvrirFicheProduitModal({ categorieKey: 'antibiotiques' }); });
await page.waitForSelector('#fp-min48');
check(await page.evaluate(() => document.getElementById('fp-min48').value === 'oui' && document.getElementById('fp-compte').value === 'oui'), 'création antibiotique : oui / oui');
await page.selectOption('#fp-cat', 'vaccins');
check(await page.evaluate(() => document.getElementById('fp-min48').value === 'a_confirmer' && document.getElementById('fp-compte').value === 'non'), 'catégorie vaccins : à confirmer / non');
await page.click('#fp-annuler');
console.log('OK 8 Produits et délais : colonnes bio (oui / non / à confirmer, défauts), mention « minimum 48 h bio à confirmer », fenêtre de fiche, options conservées.');

// ================================================================ 9. mobile : « Sous délai d'attente » et fiche brebis en bio
await jeu(false);
await page.evaluate(() => { window.electronAPI.isDesktop = false;
  DB.brebis[0].sanitaire = [{ type: 'Traitement', sousType: 'Antibiotique', produit: 'Intramicine', date: '2026-09-20', quantiteCc: 8, intervenant: 'Éleveur', dureeJours: 1, bio: true, delaiLaitLegalJours: 7, delaiLaitJours: 14, delaiViandeLegalJours: 28, delaiViandeJours: 56 }];   // figé : dernier jour 04/10
  DB.brebis[1].sanitaire = [{ type: 'Traitement', sousType: 'Antibiotique', produit: 'Intramicine', date: '2026-09-25', quantiteCc: 8, intervenant: 'Éleveur' }];   // ancien soin : légal du produit (7) doublé → 14 → 09/10
  DB.brebis[2].sanitaire = [{ type: 'Traitement', sousType: 'Antibiotique', produit: 'Intramicine', date: '2026-09-26', quantiteCc: 8, intervenant: 'Éleveur', dureeJours: 1, bio: false, delaiLaitLegalJours: 7, delaiLaitJours: 7, delaiViandeLegalJours: 28, delaiViandeJours: 28 }];  // figé hors bio : 7 → 03/10 (libre le 04/10)
});
const rowsHors = await page.evaluate(() => sousDelaiBrebisRows().map(r => [numeroVisuel(r.eid), r.finDelai]));
check(JSON.stringify(rowsHors) === JSON.stringify([['00002', '2026-10-02'], ['00003', '2026-10-03']]) || JSON.stringify(rowsHors) === JSON.stringify([['00003', '2026-10-03'], ['00002', '2026-10-02']].sort((a, b) => a[1].localeCompare(b[1]))), 'hors bio : calcul d\'origine (date du soin + 7 j du produit) : ' + JSON.stringify(rowsHors));
await page.evaluate(() => { DB.exploitation.elevageBio = true; });
const rowsBio = await page.evaluate(() => sousDelaiBrebisRows().map(r => [numeroVisuel(r.eid), r.finDelai]));
check(JSON.stringify(rowsBio) === JSON.stringify([['00003', '2026-10-03'], ['00001', '2026-10-04'], ['00002', '2026-10-09']]), 'en bio : figé (00001 : 20/09 + 14 = 04/10), figé hors bio conservé (00003 : 03/10), ancien soin = légal doublé (00002 : 25/09 + 14 = 09/10) : ' + JSON.stringify(rowsBio));
await page.evaluate(() => { ficheBrebisTab = 'sanit'; ficheBrebisTabSheepId = DB.brebis[0].id; render('detail', DB.brebis[0].id); });
check(/délai d'attente lait jusqu'au 04-10-2026/.test(await page.evaluate(() => document.getElementById('app').textContent.replace(/\s+/g, ' '))), 'fiche brebis : « jusqu\'au 04-10-2026 » (délai appliqué figé)');
await page.evaluate(() => { window.electronAPI.isDesktop = true; });
console.log('OK 9 mobile : en bio, délai appliqué figé dans le soin, ancien soin = légal doublé ; hors bio calcul d\'origine.');

// ================================================================ 10. Séléphérol : copie des délais appliqués
await jeu(true);
const sel = await page.evaluate(() => {
  const sans = delaisSelepherolSnapshot();
  DB.produitsInfo['Séléphérol'] = { posologie: '2 cc', delaiAttente: 0, delaiLait: 0, delaiViande: 28, surOrdonnance: false, reserveVeterinaire: false };
  DB.produits.autres.push('Séléphérol');
  const confirmer = delaisSelepherolSnapshot();
  DB.produitsInfo['Séléphérol'].minimum48hBio = 'oui';
  const oui = delaisSelepherolSnapshot();
  DB.exploitation.elevageBio = false;
  const horsBio = delaisSelepherolSnapshot();
  return { sans, confirmer, oui, horsBio };
});
check(JSON.stringify(sel.sans) === '{}', 'sans fiche : rien copié');
check(sel.confirmer.bio === true && sel.confirmer.delaiViandeJours === 56 && sel.confirmer.delaiLaitJours === 0 && sel.confirmer.min48hAConfirmer === true && sel.confirmer.delaiViandeLegalJours === 28, 'bio, lait 0, minimum 48 h à confirmer (défaut « autres ») : lait 0, viande 56, mention : ' + JSON.stringify(sel.confirmer));
check(sel.oui.delaiLaitJours === 2 && sel.oui.delaiViandeJours === 56 && !sel.oui.min48hAConfirmer, 'minimum 48 h = oui : lait 2 j');
check(sel.horsBio.bio === false && sel.horsBio.delaiViandeJours === 28 && sel.horsBio.delaiLaitJours === 0, 'hors bio : légaux');
console.log('OK 10 Séléphérol : délais appliqués copiés sur le soin (bio ×2, minimum 48 h selon sa fiche).');

// ================================================================ 11. l'alerte de vente utilise les délais appliqués
await jeu(true);
const al = await page.evaluate(() => {
  const A = { label: 'n°1', obj: { sanitaire: [{ type: 'Traitement', produit: 'Intramicine', date: '2026-09-20', dureeJours: 1, bio: true, delaiLaitJours: 14, delaiViandeJours: 56 }] } };
  const r = d => alertesVenteDelai([A], 'Vente', d).lignes.length;
  return [r('2026-11-15'), r('2026-11-16')];
});
check(JSON.stringify(al) === '[1,0]', 'alerte de vente : sous délai jusqu\'au 15/11 (56 j appliqués), libre le 16/11 : ' + al);
console.log('OK 11 alerte de vente : délais appliqués figés dans le soin.');
await browser.close();
console.log('\nTOUS LES TESTS « ÉLEVAGE BIO » SONT PASSÉS (jeu synthétique, saveData remplacé, aucune donnée réelle)');
