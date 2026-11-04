// Publica uma nova versão no Google Apps Script mantendo o mesmo link.
// Uso: node publicar.mjs "descrição da mudança"
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEPLOYMENT_ID = 'AKfycbxkIiPRHAxOpMl_QRbAO23iqCLiymx9hJzUSDASTCHUr-koriWhV3MNEdSZ0Ty5fqM4Sg';
const here = dirname(fileURLToPath(import.meta.url));
const run = (cmd, cwd = here) => execSync(cmd, { cwd, stdio: 'inherit' });
const desc = (process.argv[2] || 'Atualização ' + new Date().toLocaleString('pt-BR')).replace(/"/g, "'");

run('node build-gas.mjs');
run('clasp push --force', join(here, 'apps-script'));
run(`clasp update-deployment ${DEPLOYMENT_ID} -d "${desc}"`, join(here, 'apps-script'));
console.log('\nPublicado: https://script.google.com/a/macros/v4company.com/s/' + DEPLOYMENT_ID + '/exec');
