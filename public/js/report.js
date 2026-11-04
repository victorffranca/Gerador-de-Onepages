// One page: métricas, renderização, insights automáticos, checagens e exportação.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const num = x => { const v = parseFloat(x); return isFinite(v) ? v : 0; };
export const fmt = n => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtN = n => (n || 0).toLocaleString('pt-BR');
const dec = (n, d = 1) => (n || 0).toFixed(d).replace('.', ',');
const pct = (a, b) => b ? dec(a / b * 100) + '%' : '—';
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export function formatMonth(m, short) {
  if (!m) return '—';
  const [y, mo] = m.split('-');
  const name = MONTHS[parseInt(mo, 10) - 1] || '';
  return short ? name.slice(0, 3) + '/' + y.slice(2) : name + ' ' + y;
}

export const PIPE_FIELDS = [['leads', 'Leads'], ['mql', 'MQL'], ['sql', 'SQL'], ['opps', 'Oportunidades'], ['closes', 'Fechamentos']];

// Todas as métricas derivadas de um relatório (usadas na one page, nos insights e nos resumos).
export function metrics(r) {
  const m = {
    invG: num(r.invGoogle), invM: num(r.invMeta), invO: num(r.invOther),
    clkG: num(r.clkGoogle), clkM: num(r.clkMeta), impG: num(r.impGoogle), impM: num(r.impMeta),
    meta: num(r.meta),
  };
  m.inv = m.invG + m.invM + m.invO;
  m.clicks = m.clkG + m.clkM;
  m.imps = m.impG + m.impM;
  m.cpc = m.clicks ? (m.invG + m.invM) / m.clicks : 0;
  m.ctr = m.imps ? m.clicks / m.imps * 100 : 0;
  if (r.type === 'inside-sales') {
    Object.assign(m, { leads: num(r.leads), mql: num(r.mql), sql: num(r.sql), opps: num(r.opps), closes: num(r.closes), revenue: num(r.isRevenue) });
    m.cpl = m.leads ? m.inv / m.leads : 0;
    m.cac = m.closes ? m.inv / m.closes : 0;
    m.l2c = m.leads ? m.closes / m.leads * 100 : 0;
    m.roi = m.inv ? m.revenue / m.inv : 0;
    m.ticket = m.closes ? m.revenue / m.closes : num(r.isTicket);
  } else {
    Object.assign(m, { sessions: num(r.sessions), cart: num(r.cart), checkout: num(r.checkout), sales: num(r.sales), revenue: num(r.revenue), revenueGa4: num(r.revenueGa4) });
    m.ticket = m.sales ? m.revenue / m.sales : 0;
    m.conv = m.sessions ? m.sales / m.sessions * 100 : 0;
    m.roas = m.inv ? m.revenue / m.inv : 0;
    m.cpa = m.sales ? m.inv / m.sales : 0;
    m.loss = m.revenueGa4 > 0 ? (m.revenueGa4 - m.revenue) / m.revenueGa4 * 100 : null;
  }
  m.metaPct = m.meta ? m.revenue / m.meta * 100 : 0;
  return m;
}

// ── LAYOUT DA ONE PAGE (design system V4 one-page) ────────────
const brl = n => fmt(n).replace(/\s/g, '');
const V4_LOGO = '<span class="op-logo"><svg viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="3" fill="#E30613"/><text x="14" y="22.5" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-weight="900" font-size="22" fill="#fff">4</text></svg>COMPANY</span>';

function period(m) {
  if (!m) return '—';
  const [y, mo] = m.split('-').map(Number);
  const last = new Date(y, mo, 0).getDate();
  return `01–${last} ${(MONTHS[mo - 1] || '').toUpperCase()} · ${y}`;
}

// Card de KPI com o valor do mês anterior ("ant.") e a variação colorida (verde = melhorou).
function kpi(label, cur, prev, format, higherIsBetter = true) {
  let ant = '<span class="op-ant-val">—</span>';
  if (prev !== undefined && prev !== null && isFinite(prev) && prev !== 0) {
    const c = (cur - prev) / prev * 100;
    const cls = Math.abs(c) < 0.05 ? '' : (c > 0) === higherIsBetter ? 'good' : 'bad';
    ant = `<span class="op-ant-val">${format(prev)}</span><span class="op-delta ${cls}">${c > 0 ? '+' : ''}${dec(c)}%</span>`;
  }
  return `<div class="op-card op-kpi"><div class="op-label">${label}</div><div class="op-kpi-val">${format(cur)}</div><div class="op-ant">ant. ${ant}</div></div>`;
}

const row = (label, value, note = '') =>
  `<div class="op-row"><span>${label}</span><span class="op-row-val">${note ? `<em>${note}</em>` : ''}${value}</span></div>`;
const cardHead = (title, extra = '', dot = '') =>
  `<div class="op-card-head">${dot ? `<i class="op-dot" style="background:${dot}"></i>` : ''}<span class="op-label">${title}</span>${extra ? `<span class="op-label op-muted">· ${extra}</span>` : ''}</div>`;
const leader = (name, value) =>
  `<div class="op-leader"><span>${name}</span><b></b><span class="op-leader-val">${value}</span></div>`;

