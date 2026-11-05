// Perfil (foto, nome e cargo), menu do perfil e "Bugs e sugestões".
// As funções recebem o contexto do app (estado, api e helpers) por initPeople(), chamado em app.js.
import { esc, formatMonth } from './report.js';

let A; // contexto do app: { S, api, $, $$, toast, safe, friendly, queueWrite, avatar, go, closeModal, isDemo }
export function initPeople(ctx) { A = ctx; }

// Ícones no estilo do design system (traço fino, cor do texto).
const svg = (body, size = 18) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const ICON = {
  chevron: svg('<path d="m6 9 6 6 6-6"/>', 16),
  bulb: svg('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'),
  sparkles: svg('<path d="M9.94 15.5a2 2 0 0 0-1.44-1.44l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>'),
  wand: svg('<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>'),
  bug: svg('<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3 3 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>'),
  chat: svg('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'),
  pencil: svg('<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/>'),
  inbox: svg('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),
  logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>'),
  x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  swap: svg('<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>'),
  expand: svg('<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>', 15),
  clip: svg('<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>', 16),
  camera: svg('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>', 16),
  pin: svg('<path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>', 14),
};

export const FB_TYPES = [
  { k: 'nova', label: 'Nova tela / Funcionalidade', desc: 'Algo novo que não existe', icon: ICON.sparkles,
    ph: 'Descreva a tela ou funcionalidade que você gostaria de ter e para que ela serviria.' },
  { k: 'melhoria', label: 'Melhoria / Adição', desc: 'Refinar algo existente', icon: ICON.wand,
    ph: 'O que existe hoje e como poderia ficar melhor?' },
  { k: 'bug', label: 'Bug / Erro', desc: 'Algo quebrado ou estranho', icon: ICON.bug,
    ph: 'O que você fez, o que esperava que acontecesse e o que aconteceu de fato?' },
  { k: 'outro', label: 'Outro', desc: 'Qualquer outra ideia', icon: ICON.chat,
    ph: 'Pode ser feedback geral, dúvida ou ideia que não se encaixa nas categorias acima.' },
];
const FB_STATUS = [['novo', 'Novo'], ['analise', 'Em análise'], ['feito', 'Feito'], ['arquivado', 'Arquivado']];
const CARGOS = ['Gestor de Tráfego', 'Cientista do Marketing', 'Coordenador de Tráfego', 'Account Manager', 'Head de Performance', 'Designer', 'Copywriter', 'Social Media', 'Sócio'];
const MIN_TEXT = 10, MAX_TEXT = 5000, MAX_FILES = 3;

export const photoOf = p => (p && (p.photo || p.googlePhoto)) || '';
const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';
const isMasterRole = () => A.S.access?.role === 'master';

// ── PERFIL NA BARRA DO TOPO ───────────────────────────────────
export function applyProfile() {
  const { S } = A;
  S.user.name = S.profile.name || S.user.name;
  S.user.photo = photoOf(S.profile);
  // mantém a lista de pessoas (aba Acessos) em dia com o próprio perfil
  const list = S.data?.profiles || [];
  const i = list.findIndex(p => (p.email || p.id) === S.user.email);
  if (i >= 0) list[i] = { ...list[i], ...S.profile };
}

export function profileChip() {
  const { S, avatar, api } = A;
  const p = S.profile || { name: S.user.email, cargo: '' };
  const dot = isMasterRole() && S.feedbackNew ? '<span class="me-dot" title="Bugs e sugestões novos"></span>' : '';
  const role = S.access.role === 'master' ? '<span class="role-badge">Mestre</span>' : S.access.role === 'admin' ? '<span class="role-badge admin">Admin</span>' : '';
  return `<div class="me-wrap">
    <button class="me" data-act="me-menu" aria-haspopup="menu" aria-expanded="false" title="${esc(S.user.email)}">
      <span class="me-pic">${avatar({ photo: photoOf(p), name: p.name })}${dot}</span>
      <span class="me-text"><strong>${esc(p.name || S.user.email)}</strong><small>${esc(p.cargo || 'Defina seu cargo')}</small></span>
      <span class="me-chev">${ICON.chevron}</span>
    </button>
    <div class="me-menu" role="menu" hidden>
      <div class="me-head">${avatar({ photo: photoOf(p), name: p.name })}<div><strong>${esc(p.name || '')}</strong><small>${esc(S.user.email)}</small>${role}</div></div>
      <button class="me-item" role="menuitem" data-act="profile-edit">${ICON.pencil}<span>Editar perfil</span></button>
      <button class="me-item" role="menuitem" data-act="fb-open">${ICON.bulb}<span>Enviar bug ou sugestão</span></button>
      <button class="me-item" role="menuitem" data-act="fb-mine">${ICON.chat}<span>Meus chamados</span>${S.replies?.length ? `<span class="count">${S.replies.length}</span>` : ''}</button>
      ${isMasterRole() ? `<button class="me-item" role="menuitem" data-act="fb-inbox">${ICON.inbox}<span>Caixa de bugs e sugestões</span>${S.feedbackNew ? `<span class="count">${S.feedbackNew}</span>` : ''}</button>` : ''}
      <div class="me-sep"></div>
      ${api.canSignOut
        ? `<button class="me-item" role="menuitem" data-act="logout">${ICON.logout}<span>Sair</span></button>`
        : `<a class="me-item" role="menuitem" href="${esc(api.switchUrl)}" target="_top">${ICON.swap}<span>Trocar de conta</span></a>
           <a class="me-item" role="menuitem" href="${esc(api.logoutUrl)}" target="_top">${ICON.logout}<span>Sair<small>Sai da conta Google neste navegador</small></span></a>`}
    </div>
  </div>`;
}

export function toggleMenu(force) {
  const menu = A.$('.me-menu'), btn = A.$('.me');
  if (!menu) return;
  const open = force ?? menu.hidden;
  menu.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
}

export function refreshTopbar(topbar) {
  const el = A.$('.topbar');
  if (el) el.outerHTML = topbar();
}

// ── EDITAR PERFIL / PRIMEIRO ACESSO ───────────────────────────
export function openProfileModal(welcome) {
  const { S, $ } = A;
  const p = S.profile || {};
  S.pfDraft = p.photo || '';
  $('#modal').innerHTML = `<div class="modal-bg" data-act="modal-bg" ${welcome ? 'data-locked="1"' : ''}><div class="modal pf-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-head"><h2 id="modal-title">${welcome ? `Boas-vindas${firstName(p.name) ? ', ' + esc(firstName(p.name)) : ''}!` : 'Editar perfil'}</h2>
      <p>${welcome ? 'Antes de começar, conte qual é o seu cargo. É assim que você aparece para o time.' : 'Nome, cargo e foto que aparecem para o time.'}</p></div>
    <form class="modal-body" id="profile-form">
      <div class="pf-photo">
        <div id="pf-preview">${pfPreview()}</div>
        <div class="pf-photo-actions">
          <label class="btn-secondary btn-sm pf-file-btn">${ICON.camera}<span>Trocar foto</span><input id="pf-file" type="file" accept="image/png,image/jpeg,image/webp" hidden></label>
          <span id="pf-photo-alt">${pfAlt()}</span>
          <small class="pf-hint">${p.googlePhoto ? 'A foto vem da sua conta Google. Se preferir, envie outra.' : 'Sem foto na conta Google? Envie uma imagem.'}</small>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group full"><label>Nome</label><input id="pf-name" name="name" value="${esc(p.name || '')}" maxlength="80" placeholder="Como você quer ser chamado" autocomplete="name"></div>
        <div class="form-group full"><label>Cargo</label><input id="pf-cargo" name="cargo" value="${esc(p.cargo || '')}" maxlength="80" list="cargo-list" placeholder="Ex: Gestor de Tráfego" autocomplete="organization-title">
          <datalist id="cargo-list">${CARGOS.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      </div>
    </form>
    <div class="modal-actions"><span class="spacer"></span>
      ${welcome ? '' : '<button class="btn-secondary" data-act="modal-close">Cancelar</button>'}
      <button class="btn-primary" type="submit" form="profile-form">${welcome ? 'Salvar e começar' : 'Salvar'}</button>
    </div>
  </div></div>`;
  $(welcome && p.name ? '#pf-cargo' : '#pf-name').focus();
}

function pfPreview() {
  const { S, avatar } = A;
  return `<span class="pf-avatar">${avatar({ photo: S.pfDraft || S.profile.googlePhoto, name: A.$('#pf-name')?.value || S.profile.name })}</span>`;
}
function pfAlt() {
  const { S } = A;
  if (S.pfDraft && S.profile.googlePhoto) return '<button type="button" class="link-btn" data-act="pf-google">Usar a foto do Google</button>';
  if (S.pfDraft) return '<button type="button" class="link-btn" data-act="pf-google">Remover foto</button>';
  return '';
}
export function redrawPfPhoto() { A.$('#pf-preview').innerHTML = pfPreview(); A.$('#pf-photo-alt').innerHTML = pfAlt(); }

export async function pickProfilePhoto(file) {
  if (!file) return;
  if (!/^image\//.test(file.type)) { A.toast('Escolha uma imagem (PNG ou JPG).', 'err'); return; }
  A.S.pfDraft = await imageToDataUrl(file, 160, true, 0.85);
  redrawPfPhoto();
}

export function saveProfileFromModal(topbar) {
  const { S, $, toast, queueWrite, api, closeModal } = A;
  const name = $('#pf-name').value.trim(), cargo = $('#pf-cargo').value.trim();
  if (!name) { toast('Informe seu nome.', 'err'); $('#pf-name').focus(); return; }
  if (!cargo) { toast('Informe seu cargo.', 'err'); $('#pf-cargo').focus(); return; }
  const data = { name, cargo, photo: S.pfDraft || '' };
  S.profile = { ...S.profile, ...data };
  applyProfile();
  closeModal();
  refreshTopbar(topbar);
  queueWrite(() => api.saveProfile(S.user, data));
  toast('Perfil salvo.');
  showReplies();
}

// Reduz a imagem no navegador (perfil: quadrada 160 px; anexos: até 1600 px) e devolve JPEG em base64.
async function imageToDataUrl(file, max, square, quality) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Não foi possível abrir esta imagem.'));
      i.src = url;
    });
    let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
    if (square) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = (sh - s) / 2; sw = sh = s; }
    const scale = Math.min(1, max / Math.max(sw, sh));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(sw * scale)); c.height = Math.max(1, Math.round(sh * scale));
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  } finally { URL.revokeObjectURL(url); }
}

