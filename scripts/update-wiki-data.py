import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

BASE = "https://wiki.idledex.com/"
OUT = "data/idledex-data.json"
HEADERS = {"User-Agent": "idleDEX-Calculator-Wiki-Updater/1.1"}

TYPE_NAMES = {
    "normal": "Normal", "fire": "Fogo", "water": "Água", "electric": "Elétrico",
    "grass": "Planta", "ice": "Gelo", "fighting": "Lutador", "poison": "Veneno",
    "ground": "Terra", "flying": "Voador", "psychic": "Psíquico", "bug": "Inseto",
    "rock": "Pedra", "ghost": "Fantasma", "dragon": "Dragão", "dark": "Sombrio",
    "steel": "Aço", "fairy": "Fada", "normal": "Normal"
}


def get(url, timeout=30):
    r = requests.get(url, headers=HEADERS, timeout=timeout)
    r.raise_for_status()
    return r.text


def extract_urls(text):
    """Extract sitemap <loc> URLs without requiring an XML parser."""
    return [u.strip() for u in re.findall(r"<loc[^>]*>(.*?)</loc>", text, flags=re.I | re.S)]


def sitemap_urls():
    candidates = [urljoin(BASE, "sitemap.xml"), urljoin(BASE, "sitemap-0.xml")]
    seen = set()
    species = set()

    def walk(url, depth=0):
        if url in seen or depth > 3:
            return
        seen.add(url)
        text = get(url)
        for loc in extract_urls(text):
            loc = loc.replace("&amp;", "&")
            if "/species/" in loc:
                species.add(loc.rstrip("/"))
            elif "sitemap" in loc:
                walk(loc, depth + 1)

    last_error = None
    for candidate in candidates:
        try:
            walk(candidate)
            if species:
                break
        except Exception as exc:
            last_error = exc

    if not species:
        for candidate in (urljoin(BASE, "species/"), BASE):
            try:
                html = get(candidate)
                soup = BeautifulSoup(html, "html.parser")
                for a in soup.find_all("a", href=True):
                    href = urljoin(candidate, a["href"])
                    if re.search(r"/species/\d+-[^/?#]+/?$", href):
                        species.add(href.rstrip("/"))
                if species:
                    break
            except Exception as exc:
                last_error = exc

    if not species:
        raise RuntimeError(f"Não foi possível localizar as páginas de espécies: {last_error}")
    return sorted(species)


def number(text):
    text = text.replace("%", "").strip().replace(",", ".")
    return float(text)


def parse_range(text):
    nums = [int(x) for x in re.findall(r"\d+", text)]
    if len(nums) >= 2:
        return nums[0], nums[1]
    if len(nums) == 1:
        return nums[0], nums[0]
    return None, None


def parse_types(soup, heading):
    """Read the species' type icons near the species heading, before the stats section."""
    if not heading:
        return []
    types = []
    started = False
    for node in soup.find_all(["h1", "h2", "h3", "img"]):
        if node is heading:
            started = True
            continue
        if not started:
            continue
        if node.name in {"h2", "h3"}:
            text = node.get_text(" ", strip=True).lower()
            if "stats base" in text or "base stats" in text or "evolução" in text or "evolution" in text:
                break
            continue
        raw = " ".join(filter(None, [node.get("alt"), node.get("title"), node.get("src")])).lower()
        for key, label in TYPE_NAMES.items():
            if re.search(rf"(?<![a-z]){re.escape(key)}(?![a-z])", raw):
                if label not in types:
                    types.append(label)
    return types[:2]