function channelsHTML(m) {
  const chans = [
    { name: 'Meta Ads', inv: m.invM, clk: m.clkM, imp: m.impM, dot: '#3B5BFD' },
    { name: 'Google Ads', inv: m.invG, clk: m.clkG, imp: m.impG, dot: '#F4B400' },
    { name: 'Outros canais', inv: m.invO, clk: 0, imp: 0, dot: '#9CA3AF' },
  ].filter(c => c.inv > 0);
  if (!chans.length) return '';
  return `<div class="op-grid ${chans.length > 1 ? 'op-cols-2' : ''}">${chans.map(c => `<section class="op-card">
    ${cardHead(c.name, dec(m.inv ? c.inv / m.inv * 100 : 0, 0) + '% do investimento', c.dot)}
    ${row('Investimento', brl(c.inv))}
    ${c.imp ? row('Impressões', fmtN(c.imp)) : ''}
    ${c.clk ? row('Cliques', fmtN(c.clk)) : ''}
    ${c.imp && c.clk ? row('CTR', pct(c.clk, c.imp)) : ''}
    ${c.clk ? row('CPC', brl(c.inv / c.clk)) : ''}
  </section>`).join('')}</div>`;
}

function goalHTML(m) {
  if (!m.meta || !m.revenue) return '';
  const fill = Math.min(m.metaPct, 100), hit = m.metaPct >= 100;
  return `<section class="op-card op-goal">
    ${cardHead('Meta de faturamento')}
    <div class="op-goal-line"><span><strong>${brl(m.revenue)}</strong> de ${brl(m.meta)}</span><span class="op-goal-pct ${hit ? 'good' : ''}">${dec(m.metaPct)}%</span></div>
    <div class="op-goal-track"><div class="op-goal-fill ${hit ? 'good' : ''}" style="width:${fill}%"></div></div>
  </section>`;
}

function creativesHTML(r, isIS) {
  const list = [1, 2, 3].map(i => ({
    n: i, name: r['c' + i + 'Name'], rev: num(r['c' + i + 'Rev']), res: num(r['c' + i + 'Sales']),
    inv: num(r['c' + i + 'Inv']), link: safeUrl(r['c' + i + 'Link']), img: safeUrl(r['c' + i + 'Img']),
  })).filter(c => c.name || c.rev || c.res);
  if (!list.length) return '';
  const showRev = list.some(c => c.rev > 0);
  const type = isIS ? 'Leads / conversões' : 'Vendas';
  return `<section class="op-card">
    ${cardHead('Top criativos')}
    <div class="op-table-wrap"><table class="op-table">
      <thead><tr><th colspan="2">Criativo</th><th>Tipo de resultado</th><th class="r">Resultados</th><th class="r">Custo/res.</th><th class="r">Investimento</th>${showRev ? '<th class="r">Faturamento</th>' : ''}</tr></thead>
      <tbody>${list.map(c => `<tr>
        <td class="op-thumb-cell">${c.img ? `<img class="op-thumb" src="${esc(c.img)}" alt="" referrerpolicy="no-referrer">` : `<span class="op-thumb op-thumb-ph">#${c.n}</span>`}</td>
        <td class="op-strong">${c.link ? `<a href="${esc(c.link)}" target="_blank" rel="noopener">${esc(c.name || 'Criativo #' + c.n)}</a>` : esc(c.name || 'Criativo #' + c.n)}</td>
        <td class="op-soft">${type}</td>
        <td class="r op-strong">${c.res ? fmtN(c.res) : '—'}</td>
        <td class="r op-soft">${c.res && c.inv ? brl(c.inv / c.res) + '/res.' : '—'}</td>
        <td class="r op-strong">${c.inv ? brl(c.inv) : '—'}</td>
        ${showRev ? `<td class="r op-strong">${c.rev ? brl(c.rev) : '—'}</td>` : ''}
      </tr>`).join('')}</tbody>
    </table></div>
  </section>`;
}

function insightsHTML(r) {
  const list = (r.insights || []).filter(i => i.title || i.text);
  if (!list.length) return '';
  const box = (title, items) => `<section class="op-card">
    ${cardHead(title)}
    ${items.length ? items.map(i => `<div class="op-insight">${i.title ? `<div class="op-insight-title">${esc(i.title)}</div>` : ''}${i.text ? `<div class="op-insight-text">${esc(i.text).replace(/\n/g, '<br>')}</div>` : ''}</div>`).join('') : '<div class="op-insight op-soft">—</div>'}
  </section>`;
  return `<div class="op-grid op-cols-2">${box('Destaques do período', list.filter(i => i.tipo !== 'opp'))}${box('Pontos de atenção', list.filter(i => i.tipo === 'opp'))}</div>`;
}