// ── ENVIAR BUG / SUGESTÃO ─────────────────────────────────────
function currentWhere() {
  const { S } = A;
  const c = S.client?.name || '', m = S.report?.month ? formatMonth(S.report.month) : '';
  const join = (...xs) => xs.filter(Boolean).join(' · ');
  return ({
    clients: 'Clientes',
    client: join('Cliente', c),
    editor: join('Editor de one page', c, m),
    report: join(S.reportTab === 'camp' ? 'Melhorias nas campanhas' : 'One page', c, m),
    admin: 'Acessos',
    feedback: 'Caixa de bugs e sugestões',
    mine: 'Meus chamados',
  })[S.view] || '';
}

export function openFeedbackModal() {
  A.S.fb = { type: '', text: '', where: currentWhere(), files: [], big: false, sending: false };
  drawFeedbackModal();
  A.$('.fb-type')?.focus();
}

export function drawFeedbackModal() {
  const { S, $ } = A;
  const f = S.fb, t = FB_TYPES.find(x => x.k === f.type);
  $('#modal').innerHTML = `<div class="modal-bg" data-act="modal-bg"><div class="modal fb-modal" role="dialog" aria-modal="true" aria-labelledby="fb-title">
    <div class="fb-head"><h2 id="fb-title">${ICON.bulb}<span>Sugestões/Bug</span></h2><button class="icon-btn" data-act="modal-close" aria-label="Fechar">${ICON.x}</button></div>
    <div class="fb-body">
      <div class="fb-label">Tipo <span class="req">*</span></div>
      <div class="fb-types" role="radiogroup" aria-label="Tipo">${FB_TYPES.map(x => `<button type="button" class="fb-type ${f.type === x.k ? 'on' : ''}" role="radio" aria-checked="${f.type === x.k}" data-act="fb-type" data-t="${x.k}">
        ${x.icon}<strong>${x.label}</strong><span>${x.desc}</span></button>`).join('')}</div>

      <label class="fb-label" for="fb-text">Sua sugestão <span class="req">*</span></label>
      <div class="fb-text-wrap ${f.big ? 'big' : ''}">
        <textarea id="fb-text" maxlength="${MAX_TEXT}" placeholder="${esc(t ? t.ph : 'Escolha o tipo acima e escreva aqui.')}">${esc(f.text)}</textarea>
        <button type="button" class="fb-expand" data-act="fb-expand" title="${f.big ? 'Reduzir' : 'Expandir'}" aria-label="${f.big ? 'Reduzir' : 'Expandir'} campo">${ICON.expand}</button>
      </div>
      <div class="fb-count"><span id="fb-min" class="fb-min"></span><span id="fb-len"></span></div>

      <div class="fb-sep"></div>
      <div class="fb-label fb-opt">Opcionais</div>
      <label class="fb-label" for="fb-where">Onde está acontecendo</label>
      <input id="fb-where" class="input" value="${esc(f.where)}" maxlength="200" placeholder="Ex: Relatório com IA">
      <div class="fb-hint">Pré-preenchemos com a tela atual. Edite ou apague se não fizer sentido.</div>

      <div class="fb-label">Anexos</div>
      <div class="fb-files" id="fb-files">${fbFilesHTML()}</div>
      <div class="fb-hint">Até ${MAX_FILES} imagens. Dica: tire um print e cole aqui com <kbd>Ctrl</kbd>+<kbd>V</kbd>.</div>
    </div>
    <div class="fb-foot"><span id="fb-status" class="fb-status"></span>
      <button class="btn-secondary" data-act="modal-close">Voltar</button>
      <button class="btn-primary" id="fb-send" data-act="fb-send">${f.type === 'bug' ? 'Reportar bug' : 'Enviar sugestão'}</button>
    </div>
  </div></div>`;
  updateFeedbackState();
}

