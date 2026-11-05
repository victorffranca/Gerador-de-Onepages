/**
 * OnePage Generator — servidor Google Apps Script.
 *
 * Os dados ficam numa planilha do Google Sheets criada na conta de quem implanta o app
 * (rode a função `setup` uma vez). Toda chamada do navegador passa por `api()`, que
 * identifica o usuário pelo e-mail Google e aplica as regras de acesso aqui no servidor.
 */

// E-mails com ACESSO MESTRE. Gerado a partir de public/js/config.js pelo build.
const MASTER_EMAILS = __MASTER_EMAILS__;

// Colunas de cada aba: [chave, ...colunas de busca, json]
const TABLES = {
  allowedUsers: ['email', 'json'],
  accessRequests: ['email', 'json'],
  users: ['uid', 'json'],
  clients: ['id', 'ownerUid', 'json'],
  reports: ['id', 'clientId', 'json'],
};

function doGet(e) {
  // Diagnóstico: abra o link do app com ?diag=1 no final para testar o servidor sem a interface.
  if (e && e.parameter && e.parameter.diag === 'windsor') {
    const res = api('windsorAccounts', [true]);
    const summary = res && !res.error
      ? { contas: { meta: res.facebook.length, googleAds: res.google_ads.length, ga4: res.googleanalytics4.length }, fonte: res.source, erros: res.errors || [] }
      : res;
    return ContentService.createTextOutput(JSON.stringify(summary, null, 2));
  }
  if (e && e.parameter && e.parameter.diag) {
    const res = api('whoami', []);
    let db = '';
    try { db = db_().getUrl(); } catch (err) { db = 'ERRO: ' + err; }
    return ContentService.createTextOutput(JSON.stringify({ whoami: res, planilha: db }, null, 2));
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('OnePage Generator')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setFaviconUrl('https://www.gstatic.com/images/branding/product/1x/sheets_2020q4_48dp.png');
}

/** Rode no editor para autorizar a conexão com o Windsor e testar a chave (WINDSOR_API_KEY). */
function testarWindsor() {
  const res = windsorFetchAll_([{ connector: 'facebook', params: { fields: 'account_id,account_name,spend', date_preset: 'last_30d' } }])[0];
  Logger.log(res.error ? 'ERRO no Windsor: ' + res.error : 'Windsor OK: ' + res.rows.length + ' conta(s) da Meta com gasto nos últimos 30 dias.');
}

/** Rode uma vez no editor do Apps Script para criar a planilha e autorizar o app. */
function setup() {
  const ss = db_();
  Object.keys(TABLES).forEach(table_);
  const first = ss.getSheetByName('Sheet1') || ss.getSheetByName('Página1');
  if (first && ss.getSheets().length > 1) ss.deleteSheet(first);
  Logger.log('Planilha de dados: ' + ss.getUrl());
}

// ── API ───────────────────────────────────────────────────────
function api(method, args) {
  try {
    const email = me_();
    const access = access_(email);
    const ctx = { email: email, access: access, admin: access.role === 'master' || access.role === 'admin' };
    if (method !== 'whoami' && method !== 'requestAccess' && !access.allowed) return err_('Acesso não liberado.', 'permission-denied');
    const fn = METHODS[method];
    if (!fn) return err_('Método desconhecido: ' + method);
    const result = fn.apply(null, [ctx].concat(args || []));
    return result === undefined ? null : result;
  } catch (e) {
    if (e && e.code) return err_(e.message, e.code);
    console.error(e);
    return err_(String(e && e.message || e));
  }
}

const METHODS = {
  // Login + carga inicial numa chamada só: com acesso liberado já devolve clientes, one pages e acessos.
  whoami: function (ctx) {
    const out = { user: { uid: ctx.email, email: ctx.email, name: ctx.email.split('@')[0], photo: '' }, access: ctx.access };
    if (ctx.access.allowed) {
      const u = get_('users', ctx.email);
      if (!u || Date.now() - (u.lastLogin || 0) > 6 * 3600 * 1000) METHODS.touchProfile(ctx);
      out.data = METHODS.bootstrap(ctx);
    }
    return out;
  },
  bootstrap: function (ctx) {
    const clients = METHODS.listClients(ctx, null);
    const ids = {};
    clients.forEach(function (c) { ids[c.id] = true; });
    const reports = {};
    rows_('reports').forEach(function (r) {
      const cid = r.cols[0];
      if (ids[cid]) (reports[cid] = reports[cid] || []).push(r.data);
    });
    const out = { clients: clients, reports: reports };
    if (ctx.admin) { out.profiles = all_('users'); out.allowed = all_('allowedUsers'); out.requests = all_('accessRequests'); }
    return out;
  },
  requestAccess: function (ctx) {
    if (ctx.access.allowed) return;
    put_('accessRequests', ctx.email, [], { email: ctx.email, name: ctx.email.split('@')[0], requestedAt: Date.now() });
  },
  touchProfile: function (ctx) {
    const cur = get_('users', ctx.email) || {};
    cur.email = ctx.email; cur.name = cur.name || ctx.email.split('@')[0]; cur.lastLogin = Date.now();
    put_('users', ctx.email, [], cur);
  },

  listProfiles: function (ctx) { needAdmin_(ctx); return all_('users'); },
  listAllowed: function (ctx) { needAdmin_(ctx); return all_('allowedUsers'); },
  listRequests: function (ctx) { needAdmin_(ctx); return all_('accessRequests'); },
  setAllowed: function (ctx, email, data) {
    needAdmin_(ctx);
    email = lower_(email);
    const cur = get_('allowedUsers', email) || {};
    const next = Object.assign(cur, pick_(data, ['role', 'active', 'grantedBy', 'grantedAt']), { email: email });
    if (next.role !== 'admin') next.role = 'user';
    put_('allowedUsers', email, [], next);
  },
  removeAllowed: function (ctx, email) { needAdmin_(ctx); remove_('allowedUsers', lower_(email)); },
  removeRequest: function (ctx, email) { needAdmin_(ctx); remove_('accessRequests', lower_(email)); },

  listClients: function (ctx, ownerUid) {
    if (!ctx.admin) ownerUid = ctx.email;
    return rows_('clients').filter(function (r) { return !ownerUid || r.cols[0] === ownerUid; }).map(function (r) { return r.data; });
  },
  saveClient: function (ctx, client) {
    const id = client.id;
    let data;
    // O navegador cria o ID de um cliente novo (para abrir a tela sem esperar o servidor): se o ID ainda não
    // existe, cria com ele e com o dono = quem chamou; se existe, só o dono (ou admin) pode alterar.
    const existing = id ? get_('clients', id) : null;
    if (existing) {
      const cur = ownClient_(ctx, id);
      data = Object.assign(cur, client, { id: id, ownerUid: cur.ownerUid, ownerEmail: cur.ownerEmail });
    } else {
      data = Object.assign({}, client, { id: validId_(id) || Utilities.getUuid(), ownerUid: ctx.email, ownerEmail: ctx.email });
    }
    put_('clients', data.id, [data.ownerUid], data);
    return data;
  },
  deleteClient: function (ctx, id) {
    ownClient_(ctx, id);
    withLock_(function () {
      const sh = table_('reports');
      rows_('reports', true).filter(function (r) { return r.cols[0] === id; }).reverse().forEach(function (r) { sh.deleteRow(r.row); });
      invalidate_('reports');
    });
    remove_('clients', id);
  },

  listReports: function (ctx, clientId) {
    ownClient_(ctx, clientId);
    return rows_('reports').filter(function (r) { return r.cols[0] === clientId; }).map(function (r) { return r.data; });
  },
  saveReport: function (ctx, clientId, report) {
    ownClient_(ctx, clientId);
    const data = Object.assign({}, report, { id: validId_(report.id) || Utilities.getUuid(), clientId: clientId });
    if (report.id) {
      const cur = get_('reports', report.id);
      if (cur && cur.clientId !== clientId) throw denied_();
    }
    put_('reports', data.id, [clientId], data);
    syncLastReport_(clientId);
    return data;
  },
  deleteReport: function (ctx, clientId, id) {
    ownClient_(ctx, clientId);
    const cur = get_('reports', id);
    if (cur && cur.clientId !== clientId) throw denied_();
    remove_('reports', id);
    syncLastReport_(clientId);
  },
};

// Guarda no cliente o resumo da one page mais recente (usado nos cards da lista).
function syncLastReport_(clientId) {
  const c = get_('clients', clientId);
  if (!c) return;
  const latest = rows_('reports').filter(function (r) { return r.cols[0] === clientId && r.data.month; })
    .map(function (r) { return r.data; })
    .sort(function (a, b) { return b.month.localeCompare(a.month); })[0];
  const lr = latest ? { month: latest.month, revenue: Number(latest.type === 'inside-sales' ? latest.isRevenue : latest.revenue) || 0, type: latest.type } : null;
  if (JSON.stringify(lr) === JSON.stringify(c.lastReport || null)) return;
  c.lastReport = lr;
  put_('clients', clientId, [c.ownerUid], c);
}

// ── WINDSOR.AI ────────────────────────────────────────────────
// A chave fica em Configurações do projeto → Propriedades do script → WINDSOR_API_KEY.
const WINDSOR_URL = 'https://connectors.windsor.ai/';
const WINDSOR_CONNECTORS = { facebook: 'spend', google_ads: 'spend', googleanalytics4: 'sessions' };
// O que conta como "resultado" na Meta, escolhido no cadastro de cada cliente.
const META_RESULTS = {
  purchase: 'actions_omni_purchase',
  lead: 'actions_lead',
  messaging: 'actions_onsite_conversion_messaging_conversation_started_7d',
};

Object.assign(METHODS, {
  windsorStatus: function () {
    return { configured: !!PropertiesService.getScriptProperties().getProperty('WINDSOR_API_KEY') };
  },

  // Contas conectadas no Windsor, por conector. Fica 6 h em cache.
  windsorAccounts: function (ctx, refresh) {
    const cache = CacheService.getScriptCache();
    const hit = !refresh && cache.get('windsor-accounts');
    if (hit) return JSON.parse(hit);
    const out = windsorAccountList_() || windsorAccountsFromData_();
    Object.keys(WINDSOR_CONNECTORS).forEach(function (c) {
      const seen = {};
      out[c] = (out[c] || [])
        .filter(function (a) { return a.id && !seen[a.id] && (seen[a.id] = true); })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });
    });
    if (!out.errors.length) cache.put('windsor-accounts', JSON.stringify(out), 21600);
    return out;
  },

  // Busca as métricas do mês nas contas vinculadas ao cliente e devolve os campos do formulário.
  windsorPull: function (ctx, clientId, month, type) {
    const c = ownClient_(ctx, clientId);
    const w = c.windsor || {};
    if (type) c.type = type;
    if (!w.meta && !w.google && !w.ga4) throw codeErr_('Este cliente ainda não tem contas do Windsor vinculadas.', 'windsor-unlinked');
    if (!/^\d{4}-\d{2}$/.test(month || '')) throw codeErr_('Informe o mês de análise.', 'windsor-month');
    const ym = month.split('-').map(Number);
    const range = { date_from: month + '-01', date_to: month + '-' + ('0' + new Date(ym[0], ym[1], 0).getDate()).slice(-2) };
    const reqs = windsorRequests_(w, c.type);
    const results = windsorFetchAll_(reqs.map(function (r) {
      return { connector: r.connector, params: Object.assign({ fields: r.fields.join(','), select_accounts: r.account }, range) };
    }));
    const failed = results.filter(function (r) { return r.error; });
    if (failed.length) throw codeErr_('Windsor: ' + failed[0].error, 'windsor');
    const rows = {};
    reqs.forEach(function (r, i) { rows[r.key] = results[i].rows; });
    return windsorReport_(w, c.type, rows);
  },
});

