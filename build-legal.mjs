import {readFile,writeFile,mkdir} from 'node:fs/promises';
const content=JSON.parse(await readFile(new URL('./legal-content.json',import.meta.url),'utf8'));
const languages={ko:'한국어',en:'English',ja:'日本語',th:'ไทย',ru:'Русский',es:'Español',mn:'Монгол'};
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const providers=[['Supabase Pte. Ltd.','https://supabase.com/privacy'],['Apple','https://www.apple.com/legal/privacy/'],['Google','https://policies.google.com/privacy'],['RevenueCat, Inc.','https://www.revenuecat.com/privacy'],['Amplitude, Inc.','https://amplitude.com/privacy'],['Open Food Facts','https://world.openfoodfacts.org/privacy'],['GitHub, Inc.','https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement']];
for(const [lang,c] of Object.entries(content)){
 if(!languages[lang]||c.providers.length!==providers.length)throw Error('Invalid locale/provider coverage: '+lang);
 for(const kind of ['privacy','support']){
  const title=c[kind+'Title'];
  const nav=Object.entries(languages).map(([code,label])=>`<a lang="${code}" hreflang="${code}" href="../${kind}/${code}.html"${code===lang?' aria-current="page"':''}>${label}</a>`).join('');
  const sections=kind==='privacy'?c.sections:c.support;
  let body=sections.map(([heading,paragraphs],i)=>`<section id="section-${i+1}"><h2>${escape(heading)}</h2>${paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}</section>`).join('\n');
  if(kind==='privacy')body+=`<section><h2>${escape(c.providersTitle)}</h2>${providers.map(([name,url],i)=>`<article class="provider"><h3>${name}</h3><p>${escape(c.providers[i])}</p><a href="${url}" rel="noreferrer">${escape(c.providerLink)} · ${name}</a></article>`).join('')}</section>`;
  const page=`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="color-scheme" content="light dark"><title>${escape(title)} · ExpiryCheck</title><meta name="description" content="${escape(c.summary)}"><link rel="stylesheet" href="../legal.css"></head><body><main><header><a href="../index.html">ExpiryCheck</a><nav aria-label="Language">${nav}</nav><h1>${escape(title)}</h1><p class="date">${escape(c.updated)} · 2026-09-29</p></header><p class="summary">${escape(c.summary)}</p>${body}<footer><p>전성훈 / Seonghun Jeon<br><a href="mailto:jsh097610@gmail.com">jsh097610@gmail.com</a></p><div class="links"><a href="../privacy/${lang}.html">${escape(c.privacyTitle)}</a><a href="../support/${lang}.html">${escape(c.supportTitle)}</a></div></footer></main></body></html>\n`;
  await mkdir(new URL(`./public/${kind}/`,import.meta.url),{recursive:true});
  await writeFile(new URL(`./public/${kind}/${lang}.html`,import.meta.url),page);
 }
}
if(Object.keys(content).sort().join()!==Object.keys(languages).sort().join())throw Error('Missing locale');
