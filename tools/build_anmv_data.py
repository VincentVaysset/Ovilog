#!/usr/bin/env python3
"""
Génère un fichier JSON compact des délais d'attente lait/viande ANMV pour les
ovins, à partir de la base de données publique des médicaments vétérinaires
autorisés en France (data.gouv.fr).

Structure réelle du jeu de données "XML V1" (découverte par exploration) :
  - Fichier principal (amm-vet-fr-v.xml) : ~3200 <medicinal-product>, chacun
    avec une liste <especes><term-esp>CODE</term-esp>...</especes> (espèces
    cibles, par code) et une liste <paragraphes-rcp><para-rcp> de paragraphes
    de texte libre (un par section du résumé des caractéristiques du produit),
    chaque para-rcp ayant un <term-titre>CODE</term-titre> (référence vers le
    dictionnaire des titres de section) et un <contenu> en texte libre.
  - Fichier dictionnaire (amm-vet-fr-d.xml) : dictionnaires code -> libellé
    pour term-esp (espèces), term-titre (titres de section RCP), etc.
  - Le temps d'attente n'est PAS un champ structuré : c'est le texte libre
    de la section "Temps d'attente" (repérée via term-titre) qu'il faut
    analyser pour en extraire les délais lait/viande.

Deux modes :
  --mode explore  : n'écrit rien, affiche la structure des fichiers source
                    en détail (dictionnaires complets + échantillons de
                    paragraphes "temps d'attente" pour des produits ovins).
  --mode build     : fait le vrai travail et écrit le JSON de sortie.
"""
import argparse
import json
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

SHEEP_TERMS = ["ovin", "brebis", "agneau", "belier", "bélier", "agnelle", "mouton"]
WITHDRAWAL_SECTION_TERMS = ["temps d'attente", "temps d attente"]


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
    current_tag = None
    current_map = None
    cur_code = None
    cur_desc = None
    for event, elem in ET.iterparse(path, events=("start", "end")):
        if event == "start":
            depth += 1
            continue
        depth -= 1
        if depth == 1:
            current_tag = elem.tag
            if current_tag == "entry":
                # entries directement au niveau 1 (rares) : on les ignore, pas de contexte de dictionnaire
                elem.clear()
                continue
            result[current_tag] = {}
            for entry in elem.findall("entry"):
                code = entry.findtext("source-code")
                desc = entry.findtext("source-desc")
                if code is not None:
                    result[current_tag][code] = desc
            elem.clear()
    return result


def find_sheep_espece_codes(term_esp_dict):
    codes = {}
    for code, label in term_esp_dict.items():
        if label and any(t in normalize(label) for t in SHEEP_TERMS):
            codes[code] = label
    return codes


def find_withdrawal_titre_codes(term_titre_dict):
    codes = {}
    for code, label in term_titre_dict.items():
        if label and any(t in normalize(label) for t in WITHDRAWAL_SECTION_TERMS):
            codes[code] = label
    return codes


def explore(resources):
    print(f"\nTéléchargement du dictionnaire ({DICT_XML_URL})...")
    http_get(DICT_XML_URL, dest=DICT_XML_PATH)
    dicts = parse_dict_file(DICT_XML_PATH)
    print("Dictionnaires trouvés :", list(dicts.keys()))

    term_esp = dicts.get("term-esp", {})
    print(f"\n=== term-esp : {len(term_esp)} entrées ===")
    sheep_codes = find_sheep_espece_codes(term_esp)
    print(f"Codes espèce correspondant à 'ovin/brebis/agneau/bélier/mouton' ({len(sheep_codes)}) :")
    for code, label in sheep_codes.items():
        print(f"  {code}: {label!r}")

    term_titre = dicts.get("term-titre", {})
    print(f"\n=== term-titre : {len(term_titre)} entrées (titres de section RCP) ===")
    for code, label in term_titre.items():
        print(f"  {code}: {label!r}")
    withdrawal_codes = find_withdrawal_titre_codes(term_titre)
    print(f"\nCode(s) de section 'temps d'attente' trouvé(s) : {withdrawal_codes}")

    print(f"\nTéléchargement du fichier principal ({MAIN_XML_URL})...")
    http_get(MAIN_XML_URL, dest=MAIN_XML_PATH)

    print("\n=== Échantillon de produits ovins avec leur paragraphe 'temps d'attente' ===")
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
        num = elem.findtext("num-amm") or elem.findtext("num")
        especes_labels = [term_esp.get(c, c) for c in espece_codes]
        print(f"\n--- {nom!r} (AMM {num}) — espèces : {especes_labels}")
        for para in elem.findall("./paragraphes-rcp/para-rcp"):
            titre_code = para.findtext("term-titre")
            if titre_code in withdrawal_codes:
                print(f"  [section {titre_code} = {withdrawal_codes[titre_code]!r}]")
                print(f"  contenu: {para.findtext('contenu')!r}")
        elem.clear()
        shown += 1
        if shown >= 15:
            break
    print(f"\n{shown} produit(s) ovin(s) échantillonné(s).")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["explore", "build"], required=True)
    args = parser.parse_args()

    print("Récupération de la liste des ressources du jeu de données (pour info)...")
    try:
        resources = fetch_dataset_resources()
    except Exception as e:
        print(f"(avertissement, non bloquant : {e})")
        resources = []

    if args.mode == "explore":
        explore(resources)
        return

    print("Mode build pas encore finalisé — lance d'abord --mode explore.")
    sys.exit(1)


if __name__ == "__main__":
    main()