// Lista rápida pelo endpoint de contas do Windsor; null se o formato não for o esperado.
function windsorAccountList_() {
  try {
    const res = UrlFetchApp.fetch('https://onboard.windsor.ai/api/common/ds-accounts?datasource=all&api_key=' + encodeURIComponent(windsorKey_()), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return null;
    const body = JSON.parse(res.getContentText());
    const list = Array.isArray(body) ? body : body && (body.data || body.accounts);
    if (!Array.isArray(list)) return null;
    const out = { errors: [], source: 'ds-accounts' };
    Object.keys(WINDSOR_CONNECTORS).forEach(function (c) { out[c] = []; });
    list.forEach(function (a) {
      const c = a.datasource || a.data_source || a.connector;
      const id = String(a.account_id || a.id || '').replace(/^act_/, '');
      if (out[c] && id) out[c].push({ id: id, name: String(a.account_name || a.name || id).trim() });
    });
    return Object.keys(WINDSOR_CONNECTORS).some(function (c) { return out[c].length; }) ? out : null;
  } catch (e) {
    return null;
  }
}

// Alternativa mais lenta: contas com dados nos últimos 90 dias.
function windsorAccountsFromData_() {
  const names = Object.keys(WINDSOR_CONNECTORS);
  const results = windsorFetchAll_(names.map(function (c) {
    return { connector: c, params: { fields: 'account_id,account_name,' + WINDSOR_CONNECTORS[c], date_preset: 'last_90d' } };
  }));
  const out = { errors: [], source: 'dados' };
  names.forEach(function (c, i) {
    if (results[i].error) { out[c] = []; out.errors.push(c + ': ' + results[i].error); return; }
    out[c] = results[i].rows.map(function (r) { return { id: String(r.account_id), name: String(r.account_name || r.account_id).trim() }; });
  });
  return out;
}

// ── RELATÓRIO COM IA ──────────────────────────────────────────
// Puxa o mês escolhido e o anterior no Windsor, grava/atualiza as duas one pages e pede a análise
// ao Claude (chave em Propriedades do script → ANTHROPIC_API_KEY). Sem a chave, devolve ai=false
// e o navegador escreve os insights com as regras automáticas.
const CLAUDE_MODEL = 'claude-opus-5-5';

Object.assign(METHODS, {
  aiStatus: function () {
    return { configured: !!PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY') };
  },

  aiReport: function (ctx, clientId, month) {
    const c = ownClient_(ctx, clientId);
    const w = c.windsor || {};
    if (!w.meta && !w.google && !w.ga4) throw codeErr_('Este cliente ainda não tem contas do Windsor vinculadas.', 'windsor-unlinked');
    if (!/^\d{4}-\d{2}$/.test(month || '')) throw codeErr_('Informe o mês do relatório.', 'windsor-month');
    const prevMonth = shiftMonth_(month, -1);
    const saved = rows_('reports').filter(function (r) { return r.cols[0] === clientId; }).map(function (r) { return r.data; });
    const curSaved = saved.filter(function (r) { return r.month === month; })[0];
    const prevSaved = saved.filter(function (r) { return r.month === prevMonth; })[0];
    const type = (curSaved && curSaved.type) || c.type || 'ecommerce';

    const reqs = windsorRequests_(w, type, true);
    const calls = [];
    [month, prevMonth].forEach(function (m) { reqs.forEach(function (r) { calls.push({ month: m, req: r }); }); });
    const results = windsorFetchAll_(calls.map(function (x) {
      return { connector: x.req.connector, params: Object.assign({ fields: x.req.fields.join(','), select_accounts: x.req.account }, monthRange_(x.month)) };
    }));
    const failed = results.filter(function (r) { return r.error; });
    if (failed.length) throw codeErr_('Windsor: ' + failed[0].error, 'windsor');
    const byMonth = {};
    calls.forEach(function (x, i) { (byMonth[x.month] = byMonth[x.month] || {})[x.req.key] = results[i].rows; });

    const now = Date.now();
    const build = function (base, m) {
      const pulled = windsorReport_(w, type, byMonth[m]);
      const r = Object.assign(base ? JSON.parse(JSON.stringify(base)) : {
        id: Utilities.getUuid(), clientId: clientId, type: type, month: m, agency: c.agency || '', meta: c.meta || '', insights: [], createdAt: now,
      }, pulled.fields);
      if (pulled.creatives.length) {
        [1, 2, 3].forEach(function (i) {
          const cr = pulled.creatives[i - 1] || {};
          r['c' + i + 'Name'] = cr.name || ''; r['c' + i + 'Inv'] = cr.inv || ''; r['c' + i + 'Sales'] = cr.res || '';
          r['c' + i + 'Rev'] = cr.rev || ''; r['c' + i + 'Img'] = cr.img || ''; r['c' + i + 'Link'] = '';
        });
      }
      if (type !== 'inside-sales' && !Number(r.revenue) && pulled.suggestedRevenue) r.revenue = pulled.suggestedRevenue;
      r.metaResult = metaResultKey_(w, type);
      r.source = 'windsor';
      r.updatedAt = now; r.updatedBy = ctx.email;
      return r;
    };
    // O mês anterior só é criado se ainda não existir (preserva o que já foi editado à mão).
    const prev = prevSaved || build(null, prevMonth);
    const cur = build(curSaved, month);
    cur.campaigns = campaigns_(byMonth[month], byMonth[prevMonth], metaResultField_(w, type));

    const ai = claudeAnalysis_(c, cur, prev);
    cur.improvements = [];
    if (ai) { cur.insights = ai.insights; cur.summary = ai.summary; cur.improvements = ai.improvements; cur.aiModel = CLAUDE_MODEL; }
    if (!prevSaved) put_('reports', prev.id, [clientId], prev);
    put_('reports', cur.id, [clientId], cur);
    syncLastReport_(clientId);
    return { report: cur, prev: prev, ai: !!ai, createdPrev: !prevSaved };
  },
});

// Campanhas do mês (Meta e Google) com os números do mês anterior para comparação.
function campaigns_(cur, prev, resField) {
  const n = function (v) { return Number(v) || 0; };
  const r2 = function (v) { return Math.round(v * 100) / 100; };
  const meta = function (r) {
    const imps = n(r.impressions), clicks = n(r.link_clicks), res = n(r[resField]);
    return { plat: 'meta', name: String(r.campaign || 'Sem nome'), objective: String(r.campaign_objective || ''), inv: r2(n(r.spend)), imps: imps,
      clicks: clicks, res: Math.round(res), value: r2(n(r.action_values_omni_purchase)), freq: n(r.reach) ? r2(imps / n(r.reach)) : null };
  };
  const google = function (r) {
    return { plat: 'google', name: String(r.campaign || 'Sem nome'), objective: String(r.advertising_channel_type || ''), inv: r2(n(r.spend)),
      imps: n(r.impressions), clicks: n(r.clicks), res: Math.round(n(r.conversions)), value: r2(n(r.conversion_value)),
      is: r.search_impression_share == null ? null : n(r.search_impression_share),
      isBudget: r.search_budget_lost_impression_share == null ? null : n(r.search_budget_lost_impression_share),
      isRank: r.search_rank_lost_impression_share == null ? null : n(r.search_rank_lost_impression_share) };
  };
  const list = (cur.metaCampaigns || []).map(meta).concat((cur.googleCampaigns || []).map(google));
  const before = ((prev && prev.metaCampaigns) || []).map(meta).concat(((prev && prev.googleCampaigns) || []).map(google));
  return list.filter(function (c) { return c.inv > 0; }).map(function (c) {
    const p = before.filter(function (b) { return b.plat === c.plat && b.name === c.name; })[0];
    if (p) c.prev = { inv: p.inv, res: p.res, clicks: p.clicks, imps: p.imps };
    return c;
  }).sort(function (a, b) { return b.inv - a.inv; });
}

function shiftMonth_(m, delta) {
  const p = m.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1 + delta, 1);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
}

function monthRange_(m) {
  const p = m.split('-').map(Number);
  return { date_from: m + '-01', date_to: m + '-' + ('0' + new Date(p[0], p[1], 0).getDate()).slice(-2) };
}

function metaResultKey_(w, type) {
  return META_RESULTS[w.metaResult] ? w.metaResult : type === 'inside-sales' ? 'lead' : 'purchase';
}

// Indicadores principais de um relatório, para a IA comparar os meses.
function kpis_(r) {
  const n = function (v) { return Number(v) || 0; };
  const r2 = function (v) { return Math.round(v * 100) / 100; };
  const div = function (a, b) { return b ? r2(a / b) : null; };
  const inv = n(r.invGoogle) + n(r.invMeta) + n(r.invOther);
  const clicks = n(r.clkGoogle) + n(r.clkMeta), imps = n(r.impGoogle) + n(r.impMeta);
  const k = {
    investimento: r2(inv), cliques: clicks, impressoes: imps,
    cpc: div(n(r.invGoogle) + n(r.invMeta), clicks), ctr_pct: div(clicks * 100, imps),
    canais: {
      meta: { investimento: n(r.invMeta), cliques: n(r.clkMeta), impressoes: n(r.impMeta), cpc: div(n(r.invMeta), n(r.clkMeta)) },
      google: { investimento: n(r.invGoogle), cliques: n(r.clkGoogle), impressoes: n(r.impGoogle), cpc: div(n(r.invGoogle), n(r.clkGoogle)) },
    },
    criativos: [1, 2, 3].map(function (i) {
      return { nome: r['c' + i + 'Name'], investimento: n(r['c' + i + 'Inv']), resultados: n(r['c' + i + 'Sales']), faturamento: n(r['c' + i + 'Rev']) };
    }).filter(function (x) { return x.nome; }),
  };
  if (r.type === 'inside-sales') {
    Object.assign(k, { leads: n(r.leads), cpl: div(inv, n(r.leads)), mql: n(r.mql), sql: n(r.sql), oportunidades: n(r.opps),
      fechamentos: n(r.closes), faturamento: n(r.isRevenue), cac: div(inv, n(r.closes)) });
  } else {
    Object.assign(k, { sessoes: n(r.sessions), carrinho: n(r.cart), checkout: n(r.checkout), vendas: n(r.sales),
      faturamento: n(r.revenue), cpa: div(inv, n(r.sales)), roas: div(n(r.revenue), inv), ticket_medio: div(n(r.revenue), n(r.sales)) });
  }
  return k;
}

function claudeAnalysis_(client, cur, prev) {
  const key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) return null;
  const resultado = { purchase: 'compras', lead: 'leads de formulário', messaging: 'conversas iniciadas no WhatsApp/Direct' }[cur.metaResult] || 'resultados';
  const dados = {
    cliente: client.name,
    tipo: cur.type === 'inside-sales' ? 'Inside Sales (geração de leads)' : 'E-commerce',
    resultado_meta: resultado,
    meta_faturamento: Number(cur.meta) || null,
    mes_atual: { mes: cur.month, indicadores: kpis_(cur) },
    mes_anterior: { mes: prev.month, indicadores: kpis_(prev) },
    campanhas_mes_atual: (cur.campaigns || []).map(function (c) {
      return { plataforma: c.plat === 'meta' ? 'Meta Ads' : 'Google Ads', campanha: c.name, objetivo: c.objective, investimento: c.inv,
        impressoes: c.imps, cliques: c.clicks, resultados: c.res, valor_conversoes: c.value || undefined, frequencia: c.freq || undefined,
        parcela_impressoes: c.is == null ? undefined : c.is, perda_por_orcamento: c.isBudget == null ? undefined : c.isBudget,
        perda_por_classificacao: c.isRank == null ? undefined : c.isRank, mes_anterior: c.prev };
    }),
  };
  const schema = {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      insights: {
        type: 'array',
        items: {
          type: 'object',
          properties: { tipo: { type: 'string', enum: ['pos', 'opp'] }, title: { type: 'string' }, text: { type: 'string' } },
          required: ['tipo', 'title', 'text'],
          additionalProperties: false,
        },
      },
      improvements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            prioridade: { type: 'string', enum: ['alta', 'media', 'baixa'] },
            plataforma: { type: 'string', enum: ['Meta Ads', 'Google Ads', 'Geral'] },
            campanha: { type: 'string' },
            acao: { type: 'string' },
            motivo: { type: 'string' },
          },
          required: ['prioridade', 'plataforma', 'campanha', 'acao', 'motivo'],
          additionalProperties: false,
        },
      },
    },
    required: ['summary', 'insights', 'improvements'],
    additionalProperties: false,
  };
  const system = 'Você é um analista sênior de mídia paga da V4 Company e escreve a análise da one page mensal de resultados de um cliente. ' +
    'Escreva em português do Brasil, em tom profissional e direto, para o próprio cliente ler. Use os números no formato brasileiro (R$ 1.234,56; 12,3%).';
  const prompt = 'Compare o mês atual com o mês anterior usando só os dados abaixo. Campos zerados ou nulos significam que o dado não foi informado: ' +
    'não tire conclusões sobre eles (por exemplo, faturamento ou fechamentos ausentes).\n\n' +
    'Devolva:\n' +
    '- summary: 2 ou 3 frases com a leitura geral do mês e a principal variação em relação ao anterior.\n' +
    '- insights: de 4 a 6 itens. Use tipo "pos" para destaques do período e "opp" para pontos de atenção ou oportunidades. ' +
    'Cubra a evolução das métricas principais (investimento, resultados, CPL ou CPA, CPC, CTR e, se houver, faturamento e ROAS), ' +
    'o criativo de melhor desempenho e o motivo, e sugestões concretas de melhoria para o próximo mês. ' +
    'Cada title tem no máximo 70 caracteres e cada text no máximo 2 frases, citando os números.\n' +
    '- improvements: de 3 a 8 ações práticas para o gestor de tráfego aplicar nas campanhas no próximo mês, da mais para a menos importante. ' +
    'Avalie cada campanha pelo seu objetivo: campanhas de reconhecimento, alcance ou tráfego não geram conversões por definição, então julgue-as por CPM, CPC, CTR e frequência. ' +
    'Exemplos de ação: escalar verba de quem tem custo por resultado abaixo da média, reduzir ou pausar quem gasta sem resultado, renovar criativos com frequência acima de 3,5, ' +
    'ajustar público, melhorar anúncios e palavras-chave quando a perda de impressões por classificação for alta, aumentar orçamento quando a perda por orçamento for alta. ' +
    'Em "campanha" use o nome exato da campanha (ou "Conta inteira" para ações gerais e plataforma "Geral"); "acao" é uma frase imperativa curta; "motivo" cita os números que justificam.\n\n' +
    'Dados:\n' + JSON.stringify(dados, null, 1);

  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2026-10-21', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
    payload: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: schema } },
      system: system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  let body = null;
  try { body = JSON.parse(res.getContentText()); } catch (e) { /* resposta não-JSON */ }
  if (res.getResponseCode() !== 200 || !body) {
    const msg = body && body.error ? body.error.message || JSON.stringify(body.error) : 'HTTP ' + res.getResponseCode();
    throw codeErr_('IA: ' + msg, 'ai');
  }
  if (body.stop_reason === 'refusal') throw codeErr_('A IA não conseguiu analisar este relatório. Tente de novo ou escreva os insights à mão.', 'ai');
  const text = (body.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
  let out;
  try { out = JSON.parse(text); } catch (e) { throw codeErr_('IA: resposta em formato inesperado.', 'ai'); }
  return {
    summary: String(out.summary || ''),
    insights: (out.insights || []).slice(0, 6),
    improvements: (out.improvements || []).slice(0, 10).map(function (i) {
      return { prioridade: i.prioridade, plataforma: i.plataforma, campanha: i.campanha, acao: i.acao, motivo: i.motivo, done: false };
    }),
  };
}

