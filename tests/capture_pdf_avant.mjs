/* Capture de RÉFÉRENCE (code d'AVANT la refonte « PDF harmonisés ») : mots de chaque PDF sur le jeu synthétique -> ref/pdf_avant.json. À ne relancer qu'exprès (OVILOG_MAJ_REF=1) :
   la référence représente le contenu des PDF en noir et blanc, à conserver tel quel après le passage à la charte colorée. */
import { chromium } from 'playwright';
import { writeFileSync, existsSync } from 'fs';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { installerCasPdf } from './lib/jeux_pdf.mjs';
import { jeuRegistre } from './lib/jeu_registre_cl.mjs';
import { lirePdfMots } from './lib/pdf_texte.mjs';
const REF = new URL('./ref/pdf_avant.json', import.meta.url).pathname;
if (existsSync(REF) && process.env.OVILOG_MAJ_REF !== '1') { console.log('Référence déjà présente : OVILOG_MAJ_REF=1 pour la refaire.'); process.exit(0); }
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
await page.evaluate(`window.__jeuRegistre = ${jeuRegistre.toString()}`);
await page.evaluate(installerCasPdf);
const noms = await page.evaluate(() => Object.keys(window.CAS_PDF));
const ref = {};
for (const nom of noms) {
  const b64 = await page.evaluate(async (n) => { const o = await window.CAS_PDF[n](); let s = ''; for (const x of o) s += String.fromCharCode(x); return btoa(s); }, nom);
  const r = lirePdfMots(Buffer.from(b64, 'base64'));
  ref[nom] = { pages: r.pages, mots: r.mots };
  console.log(nom, r.pages + ' page(s)', r.mots.length + ' mots');
}
writeFileSync(REF, JSON.stringify(ref, null, 1));
await browser.close();
