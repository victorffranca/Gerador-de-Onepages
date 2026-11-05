# OnePage Generator

App para gerar one pages de performance (E-commerce e Inside Sales) com login Google,
clientes por usuário e acesso mestre. Hospedado no **Google Apps Script**; os dados ficam
numa planilha Google Sheets na conta de quem publica.

## O que tem no app

- **Login com a conta Google**: o Apps Script identifica quem abriu o link.
- **Clientes por pessoa**: cada usuário cadastra, edita e vê só os próprios clientes.
- **Acesso mestre** (e-mails em `public/js/config.js`): vê todos os clientes, filtra por pessoa
  e libera, bloqueia ou remove acessos na aba **Acessos**. Pode nomear outros administradores.
- **Liberação automática do domínio**: quem entra com e-mail @v4company.com já ganha acesso de Usuário no
  primeiro acesso (domínios em `AUTO_ALLOW_DOMAINS`, `public/js/config.js`). A pessoa aparece na aba Acessos
  e o mestre pode **Bloquear** (quem é do domínio não pode ser removido, só bloqueado) ou torná-la Administrador.
- **Pedidos de acesso**: e-mails de outros domínios que entram sem permissão geram uma solicitação, que aparece
  para o mestre com os botões Liberar/Recusar.
- **One pages por cliente e mês**, com histórico, gráfico de evolução, duplicar para o mês seguinte,
  editar e excluir.
- **Recursos inteligentes**:
  - comparação automática com o mês anterior nos KPIs (▲/▼);
  - botão **✨ Sugerir insights automáticos** (meta, tendência, gargalo do funil, divergência GA4,
    CPA x ticket, perda no pipeline, dependência de criativo);
  - checagem de consistência ao vivo (ex.: "SQL maior que Leads");
  - ticket médio, ROAS e CPL calculados automaticamente.
- **Imprimir / PDF** e **Baixar HTML** da one page, no mesmo formato do modelo.

## Onde está publicado

- **Link do app:** https://script.google.com/a/macros/v4company.com/s/AKfycbxkIiPRHAxOpMl_QRbAO23iqCLiymx9hJzUSDASTCHUr-koriWhV3MNEdSZ0Ty5fqM4Sg/exec
  (use sempre este link com `/a/macros/v4company.com/`: ele força a conta da empresa. O link
  genérico abre com a conta Google padrão do navegador e, se for um Gmail pessoal, o Google
  mostra "Você precisa de permissão".)
- **Projeto no Apps Script:** https://script.google.com/d/1zLSgs1nRU5xLiD_uc2EYn5A55X1g4eflQVy8JN1x0bT3iPlZRHoLibcW/edit
- Executa como o dono (victor_franca@v4company.com) e só abre para contas *v4company.com*
  (definido em `gas/appsscript.json`).
- A planilha *OnePage Generator — Banco de dados* é criada no seu Drive no primeiro uso.

## Atualizar depois de mudanças

