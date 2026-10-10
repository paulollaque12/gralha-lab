/* Cloudflare Worker · "Pergunte aos dados" (laboratorio Gralha)
   Recebe a pergunta + contexto (datas e nomes, NUNCA dados), pede ao modelo uma consulta estruturada e devolve o JSON.
   Segredos (Settings > Variables and Secrets, tipo Secret): ANTHROPIC_API_KEY, ACESSO.
   Variaveis opcionais: ORIGENS (padrao https://paulollaque12.github.io), MODELO (padrao claude-haiku-5-5), LIMITE_MIN (padrao 30 perguntas/min por IP). */

const SISTEMA = `Voce traduz perguntas em portugues (ou espanhol) sobre o dashboard comercial da Gralha Imoveis em uma CONSULTA ESTRUTURADA. Voce nunca responde com numeros: so chama a ferramenta "consulta".

DADOS: eventos de funil de clientes por corretor/equipe/loja. Metricas (todas = clientes unicos no periodo, exceto vgv):
- leads (a etapa chamada "Captacao" do funil), oportunidades, visitas, propostas, fechamentos, vendas, agenciamentos (imoveis captados), placas, vgv (valor das vendas em R$).
Entidades para agrupar: corretor, equipe, loja, veiculo (veiculo de captacao), bairro. Sem entidade = total geral.
Datas: use SEMPRE datas ISO absolutas (AAAA-MM-DD) em a/b, partindo do contexto.ancoras fornecido (ultimo_dia e o ultimo dia com dados; nao existe "hoje" nos dados: hoje/ontem = ultimo_dia). "Ultimos N dias" = ultimo_dia-(N-1) ate ultimo_dia. "Esta semana"/"este mes" = ancoras.semana_atual / mes_atual. "Semana passada"/"mes passado" e meses por nome: use as ancoras. Preencha "rotulo" com um nome curto do periodo (ex.: "ultimos 7 dias").
MODOS:
- total: um numero (e, se houver "comparar", a variacao).
- ranking: ordena entidades por valor no periodo (use top e ordem; "qual/quem mais" = top 1).
- contagem: quantas entidades tem valor > 0 (ou >= minimo) no periodo. Exige entidade.
- lista: quais entidades tem valor > 0 (ou >= minimo). Exige entidade.
- variacao: compara periodo x comparar por entidade. direcao "aumentou" (valor atual > anterior), "diminuiu" (<), ou null para mostrar todos. SEMPRE preencha "comparar": se o usuario nao disser, use o periodo anterior de mesmo tamanho imediatamente antes (mes parcial: mesmo recorte do mes anterior; semana parcial: mesmos dias da semana anterior).
- conjunto: entidades que tem valor no "periodo" e NAO tem em "comparar" (conjunto="so_no_periodo"), o inverso ("so_na_comparacao"), ou que tem nos dois ("em_ambos"). Ex.: "tiveram vendas mes passado e nao tem neste mes" => periodo=mes passado, comparar=este mes, conjunto="so_no_periodo".
FILTROS: nomes de equipe/loja/veiculo devem ser copiados EXATAMENTE de contexto.listas; corretor e bairro, escreva o nome como o usuario disse. Se o usuario pedir algo que os dados nao tem (clientes por nome, telefone, previsoes, causas, "por que"), preencha nao_suportado com o motivo curto em portugues e deixe o resto minimo. Em "entendi" escreva em uma frase como voce entendeu a pergunta (portugues).`;

