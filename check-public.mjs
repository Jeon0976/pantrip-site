// Public homepage behavior and links: node check-public.mjs
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'public');
assert.equal(readFileSync(resolve(root,'app-ads.txt'),'utf8'),'google.com, pub-5326804589747186, DIRECT, f08c47fec0942fa0\n','AdMob publisher declaration must be exact plain text');
const html=readFileSync(resolve(root,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Unique DOM ids');
for(const [,url] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
 if(url.startsWith('#')&&url.length>1) assert(ids.includes(url.slice(1)),`Missing anchor ${url}`);
 else if(!/^(#|mailto:|https:)/.test(url)) assert(existsSync(resolve(root,url)),`Missing asset ${url}`);
}
assert(html.includes('role="status" aria-live="polite" aria-atomic="true"'));
assert(html.includes('class="save-sample"><span class="readable-text"'));
for (const [,tag] of html.matchAll(/(<[^>]+aria-label="[^"]+"[^>]*>)/g)) {
 if(!tag.includes('id="language"')) assert(tag.includes('data-ko-aria=') && tag.includes('data-en-aria='),'Localized region label');
}
assert(!html.includes('apps.apple.com'),'No fake download URL');
const css=readFileSync(resolve(root,'style.css'),'utf8');
assert(css.includes('prefers-reduced-motion:reduce'));
assert(css.includes('forced-colors:active'));
assert(!/<(?:button|a|p|strong)[^>]*class="[^"]*dot-text/.test(html),'Small text and controls must be solid');
assert(html.includes('<title>Pantrip: Food &amp; Kitchen</title>'));
assert(html.includes('<h1 class="brand-title">Pantrip: Food &amp; Kitchen</h1>'));
assert(html.includes('google-site-verification'));
assert(html.includes('https://pantrip.app/'));
assert(html.includes('Google sign-in') && html.includes('jsh097610@gmail.com'));
assert(!html.includes('ExpiryCheck') && !html.includes('/admin') && !html.includes('swagger'));
for(const page of ['privacy.html','support.html','terms.html']) assert(html.includes('href="'+page+'"'));
function classes(){const set=new Set();return {contains:k=>set.has(k),toggle(k,state){if(state??!set.has(k))set.add(k);else set.delete(k);}};}
function element(id,dataset={}){return {id,dataset,attrs:{},handlers:{},classList:classes(),textContent:'',hidden:false,disabled:false,currentTime:0,duration:30,
 addEventListener(type,fn){this.handlers[type]=fn;},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},focus(){this.focused=true;},play(){this.played=true;return Promise.resolve();},pause(){this.paused=true;}};}
function run(config){
 const elements=new Map(ids.map(id=>[id,element(id)]));
 const tabs=['step-photo','step-register','step-store'].map((id,i)=>Object.assign(elements.get(id),{dataset:{step:String(i)}}));
 const thumbs=['oak','cafe','seaside','camper','siberian','spaceship','thai','mongolianGer','campsite'].map(k=>element(k,{kitchen:k}));
 const chapters=[0,1,2].map(i=>element('chapter'+i,{chapter:String(i)}));
 const copy=element('translation',{ko:'주방',en:'Kitchen'});
 const meta={};
 const preference={matches:false,addEventListener(_,fn){this.changed=fn;}};
 const document={documentElement:{},body:{classList:classes()},getElementById:id=>elements.get(id),querySelector:()=>meta,
 querySelectorAll:query=>({'[data-step]':tabs,'[data-kitchen]':thumbs,'[data-chapter]':chapters,'[data-ko][data-en]':[copy],'[data-ko-aria]':[]})[query]||[]};
 const window={PANTRIP_SITE:config,matchMedia:()=>preference};
 vm.runInNewContext(readFileSync(resolve(root,'app.js'),'utf8'),{document,window,URL});
 return {elements,tabs,thumbs,chapters,copy,document,preference};
}
const setup={window:{}};vm.runInNewContext(readFileSync(resolve(root,'config.js'),'utf8'),setup);
const config=setup.window.PANTRIP_SITE;
assert(existsSync(resolve(root,config.videoURL)),'Configured actual video exists');
const a=run(config),get=id=>a.elements.get(id);
assert.equal(a.document.documentElement.lang,'ko');
a.tabs[1].handlers.click();assert.equal(get('demo-scene').dataset.state,'1');
get('demo-next').handlers.click();assert.equal(get('demo-scene').dataset.state,'2');
a.tabs[2].handlers.keydown({key:'Home',preventDefault(){}});assert.equal(get('demo-scene').dataset.state,'0');assert(a.tabs[0].focused);
a.thumbs[8].handlers.click();assert.equal(get('gallery-room').src,'assets/kitchen-campsite.jpg');
get('next-kitchen').handlers.click();assert.equal(get('gallery-room').src,'assets/kitchen-oak.jpg');
get('previous-kitchen').handlers.click();assert.equal(get('gallery-room').src,'assets/kitchen-campsite.jpg');
get('language').handlers.click();assert.equal(a.copy.textContent,'Kitchen');assert.equal(get('gallery-name').textContent,'Campsite');
get('motion').handlers.click();assert(get('app-video').paused);assert.equal(get('motion').attrs['aria-pressed'],'true');
a.preference.matches=true;a.preference.changed();assert(get('motion').hidden);
if(config.videoMode==='kitchen') {
 assert(a.chapters.every(button=>button.hidden));
 assert(get('kitchen-play').disabled);
 get('kitchen-play').handlers.click();assert(!get('app-video').played);
 get('app-video').handlers.loadedmetadata();assert(!get('kitchen-play').disabled);
 get('kitchen-play').handlers.click();assert(get('app-video').played);
 get('app-video').handlers.error();assert(get('kitchen-play').disabled);
 assert(get('video-note').textContent.includes('could not load'));
 get('language').handlers.click();assert(get('video-note').textContent.includes('불러오지 못했습니다'));
 assert.equal(get('video-fallback-text').textContent,get('video-note').textContent);
}
const b=run({videoURL:'assets/kitchen-preview.mp4',videoMode:'flow',videoChapters:[0,7,15],privacyURL:'https://example.com/privacy'});
b.elements.get('app-video').handlers.loadedmetadata();
b.chapters[1].handlers.click();assert.equal(b.elements.get('app-video').currentTime,7);assert(b.elements.get('app-video').played);
b.elements.get('app-video').currentTime=16;b.elements.get('app-video').handlers.timeupdate();assert(b.chapters[2].classList.contains('active'));
assert.equal(b.elements.get('privacy-link').href,'https://example.com/privacy');
b.elements.get('app-video').handlers.error();assert(b.chapters.every(button=>button.disabled));
console.log('PASS: assets/anchors, 3-step demo+keyboard, 9 kitchens+wrap, KO/EN, motion controls, real video+chapter seek/error, privacy config');
assert.equal(a.document.title,'Pantrip: Food & Kitchen');
console.log('PASS: Pantrip brand, verification meta, Google sign-in explanation and public policy links');
