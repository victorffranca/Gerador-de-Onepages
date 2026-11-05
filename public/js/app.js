import { createBackend, isDemo, isMaster, isAutoDomain, lower } from './db.js';
import { MASTER_EMAILS, AUTO_ALLOW_DOMAINS, DEFAULT_AGENCY } from './config.js';
import { showReplies, viewMine, loadMine, sendReply, toggleReplyBox } from './people.js';
import { initPeople, ICON, applyProfile, profileChip, toggleMenu, refreshTopbar, openProfileModal, redrawPfPhoto, pickProfilePhoto, saveProfileFromModal, openFeedbackModal, drawFeedbackModal, redrawFeedbackFiles, updateFeedbackState, addFeedbackFiles, sendFeedback, loadFeedback, viewFeedback, loadFeedbackThumbs, zoomFeedbackFile, setFeedbackStatus } from './people.js';
import { esc, fmt, fmtN, formatMonth, metrics, renderReport, suggestInsights, checkData, downloadReport, REPORT_CSS, PIPE_FIELDS, campaignImprovements, OBJECTIVES, isConversionCampaign } from './report.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const root = $('#root');

const S = {
  user: null, access: null, view: 'clients', dirty: false,
  clients: [], profiles: [], ownerFilter: 'mine', search: '',
  client: null, reports: [], report: null, draftType: 'ecommerce', draftPipe: {},
  admin: { allowed: [], requests: [], profiles: [], allClients: [] }, pendingCount: 0,
};
let api;

const TYPES = {
  'ecommerce': { label: 'E-commerce', icon: '🛒', desc: 'Funil de vendas, ROAS, faturamento e conversão.' },
  'inside-sales': { label: 'Inside Sales', icon: '🎯', desc: 'Pipeline de leads, MQL, SQL e fechamentos.' },
};
// Logo Ferraz Piai & Co. (public/img/logov4.png, branca sobre preto). No fundo claro o CSS inverte as cores;
// na publicação o build troca o caminho pela imagem embutida (o Apps Script não serve arquivos de imagem).
const BRAND = '<img class="brand-logo" src="img/logov4.png" alt="Ferraz Piai &amp; Co." width="500" height="167">';
const GOOGLE_ICON = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

// ── HELPERS ───────────────────────────────────────────────────
const isAdmin = () => ['master', 'admin'].includes(S.access?.role);
const avatar = u => (u.photo || u.googlePhoto)
  ? `<img class="avatar" src="${esc(u.photo || u.googlePhoto)}" alt="" referrerpolicy="no-referrer">`
  : `<span class="avatar">${esc((u.name || u.email || '?').trim().charAt(0).toUpperCase())}</span>`;
const dateBR = t => t ? new Date(t).toLocaleDateString('pt-BR') : '—';
const ym = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
const lastMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return ym(d); };
const nextMonth = m => { const [y, mo] = m.split('-').map(Number); return ym(new Date(y, mo, 1)); };
const compact = v => 'R$ ' + (v || 0).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const byMonthDesc = (a, b) => (b.month || '').localeCompare(a.month || '');
const allPipeOn = () => Object.fromEntries(PIPE_FIELDS.map(([k]) => [k, true]));
const findClient = id => (S.client?.id === id ? S.client : S.clients.find(c => c.id === id));
const findReport = id => S.reports.find(r => r.id === id);
const prevOf = r => S.reports.filter(x => x.id !== r.id && x.month && x.month < r.month).sort(byMonthDesc)[0] || null;
const duplicateMonth = r => S.reports.find(x => x.month === r.month && x.id !== r.id);

function toast(msg, kind) {
  const t = document.createElement('div');
  t.className = 'toast' + (kind === 'err' ? ' err' : '');
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), kind === 'err' ? 6000 : 3200);
}

function friendly(e) {
  const code = e?.code || '';
  if (code.includes('permission-denied')) return 'Sem permissão para esta ação.';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'Login cancelado.';
  if (code === 'auth/popup-blocked') return 'O navegador bloqueou a janela de login. Libere pop-ups para este site.';
  if (code === 'auth/unauthorized-domain') return 'Domínio não autorizado no Firebase (Authentication → Configurações → Domínios autorizados).';
  return e?.message || 'Algo deu errado.';
}

async function safe(fn) {
  try { return await fn(); } catch (e) { console.error(e); toast(friendly(e), 'err'); }
}

const empty = (icon, title, text, action = '') =>
  `<div class="empty"><div class="big">${icon}</div><h3>${title}</h3><p>${text}</p>${action}</div>`;
const stateCard = (icon, title, text, actions = '') =>
  `<div class="state-card"><div class="big">${icon}</div><h1>${title}</h1><p>${text}</p>${actions}</div>`;

// ── BOOT / AUTH ───────────────────────────────────────────────
initPeople({ S, get api() { return api; }, $, $$, toast, safe, friendly, queueWrite: (...a) => queueWrite(...a), avatar, go: (...a) => go(...a), closeModal: () => closeModal(), isDemo, render: () => render(), topbar: () => topbar() });
document.head.insertAdjacentHTML('beforeend', `<style>${REPORT_CSS}</style>`);

(async () => {
  root.innerHTML = '<div class="boot">Conectando ao servidor…</div>';
  try { api = await createBackend(); } catch (e) {
    console.error(e);
    root.innerHTML = stateCard('⚠️', 'Não foi possível iniciar', esc(friendly(e)));
    return;
  }
  api.onAuth(onAuth);
})();

async function onAuth(user, err) {
  S.user = user; S.access = null;
  if (err) {
    const retry = '<button class="btn-primary" data-act="login">Tentar novamente</button>';
    const multi = ' Isso costuma acontecer quando há <strong>mais de uma conta Google</strong> logada no navegador. Abra o link numa <strong>janela anônima</strong> e entre só com a conta da empresa.';
    root.innerHTML = err.code === 'NO_EMAIL'
      ? stateCard('🔑', 'Não foi possível identificar sua conta', 'O Google não informou seu e-mail para este app. Entre com uma conta Google da empresa e recarregue a página.' + multi, retry)
      : err.code === 'TIMEOUT' || /401|403|NetworkError|autoriza|authoriz/i.test(err.message || '')
        ? stateCard('⏳', 'O servidor do Google não respondeu', 'O app abriu, mas não conseguiu falar com o servidor.' + multi, retry)
        : stateCard('⚠️', 'Não foi possível iniciar', esc(friendly(err)), retry);
    return;
  }
  if (!user) return renderLogin();
  root.innerHTML = '<div class="boot">Verificando acesso…</div>';
  try { S.access = await api.getAccess(user); } catch (e) { console.error(e); S.access = { allowed: false }; }
  if (!S.access.allowed) {
    if (!S.access.blocked) await api.requestAccess(user).catch(console.error);
    return renderNoAccess();
  }
  if (!api.isAppsScript) await api.touchProfile(user).catch(console.error);
  S.ownerFilter = 'mine'; S.search = ''; S.dirty = false; S.feedback = null;
  try { S.profile = await api.getProfile(user); } catch (e) { console.error(e); S.profile = { email: user.email, name: user.name, cargo: '' }; }
  applyProfile();
  root.innerHTML = '<div class="boot">Carregando seus clientes…</div>';
  try { await loadAll(false); } catch (e) { console.error(e); toast(friendly(e), 'err'); }
  await go('clients');
  if (!S.profile.cargo) openProfileModal(true); // primeiro acesso: pergunta o cargo
  else showReplies(); // respostas do mestre aos chamados desta pessoa
  preloadIntegrations();
}

// ── DADOS EM MEMÓRIA ──────────────────────────────────────────
// Tudo (clientes, one pages e, para admins, acessos) é carregado de uma vez; a navegação usa a memória
// e as gravações atualizam a memória na hora. O servidor é reconsultado em segundo plano.
S.data = { clients: [], reports: {}, profiles: [], allowed: [], requests: [], at: 0 };

async function loadAll(force) {
  const d = api.bootstrap ? await api.bootstrap(force) : await compositeLoad();
  S.data = { clients: d.clients || [], reports: d.reports || {}, profiles: d.profiles || [], allowed: d.allowed || [], requests: d.requests || [], at: Date.now() };
  S.pendingCount = isAdmin() ? pendingOnly(S.data.requests, S.data.allowed).length : 0;
  S.replies = d.replies || (api.isAppsScript ? [] : (await api.myFeedback(S.user).catch(() => [])).filter(f => f.reply && !f.replySeen));
  if (d.feedbackNew != null) S.feedbackNew = d.feedbackNew;
  else if (S.access?.role === 'master' && !api.isAppsScript) S.feedbackNew = (await api.listFeedback(S.user).catch(() => [])).filter(f => (f.status || 'novo') === 'novo').length;
  applyProfile();
}

// Demonstração/Firebase: monta a mesma carga a partir das chamadas individuais.
async function compositeLoad() {
  const admin = isAdmin();
  const clients = await api.listClients(admin ? null : S.user.uid);
  const reports = {};
  await Promise.all(clients.map(async c => { reports[c.id] = await api.listReports(c.id); }));
  const out = { clients, reports };
  if (admin) [out.profiles, out.allowed, out.requests] = await Promise.all([api.listProfiles(), api.listAllowed(), api.listRequests()]);
  return out;
}

// ── GRAVAÇÃO EM SEGUNDO PLANO ─────────────────────────────────
// A tela atualiza na hora; o servidor recebe as gravações em fila (uma de cada vez, na ordem), então um
// cliente novo sempre chega antes das one pages dele. Se uma gravação falhar, avisa e recarrega do servidor.
const newId = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
S.pendingWrites = 0;
let writeQueue = Promise.resolve();

function updateSaving() {
  const el = $('#saving');
  if (el) el.hidden = !S.pendingWrites;
}

