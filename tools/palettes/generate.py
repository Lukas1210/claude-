# Erzeugt app/css/palettes.css aus palettes.py und prüft vorher die Kontraste.
# Aufruf: python3 tools/palettes/generate.py
import sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from palettes import P, NEUTRAL_LIGHT, NEUTRAL_DARK, rgb_str, hex2rgb, check
check()

def rgba(h, a):
    return f'rgba({rgb_str(h)}, {a})'

def block(v, mode, pal):
    n = NEUTRAL_LIGHT if mode == 'light' else NEUTRAL_DARK
    br = v['brand']
    out = {
        '--bg': v['bg'], '--bg-elev': v['elev'], '--bg-elev2': v['elev2'], '--sheet-bg': v['sheet'], '--bar-bg': v['bar'],
        '--fill': n['fill'], '--fill2': n['fill2'], '--fill3': n['fill3'], '--separator': n['separator'], '--card-border': n['card_border'],
        '--seg-active': '#FFFFFF' if mode == 'light' else 'color-mix(in srgb, var(--bg-elev2) 78%, #ffffff)',
        '--text': v['text'], '--text2': rgba(v['text'], 0.62 if mode == 'light' else 0.64), '--text3': rgba(v['text'], 0.4),
        '--brand': br, '--brand-rgb': rgb_str(br), '--neon': br,
        '--accent': v['accent'], '--accent-strong': v['accent_strong'], '--accent-soft': rgba(v['accent'], 0.14 if mode == 'light' else 0.16),
        '--accent-on': v['accent_on'], '--accent-ink': v['ink'], '--primary-bg': v['primary'], '--primary-fg': v['primary_fg'],
        '--heart': v['heart'], '--chart': v['chart'], '--em-color': v['em_color'], '--em-bg': v['em_bg'],
        '--glow': 'none' if mode == 'light' else f'0 0 0 1px {rgba(br, 0.22)}, 0 10px 36px -10px {rgba(br, 0.45)}',
        '--hero-glow': f'radial-gradient(120% 70% at 85% -10%, {rgba(br, 0.2 if mode == "light" else 0.14)}, transparent 60%)',
        '--hero-bg': v['hero_bg'], '--hero-num': v['hero_num'], '--hero-text': '#FFFFFF', '--hero-sub': 'rgba(255, 255, 255, 0.66)',
        '--hero-gradient': 'none' if pal.get('stripe') else f'radial-gradient(120% 90% at 100% 0%, {rgba(v["hero_num"], 0.28)}, transparent 55%), radial-gradient(80% 60% at 0% 100%, {rgba(v["hero_num"], 0.1)}, transparent 60%)',
        '--hero-stripe': pal.get('stripe', 'none'),
        '--mark-bg': v['mark_bg'], '--mark-fg': v['mark_fg'], '--pill-bg': v['pill_bg'], '--pill-fg': v['pill_fg'],
        '--accent2': v['accent2'], '--accent2-soft': rgba(v['accent2'], 0.14),
        '--purple': v['purple'], '--purple-soft': rgba(v['purple'], 0.14), '--blue': v['blue'],
        '--ok': v['ok'], '--ok-on': v['ok_on'],
        '--globe-ocean': v['g_ocean'], '--globe-ocean2': v['g_ocean2'], '--globe-land': v['g_land'], '--globe-border': v['g_border'], '--globe-grid': v['g_grid'],
        '--globe-glow': rgba(br, 0.16), '--globe-visited': v['g_visited'], '--globe-arc': v['g_arc'], '--globe-marker': v['g_marker'],
        '--globe-marker-text': v['g_marker_text'], '--globe-home': v['g_home'],
        '--env-bg': f'color-mix(in srgb, {v["accent"]} 12%, {v["elev"]})', '--env-flap': f'color-mix(in srgb, {v["accent"]} 22%, {v["elev"]})',
        '--env-text': v['text'], '--paper': v['elev'],
    }
    cats = pal.get('cats_' + mode)
    if cats:
        for k, c in cats.items(): out[f'--c-{k}'] = c
    out['color-scheme'] = mode
    return out

def css_block(sel, d, indent=''):
    lines = [f'{indent}{sel} {{'] + [f'{indent}  {k}: {val};' for k, val in d.items()] + [f'{indent}}}']
    return '\n'.join(lines)

parts = ['/* Farbwelten – erzeugt mit tools/palettes/generate.py (nicht von Hand ändern). Ohne data-palette gilt Neon aus app.css. */']
for key, pal in P.items():
    parts.append(f'\n/* {pal["name"]} */')
    parts.append(css_block(f':root[data-palette="{key}"]', block(pal['light'], 'light', pal)))
    parts.append('@media (prefers-color-scheme: dark) {\n' + css_block(f':root[data-palette="{key}"]:not([data-theme="light"])', block(pal['dark'], 'dark', pal), '  ') + '\n}')
    parts.append(css_block(f':root[data-palette="{key}"][data-theme="dark"]', block(pal['dark'], 'dark', pal)))
open(__import__('os').path.join(__import__('os').path.dirname(__file__), '..', '..', 'app', 'css', 'palettes.css'), 'w').write('\n'.join(parts) + '\n')

# Metadaten für JS (Name, Vorschaufarben, Statusleisten-Farbe)
import json
meta = {k: {'name': p['name'], 'light': {'bg': p['light']['bg'], 'swatch': [p['light']['primary'], p['light']['brand'], p['light']['heart']]}, 'dark': {'bg': p['dark']['bg'], 'swatch': [p['dark']['primary'], p['dark']['brand'], p['dark']['heart']]}} for k, p in P.items()}
print(json.dumps(meta, ensure_ascii=False))