// Gera o HTML da one page (conteúdo de .report-wrap).
export function renderReport(r, client, prev) {
  const m = metrics(r), p = prev ? metrics(prev) : {};
  const isIS = r.type === 'inside-sales';
  const agency = r.agency || client.agency || '';
  const isV4 = !agency || /v4/i.test(agency);
  const channels = [m.invM > 0 && 'Meta Ads', m.invG > 0 && 'Google Ads', m.invO > 0 && 'Outros canais'].filter(Boolean).join(' · ');
  const generated = new Date(r.updatedAt || Date.now()).toLocaleDateString('pt-BR');

  const header = `<header class="op-head">
    <div><h1 class="op-client">${esc(client.name || 'Cliente')}</h1><div class="op-period">${period(r.month)}</div></div>
    <div class="op-brand">${isV4 ? V4_LOGO : `<span class="op-logo op-logo-text">${esc(agency)}</span>`}
      ${channels ? `<div class="op-channels">${channels}</div>` : ''}<div class="op-generated">Gerado em ${generated}</div></div>
  </header>`;

  // Sem faturamento/fechamentos (só dados das plataformas), os KPIs passam a ser os de mídia.
  const hasSales = isIS ? m.revenue > 0 || m.closes > 0 : m.revenue > 0 || m.sales > 0;
  const resLabel = r.metaResult === 'messaging' ? 'Conversas' : r.metaResult === 'purchase' && isIS ? 'Compras' : 'Leads';
  let kpis, detail, attribution = '';
  if (!isIS && !hasSales) {
    kpis = [
      kpi('Investimento', m.inv, p.inv, brl),
      kpi('Cliques', m.clicks, p.clicks, fmtN),
      kpi('CPC médio', m.cpc, p.cpc, brl, false),
      kpi('Impressões', m.imps, p.imps, fmtN),
      kpi('CTR', m.ctr, p.ctr, v => dec(v, 2) + '%'),
      kpi('Sessões', m.sessions, p.sessions, fmtN),
    ];
  } else if (!isIS) {
    kpis = [
      kpi('Faturamento', m.revenue, p.revenue, brl),
      kpi('Investimento', m.inv, p.inv, brl),
      kpi('ROAS', m.roas, p.roas, v => dec(v, 2) + 'x'),
      kpi('Vendas', m.sales, p.sales, fmtN),
      kpi('Ticket médio', m.ticket, p.ticket, brl),
      kpi('Tx. conversão', m.conv, p.conv, v => dec(v, 2) + '%'),
    ];
  } else if (!hasSales) {
    kpis = [
      kpi('Investimento', m.inv, p.inv, brl),
      kpi(resLabel, m.leads, p.leads, fmtN),
      kpi(resLabel === 'Conversas' ? 'Custo/conversa' : 'CPL', m.cpl, p.cpl, brl, false),
      kpi('CPC médio', m.cpc, p.cpc, brl, false),
      kpi('Cliques', m.clicks, p.clicks, fmtN),
      kpi('Impressões', m.imps, p.imps, fmtN),
    ];
  } else {
    kpis = [
      kpi('Faturamento', m.revenue, p.revenue, brl),
      kpi('Investimento', m.inv, p.inv, brl),
      kpi(resLabel, m.leads, p.leads, fmtN),
      kpi('CPL', m.cpl, p.cpl, brl, false),
      kpi('Fechamentos', m.closes, p.closes, fmtN),
      kpi('CAC', m.cac, p.cac, brl, false),
    ];
  }
  if (!isIS) {
    detail = !m.sessions ? (m.sales ? `<section class="op-card">${cardHead('Conversões nas plataformas')}${row('Vendas', fmtN(m.sales))}${row('CPA', brl(m.cpa))}</section>` : '') : `<section class="op-card">
      ${cardHead('Funil de conversão', 'GA4', '#E30613')}
      ${row('Cliques em anúncios', fmtN(m.clicks))}
      ${row('Sessões', fmtN(m.sessions), m.clicks ? pct(m.sessions, m.clicks) + ' dos cliques' : '')}
      ${row('Adições ao carrinho', fmtN(m.cart), m.sessions ? pct(m.cart, m.sessions) + ' das sessões' : '')}
      ${row('Início de checkout', fmtN(m.checkout), m.cart ? pct(m.checkout, m.cart) + ' do carrinho' : '')}
      ${row('Vendas', fmtN(m.sales), m.checkout ? pct(m.sales, m.checkout) + ' do checkout' : '')}
      ${row('CPA', brl(m.cpa))}
      ${m.loss !== null ? `<div class="op-alert">Receita no GA4 ${brl(m.revenueGa4)} vs faturamento real ${brl(m.revenue)}: <strong>${dec(m.loss)}% de diferença</strong></div>` : ''}
    </section>`;
    const prods = [1, 2, 3].map(i => ({ name: r['p' + i + 'Name'], sales: num(r['p' + i + 'Sales']), rev: num(r['p' + i + 'Rev']) })).filter(x => x.name);
    if (hasSales) attribution = `<section class="op-card">
      ${cardHead('Atribuição de vendas')}
      ${prods.length ? `<div class="op-sub">Top produtos</div>${prods.map(x => leader(esc(x.name), `${brl(x.rev)} · ${fmtN(x.sales)} vendas${m.revenue ? ` <span class="op-soft">· ${pct(x.rev, m.revenue)} do total</span>` : ''}`)).join('')}` : ''}
      <div class="op-total"><span>Total geral</span><span>${fmtN(m.sales)} vendas · ${brl(m.revenue)}</span></div>
    </section>`;
  } else {
    const fields = r.pipeFields || {};
    // Etapas sem número não aparecem (ex.: relatório só com dados das plataformas).
    const cells = PIPE_FIELDS.filter(([k]) => fields[k] !== false && (m[k] > 0 || k === 'leads'))
      .map(([k, label]) => ({ val: m[k], label: k === 'leads' ? resLabel : label }));
    detail = `<section class="op-card">
      ${cardHead(cells.length > 1 ? 'Pipeline comercial' : 'Resultados', '', '#3B5BFD')}
      ${cells.map((c, i) => row(c.label, fmtN(c.val), i && cells[i - 1].val ? pct(c.val, cells[i - 1].val) + ' da etapa anterior' : '')).join('')}
      ${row(resLabel === 'Conversas' ? 'Custo por conversa' : 'CPL', brl(m.cpl))}
      ${m.closes ? row('Lead → venda', dec(m.l2c) + '%') : ''}
      ${m.revenue ? row('ROI', dec(m.roi, 2) + 'x') : ''}
      ${m.ticket ? row('Ticket médio', brl(m.ticket)) : ''}
    </section>`;
    if (hasSales) attribution = `<section class="op-card">
      ${cardHead('Atribuição de vendas')}
      <div class="op-total"><span>Total geral</span><span>${fmtN(m.closes)} fechamento${m.closes === 1 ? '' : 's'} · ${brl(m.revenue)}</span></div>
    </section>`;
  }
  const summary = r.summary ? `<section class="op-card op-summary">${cardHead('Resumo do mês')}<p>${esc(r.summary).replace(/\n/g, '<br>')}</p></section>` : '';

  const sources = isIS
    ? 'Fontes: plataformas de anúncio + CRM. CPL e CAC calculados sobre o investimento total em mídia.'
    : 'Fontes: plataformas de anúncio + GA4 + e-commerce. ROAS calculado sobre o faturamento real dividido pelo investimento em mídia.';

  return `<article class="op-page">
    ${header}
    <div class="op-grid op-cols-3">${kpis.join('')}</div>
    ${goalHTML(m)}
    ${summary}
    ${channelsHTML(m)}
    ${detail}
    ${creativesHTML(r, isIS)}
    ${attribution}
    ${insightsHTML(r)}
    <footer class="op-foot">
      <div>${sources}</div>
      ${r.notes ? `<div class="op-notes">${esc(r.notes).replace(/\n/g, '<br>')}</div>` : ''}
      <div class="op-foot-brand">${esc(client.name || '')} · ${formatMonth(r.month)}${agency ? ' · ' + esc(agency) : ''}</div>
    </footer>
  </article>`;
}