function queueWrite(fn) {
  S.pendingWrites++;
  updateSaving();
  writeQueue = writeQueue.then(fn).catch(e => {
    console.error(e);
    toast('Não foi possível salvar: ' + friendly(e) + ' Os dados foram recarregados do servidor.', 'err');
    refreshData();
  }).finally(() => { S.pendingWrites--; updateSaving(); });
  return writeQueue;
}

let refreshing = null;
function refreshData() {
  if (refreshing) return refreshing;
  refreshing = loadAll(true).then(() => {
    const typing = document.activeElement && document.activeElement.closest && document.activeElement.closest('#root input, #root textarea');
    if (['clients', 'client', 'admin'].includes(S.view) && !$('#modal').innerHTML && !typing) { syncViewData(); render(); }
    else { const tb = $('.topbar'); if (tb) tb.outerHTML = topbar(); }
    if (!typing) showReplies();
  }).catch(console.error).finally(() => { refreshing = null; });
  return refreshing;
}

function syncViewData() {
  const f = S.ownerFilter;
  S.clients = S.data.clients.filter(c => f === 'all' || c.ownerUid === (f === 'mine' ? S.user.uid : f))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
  S.profiles = [...S.data.profiles].sort((a, b) => (a.email || '').localeCompare(b.email || ''));
  if (S.client) {
    S.client = S.data.clients.find(c => c.id === S.client.id) || S.client;
    S.reports = S.data.reports[S.client.id] || [];
  }
  S.admin = { allowed: S.data.allowed, requests: pendingOnly(S.data.requests, S.data.allowed), profiles: S.data.profiles, allClients: S.data.clients };
  S.pendingCount = isAdmin() ? S.admin.requests.length : 0;
}

function upsertClientLocal(c) {
  const i = S.data.clients.findIndex(x => x.id === c.id);
  if (i >= 0) S.data.clients[i] = { ...S.data.clients[i], ...c };
  else { S.data.clients.push(c); S.data.reports[c.id] = S.data.reports[c.id] || []; }
  if (S.client?.id === c.id) S.client = S.data.clients.find(x => x.id === c.id);
}

function upsertReportLocal(clientId, rep) {
  const list = (S.data.reports[clientId] || []).filter(r => r.id !== rep.id).concat(rep);
  S.data.reports[clientId] = list;
  if (S.client?.id === clientId) S.reports = list;
}

function removeReportLocal(clientId, id) {
  S.data.reports[clientId] = (S.data.reports[clientId] || []).filter(r => r.id !== id);
  if (S.client?.id === clientId) S.reports = S.data.reports[clientId];
}

// Deixa prontas as informações usadas nos modais (contas do Windsor, status da IA).
function preloadIntegrations() {
  if (!api.isAppsScript) return;
  // Em paralelo (a lista de contas só é usada se o Windsor estiver configurado).
  api.windsorStatus().then(s => { S.windsorStatus = s; }).catch(console.error);
  api.windsorAccounts().then(a => { S.windsorAccounts = a; }).catch(() => {});
  api.aiStatus().then(s => { S.aiConfigured = s.configured; }).catch(console.error);
}

function renderLogin() {
  root.innerHTML = `<div class="login-wrap">
    <div class="login-side">
      <div class="brand">${BRAND}</div>
      <div>
        <h2>Relatórios de performance em <em>uma página</em>.</h2>
        <p>Cadastre seus clientes, preencha os números do mês e gere one pages prontas para enviar, com comparação automática e sugestões de insights.</p>
      </div>
      <div class="login-feats"><span>📊 E-commerce e Inside Sales</span><span>📈 Comparativo com o mês anterior</span><span>💡 Insights sugeridos automaticamente</span></div>
    </div>
    <div class="login-main"><div class="login-card">
      <h1>Entrar</h1>
      <div class="sub">Use sua conta Google para acessar seus clientes.</div>
      <button class="btn-google" data-act="login">${GOOGLE_ICON} Entrar com Google</button>
      ${isDemo ? `<div class="demo-box"><strong>Modo demonstração</strong>: você está abrindo o app fora do Google Apps Script. Entre com qualquer e-mail para simular o login (os dados ficam só neste navegador).
        <div class="form-group"><input id="demo-email" type="email" value="${esc(MASTER_EMAILS[0] || '')}" placeholder="email@empresa.com"></div></div>` : ''}
      <div class="login-note">Contas @v4company.com entram direto. Outros e-mails precisam de liberação do administrador.</div>
    </div></div>
  </div>`;
}

function renderNoAccess() {
  const blocked = S.access && S.access.blocked;
  root.innerHTML = stateCard('🔒', blocked ? 'Acesso bloqueado' : 'Acesso aguardando liberação',
    blocked ? `O acesso de <strong>${esc(S.user.email)}</strong> foi bloqueado pelo administrador. Fale com ele se precisar de acesso.`
      : `Você entrou como <strong>${esc(S.user.email)}</strong>. Sua solicitação foi enviada ao administrador. Assim que for liberada, clique em “Verificar novamente”.`,
    '<button class="btn-secondary" data-act="recheck">Verificar novamente</button>' + (api.canSignOut ? ' <button class="btn-primary" data-act="logout">Sair</button>' : ''));
}

const pendingOnly = (requests, allowed) =>
  requests.filter(q => !isMaster(q.email) && !allowed.some(a => a.email === q.email && a.active !== false));

// ── NAVEGAÇÃO ─────────────────────────────────────────────────
async function go(view, params = {}) {
  if (S.view === 'editor' && S.dirty && view !== 'editor' && !confirm('Descartar as alterações não salvas?')) return;
  S.dirty = false;
  closeModal();
  S.view = view;
  if (params.client) S.client = params.client;
  syncViewData();
  render();
  window.scrollTo(0, 0);
  // Mostra na hora o que está em memória e atualiza em segundo plano se os dados tiverem mais de 30 s.
  if (['clients', 'client', 'admin'].includes(view) && Date.now() - S.data.at > 30000) refreshData();
  if (view === 'mine') safe(async () => { await loadMine(); if (S.view === 'mine') render(); });
  if (view === 'feedback') {
    if (!S.feedback) safe(async () => { await loadFeedback(); if (S.view === 'feedback') { render(); loadFeedbackThumbs(); } });
    else loadFeedbackThumbs();
  }
}

function show(view) {
  if (view === 'report') S.reportTab = 'page'; // sempre abre na one page, não na aba de melhorias
  S.view = view;
  render();
  window.scrollTo(0, 0);
}

function render() {
  const views = { clients: viewClients, client: viewClient, editor: viewEditor, report: viewReport, admin: viewAdmin, feedback: viewFeedback, mine: viewMine };
  root.innerHTML = topbar()
    + (isDemo ? '<div class="demo-banner no-print">Modo demonstração: dados salvos só neste navegador. Publicado no Google Apps Script, o app usa a conta Google de cada pessoa e a planilha de dados.</div>' : '')
    + views[S.view]();
  if (S.view === 'editor') refreshEditor();
}

function topbar() {
  const inClients = ['clients', 'client', 'editor', 'report'].includes(S.view);
  return `<header class="topbar no-print">
    <div class="brand" data-act="nav" data-v="clients">${BRAND}</div>
    <nav class="topnav">
      <button class="nav-link ${inClients ? 'active' : ''}" data-act="nav" data-v="clients">Clientes</button>
      ${isAdmin() ? `<button class="nav-link ${S.view === 'admin' ? 'active' : ''}" data-act="nav" data-v="admin">Acessos${S.pendingCount ? `<span class="count">${S.pendingCount}</span>` : ''}</button>` : ''}
    </nav>
    <span id="saving" class="saving" ${S.pendingWrites ? '' : 'hidden'}>Salvando…</span>
    <div class="topbar-user">${profileChip()}</div>
  </header>`;
}

