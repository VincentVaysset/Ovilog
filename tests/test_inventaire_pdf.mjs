/* Inventaire : PDF à la charte colorée pour chacun des 4 onglets (Brebis, Agnelles, Béliers, Agneaux). Vérifié, texte et rendu relus avec PyMuPDF : titre « Inventaire · <onglet> »,
   campagne, « Situation au <date> », éleveur, « Édité le … » ; 3 tuiles d'effectifs identiques quel que soit l'onglet (Brebis, Agnelles, Béliers actifs, pas d'agneaux) aux couleurs de la maquette
   (fond pastel + liseré gauche : vert, ambre, bleu) ; tableau à en-tête vert #357f4b, lignes alternées #f6f1e4 / blanc, colonnes de l'écran, tri de l'écran ; pied « Ovilog · Inventaire des <onglet> »
   et « Page X/Y » ; grand effectif sur plusieurs pages (en-tête de suite, tableau arrondi sur chaque page) ; liste filtrée = seulement les lignes affichées ; même octets sur PC et mobile
   (par le clic sur « Export PDF » dans les deux modes) ; les autres PDF ne sont pas touchés (test_exports_prod_laitiere). saveOrShareBinaryFile REMPLACÉ. */
import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const dir = mkdtempSync(path.join(tmpdir(), 'ovilog-inv-'));

async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1500, height: 1000 } : { width: 420, height: 1400 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-09T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__saves = 0; DB = migrateData({}); saveData = function () { window.__saves++; return true; };
    DB.campagneDebut = 2026; DB.campagneInitialisee = true; DB.exploitation = Object.assign(DB.exploitation || {}, { nom: 'Ferme du Test' });
    const b = (n, extra) => Object.assign({ id: 'b' + n, eid: '25001629910' + String(10000 + n), statut: 'active', mouvements: [], sanitaire: [], echographies: [], notes: [], agnelages: [], createdAt: 1,
      numeroCourtTravailSieol: String(n), numeroLongTravailSieol: '02' + String(1000 + n) }, extra || {});
    DB.brebis = Array.from({ length: 75 }, (_, i) => b(i + 1, i === 0 ? { agnelages: [{ date: '2026-02-01', lambs: [{ eid: '250016299100099001', sexe: 'Mâle', mouvements: [] }, { eid: '250016299100099002', sexe: 'Femelle', mouvements: [] }] }] } : {}));
    DB.agnelles = [{ id: 'a1', eid: '250016299100010001', statut: 'active' }, { id: 'a2', eid: '250016299100010002', statut: 'active' }, { id: 'a3', eid: '250016299100010003', statut: 'active' }];
    DB.beliers = [{ id: 'be1', eid: '250016299100020001', statut: 'actif', numeroTravailSieol: 'B12', mouvements: [] }, { id: 'be2', eid: '250016299100020002', statut: 'actif', numeroTravailSieol: 'B34', mouvements: [] }];
    window.__avant = JSON.stringify(DB);
    window.__saisies = [];
    saveOrShareBinaryFile = async function (nom, bytes, mime) { let s = ''; for (const x of bytes) s += String.fromCharCode(x); window.__saisies.push({ nom, mime, b64: btoa(s) }); };
    render('inventaire-actifs');
  });
  return page;
}
async function exporter(page, onglet, recherche) {
  await page.evaluate(([o, q]) => { inventaireActifsTab = o; inventaireActifsRecherche = ''; render('inventaire-actifs'); window.__saisies = []; }, [onglet, '']);
  if (recherche) { await page.click('#inventaire-recherche'); await page.keyboard.type(recherche, { delay: 10 }); }
  await page.click('#btn-export-inventaire-pdf');
  await page.waitForFunction(() => window.__saisies.length === 1);
  return page.evaluate(() => window.__saisies[0]);
}
const PY = `import sys, json
import pymupdf as m
d = m.open(sys.argv[1])
def proche(c, h):
    return all(abs(a - b) <= 6 for a, b in zip(c, h))
def hexc(s): return [int(s[i:i+2], 16) for i in (1, 3, 5)]
res = { 'pages': d.page_count, 'texte': [q.get_text() for q in d], 'couleurs': [] }
for p in d:
    pix = p.get_pixmap(dpi=60)
    n = {}
    for nom, h in [('vert_entete', '#357f4b'), ('beige', '#f6f1e4'), ('tuile_vert', '#e3f3e6'), ('tuile_ambre', '#fbeed7'), ('tuile_bleu', '#e6f0fa'), ('lisere_vert', '#2f6e44'), ('lisere_ambre', '#b5701c'), ('lisere_bleu', '#1f5a8a')]:
        c = hexc(h); k = 0
        for y in range(0, pix.height, 2):
            for x in range(0, pix.width, 2):
                if proche(list(pix.pixel(x, y))[:3], c): k += 1
        n[nom] = k
    res['couleurs'].append(n)
print(json.dumps(res))
pix.save(sys.argv[2])`;
function lire(nom, b64) {
  const f = path.join(dir, nom); writeFileSync(f, Buffer.from(b64, 'base64'));
  const r = spawnSync('python3', ['-I', '-c', PY, f, f + '.png'], { encoding: 'utf8' });
  check(r.status === 0, 'PyMuPDF ouvre et rend ' + nom + ' : ' + (r.stderr || '').slice(0, 300));
  return JSON.parse(r.stdout);
}
const norm = s => s.replace(/[  ]/g, ' ').replace(/\s+/g, ' ');

