#!/usr/bin/env python3
"""Fügt die Quelldateien zu einer einzigen HTML-Seite zusammen.

dist/vorschau.html  – Seite für die Claude-Vorschau (ohne <html>/<head>, die ergänzt die Vorschau)
dist/web/index.html – vollständige Seite für GitHub Pages (mit App-Symbol und Home-Bildschirm-Angaben)
"""
import json, os, pathlib

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / 'src'
DIST = ROOT / 'dist'

def read(name):
    return (SRC / name).read_text(encoding='utf-8')

physio = json.loads(read('physio.json'))
physio_js = json.dumps(physio, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')

FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=Lexend:wght@400;600;700&display=swap">'
SCRIPTS = ''.join('<script>\n' + read(n) + '\n</script>\n' for n in ['engine.js', 'store.js', 'world.js', 'game.js', 'app.js', 'training.js', 'parents.js'])
BODY = (
    '<div id="app"></div>\n<div id="overlays"></div>\n<div id="toasts"></div>\n'
    '<script>window.PHYSIO = ' + physio_js + ';</script>\n' + SCRIPTS
)
CSS = '<style>\n' + read('styles.css') + '\n</style>\n'

DIST.mkdir(exist_ok=True)
(DIST / 'vorschau.html').write_text(
    '<title>Trocken-Quest</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n' + FONTS + '\n' + CSS + BODY,
    encoding='utf-8')

web = DIST / 'web'
web.mkdir(exist_ok=True)
head = (
    '<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
    '<title>Trocken-Quest</title>\n'
    '<meta name="theme-color" content="#161925">\n'
    '<meta name="apple-mobile-web-app-capable" content="yes">\n'
    '<meta name="mobile-web-app-capable" content="yes">\n'
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
    '<meta name="apple-mobile-web-app-title" content="Trocken-Quest">\n'
    '<link rel="manifest" href="manifest.webmanifest">\n'
    '<link rel="apple-touch-icon" href="icon-180.png">\n'
    '<link rel="icon" href="icon-192.png">\n'
    + FONTS + '\n' + CSS + '</head>\n<body>\n'
)
# Öffentliche Angaben zum Online-Konto (Projekt-Adresse und öffentlicher Schlüssel, keine Geheimnisse)
cfg = json.loads((ROOT / 'config.json').read_text(encoding='utf-8')) if (ROOT / 'config.json').exists() else {}
CFG = '<script>window.TQ_CONFIG = ' + json.dumps({k: cfg[k] for k in ('supabaseUrl', 'supabaseKey') if k in cfg}) + ';</script>\n' if cfg else ''
(web / 'index.html').write_text(head + CFG + BODY + '</body>\n</html>\n', encoding='utf-8')
# Für Tests: dieselbe Seite ohne Online-Konto (startet in der Demo)
(DIST / 'demo.html').write_text(head.replace('href="manifest', 'href="web/manifest') + BODY + '</body>\n</html>\n', encoding='utf-8')
import hashlib, time
ver = hashlib.sha1((head + CFG + BODY).encode('utf-8')).hexdigest()[:10]
(web / 'sw.js').write_text((ROOT / 'src' / 'sw.js').read_text(encoding='utf-8').replace('__VERSION__', ver), encoding='utf-8')
(web / 'manifest.webmanifest').write_text(json.dumps({
    'name': 'Trocken-Quest', 'short_name': 'Trocken-Quest', 'lang': 'de',
    'start_url': './', 'scope': './', 'display': 'standalone',
    'background_color': '#161925', 'theme_color': '#161925',
    'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
              {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png'}]
}, ensure_ascii=False, indent=2), encoding='utf-8')

for f in ['vorschau.html', 'web/index.html']:
    print(f, round((DIST / f).stat().st_size / 1024), 'KB')