/** Rode no editor para autorizar e testar a chave do Claude (ANTHROPIC_API_KEY). */
function testarIA() {
  const fake = { type: 'inside-sales', month: '2026-10', metaResult: 'messaging', invMeta: 1418.06, clkMeta: 1638, impMeta: 254840, leads: 239 };
  const prev = { type: 'inside-sales', month: '2026-09', metaResult: 'messaging', invMeta: 1661.12, clkMeta: 1403, impMeta: 235232, leads: 220 };
  const ai = claudeAnalysis_({ name: 'Teste' }, fake, prev);
  Logger.log(ai ? 'IA OK: ' + ai.summary : 'ANTHROPIC_API_KEY não configurada.');
}

function metaResultField_(w, type) {
  return META_RESULTS[w.metaResult] || (type === 'inside-sales' ? META_RESULTS.lead : META_RESULTS.purchase);
}

function windsorRequests_(w, type, withCampaigns) {
  const res = metaResultField_(w, type);
  const reqs = [];
  if (withCampaigns && w.meta) reqs.push({ key: 'metaCampaigns', connector: 'facebook', account: w.meta, fields: ['campaign', 'campaign_objective', 'spend', 'impressions', 'reach', 'link_clicks', res, 'action_values_omni_purchase'] });
  if (withCampaigns && w.google) reqs.push({ key: 'googleCampaigns', connector: 'google_ads', account: w.google, fields: ['campaign', 'advertising_channel_type', 'spend', 'clicks', 'impressions', 'conversions', 'conversion_value', 'search_impression_share', 'search_budget_lost_impression_share', 'search_rank_lost_impression_share'] });
  if (w.meta) {
    reqs.push({ key: 'meta', connector: 'facebook', account: w.meta, fields: ['account_id', 'spend', 'link_clicks', 'impressions', res, 'action_values_omni_purchase'] });
    reqs.push({ key: 'metaAds', connector: 'facebook', account: w.meta, fields: ['ad_name', 'spend', res, 'action_values_omni_purchase', 'thumbnail_url'] });
  }
  if (w.google) reqs.push({ key: 'google', connector: 'google_ads', account: w.google, fields: ['account_id', 'spend', 'clicks', 'impressions', 'conversions', 'conversion_value'] });
  if (w.ga4) reqs.push({ key: 'ga4', connector: 'googleanalytics4', account: w.ga4, fields: ['account_id', 'sessions', 'add_to_carts', 'checkouts', 'ecommerce_purchases', 'purchase_revenue'] });
  return reqs;
}

