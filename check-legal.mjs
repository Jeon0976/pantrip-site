import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const langs=['ko','en','ja','th','ru','es','mn'];
const data=JSON.parse(await readFile('legal-content.json','utf8'));
assert.deepEqual(Object.keys(data).sort(),[...langs].sort());
assert.equal(await readFile('public/legal.css','utf8'),await readFile('legal.css','utf8'));
for(const file of ['public/index.html','public/privacy.html','public/support.html']){
 const html=await readFile(file,'utf8');assert(html.includes('Pantrip') && !html.includes('ExpiryCheck'));
}
let checked=0;
for(const lang of langs){
 assert.equal(data[lang].sections.length,10);
 assert.equal(data[lang].providers.length,7);
 assert.equal(data[lang].support.length,4);
 assert(data[lang].contentsTitle && data[lang].languageTitle);
 assert(data[lang].sections[9][1].some(p=>p.includes('2026-09-29')));
 for(const kind of ['privacy','support']){
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
