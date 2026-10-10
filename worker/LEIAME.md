# Worker "Pergunte aos dados" (Cloudflare)

Função intermediária: recebe a pergunta + nomes/datas (nunca dados), pede a um modelo pequeno (padrão `claude-haiku-5-5`) uma consulta estruturada e devolve o JSON. A página executa a consulta no cubo local. Se a função falhar, a página usa as regras (`tools/ask.js`).

## Instalar (uma vez, ~10 min)
1. Chave da API: console.anthropic.com → API Keys → criar chave (e ter créditos). Nunca colar a chave em chat/arquivo/commit.
2. dash.cloudflare.com → Workers & Pages → Create → Create Worker → nome `gralha-ask` → Deploy → Edit code → colar todo o `ask-worker.js` → Deploy.
3. Worker → Settings → Variables and Secrets → adicionar como **Secret**: `ANTHROPIC_API_KEY` (a chave) e `ACESSO` (token de acesso do laboratório, entregue no chat). Opcional (texto): `ORIGENS` = `https://paulollaque12.github.io`, `LIMITE_MIN` = `30`.
4. Copiar a URL do Worker (`https://gralha-ask.<conta>.workers.dev`) e passar ao Claude, que grava em `tools/endpoint.txt` e republica.

## Segurança
- Só aceita requisições vindas de `ORIGENS`, com o cabeçalho `x-acesso` igual ao segredo `ACESSO` (o token vai dentro do cubo cifrado: só quem tem a senha do dashboard o recebe), até `LIMITE_MIN` perguntas por minuto por IP, pergunta ≤ 400 caracteres.
- O modelo só recebe a pergunta, datas e listas de nomes de equipes/lojas/veículos. Nenhum dado de vendas/clientes/corretores é enviado.
- Para trocar o token: gerar outro, atualizar `ACESSO` no Worker e recifrar o cubo com `askToken` novo.
- Custo: cada pergunta é uma chamada pequena. Defina um limite de gasto no console da Anthropic.