// Transforma as linhas do Windsor nos campos da one page (função pura, sem chamadas externas).
function windsorReport_(w, type, rows) {
  const n = function (v) { return Number(v) || 0; };
  const sum = function (list, f) { return (list || []).reduce(function (s, r) { return s + n(r[f]); }, 0); };
  const r2 = function (v) { return Math.round(v * 100) / 100; };
  const res = metaResultField_(w, type);
  const f = {};
  let results = 0, value = 0;
  const out = { fields: f, creatives: [], suggestedRevenue: 0, sources: [] };

  if (rows.meta) {
    f.invMeta = r2(sum(rows.meta, 'spend'));
    f.clkMeta = sum(rows.meta, 'link_clicks');
    f.impMeta = sum(rows.meta, 'impressions');
    results += sum(rows.meta, res);
    value += sum(rows.meta, 'action_values_omni_purchase');
    out.sources.push('Meta Ads');
    const byName = {};
    (rows.metaAds || []).forEach(function (a) {
      const k = String(a.ad_name || 'Anúncio sem nome').trim();
      const b = byName[k] || (byName[k] = { name: k, inv: 0, res: 0, rev: 0, img: '' });
      b.inv += n(a.spend); b.res += n(a[res]); b.rev += n(a.action_values_omni_purchase);
      if (!b.img && a.thumbnail_url) b.img = String(a.thumbnail_url);
    });
    out.creatives = Object.keys(byName).map(function (k) { return byName[k]; })
      .filter(function (b) { return b.inv > 0; })
      .sort(function (a, b) { return (b.res - a.res) || (b.rev - a.rev) || (b.inv - a.inv); })
      .slice(0, 3)
      .map(function (b) { return { name: b.name, inv: r2(b.inv), res: Math.round(b.res), rev: r2(b.rev), img: b.img }; });
  }
  if (rows.google) {
    f.invGoogle = r2(sum(rows.google, 'spend'));
    f.clkGoogle = sum(rows.google, 'clicks');
    f.impGoogle = sum(rows.google, 'impressions');
    results += sum(rows.google, 'conversions');
    value += sum(rows.google, 'conversion_value');
    out.sources.push('Google Ads');
  }
  if (type === 'inside-sales') {
    if (results) f.leads = Math.round(results);
  } else {
    if (rows.ga4 && rows.ga4.length) {
      f.sessions = sum(rows.ga4, 'sessions');
      f.cart = sum(rows.ga4, 'add_to_carts');
      f.checkout = sum(rows.ga4, 'checkouts');
      f.sales = sum(rows.ga4, 'ecommerce_purchases');
      f.revenueGa4 = r2(sum(rows.ga4, 'purchase_revenue'));
      out.suggestedRevenue = f.revenueGa4;
      out.sources.push('GA4');
    }
    if (!f.sales && results) f.sales = Math.round(results);
    if (!out.suggestedRevenue) out.suggestedRevenue = r2(value);
  }
  return out;
}