const FERRAMENTA = {
  name: "consulta",
  description: "Consulta estruturada sobre o dashboard",
  input_schema: {
    type: "object",
    properties: {
      metrica: { type: "string", enum: ["leads", "oportunidades", "visitas", "propostas", "fechamentos", "vendas", "agenciamentos", "placas", "vgv"] },
      entidade: { type: ["string", "null"], enum: ["corretor", "equipe", "loja", "veiculo", "bairro", null] },
      modo: { type: "string", enum: ["total", "ranking", "contagem", "lista", "variacao", "conjunto"] },
      periodo: { type: "object", properties: { a: { type: "string" }, b: { type: "string" }, rotulo: { type: "string" } }, required: ["a", "b"] },
      comparar: { type: ["object", "null"], properties: { a: { type: "string" }, b: { type: "string" }, rotulo: { type: "string" } } },
      direcao: { type: ["string", "null"], enum: ["aumentou", "diminuiu", null] },
      conjunto: { type: ["string", "null"], enum: ["so_no_periodo", "so_na_comparacao", "em_ambos", null] },
      filtros: { type: "object", properties: { equipe: { type: "array", items: { type: "string" } }, loja: { type: "array", items: { type: "string" } }, corretor: { type: "array", items: { type: "string" } }, veiculo: { type: "array", items: { type: "string" } }, bairro: { type: "array", items: { type: "string" } } } },
      top: { type: ["integer", "null"] },
      ordem: { type: ["string", "null"], enum: ["desc", "asc", null] },
      minimo: { type: ["integer", "null"] },
      entendi: { type: "string" },
      nao_suportado: { type: ["string", "null"] }
    },
    required: ["metrica", "modo", "periodo", "entendi"]
  }
};

const json = (o, st, h) => new Response(JSON.stringify(o), { status: st || 200, headers: { "content-type": "application/json; charset=utf-8", ...(h || {}) } });
function igual(a, b) { // comparacao em tempo constante
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0 && y.length > 0;
}
const balde = new Map();
function limitado(ip, max) {
  const agora = Date.now(), v = (balde.get(ip) || []).filter(t => agora - t < 60000);
  v.push(agora); balde.set(ip, v); if (balde.size > 5000) balde.clear();
  return v.length > max;
}

export default {
  async fetch(req, env) {
    const permitidas = (env.ORIGENS || "https://paulollaque12.github.io").split(",").map(s => s.trim());
    const origem = req.headers.get("Origin") || "";
    const cors = { "Access-Control-Allow-Origin": permitidas.includes(origem) ? origem : permitidas[0], "Access-Control-Allow-Headers": "content-type,x-acesso", "Access-Control-Allow-Methods": "POST,OPTIONS", "Vary": "Origin" };
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST" || !permitidas.includes(origem)) return json({ erro: "nao permitido" }, 403, cors);
    if (!igual(req.headers.get("x-acesso") || "", env.ACESSO || "")) return json({ erro: "acesso negado" }, 401, cors);
    if (limitado(req.headers.get("cf-connecting-ip") || "?", +(env.LIMITE_MIN || 30))) return json({ erro: "muitas perguntas, aguarde um minuto" }, 429, cors);
    let corpo;
    try { const t = await req.text(); if (t.length > 20000) throw 0; corpo = JSON.parse(t); } catch (_) { return json({ erro: "pedido invalido" }, 400, cors); }
    const pergunta = String(corpo.pergunta || "").slice(0, 400).trim();
    if (pergunta.length < 3) return json({ erro: "pergunta vazia" }, 400, cors);
    const contexto = JSON.stringify(corpo.contexto || {}).slice(0, 12000);
    let r;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: env.MODELO || "claude-haiku-5-5", max_tokens: 700, system: SISTEMA, tools: [FERRAMENTA], tool_choice: { type: "tool", name: "consulta" },
          messages: [{ role: "user", content: "contexto: " + contexto + "\n\npergunta: " + pergunta }] })
      });
    } catch (_) { return json({ erro: "falha ao falar com o modelo" }, 502, cors); }
    if (!r.ok) return json({ erro: "modelo indisponivel (" + r.status + ")" }, 502, cors);
    const d = await r.json(), uso = (d.content || []).find(c => c.type === "tool_use");
    if (!uso || !uso.input) return json({ erro: "resposta sem consulta" }, 502, cors);
    return json({ spec: uso.input }, 200, cors);
  }
};
