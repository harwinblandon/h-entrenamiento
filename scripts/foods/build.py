"""
Genera public/data/foods.json a partir de USDA FoodData Central SR Legacy (dominio público).

Uso: python scripts/foods/build.py <carpeta con food.csv, food_nutrient.csv y food_portion.csv>

Salida:
- foods: alimentos curados con nombre colombiano, valores por 100 g crudo y/o cocido y medidas caseras.
- recipes: preparaciones típicas estimadas a partir de sus ingredientes.
- usda: el resto de la base (en inglés) para buscar lo que no esté curado.
"""
import csv
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from curated import EXTRA, FOODS, RECIPES  # noqa: E402

SR = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'data', 'foods.json')
NUTRIENTS = {'1008': 'kcal', '1003': 'p', '1004': 'f', '1005': 'c', '1079': 'fib'}
# Categorías del USDA que no aportan a un registro de comidas (alimentos infantiles, comidas de restaurantes de EE. UU.).
SKIP_CATEGORIES = {'3', '21', '22', '25', '36'}


def load():
    foods = {}
    with open(os.path.join(SR, 'food.csv'), encoding='utf-8') as fh:
        for row in csv.DictReader(fh):
            foods[row['fdc_id']] = {'id': int(row['fdc_id']), 'desc': row['description'], 'cat': row['food_category_id']}
    with open(os.path.join(SR, 'food_nutrient.csv'), encoding='utf-8') as fh:
        for row in csv.DictReader(fh):
            key = NUTRIENTS.get(row['nutrient_id'])
            if key and row['fdc_id'] in foods:
                foods[row['fdc_id']][key] = float(row['amount'])
    return foods


def macros(f):
    return [round(f.get('kcal', 0)), round(f.get('p', 0), 1), round(f.get('f', 0), 1), round(f.get('c', 0), 1), round(f.get('fib', 0), 1)]


usda = load()
ordered = sorted(usda.values(), key=lambda f: f['desc'])
missing = []
used = set()


def find(pattern, key):
    if pattern is None:
        return None
    if isinstance(pattern, tuple):
        kcal, p, f, c, fib = pattern
        return {'id': 0, 'kcal': kcal, 'p': p, 'f': f, 'c': c, 'fib': fib}
    rx = re.compile(pattern)
    for f in ordered:
        if rx.search(f['desc']) and 'kcal' in f:
            used.add(f['id'])
            return f
    missing.append((key, pattern))
    return None


curated = []
by_key = {}
for key, name, aliases, group, raw_pat, cooked_pat, units, cook_fat in FOODS + EXTRA:
    raw, cooked = find(raw_pat, key), find(cooked_pat, key)
    if not raw and not cooked:
        continue
    entry = {'k': key, 'n': name, 'a': aliases, 'g': group}
    if raw:
        entry['r'] = macros(raw) + [raw['id']]
    if cooked:
        entry['c'] = macros(cooked) + [cooked['id']]
    if units:
        entry['u'] = [[label, {'raw': 'r', 'cooked': 'c', 'any': 'a'}[state], grams] for label, state, grams in units]
    if cook_fat:
        entry['fat'] = 1
    curated.append(entry)
    by_key[key] = entry


def per100(state, key):
    e = by_key[key]
    vals = e.get('r' if state == 'raw' else 'c') or e.get('c') or e.get('r')
    return vals[:5]


recipes = []
for key, name, aliases, ingredients, final_g, units in RECIPES:
    total = [0.0] * 5
    for ing_key, state, grams in ingredients:
        if ing_key not in by_key:
            if not any(r[0] == ing_key for r in RECIPES):
                missing.append((key, ing_key))
                continue
            vals = next(r for r in recipes if r['k'] == ing_key)['c'][:5]
        else:
            vals = per100(state, ing_key)
        for i in range(5):
            total[i] += vals[i] * grams / 100
    per = [round(total[0] * 100 / final_g)] + [round(v * 100 / final_g, 1) for v in total[1:]]
    entry = {'k': key, 'n': name, 'a': aliases, 'g': 'Preparaciones', 'c': per + [0], 'u': [[l, 'c', g] for l, g in units]}
    entry['ing'] = [[k, s[0], g] for k, s, g in ingredients]
    entry['yield'] = final_g
    recipes.append(entry)
    by_key[key] = entry

rest = [[f['id'], f['desc']] + macros(f) for f in ordered if f['id'] not in used and 'kcal' in f and f['cat'] not in SKIP_CATEGORIES]

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as fh:
    json.dump({'source': 'USDA FoodData Central, SR Legacy (abril 2018)', 'foods': curated, 'recipes': recipes, 'usda': rest},
              fh, ensure_ascii=False, separators=(',', ':'))

print(f'Curados: {len(curated)}  Recetas: {len(recipes)}  USDA: {len(rest)}  Tamaño: {os.path.getsize(OUT) // 1024} KB')
for key, pat in missing:
    print('SIN COINCIDENCIA', key, pat)