function fbFilesHTML() {
  const f = A.S.fb;
  return f.files.map((x, i) => `<div class="fb-thumb"><img src="${x.data}" alt="${esc(x.name)}"><button type="button" class="fb-thumb-x" data-act="fb-file-remove" data-i="${i}" aria-label="Remover ${esc(x.name)}">${ICON.x}</button></div>`).join('')
    + (f.files.length < MAX_FILES ? `<label class="fb-add">${ICON.clip}<span>Adicionar imagem</span><input id="fb-file" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></label>` : '');
}
export function redrawFeedbackFiles() { A.$('#fb-files').innerHTML = fbFilesHTML(); }

export function updateFeedbackState() {
  const { S, $ } = A;
  const f = S.fb; if (!f || !$('#fb-send')) return;
  const len = f.text.trim().length, missing = Math.max(0, MIN_TEXT - len);
  $('#fb-len').textContent = `${f.text.length} / ${MAX_TEXT}`;
  $('#fb-min').textContent = missing ? `Mínimo ${MIN_TEXT} caracteres — faltam ${missing}.` : '';
  const msg = !f.type ? 'Escolha o tipo para enviar.' : missing ? `Faltam ${missing} caracteres para enviar.` : '';
  $('#fb-status').textContent = f.sending ? '' : msg;
  $('#fb-send').disabled = !!msg || f.sending;
  $('#fb-send').textContent = f.sending ? 'Enviando…' : f.type === 'bug' ? 'Reportar bug' : 'Enviar sugestão';
}