// ── CLIENTES ──────────────────────────────────────────────────
function viewClients() {
  const ownerOpts = [['mine', 'Meus clientes'], ['all', 'Todos os clientes'],
    ...S.profiles.filter(p => p.id !== S.user.uid).map(p => [p.id, p.name && p.name !== p.email ? `${p.name} (${p.email})` : p.email])];
  const ownerSel = isAdmin()
    ? `<select class="input" data-change="owner">${ownerOpts.map(([v, l]) => `<option value="${esc(v)}" ${S.ownerFilter === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`
    : '';
  return `<main class="main">
    <div class="page-header">
      <div><div class="eyebrow">Carteira</div><h1>${S.ownerFilter === 'mine' ? 'Seus' : 'Os'} <em>clientes</em></h1></div>
      <div class="header-actions"><button class="btn-primary" data-act="client-new">+ Novo cliente</button></div>
    </div>
    <div class="toolbar"><input class="input search" type="search" placeholder="Buscar cliente…" data-input="search" value="${esc(S.search)}">${ownerSel}</div>
    <div id="client-list">${clientGrid()}</div>
  </main>`;
}

function clientGrid() {
  const q = S.search.trim().toLowerCase();
  const list = S.clients.filter(c => !q || (c.name || '').toLowerCase().includes(q) || (c.agency || '').toLowerCase().includes(q));
  if (!S.clients.length) {
    return S.ownerFilter === 'mine'
      ? empty('🗂️', 'Nenhum cliente ainda', 'Cadastre seu primeiro cliente para começar a gerar one pages.', '<button class="btn-primary" data-act="client-new">+ Novo cliente</button>')
      : empty('🗂️', 'Nenhum cliente encontrado', 'Não há clientes cadastrados para este filtro.');
  }
  if (!list.length) return empty('🔍', 'Nenhum resultado', `Nenhum cliente corresponde a “${esc(S.search)}”.`);
  const showOwner = S.ownerFilter !== 'mine';
  return `<div class="client-grid">${list.map(c => {
    const t = TYPES[c.type] || TYPES.ecommerce, lr = c.lastReport;
    return `<div class="client-card" data-act="client-open" data-id="${esc(c.id)}">
      <div class="cc-top"><span class="type-pill ${c.type === 'inside-sales' ? 'is' : ''}">${t.icon} ${t.label}</span><button class="icon-btn" data-act="client-edit" data-id="${esc(c.id)}" title="Editar cliente">✎</button></div>
      <div class="cc-name">${esc(c.name)}</div>
      ${c.agency ? `<div class="cc-meta">${esc(c.agency)}</div>` : ''}
      ${showOwner ? `<div class="cc-owner">👤 ${esc(c.ownerEmail || '')}</div>` : ''}
      <div class="cc-foot">${lr ? `<span>Última: <strong>${formatMonth(lr.month, true)}</strong></span><span>${fmt(lr.revenue)}</span>` : '<span>Nenhuma one page ainda</span>'}</div>
    </div>`;
  }).join('')}</div>`;
}

function openClientModal(c) {
  const isNew = !c;
  c = c || { type: 'ecommerce', agency: DEFAULT_AGENCY };
  $('#modal').innerHTML = `<div class="modal-bg" data-act="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-head"><h2 id="modal-title">${isNew ? 'Novo cliente' : 'Editar cliente'}</h2><p>Esses dados preenchem automaticamente cada nova one page.</p></div>
    <form class="modal-body" id="client-form" data-id="${esc(c.id || '')}">
      <div class="form-grid">
        <div class="form-group full"><label>Nome do cliente</label><input name="name" value="${esc(c.name || '')}" placeholder="Ex: UV.LINE"></div>
        <div class="form-group"><label>Tipo de operação</label><select name="type">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${c.type === k ? 'selected' : ''}>${t.icon} ${t.label}</option>`).join('')}</select></div>
        <div class="form-group"><label>Meta mensal padrão (R$)</label><input name="meta" type="number" step="any" min="0" value="${esc(c.meta ?? '')}" placeholder="0,00"></div>
        <div class="form-group full"><label>Responsável / Agência</label><input name="agency" value="${esc(c.agency || '')}" placeholder="Ex: Sua Agência"></div>
        <div class="form-group full"><label>Observações <span class="opt">(opcional)</span></label><textarea name="notes" placeholder="Contexto do cliente, contas de anúncio, contatos…">${esc(c.notes || '')}</textarea></div>
      </div>
      <div class="windsor-box">
        <div class="windsor-head"><span class="form-section-title"><span class="dot"></span>Contas de anúncio · Windsor</span><button type="button" class="link-btn" data-act="windsor-refresh">Atualizar lista</button></div>
        <div id="windsor-fields" class="windsor-msg">Carregando contas…</div>
      </div>
    </form>
    <div class="modal-actions">
      ${isNew ? '' : `<button class="btn-danger" data-act="client-delete" data-id="${esc(c.id)}">Excluir</button>`}
      <span class="spacer"></span>
      <button class="btn-secondary" data-act="modal-close">Cancelar</button>
      <button class="btn-primary" type="submit" form="client-form">${isNew ? 'Cadastrar' : 'Salvar'}</button>
    </div>
  </div></div>`;
  $('#client-form [name=name]').focus();
  loadWindsorFields(c.windsor || {}, c.type);
}

function closeModal() { $('#modal').innerHTML = ''; }

// ── WINDSOR (contas vinculadas ao cliente) ────────────────────
const META_RESULTS = [['purchase', 'Compras (pixel)'], ['lead', 'Leads (formulário)'], ['messaging', 'Conversas iniciadas (WhatsApp/Direct)']];
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Plataformas do Windsor: campo do cliente, conector e rótulo.
const W_SLOTS = [
  { slot: 'meta', input: 'wMeta', connector: 'facebook', label: 'Meta Ads' },
  { slot: 'google', input: 'wGoogle', connector: 'google_ads', label: 'Google Ads' },
  { slot: 'ga4', input: 'wGa4', connector: 'googleanalytics4', label: 'GA4' },
];

async function loadWindsorFields(w, type, refresh) {
  const box = $('#windsor-fields');
  if (!box) return;
  // Status e contas ficam em memória (carregados em segundo plano ao abrir o app): o modal abre sem espera.
  if (!S.windsorStatus || !S.windsorAccounts || refresh) {
    box.className = 'windsor-msg';
    box.textContent = 'Carregando contas do Windsor…';
  }
  try {
    if (!S.windsorStatus) S.windsorStatus = await api.windsorStatus();
    if (!S.windsorStatus.configured) {
      box.className = 'windsor-msg';
      box.innerHTML = isAdmin()
        ? 'Para vincular contas, configure a chave de API do Windsor no Apps Script (veja o LEIA-ME).'
        : 'A integração com o Windsor ainda não foi configurada pelo administrador.';
      return;
    }
    if (!S.windsorAccounts || refresh) S.windsorAccounts = await api.windsorAccounts(refresh);
  } catch (e) {
    box.className = 'windsor-msg';
    if ($('#windsor-fields')) box.innerHTML = `Não foi possível carregar as contas do Windsor: ${esc(friendly(e))}`;
    return;
  }
  if (!$('#windsor-fields')) return;
  const acc = S.windsorAccounts;
  const nameOf = (connector, id) => (acc[connector] || []).find(a => a.id === id)?.name || '';
  S.wDraft = Object.fromEntries(W_SLOTS.map(s => [s.slot, w[s.slot] ? { id: w[s.slot], name: nameOf(s.connector, w[s.slot]) } : null]));
  const total = W_SLOTS.reduce((n, s) => n + (acc[s.connector] || []).length, 0);
  const result = w.metaResult || (type === 'inside-sales' ? 'lead' : 'purchase');
  box.className = 'w-picker';
  box.innerHTML = `
    <div class="form-group"><label>Buscar conta por nome ou ID</label>
      <input type="search" id="w-search" autocomplete="off" placeholder="Ex: Ducais ou 1282540650025185"></div>
    <div id="w-results" class="w-results"><div class="w-hint">Digite para buscar entre ${total} contas (Meta, Google Ads e GA4).</div></div>
    <div id="w-slots" class="w-slots"></div>
    ${W_SLOTS.map(s => `<input type="hidden" name="${s.input}">`).join('')}
    <div class="form-group"><label>O que conta como resultado na Meta</label>
      <select name="wMetaResult">${META_RESULTS.map(([k, l]) => `<option value="${k}" ${k === result ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    ${acc.errors && acc.errors.length ? `<div class="windsor-msg">Algumas contas não carregaram: ${esc(acc.errors.join(' · '))}</div>` : ''}`;
  renderWindsorSlots();
  // Sem contas vinculadas: já busca pelo nome do cliente.
  const name = $('#client-form [name=name]')?.value.trim();
  if (name && !W_SLOTS.some(s => S.wDraft[s.slot])) { $('#w-search').value = name; renderWindsorResults(); }
}

function renderWindsorSlots() {
  const box = $('#w-slots');
  if (!box) return;
  box.innerHTML = W_SLOTS.map(s => {
    const a = S.wDraft[s.slot];
    $(`#client-form [name=${s.input}]`).value = a ? a.id : '';
    // ⚠ só para a conta que o Windsor recusou de verdade (erro "conta não disponível" ao puxar os dados).
    const unknown = a && S.badAccounts?.has(normAcc(a.id));
    const info = a && (S.windsorAccounts?.[s.connector] || []).find(x => x.id === normAcc(a.id));
    const idle = !unknown && info?.idle;
    return `<div class="w-slot ${a ? 'on' : ''} ${unknown ? 'warn' : ''}"><span class="w-plat ${s.slot}">${s.label}</span>
      <span class="w-val">${a ? `${esc(a.name || info?.name || 'Conta')} <small>${esc(a.id)}</small>` : '<em>nenhuma conta vinculada</em>'}${unknown ? '<span class="w-warn">⚠ o Windsor recusou esta conta: desvincule (✕) e busque a certa</span>' : ''}${idle ? '<span class="w-idle">sem gasto nos últimos 90 dias: o relatório pode vir zerado</span>' : ''}</span>
      ${a ? `<button type="button" class="icon-btn" data-act="w-clear" data-slot="${s.slot}" title="Desvincular">✕</button>` : ''}</div>`;
  }).join('');
}

// IDs sem espaços e sem prefixos ("act_", "facebook__"), como o servidor usa na consulta.
const normAcc = id => String(id ?? '').trim().replace(/^[a-z0-9]+__/i, '').replace(/^act_/i, '');

// Erros em que o caminho certo é abrir o cadastro do cliente para (re)vincular as contas.
function relinkIfNeeded(e) {
  if (e.code !== 'windsor-unlinked' && e.code !== 'windsor-account') return;
  if (e.code === 'windsor-account') {
    S.windsorAccounts = null; // força recarregar a lista de contas
    const id = /\(([^)]+)\) vinculada/.exec(e.message || '');
    if (id) (S.badAccounts = S.badAccounts || new Set()).add(normAcc(id[1]));
  }
  openClientModal(S.client);
}