function windsorKey_() {
  const key = PropertiesService.getScriptProperties().getProperty('WINDSOR_API_KEY');
  if (!key) throw codeErr_('A chave de API do Windsor ainda não foi configurada no Apps Script (WINDSOR_API_KEY).', 'windsor-key');
  return key;
}

// Faz as chamadas em paralelo; cada resultado vem como { rows } ou { error }.
function windsorFetchAll_(list) {
  const key = windsorKey_();
  const responses = UrlFetchApp.fetchAll(list.map(function (item) {
    const q = Object.keys(item.params).filter(function (k) { return item.params[k]; })
      .map(function (k) { return k + '=' + encodeURIComponent(item.params[k]); }).join('&');
    return { url: WINDSOR_URL + item.connector + '?api_key=' + encodeURIComponent(key) + '&' + q, muteHttpExceptions: true };
  }));
  return responses.map(function (res) {
    let body = null;
    try { body = JSON.parse(res.getContentText()); } catch (e) { /* resposta não-JSON */ }
    if (res.getResponseCode() === 200 && body && !body.error) return { rows: body.data || [] };
    const err = body && body.error;
    const msg = typeof err === 'string' ? err : err && (err.message || JSON.stringify(err));
    return { error: msg || 'HTTP ' + res.getResponseCode() };
  });
}