export async function addFeedbackFiles(files) {
  const f = A.S.fb; if (!f) return;
  const imgs = [...files].filter(x => /^image\//.test(x.type));
  if (!imgs.length) { A.toast('Envie imagens (PNG ou JPG).', 'err'); return; }
  for (const file of imgs) {
    if (f.files.length >= MAX_FILES) { A.toast(`Até ${MAX_FILES} imagens por envio.`, 'err'); break; }
    let data = await imageToDataUrl(file, 1600, false, 0.82);
    if (data.length > 1900000) data = await imageToDataUrl(file, 1100, false, 0.7);
    f.files.push({ name: file.name && file.name !== 'image.png' ? file.name : `print-${f.files.length + 1}.jpg`, data });
  }
  redrawFeedbackFiles();
}

export async function sendFeedback(topbar) {
  const { S, api, toast, friendly, closeModal } = A;
  const f = S.fb;
  if (!f || f.sending || !f.type || f.text.trim().length < MIN_TEXT) return;
  f.sending = true; updateFeedbackState();
  try {
    await api.submitFeedback(S.user, { type: f.type, text: f.text.trim(), where: f.where.trim(), attachments: f.files, userAgent: navigator.userAgent });
    closeModal();
    S.fb = null;
    if (isMasterRole()) { S.feedbackNew = (S.feedbackNew || 0) + 1; S.feedback = null; refreshTopbar(topbar); }
    toast('Obrigado! Sua mensagem foi enviada.');
  } catch (e) {
    console.error(e);
    f.sending = false; updateFeedbackState();
    toast(friendly(e), 'err');
  }
}

// ── CAIXA DE BUGS E SUGESTÕES (só acesso mestre) ──────────────
export async function loadFeedback(force) {
  const { S, api } = A;
  if (S.feedback && !force) return;
  S.feedbackLoading = true;
  try {
    S.feedback = await api.listFeedback(S.user);
    S.feedbackNew = S.feedback.filter(x => (x.status || 'novo') === 'novo').length;
  } finally { S.feedbackLoading = false; }
}

export function viewFeedback() {
  const { S, avatar } = A;
  if (!isMasterRole()) return `<main class="main">${'<div class="empty"><h3>Sem permissão</h3><p>Só o acesso mestre vê esta caixa.</p></div>'}</main>`;
  const all = S.feedback || [];
  const filter = S.fbFilter || 'novo', typeF = S.fbType || '';
  const count = s => all.filter(x => (x.status || 'novo') === s).length;
  const list = all.filter(x => (filter === 'todos' || (x.status || 'novo') === filter) && (!typeF || x.type === typeF));
  const chip = (k, l, n) => `<button class="toggle-chip ${filter === k ? 'on' : ''}" data-act="fb-filter" data-f="${k}">${l}${n != null ? ` <span class="chip-n">${n}</span>` : ''}</button>`;
  const typeOf = k => FB_TYPES.find(t => t.k === k) || FB_TYPES[3];
  const when = t => t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  const body = S.feedbackLoading && !S.feedback
    ? '<div class="empty"><p>Carregando…</p></div>'
    : !list.length
      ? `<div class="empty"><div class="big">${ICON.inbox}</div><h3>${all.length ? 'Nada neste filtro' : 'Nenhuma mensagem ainda'}</h3><p>${all.length ? 'Troque o filtro acima para ver as outras.' : 'Quando alguém enviar um bug ou sugestão pelo menu do perfil, aparece aqui.'}</p></div>`
      : `<div class="fb-list">${list.map(x => {
          const t = typeOf(x.type), a = x.author || { email: x.email };
          return `<article class="fb-card ${x.type === 'bug' ? 'is-bug' : ''} st-${esc(x.status || 'novo')}">
            <header class="fb-card-head">
              <div class="person">${avatar({ photo: a.photo || a.googlePhoto, name: a.name || a.email })}<div>${esc(a.name || a.email)}<small>${esc([a.cargo, a.email].filter(Boolean).join(' · '))}</small></div></div>
              <span class="fb-pill t-${esc(x.type)}">${t.icon}${esc(t.label)}</span>
            </header>
            <p class="fb-card-text">${esc(x.text)}</p>
            ${x.where ? `<div class="fb-card-where">${ICON.pin}${esc(x.where)}</div>` : ''}
            ${(x.attachments || []).length ? `<div class="fb-card-files">${x.attachments.map(f => `<button class="fb-thumb" data-act="fb-zoom" data-file="${esc(f.id)}" title="${esc(f.name)}"><img data-file="${esc(f.id)}" alt="${esc(f.name)}"></button>`).join('')}</div>` : ''}
            ${replyBlock(x)}
            <footer class="fb-card-foot"><span class="muted">${when(x.createdAt)}</span>
              <button class="btn-secondary btn-sm" data-act="fb-reply-open" data-id="${esc(x.id)}">${x.reply ? 'Editar resposta' : 'Responder'}</button>
              <select class="input input-sm fb-status-sel" data-change="fb-status" data-id="${esc(x.id)}" aria-label="Status">${FB_STATUS.map(([k, l]) => `<option value="${k}" ${(x.status || 'novo') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
            </footer>
          </article>`;
        }).join('')}</div>`;

  return `<main class="main">
    <div class="page-header"><div><div class="eyebrow">Acesso mestre</div><h1>Bugs e <em>sugestões</em></h1></div>
      <div class="header-actions"><button class="btn-secondary" data-act="fb-reload">Atualizar</button><button class="btn-primary" data-act="fb-open">+ Enviar</button></div></div>
    <div class="toolbar fb-toolbar">
      <div class="chips">${chip('novo', 'Novos', count('novo'))}${chip('analise', 'Em análise', count('analise'))}${chip('feito', 'Feitos', count('feito'))}${chip('arquivado', 'Arquivados', count('arquivado'))}${chip('todos', 'Todos', all.length)}</div>
      <select class="input" data-change="fb-type-filter" aria-label="Tipo"><option value="">Todos os tipos</option>${FB_TYPES.map(t => `<option value="${t.k}" ${typeF === t.k ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select>
    </div>
    ${body}
  </main>`;
}

// Miniaturas dos anexos: carregadas sob demanda e guardadas em memória.
const fileCache = {};
export function loadFeedbackThumbs() {
  A.$$('img[data-file]:not([src])').forEach(async img => {
    const id = img.dataset.file;
    try {
      fileCache[id] = fileCache[id] || A.api.feedbackFile(A.S.user, id);
      img.src = (await fileCache[id]).data;
    } catch (e) { delete fileCache[id]; img.closest('.fb-thumb')?.classList.add('broken'); }
  });
}

export async function zoomFeedbackFile(id) {
  const f = await (fileCache[id] = fileCache[id] || A.api.feedbackFile(A.S.user, id));
  A.$('#modal').innerHTML = `<div class="modal-bg lightbox" data-act="modal-bg"><figure class="lightbox-fig">
    <img src="${f.data}" alt="${esc(f.name)}">
    <figcaption><span>${esc(f.name)}</span><a class="btn-secondary btn-sm" href="${f.data}" download="${esc(f.name.replace(/\.[a-z]+$/i, '') + '.jpg')}">Baixar</a><button class="btn-primary btn-sm" data-act="modal-close">Fechar</button></figcaption>
  </figure></div>`;
}

export function setFeedbackStatus(id, status) {
  const { S, api, queueWrite, toast } = A;
  const x = (S.feedback || []).find(f => f.id === id);
  if (!x) return;
  x.status = status;
  S.feedbackNew = S.feedback.filter(f => (f.status || 'novo') === 'novo').length;
  queueWrite(() => api.setFeedbackStatus(S.user, id, status));
  toast('Status atualizado.');
}

// ── RESPOSTAS AOS CHAMADOS ────────────────────────────────────
const whenBR = t => t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const dayBR = t => t ? new Date(t).toLocaleDateString('pt-BR') : '';
const clip = (s, n) => (s = String(s || '')).length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
const typeInfo = k => FB_TYPES.find(t => t.k === k) || FB_TYPES[3];
const AUTHOR_STATUS = { novo: 'Recebido', analise: 'Em análise', feito: 'Resolvido', arquivado: 'Encerrado' };

// Aviso (popup) com a resposta do mestre. Mostra uma por vez; "Entendi" marca como lida e passa para a próxima.
export function showReplies(advance) {
  const { S, $, api, queueWrite, avatar } = A;
  if (advance) {
    const done = S.replies && S.replies.shift();
    if (done) { queueWrite(() => api.markReplySeen(S.user, done.id)); refreshTopbar(A.topbar); }
  }
  if (!S.replies || !S.replies.length) { if (advance) A.closeModal(); return; }
  if (!advance && $('#modal').innerHTML) return; // não atropela outra janela aberta
  const f = S.replies[0], t = typeInfo(f.type), r = f.reply, more = S.replies.length - 1;
  $('#modal').innerHTML = `<div class="modal-bg" data-act="modal-bg" data-locked="1"><div class="modal reply-modal" role="alertdialog" aria-modal="true" aria-labelledby="reply-title">
    <div class="reply-head"><span class="reply-badge">${ICON.chat}</span>
      <div><h2 id="reply-title">Seu chamado foi respondido</h2><p>${esc(t.label)} · aberto em ${dayBR(f.createdAt)}</p></div></div>
    <div class="modal-body">
      <div class="reply-orig"><span class="fb-label">Você escreveu</span><p>${esc(clip(f.text, 320))}</p></div>
      <div class="reply-ans">
        <div class="person">${avatar({ photo: r.byPhoto, name: r.byName })}<div>${esc(r.byName || 'Resposta')}<small>${esc([r.byCargo, whenBR(r.at)].filter(Boolean).join(' · '))}</small></div></div>
        <p>${esc(r.text)}</p>
      </div>
    </div>
    <div class="modal-actions">${more ? `<span class="muted">Mais ${more} resposta${more > 1 ? 's' : ''}</span>` : ''}<span class="spacer"></span>
      <button class="btn-primary" data-act="reply-ok">${more ? 'Próxima' : 'Entendi'}</button></div>
  </div></div>`;
  $('[data-act=reply-ok]').focus();
}

// Bloco da resposta no cartão da caixa do mestre (e formulário para responder).
function replyBlock(x) {
  const open = A.S.replyOpen === x.id, r = x.reply;
  const name = firstName(x.author?.name) || 'a pessoa';
  let html = '';
  if (r && !open) {
    html += `<div class="fb-reply"><div class="fb-reply-head">${ICON.chat}<strong>Sua resposta</strong>
      <span class="fb-reply-seen ${x.replySeen ? 'on' : ''}">${x.replySeen ? 'lida' : 'ainda não lida'}</span><span class="muted">${whenBR(r.at)}</span></div>
      <p>${esc(r.text)}</p></div>`;
  }
  if (open) {
    html += `<div class="fb-reply-form">
      <label class="fb-label" for="reply-${esc(x.id)}">Resposta para ${esc(name)}</label>
      <textarea id="reply-${esc(x.id)}" class="input" maxlength="5000" placeholder="Ela aparece como aviso na próxima vez que ${esc(name)} abrir o app.">${esc(r ? r.text : '')}</textarea>
      <div class="fb-reply-actions"><button class="btn-secondary btn-sm" data-act="fb-reply-cancel" data-id="${esc(x.id)}">Cancelar</button>
        <button class="btn-primary btn-sm" data-act="fb-reply-send" data-id="${esc(x.id)}">${r ? 'Atualizar resposta' : 'Enviar resposta'}</button></div>
    </div>`;
  }
  return html;
}

export function toggleReplyBox(id, open) {
  A.S.replyOpen = open ? id : null;
  A.render();
  loadFeedbackThumbs();
  if (open) { const t = A.$('#reply-' + CSS.escape(id)); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }
}

export async function sendReply(id) {
  const { S, $, api, toast } = A;
  const ta = $('#reply-' + CSS.escape(id)), btn = $(`[data-act=fb-reply-send][data-id="${CSS.escape(id)}"]`);
  const text = ta.value.trim();
  if (text.length < 2) { toast('Escreva a resposta.', 'err'); ta.focus(); return; }
  btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    const saved = await api.replyFeedback(S.user, id, text);
    const x = (S.feedback || []).find(f => f.id === id);
    if (x) Object.assign(x, { reply: saved.reply, replySeen: false, status: saved.status || x.status });
    S.feedbackNew = (S.feedback || []).filter(f => (f.status || 'novo') === 'novo').length;
    S.replyOpen = null;
    A.render(); loadFeedbackThumbs();
    toast(`Resposta enviada. ${firstName(x?.author?.name) || 'A pessoa'} vai ver um aviso ao abrir o app.`);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Enviar resposta';
    throw e;
  }
}

// ── MEUS CHAMADOS (qualquer pessoa) ───────────────────────────
export async function loadMine() {
  const { S, api, queueWrite } = A;
  S.mine = await api.myFeedback(S.user);
  // abriu a lista: respostas que ainda não tinham sido vistas passam a contar como lidas
  S.mine.filter(f => f.reply && !f.replySeen).forEach(f => { f.replySeen = true; queueWrite(() => api.markReplySeen(S.user, f.id)); });
  S.replies = [];
}

export function viewMine() {
  const { S } = A;
  const list = S.mine;
  const body = !list
    ? '<div class="empty"><p>Carregando…</p></div>'
    : !list.length
      ? `<div class="empty"><div class="big">${ICON.bulb}</div><h3>Nenhum chamado ainda</h3><p>Achou um erro ou teve uma ideia? Conte para a gente.</p><button class="btn-primary" data-act="fb-open">Enviar bug ou sugestão</button></div>`
      : `<div class="fb-list">${list.map(x => {
          const t = typeInfo(x.type), st = x.status || 'novo';
          return `<article class="fb-card ${x.type === 'bug' ? 'is-bug' : ''}">
            <header class="fb-card-head"><span class="fb-pill t-${esc(x.type)}">${t.icon}${esc(t.label)}</span><span class="fb-st st-${esc(st)}">${AUTHOR_STATUS[st] || st}</span></header>
            <p class="fb-card-text">${esc(x.text)}</p>
            ${x.where ? `<div class="fb-card-where">${ICON.pin}${esc(x.where)}</div>` : ''}
            ${x.reply ? `<div class="fb-reply"><div class="fb-reply-head">${ICON.chat}<strong>Resposta de ${esc(x.reply.byName || 'admin')}</strong><span class="muted">${whenBR(x.reply.at)}</span></div><p>${esc(x.reply.text)}</p></div>` : ''}
            <footer class="fb-card-foot"><span class="muted">Aberto em ${whenBR(x.createdAt)}${x.attachments ? ` · ${x.attachments} anexo${x.attachments > 1 ? 's' : ''}` : ''}</span>${x.reply ? '' : '<span class="muted">Aguardando resposta</span>'}</footer>
          </article>`;
        }).join('')}</div>`;
  return `<main class="main">
    <div class="page-header"><div><div class="eyebrow">Bugs e sugestões</div><h1>Meus <em>chamados</em></h1></div>
      <div class="header-actions"><button class="btn-primary" data-act="fb-open">+ Novo chamado</button></div></div>
    ${body}
  </main>`;
}