def parse_species(url):
    html = get(url)
    soup = BeautifulSoup(html, "html.parser")

    url_match = re.search(r"/species/(\d+)-([^/?#]+)/?$", url)
    if not url_match:
        return None
    sid = int(url_match.group(1))
    slug_name = url_match.group(2).replace("-", " ").strip()

    headings = soup.find_all(["h1", "h2", "h3"])
    name = None
    main_heading = None
    for tag in headings:
        text = tag.get_text(" ", strip=True)
        cleaned = re.sub(r"^#?\s*\d+\s*", "", text).strip()
        if cleaned and not re.fullmatch(r"\d+", text) and cleaned.lower() not in {
            "onde encontrar", "where to find", "stats base", "base stats", "evolução", "evolution"
        }:
            name = cleaned
            main_heading = tag
            break
    name = name or slug_name.title()
    types = parse_types(soup, main_heading)

    maps = []
    heading = None
    for tag in headings:
        txt = tag.get_text(" ", strip=True).lower()
        if "onde encontrar" in txt or "where to find" in txt:
            heading = tag
            break

    table = heading.find_next("table") if heading else None
    if table:
        rows = table.find_all("tr")
        for row in rows[1:]:
            cells = [c.get_text(" ", strip=True) for c in row.find_all(["th", "td"])]
            if len(cells) < 4:
                continue
            map_name = re.sub(r"\s*(Special map|Mapa especial)\s*$", "", cells[0]).strip()
            min_level, max_level = parse_range(cells[1])
            if min_level is None:
                continue
            rarity = cells[2]
            chance_match = re.search(r"[0-9]+(?:[.,][0-9]+)?", cells[3])
            chance = number(chance_match.group(0)) if chance_match else 0
            maps.append({
                "name": map_name,
                "min": min_level,
                "max": max_level,
                "rarity": rarity,
                "chance": chance,
            })

    return {"id": sid, "name": name, "types": types, "maps": maps}


def main():
    urls = sitemap_urls()
    print(f"Encontradas {len(urls)} páginas de espécies no wiki.")

    species = []
    errors = []
    with ThreadPoolExecutor(max_workers=16) as pool:
        futures = {pool.submit(parse_species, u): u for u in urls}
        for i, future in enumerate(as_completed(futures), 1):
            url = futures[future]
            try:
                item = future.result()
                if item:
                    species.append(item)
            except Exception as exc:
                errors.append((url, str(exc)))
            if i % 100 == 0:
                print(f"Processadas {i}/{len(urls)}")

    species.sort(key=lambda p: p["id"])
    maps = {}
    for p in species:
        for m in p["maps"]:
            maps[m["name"]] = m

    mechanics = {
        "collector": {
            "deliveryLimitPerWindow": 4,
            "windowHours": 6,
            "standardRequest": "4 espécies × 3 unidades",
            "rewardsByTrainerLevel": [
                {"minTrainerLevel":1,"silver":6000,"trainerXp":0},
                {"minTrainerLevel":5,"silver":9000,"trainerXp":200},
                {"minTrainerLevel":11,"silver":13000,"trainerXp":600},
                {"minTrainerLevel":20,"silver":18000,"trainerXp":1800},
                {"minTrainerLevel":35,"silver":24000,"trainerXp":4000},
                {"minTrainerLevel":48,"silver":32000,"trainerXp":7000},
                {"minTrainerLevel":60,"silver":42000,"trainerXp":11000},
                {"minTrainerLevel":75,"silver":55000,"trainerXp":16000}
            ],
            "villageSilver": 2500
        },
        "wishingFountain": {
            "silverVictoryBonus": 25,
            "pokemonXpBonus": 50,
            "durationHours": 4
        }
    }

    payload = {
        "version": "V12.2",
        "source": BASE,
        "updated": time.strftime("%Y-%m-%d"),
        "pokemon": species,
        "maps": sorted([
            {"name": m["name"], "minLevel": m["min"], "maxLevel": m["max"]}
            for m in maps.values()
        ], key=lambda x: (x["minLevel"], x["name"])),
        "mechanics": mechanics,
        "crawl": {"speciesPages": len(urls), "validSpecies": len(species), "errors": len(errors)}
    }

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Salvo {len(species)} espécies e {len(maps)} mapas.")
    if errors:
        print(f"Aviso: {len(errors)} páginas falharam; o arquivo foi gerado com as páginas válidas.")


if __name__ == "__main__":
    main()