function codeErr_(message, code) { const e = new Error(message); e.code = code; return e; }

// ── ACESSO ────────────────────────────────────────────────────
function me_() {
  const email = lower_(Session.getActiveUser().getEmail());
  if (!email) { const e = new Error('Não foi possível identificar o e-mail da conta Google.'); e.code = 'NO_EMAIL'; throw e; }
  return email;
}

function access_(email) {
  if (MASTER_EMAILS.map(lower_).indexOf(email) >= 0) return { allowed: true, role: 'master' };
  const a = get_('allowedUsers', email);
  if (a && a.active !== false) return { allowed: true, role: a.role === 'admin' ? 'admin' : 'user' };
  return { allowed: false, role: null };
}

function needAdmin_(ctx) { if (!ctx.admin) throw denied_(); }

function ownClient_(ctx, id) {
  const c = get_('clients', id);
  if (!c) { const e = new Error('Cliente não encontrado.'); e.code = 'not-found'; throw e; }
  if (!ctx.admin && c.ownerUid !== ctx.email) throw denied_();
  return c;
}

function validId_(id) { return typeof id === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(id) ? id : ''; }
function denied_() { const e = new Error('Sem permissão para esta ação.'); e.code = 'permission-denied'; return e; }
function err_(message, code) { return { error: message, code: code || '' }; }
function lower_(s) { return String(s || '').trim().toLowerCase(); }
function pick_(o, keys) { const r = {}; keys.forEach(function (k) { if (o && o[k] !== undefined) r[k] = o[k]; }); return r; }

