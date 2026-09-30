import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const langs=['ko','en','ja','th','ru','es','mn'];
const data=JSON.parse(await readFile('legal-content.json','utf8'));
assert.deepEqual(Object.keys(data).sort(),[...langs].sort());
assert.equal(await readFile('public/legal.css','utf8'),await readFile('legal.css','utf8'));
for(const file of ['public/index.html','public/privacy.html','public/support.html','public/terms.html']){
 const html=await readFile(file,'utf8');assert(html.includes('Pantrip') && !html.includes('ExpiryCheck'));
}
let checked=0;
for(const lang of langs){
 assert.equal(data[lang].sections.length,10);
 assert.equal(data[lang].providers.length,7);
 assert.equal(data[lang].support.length,5);
 assert.equal(data[lang].terms.length,9);
 assert(data[lang].termsTitle && data[lang].termsSummary.includes("2026"));
 assert(data[lang].terms[5][1][0].includes("reportaproblem.apple.com"));
 assert(!JSON.stringify(data[lang]).includes('SHA-256'));
 assert(data[lang].providers[6].includes('OpenAI / ChatGPT Sites'));
 assert(!data[lang].providers[6].includes('GitHub'));
 assert(data[lang].sections[6][1][1].includes('Pantrip'));
 assert(data[lang].sections[7][1][3].includes('Pantrip'));
 assert(data[lang].support[4][1][0].includes('P'));
 assert(data[lang].contentsTitle && data[lang].languageTitle);
 assert(data[lang].sections[9][1].some(p=>p.includes('2026-09-29')));
 for(const kind of ['privacy','support','terms']){
  const file=resolve('public',kind,lang+'.html');
  const html=await readFile(file,'utf8');
  assert(html.includes(`<html lang="${lang}">`));
  assert(html.includes('jsh097610@gmail.com'));
  assert(html.includes('Pantrip') && !html.includes('ExpiryCheck'));
  assert(!/<script|__\w+__|YOUR_|localhost|127\.0\.0\.1/i.test(html));
  assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
  assert(html.includes(`aria-label="${data[lang].contentsTitle}"`));
  const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size);
  for(const [,href] of html.matchAll(/href="([^"]+)"/g)){
   if(href.startsWith('#'))assert(ids.includes(href.slice(1)),`Missing anchor: ${file} ${href}`);
   if(!/^(https:|mailto:|#)/.test(href))await readFile(resolve(dirname(file),href));
  }
  checked++;
 }
}
console.log(`PASS: ${checked} static localized pages; language, content, links and no tracking scripts.`);
