/* AMOREAD editor chrome components — Green UI v2.5.1 semantic token consumers.
 * Do not import a CDN, mutate canonical design tokens or modify storefront rendering.
 */
window.AMEditorKit=(()=>{
  const shapes={
    'chevron-right':'<path d="m9 18 6-6-6-6"/>',
    'chevron-down':'<path d="m6 9 6 6 6-6"/>',
    'list-tree':'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    'blocks':'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M17.5 14v7m-3.5-3.5h7"/>',
    'database':'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
    'package':'<path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10"/>',
    'grid':'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    'image':'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    'file-text':'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
    'type':'<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    'calendar':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    'star':'<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z"/>',
    'circle-help':'<circle cx="12" cy="12" r="10"/><path d="M9.2 9a3 3 0 0 1 5.6 1.5c0 2-2.8 2.3-2.8 4.1M12 18h.01"/>',
    'check':'<path d="m5 12 4 4L19 6"/>',
    'copy':'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    'trash':'<path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6M10 10v7M14 10v7"/>',
    'arrow-up':'<path d="m12 19 0-14m-6 6 6-6 6 6"/>',
    'arrow-down':'<path d="m12 5 0 14m-6-6 6 6 6-6"/>',
    'plus':'<path d="M12 5v14M5 12h14"/>',
    'info':'<circle cx="12" cy="12" r="10"/><path d="M12 11v5M12 7h.01"/>',
    'layers':'<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',
    'settings':'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.9l.06.06-1.7 1.7-.06-.06a1.7 1.7 0 0 0-1.9-.34l-.08.03V21h-2.4v-.1a1.7 1.7 0 0 0-1.3-1.6l-.1-.03-.09.03a1.7 1.7 0 0 0-1.3 1.6V21H8.5v-2.7l-.08-.03a1.7 1.7 0 0 0-1.9.34l-.06.06-1.7-1.7.06-.06a1.7 1.7 0 0 0 .34-1.9L5.1 15H3v-2.4h2.1l.03-.08a1.7 1.7 0 0 0-.34-1.9l-.06-.06 1.7-1.7.06.06a1.7 1.7 0 0 0 1.9.34L8.5 9V6.3h2.4v.1a1.7 1.7 0 0 0 1.3 1.6l.09.03.1-.03a1.7 1.7 0 0 0 1.3-1.6v-.1h2.4V9l.08.03a1.7 1.7 0 0 0 1.9-.34l.06-.06 1.7 1.7-.06.06a1.7 1.7 0 0 0-.34 1.9l.03.08H21V15h-1.6Z"/>',
  };
  const icons=Object.entries(shapes).map(([name,paths])=>`<symbol id="am-kit-${name}" viewBox="0 0 24 24">${paths}</symbol>`).join('');
  const container=document.createElementNS('http://www.w3.org/2000/svg','svg');
  container.setAttribute('aria-hidden','true');container.setAttribute('focusable','false');container.classList.add('am-kit-sprite');
  container.innerHTML=icons;document.body.prepend(container);
  const allowed=new Set(Object.keys(shapes));
  const icon=(name,cls='')=>`<svg class="am-kit-icon ${cls}" aria-hidden="true" focusable="false" viewBox="0 0 24 24"><use href="#am-kit-${allowed.has(name)?name:'info'}"></use></svg>`;
  const prefersReduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let requested=0;
  function revealInPreview({sectionId,blockId=null,childType=null,index=0}={}){
    const serial=++requested;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(serial!==requested||!sectionId)return;
      const wrap=document.querySelector('#page [data-page="'+CSS.escape(sectionId)+'"]');
      if(!wrap)return;
      let target=wrap;
      if(blockId)target=wrap.querySelector('[data-cb-node="'+CSS.escape(blockId)+'"]')||wrap;
      else if(childType==='native-product')target=wrap.querySelectorAll('.mock-product')[index]||wrap;
      else if(childType==='item')target=wrap.querySelectorAll('.am-flow-info-item,.mock-item')[index]||wrap;
      else if(childType==='review')target=wrap.querySelectorAll('.mock-review-card')[index]||wrap;
      else if(childType==='quiz-question'||childType==='quiz-result'||childType==='quiz-view')target=wrap.querySelector('.mock-event')||wrap;
      const rect=target.getBoundingClientRect();
      const visible=rect.top>=72&&rect.bottom<=window.innerHeight-20;
      if(!visible)target.scrollIntoView({block:'center',inline:'nearest',behavior:prefersReduced()?'instant':'smooth'});
      target.classList.remove('am-kit-preview-target');void target.offsetWidth;
      target.classList.add('am-kit-preview-target');
      setTimeout(()=>target.classList.remove('am-kit-preview-target'),1200);
    }));
  }
  return {icon,revealInPreview};
})();

/* CSP-safe inline styles (2026-11-14, AMOREAD app integration).
 * The app server sends `style-src 'self'`, which ignores style="..." attributes written into HTML strings.
 * Templates write data-am-style="..." instead; this applies only listed properties with plain values through
 * CSSOM (allowed by CSP). Works the same in the standalone Lab (no CSP). */
(()=>{
  const PROP=/^(--am-[a-z-]+|width|text-align|aspect-ratio|background|margin-top)$/;
  const VALUE=/^[\w\s.%#(),\/-]+$/;
  const done=new WeakMap();
  const apply=el=>{
    const raw=el.getAttribute('data-am-style');
    if(!raw||done.get(el)===raw)return;
    done.set(el,raw);
    for(const decl of raw.split(';')){
      const i=decl.indexOf(':');if(i<0)continue;
      const prop=decl.slice(0,i).trim().toLowerCase(),value=decl.slice(i+1).trim();
      if(PROP.test(prop)&&VALUE.test(value)&&!/url\s*\(|expression/i.test(value))el.style.setProperty(prop,value);
    }
  };
  const scan=root=>{if(root.nodeType!==1)return;if(root.hasAttribute('data-am-style'))apply(root);root.querySelectorAll('[data-am-style]').forEach(apply);};
  new MutationObserver(list=>list.forEach(m=>m.addedNodes.forEach(scan))).observe(document.documentElement,{childList:true,subtree:true});
  if(document.body)scan(document.body);
  window.AMEditorStyleScan=scan;
})();
