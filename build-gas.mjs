// Gera a versão Google Apps Script em ./apps-script a partir do código de ./public e ./gas.
// Uso: node build-gas.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pub = p => readFileSync(join(here, 'public', p), 'utf8');
const out = join(here, 'apps-script');
mkdirSync(out, { recursive: true });

// Os módulos viram um único script clássico: sem import/export, todos no mesmo escopo.
const toClassic = src => src
  .replace(/^import\s.*?;\s*$/gm, '')
  .replace(/^export\s+(?=(async\s+)?function|const|let|class)/gm, '');
const js = ['js/config.js', 'js/db.js', 'js/report.js', 'js/people.js', 'js/app.js']
  .map(f => `// ── ${f} ──\n` + toClassic(pub(f))).join('\n');

// O Apps Script altera o JavaScript inline ao servir a página (quebrava a sintaxe), então o
// código vai em base64 (só caracteres ASCII seguros) e é decodificado e executado no navegador.
// O sourceURL faz os erros apontarem a linha do onepage-app.js, não da página.
const bundle = `(function () {\n${js}\n})();\n//# sourceURL=onepage-app.js`;
const b64 = Buffer.from(bundle, 'utf8').toString('base64');
const loader = `<script>
(function () {
  var bin = atob('${b64}');
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  (0, eval)(new TextDecoder('utf-8').decode(bytes));
})();
</script>`;

const html = pub('index.html')
  .replace('<link rel="stylesheet" href="css/app.css">', () => `<style>\n${pub('css/app.css')}\n</style>`)
  .replace('<script type="module" src="js/app.js"></script>', () => loader);
writeFileSync(join(out, 'Index.html'), html);

const { MASTER_EMAILS, AUTO_ALLOW_DOMAINS } = await import(pathToFileURL(join(here, 'public/js/config.js')).href);
const code = readFileSync(join(here, 'gas/Code.gs'), 'utf8').replace('__MASTER_EMAILS__', JSON.stringify(MASTER_EMAILS)).replace('__AUTO_DOMAINS__', JSON.stringify(AUTO_ALLOW_DOMAINS));
writeFileSync(join(out, 'Code.gs'), code);
writeFileSync(join(out, 'appsscript.json'), readFileSync(join(here, 'gas/appsscript.json'), 'utf8'));

console.log('Pronto: apps-script/Code.gs, apps-script/Index.html e apps-script/appsscript.json');
