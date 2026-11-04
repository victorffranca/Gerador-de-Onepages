// Camada de dados: Google Apps Script, Firebase ou localStorage (modo demonstração).
// As implementações expõem a mesma interface, usada por app.js.
import { FIREBASE_CONFIG, MASTER_EMAILS } from './config.js';

const inAppsScript = typeof google !== 'undefined' && google.script && google.script.run;
export const mode = inAppsScript ? 'gas' : FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey ? 'firebase' : 'demo';
export const isDemo = mode === 'demo';
export const lower = e => String(e || '').trim().toLowerCase();
export const isMaster = email => MASTER_EMAILS.map(lower).includes(lower(email));

export function createBackend() {
  return mode === 'gas' ? createAppsScriptBackend() : mode === 'firebase' ? createFirebaseBackend() : createLocalBackend();
}

// ── GOOGLE APPS SCRIPT ────────────────────────────────────────
// O login é a própria conta Google de quem abre o web app; as regras de acesso
// são verificadas no servidor (Code.gs) a cada chamada.
function createAppsScriptBackend() {
  const call = (method, ...args) => new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler(res => (res && res.error ? reject(Object.assign(new Error(res.error), { code: res.code })) : resolve(res)))
      .withFailureHandler(reject)
      .api(method, args);
  });
  // Com várias contas Google logadas, o Apps Script às vezes nunca responde: avisa em vez de travar.
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, reject) =>
    setTimeout(() => reject(Object.assign(new Error('O servidor não respondeu.'), { code: 'TIMEOUT' })), ms))]);
  let me = null, listener = () => {};
  const refresh = async () => {
    try { me = await withTimeout(call('whoami'), 20000); } catch (e) { me = null; listener(null, e); return; }
    listener(me.user);
  };
  return {
    canSignOut: false,
    onAuth(cb) { listener = cb; refresh(); },
    async getAccess() { return me.access; },
    signIn: refresh,
    signOut: async () => {},
    requestAccess: () => call('requestAccess'),
    touchProfile: () => call('touchProfile'),
    listProfiles: () => call('listProfiles'),
    listAllowed: () => call('listAllowed'),
    setAllowed: (email, data) => call('setAllowed', email, data),
    removeAllowed: email => call('removeAllowed', email),
    listRequests: () => call('listRequests'),
    removeRequest: email => call('removeRequest', email),
    listClients: ownerUid => call('listClients', ownerUid || null),
    saveClient: client => call('saveClient', client),
    deleteClient: id => call('deleteClient', id),
    listReports: clientId => call('listReports', clientId),
    saveReport: (clientId, report) => call('saveReport', clientId, report),
    deleteReport: (clientId, id) => call('deleteReport', clientId, id),
    windsorStatus: () => call('windsorStatus'),
    windsorAccounts: refresh => call('windsorAccounts', !!refresh),
    windsorPull: (clientId, month, type) => call('windsorPull', clientId, month, type),
    aiStatus: () => call('aiStatus'),
    aiReport: (clientId, month) => call('aiReport', clientId, month),
  };
}

// Sem servidor (Firebase/demonstração) não há como chamar o Windsor com a chave do app.
const noWindsor = async () => { throw new Error('A integração com o Windsor funciona só no app publicado no Google Apps Script.'); };

