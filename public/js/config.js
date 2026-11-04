// ─────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DO APP
// ─────────────────────────────────────────────────────────────

// Cole aqui a configuração do seu projeto Firebase
// (Console Firebase → ⚙️ Configurações do projeto → Seus apps → Configuração do SDK).
// Enquanto ficar vazio, o app roda em MODO DEMONSTRAÇÃO:
// login simulado e dados salvos só neste navegador.
export const FIREBASE_CONFIG = {
  // apiKey: "",
  // authDomain: "",
  // projectId: "",
  // storageBucket: "",
  // messagingSenderId: "",
  // appId: ""
};

// E-mails com ACESSO MESTRE (veem todos os clientes e liberam acessos).
// IMPORTANTE: mantenha a mesma lista em firestore.rules (função isMaster).
export const MASTER_EMAILS = [
  'victor_franca@v4company.com'
];

// Texto padrão do campo "Responsável / Agência" em clientes novos.
export const DEFAULT_AGENCY = '';
