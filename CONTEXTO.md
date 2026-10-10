# Contexto · Laboratório
- Escopo: testes (começando pela caixa de perguntas em linguagem natural). Nada aqui altera produção, skills ou memórias.
- Base: `fonte/dashboard-gralha-funil.html` (v44) + `tools/shim.js`, montados por `tools/build_estatico.py` em `docs/index.html`; `docs/data.enc.json` = cópia do cubo gerencial (até 2026-10-09) cifrada com senha só do laboratório (não gravada em arquivo).
- Sem rotina diária. Para renovar os dados, recifrar um cubo novo manualmente.

## Experimento 1 · "Pergunte aos dados" (BETA)
- `tools/ask.js` (injetado por `tools/build_lab.py` em `docs/index.html`): caixa de texto acima das abas. `interpretar(texto)` -> spec `{modo, met, ent, dir, per, prev, F}`; `calcular(spec)` roda sobre `window.__cuboInfo` (cubo no navegador). Sem IA, sem servidor; nada sai do navegador.
- Métricas: leads/captação, oportunidade, visita, proposta, fechamento, vendas, agenciamentos, placas, VGV. Entidades: corretor, equipe, loja, veículo, bairro. Períodos: últimos N dias/semanas, esta semana, semana passada, este mês, mês passado, mês por nome, este ano, datas dd/mm a dd/mm, ontem. Comparações: vs. período anterior de mesmo tamanho (mês parcial vs. mesmo recorte do mês anterior; semana vs. semana anterior); "vs." explícito. Aumentou/diminuiu = estritamente maior/menor; quem tinha 0 e passou a ter conta. Contagem = clientes únicos (VGV = máximo por cliente). Filtros por nome (equipe, loja, corretor; veículo/bairro precedidos pela palavra). Aceita espanhol básico.
- Validado contra cálculo independente em Python (Q: corretores aumentaram vendas 7d, agenciamentos setembro, equipes mais venderam, vendas da equipe Meta mês vs. mês anterior, veículo líder do ano).
- Próximos passos possíveis: trocar `interpretar` por um modelo pequeno (gera o mesmo spec) via função no Netlify; mais perguntas reais dos gerentes.
- Atualização: o motor entende "teve em A e não teve em B" (e o inverso) — modo `lost`. Qualquer negação ("não/sem/nenhum/zero/nunca") que não seja lida com dois períodos explícitos devolve "não entendi" em vez de uma resposta de outra pergunta (caso real: "quantos corretores tiveram vendas mês passado e não têm nesse mês").