// ── INSIGHTS AUTOMÁTICOS ──────────────────────────────────────
// Regras simples sobre os números do mês (e do mês anterior, se houver).
// Benchmarks são referências genéricas de e-commerce; o texto deve ser revisado.
export function suggestInsights(r, prev) {
  const m = metrics(r), p = prev ? metrics(prev) : null, out = [];
  const add = (tipo, title, text) => out.push({ tipo, title, text });
  const change = (a, b) => b ? (a - b) / b * 100 : null;
  const prevName = prev ? formatMonth(prev.month) : '';

  if (m.meta && m.revenue) {
    if (m.metaPct >= 100) add('pos', 'Meta de faturamento batida', `O faturamento de ${fmt(m.revenue)} representa ${dec(m.metaPct)}% da meta de ${fmt(m.meta)}.`);
    else add('opp', `Faltaram ${fmt(m.meta - m.revenue)} para a meta`, `O mês fechou em ${dec(m.metaPct)}% da meta de ${fmt(m.meta)}. Avaliar redistribuição de verba para as campanhas e criativos de melhor retorno.`);
  }
  if (p) {
    const c = change(m.revenue, p.revenue);
    if (c !== null && Math.abs(c) >= 5) add(c > 0 ? 'pos' : 'opp', `Faturamento ${c > 0 ? 'cresceu' : 'caiu'} ${dec(Math.abs(c))}% vs mês anterior`, `Passou de ${fmt(p.revenue)} em ${prevName} para ${fmt(m.revenue)}.` + (c < 0 ? ' Vale investigar sazonalidade, estoque e mudanças nas campanhas.' : ''));
  }

  if (r.type !== 'inside-sales') {
    if (p && p.roas) {
      const c = change(m.roas, p.roas);
      if (Math.abs(c) >= 10) add(c > 0 ? 'pos' : 'opp', `ROAS ${c > 0 ? 'subiu' : 'caiu'} para ${dec(m.roas, 2)}×`, `Em ${prevName} o ROAS foi ${dec(p.roas, 2)}× (${c > 0 ? '+' : ''}${dec(c)}%).` + (c < 0 ? ' Revisar segmentações e pausar conjuntos com CPA acima da média.' : ''));
    }
    const stages = [
      { name: 'Sessão → Carrinho', rate: m.sessions && m.cart / m.sessions, bench: 0.06, tip: 'Revisar páginas de produto: fotos, prova social, preço e frete visíveis.' },
      { name: 'Carrinho → Checkout', rate: m.cart && m.checkout / m.cart, bench: 0.45, tip: 'Avaliar frete, cupons e fricção no carrinho; testar lembrete de carrinho abandonado.' },
      { name: 'Checkout → Compra', rate: m.checkout && m.sales / m.checkout, bench: 0.45, tip: 'Simplificar o checkout, destacar Pix/parcelamento e ativar recuperação de checkout.' },
    ].filter(s => s.rate > 0).map(s => ({ ...s, score: s.rate / s.bench }));
    if (stages.length) {
      const worst = stages.reduce((a, b) => (b.score < a.score ? b : a));
      const best = stages.reduce((a, b) => (b.score > a.score ? b : a));
      if (worst.score < 0.8) add('opp', `Gargalo no funil: ${worst.name}`, `Conversão de ${dec(worst.rate * 100)}% nesta etapa, abaixo da referência de ~${dec(worst.bench * 100, 0)}%. ${worst.tip}`);
      else if (best.score >= 1.2) add('pos', `Funil forte em ${best.name}`, `Conversão de ${dec(best.rate * 100)}% nesta etapa, acima da referência de ~${dec(best.bench * 100, 0)}%.`);
    }
    if (m.loss !== null && m.loss > 10) add('opp', `Divergência de ${dec(m.loss)}% entre GA4 e faturamento real`, `GA4 registrou ${fmt(m.revenueGa4)} e o faturamento real foi ${fmt(m.revenue)}. Verificar cancelamentos, pagamentos não aprovados e a configuração de eventos de compra.`);
    if (m.cpa && m.ticket && m.cpa > m.ticket * 0.4) add('opp', 'CPA alto em relação ao ticket', `O CPA de ${fmt(m.cpa)} consome ${dec(m.cpa / m.ticket * 100)}% do ticket médio (${fmt(m.ticket)}). Testar kits, frete grátis acima de um valor ou upsell para aumentar o ticket.`);
  } else {
    const fields = r.pipeFields || {};
    const cells = PIPE_FIELDS.filter(([k]) => fields[k] !== false && m[k] > 0).map(([k, label]) => ({ val: m[k], label }));
    const drops = cells.slice(1).map((c, i) => ({ from: cells[i].label, to: c.label, rate: c.val / cells[i].val }));
    if (drops.length) {
      const worst = drops.reduce((a, b) => (b.rate < a.rate ? b : a));
      add('opp', `Maior perda do pipeline: ${worst.from} → ${worst.to}`, `Apenas ${dec(worst.rate * 100)}% avançam nesta etapa. Revisar critérios de qualificação, velocidade de resposta e cadência de follow-up.`);
    }
    if (p && p.cpl && m.cpl) {
      const c = change(m.cpl, p.cpl);
      if (Math.abs(c) >= 10) add(c < 0 ? 'pos' : 'opp', `CPL ${c < 0 ? 'caiu' : 'subiu'} ${dec(Math.abs(c))}%`, `O custo por lead foi de ${fmt(p.cpl)} em ${prevName} para ${fmt(m.cpl)}.`);
    }
    if (m.inv && m.revenue) {
      if (m.roi < 1) add('opp', `ROI de ${dec(m.roi, 2)}× abaixo do investimento`, `Foram investidos ${fmt(m.inv)} para ${fmt(m.revenue)} gerados. Considerar o ciclo de venda e priorizar canais com menor CAC.`);
      else if (m.roi >= 3) add('pos', `ROI de ${dec(m.roi, 2)}×`, `Cada R$ 1 investido retornou ${fmt(m.roi)} em faturamento.`);
    }
  }

  const c1 = num(r.c1Rev);
  if (r.c1Name && c1 && m.revenue) {
    const share = c1 / m.revenue * 100;
    if (share >= 40) add('opp', `Dependência do criativo "${r.c1Name}"`, `Ele responde por ${dec(share)}% do faturamento. Produzir variações para reduzir o risco de fadiga.`);
    else add('pos', `Criativo destaque: ${r.c1Name}`, `Gerou ${fmt(c1)} (${dec(share)}% do faturamento) — usar como referência para os próximos testes.`);
  }

  // Regras de mídia (valem também quando só há dados das plataformas, sem faturamento/CRM).
  const isIS = r.type === 'inside-sales';
  const resWord = r.metaResult === 'messaging' ? 'conversas' : isIS ? 'leads' : 'vendas';
  const results = isIS ? m.leads : m.sales, pResults = p ? (isIS ? p.leads : p.sales) : 0;
  if (p && results && pResults && !m.revenue) {
    const c = change(results, pResults), ci = change(m.inv, p.inv);
    if (Math.abs(c) >= 5) add(c > 0 ? 'pos' : 'opp', `${c > 0 ? 'Mais' : 'Menos'} ${resWord}: ${fmtN(results)} (${c > 0 ? '+' : '−'}${dec(Math.abs(c))}%)`,
      `Em ${prevName} foram ${fmtN(pResults)}, com investimento ${ci === null ? 'similar' : `${ci >= 0 ? 'maior' : 'menor'} (${ci >= 0 ? '+' : '−'}${dec(Math.abs(ci))}%)`}.` + (c < 0 ? ' Revisar públicos e ofertas das campanhas de conversão.' : ''));
    const cpr = m.inv / results, pcpr = p.inv / pResults, cc = change(cpr, pcpr);
    if (isIS && !(p.cpl && m.cpl) && Math.abs(cc) >= 10) add(cc < 0 ? 'pos' : 'opp', `Custo por ${resWord.replace(/s$/, '')} ${cc < 0 ? 'caiu' : 'subiu'} ${dec(Math.abs(cc))}%`, `Passou de ${fmt(pcpr)} para ${fmt(cpr)}.`);
  }
  if (p && p.cpc && m.cpc) {
    const c = change(m.cpc, p.cpc);
    if (Math.abs(c) >= 10) add(c < 0 ? 'pos' : 'opp', `CPC médio ${c < 0 ? 'caiu' : 'subiu'} ${dec(Math.abs(c))}%`, `De ${fmt(p.cpc)} para ${fmt(m.cpc)} por clique.` + (c > 0 ? ' Testar novos criativos e revisar a segmentação para recuperar a eficiência.' : ''));
  }
  if (m.imps > 5000 && m.ctr && m.ctr < 0.8) add('opp', `CTR de ${dec(m.ctr, 2)}% abaixo do ideal`, 'Os anúncios estão gerando poucos cliques por impressão. Testar ganchos mais diretos nos primeiros segundos e chamadas para ação mais claras.');
  const creatives = [1, 2, 3].map(i => ({ name: r['c' + i + 'Name'], res: num(r['c' + i + 'Sales']), inv: num(r['c' + i + 'Inv']) })).filter(c => c.name && c.res && c.inv);
  if (creatives.length && results && !m.revenue) {
    const best = creatives.reduce((a, b) => (b.res > a.res ? b : a));
    const share = best.res / results * 100;
    add('pos', `Criativo destaque: ${best.name}`, `Gerou ${fmtN(best.res)} ${resWord} (${dec(share)}% do total), a ${fmt(best.inv / best.res)} cada. Usar como base para novas variações.`);
    const worst = creatives.reduce((a, b) => (b.inv / b.res > a.inv / a.res ? b : a));
    if (worst !== best && worst.inv / worst.res > (m.inv / results) * 1.3) add('opp', `Revisar o criativo "${worst.name}"`, `Custo de ${fmt(worst.inv / worst.res)} por resultado, acima da média da conta (${fmt(m.inv / results)}). Avaliar pausar ou substituir.`);
  }
  return out.slice(0, 6);
}