Com o [clasp](https://github.com/google/clasp) instalado e logado (`clasp login`):
```
node publicar.mjs "o que mudou"
```
Isso gera os arquivos, envia ao Apps Script e atualiza a implantação. O link continua o mesmo.

## Integração com o Windsor.ai

O app puxa as métricas do mês direto do Windsor (Meta Ads, Google Ads e GA4).

**Configurar (uma vez, pelo dono do app):**
1. No Windsor (conta com plano pago), copie a chave em https://onboard.windsor.ai → Settings → API key.
2. No projeto do Apps Script: ⚙️ **Configurações do projeto → Propriedades do script → Adicionar propriedade**:
   nome `WINDSOR_API_KEY`, valor = a chave. Salve. A chave fica só no servidor; ninguém vê pelo app.
3. Teste: abra o link do app com `?diag=windsor` no final. Deve mostrar quantas contas de Meta,
   Google Ads e GA4 foram encontradas.

**Usar:**
1. No cadastro do cliente, em **Contas de anúncio · Windsor**, escolha a conta da Meta, do Google Ads
   e a propriedade do GA4 (o app sugere pelo nome). Em **Resultado na Meta**, escolha o que conta
   como resultado: compras, leads de formulário ou conversas iniciadas (WhatsApp/Direct).
2. Na one page, escolha o mês e clique em **⚡ Puxar dados do Windsor**. Os campos preenchidos ficam
   em azul: investimento, cliques no link e impressões por canal; leads (Inside Sales) ou funil do
   GA4 e vendas (E-commerce); top 3 criativos da Meta com miniatura.
3. Complete o que não vem das plataformas: faturamento real, MQL/SQL/oportunidades/fechamentos (CRM).

**Erro "conta não disponível no Windsor":** o Windsor só deixa o app ler as contas que a *chave de API*
enxerga (as do login dono da chave, em Windsor → Data). Se o cliente estiver vinculado a uma conta que não
está nesse login, o app abre o cadastro do cliente e marca a conta com ⚠: desvincule (✕), busque a conta
certa e salve. A lista do cadastro só mostra contas que a chave consegue ler (com dados nos últimos 90 dias);
contas conectadas sem gasto nos últimos 90 dias também aparecem, com a etiqueta "sem gasto recente" (o relatório delas pode vir zerado). Para conferir a qual login a chave
pertence, abra o link do app com `?diag=windsor` no final: ele mostra exemplos das contas lidas.

Observações: a lista de contas fica 6 h em cache (use "Atualizar lista" no cadastro). Mostra contas com
atividade nos últimos 365 dias. As miniaturas dos criativos são links do Facebook, que expiram depois
de algumas semanas: one pages antigas podem perder a imagem.

## Relatório com IA

Na página do cliente, **✨ Gerar relatório com IA**: escolha o mês (padrão: o mês passado). O app
1. busca no Windsor o mês escolhido e o anterior (ex.: outubro e setembro);
2. preenche as duas one pages (investimento, cliques, CPC, impressões, resultados, CPL/CPA, vendas,
   top 3 criativos). A do mês anterior só é criada se ainda não existir;
3. pede ao Claude (modelo `claude-opus-5-5`) o resumo do mês, os destaques e as sugestões de melhoria;
4. abre a one page do mês mais recente, comparada com o anterior. Tudo continua editável em
   **Editar dados**; faturamento e dados de CRM digitados à mão são mantidos ao gerar de novo.

**Aba "Melhorias nas campanhas"** (na tela do relatório, ao lado da one page; não entra no PDF da
one page): plano de ação com prioridade (alta, média, baixa) por campanha, por exemplo escalar verba,
pausar quem gasta sem resultado, renovar criativos com frequência alta, melhorar anúncios quando a
perda de impressões por classificação é alta. Embaixo, a tabela de campanhas do mês (objetivo,
investimento, resultados, custo por resultado com variação vs mês anterior, CTR, CPC, frequência ou
parcela de impressões). Cada ação pode ser marcada como feita. Campanhas de reconhecimento e tráfego
são avaliadas por CPM/CPC/CTR, não por conversões.

Sem faturamento/fechamentos informados, a one page mostra os KPIs de mídia (investimento, resultados,
custo por resultado, CPC, cliques, impressões), como no modelo da Ducais.

**Configurar a IA (uma vez):** crie uma chave em https://console.anthropic.com → API Keys e adicione em
⚙️ Configurações do projeto → Propriedades do script: `ANTHROPIC_API_KEY` = a chave. Depois, no editor,
rode a função `testarIA` uma vez (autoriza e testa). Sem a chave, a análise é escrita pelas regras
automáticas do app. Cada relatório usa uma chamada ao Claude (custo de alguns centavos de dólar).

## Perfil e bugs/sugestões

- **Perfil no topo**: foto, nome e cargo. A foto e o nome vêm do diretório do Google Workspace (serviço avançado
  *People*, escopo `directory.readonly`); a foto é atualizada a cada 3 dias. No primeiro acesso o app pergunta o cargo.
- **Menu do perfil**: *Editar perfil* (nome, cargo e foto; a foto enviada é reduzida para 160 px), *Enviar bug ou
  sugestão* e, só para o acesso mestre, *Caixa de bugs e sugestões*.
- **Bugs e sugestões**: tipo (nova tela, melhoria, bug, outro), texto de 10 a 5000 caracteres, onde acontece
  (preenchido com a tela atual) e até 3 imagens (pode colar print com Ctrl+V). Fica nas abas *feedback* e
  *feedbackFiles* da planilha. Só o acesso mestre lê e muda o status (novo, em análise, feito, arquivado).
- **Responder**: na caixa, *Responder* em cada item. Quem abriu o chamado vê a resposta num aviso na próxima vez que
  abrir o app (ou em até 30 s, se estiver com ele aberto) e pode rever tudo em *Meus chamados*. A caixa mostra se a
  resposta já foi lida.

**Depois de publicar esta versão (uma vez):** no editor do Apps Script, rode a função `autorizarPerfil` e aceite
a permissão nova (ver o diretório da empresa). Enquanto não autorizar, o app não abre para ninguém. Se o diretório
não estiver disponível, o app funciona igual, só sem a foto do Google (cada pessoa pode enviar a sua).

## Liberar pessoas

1. Abra o app com a conta mestre e vá em **Acessos**.
2. Digite o e-mail Google da pessoa e clique em **Liberar acesso**. Se ela já tentou entrar,
   o pedido aparece em *Solicitações pendentes*.
3. Envie o link do app. A pessoa só verá os próprios clientes.

Para trocar ou incluir e-mails mestres, edite `MASTER_EMAILS` em `public/js/config.js`,
e rode `node publicar.mjs`.

## Limitação importante (contas fora do domínio)

O app roda como *você* e identifica o usuário pelo e-mail Google. O Google só informa esse
e-mail quando a pessoa está no **mesmo domínio Google Workspace** do dono do script
(@v4company.com). Pessoas com Gmail pessoal ou de outra empresa veem a tela "Não foi possível
identificar sua conta". Se precisar liberar gente de fora, o caminho é migrar para Firebase.
O código já tem essa opção em `public/js/db.js`, mas ainda falta configurar.

## Testar no computador (modo demonstração)

```
node serve.mjs
```
Abra http://localhost:8765. Fora do Apps Script o app entra em modo demonstração: o login é
simulado (qualquer e-mail) e os dados ficam só no navegador.

## Estrutura

| Pasta/arquivo | Conteúdo |
| --- | --- |
| `public/` | Interface (HTML, CSS e JS): a fonte do app |
| `public/js/report.js` | Layout da one page, métricas, insights automáticos e checagens |
| `public/js/config.js` | E-mails mestres e configurações |
| `gas/Code.gs` | Servidor do Apps Script: permissões e armazenamento na planilha |
| `apps-script/` | Arquivos gerados para colar no Apps Script (não edite à mão) |
| `build-gas.mjs` | Gera a pasta `apps-script/` |
| `publicar.mjs` | Gera, envia e atualiza a versão publicada |
| `apps-script/.clasp.json` | Liga a pasta ao projeto no Apps Script (não apague) |
| `serve.mjs` | Servidor local para testes |
