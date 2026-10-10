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
- Opção 3 (IA como tradutora): `worker/ask-worker.js` (Cloudflare Worker; ferramenta forçada `consulta`, validação no cliente por `v2ToSp`), `tools/endpoint.txt` (URL do Worker, não secreta; ausente = só regras), `askToken` dentro do cubo cifrado. Testado localmente com o Worker real e o modelo simulado (conjunto, mínimo, recusa, nome inexistente, queda para regras). Qualidade da interpretação do modelo real ainda não testada (precisa da chave).
- Respostas em frase (modelo de texto, sem IA: os números vêm do cálculo local): "N corretores tiveram vendas em A e nenhuma em B: nomes (valores)". Trava no cliente: se a IA devolver contagem/lista com período de comparação e a pergunta tiver negação (não/sem/nenhum/nunca), vira `conjunto`. Tabelas de contagem/lista mostram só a coluna do período.
- Layout: a caixa agora é uma ABA própria (última, depois de Daily) com o mesmo símbolo de IA e BETA do Insights; as 7 abas originais ficam idênticas ao gerencial. `tools/build_lab.py` insere o botão (`#tab-ask`) e o painel (`#panel-ask > #askroot`) antes do script principal, para herdar o comportamento das abas. O nome da aba vem de `tools/nome.txt` (padrão "Assistente").

---
# RESUMO PARA DECISÃO · crIAtive (assistente de dados) — estado em 10/10/2026

## O que existe (só no laboratório, nada em produção)
- Aba **crIAtive BETA** (última aba, mesmo símbolo de IA do Insights); as 7 abas originais ficam idênticas ao gerencial; Overview continua a página inicial.
- Pergunta em português (aceita espanhol básico) → resposta em frase + tabela, com período e datas no título das colunas, e "Entendi assim:" mostrando como a pergunta foi lida.
- Cobre: métricas (leads/captação, oportunidades, visitas, propostas, fechamentos, vendas, agenciamentos, placas, VGV) × entidades (corretor, equipe, loja, veículo, bairro) × períodos (últimos N dias, semana, mês, mês por nome, ano, datas) × modos (total, ranking, contagem, lista, variação aumentou/diminuiu, "teve em A e não em B", "em ambos", mínimo N). Comparações de dois períodos sem agrupar viram total + tabela de uma linha.
- Contagens = clientes únicos (VGV = máximo por cliente), como no resto do dashboard. "Aumentou" = estritamente maior que o período de comparação; quem tinha 0 e passou a ter conta.
- Validação: respostas conferidas contra cálculo independente em Python sobre o mesmo cubo (corretores que aumentaram vendas em 7 dias, agenciamentos de setembro, equipes que mais venderam, vendas da Equipe 1 set vs. ago = 6 vs. 5, corretores com venda em setembro e sem venda em outubro = 23, etc.).

## Arquitetura (por que é seguro)
1. **Interpretar**: a página manda ao Worker (Cloudflare) só a pergunta + datas âncora + listas de nomes (equipes, lojas, veículos). O modelo (padrão `claude-haiku-5-5`, ferramenta forçada `consulta`) devolve uma consulta estruturada. **Nenhum dado de vendas, clientes ou corretores vai ao modelo.**
2. **Executar**: a página valida a consulta (`v2ToSp`: métrica/entidade/datas/nomes resolvidos nos dicionários do cubo; nome inexistente → avisa em vez de ignorar) e calcula no cubo que já está no navegador.
3. **Plano B**: se a IA falhar (rede, créditos, limite, consulta inválida), a página usa o interpretador por regras (`interpretar`) e avisa. Perguntas com negação que não consegue ler → "não entendi" (nunca responde outra pergunta).
4. **Trava**: pergunta com "não/sem/nenhum/nunca" + período de comparação vira `conjunto` mesmo se a IA errar o tipo.
5. **Acesso**: Worker só aceita `Origin` = github.io, cabeçalho `x-acesso` = segredo `ACESSO` (o token vai dentro do cubo cifrado, campo `askToken`: só quem tem a senha do dashboard o recebe), até `LIMITE_MIN` perguntas/min/IP (30), pergunta ≤ 400 caracteres.
- Onde ficam os segredos (nunca no repositório): `ANTHROPIC_API_KEY` e `ACESSO` como Secrets no Cloudflare; senha do cubo e token só nos prompts das tarefas/entregues no chat. A URL do Worker (`tools/endpoint.txt`) não é secreta.

