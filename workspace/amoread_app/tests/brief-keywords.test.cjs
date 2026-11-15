// node --test tests/brief-keywords.test.cjs
// DOM 대신 최소 화면 표면을 사용해 비동기 재검색/선택 상태를 결정적으로 검증한다.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const V2 = path.join(__dirname, '../planner/static/v2');

class Element {
  constructor() { this.value=''; this.innerHTML=''; this.textContent=''; this.dataset={}; this.handlers={}; this.children=[]; this.classList={add(){},remove(){}}; }
  addEventListener(name, fn) { this.handlers[name]=fn; }
  setAttribute(name, value) { this[name]=value; }
  append(...els) { this.children.push(...els); }
  replaceChildren(...els) { this.children=els; }
  querySelectorAll() { return []; }
  focus() {} select() {} scrollIntoView() {} setCustomValidity() {} reportValidity() {}
  submit() { this.handlers.submit({preventDefault(){}}); }
}
const response = (seed, words=[]) => ({seed, fetched_at:'2026-11-15T12:00:00Z', sources:{searchad:{status:'ok',items:words.map(keyword=>({keyword}))},datalab:{status:'ok',items:[]},naver_search:{status:'ok',items:[]}},words:[]});
async function setup(savedDoc) {
  const elements = new Map();
  for(const [,id] of fs.readFileSync(path.join(V2,'brief.html'),'utf8').matchAll(/id="([^"]+)"/g)) elements.set('#'+id,new Element());
  const doc = savedDoc || {title:'기획안',brief:{myeongbun:'연말 선물',concept:'작성한 컨셉',key_copy:'작성한 카피',season_ref:{name:'연말'}},v2:{seed:'연말 선물',keywords:[]}};
  const pending=[];
  const context=vm.createContext({console, URL, URLSearchParams, Map, Set, Promise, CSS:{escape:x=>x},
    setTimeout:()=>1, clearTimeout(){}, location:{search:'?id=test',href:'',assign(){}},
    document:{getElementById:id=>elements.get('#'+id),querySelector:q=>elements.get(q)||null,createElementNS:()=>new Element(),addEventListener(){}},
    addEventListener(){},PLAN:{id:'test',doc,ready:Promise.resolve(doc),save(fn){fn(doc)},flush:()=>Promise.resolve()},
    v2api(url,body){
      if(url==='/api/keywords/expand') return new Promise((resolve,reject)=>pending.push({body,resolve,reject}));
      if(url==='/api/connections')return Promise.resolve({keys:{naver:false,searchad:false}});
      if(url==='/api/brief/recommendations')return Promise.resolve({suggestions:[]});
      if(url==='/api/brief/keywords')return new Promise((resolve,reject)=>pending.push({ai:true,body,resolve,reject}));
      return Promise.resolve({items:[],products:[]});
    }
  });
  context.window=context;
  vm.runInContext(fs.readFileSync(path.join(V2,'brief-keywords.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(V2,'brief.js'),'utf8'),context);
  const settle = async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
  await settle();
  return {context,doc,pending,elements,settle,run:code=>vm.runInContext(code,context), submit(root){elements.get('#rootInput').value=root;elements.get('#rootForm').submit();}};
}

test('no speculative initial request; stored root is the only first search',async()=>{
  const s=await setup();assert.deepEqual(s.pending.map(x=>x.body.q),['연말 선물']);
});

test('late old-root responses cannot contaminate the new map or erase authored brief',async()=>{
  const s=await setup();const old=s.pending[0];
  s.run("addNode('감사 선물',{source:'searchad'});pick('감사 선물')");
  s.submit('봄 나들이'); const fresh=s.pending.at(-1); assert.equal(fresh.body.refresh,true);
  fresh.resolve(response('봄 나들이',['피크닉']));await s.settle();
  old.resolve(response('연말 선물',['이전 응답 키워드']));await s.settle();
  assert.deepEqual(Array.from(s.run('info(ROOT).kids')),['피크닉']);
  assert.equal(s.doc.brief.myeongbun,'봄 나들이');assert.equal(s.doc.v2.seed,'봄 나들이');
  assert.equal(s.doc.brief.concept,'작성한 컨셉');assert.equal(s.doc.brief.key_copy,'작성한 카피');
  assert.equal(s.doc.brief.season_ref,null);assert.deepEqual(Array.from(s.doc.v2.keywords),['감사 선물']);
  assert.equal(s.doc.v2.keyword_research.evidence[0].root,'연말 선물');
});

test('same-root refresh preserves manually added words and dismissed suggestions',async()=>{
  const s=await setup();s.run("manualWords=[BK.evidence('티타임',{category:'situation',source:'manual'},null,ROOT)];hiddenWords.add('숨긴말')");
  s.submit('연말 선물');assert.equal(s.run("info(ROOT).kids.includes('티타임')"),true);assert.equal(s.run("hiddenWords.has('숨긴말')"),true);
});

test('missing or too-short search data is never called stable; unsafe links are not persisted',async()=>{
  const s=await setup();assert.equal(s.run("BK.trend(null,'선물').label"),'검색 추이 미확인');
  assert.equal(s.run("BK.trend({sources:{datalab:{status:'ok',items:[{keyword:'선물',change_4w:0,weekly:[1,2]}]}}},'선물').label"),'검색 추이 미확인');
  assert.equal(s.run("BK.safeURL('javascript:alert(1)')"),'');
});

test('hidden words stay out of the map and actual product matching does not introduce unrelated goods',async()=>{
  const s=await setup();s.pending[0].resolve(response('연말 선물',['티백','사무실 티타임']));await s.settle();
  s.run("OURS.state='ok';OURS.prods=[{seq:'1',name:'티백 선물세트 20입'},{seq:'2',name:'무관한 물건'}];hiddenWords.add('사무실 티타임');connectProducts()");
  assert.equal(s.run("branchWords().includes('사무실 티타임')"),false);
  assert.deepEqual(Array.from(s.run("branchWords().filter(k=>info(k).source==='product')")),['티백 선물세트 20입']);
  assert.equal(s.run('info(\'티백 선물세트 20입\').product.seq'),'1');
});


test('first branches are actual words, never planning category nodes',async()=>{
  const s=await setup();s.pending[0].resolve(response('연말 선물',['감사 선물','티백','사무실 티타임']));await s.settle();
  const nodes=s.elements.get('#map').children.filter(x=>x['data-k']);
  assert.deepEqual(nodes.map(x=>x['data-k']),['감사 선물','티백','사무실 티타임','연말 선물']);
  assert.equal(nodes.some(x=>x['data-k'].startsWith('@group:')),false);
});

test('web keywords join the current seed and persist provenance without claiming search growth',async()=>{
  const s=await setup();s.run('expandAIKeywords()');const pending=s.pending.find(x=>x.ai);
  assert.equal(pending.body.seed,'연말 선물');
  pending.resolve({seed:'연말 선물',fetched_at:'2026-11-15T12:00:00Z',items:[
    {keyword:'취향 큐레이션',source:'ai_web',rationale:'웹 콘텐츠에서 도출한 연상',sources:[{title:'선물 고르기',date:'2026-11-10',link:'https://example.com/gift',kind:'웹 자료'}]},
    {keyword:'차 한 잔 편지',source:'ai_idea',rationale:'창의적 연상',sources:[]}]});await s.settle();
  assert.equal(s.run("info(ROOT).kids.includes('취향 큐레이션')"),true);
  assert.equal(s.doc.v2.keyword_research.ai_expansions[0].items[0].source,'ai_web');
  assert.equal(s.run("BK.evidence('취향 큐레이션',info('취향 큐레이션'),null,ROOT).change_4w"),null);
  s.run("pick('취향 큐레이션')");
  const ev=s.doc.v2.keyword_research.evidence[0];
  assert.equal(ev.articles[0].link,'https://example.com/gift');assert.equal(ev.rationale,'웹 콘텐츠에서 도출한 연상');
  assert.deepEqual(Array.from(s.run("keywordTitles('취향 큐레이션')")),['선물 고르기']);
});

test('AI requests for the previous root are ignored; an error leaves previous branches intact',async()=>{
  const s=await setup();s.run('expandAIKeywords()');const old=s.pending.find(x=>x.ai);
  s.submit('봄 나들이');old.resolve({items:[{keyword:'예전 AI 결과',source:'ai_idea',sources:[],rationale:'예전'}]});await s.settle();
  assert.equal(s.run("info(ROOT).kids.includes('예전 AI 결과')"),false);
  s.pending.filter(x=>!x.ai).at(-1).resolve(response('봄 나들이',['피크닉']));await s.settle();
  s.run('expandAIKeywords()');s.pending.filter(x=>x.ai).at(-1).reject(Error('연결 실패'));await s.settle();
  assert.equal(s.run("info(ROOT).kids.includes('피크닉')"),true);
  assert.match(s.elements.get('#aiKeywordStatus').textContent,/기존 키워드는 유지/);
});


test('saved AI branches and their links restore before any fresh external result',async()=>{
  const s=await setup();s.run('expandAIKeywords()');
  s.pending.find(x=>x.ai).resolve({seed:'연말 선물',fetched_at:'2026-11-15T12:00:00Z',items:[
    {keyword:'취향 큐레이션',source:'ai_web',rationale:'저장할 추천 이유',sources:[{title:'자료',link:'https://example.com/gift',date:'2026-11-10'}]}]});await s.settle();
  const restored=await setup(JSON.parse(JSON.stringify(s.doc)));
  assert.equal(restored.run("info(ROOT).kids.includes('취향 큐레이션')"),true);
  assert.equal(restored.run("info('취향 큐레이션').aiEvidence.articles[0].link"),'https://example.com/gift');
  assert.equal(restored.pending.some(p=>p.ai),false);
});


test('late search metrics update badges without moving existing clickable nodes',async()=>{
  const s=await setup();s.pending[0].resolve(response('연말 선물',['감사 선물','티백']));await s.settle();
  assert.deepEqual(Array.from(s.run('branchWords()')),['감사 선물','티백']);
  s.run("LIVE.set('티백',{state:'ok',data:{sources:{datalab:{status:'ok',items:[{keyword:'티백',change_4w:1,weekly:Array(8).fill(['2026-11-01',1])}]}}}})");
  assert.deepEqual(Array.from(s.run('branchWords()')),['감사 선물','티백']);
});