// ── CHECAGEM DE CONSISTÊNCIA ──────────────────────────────────
export function checkData(r) {
  const m = metrics(r), w = [];
  if (!r.month) w.push('Informe o mês de análise.');
  if (!m.inv) w.push('Nenhum investimento em mídia informado.');
  if (r.type === 'inside-sales') {
    const f = r.pipeFields || {};
    const cells = PIPE_FIELDS.filter(([k]) => f[k] !== false && m[k] > 0);
    cells.slice(1).forEach(([k, label], i) => { if (m[k] > m[cells[i][0]]) w.push(`${label} (${fmtN(m[k])}) maior que ${cells[i][1]} (${fmtN(m[cells[i][0]])}).`); });
    if (m.closes && !m.revenue) w.push('Há fechamentos, mas o faturamento gerado está vazio.');
  } else {
    if (m.cart > m.sessions && m.sessions) w.push('Add to Cart maior que Sessões.');
    if (m.checkout > m.cart && m.cart) w.push('Início de Checkout maior que Add to Cart.');
    if (m.sales > m.checkout && m.checkout) w.push('Vendas maiores que Início de Checkout.');
    if (m.sales && !m.revenue) w.push('Há vendas, mas o faturamento real está vazio.');
    if (m.revenue && !m.sales) w.push('Há faturamento, mas o número de vendas está vazio (ticket médio ficará zerado).');
  }
  if (m.impG && m.clkG > m.impG) w.push('Cliques do Google maiores que impressões.');
  if (m.impM && m.clkM > m.impM) w.push('Cliques da Meta maiores que impressões.');
  return w;
}