function renderWindsorResults() {
  const box = $('#w-results');
  const raw = $('#w-search').value.trim();
  const q = norm(raw), digits = raw.replace(/\D/g, '');
  if (!q) { box.innerHTML = '<div class="w-hint">Digite o nome do cliente ou o ID da conta.</div>'; return; }
  // Ordena pelas palavras que combinam: "Pizzaria Ducais" ainda encontra "CA - DUCAIS RODÍZIO".
  const words = q.split(' ').filter(w => w.length >= 3);
  if (!words.length) words.push(q);
  const hits = [];
  W_SLOTS.forEach(s => (S.windsorAccounts[s.connector] || []).forEach(a => {
    const t = norm(a.name), id = a.id.replace(/\D/g, '');
    const score = words.filter(w => t.includes(w)).length + (t.includes(q) ? 10 : 0) + (digits.length >= 4 && id.includes(digits) ? 20 : 0);
    if (score) hits.push({ s, a, score: score - (a.idle ? 0.5 : 0) });
  }));
  hits.sort((x, y) => y.score - x.score);
  const row = (s, a, manual) => `<button type="button" class="w-row" data-act="w-pick" data-slot="${s.slot}" data-id="${esc(a.id)}" data-name="${esc(a.name)}">
    <span class="w-plat ${s.slot}">${s.label}</span><span class="w-name">${manual ? `Usar o ID <b>${esc(a.id)}</b>` : esc(a.name)}${a.idle ? ' <small class="w-idle-tag">sem gasto recente</small>' : ''}</span><span class="w-id">${manual ? '' : esc(a.id)}</span></button>`;
  let html = hits.slice(0, 12).map(h => row(h.s, h.a)).join('');
  if (digits.length >= 6 && !hits.some(h => h.a.id.replace(/\D/g, '') === digits)) {
    html += W_SLOTS.map(s => row(s, { id: normAcc(raw), name: '' }, true)).join('');
  }
  box.innerHTML = html || `<div class="w-hint">Nenhuma conta encontrada para “${esc(raw)}”. Tente outra parte do nome ou cole o ID.</div>`;
}

async function saveClientFromModal() {
  const f = $('#client-form');
  const fd = Object.fromEntries(new FormData(f));
  const name = fd.name.trim();
  if (!name) { toast('Informe o nome do cliente.', 'err'); return; }
  const id = f.dataset.id;
  const data = { name, type: fd.type, agency: fd.agency.trim(), meta: fd.meta === '' ? '' : Number(fd.meta), notes: fd.notes.trim(), updatedAt: Date.now() };
  if (!id) Object.assign(data, { ownerUid: S.user.uid, ownerEmail: S.user.email, ownerName: S.user.name, createdAt: Date.now() });
  if ($('#client-form [name=wMetaResult]')) data.windsor = { meta: normAcc(fd.wMeta), google: normAcc(fd.wGoogle), ga4: normAcc(fd.wGa4), metaResult: fd.wMetaResult || '' };
  const cid = id || newId();
  const payload = { id: cid, ...data };
  upsertClientLocal(payload);
  closeModal();
  toast(id ? 'Cliente atualizado.' : 'Cliente cadastrado.');
  queueWrite(() => api.saveClient(payload));
  if (!id) return go('client', { client: S.data.clients.find(c => c.id === cid) });
  syncViewData();
  render();
}

async function deleteClient(id) {
  const c = findClient(id);
  if (!confirm(`Excluir o cliente "${c.name}" e todas as one pages dele? Essa ação não pode ser desfeita.`)) return;
  S.data.clients = S.data.clients.filter(x => x.id !== id);
  delete S.data.reports[id];
  toast('Cliente excluído.');
  S.client = null;
  queueWrite(() => api.deleteClient(id));
  go('clients');
}

