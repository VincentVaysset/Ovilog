#!/usr/bin/env python3
"""
Génère un fichier JSON compact des délais d'attente lait/viande ANMV pour les
ovins, à partir de la base de données publique des médicaments vétérinaires
autorisés en France (data.gouv.fr, variante "XML V1").

Structure réelle du jeu de données (découverte par exploration, voir
l'historique git de ce fichier pour le détail des runs d'exploration) :
  - Fichier principal (amm-vet-fr-v.xml, ~44 Mo, ~3200 produits) : chaque
    <medicinal-product> a une liste d'espèces cibles par code
    (<especes><term-esp>CODE</term-esp>...) et une liste de paragraphes de
    texte libre (<paragraphes-rcp><para-rcp><term-titre>CODE</term-titre>
    <contenu>texte</contenu>), un paragraphe par section du résumé des
    caractéristiques du produit.
  - Fichier dictionnaire (amm-vet-fr-d.xml) : associe les codes term-esp et
    term-titre à leur libellé humain.
  - Le temps d'attente N'EST PAS un champ structuré : c'est le texte libre
    de la section "Temps d'attente" (4.11 ou 3.12 selon le gabarit RCP,
    4 codes term-titre synonymes selon les époques) qu'il faut analyser.
    Le texte est très hétérogène : unité jours/heures, "zéro" en toutes
    lettres, espaces insécables mélangés à du HTML échappé ('&nbsp;'),
    plusieurs valeurs pour un même libellé selon des sous-conditions
    (ex: durée de tarissement), parfois aucune valeur chiffrée du tout
    quand l'usage est interdit en lactation.

Règle de sécurité (validée) : quand plusieurs délais numériques sont trouvés
pour "Lait" (ou pour "Viande") dans le texte d'un même produit, on retient
le plus long — jamais un délai plus court que la réalité ne doit être
affiché à l'éleveur.

Deux modes :
  --mode explore  : n'écrit rien, affiche la structure des fichiers source.
  --mode build     : télécharge, filtre, et écrit le JSON de sortie.
"""
import argparse
import html
import json
import math
import re
import sys
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET

DATASET_API_URL = (
    "https://www.data.gouv.fr/api/1/datasets/"
    "base-de-donnees-publique-des-medicaments-veterinaires-autorises-en-france-1/"
)
MAIN_XML_URL = "https://pro.anses.fr/RCP/amm-vet-fr-v.xml"
DICT_XML_URL = "https://pro.anses.fr/RCP/amm-vet-fr-d.xml"
MAIN_XML_PATH = "/tmp/anmv_main_v1.xml"
DICT_XML_PATH = "/tmp/anmv_dict_v1.xml"
OUTPUT_PATH = "www_anmv_ovins.json"

# \b avant le terme pour éviter les faux positifs du type "Bovins" (qui
# contient "ovin" en sous-chaîne) ou "provincialis".
SHEEP_TERM_RE = re.compile(r"\b(ovin\w*|brebis|agneau\w*|b[ée]lier\w*|agnelle\w*|mouton\w*)", re.IGNORECASE)
WITHDRAWAL_SECTION_RE = re.compile(r"temps d.?attente", re.IGNORECASE)

LABEL_RE = re.compile(r"\b(Lait|Viande(?:\s+et\s+abats)?)\b", re.IGNORECASE)
VALUE_RE = re.compile(r"\b(z[ée]ro|\d+)\s*(heures?|jours?)\b", re.IGNORECASE)


def normalize(s):
    s = unicodedata.normalize("NFD", str(s))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower().strip()