// ── MELHORIAS NAS CAMPANHAS ───────────────────────────────────
export const OBJECTIVES = {
  OUTCOME_LEADS: 'Leads', OUTCOME_SALES: 'Vendas', OUTCOME_TRAFFIC: 'Tráfego', OUTCOME_AWARENESS: 'Reconhecimento',
  OUTCOME_ENGAGEMENT: 'Engajamento', OUTCOME_APP_PROMOTION: 'App', LEAD_GENERATION: 'Leads', CONVERSIONS: 'Conversões',
  MESSAGES: 'Mensagens', LINK_CLICKS: 'Tráfego', REACH: 'Alcance', BRAND_AWARENESS: 'Reconhecimento', VIDEO_VIEWS: 'Visualizações',
  SEARCH: 'Pesquisa', PERFORMANCE_MAX: 'PMax', DISPLAY: 'Display', VIDEO: 'YouTube', SHOPPING: 'Shopping', DEMAND_GEN: 'Demand Gen', SMART: 'Inteligente',
};
const META_CONVERSION = ['OUTCOME_LEADS', 'OUTCOME_SALES', 'OUTCOME_ENGAGEMENT', 'LEAD_GENERATION', 'CONVERSIONS', 'MESSAGES', 'PRODUCT_CATALOG_SALES'];
export const isConversionCampaign = c => (c.plat === 'google' ? !['VIDEO', 'DISPLAY'].includes(c.objective) || c.res > 0 : META_CONVERSION.includes(c.objective) || c.res > 0);