// ── CLIENTE (histórico de one pages) ──────────────────────────
function viewClient() {
  const c = S.client, t = TYPES[c.type] || TYPES.ecommerce;
  const reps = [...S.reports].sort(byMonthDesc);
  const owner = c.ownerUid !== S.user.uid ? ' · 👤 ' + esc(c.ownerEmail || '') : '';
  const rows = reps.map(r => {
    const m = metrics(r), isIS = r.type === 'inside-sales', mp = m.meta ? m.metaPct : null, id = esc(r.id);
    return `<tr class="clickable" data-act="report-view" data-id="${id}">
      <td><strong>${formatMonth(r.month)}</strong><div class="muted">${isIS ? 'Inside Sales' : 'E-commerce'}</div></td>
      <td>${fmt(m.revenue)}</td>
      <td class="hide-sm">${isIS ? 'CPL ' + fmt(m.cpl) : 'ROAS ' + m.roas.toFixed(2).replace('.', ',') + '×'}</td>
      <td>${mp === null ? '<span class="muted">—</span>' : `<span class="pct-chip ${mp >= 100 ? 'ok' : mp >= 70 ? 'mid' : 'low'}">${mp.toFixed(0)}%</span>`}</td>
      <td class="hide-sm muted">${dateBR(r.updatedAt)}${r.updatedBy && r.updatedBy !== S.user.email ? ' · ' + esc(r.updatedBy) : ''}</td>
      <td class="actions-cell">
        <button class="icon-btn" data-act="report-edit" data-id="${id}" title="Editar dados">✎</button>
        <button class="icon-btn" data-act="report-dup" data-id="${id}" title="Duplicar para o mês seguinte">⧉</button>
        <button class="icon-btn" data-act="report-delete" data-id="${id}" title="Excluir">🗑</button>
      </td></tr>`;
  }).join('');
  return `<main class="main">
    <button class="link-back" data-act="nav" data-v="clients">← Clientes</button>
    <div class="page-header">
      <div><div class="eyebrow">${t.icon} ${t.label}${c.agency ? ' · ' + esc(c.agency) : ''}${owner}</div><h1>${esc(c.name)}</h1></div>
      <div class="header-actions"><button class="btn-secondary" data-act="client-edit" data-id="${esc(c.id)}">Editar cliente</button><button class="btn-secondary" data-act="report-new">+ One page manual</button><button class="btn-primary btn-ai" data-act="ai-open">✨ Gerar relatório com IA</button></div>
    </div>
    ${c.notes ? `<div class="notes">${esc(c.notes)}</div>` : ''}
    ${evolution(reps)}
    <div class="section-title"><span class="dot"></span>One pages (${reps.length})</div>
    ${reps.length
      ? `<div class="card table-scroll"><table class="table"><thead><tr><th>Mês</th><th>Faturamento</th><th class="hide-sm">Indicador</th><th>Meta</th><th class="hide-sm">Atualizado</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : empty('📄', 'Nenhuma one page ainda', 'Crie a primeira one page deste cliente. Os dados padrão do cadastro já vêm preenchidos.', '<button class="btn-primary" data-act="report-new">+ Nova one page</button>')}
  </main>`;
}

function evolution(reps) {
  if (reps.length < 2) return '';
  const last = reps.slice(0, 12).reverse();
  const vals = last.map(r => metrics(r).revenue);
  const max = Math.max(...vals, 1);
  return `<div class="section-title"><span class="dot"></span>Evolução do faturamento</div>
    <div class="evo"><div class="evo-bars">${last.map((r, i) => `<div class="evo-col" title="${formatMonth(r.month)}: ${fmt(vals[i])}">
      <div class="evo-val">${compact(vals[i])}</div>
      <div class="evo-bar ${r.type === 'inside-sales' ? 'is' : ''}" style="height:${Math.max(Math.round(vals[i] / max * 80), 2)}px"></div>
      <div class="evo-lbl">${formatMonth(r.month, true)}</div></div>`).join('')}</div></div>`;
}

async function deleteReport(id) {
  const r = findReport(id);
  if (!confirm(`Excluir a one page de ${formatMonth(r.month)}? Essa ação não pode ser desfeita.`)) return;
  const cid = S.client.id;
  removeReportLocal(cid, id);
  syncLastReport();
  toast('One page excluída.');
  queueWrite(() => api.deleteReport(cid, id));
  render();
}

// Mantém no cadastro do cliente um resumo da one page mais recente (usado nos cards).
// No Apps Script o servidor já faz isso ao gravar; aqui só atualiza a memória.
function syncLastReport() {
  const latest = [...S.reports].sort(byMonthDesc)[0];
  const lastReport = latest ? { month: latest.month, revenue: metrics(latest).revenue, type: latest.type } : null;
  if (JSON.stringify(lastReport) === JSON.stringify(S.client.lastReport || null)) return;
  const cid = S.client.id;
  if (!api.isAppsScript) queueWrite(() => api.saveClient({ id: cid, lastReport, updatedAt: Date.now() }));
  upsertClientLocal({ id: cid, lastReport });
}

// ── EDITOR DE ONE PAGE ────────────────────────────────────────
function newReport() {
  const c = S.client, latest = [...S.reports].sort(byMonthDesc)[0];
  let month = lastMonth();
  if (S.reports.some(r => r.month === month) && latest) month = nextMonth(latest.month);
  S.report = {
    type: c.type || 'ecommerce', month, agency: c.agency || '', meta: c.meta ?? '',
    pipeFields: latest?.pipeFields || allPipeOn(), insights: [{ tipo: 'pos' }, { tipo: 'opp' }],
  };
  openEditor();
}

function duplicateReport(r) {
  const { id, createdAt, updatedAt, updatedBy, ...rest } = r;
  S.report = { ...JSON.parse(JSON.stringify(rest)), month: nextMonth(r.month) };
  openEditor();
  S.dirty = true;
  toast('Cópia criada: confira o mês e atualize os números.');
}

function openEditor() {
  S.draftType = S.report.type || 'ecommerce';
  S.draftPipe = { ...allPipeOn(), ...(S.report.pipeFields || {}) };
  S.dirty = false;
  show('editor');
}

function insightRow(i = { tipo: 'pos' }, isNew) {
  return `<div class="insight-row${isNew ? ' new' : ''}" data-tipo="${i.tipo === 'opp' ? 'opp' : 'pos'}">
    <div class="insight-head">
      <div class="insight-type-selector"><button type="button" class="ins-type-btn" data-act="ins-type" data-t="pos">✅ Positivo</button><button type="button" class="ins-type-btn" data-act="ins-type" data-t="opp">💡 Oportunidade</button></div>
      <button type="button" class="icon-btn" data-act="ins-remove" title="Remover insight">×</button>
    </div>
    <div class="form-grid">
      <div class="form-group"><label>Título</label><input type="text" data-f="title" value="${esc(i.title || '')}" placeholder="Ex: ROAS acima da meta"></div>
      <div class="form-group"><label>Texto / Recomendação</label><textarea data-f="text" placeholder="Descreva o insight ou recomendação…">${esc(i.text || '')}</textarea></div>
    </div>
  </div>`;
}

function viewEditor() {
  const r = S.report, c = S.client, pipe = S.draftPipe;
  const v = k => esc(r[k] ?? '');
  const opt = ' <span class="opt">(opcional)</span>';
  const inp = (label, name, ph = '0', type = 'number') =>
    `<div class="form-group"><label>${label}</label><input type="${type}" name="${name}" value="${v(name)}" placeholder="${ph}"${type === 'number' ? ' step="any" min="0"' : ''}></div>`;
  const money = (label, name) => inp(label + ' (R$)', name, '0,00');
  const auto = (label, id) => `<div class="form-group"><label>${label} <span class="auto-badge">Automático</span></label><input type="text" id="${id}" readonly placeholder="Calculado automaticamente"></div>`;
  const section = (title, body, right = '') =>
    `<div class="form-section"><div class="form-section-header"><div class="form-section-title"><span class="dot"></span>${title}</div>${right}</div><div class="form-section-body">${body}</div></div>`;
  const typeBtn = k => `<button type="button" class="type-btn ${S.draftType === k ? 'active' : ''}" data-act="type" data-t="${k}"><span class="tb-icon">${TYPES[k].icon}</span><span class="tb-name">${TYPES[k].label}</span><span class="tb-desc">${TYPES[k].desc}</span><span class="tb-check"></span></button>`;
  const placeholders = ['Ex: Vídeo Produto Hero', 'Ex: Carrossel Depoimentos', 'Ex: Stories Oferta Flash'];

  return `<main class="main narrow"><form id="editor" autocomplete="off">
    <button type="button" class="link-back" data-act="nav" data-v="client">← ${esc(c.name)}</button>
    <div class="page-header"><div><div class="eyebrow">${r.id ? 'Editar one page' : 'Nova one page'}</div><h1>Dados de <em>${esc(c.name)}</em></h1></div></div>
    <div class="type-selector">${typeBtn('ecommerce')}${typeBtn('inside-sales')}</div>

    ${section('Informações Gerais', `<div class="form-grid">
      <div class="form-group"><label>Mês de Análise</label><input type="month" name="month" value="${v('month')}"></div>
      ${money('Meta de Faturamento', 'meta')}
      <div class="form-group full"><label>Responsável / Agência</label><input type="text" name="agency" value="${v('agency')}" placeholder="Ex: V4 Company"></div>
      <div class="form-group full"><label>Observações do rodapé${opt}</label><textarea name="notes" placeholder="Observações metodológicas desta edição…">${v('notes')}</textarea></div>
    </div>`, '<button type="button" class="btn-smart" data-act="windsor-pull">⚡ Puxar dados do Windsor</button>')}

    ${section('Investimento em Mídia', `
      <div class="form-grid cols-3">${money('Google Ads', 'invGoogle')}${money('Meta Ads', 'invMeta')}${money('Outros Canais', 'invOther')}</div>
      <div class="form-grid">${inp('Cliques — Google', 'clkGoogle')}${inp('Cliques — Meta', 'clkMeta')}${inp('Impressões — Google', 'impGoogle')}${inp('Impressões — Meta', 'impMeta')}</div>`)}

    <div id="ecom-fields" ${S.draftType === 'ecommerce' ? '' : 'hidden'}>
      ${section('Funil GA4 — E-commerce', `
        <div class="form-grid cols-3">${inp('Sessões (GA4)', 'sessions')}${inp('Add to Cart', 'cart')}${inp('Início de Checkout', 'checkout')}</div>
        <div class="form-grid cols-3">${inp('Vendas (Pedidos)', 'sales')}${money('Faturamento Real', 'revenue')}${inp('Receita GA4 (R$)' + opt, 'revenueGa4', '0,00')}</div>
        <div class="form-grid">${auto('Ticket Médio', 'calc-ticket')}${auto('ROAS', 'calc-roas')}</div>`)}
      ${section('Top Produtos' + opt, `<div class="form-grid cols-3">${[1, 2, 3].map(i =>
        inp('Produto ' + i, 'p' + i + 'Name', 'Nome do produto', 'text') + inp('Vendas P' + i, 'p' + i + 'Sales') + money('Faturamento P' + i, 'p' + i + 'Rev')).join('')}</div>`)}
    </div>

    <div id="isales-fields" ${S.draftType === 'inside-sales' ? '' : 'hidden'}>
      ${section('Pipeline — Inside Sales', `
        <div class="toggle-row"><span class="toggle-tip">Etapas no relatório:</span>${PIPE_FIELDS.map(([k, l]) =>
          `<span class="toggle-chip ${pipe[k] !== false ? 'active' : 'inactive'}" data-act="pipe" data-k="${k}">${l}</span>`).join('')}</div>
        <div class="form-grid cols-3">${PIPE_FIELDS.map(([k, l]) =>
          `<div class="form-group ${pipe[k] === false ? 'off' : ''}" data-pipe-field="${k}"><label>${k === 'leads' ? 'Leads Gerados' : l}</label><input type="number" step="any" min="0" name="${k}" value="${v(k)}" placeholder="0"></div>`).join('')}${money('Faturamento Gerado', 'isRevenue')}</div>
        <div class="form-grid">${auto('CPL — Custo por Lead', 'calc-cpl')}${inp('Ticket Médio Fechamento (R$)' + opt, 'isTicket', '0,00')}</div>`,
        '<span class="form-section-hint">Clique nas etapas para ocultá-las da one page</span>')}
    </div>

    ${section('Top Criativos' + opt, [1, 2, 3].map(i => `<div class="criativo-row">
      <div class="criativo-row-title">${['🥇', '🥈', '🥉'][i - 1]} Criativo #${i}</div>
      <div class="form-grid cr">${inp('Nome / Label', 'c' + i + 'Name', placeholders[i - 1], 'text')}${money('Faturamento', 'c' + i + 'Rev')}${inp('Vendas / Leads', 'c' + i + 'Sales')}</div>
      <div class="form-grid cols-3">${inp('Link do Criativo' + opt, 'c' + i + 'Link', 'https://…', 'url')}${inp('URL da imagem' + opt, 'c' + i + 'Img', 'https://….jpg', 'url')}${money('Investido neste criativo', 'c' + i + 'Inv')}</div>
    </div>`).join(''))}

    ${section('Insights & Recomendações',
      `<div class="form-group" style="margin-bottom:14px"><label>Resumo do mês${opt}</label><textarea name="summary" placeholder="2 ou 3 frases com a leitura geral do mês (a IA preenche ao gerar o relatório)">${v('summary')}</textarea></div>
      <div id="insights">${(r.insights || []).map(i => insightRow(i)).join('')}</div><button type="button" class="btn-add" data-act="ins-add">+ Adicionar insight</button>`,
      '<button type="button" class="btn-smart" data-act="ins-suggest">✨ Sugerir insights automáticos</button>')}

    <div id="checks"></div>
    <div class="editor-actions">
      <button type="button" class="btn-primary" data-act="report-save" data-then="view">Salvar e gerar one page →</button>
      <button type="button" class="btn-secondary" data-act="report-save">Salvar</button>
      <span class="spacer"></span>
      <button type="button" class="btn-secondary" data-act="nav" data-v="client">Cancelar</button>
    </div>
  </form></main>`;
}

function readForm() {
  const f = $('#editor');
  const r = { ...S.report, type: S.draftType, pipeFields: { ...S.draftPipe } };
  $$('[name]', f).forEach(el => { r[el.name] = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value.trim(); });
  r.insights = $$('.insight-row', f).map(row => ({ tipo: row.dataset.tipo, title: $('[data-f=title]', row).value.trim(), text: $('[data-f=text]', row).value.trim() }));
  return r;
}

// Cálculos automáticos e checagem de consistência ao vivo.
function refreshEditor() {
  const r = readForm(), m = metrics(r);
  const set = (id, val) => { const el = $('#' + id); if (el) el.value = val; };
  set('calc-ticket', m.sales ? fmt(m.ticket) : '');
  set('calc-roas', m.inv && m.revenue && r.type !== 'inside-sales' ? m.roas.toFixed(2).replace('.', ',') + '×' : '');
  set('calc-cpl', m.leads && m.inv ? fmt(m.cpl) : '');
  const warnings = checkData(r);
  const dup = duplicateMonth(r);
  if (dup) warnings.unshift(`Já existe uma one page de ${formatMonth(r.month)} para este cliente. Ao salvar, ela será substituída.`);
  $('#checks').innerHTML = warnings.length
    ? `<div class="checks"><strong>⚠️ Confira antes de gerar</strong><ul>${warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`
    : '<div class="checks ok"><strong>✓ Dados consistentes</strong>Nenhum problema encontrado nos números informados.</div>';
}

function setDraftType(t) {
  S.draftType = t; S.dirty = true;
  $$('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.t === t));
  $('#ecom-fields').hidden = t !== 'ecommerce';
  $('#isales-fields').hidden = t !== 'inside-sales';
  refreshEditor();
}

function togglePipe(k) {
  const on = S.draftPipe[k] === false;
  S.draftPipe[k] = on; S.dirty = true;
  const chip = $(`.toggle-chip[data-k="${k}"]`);
  chip.classList.toggle('active', on);
  chip.classList.toggle('inactive', !on);
  $(`[data-pipe-field="${k}"]`).classList.toggle('off', !on);
  refreshEditor();
}

function suggest() {
  const r = readForm();
  const list = suggestInsights(r, prevOf(r));
  if (!list.length) { toast('Preencha os números do mês para gerar sugestões.', 'err'); return; }
  const box = $('#insights');
  $$('.insight-row', box).forEach(row => {
    if (!$('[data-f=title]', row).value.trim() && !$('[data-f=text]', row).value.trim()) row.remove();
  });
  const existing = new Set($$('[data-f=title]', box).map(i => i.value.trim()));
  const fresh = list.filter(i => !existing.has(i.title));
  box.insertAdjacentHTML('beforeend', fresh.map(i => insightRow(i, true)).join(''));
  S.dirty = true;
  toast(fresh.length ? `${fresh.length} insight(s) sugerido(s). Revise e ajuste o texto.` : 'Os insights sugeridos já estão na lista.');
}

// ── RELATÓRIO COM IA ──────────────────────────────────────────
const prevMonthOf = m => { const [y, mo] = m.split('-').map(Number); return ym(new Date(y, mo - 2, 1)); };

function openAiModal() {
  const c = S.client, w = c.windsor || {};
  const platforms = [w.meta && 'Meta Ads', w.google && 'Google Ads', w.ga4 && 'GA4'].filter(Boolean);
  const month = lastMonth();
  $('#modal').innerHTML = `<div class="modal-bg" data-act="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-head"><h2 id="modal-title">✨ Gerar relatório com IA</h2><p>${esc(c.name)}</p></div>
    <div class="modal-body" id="ai-body">${platforms.length ? `
      <div class="form-grid">
        <div class="form-group"><label>Mês do relatório</label><input type="month" id="ai-month" value="${month}"></div>
        <div class="form-group"><label>Comparado com</label><input type="text" id="ai-prev" readonly value="${formatMonth(prevMonthOf(month))}"></div>
      </div>
      <ol class="ai-steps">
        <li>Busca os dois meses no Windsor (${platforms.join(', ')}).</li>
        <li>Preenche investimento, cliques, CPC, resultados, CPL/CPA, vendas e os criativos que mais performaram.</li>
        <li>A IA compara os meses e escreve o resumo, os destaques e as sugestões de melhoria.</li>
      </ol>
      <div class="windsor-msg" id="ai-note">Verificando…</div>`
      : '<div class="windsor-msg">Este cliente ainda não tem contas de anúncio vinculadas. Vincule a conta da Meta e/ou do Google Ads no cadastro do cliente para gerar o relatório automaticamente.</div>'}
    </div>
    <div class="modal-actions"><span class="spacer"></span><button class="btn-secondary" data-act="modal-close">Cancelar</button>
      ${platforms.length ? '<button class="btn-primary" data-act="ai-run">Gerar relatório</button>' : `<button class="btn-primary" data-act="client-edit" data-id="${esc(c.id)}">Vincular contas</button>`}</div>
  </div></div>`;
  if (platforms.length) updateAiNote();
}

async function updateAiNote() {
  const input = $('#ai-month');
  if (!input) return;
  const month = input.value;
  $('#ai-prev').value = month ? formatMonth(prevMonthOf(month)) : '';
  const notes = [];
  if (S.reports.some(r => r.month === month)) notes.push(`A one page de ${formatMonth(month)} já existe: as métricas das plataformas e a análise serão atualizadas; faturamento e dados de CRM digitados à mão são mantidos.`);
  if (month && !S.reports.some(r => r.month === prevMonthOf(month))) notes.push(`A one page de ${formatMonth(prevMonthOf(month))} também será criada, para servir de comparação.`);
  if (S.aiConfigured === undefined) S.aiConfigured = await api.aiStatus().then(s => s.configured).catch(() => false);
  if (!S.aiConfigured) notes.push('A chave da IA (Claude) ainda não foi configurada no Apps Script: a análise será escrita pelas regras automáticas do app.');
  const note = $('#ai-note');
  if (note) note.innerHTML = notes.length ? notes.map(esc).join('<br>') : 'Tudo pronto. Você pode editar qualquer número ou texto depois.';
}

async function runAiReport() {
  const month = $('#ai-month')?.value;
  if (!month) { toast('Escolha o mês do relatório.', 'err'); return; }
  $('[data-act=ai-run]').disabled = true;
  const steps = ['Buscando os dados no Windsor…', 'Comparando com o mês anterior…', 'Escrevendo a análise com IA…', 'Quase lá…'];
  $('#ai-body').innerHTML = `<div class="ai-progress"><div class="ai-spinner"></div><div id="ai-step">${steps[0]}</div><small>Pode levar até 1 minuto.</small></div>`;
  let step = 0;
  const timer = setInterval(() => { step = Math.min(step + 1, steps.length - 1); const el = $('#ai-step'); if (el) el.textContent = steps[step]; }, 7000);
  try {
    const res = await api.aiReport(S.client.id, month);
    let report = res.report;
    if (!res.ai) {
      // Sem a IA, os insights e as melhorias vêm das regras do app: grava em segundo plano.
      const cid = S.client.id;
      report = { ...report, insights: suggestInsights(report, res.prev), improvements: campaignImprovements(report) };
      queueWrite(() => api.saveReport(cid, report));
    }
    S.reportTab = 'page';
    upsertReportLocal(S.client.id, res.prev);
    upsertReportLocal(S.client.id, report);
    S.report = report;
    syncLastReport();
    closeModal();
    show('report');
    toast(`Relatório de ${formatMonth(month)} gerado${res.ai ? ' com IA' : ''}, comparado com ${formatMonth(res.prev.month)}. Use "Editar dados" para ajustar.`);
  } catch (e) {
    console.error(e);
    closeModal();
    toast(friendly(e), 'err');
    relinkIfNeeded(e);
  } finally {
    clearInterval(timer);
  }
}

// Puxa as métricas do mês no Windsor e preenche o formulário (campos preenchidos ficam destacados).
async function pullWindsor(btn) {
  const month = $('#editor [name=month]').value;
  if (!month) { toast('Escolha o mês de análise antes de puxar os dados.', 'err'); return; }
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Buscando no Windsor…';
  try {
    const res = await api.windsorPull(S.client.id, month, S.draftType);
    applyPulled(res, month);
  } catch (e) {
    console.error(e);
    toast(friendly(e), 'err');
    relinkIfNeeded(e);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

function applyPulled(res, month) {
  const set = (name, value) => {
    const el = $(`#editor [name="${name}"]`);
    if (!el || value === undefined || value === null) return;
    el.value = value;
    el.classList.toggle('pulled', value !== '');
  };
  Object.entries(res.fields || {}).forEach(([k, v]) => set(k, v));
  if (res.creatives && res.creatives.length) {
    [1, 2, 3].forEach(i => {
      const c = res.creatives[i - 1] || {};
      set('c' + i + 'Name', c.name || '');
      set('c' + i + 'Inv', c.inv || '');
      set('c' + i + 'Sales', c.res || '');
      set('c' + i + 'Rev', c.rev || '');
      set('c' + i + 'Img', c.img || '');
      set('c' + i + 'Link', '');
    });
  }
  const rev = $('#editor [name=revenue]');
  if (S.draftType !== 'inside-sales' && rev && !rev.value && res.suggestedRevenue) set('revenue', res.suggestedRevenue);
  S.dirty = true;
  refreshEditor();
  const missing = S.draftType === 'inside-sales' ? ' Complete MQL, SQL, oportunidades, fechamentos e faturamento com os dados do CRM.' : ' Confira o faturamento real.';
  toast(`Dados de ${formatMonth(month)} puxados de ${(res.sources || []).join(', ') || 'Windsor'}: campos em azul.${missing}`);
}