def http_get(url, dest=None):
    req = urllib.request.Request(url, headers={"User-Agent": "ovilog-anmv-import/1.0"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = resp.read()
    if dest:
        with open(dest, "wb") as f:
            f.write(data)
    return data


def fetch_dataset_resources():
    raw = http_get(DATASET_API_URL)
    return json.loads(raw).get("resources", [])


def parse_dict_file(path):
    """Retourne { tag: {code: label} } pour chaque dictionnaire de
    amm-vet-fr-d.xml (term-esp, term-titre, etc.)."""
    result = {}
    depth = 0
    for event, elem in ET.iterparse(path, events=("start", "end")):
        if event == "start":
            depth += 1
            continue
        depth -= 1
        if depth != 1:
            continue
        tag = elem.tag
        if tag == "entry":
            elem.clear()
            continue
        result[tag] = {}
        for entry in elem.findall("entry"):
            code = entry.findtext("source-code")
            desc = entry.findtext("source-desc")
            if code is not None:
                result[tag][code] = desc
        elem.clear()
    return result


def find_sheep_espece_codes(term_esp_dict):
    codes = {}
    for code, label in term_esp_dict.items():
        if not label:
            continue
        norm = normalize(label)
        if "exception" in norm or "sauf" in norm:
            continue  # ex: "Toutes les espèces ... à l'exception des ovins"
        if SHEEP_TERM_RE.search(label):
            codes[code] = label
    return codes


def find_withdrawal_titre_codes(term_titre_dict):
    return {code: label for code, label in term_titre_dict.items() if label and WITHDRAWAL_SECTION_RE.search(label)}


GLUED_LABEL_RE = re.compile(r"(?<=[a-zà-ÿ])(Lait\b|Viande\b)", re.IGNORECASE)


def clean_text(text):
    text = html.unescape(text or "")
    text = text.replace("\xa0", " ")
    # Le texte source colle parfois deux phrases sans espace ("...joursLait :"),
    # ce qui empêche de repérer "Lait"/"Viande" comme mot à part entière.
    return GLUED_LABEL_RE.sub(r" \1", text)


def extract_delays(text):
    """Extrait (delai_lait_jours, delai_viande_jours) du texte libre d'une
    section 'temps d'attente'. Retourne None pour une catégorie si aucun
    délai chiffré n'est trouvé (ex: usage interdit en lactation, sans durée
    précisée) — on ne devine jamais un chiffre.
    Quand plusieurs valeurs existent pour une même catégorie (sous-conditions,
    plusieurs espèces mentionnées dans le même paragraphe...), on retient la
    plus longue par sécurité."""
    text = clean_text(text)
    parts = LABEL_RE.split(text)
    lait_days, viande_days = [], []
    # parts = [avant, label1, bloc1, label2, bloc2, ...]
    for i in range(1, len(parts), 2):
        label = normalize(parts[i])
        block = parts[i + 1] if i + 1 < len(parts) else ""
        values = []
        for m in VALUE_RE.finditer(block):
            qty_raw, unit = m.group(1), m.group(2).lower()
            qty = 0 if qty_raw[0].lower() == "z" else int(qty_raw)
            days = math.ceil(qty / 24) if unit.startswith("h") else qty
            values.append(days)
        if not values:
            continue
        best = max(values)
        (lait_days if label.startswith("lait") else viande_days).append(best)
    lait = max(lait_days) if lait_days else None
    viande = max(viande_days) if viande_days else None
    return lait, viande


def explore(resources):
    print(f"\nTéléchargement du dictionnaire ({DICT_XML_URL})...")
    http_get(DICT_XML_URL, dest=DICT_XML_PATH)
    dicts = parse_dict_file(DICT_XML_PATH)
    term_esp = dicts.get("term-esp", {})
    sheep_codes = find_sheep_espece_codes(term_esp)
    print(f"Codes espèce ovine retenus ({len(sheep_codes)}) : {sheep_codes}")
    term_titre = dicts.get("term-titre", {})
    withdrawal_codes = find_withdrawal_titre_codes(term_titre)
    print(f"Codes section 'temps d'attente' : {withdrawal_codes}")

    print(f"\nTéléchargement du fichier principal ({MAIN_XML_URL})...")
    http_get(MAIN_XML_URL, dest=MAIN_XML_PATH)

    shown = 0
    depth = 0
    for event, elem in ET.iterparse(MAIN_XML_PATH, events=("start", "end")):
        if event == "start":
            depth += 1
            continue
        depth -= 1
        if depth != 1 or elem.tag != "medicinal-product":
            continue
        espece_codes = {e.text for e in elem.findall("./especes/term-esp") if e.text}
        if not (espece_codes & set(sheep_codes.keys())):
            elem.clear()
            continue
        nom = elem.findtext("nom")
        textes = [p.findtext("contenu") or "" for p in elem.findall("./paragraphes-rcp/para-rcp")
                  if p.findtext("term-titre") in withdrawal_codes]
        lait, viande = extract_delays(" ".join(textes))
        print(f"{nom!r} -> lait={lait} viande={viande} | texte brut: {textes}")
        shown += 1
        elem.clear()
        if shown >= 25:
            break


def build():
    print(f"Téléchargement du dictionnaire ({DICT_XML_URL})...")
    http_get(DICT_XML_URL, dest=DICT_XML_PATH)
    dicts = parse_dict_file(DICT_XML_PATH)
    term_esp = dicts.get("term-esp", {})
    sheep_codes = set(find_sheep_espece_codes(term_esp).keys())
    withdrawal_codes = set(find_withdrawal_titre_codes(dicts.get("term-titre", {})).keys())
    print(f"{len(sheep_codes)} code(s) espèce ovine, {len(withdrawal_codes)} code(s) section temps d'attente.")

    print(f"Téléchargement du fichier principal ({MAIN_XML_URL})...")
    http_get(MAIN_XML_URL, dest=MAIN_XML_PATH)

    by_name = {}
    total_products = 0
    total_ovine = 0
    depth = 0
    for event, elem in ET.iterparse(MAIN_XML_PATH, events=("start", "end")):
        if event == "start":
            depth += 1
            continue
        depth -= 1
        if depth != 1:
            continue
        if elem.tag != "medicinal-product":
            elem.clear()
            continue
        total_products += 1
        espece_codes = {e.text for e in elem.findall("./especes/term-esp") if e.text}
        if not (espece_codes & sheep_codes):
            elem.clear()
            continue
        total_ovine += 1
        nom = (elem.findtext("nom") or "").strip()
        textes = [p.findtext("contenu") or "" for p in elem.findall("./paragraphes-rcp/para-rcp")
                  if p.findtext("term-titre") in withdrawal_codes]
        lait, viande = extract_delays(" ".join(textes))
        elem.clear()
        if not nom or (lait is None and viande is None):
            continue
        key = normalize(nom)
        existing = by_name.get(key)
        if existing:
            existing_lait, existing_viande = existing["l"], existing["v"]
            lait = max([v for v in (lait, existing_lait) if v is not None], default=None)
            viande = max([v for v in (viande, existing_viande) if v is not None], default=None)
        by_name[key] = {"n": nom, "l": lait, "v": viande}

    entries = sorted(by_name.values(), key=lambda e: e["n"])
    print(f"{total_products} produit(s) au total, {total_ovine} ciblant une espèce ovine, "
          f"{len(entries)} avec un délai lait et/ou viande exploitable.")

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, separators=(",", ":"))
    import os
    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"Écrit {OUTPUT_PATH} ({size_kb:.1f} Ko, {len(entries)} produits).")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["explore", "build"], required=True)
    args = parser.parse_args()

    if args.mode == "explore":
        print("Récupération de la liste des ressources du jeu de données (pour info)...")
        try:
            resources = fetch_dataset_resources()
        except Exception as e:
            print(f"(avertissement, non bloquant : {e})")
            resources = []
        explore(resources)
        return

    build()


if __name__ == "__main__":
    main()
