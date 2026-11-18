# Farbwelten für Couple Journal: Werte + Kontrastprüfung (WCAG/Apple: Text 4,5:1, Grafik 3:1).
# Farbwelten für Couple Journal: Definition, Kontrastprüfung, CSS-Erzeugung.
import sys, json

def hex2rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
def lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
def lum(h):
    r, g, b = hex2rgb(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
def contrast(a, b):
    la, lb = lum(a), lum(b); hi, lo = max(la, lb), min(la, lb); return (hi + 0.05) / (lo + 0.05)
def rgb_str(h): return ', '.join(str(x) for x in hex2rgb(h))

# Gemeinsame neutrale Werte (werden je Palette ergänzt/überschrieben)
NEUTRAL_LIGHT = dict(fill='rgba(20, 20, 30, 0.06)', fill2='rgba(20, 20, 30, 0.1)', fill3='rgba(20, 20, 30, 0.2)', separator='rgba(20, 20, 30, 0.1)', card_border='rgba(20, 20, 30, 0.07)')
NEUTRAL_DARK = dict(fill='rgba(255, 255, 255, 0.07)', fill2='rgba(255, 255, 255, 0.12)', fill3='rgba(255, 255, 255, 0.22)', separator='rgba(255, 255, 255, 0.09)', card_border='rgba(255, 255, 255, 0.07)')

P = {
 'night': {
  'name': 'Nachtblau & Gold',
  'light': dict(bg='#F2F4F9', elev='#FFFFFF', elev2='#F7F8FC', sheet='#F2F4F9', bar='rgba(255, 255, 255, 0.8)', text='#0E1526',
                brand='#E2A93B', accent='#E2A93B', accent_strong='#D0962A', accent_on='#14213D', ink='#1F3B8A', primary='#14213D', primary_fg='#FFFFFF',
                heart='#B97C16', chart='#D99A2B', em_color='#0E1526', em_bg='linear-gradient(transparent 60%, rgba(226, 169, 59, 0.55) 60%, rgba(226, 169, 59, 0.55) 92%, transparent 92%)',
                hero_bg='#14213D', hero_num='#F0B44C', mark_bg='#14213D', mark_fg='#F0B44C', pill_bg='#F0B44C', pill_fg='#14213D',
                accent2='#B97C16', ok='#22814A', ok_on='#FFFFFF', purple='#6D5BD0', blue='#2F5FD0',
                g_ocean='#E4E9F4', g_ocean2='#D3DAEA', g_land='#BCC5D8', g_visited='#E2A93B', g_arc='#14213D', g_marker='#C98A1E', g_marker_text='#FFFFFF', g_home='#14213D', g_border='rgba(255, 255, 255, 0.9)', g_grid='rgba(20, 33, 61, 0.06)'),
  'dark': dict(bg='#070B17', elev='#111829', elev2='#182036', sheet='#0D1322', bar='rgba(17, 24, 41, 0.76)', text='#F1F3F9',
               brand='#F0B44C', accent='#F0B44C', accent_strong='#F7C365', accent_on='#0B1226', ink='#F0B44C', primary='#F0B44C', primary_fg='#0B1226',
               heart='#F0B44C', chart='#F0B44C', em_color='#F0B44C', em_bg='none',
               hero_bg='#0F1A36', hero_num='#F0B44C', mark_bg='#0F1A36', mark_fg='#F0B44C', pill_bg='#F0B44C', pill_fg='#0B1226',
               accent2='#F0B44C', ok='#3CCB7F', ok_on='#062012', purple='#A39AF5', blue='#6EA8FF',
               g_ocean='#11203F', g_ocean2='#070C1A', g_land='#27324F', g_visited='#F0B44C', g_arc='#F0B44C', g_marker='#F0B44C', g_marker_text='#0B1226', g_home='#6EA8FF', g_border='rgba(0, 0, 0, 0.55)', g_grid='rgba(255, 255, 255, 0.05)'),
 },
 'ocean': {
  'name': 'Petrol & Koralle',
  'light': dict(bg='#EFF5F4', elev='#FFFFFF', elev2='#F6FAF9', sheet='#EFF5F4', bar='rgba(255, 255, 255, 0.8)', text='#0A1F1D',
                brand='#14B8A6', accent='#14B8A6', accent_strong='#0D9488', accent_on='#042F2E', ink='#0F766E', primary='#0F766E', primary_fg='#FFFFFF',
                heart='#E5523F', chart='#14B8A6', em_color='#0A1F1D', em_bg='linear-gradient(transparent 60%, rgba(45, 212, 191, 0.5) 60%, rgba(45, 212, 191, 0.5) 92%, transparent 92%)',
                hero_bg='#0B3B37', hero_num='#5EEAD4', mark_bg='#0B3B37', mark_fg='#5EEAD4', pill_bg='#FF7A66', pill_fg='#2A0A06',
                accent2='#E5523F', ok='#15803D', ok_on='#FFFFFF', purple='#7C3AED', blue='#2563EB',
                g_ocean='#DCEFEC', g_ocean2='#C6E2DE', g_land='#B3CBC7', g_visited='#14B8A6', g_arc='#0F766E', g_marker='#E5523F', g_marker_text='#FFFFFF', g_home='#0F766E', g_border='rgba(255, 255, 255, 0.9)', g_grid='rgba(10, 31, 29, 0.06)'),
  'dark': dict(bg='#051110', elev='#0D1D1B', elev2='#132725', sheet='#091716', bar='rgba(13, 29, 27, 0.76)', text='#ECF7F5',
               brand='#2DD4BF', accent='#2DD4BF', accent_strong='#5EEAD4', accent_on='#042F2E', ink='#2DD4BF', primary='#2DD4BF', primary_fg='#042F2E',
               heart='#FF7A66', chart='#2DD4BF', em_color='#2DD4BF', em_bg='none',
               hero_bg='#0A2A27', hero_num='#5EEAD4', mark_bg='#0A2A27', mark_fg='#5EEAD4', pill_bg='#FF7A66', pill_fg='#2A0A06',
               accent2='#FF7A66', ok='#4ADE80', ok_on='#052E16', purple='#A78BFA', blue='#60A5FA',
               g_ocean='#0C2826', g_ocean2='#041110', g_land='#1F3B38', g_visited='#2DD4BF', g_arc='#2DD4BF', g_marker='#FF7A66', g_marker_text='#2A0A06', g_home='#5EEAD4', g_border='rgba(0, 0, 0, 0.55)', g_grid='rgba(255, 255, 255, 0.05)'),
 },
 'indigo': {
  'name': 'Indigo',
  'light': dict(bg='#F2F2F7', elev='#FFFFFF', elev2='#F7F7FA', sheet='#F2F2F7', bar='rgba(249, 249, 251, 0.82)', text='#111114',
                brand='#5856D6', accent='#5856D6', accent_strong='#4644C2', accent_on='#FFFFFF', ink='#5856D6', primary='#5856D6', primary_fg='#FFFFFF',
                heart='#E5342A', chart='#5856D6', em_color='#5856D6', em_bg='none',
                hero_bg='#3B39B3', hero_num='#FFFFFF', mark_bg='#5856D6', mark_fg='#FFFFFF', pill_bg='#FFFFFF', pill_fg='#3634A3',
                accent2='#C2410C', ok='#1E7B34', ok_on='#FFFFFF', purple='#8E44AD', blue='#007AFF',
                g_ocean='#DFE3F2', g_ocean2='#CBD1E6', g_land='#B7BED3', g_visited='#7B79E8', g_arc='#5856D6', g_marker='#E5342A', g_marker_text='#FFFFFF', g_home='#5856D6', g_border='rgba(255, 255, 255, 0.9)', g_grid='rgba(60, 60, 90, 0.08)'),
  'dark': dict(bg='#000000', elev='#1C1C1E', elev2='#2C2C2E', sheet='#161618', bar='rgba(28, 28, 30, 0.78)', text='#FFFFFF',
               brand='#8E8CFF', accent='#5E5CE6', accent_strong='#7D7AFF', accent_on='#FFFFFF', ink='#9C9AFF', primary='#5E5CE6', primary_fg='#FFFFFF',
               heart='#FF453A', chart='#7D7AFF', em_color='#9C9AFF', em_bg='none',
               hero_bg='#24236B', hero_num='#FFFFFF', mark_bg='#5E5CE6', mark_fg='#FFFFFF', pill_bg='#FFFFFF', pill_fg='#2A2880',
               accent2='#FF9F0A', ok='#30D158', ok_on='#002A0F', purple='#BF5AF2', blue='#0A84FF',
               g_ocean='#1C1D33', g_ocean2='#0E0F1C', g_land='#34364C', g_visited='#5E5CE6', g_arc='#9C9AFF', g_marker='#FF453A', g_marker_text='#FFFFFF', g_home='#9C9AFF', g_border='rgba(0, 0, 0, 0.55)', g_grid='rgba(255, 255, 255, 0.05)'),
 },
 'polaroid': {
  'name': 'Polaroid',
  'light': dict(bg='#F1F1F1', elev='#FFFFFF', elev2='#F7F7F7', sheet='#F1F1F1', bar='rgba(255, 255, 255, 0.82)', text='#111111',
                brand='#E94B3C', accent='#111111', accent_strong='#000000', accent_on='#FFFFFF', ink='#111111', primary='#111111', primary_fg='#FFFFFF',
                heart='#E2402F', chart='#2D8CD1', em_color='#111111', em_bg='linear-gradient(90deg, #E94B3C 0 20%, #F7943E 20% 40%, #FCCB3F 40% 60%, #4FB06D 60% 80%, #2D8CD1 80%) bottom / 100% 0.14em no-repeat',
                hero_bg='#111111', hero_num='#FFFFFF', mark_bg='#111111', mark_fg='#FFFFFF', pill_bg='#FFFFFF', pill_fg='#111111',
                accent2='#D9722A', ok='#26803F', ok_on='#FFFFFF', purple='#8E44AD', blue='#2D8CD1',
                g_ocean='#E8E8E8', g_ocean2='#D8D8D8', g_land='#C2C2C2', g_visited='#2D8CD1', g_arc='#111111', g_marker='#E2402F', g_marker_text='#FFFFFF', g_home='#111111', g_border='rgba(255, 255, 255, 0.9)', g_grid='rgba(0, 0, 0, 0.05)'),
  'dark': dict(bg='#000000', elev='#161616', elev2='#222222', sheet='#121212', bar='rgba(22, 22, 22, 0.78)', text='#F5F5F5',
               brand='#FF5A4D', accent='#F5F5F5', accent_strong='#FFFFFF', accent_on='#111111', ink='#F5F5F5', primary='#F5F5F5', primary_fg='#111111',
               heart='#FF5A4D', chart='#4EA8E8', em_color='#F5F5F5', em_bg='linear-gradient(90deg, #E94B3C 0 20%, #F7943E 20% 40%, #FCCB3F 40% 60%, #4FB06D 60% 80%, #2D8CD1 80%) bottom / 100% 0.14em no-repeat',
               hero_bg='#161616', hero_num='#FFFFFF', mark_bg='#161616', mark_fg='#FFFFFF', pill_bg='#FFFFFF', pill_fg='#111111',
               accent2='#F7943E', ok='#4FB06D', ok_on='#04190B', purple='#B07CD8', blue='#4EA8E8',
               g_ocean='#1A1A1A', g_ocean2='#0A0A0A', g_land='#333333', g_visited='#4EA8E8', g_arc='#F5F5F5', g_marker='#FF5A4D', g_marker_text='#FFFFFF', g_home='#F5F5F5', g_border='rgba(0, 0, 0, 0.6)', g_grid='rgba(255, 255, 255, 0.05)'),
  'cats_light': dict(date='#E94B3C', activity='#3E9B5C', food='#E07B26', recipe='#D4A20F', trip='#2D8CD1', gift='#8E44AD', movie='#D63F8C', milestone='#111111'),
  'cats_dark': dict(date='#FF6B5E', activity='#5CC27A', food='#F7943E', recipe='#FCCB3F', trip='#4EA8E8', gift='#B07CD8', movie='#F472B6', milestone='#F5F5F5'),
  'stripe': 'linear-gradient(90deg, #E94B3C 0 20%, #F7943E 20% 40%, #FCCB3F 40% 60%, #4FB06D 60% 80%, #2D8CD1 80%)',
 },
}

def check():
    bad = 0
    for key, pal in P.items():
        for mode in ('light', 'dark'):
            v = pal[mode]
            pairs = [
                ('Text/Fläche', v['text'], v['elev'], 4.5), ('Text/Hintergrund', v['text'], v['bg'], 4.5),
                ('Link/Fläche', v['ink'], v['elev'], 4.5), ('Link/Hintergrund', v['ink'], v['bg'], 4.5),
                ('Knopf-Text/Knopf', v['primary_fg'], v['primary'], 4.5), ('Text auf Akzent', v['accent_on'], v['accent'], 4.5),
                ('Herz/Fläche', v['heart'], v['elev'], 3.0), ('OK-Text/OK', v['ok_on'], v['ok'], 4.5),
                ('Zahl/Zähler-Kachel', v['hero_num'], v['hero_bg'], 3.0), ('Pille', v['pill_fg'], v['pill_bg'], 4.5),
                ('Akzent2/Fläche', v['accent2'], v['elev'], 3.0),
            ]
            for label, fg, bg, need in pairs:
                c = contrast(fg, bg)
                flag = 'OK ' if c >= need else 'LOW'
                if c < need: bad += 1
                if c < need or '-v' in sys.argv: print(f'{flag} {key:8} {mode:5} {label:20} {fg} auf {bg}: {c:.2f}:1 (min {need})')
    print('Probleme:', bad)

if __name__ == '__main__':
    check()
