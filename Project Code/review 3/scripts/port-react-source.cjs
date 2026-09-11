// One-time, reviewable conversion from the supplied archive. No page markup is injected.
const fs = require('node:fs');
const path = require('node:path');
const base = '.test-tools/react-original/amap';
const write = (name, text) => { fs.mkdirSync(path.dirname(name), { recursive: true }); fs.writeFileSync(name, text); };
for (const name of ['theme', 'components', 'layout', 'pages']) write(`react/src/css/${name}.css`, fs.readFileSync(`${base}/css/${name}.css`));
write('react/database/schema.sql', fs.readFileSync(`${base}/database/schema.sql`));
let seed = fs.readFileSync(`${base}/js/seed.js`, 'utf8');
seed = seed.replace('(function (global) {', 'export function generateSeed(anchor = Date.now()) {').replace('var NOW = Date.now();', 'var NOW = Number(anchor);').replace('global.SEED = {', 'return {').replace('})(window);', '}\nexport const SEED = generateSeed();');
write('react/src/data/seed.js', seed);
let store = fs.readFileSync(`${base}/js/store.js`, 'utf8');
store = 'import { SEED } from "./seed.js";\n' + store.replace('(function (global) {', 'const global = globalThis;\n').replaceAll('global.SEED', 'SEED').replace('global.Store = Store;', 'export { Store };\nexport default Store;').replace('})(window);', '');
write('react/src/data/store.js', store);
let api = fs.readFileSync(`${base}/js/api.js`, 'utf8');
api = 'import Store from "./store.js";\n' + api.replace('(function (global) {', '').replace('global.API = API;', 'export { API };\nexport default API;').replace('})(window);', '');
write('react/src/data/api.js', api);
// Convert trusted, author-defined SVG nodes to JSX, never dangerouslySetInnerHTML.
const icons = fs.readFileSync(`${base}/js/icons.js`, 'utf8');
const paths = [...icons.matchAll(/^    (\w+): '([^']+)'/gm)].map(([,name,body]) => `  ${name}: <>${body.replaceAll('class=', 'className=')}</>,`).join('\n');
write('react/src/components/Icon.jsx', `const paths = {\n${paths}\n};\nexport const iconNames = Object.keys(paths);\nexport default function Icon({name = 'info', size = 20, className = ''}) {\nreturn <svg className={'ico ' + className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{flexShrink:0}}>{paths[name] || paths.info}</svg>;\n}\n`);