// Regras automáticas (usadas quando a IA não está configurada). Avaliam cada campanha pelo objetivo dela.
export function campaignImprovements(r) {
  const list = (r.campaigns || []).filter(c => c.inv > 0);
  if (!list.length) return [];
  const out = [];
  const plat = c => (c.plat === 'meta' ? 'Meta Ads' : 'Google Ads');
  const add = (prioridade, c, acao, motivo) => out.push({ prioridade, plataforma: c ? plat(c) : 'Geral', campanha: c ? c.name : 'Conta inteira', acao, motivo, done: false });
  const conv = list.filter(isConversionCampaign);
  const totInv = list.reduce((s, c) => s + c.inv, 0);
  // Média de custo por resultado por plataforma: "conversões" do Google e da Meta não são comparáveis entre si.
  const avgOf = plat => {
    const same = conv.filter(c => c.plat === plat && c.res);
    const res = same.reduce((s, c) => s + c.res, 0);
    return same.length >= 2 && res ? same.reduce((s, c) => s + c.inv, 0) / res : 0;
  };
  const avgs = { meta: avgOf('meta'), google: avgOf('google') };
  const allClicks = list.reduce((s, c) => s + c.clicks, 0), allCpc = allClicks ? list.reduce((s, c) => s + (c.clicks ? c.inv : 0), 0) / allClicks : 0;

  conv.forEach(c => {
    const avg = avgs[c.plat];
    const cpr = c.res ? c.inv / c.res : null;
    if (!c.res && c.inv >= Math.max(totInv * 0.1, 50)) add('alta', c, 'Pausar ou reestruturar a campanha', `${fmt(c.inv)} investidos no mês sem nenhum resultado.`);
    else if (cpr && avg && cpr > avg * 1.5) add('media', c, 'Reduzir a verba e revisar público e criativos', `Custo por resultado de ${fmt(cpr)}, ${dec((cpr / avg - 1) * 100, 0)}% acima da média das campanhas da plataforma (${fmt(avg)}).`);
    else if (cpr && avg && cpr < avg * 0.75 && c.res >= 5) add('alta', c, 'Escalar a verba em 20% a 30%', `Melhor eficiência da plataforma: ${fmtN(c.res)} resultados a ${fmt(cpr)} cada, contra média de ${fmt(avg)}.`);
    if (cpr && c.prev && c.prev.res) {
      const pcpr = c.prev.inv / c.prev.res, ch = (cpr - pcpr) / pcpr * 100;
      if (ch >= 25) add('media', c, 'Investigar a piora em relação ao mês anterior', `Custo por resultado subiu ${dec(ch, 0)}% (de ${fmt(pcpr)} para ${fmt(cpr)}).`);
    }
  });
  list.forEach(c => {
    if (c.plat === 'meta' && c.freq && c.freq > 3.5) add('media', c, 'Renovar criativos ou ampliar o público', `Frequência de ${dec(c.freq, 1)}: o mesmo público está vendo os anúncios muitas vezes, sinal de fadiga.`);
    const ctr = c.imps ? c.clicks / c.imps * 100 : 0;
    if (c.plat === 'meta' && c.clicks && c.imps > 5000 && ctr < 0.7) add('baixa', c, 'Testar novos ganchos e chamadas nos criativos', `CTR de ${dec(ctr, 2)}%, abaixo de 0,7%.`);
    if (!isConversionCampaign(c) && c.clicks && allCpc && c.inv / c.clicks > allCpc * 1.5) add('baixa', c, 'Revisar segmentação para baratear o clique', `CPC de ${fmt(c.inv / c.clicks)}, acima da média da conta (${fmt(allCpc)}).`);
    if (c.plat === 'google' && c.isBudget != null && c.isBudget >= 0.2) add(c.res && c.inv / c.res <= (avgs.google || Infinity) ? 'alta' : 'media', c, 'Aumentar o orçamento diário', `A campanha deixa de aparecer em ${dec(c.isBudget * 100, 0)}% das buscas por falta de orçamento.`);
    if (c.plat === 'google' && c.isRank != null && c.isRank >= 0.3) add('media', c, 'Melhorar anúncios, palavras-chave e lances', `${dec(c.isRank * 100, 0)}% das impressões são perdidas por classificação do anúncio (parcela de impressões de ${c.is != null ? dec(c.is * 100, 0) + '%' : '—'}).`);
  });
  const order = { alta: 0, media: 1, baixa: 2 };
  return out.sort((a, b) => order[a.prioridade] - order[b.prioridade]).slice(0, 10);
}