async function saveReport(then) {
  const r = readForm();
  if (!r.month) { toast('Informe o mês de análise.', 'err'); $('#editor [name=month]').focus(); return; }
  r.insights = r.insights.filter(i => i.title || i.text);
  const dup = duplicateMonth(r);
  if (dup && !confirm(`Já existe uma one page de ${formatMonth(r.month)}. Substituir pela atual?`)) return;
  const now = Date.now();
  Object.assign(r, { updatedAt: now, updatedBy: S.user.email, createdAt: r.createdAt || now });
  // One page nova num mês que já existe: grava por cima da existente (uma chamada em vez de duas).
  const replaceDup = dup && !r.id;
  r.id = r.id || (replaceDup ? dup.id : newId());
  const cid = S.client.id;
  r.clientId = cid;
  const dupToDelete = dup && !replaceDup ? dup : null;
  if (dupToDelete) removeReportLocal(cid, dupToDelete.id);
  upsertReportLocal(cid, r);
  S.report = r;
  S.dirty = false;
  syncLastReport();
  queueWrite(async () => {
    await api.saveReport(cid, r);
    if (dupToDelete) await api.deleteReport(cid, dupToDelete.id);
  });
  toast('One page salva.');
  if (then === 'view') show('report');
  else refreshEditor();
}

// ── VISUALIZAÇÃO DA ONE PAGE ──────────────────────────────────
function viewReport() {
  const tab = S.reportTab || 'page';
  const pending = (S.report.improvements || []).filter(i => !i.done).length;
  return `<div class="back-bar no-print">
    <button class="btn-back" data-act="nav" data-v="client">← ${esc(S.client.name)}</button>
    <button class="btn-back" data-act="report-edit">✎ Editar dados</button>
    ${S.report.source === 'windsor' ? `<span class="source-tag">${S.report.aiModel ? '✨ Análise com IA · ' : ''}dados do Windsor</span>` : ''}
    <span class="spacer"></span>
    <button class="btn-print" data-act="print">🖨️ Imprimir / PDF</button>
    ${tab === 'page' ? '<button class="btn-dl" data-act="download">⬇️ Baixar HTML</button>' : ''}
  </div>
  <div class="report-tabs no-print">
    <button class="rtab ${tab === 'page' ? 'active' : ''}" data-act="rtab" data-t="page">📄 One page</button>
    <button class="rtab ${tab === 'camp' ? 'active' : ''}" data-act="rtab" data-t="camp">🛠 Melhorias nas campanhas${pending ? `<span class="count">${pending}</span>` : ''}</button>
  </div>
  ${tab === 'page' ? `<div class="report-wrap">${renderReport(S.report, S.client, prevOf(S.report))}</div>` : improvementsView(S.report)}`;
}