// ── ARMAZENAMENTO (Google Sheets) ─────────────────────────────
function db_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('DB_ID');
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.create('OnePage Generator — Banco de dados');
  props.setProperty('DB_ID', ss.getId());
  return ss;
}

let ssCache_ = null;
function table_(name) {
  ssCache_ = ssCache_ || db_();
  let sh = ssCache_.getSheetByName(name);
  if (!sh) {
    sh = ssCache_.insertSheet(name);
    sh.appendRow(TABLES[name]);
    sh.setFrozenRows(1);
  }
  return sh;
}

// Cache das abas: na mesma chamada (memo) e entre chamadas (CacheService, 1 min, abas até ~95 KB).
// Toda escrita passa por put_/remove_, que relê a aba dentro do lock e invalida o cache.
let memo_ = {};
function readValues_(name) {
  const sh = table_(name), width = TABLES[name].length, n = sh.getLastRow();
  return n < 2 ? [] : sh.getRange(2, 1, n - 1, width).getValues();
}
function values_(name) {
  if (memo_[name]) return memo_[name];
  const cache = CacheService.getScriptCache();
  const hit = cache.get('tbl:' + name);
  if (hit) return (memo_[name] = JSON.parse(hit));
  const vals = readValues_(name);
  memo_[name] = vals;
  try { const s = JSON.stringify(vals); if (s.length < 95000) cache.put('tbl:' + name, s, 60); } catch (e) { /* aba grande: só memo */ }
  return vals;
}
function invalidate_(name) {
  delete memo_[name];
  CacheService.getScriptCache().remove('tbl:' + name);
}

