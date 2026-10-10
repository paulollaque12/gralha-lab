#!/usr/bin/env python3
"""Monta docs/index.html do laboratorio = dashboard estatico (build_estatico.py) + caixa 'Pergunte aos dados' (tools/ask.js)."""
import os, subprocess, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
subprocess.run([sys.executable, os.path.join(R, "tools", "build_estatico.py"), os.path.join(R, "fonte", "dashboard-gralha-funil.html"),
                "--site", os.path.join(R, "docs", "index.html"), "--enc", os.path.join(R, "docs", "data.enc.json")], check=True)
p = os.path.join(R, "docs", "index.html"); h = open(p, encoding="utf-8").read()
assert h.count("</body>") == 1
import re
nf = os.path.join(R, "tools", "nome.txt")
nome = open(nf, encoding="utf-8").read().strip() if os.path.exists(nf) else "Assistente"
ins = re.search(r'<button role="tab" id="tab-ins".*?</button>', h, re.S).group(0)
svg = re.search(r'<svg class="ai".*?</svg>', ins, re.S).group(0)
tab = '<button role="tab" id="tab-ask" data-tab="ask" aria-selected="false" aria-controls="panel-ask">' + svg + nome + '<span class="beta">BETA</span></button>'
h, n = re.subn(r'(<button role="tab" id="tab-daily".*?</button>)', lambda m: m.group(1) + tab, h, count=1, flags=re.S); assert n == 1
assert h.count('<section id="panel-ins"') == 1
h = h.replace('<section id="panel-ins"', '<section id="panel-ask" role="tabpanel" aria-labelledby="tab-ask" hidden><div id="askroot"></div></section>\n<section id="panel-ins"', 1)
ep = os.path.join(R, "tools", "endpoint.txt")
endpoint = open(ep).read().strip() if os.path.exists(ep) else ""
js = open(os.path.join(R, "tools", "ask.js"), encoding="utf-8").read().replace("__ASK_ENDPOINT__", endpoint).replace("__ASK_NAME__", nome)
h = h.replace("</body>", "<script>\n" + js + "\n</script>\n</body>")
import hashlib
v = hashlib.md5(open(os.path.join(R, "docs", "data.enc.json"), "rb").read()).hexdigest()[:10]
assert h.count('fetch("data.enc.json"') == 1
h = h.replace('fetch("data.enc.json"', 'fetch("data.enc.json?v=' + v + '"')  # evita cubo antigo em cache
open(p, "w", encoding="utf-8").write(h); print("ok", len(h), "v", v)