## Custo e controle de créditos
- Estimativa: ~3.000 tokens de entrada + ~250 de saída por pergunta; com os preços citados para o Haiku 5.5 (US$ 0,10 / 0,50 por milhão de tokens; fonte de terceiros, conferir no console) ≈ US$ 0,0004 por pergunta (~US$ 0,40 por 1.000).
- Só gasta quando alguém clica em Perguntar (abrir o dashboard e o Worker parado não cobram).
- Controles: créditos pré-pagos SEM recarga automática; workspace dedicado com limite mensal (chave nova dentro dele → trocar o Secret `ANTHROPIC_API_KEY`); limite da organização + alertas; olhar Usage 1×/semana. Desligar: apagar o Secret `ACESSO` ou o Worker (a caixa cai para as regras). Revogar quem já tem o link: trocar `ACESSO` + novo `askToken` no cubo.
- Ainda NÃO existe (decidir): teto diário de perguntas no Worker (KV), token por equipe (uso por equipe e corte individual), registro das perguntas (exige aviso por privacidade).

## Se o sócio der luz verde: plano para o dashboard GERENCIAL
1. **Escopo**: só o espelho do GitHub Pages (`test-creativeimob`). O artefato ao vivo do claude.ai (BigQuery via `claude.use("mcp")`) não tem cubo local nem `askToken`; a caixa não vai nele (ou exigiria outro caminho).
2. **Código**: levar `tools/ask.js`, o trecho de `tools/build_lab.py` que injeta a aba (`#tab-ask`, `#panel-ask > #askroot`) e a versão do cubo no `fetch` (anti-cache); ajustar o build do gerencial (`tools/build_estatico.py`) para fazer o mesmo; `tools/endpoint.txt` e `tools/nome.txt` (crIAtive).
3. **Token**: gravar `askToken` no cubo do gerencial uma vez. A rotina diária (`tools/atualizar.py montar`) decifra, altera só `rows`, `K`, `dict`, `ultimo`, `gerado` e recifra, então o campo é preservado sem mudar a rotina (conferir no primeiro teste).
4. **Dashboards por equipe** (`gralha-equipes`): `fatiar()` em `tools/build_equipes.py` monta o cubo com chaves explícitas, então `askToken` precisa ser copiado; e o HTML por equipe (só Overview + Comparativo) precisa da aba crIAtive. Como o cubo da equipe só tem os dados dela, as respostas já saem limitadas à equipe. Ideal: token próprio por equipe.
5. **Worker**: o mesmo Worker serve todos (a origem github.io é a mesma). Revisar `ORIGENS`, `LIMITE_MIN` e, antes de abrir a mais gente, o teto diário.
6. **Documentação/skills/rotinas**: atualizar `CONTEXTO.md`/`QUERIES.md` do gerencial, `CONTEXTO.md`/`ATUALIZAR.md` das equipes e as duas skills (gerencial e equipes) para incluir a aba, o Worker e os segredos; ajustar o texto das duas tarefas agendadas se mudar algum passo.
7. **Testes antes de publicar**: comparar respostas com cálculo independente; testar com a IA desligada (plano B); testar senha errada/sem token; conferir no Playwright todas as abas do gerencial.

## Decisões pendentes (para o Paulo e o sócio)
- Nome final (hoje **crIAtive**; variação **crIAtiva**).
- Quem terá acesso (só gerentes, também as equipes?) e se haverá token por equipe.
- Limite mensal de gasto e teto diário de perguntas.
- Se a caixa deve registrar as perguntas (melhoria contínua) e como avisar os usuários.
- Posição da aba (hoje a última).