function rows_(name, fresh) {
  const width = TABLES[name].length;
  return (fresh ? readValues_(name) : values_(name)).map(function (v, i) {
    let data = {};
    try { data = JSON.parse(v[width - 1] || '{}'); } catch (e) { /* linha corrompida */ }
    return { row: i + 2, key: String(v[0]), cols: v.slice(1, width - 1).map(String), data: data };
  });
}

function all_(name) {
  const key = TABLES[name][0];
  return rows_(name).map(function (r) { const d = r.data; if (key !== 'id') d.id = r.key; return d; });
}

function get_(name, key) {
  const r = rows_(name).filter(function (x) { return x.key === key; })[0];
  return r ? r.data : null;
}

function put_(name, key, cols, data) {
  withLock_(function () {
    const sh = table_(name);
    const values = [[key].concat(cols, [JSON.stringify(data)])];
    const r = rows_(name, true).filter(function (x) { return x.key === key; })[0];
    if (r) sh.getRange(r.row, 1, 1, values[0].length).setValues(values);
    else sh.appendRow(values[0]);
    invalidate_(name);
  });
}

function remove_(name, key) {
  withLock_(function () {
    const sh = table_(name);
    rows_(name, true).filter(function (x) { return x.key === key; }).reverse().forEach(function (r) { sh.deleteRow(r.row); });
    invalidate_(name);
  });
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