// Aba interna (não entra na one page): ações sugeridas e números por campanha.
function improvementsView(r) {
  const camps = r.campaigns || [], imps = r.improvements || [];
  if (!camps.length && !imps.length) {
    return `<main class="main">${empty('🛠', 'Sem dados de campanhas', `Gere o relatório com IA para analisar as campanhas de ${formatMonth(r.month)} e receber o plano de melhorias.`, '<button class="btn-primary btn-ai" data-act="ai-open">✨ Gerar relatório com IA</button>')}</main>`;
  }
  const prio = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
  const platCls = p => (p === 'Meta Ads' ? 'meta' : p === 'Google Ads' ? 'google' : 'geral');
  const pct = (a, b) => (b ? (a / b * 100).toFixed(2).replace('.', ',') + '%' : '—');
  const deltaCpr = c => {
    if (!c.res || !c.prev || !c.prev.res) return '';
    const ch = ((c.inv / c.res) / (c.prev.inv / c.prev.res) - 1) * 100;
    return Math.abs(ch) < 1 ? '' : `<span class="d ${ch < 0 ? 'good' : 'bad'}">${ch > 0 ? '+' : ''}${ch.toFixed(0)}%</span>`;
  };
  const extra = c => (c.plat === 'meta'
    ? (c.freq ? `${c.freq.toFixed(1).replace('.', ',')}x` : '—')
    : (c.is != null ? `${Math.round(c.is * 100)}%${c.isRank != null || c.isBudget != null ? ` <small>perde ${Math.round((c.isRank || 0) * 100)}% rank · ${Math.round((c.isBudget || 0) * 100)}% orç.</small>` : ''}` : '—'));
  const done = imps.filter(i => i.done).length;
  return `<main class="main camp-view">
    <div class="page-header">
      <div><div class="eyebrow">Plano de ação · ${formatMonth(r.month)}</div><h1>Melhorias nas <em>campanhas</em></h1></div>
      <div class="camp-meta">${r.aiModel ? '✨ Análise da IA' : 'Análise automática'} · ${done} de ${imps.length} feitas</div>
    </div>
    ${imps.length ? `<div class="card imp-list">${imps.map((i, idx) => `<label class="imp ${i.done ? 'done' : ''}">
      <input type="checkbox" data-change="imp-done" data-i="${idx}" ${i.done ? 'checked' : ''}>
      <div class="imp-body">
        <div class="imp-top"><span class="prio ${esc(i.prioridade)}">${prio[i.prioridade] || esc(i.prioridade)}</span><span class="w-plat ${platCls(i.plataforma)}">${esc(i.plataforma)}</span><span class="imp-camp">${esc(i.campanha)}</span></div>
        <div class="imp-acao">${esc(i.acao)}</div>
        <div class="imp-motivo">${esc(i.motivo)}</div>
      </div></label>`).join('')}</div>`
      : '<div class="windsor-msg">Nenhuma ação sugerida: as campanhas estão dentro do esperado.</div>'}
    <div class="section-title"><span class="dot"></span>Campanhas do mês (${camps.length})</div>
    <div class="card table-scroll"><table class="table camp-table">
      <thead><tr><th>Campanha</th><th>Objetivo</th><th class="r">Investimento</th><th class="r">Resultados</th><th class="r">Custo/res.</th><th class="r hide-sm">CTR</th><th class="r hide-sm">CPC</th><th class="r hide-sm">Freq. / Parcela</th></tr></thead>
      <tbody>${camps.map(c => {
        const conv = isConversionCampaign(c);
        return `<tr>
          <td><span class="w-plat ${c.plat}">${c.plat === 'meta' ? 'Meta' : 'Google'}</span> <strong>${esc(c.name)}</strong></td>
          <td class="muted">${esc(OBJECTIVES[c.objective] || c.objective || '—')}</td>
          <td class="r">${fmt(c.inv)}</td>
          <td class="r">${conv ? fmtN(c.res) : '<span class="muted">n/a</span>'}</td>
          <td class="r">${conv && c.res ? fmt(c.inv / c.res) + ' ' + deltaCpr(c) : '<span class="muted">—</span>'}</td>
          <td class="r hide-sm">${pct(c.clicks, c.imps)}</td>
          <td class="r hide-sm">${c.clicks ? fmt(c.inv / c.clicks) : '—'}</td>
          <td class="r hide-sm">${extra(c)}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
  </main>`;
}

// ── ACESSOS (mestre / admin) ──────────────────────────────────
function setAllowedLocal(email, data) {
  const i = S.data.allowed.findIndex(a => a.email === email);
  if (i >= 0) S.data.allowed[i] = { ...S.data.allowed[i], ...data };
  else S.data.allowed.push({ id: email, email, ...data });
}

function viewAdmin() {
  const { allowed, requests, profiles, allClients } = S.admin;
  const prof = email => profiles.find(p => p.email === email) || {};
  const rows = [
    ...MASTER_EMAILS.map(e => ({ email: lower(e), role: 'master', fixed: true })),
    ...allowed.filter(a => !isMaster(a.email)).sort((a, b) => a.email.localeCompare(b.email)),
  ];
  const person = (p, email) => `<div class="person">${avatar({ photo: p.photo || p.googlePhoto, name: p.name || email })}<div>${esc(p.name || email)}<small>${esc([p.cargo, email].filter(Boolean).join(' · '))}</small></div></div>`;

  return `<main class="main">
    <div class="page-header"><div><div class="eyebrow">Acesso mestre</div><h1>Gerenciar <em>acessos</em></h1></div></div>

    <div class="form-section"><div class="form-section-header"><div class="form-section-title"><span class="dot"></span>Liberar novo acesso</div><span class="form-section-hint">A pessoa entra com a conta Google deste e-mail</span></div>
      <div class="form-section-body"><form id="grant-form" class="grant-row">
        <div class="form-group"><label>E-mail Google</label><input type="email" name="email" placeholder="nome@empresa.com"></div>
        <div class="form-group"><label>Papel</label><select name="role"><option value="user">Usuário</option><option value="admin">Administrador</option></select></div>
        <button class="btn-primary" type="submit">Liberar acesso</button>
      </form>
      <div class="role-help auto-note">✓ Quem entra com e-mail <strong>${AUTO_ALLOW_DOMAINS.map(d => '@' + esc(d)).join(', ')}</strong> é liberado <strong>automaticamente</strong> como Usuário no primeiro acesso. Use <strong>Bloquear</strong> para barrar alguém e <strong>Administrador</strong> para dar mais poder. Este formulário serve para e-mails de outros domínios.</div>
      <div class="role-help"><strong>Usuário</strong>: vê e edita só os próprios clientes. <strong>Administrador</strong>: vê todos os clientes e gerencia acessos.</div></div></div>

    ${requests.length ? `<div class="section-title"><span class="dot"></span>Solicitações pendentes (${requests.length})</div>
      <div class="card table-scroll"><table class="table"><tbody>${requests.map(q => `<tr>
        <td>${person(q, q.email)}</td><td class="muted hide-sm">Pediu em ${dateBR(q.requestedAt)}</td>
        <td class="actions-cell"><button class="btn-primary btn-sm" data-act="approve" data-email="${esc(q.email)}">Liberar</button> <button class="btn-secondary btn-sm" data-act="reject" data-email="${esc(q.email)}">Recusar</button></td>
      </tr>`).join('')}</tbody></table></div>` : ''}

    <div class="section-title"><span class="dot"></span>Pessoas com acesso (${rows.length})</div>
    <div class="card table-scroll"><table class="table">
      <thead><tr><th>Pessoa</th><th>Papel</th><th>Status</th><th class="hide-sm">Clientes</th><th class="hide-sm">Último acesso</th><th></th></tr></thead>
      <tbody>${rows.map(a => {
        const p = prof(a.email), active = a.active !== false, mail = esc(a.email);
        const n = p.id ? allClients.filter(c => c.ownerUid === p.id).length : 0;
        return `<tr>
          <td>${person(p, a.email)}</td>
          <td>${a.fixed ? '<span class="role-badge">Mestre</span>' : `<select class="input input-sm" data-change="role" data-email="${mail}"><option value="user" ${a.role !== 'admin' ? 'selected' : ''}>Usuário</option><option value="admin" ${a.role === 'admin' ? 'selected' : ''}>Administrador</option></select>`}</td>
          <td>${active ? '<span class="status on">Ativo</span>' : '<span class="status off">Bloqueado</span>'}</td>
          <td class="hide-sm">${p.id ? `<button class="btn-secondary btn-sm" data-act="view-owner" data-uid="${esc(p.id)}">${n} cliente${n === 1 ? '' : 's'}</button>` : '<span class="muted">—</span>'}</td>
          <td class="hide-sm muted">${p.lastLogin ? dateBR(p.lastLogin) : 'Nunca entrou'}</td>
          <td class="actions-cell">${a.fixed ? '' : `<button class="btn-secondary btn-sm" data-act="toggle-active" data-email="${mail}">${active ? 'Bloquear' : 'Reativar'}</button> ${isAutoDomain(a.email) ? '' : `<button class="icon-btn" data-act="revoke" data-email="${mail}" title="Remover acesso">🗑</button>`}`}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
  </main>`;
}

async function grantAccess(email, role) {
  email = lower(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Informe um e-mail válido.', 'err'); return; }
  if (isMaster(email)) { toast('Este e-mail já tem acesso mestre.', 'err'); return; }
  const data = { role: role || 'user', active: true, grantedBy: S.user.email, grantedAt: Date.now() };
  setAllowedLocal(email, data);
  S.data.requests = S.data.requests.filter(q => q.email !== email);
  queueWrite(async () => { await api.setAllowed(email, data); await api.removeRequest(email).catch(() => {}); });
  toast(`Acesso liberado para ${email}.`);
  go('admin');
}

async function updateAllowed(email, data, msg, reload = true) {
  setAllowedLocal(email, data);
  queueWrite(() => api.setAllowed(email, data));
  toast(msg);
  if (reload) go('admin');
}

// ── EVENTOS ───────────────────────────────────────────────────
const actions = {
  login: () => safe(() => api.signIn(isDemo ? $('#demo-email')?.value : undefined)),
  logout: () => safe(() => api.signOut()),
  recheck: () => (api.canSignOut ? onAuth(S.user) : api.signIn()),
  nav: el => go(el.dataset.v),

  'client-new': () => openClientModal(),
  'client-edit': el => openClientModal(findClient(el.dataset.id)),
  'client-open': el => go('client', { client: findClient(el.dataset.id) }),
  'client-delete': el => safe(() => deleteClient(el.dataset.id)),
  'modal-close': closeModal,
  'modal-bg': (el, e) => { if (e.target === el && !el.dataset.locked) closeModal(); },

  // perfil e bugs/sugestões
  'me-menu': () => toggleMenu(),
  'profile-edit': () => { toggleMenu(false); openProfileModal(false); },
  'pf-google': () => { S.pfDraft = ''; redrawPfPhoto(); },
  'fb-open': () => { toggleMenu(false); openFeedbackModal(); },
  'fb-inbox': () => { toggleMenu(false); go('feedback'); },
  'fb-type': el => { S.fb.type = el.dataset.t; drawFeedbackModal(); $('#fb-text').focus(); },
  'fb-expand': () => { S.fb.big = !S.fb.big; $('.fb-text-wrap').classList.toggle('big', S.fb.big); $('#fb-text').focus(); },
  'fb-file-remove': el => { S.fb.files.splice(Number(el.dataset.i), 1); redrawFeedbackFiles(); },
  'fb-send': () => sendFeedback(topbar),
  'fb-filter': el => { S.fbFilter = el.dataset.f; render(); loadFeedbackThumbs(); },
  'fb-reload': () => safe(async () => { S.feedback = null; render(); await loadFeedback(true); render(); loadFeedbackThumbs(); }),
  'fb-zoom': el => safe(() => zoomFeedbackFile(el.dataset.file)),
  'fb-mine': () => { toggleMenu(false); go('mine'); },
  'fb-reply-open': el => toggleReplyBox(el.dataset.id, true),
  'fb-reply-cancel': el => toggleReplyBox(el.dataset.id, false),
  'fb-reply-send': el => safe(() => sendReply(el.dataset.id)),
  'reply-ok': () => showReplies(true),

  'report-new': newReport,
  'ai-open': () => openAiModal(),
  'ai-run': () => runAiReport(),
  'report-view': el => { S.report = findReport(el.dataset.id); S.reportTab = 'page'; show('report'); },
  rtab: el => { S.reportTab = el.dataset.t; render(); },
  'report-edit': el => { if (el.dataset.id) S.report = findReport(el.dataset.id); openEditor(); },
  'report-dup': el => duplicateReport(findReport(el.dataset.id)),
  'report-delete': el => safe(() => deleteReport(el.dataset.id)),
  'report-save': el => safe(() => saveReport(el.dataset.then)),
  print: () => window.print(),
  download: () => downloadReport(S.report, S.client, prevOf(S.report)),

  type: el => setDraftType(el.dataset.t),
  pipe: el => togglePipe(el.dataset.k),
  'ins-add': () => { $('#insights').insertAdjacentHTML('beforeend', insightRow({ tipo: 'pos' }, true)); S.dirty = true; },
  'ins-type': el => { el.closest('.insight-row').dataset.tipo = el.dataset.t; S.dirty = true; },
  'ins-remove': el => { el.closest('.insight-row').remove(); S.dirty = true; },
  'ins-suggest': suggest,
  'windsor-pull': el => pullWindsor(el),
  'w-pick': el => {
    S.wDraft[el.dataset.slot] = { id: el.dataset.id, name: el.dataset.name };
    renderWindsorSlots();
    const s = W_SLOTS.find(x => x.slot === el.dataset.slot);
    toast(`${s.label} vinculada: ${el.dataset.name || el.dataset.id}`);
  },
  'w-clear': el => { S.wDraft[el.dataset.slot] = null; renderWindsorSlots(); },
  'windsor-refresh': () => {
    const val = n => $(`#client-form [name="${n}"]`)?.value;
    const c = findClient($('#client-form').dataset.id) || {};
    const w = val('wMetaResult') ? { meta: val('wMeta'), google: val('wGoogle'), ga4: val('wGa4'), metaResult: val('wMetaResult') } : c.windsor || {};
    loadWindsorFields(w, val('type'), true);
  },

  approve: el => safe(() => grantAccess(el.dataset.email, 'user')),
  reject: el => safe(async () => {
    const email = el.dataset.email;
    S.data.requests = S.data.requests.filter(q => q.email !== email);
    queueWrite(() => api.removeRequest(email));
    toast('Solicitação recusada.');
    go('admin');
  }),
  'toggle-active': el => safe(() => {
    const a = S.admin.allowed.find(x => x.email === el.dataset.email);
    const active = a.active === false;
    return updateAllowed(a.email, { active }, active ? 'Acesso reativado.' : 'Acesso bloqueado.');
  }),
  revoke: el => safe(async () => {
    if (!confirm(`Remover o acesso de ${el.dataset.email}? Os clientes dessa pessoa continuam salvos e visíveis para o acesso mestre.`)) return;
    const email = el.dataset.email;
    S.data.allowed = S.data.allowed.filter(a => a.email !== email);
    queueWrite(() => api.removeAllowed(email));
    toast('Acesso removido.');
    go('admin');
  }),
  'view-owner': el => { S.ownerFilter = el.dataset.uid === S.user.uid ? 'mine' : el.dataset.uid; S.search = ''; go('clients'); },
};

document.addEventListener('click', e => {
  if (!e.target.closest('.me-wrap')) toggleMenu(false);
  const el = e.target.closest('[data-act]');
  if (!el || !actions[el.dataset.act]) return;
  actions[el.dataset.act](el, e);
});

document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'client-form') safe(saveClientFromModal);
  if (e.target.id === 'profile-form') safe(() => saveProfileFromModal(topbar));
  if (e.target.id === 'grant-form') {
    const fd = new FormData(e.target);
    safe(() => grantAccess(fd.get('email'), fd.get('role')));
  }
});

let editorTimer;
document.addEventListener('input', e => {
  if (e.target.matches('[data-input=search]')) {
    S.search = e.target.value;
    $('#client-list').innerHTML = clientGrid();
  } else if (e.target.matches('#fb-text')) {
    S.fb.text = e.target.value; updateFeedbackState();
  } else if (e.target.matches('#fb-where')) {
    S.fb.where = e.target.value;
  } else if (e.target.matches('#pf-name')) {
    if (!S.pfDraft && !S.profile.googlePhoto) redrawPfPhoto();
  } else if (e.target.matches('#ai-month')) {
    updateAiNote();
  } else if (e.target.matches('#w-search')) {
    e.target.dataset.touched = '1';
    renderWindsorResults();
  } else if (e.target.matches('#client-form [name=name]')) {
    // Enquanto a pessoa não buscou nada, a busca de contas acompanha o nome do cliente.
    const search = $('#w-search');
    if (search && !search.dataset.touched && !W_SLOTS.some(s => S.wDraft?.[s.slot])) { search.value = e.target.value; renderWindsorResults(); }
  } else if (e.target.closest('#editor')) {
    e.target.classList.remove('pulled');
    S.dirty = true;
    clearTimeout(editorTimer);
    editorTimer = setTimeout(refreshEditor, 150);
  }
});

document.addEventListener('change', e => {
  if (e.target.matches('#pf-file')) { safe(() => pickProfilePhoto(e.target.files[0])); return; }
  if (e.target.matches('#fb-file')) { const files = [...e.target.files]; safe(() => addFeedbackFiles(files)); return; }
  if (e.target.matches('#windsor-fields select')) e.target.dataset.touched = '1';
  if (e.target.matches('#client-form [name=type]')) {
    const r = $('#client-form [name=wMetaResult]');
    if (r && !r.dataset.touched) r.value = e.target.value === 'inside-sales' ? 'lead' : 'purchase';
  }
  const el = e.target.closest('[data-change]');
  if (!el) return;
  if (el.dataset.change === 'owner') { S.ownerFilter = el.value; go('clients'); }
  if (el.dataset.change === 'fb-status') { setFeedbackStatus(el.dataset.id, el.value); refreshTopbar(topbar); el.closest('.fb-card').className = el.closest('.fb-card').className.replace(/st-\w+/, 'st-' + el.value); }
  if (el.dataset.change === 'fb-type-filter') { S.fbType = el.value; render(); loadFeedbackThumbs(); }
  if (el.dataset.change === 'role') safe(() => updateAllowed(el.dataset.email, { role: el.value }, 'Papel atualizado.', false));
  if (el.dataset.change === 'imp-done') safe(async () => {
    // Marca na hora e grava em segundo plano (se falhar, o app avisa e recarrega do servidor).
    const list = S.report.improvements.map((i, idx) => (idx === Number(el.dataset.i) ? { ...i, done: el.checked } : i));
    S.report = { ...S.report, improvements: list };
    upsertReportLocal(S.client.id, S.report);
    render();
    const cid = S.client.id, next = S.report;
    queueWrite(() => api.saveReport(cid, next));
  });
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if ($('.me-menu:not([hidden])')) { toggleMenu(false); $('.me')?.focus(); return; }
  if ($('#modal').innerHTML && !$('.modal-bg[data-locked]')) closeModal();
});

// Print colado (Ctrl+V) vira anexo quando a janela de bugs/sugestões está aberta.
document.addEventListener('paste', e => {
  if (!$('.fb-modal') || !S.fb) return;
  const files = [...(e.clipboardData?.files || [])].filter(f => /^image\//.test(f.type));
  if (!files.length) return;
  e.preventDefault();
  safe(() => addFeedbackFiles(files));
});

window.addEventListener('beforeunload', e => {
  if ((S.view === 'editor' && S.dirty) || S.pendingWrites) e.preventDefault();
});
