#!/usr/bin/env python3
"""Monta docs/index.html do laboratorio = dashboard estatico (build_estatico.py) + caixa 'Pergunte aos dados' (tools/ask.js)."""
import os, subprocess, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
subprocess.run([sys.executable, os.path.join(R, "tools", "build_estatico.py"), os.path.join(R, "fonte", "dashboard-gralha-funil.html"),
                "--site", os.path.join(R, "docs", "index.html"), "--enc", os.path.join(R, "docs", "data.enc.json")], check=True)
p = os.path.join(R, "docs", "index.html"); h = open(p, encoding="utf-8").read()
assert h.count("</body>") == 1
ep = os.path.join(R, "tools", "endpoint.txt")
endpoint = open(ep).read().strip() if os.path.exists(ep) else ""
js = open(os.path.join(R, "tools", "ask.js"), encoding="utf-8").read().replace("__ASK_ENDPOINT__", endpoint)
h = h.replace("</body>", "<script>\n" + js + "\n</script>\n</body>")
import hashlib
v = hashlib.md5(open(os.path.join(R, "docs", "data.enc.json"), "rb").read()).hexdigest()[:10]
assert h.count('fetch("data.enc.json"') == 1
h = h.replace('fetch("data.enc.json"', 'fetch("data.enc.json?v=' + v + '"')  # evita cubo antigo em cache
open(p, "w", encoding="utf-8").write(h); print("ok", len(h), "v", v)