// ── FIREBASE ──────────────────────────────────────────────────
async function createFirebaseBackend() {
  const base = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const [{ initializeApp }, A, F] = await Promise.all([
    import(base + 'firebase-app.js'),
    import(base + 'firebase-auth.js'),
    import(base + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(FIREBASE_CONFIG);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);

  const toUser = u => u && { uid: u.uid, email: lower(u.email), name: u.displayName || u.email, photo: u.photoURL || '' };
  const all = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const col = (...p) => F.collection(db, ...p);
  const ref = (...p) => F.doc(db, ...p);

  return {
    canSignOut: true,
    onAuth: cb => A.onAuthStateChanged(auth, u => cb(toUser(u))),
    signIn() {
      const provider = new A.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return A.signInWithPopup(auth, provider);
    },
    signOut: () => A.signOut(auth),

    async getAccess(user) {
      if (isMaster(user.email)) return { allowed: true, role: 'master' };
      const s = await F.getDoc(ref('allowedUsers', user.email));
      if (s.exists() && s.data().active !== false) return { allowed: true, role: s.data().role || 'user' };
      return { allowed: false, role: null };
    },
    requestAccess: user => F.setDoc(ref('accessRequests', user.email),
      { email: user.email, name: user.name, photo: user.photo, requestedAt: Date.now() }),
    touchProfile: user => F.setDoc(ref('users', user.uid),
      { email: user.email, name: user.name, photo: user.photo, lastLogin: Date.now() }, { merge: true }),
    listProfiles: async () => all(await F.getDocs(col('users'))),

    listAllowed: async () => all(await F.getDocs(col('allowedUsers'))),
    setAllowed: (email, data) => F.setDoc(ref('allowedUsers', lower(email)), { ...data, email: lower(email) }, { merge: true }),
    removeAllowed: email => F.deleteDoc(ref('allowedUsers', lower(email))),
    listRequests: async () => all(await F.getDocs(col('accessRequests'))),
    removeRequest: email => F.deleteDoc(ref('accessRequests', lower(email))),

    async listClients(ownerUid) {
      return all(await F.getDocs(ownerUid ? F.query(col('clients'), F.where('ownerUid', '==', ownerUid)) : col('clients')));
    },
    async saveClient(client) {
      const { id, ...data } = client;
      const r = id ? ref('clients', id) : F.doc(col('clients'));
      await F.setDoc(r, data, { merge: true });
      return { id: r.id, ...data };
    },
    async deleteClient(id) {
      const reports = await F.getDocs(col('clients', id, 'reports'));
      const batch = F.writeBatch(db);
      reports.forEach(r => batch.delete(r.ref));
      batch.delete(ref('clients', id));
      await batch.commit();
    },

    listReports: async clientId => all(await F.getDocs(col('clients', clientId, 'reports'))),
    async saveReport(clientId, report) {
      const { id, ...data } = report;
      const r = id ? ref('clients', clientId, 'reports', id) : F.doc(col('clients', clientId, 'reports'));
      await F.setDoc(r, data);
      return { id: r.id, ...data };
    },
    deleteReport: (clientId, id) => F.deleteDoc(ref('clients', clientId, 'reports', id)),
    windsorStatus: async () => ({ configured: false }),
    windsorAccounts: noWindsor,
    windsorPull: noWindsor,
    aiStatus: async () => ({ configured: false }),
    aiReport: noWindsor,
  };
}

// ── MODO DEMONSTRAÇÃO (localStorage) ──────────────────────────
function createLocalBackend() {
  const KEY = 'opg-demo-v1';
  let mem;
  const load = () => {
    if (mem) return mem;
    try { mem = JSON.parse(localStorage.getItem(KEY)); } catch { mem = null; }
    return (mem = mem || { session: null, allowedUsers: {}, accessRequests: {}, users: {}, clients: {}, reports: {} });
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* sem storage: fica em memória */ } };
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const values = o => Object.entries(o).map(([id, v]) => ({ id, ...v }));
  const listeners = [];
  const emit = () => listeners.forEach(cb => cb(load().session));

  return {
    canSignOut: true,
    onAuth(cb) { listeners.push(cb); cb(load().session); },
    async signIn(email) {
      email = lower(email);
      if (!email) throw new Error('Informe um e-mail para entrar no modo demonstração.');
      load().session = { uid: 'demo-' + email.replace(/[^a-z0-9]/g, '-'), email, name: email.split('@')[0], photo: '' };
      save(); emit();
    },
    async signOut() { load().session = null; save(); emit(); },

    async getAccess(user) {
      if (isMaster(user.email)) return { allowed: true, role: 'master' };
      const a = load().allowedUsers[user.email];
      return a && a.active !== false ? { allowed: true, role: a.role || 'user' } : { allowed: false, role: null };
    },
    async requestAccess(user) {
      load().accessRequests[user.email] = { email: user.email, name: user.name, photo: user.photo, requestedAt: Date.now() }; save();
    },
    async touchProfile(user) {
      const d = load(); d.users[user.uid] = { ...d.users[user.uid], email: user.email, name: user.name, photo: user.photo, lastLogin: Date.now() }; save();
    },
    listProfiles: async () => values(load().users),

    listAllowed: async () => values(load().allowedUsers),
    async setAllowed(email, data) { const d = load(); email = lower(email); d.allowedUsers[email] = { ...d.allowedUsers[email], ...data, email }; save(); },
    async removeAllowed(email) { delete load().allowedUsers[lower(email)]; save(); },
    listRequests: async () => values(load().accessRequests),
    async removeRequest(email) { delete load().accessRequests[lower(email)]; save(); },

    async listClients(ownerUid) { return values(load().clients).filter(c => !ownerUid || c.ownerUid === ownerUid); },
    async saveClient(client) {
      const d = load(); const { id = newId(), ...data } = client;
      d.clients[id] = { ...d.clients[id], ...data }; save();
      return { id, ...d.clients[id] };
    },
    async deleteClient(id) { const d = load(); delete d.clients[id]; delete d.reports[id]; save(); },

    listReports: async clientId => values(load().reports[clientId] || {}),
    async saveReport(clientId, report) {
      const d = load(); const { id = newId(), ...data } = report;
      (d.reports[clientId] = d.reports[clientId] || {})[id] = data; save();
      return { id, ...data };
    },
    async deleteReport(clientId, id) { const d = load(); if (d.reports[clientId]) delete d.reports[clientId][id]; save(); },

    // Windsor simulado com números reais de exemplo (Ducais, out/2026), só para testar a interface.
    windsorStatus: async () => ({ configured: true, demo: true }),
    windsorAccounts: async () => ({
      facebook: [{ id: '1282540650025185', name: 'CA - DUCAIS RODÍZIO E DELIVERY' }, { id: '1001864475195326', name: 'TheGold' }],
      google_ads: [{ id: '331-602-1729', name: 'Gráfica Itália' }, { id: '466-535-6719', name: 'The Gold Marmoraria- CDA' }],
      googleanalytics4: [{ id: '420042968', name: 'Lupo Sport - GA4' }],
      errors: [],
    }),
    async windsorPull(clientId) {
      const w = (load().clients[clientId] || {}).windsor || {};
      if (!w.meta && !w.google && !w.ga4) throw Object.assign(new Error('Este cliente ainda não tem contas do Windsor vinculadas.'), { code: 'windsor-unlinked' });
      await new Promise(r => setTimeout(r, 400));
      return {
        fields: { invMeta: 1418.06, clkMeta: 1638, impMeta: 254840, invGoogle: 608.93, clkGoogle: 2854, impGoogle: 49004, leads: 723, sessions: 21400, cart: 1320, checkout: 610, sales: 241 },
        creatives: [
          { name: 'CARROSSEL RODIZIO', inv: 645.49, res: 127, rev: 0, img: '' },
          { name: 'Verdens Beste', inv: 391.99, res: 87, rev: 0, img: '' },
          { name: 'DELIVERY', inv: 146.98, res: 25, rev: 0, img: '' },
        ],
        suggestedRevenue: 98450.5,
        sources: ['Meta Ads', 'Google Ads', 'GA4'],
      };
    },

    // Relatório com IA simulado: mês anterior com ~85% dos números; sem IA (o app usa as regras).
    aiStatus: async () => ({ configured: false, demo: true }),
    async aiReport(clientId, month) {
      const pulled = await this.windsorPull(clientId);
      const d = load(), c = d.clients[clientId];
      const [y, mo] = month.split('-').map(Number);
      const pd = new Date(y, mo - 2, 1);
      const prevMonth = pd.getFullYear() + '-' + String(pd.getMonth() + 1).padStart(2, '0');
      const reps = Object.entries(d.reports[clientId] || {}).map(([id, r]) => ({ id, ...r }));
      const build = (base, m, k) => {
        const r = { ...(base || { type: c.type, month: m, agency: c.agency || '', meta: c.meta || '', insights: [], createdAt: Date.now() }) };
        // Mês anterior simulado: investimento ~85% e resultados ~75% do mês atual.
        Object.entries(pulled.fields).forEach(([f, v]) => { r[f] = f.startsWith('inv') ? Math.round(v * k * 100) / 100 : Math.round(v * (k === 1 ? 1 : 0.75)); });
        pulled.creatives.forEach((cr, i) => Object.assign(r, { ['c' + (i + 1) + 'Name']: cr.name, ['c' + (i + 1) + 'Inv']: Math.round(cr.inv * k * 100) / 100, ['c' + (i + 1) + 'Sales']: Math.round(cr.res * (k === 1 ? 1 : 0.75)) }));
        return { ...r, metaResult: c.windsor?.metaResult, source: 'windsor', updatedAt: Date.now() };
      };
      const prevSaved = reps.find(r => r.month === prevMonth);
      const prev = prevSaved || await this.saveReport(clientId, build(null, prevMonth, 0.85));
      const campaigns = [
        { plat: 'meta', name: '[V4][LEADS] - WPP', objective: 'OUTCOME_LEADS', inv: 1184.46, imps: 213566, clicks: 1181, res: 239, value: 0, freq: 5.25, prev: { inv: 1427.83, res: 220, clicks: 1150, imps: 190000 } },
        { plat: 'google', name: '[V4][PMAX] - LEADS', objective: 'PERFORMANCE_MAX', inv: 608.93, imps: 49004, clicks: 2854, res: 484, value: 483.78, is: 0.334, isBudget: 0.0155, isRank: 0.3815 },
        { plat: 'meta', name: '[V4][TRÁFEGO] - GANHO DE SEGUIDORES', objective: 'OUTCOME_TRAFFIC', inv: 119.58, imps: 20672, clicks: 457, res: 0, value: 0, freq: 1.43 },
        { plat: 'meta', name: '[V4][RECONHECIMENTO] - THRUPLAY', objective: 'OUTCOME_AWARENESS', inv: 114.02, imps: 20602, clicks: 0, res: 0, value: 0, freq: 1.59 },
      ];
      const cur = await this.saveReport(clientId, { ...build(reps.find(r => r.month === month), month, 1), campaigns, improvements: [] });
      return { report: cur, prev, ai: false, createdPrev: !prevSaved };
    },
  };
}
