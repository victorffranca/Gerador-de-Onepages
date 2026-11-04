# Gerador de One Pages

Aplicativo da V4 Company para gerar one pages mensais de performance (E-commerce e Inside Sales):
login com a conta Google, clientes por pessoa, acesso mestre, integração com o Windsor.ai
(Meta Ads, Google Ads e GA4) e relatório com IA (Claude) comparando o mês com o anterior.

Hospedado no Google Apps Script. Instruções completas de uso, configuração e publicação no
[LEIA-ME.md](LEIA-ME.md).

```
node serve.mjs            # testar localmente (modo demonstração)
node build-gas.mjs        # gerar os arquivos do Apps Script em apps-script/
node publicar.mjs "nota"  # gerar, enviar e atualizar a versão publicada (requer clasp)
```

As chaves (Windsor e Anthropic) ficam nas Propriedades do script do Apps Script, nunca no código.
