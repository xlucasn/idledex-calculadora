import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

BASE = "https://wiki.idledex.com/"
OUT = "data/idledex-data.json"
HEADERS = {"User-Agent": "idleDEX-Calculator-Wiki-Updater/1.0"}


def get(url, timeout=30):
    r = requests.get(url, headers=HEADERS, timeout=timeout)
    r.raise_for_status()
    return r.text


def sitemap_urls():
    candidates = [urljoin(BASE, "sitemap.xml"), urljoin(BASE, "sitemap-0.xml")]
    seen = set()
    species = set()

    def walk(url, depth=0):
        if url in seen or depth > 2:
            return
        seen.add(url)
        text = get(url)
        soup = BeautifulSoup(text, "xml")
        locs = [x.get_text(strip=True) for x in soup.find_all("loc")]
        if not locs:
            return
        for loc in locs:
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
        raise RuntimeError(f"Não foi possível localizar o sitemap de espécies: {last_error}")
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


def parse_species(url):
    html = get(url)
    soup = BeautifulSoup(html, "html.parser")

    h1 = soup.find("h1")
    if not h1:
        return None
    title = h1.get_text(" ", strip=True)
    m = re.search(r"#(\d+)\s*(.*)", title)
    if not m:
        return None
    sid = int(m.group(1))
    name = m.group(2).strip()

    maps = []
    # The wiki renders a table immediately after the "Where to find" heading.
    heading = None
    for tag in soup.find_all(["h2", "h3"]):
        txt = tag.get_text(" ", strip=True).lower()
        if "onde encontrar" in txt or "where to find" in txt:
            heading = tag
            break

    table = None
    if heading:
        table = heading.find_next("table")
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

    return {"id": sid, "name": name, "maps": maps}


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

    # Preserve the verified mechanics already present in the project.
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
        "crawl": {"speciesPages": len(urls), "errors": len(errors)}
    }

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Salvo {len(species)} espécies e {len(maps)} mapas.")
    if errors:
        print(f"Aviso: {len(errors)} páginas falharam; o arquivo foi gerado com as páginas válidas.")


if __name__ == "__main__":
    main()