const pc = await ouvrir(true), mob = await ouvrir(false);
const sorties = { PC: {}, mobile: {} };
for (const [nom, page] of [['PC', pc], ['mobile', mob]]) {
  for (const [onglet, titre, pied, entetes] of [
    ['brebis', 'Brebis', 'brebis', ['N° court', 'N° long', 'N° officiel']],
    ['agnelles', 'Agnelles', 'agnelles', ["N° d'ordre", 'N° officiel', 'EID complet']],
    ['beliers', 'Béliers', 'béliers', ['N° de travail SIEOL', 'N° officiel']],
    ['agneaux', 'Agneaux', 'agneaux', ["N° d'ordre", 'N° officiel', 'EID complet']]]) {
    const s = await exporter(page, onglet);
    sorties[nom][onglet] = s;
    check(s.nom === 'inventaire_' + (onglet) + '_2026-10-09.pdf' && s.mime === 'application/pdf', nom + ' : nom de fichier ' + s.nom);
    const pdf = lire(nom + '_' + onglet + '.pdf', s.b64);
    const t = norm(pdf.texte.join(' '));
    for (const x of ['OVILOG', 'Inventaire · ' + titre, 'Campagne 2027', 'Situation au 09-10-2026', 'Ferme du Test', 'Édité le 09-10-2026', 'Brebis actives', 'Agnelles actives', 'Béliers actifs', 'Ovilog · Inventaire des ' + pied, ...entetes])
      check(t.includes(x), nom + ' ' + onglet + ' : contient « ' + x + ' »');
    check(!/Béliers actifs 2 Agneaux (actifs )?\d/.test(t) && !/Agneaux actifs \d+ (Brebis|Agnelles)/.test(t), nom + ' ' + onglet + ' : pas de tuile Agneaux');
    // les 3 tuiles : effectifs actifs, identiques quel que soit l'onglet
    check(/Brebis actives 75 Agnelles actives 3 Béliers actifs 2/.test(t), nom + ' ' + onglet + ' : tuiles 75 / 3 / 2 : ' + t.slice(0, 260));
    // couleurs de la maquette (page 1)
    const k = pdf.couleurs[0];
    check(k.tuile_vert > 40 && k.tuile_ambre > 40 && k.tuile_bleu > 40, nom + ' ' + onglet + ' : fonds pastel des 3 tuiles ' + JSON.stringify(k));
    check(k.lisere_vert > 5 && k.lisere_ambre > 5 && k.lisere_bleu > 5, nom + ' ' + onglet + ' : liseré gauche coloré ' + JSON.stringify(k));
    check(k.vert_entete > 100, nom + ' ' + onglet + ' : en-tête de tableau vert #357f4b ' + JSON.stringify(k));
    if (onglet !== 'brebis') check(k.beige > 0, nom + ' ' + onglet + ' : lignes alternées beige');
    check(new RegExp('Page 1/' + pdf.pages).test(t), nom + ' ' + onglet + ' : « Page 1/' + pdf.pages + ' »');
    check(await page.evaluate(() => window.__saves === 0 && JSON.stringify(DB) === window.__avant), nom + ' : aucune écriture');
    if (onglet === 'agnelles') {
      // tri de l'écran : même ordre que l'écran
      const ecran = await page.evaluate(() => inventaireActifsItems('agnelles').map(it => numeroVisuel(it.eid)));
      const ordrePdf = [...t.matchAll(/\b(1000\d)\b/g)].map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i);
      eq(ordrePdf.slice(0, ecran.length), ecran, nom + ' agnelles : même tri que l\'écran');
    }
  }
  // ---- brebis : 75 lignes sur plusieurs pages, suite, pied
  const pb = lire(nom + '_brebis_pages.pdf', sorties[nom].brebis.b64);
  check(pb.pages >= 2, nom + ' : 75 brebis sur ' + pb.pages + ' pages');
  const tb = pb.texte.map(norm);
  check(tb[1].includes('Inventaire · Brebis (suite)') && tb[1].includes('N° court') && new RegExp('Page 2/' + pb.pages).test(tb[1]), nom + ' : page 2 : suite, en-tête du tableau répété, numérotation');
  check(pb.couleurs[1].vert_entete > 100, nom + ' : en-tête vert répété sur la page 2');
  const tousNumeros = [...norm(pb.texte.join(' ')).matchAll(/\b629910100(\d\d)\b/g)].map(m => m[1]);
  check(new Set(tousNumeros).size === 75 && tousNumeros.length === 75, nom + ' : les 75 brebis sont dans le PDF, une fois chacune (' + tousNumeros.length + ')');
  // ---- liste filtrée : seulement les lignes affichées, mention de la recherche
  const sf = await exporter(page, 'brebis', '0 2 1 0 3');
  const tf = norm(lire(nom + '_filtre.pdf', sf.b64).texte.join(' '));
  check(tf.includes('recherche « 0 2 1 0 3 »') && tf.includes('10 sur 75'), nom + ' : mention de la recherche et du nombre : ' + tf.slice(tf.indexOf('Brebis actifs'), tf.indexOf('Brebis actifs') + 120));
  check(/021030/.test(tf) && /021039/.test(tf) && !/021040/.test(tf) && !/021029/.test(tf), nom + ' : seulement les lignes correspondantes');
  // ---- aucun résultat
  const sv = await exporter(page, 'brebis', 'zzz');
  check(norm(lire(nom + '_vide.pdf', sv.b64).texte.join(' ')).includes('Aucun animal ne correspond à la recherche.'), nom + ' : PDF sans résultat');
  console.log('OK ' + nom + ' : 4 onglets (titre, tuiles, tableau, pied), plusieurs pages, liste filtrée.');
}
// ---- parité PC / mobile
for (const o of ['brebis', 'agnelles', 'beliers', 'agneaux']) {
  check(sorties.PC[o].b64 === sorties.mobile[o].b64, 'PDF « ' + o + ' » identique octet pour octet sur PC et mobile');
  eq(sorties.PC[o].nom, sorties.mobile[o].nom, 'même nom (' + o + ')');
}
console.log('OK parité : mêmes octets sur PC et mobile pour les 4 onglets.');
await browser.close();
console.log('\nTOUS LES TESTS DU PDF INVENTAIRE SONT PASSÉS');
