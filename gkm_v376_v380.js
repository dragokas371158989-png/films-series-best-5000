/* GKM V376-V380 quality layer: titles, posters, AI actions, My Golub, smart collections. */
(() => {
  'use strict';
  if (window.GKM_V376_V380_LOADED) return;
  window.GKM_V376_V380_LOADED = true;
  window.GKM_V376_TITLE_AUDIT_VERSION = 'v376-title-quality-layer-2026-08-13';
  window.GKM_V377_POSTER_RECOVERY_VERSION = 'v377-poster-recovery-layer-2026-08-13';
  window.GKM_V378_AI_ACTIONS_VERSION = 'v378-ai-actions-2026-08-13';
  window.GKM_V379_MY_GOLUB_VERSION = 'v379-my-golub-library-2026-08-13';
  window.GKM_V380_SMART_COLLECTIONS_VERSION = 'v380-smart-collections-2026-08-13';

  const STORE = 'gkm_my_golub_v379';
  const STATUSES = ['Хочу посмотреть','Смотрю','Просмотрено','Отложено','Брошено'];
  const GENERIC = /^(?:без названия|unknown|untitled|n\/a|null|none|test|movie|film|series|anime|мультфильм|фильм|сериал|аниме|картина|проект)\s*[\d._-]*$/i;
  const badTitle = t => !t || GENERIC.test(String(t).trim()) || String(t).trim().length < 2;
  const norm = v => String(v || '').toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const load = () => { try { const x=JSON.parse(localStorage.getItem(STORE)||'{}'); return x&&typeof x==='object'?x:{}; } catch { return {}; } };
  const save = x => localStorage.setItem(STORE,JSON.stringify(x));
  const keyOf = item => norm([item.title,item.year,item.type].filter(Boolean).join('|')) || norm(item.title);

  function cardItem(card){
    const titleEl=card.querySelector('.card-title,.title,h2,h3,[data-title]');
    const title=(titleEl?.getAttribute('data-title')||titleEl?.textContent||card.dataset.title||'').trim();
    const text=card.innerText||'';
    const year=(card.dataset.year||((text.match(/\b(18\d{2}|19\d{2}|20\d{2})\b/)||[])[1])||'').trim();
    const type=(card.dataset.type||((text.match(/\b(Фильм|Сериал|Аниме|Мультфильм)\b/i)||[])[1])||'').trim();
    return {title,year,type};
  }

  function fallbackSvg(item){
    const title=esc(item.title||'ГОЛУБЬ'), sub=esc([item.year,item.type].filter(Boolean).join(' • ')||'Каталог Мира');
    return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#141b48"/><stop offset=".55" stop-color="#4d178c"/><stop offset="1" stop-color="#007fa8"/></linearGradient></defs><rect width="600" height="900" fill="url(#g)"/><circle cx="500" cy="110" r="170" fill="#00d8ff" opacity=".12"/><circle cx="90" cy="760" r="210" fill="#9a38ff" opacity=".14"/><text x="50%" y="48%" fill="white" font-family="Arial,sans-serif" font-size="38" font-weight="700" text-anchor="middle">${title.slice(0,40)}</text><text x="50%" y="54%" fill="#bfefff" font-family="Arial,sans-serif" font-size="22" text-anchor="middle">${sub.slice(0,60)}</text><text x="50%" y="92%" fill="#dff8ff" font-family="Arial,sans-serif" font-size="20" font-weight="700" text-anchor="middle">ГОЛУБЬ • КАТАЛОГ МИРА</text></svg>`);
  }

  function addStatusBar(card,item){
    if(card.querySelector('.gkm-v379-status')) return;
    const bar=document.createElement('div'); bar.className='gkm-v379-status';
    bar.style.cssText='display:flex;gap:4px;flex-wrap:wrap;padding:7px 8px;border-top:1px solid rgba(0,213,255,.16);position:relative;z-index:3';
    const data=load(), k=keyOf(item), active=data[k]?.status;
    STATUSES.forEach((s,i)=>{
      const b=document.createElement('button'); b.type='button'; b.textContent=['🔖','▶️','✅','⏸️','❌'][i]; b.title=s;
      b.style.cssText=`padding:4px 6px!important;font-size:12px!important;line-height:1!important;min-width:30px!important;opacity:${active===s?'1':'.65'}!important`;
      b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const all=load();all[k]={...item,status:s,updatedAt:Date.now()};save(all);bar.querySelectorAll('button').forEach(x=>x.style.opacity='.65');b.style.opacity='1';updatePanel();});
      bar.appendChild(b);
    });
    card.appendChild(bar);
  }

  function repairCard(card){
    const item=cardItem(card), titleEl=card.querySelector('.card-title,.title,h2,h3,[data-title]');
    if(titleEl && badTitle(item.title)){
      const candidates=[card.dataset.originalTitle,card.dataset.name,titleEl.getAttribute('title'),card.querySelector('img')?.alt].filter(x=>x&&!badTitle(x));
      if(candidates.length){titleEl.textContent=candidates[0].trim();titleEl.dataset.gkmV376='repaired';}
      else {titleEl.dataset.gkmV376='suspect';card.classList.add('gkm-v376-suspect');}
    }
    card.querySelectorAll('img').forEach(img=>{
      if(img.dataset.gkmV377) return; img.dataset.gkmV377='1';
      const fix=()=>{if(img.dataset.gkmFallback==='1')return;img.dataset.gkmFallback='1';img.src=fallbackSvg(item);img.alt=(item.title||'Постер')+' — постер временно недоступен';};
      img.addEventListener('error',fix,{once:true}); if(!img.getAttribute('src'))fix();
    });
    addStatusBar(card,item);
  }

  function style(){
    if(document.getElementById('gkm-v376-v380-style'))return;
    const s=document.createElement('style');s.id='gkm-v376-v380-style';
    s.textContent=`#gkmV379Btn{position:fixed;right:18px;bottom:150px;z-index:99996;border:1px solid rgba(0,220,255,.45);border-radius:18px;background:linear-gradient(135deg,#3b167b,#008ed0);color:#fff;font-weight:900;padding:12px 16px;box-shadow:0 0 24px rgba(0,180,255,.3)}#gkmV379Dialog{max-width:min(900px,94vw);width:900px;background:#071126;color:#eef8ff;border:1px solid #00d4ff;border-radius:20px;padding:0;box-shadow:0 20px 80px rgba(0,0,0,.6)}.gkm379-head{display:flex;justify-content:space-between;gap:12px;padding:18px;border-bottom:1px solid rgba(0,213,255,.2)}.gkm379-body{padding:18px;max-height:70vh;overflow:auto}.gkm379-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px}.gkm379-stat{padding:10px;border:1px solid rgba(0,213,255,.2);border-radius:12px;text-align:center}.gkm379-list{display:grid;gap:8px}.gkm379-row{padding:10px;border-radius:12px;background:rgba(255,255,255,.04);display:flex;justify-content:space-between;gap:10px}.gkm379-collections{display:flex;gap:7px;flex-wrap:wrap;padding:8px 0}.gkm379-collections button{padding:8px 10px}.gkm-v376-suspect{outline:1px dashed rgba(255,190,0,.7)}@media(max-width:600px){#gkmV379Btn{right:10px;bottom:142px}.gkm379-stats{grid-template-columns:repeat(2,1fr)}}`;
    document.head.appendChild(s);
  }

  let dialog;
  function ensurePanel(){
    if(dialog)return;style();
    const btn=document.createElement('button');btn.id='gkmV379Btn';btn.type='button';btn.textContent='🕊 Мой Голубь';
    btn.addEventListener('click',()=>{updatePanel();dialog.showModal();});document.body.appendChild(btn);
    dialog=document.createElement('dialog');dialog.id='gkmV379Dialog';
    dialog.innerHTML='<div class="gkm379-head"><div><b>🕊 Мой Голубь</b><div style="opacity:.72;font-size:13px;margin-top:4px">Личная библиотека и рекомендации</div></div><button type="button" data-close>✕</button></div><div class="gkm379-body"><div class="gkm379-collections" id="gkm379Collections"></div><div class="gkm379-stats" id="gkm379Stats"></div><div class="gkm379-list" id="gkm379List"></div></div>';
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();document.body.appendChild(dialog);
  }
  function updatePanel(){
    if(!dialog)return;const all=Object.values(load()).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    const counts=Object.fromEntries(STATUSES.map(s=>[s,all.filter(x=>x.status===s).length]));
    dialog.querySelector('#gkm379Stats').innerHTML=STATUSES.map((s,i)=>`<div class="gkm379-stat"><div style="font-size:20px">${['🔖','▶️','✅','⏸️','❌'][i]}</div><b>${counts[s]||0}</b><div style="font-size:11px;opacity:.75">${esc(s)}</div></div>`).join('');
    dialog.querySelector('#gkm379List').innerHTML=all.length?all.slice(0,80).map(x=>`<div class="gkm379-row"><div><b>${esc(x.title||'Без названия')}</b><div style="font-size:12px;opacity:.7">${esc([x.year,x.type].filter(Boolean).join(' • '))}</div></div><span>${esc(x.status||'')}</span></div>`).join(''):'<div style="opacity:.7;padding:18px 0">Пока пусто. Отмечай карточки прямо в каталоге.</div>';
    const col=dialog.querySelector('#gkm379Collections');col.innerHTML='';
    [['🍿 На вечер','посоветуй фильм на вечер'],['😱 Ужасы','лучшие ужасы'],['⚔️ Экшен','лучший боевик'],['🎌 Аниме','посоветуй популярное аниме'],['🧠 Умное','умный фильм с высоким рейтингом'],['🔥 Популярное','покажи популярное']].forEach(([label,q])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{dialog.close();runAiQuery(q);};col.appendChild(b);});
  }

  function runAiQuery(q){
    document.querySelector('#gkmAiFloatBtn,#gkmAiTopBtn')?.click();
    let tries=0;const t=setInterval(()=>{tries++;const input=[...document.querySelectorAll('#gkmAiDialog textarea,#gkmAiDialog input[type="text"],#gkmAiDialog input:not([type])')][0];
      if(input){input.value=q;input.dispatchEvent(new Event('input',{bubbles:true}));const send=[...document.querySelectorAll('#gkmAiDialog button')].find(b=>/отправ|спрос|найти|➤|➜/i.test((b.textContent||'').trim()));send?.click();clearInterval(t);}
      if(tries>20)clearInterval(t);
    },150);
  }
  function aiActions(){
    const root=document.querySelector('#gkmAiDialog');if(!root||root.dataset.gkmV378)return;root.dataset.gkmV378='1';
    const box=document.createElement('div');box.className='gkm379-collections';box.style.padding='8px 12px';
    [['🍿 На вечер','посоветуй фильм на вечер'],['🎌 Аниме','посоветуй популярное аниме'],['🔥 Топ','покажи лучшее'],['😱 Страшное','посоветуй страшное кино']].forEach(([t,q])=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.onclick=()=>runAiQuery(q);box.appendChild(b);});
    root.querySelector('.ai-box')?.prepend(box);
  }
  function scan(){document.querySelectorAll('.card').forEach(repairCard);aiActions();}
  function init(){ensurePanel();scan();const mo=new MutationObserver(()=>requestAnimationFrame(scan));mo.observe(document.body,{childList:true,subtree:true});window.GKM_MY_GOLUB={get:load,set:(item,status)=>{const d=load();d[keyOf(item)]={...item,status,updatedAt:Date.now()};save(d);updatePanel();},statuses:STATUSES};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,300),{once:true});else setTimeout(init,300);
})();