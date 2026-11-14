document.addEventListener('DOMContentLoaded',()=>{
 const UI=window.AMEditorUI, kit=window.AMEditorKit;
 document.querySelector('#demo-fields').innerHTML=UI.group('문구 편집','입력한 개행은 고객 화면에도 유지됩니다.',UI.field('name','메인 제목','봄의 향기를 선물하세요',{area:true,help:'고객에게 노출되는 제목',max:60})+UI.field('description','부가 설명','특별한 티타임을 제안합니다',{help:'한 줄 설명',max:100}));
 document.querySelector('#demo-switch').innerHTML=UI.toggle('visible','CTA 표시',true,'변경 즉시 와이어프레임에 적용됩니다.');
 document.querySelector('#demo-choice').innerHTML=UI.choices('columns',[[1,'1열'],[2,'2열'],[3,'3열']],2);
 document.querySelector('#demo-repeat').innerHTML=UI.repeat('samples',0,'추가 문구 1','원문 표시',UI.field('sample','문구','혜택은 주문 시 적용됩니다',{area:true}),2);
 document.querySelector('#demo-icons').innerHTML=['chevron-right','copy','trash','plus','image','package','calendar','star','blocks','database'].map(name=>`<button type="button" class="am-ed-icon-btn" title="${name}" aria-label="${name}">${kit.icon(name,'am-kit-icon--sm')}</button>`).join('');
 document.querySelector('#demo-spacing').innerHTML=[4,8,12,16,24,32].map((n,i)=>`<div class="am-kit-gallery__row" data-am-style="margin-top:8px"><span data-am-style="width:40px">${n}px</span><span data-am-style="display:inline-block;width:${n*4}px;height:9px;background:var(--accent-soft);border:1px solid var(--sel-line)"></span><code>--s${i+1}</code></div>`).join('');
 document.querySelectorAll('[data-choice]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-choice="columns"]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))}));
 document.querySelector('#demo-switch').addEventListener('change',e=>document.querySelector('#demo-switch-state').textContent=e.target.checked?'CTA 표시: 켜짐':'CTA 표시: 꺼짐');
 document.querySelector('#demo-dialog-open').addEventListener('click',()=>document.querySelector('#demo-dialog').showModal());
 document.querySelectorAll('[data-dialog-close]').forEach(b=>b.addEventListener('click',()=>document.querySelector('#demo-dialog').close()));
 document.querySelectorAll('[data-gallery-toast]').forEach(b=>b.addEventListener('click',()=>{const toast=document.querySelector('#gallery-toast');toast.textContent=b.dataset.galleryToast;toast.hidden=false;}));
 document.querySelectorAll('.am-kit-primary-nav button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.am-kit-primary-nav button').forEach(x=>{x.setAttribute('aria-selected',String(x===b));x.setAttribute('aria-pressed',String(x===b))})}));
});