/* GKM V376-V380 v2 — integrated into existing "Мои списки 2.0", no extra floating button. */
(() => {
'use strict';
if (window.GKM_V376_V380_V2_LOADED) return;
window.GKM_V376_V380_V2_LOADED=true;
const STORE='gkm_my_golub_v379';
const STATUSES=[['🔖','Хочу посмотреть'],['▶️','Смотрю'],['✅','Просмотрено'],['⏸️','Отложено'],['❌','Брошено']];
const norm=v=>String(v||'').toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const load=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'{}')||{}}catch{return{}}};
const save=x=>localStorage.setItem(STORE,JSON.stringify(x));
const keyOf=i=>norm([i.title,i.year,i.type].filter(Boolean).join('|'))||norm(i.title);
document.getElementById('gkmV379Btn')?.remove();document.getElementById('gkmV379Dialog')?.remove();

function addStyle(){if(document.getElementById('gkm-v2-style'))return;const s=document.createElement('style');s.id='gkm-v2-style';s.textContent=`
.gkm-v379-integrated{margin:12px 0;padding:14px;border:1px solid rgba(0,213,255,.3);border-radius:14px;background:rgba(4,15,37,.55)}
.gkm-v379-status{display:flex;gap:4px;flex-wrap:wrap;padding:6px;border-top:1px solid rgba(0,213,255,.16)}
.gkm-v379-status button{padding:4px 6px!important;font-size:12px!important;min-width:30px!important}
.gkm-v379-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:10px 0}.gkm-v379-stat{padding:9px 6px;border:1px solid rgba(0,213,255,.2);border-radius:10px;text-align:center;font-size:12px}
.gkm-v379-tabs,.gkm-v380-row{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}.gkm-v379-tabs button,.gkm-v380-row button{padding:8px 10px!important;border-radius:10px!important}
.gkm-v379-list{display:grid;gap:6px;max-height:360px;overflow:auto}.gkm-v379-row{display:flex;justify-content:space-between;gap:8px;padding:9px;border-radius:9px;background:rgba(255,255,255,.035)}
@media(max-width:650px){.gkm-v379-stats{grid-template-columns:repeat(2,1fr)}}`;document.head.appendChild(s)}

function cardItem(card){const t=card.querySelector('.card-title,.title,h2,h3,[data-title]');const text=card.innerText||'';return{title:(t?.getAttribute('data-title')||t?.textContent||card.dataset.title||'').trim(),year:(card.dataset.year||((text.match(/\b(18\d{2}|19\d{2}|20\d{2})\b/)||[])[1])||'').trim(),type:(card.dataset.type||((text.match(/\b(Фильм|Сериал|Аниме|Мультфильм)\b/i)||[])[1])||'').trim()}}

function addStatuses(card,i){if(card.querySelector('.gkm-v379-status'))return;const bar=document.createElement('div');bar.className='gkm-v379-status';const d=load(),k=keyOf(i),active=d[k]?.status;STATUSES.forEach(([icon,name])=>{const b=document.createElement('button');b.type='button';b.textContent=icon;b.title=name;b.style.opacity=active===name?'1':'.62';b.onclick=e=>{e.preventDefault();e.stopPropagation();const x=load();x[k]={...i,status:name,updatedAt:Date.now()};save(x);bar.querySelectorAll('button').forEach(q=>q.style.opacity='.62');b.style.opacity='1';renderIntegrated()};bar.appendChild(b)});card.appendChild(bar)}

function findHost(){const trigger=[...document.querySelectorAll('button,a,[role="button"]')].find(x=>/мои\s+списки/i.test((x.textContent||'').trim()));if(!trigger)return null;const open=[...document.querySelectorAll('dialog,[role="dialog"],.modal,.dialog,.panel')].find(x=>{const c=getComputedStyle(x);return /мои\s+списки|хочу\s+посмотреть|продолжить\s+просмотр/i.test(x.textContent||'')&&c.display!=='none'});return open||trigger.parentElement||trigger}

function runAi(q){document.querySelector('#gkmAiFloatBtn')?.click();let n=0;const timer=setInterval(()=>{n++;const root=document.querySelector('#gkmAiDialog'),input=root?.querySelector('textarea,input[type="text"],input:not([type])');if(input){input.value=q;input.dispatchEvent(new Event('input',{bubbles:true}));[...root.querySelectorAll('button')].find(b=>/отправ|спрос|найти|➤|➜/i.test((b.textContent||'').trim()))?.click();clearInterval(timer)}if(n>25)clearInterval(timer)},120)}

function renderIntegrated(){const host=findHost();if(!host)return;let box=host.querySelector('#gkmV379Integrated');if(!box){box=document.createElement('section');box.id='gkmV379Integrated';box.className='gkm-v379-integrated';host.appendChild(box)}const all=Object.values(load()).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)),counts=Object.fromEntries(STATUSES.map(([,s])=>[s,all.filter(x=>x.status===s).length]));box.innerHTML=`<div><b>🕊 Мой Голубь</b><span style="opacity:.7;font-size:12px"> — статусы и личная библиотека</span></div><div class="gkm-v379-stats">${STATUSES.map(([i,s])=>`<div class="gkm-v379-stat">${i}<br><b>${counts[s]||0}</b><br><span style="opacity:.7">${esc(s)}</span></div>`).join('')}</div><div class="gkm-v379-tabs">${STATUSES.map(([i,s])=>`<button type="button" data-status="${esc(s)}">${i} ${esc(s)} (${counts[s]||0})</button>`).join('')}</div><div class="gkm-v380-row"><button data-ai="посоветуй фильм на вечер">🍿 На вечер</button><button data-ai="лучшие популярные фильмы">🔥 Популярное</button><button data-ai="посоветуй лучшее аниме">🎌 Аниме</button><button data-ai="посоветуй страшный фильм">😱 Страшное</button><button data-ai="умный фильм с высоким рейтингом">🧠 Умное</button></div><div class="gkm-v379-list" id="gkmV379List"></div>`;const list=box.querySelector('#gkmV379List');const show=s=>{const rows=s?all.filter(x=>x.status===s):all;list.innerHTML=rows.length?rows.slice(0,100).map(x=>`<div class="gkm-v379-row"><div><b>${esc(x.title||'Без названия')}</b><div style="opacity:.65;font-size:12px">${esc([x.year,x.type].filter(Boolean).join(' • '))}</div></div><span>${esc(x.status||'')}</span></div>`).join(''):'<div style="opacity:.65;padding:10px 0">Пока пусто.</div>'};show();box.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>show(b.dataset.status));box.querySelectorAll('[data-ai]').forEach(b=>b.onclick=()=>runAi(b.dataset.ai))}

function hook(){[...document.querySelectorAll('button,a,[role="button"]')].filter(x=>/мои\s+списки/i.test((x.textContent||'').trim())).forEach(b=>{if(b.dataset.gkmV2)return;b.dataset.gkmV2='1';b.addEventListener('click',()=>setTimeout(renderIntegrated,150))})}
function scan(){addStyle();document.querySelectorAll('.card').forEach(c=>addStatuses(c,cardItem(c)));hook();if(document.getElementById('gkmV379Integrated'))renderIntegrated()}
function init(){scan();new MutationObserver(()=>requestAnimationFrame(scan)).observe(document.body,{childList:true,subtree:true});window.GKM_MY_GOLUB={get:load,set:(i,s)=>{const d=load();d[keyOf(i)]={...i,status:s,updatedAt:Date.now()};save(d);renderIntegrated()}}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,250),{once:true});else setTimeout(init,250)
})();
