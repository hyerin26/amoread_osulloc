/* AMOREAD Editor Inspector — additive UI primitives. The canonical tokens.css is untouched. */
window.AMEditorUI = (()=>{
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const field=(key,label,value,options={})=>{
    const id='ed-'+key.replace(/[^a-z0-9_-]/gi,'-');
    const max=options.max||200;
    const input=options.area
      ? `<textarea class="am-ed-textarea" id="${id}" data-bind="${escape(key)}" maxlength="${max}" rows="${options.rows||3}">${escape(value)}</textarea>`
      : `<input class="am-ed-input" id="${id}" data-bind="${escape(key)}" maxlength="${max}" value="${escape(value)}" type="${options.type||'text'}" ${options.placeholder?`placeholder="${escape(options.placeholder)}"`:''}>`;
    return `<div class="am-ed-field"><label for="${id}" class="am-ed-label"${options.help?` title="${escape(options.help)}"`:''}>${escape(label)} ${options.optional?'<span class="am-ed-optional">· 선택</span>':''}</label>${input}<div class="am-ed-field-meta"><span class="am-ed-support">${escape(options.help||'')}</span>${options.count===false?'':`<span class="am-ed-support" data-counter-for="${escape(key)}">${String(value||'').length}/${max}</span>`}</div></div>`;
  };
  const group=(title,description,inner,action='')=>`<section class="am-ed-group"><div class="am-ed-group__title"><h3${description?` title="${escape(description)}"`:''}>${escape(title)}</h3>${action}</div>${description?`<p class="am-ed-group__description">${escape(description)}</p>`:''}<div class="am-ed-stack">${inner}</div></section>`;
  const button=(text,attr='',className='')=>`<button type="button" class="am-ed-button ${className}" ${attr}>${escape(text)}</button>`;
  const toggle=(key,label,checked,help='',disabled=false)=>`<label class="am-ed-toggle"${help?` title="${escape(help)}"`:''}><input type="checkbox" role="switch" data-check="${escape(key)}" ${checked?'checked':''} ${disabled?'disabled':''}><span><strong>${escape(label)}</strong>${help?`<small>${escape(help)}</small>`:''}</span></label>`;
  const choices=(key,options,value)=>`<div class="am-ed-choice" role="group" aria-label="${escape(key)} 선택">${options.map(([v,lab])=>`<button type="button" data-choice="${escape(key)}" data-value="${escape(v)}" aria-pressed="${v===value}">${escape(lab)}</button>`).join('')}</div>`;
  const icon=(symbol,title,action,disabled=false)=>`<button type="button" class="am-ed-icon-btn" data-action="${escape(action)}" title="${escape(title)}" aria-label="${escape(title)}" ${disabled?'disabled':''}>${window.AMEditorKit?.icon(({'↑':'arrow-up','↓':'arrow-down','×':'trash'})[symbol]||'info','am-kit-icon--sm')||escape(symbol)}</button>`;
  const repeat=(key,i,title,meta,content,count)=>`<div class="am-ed-repeat" data-inspector-repeat="${escape(key)}:${i}"><div class="am-ed-repeat__header"><span class="am-ed-tag">${i+1}</span><div class="am-ed-repeat__main"><strong>${escape(title)}</strong><small>${escape(meta)}</small></div>${icon('↑','위로 이동',`move:${key}:${i}:-1`,i===0)}${icon('↓','아래로 이동',`move:${key}:${i}:1`,i===count-1)}${icon('×','항목 삭제',`delete:${key}:${i}`)}</div><div class="am-ed-repeat__body"><div class="am-ed-stack">${content}</div></div></div>`;
  return {escape,field,group,button,toggle,choices,icon,repeat};
})();
