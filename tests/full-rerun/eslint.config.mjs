// Reconstructed test-only security config; the old generated config was not archived.
import {createRequire} from 'node:module';
const require=createRequire('/home/user/rerun-extra-tools/package.json');
const security=require('eslint-plugin-security');
const noUnsanitized=require('eslint-plugin-no-unsanitized');
export default [{ignores:['**/node_modules/**','**/dist/**']},{files:['**/*.js','**/*.mjs'],languageOptions:{ecmaVersion:'latest',sourceType:'module'},plugins:{security,'no-unsanitized':noUnsanitized},rules:{...security.configs.recommended.rules,'no-unsanitized/method':'warn','no-unsanitized/property':'warn'}}];