// ── ESTILO DA ONE PAGE (usado no app e no HTML baixado) ───────
export const REPORT_CSS = `
.report-wrap{--op-ink:#111318;--op-text:#2B2F36;--op-soft:#8A9099;--op-line:#E4E6EA;--op-line2:#EEF0F2;--op-red:#E30613;--op-good:#16A34A;--op-bad:#DC2626;font-family:'Inter',Arial,sans-serif;background:#EEF0F3;color:var(--op-text);font-size:13px;line-height:1.45;padding:28px 16px 48px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.report-wrap *{margin:0;padding:0;box-sizing:border-box}
.op-page{background:#fff;max-width:860px;margin:0 auto;padding:40px 44px 32px;border-radius:6px;box-shadow:0 2px 18px rgba(17,19,24,.07)}
.op-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;padding-bottom:16px;border-bottom:2px solid var(--op-red);margin-bottom:18px}
.op-client{font-size:34px;font-weight:800;letter-spacing:-1.1px;line-height:1.05;color:var(--op-ink)}
.op-period{margin-top:8px;font-size:11px;font-weight:600;letter-spacing:2.6px;color:var(--op-soft)}
.op-brand{text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:3px}
.op-logo{display:inline-flex;align-items:center;gap:5px;font-size:20px;font-weight:900;letter-spacing:-.4px;color:var(--op-ink);line-height:1}
.op-logo svg{width:24px;height:24px}
.op-logo-text{font-size:16px;font-weight:800}
.op-channels{font-size:13px;font-weight:500;color:var(--op-text);margin-top:4px}
.op-generated{font-size:11px;color:var(--op-soft)}
.op-grid{display:grid;gap:12px;margin-bottom:12px}
.op-grid>.op-card{margin-bottom:0}
.op-cols-2{grid-template-columns:1fr 1fr}
.op-cols-3{grid-template-columns:repeat(3,1fr)}
.op-card{background:#fff;border:1px solid var(--op-line);border-radius:10px;padding:16px 20px;margin-bottom:12px;break-inside:avoid}
.op-label{font-size:10.5px;font-weight:600;letter-spacing:2.2px;text-transform:uppercase;color:var(--op-soft)}
.op-label.op-muted{letter-spacing:1.2px;font-weight:500;color:#A3A8B0}
.op-kpi .op-label{display:block;margin-bottom:6px}
.op-kpi-val{font-size:32px;font-weight:800;letter-spacing:-1.2px;line-height:1.05;color:var(--op-ink);white-space:nowrap}
.op-ant{margin-top:8px;font-size:11.5px;color:var(--op-soft);display:flex;gap:6px;align-items:baseline;flex-wrap:wrap}
.op-ant-val{color:var(--op-soft)}
.op-delta{font-weight:700;color:var(--op-soft)}
.op-delta.good{color:var(--op-good)}
.op-delta.bad{color:var(--op-bad)}
.op-card-head{display:flex;align-items:center;gap:7px;padding-bottom:12px;margin-bottom:4px;border-bottom:1px solid var(--op-line2)}
.op-card-head .op-label:first-of-type{font-weight:700;color:#5F6670}
.op-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.op-row{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid var(--op-line2);font-size:13px}
.op-row:last-child{border-bottom:none}
.op-row-val{font-weight:700;color:var(--op-ink);text-align:right;white-space:nowrap}
.op-row-val em{font-style:normal;font-weight:500;color:var(--op-soft);font-size:11.5px;margin-right:10px}
.op-summary p{margin-top:10px;font-size:13.5px;line-height:1.6;color:var(--op-text)}
.op-alert{margin-top:10px;padding:10px 12px;border-radius:8px;background:#FEF2F2;color:#991B1B;font-size:12px}
.op-goal-line{display:flex;justify-content:space-between;align-items:baseline;margin:10px 0 8px;font-size:13px}
.op-goal-line strong{color:var(--op-ink);font-weight:800}
.op-goal-pct{font-size:18px;font-weight:800;color:var(--op-red);letter-spacing:-.4px}
.op-goal-pct.good{color:var(--op-good)}
.op-goal-track{height:6px;background:var(--op-line2);border-radius:3px;overflow:hidden}
.op-goal-fill{height:100%;background:var(--op-red);border-radius:3px}
.op-goal-fill.good{background:var(--op-good)}
.op-sub{font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--op-soft);margin:12px 0 4px}
.op-leader{display:flex;align-items:baseline;gap:8px;padding:6px 0;font-size:13px}
.op-leader b{flex:1;border-bottom:1px dotted #C9CDD3;transform:translateY(-3px)}
.op-leader-val{white-space:nowrap;color:var(--op-text);font-weight:600}
.op-soft{color:var(--op-soft);font-weight:400}
.op-strong{font-weight:700;color:var(--op-ink)}
.op-strong a{color:inherit;text-decoration:none;border-bottom:1px solid var(--op-line)}
.op-total{display:flex;justify-content:space-between;gap:12px;margin-top:14px;padding-top:14px;border-top:2px solid var(--op-red);font-size:13px;font-weight:800;text-transform:uppercase;color:var(--op-ink)}
.op-total span:last-child{color:var(--op-red);font-size:15px;text-transform:none;white-space:nowrap}
.op-table-wrap{overflow-x:auto}
.op-table{width:100%;border-collapse:collapse;font-size:13px}
.op-table th{font-size:10px;font-weight:600;letter-spacing:1.8px;text-transform:uppercase;color:var(--op-soft);text-align:left;padding:12px 8px 10px;border-bottom:1px solid var(--op-line2);white-space:nowrap}
.op-table td{padding:10px 8px;border-bottom:1px solid var(--op-line2);vertical-align:middle}
.op-table tr:last-child td{border-bottom:none}
.op-table .r{text-align:right;white-space:nowrap}
.op-thumb-cell{width:58px;padding-left:0!important}
.op-thumb{width:48px;height:48px;border-radius:6px;object-fit:cover;display:block;border:1px solid var(--op-line)}
.op-thumb-ph{display:flex;align-items:center;justify-content:center;background:#F4F5F7;color:var(--op-soft);font-size:12px;font-weight:700}
.op-insight{padding:10px 0;border-bottom:1px solid var(--op-line2)}
.op-insight:last-child{border-bottom:none;padding-bottom:0}
.op-insight-title{font-weight:700;color:var(--op-ink);margin-bottom:2px}
.op-insight-text{font-size:12.5px;color:#4B515A}
.op-foot{margin-top:18px;padding-top:12px;border-top:1px solid var(--op-line);font-size:11.5px;color:#5F6670}
.op-notes{margin-top:6px;font-style:italic;color:var(--op-soft)}
.op-foot-brand{margin-top:10px;font-size:11px;color:#A3A8B0}
@media screen and (max-width:760px){
  .report-wrap{padding:0}
  .op-page{padding:24px 16px;border-radius:0;box-shadow:none}
  .op-head{flex-direction:column;align-items:flex-start}
  .op-brand{align-items:flex-start;text-align:left}
  .op-client{font-size:28px}
  .op-cols-3{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .op-cols-2{grid-template-columns:minmax(0,1fr)}
  .op-kpi-val{font-size:20px;letter-spacing:-.6px;white-space:normal;overflow-wrap:anywhere}
  .op-card{padding:14px}
}
@page{size:A4;margin:10mm}
@media print{
  .report-wrap{background:#fff;padding:0}
  .op-page{max-width:none;padding:0;box-shadow:none;border-radius:0}
  .op-client{font-size:30px}
  .op-head{margin-bottom:14px;padding-bottom:12px}
  .op-grid{gap:10px;margin-bottom:10px}
  .op-card{padding:12px 16px;margin-bottom:10px}
  .op-card-head{padding-bottom:8px}
  .op-kpi-val{font-size:28px}
  .op-row{padding:5px 0;font-size:12px}
  .op-table-wrap{overflow:visible}
  .op-table{font-size:12px}
  .op-table th{letter-spacing:1px;padding:8px 5px;white-space:normal}
  .op-table td{padding:6px 5px}
  .op-thumb{width:40px;height:40px}
  .op-thumb-cell{width:46px}
  .op-insight{padding:6px 0}
}
`;

export function downloadReport(r, client, prev) {
  const title = 'One Page — ' + (client.name || '') + ' — ' + formatMonth(r.month);
  const html = '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1.0">\n<title>' + esc(title) + '</title>\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">\n' +
    '<style>body{margin:0;background:#EEF0F3}' + REPORT_CSS + '</style>\n</head>\n<body>\n<div class="report-wrap">\n' + renderReport(r, client, prev) + '\n</div>\n</body>\n</html>';
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'onepage_' + (client.name || 'cliente').replace(/[^\w\-]+/g, '_') + '_' + (r.month || '') + '.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
