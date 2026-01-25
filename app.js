// SmokeLess — v7: button fix (drag), savings goal progress, stability improvements
(function(){
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

  const KEYS = {
    entries: 'smoke_entries_v1',
    settings: 'smoke_settings_v1',
    timer: 'smoke_timer_v1',
    badges: 'smoke_badges_v1',
    theme: 'smoke_theme_v1'
  };

  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const DEFAULT_TRIGGERS = ['Stress','After meal','Coffee/Tea','Alcohol','Social','Boredom','Commute','Other'];
  const BADGE_META = {
    'crave-done': { category: 'timer' },
    'first-within': { category: 'streaks' },
    'within-3': { category: 'streaks' },
    'within-7': { category: 'streaks' },
    'zero-1': { category: 'streaks' },
    'zero-3': { category: 'streaks' },
    'drop-20': { category: 'streaks' }
  };
  const SAVINGS_THRESHOLDS = [100, 250, 500, 1000, 2000, 5000, 10000];

  // State
  let entries = load(KEYS.entries, []);
  let settings = load(KEYS.settings, {
    costPerPack: 0, cigsPerPack: 20, baseline: null, quitDate: null, plan: [], timerMinutes: 10,
    triggers: DEFAULT_TRIGGERS.slice(), badgeFilter:'all', cardOrder: [], cravingSavingsTotal: 0,
    savingsGoalAmount: 0, savingsGoalBasis: 'total'
  });
  if(!Array.isArray(settings.triggers) || settings.triggers.length===0) settings.triggers = DEFAULT_TRIGGERS.slice();
  if(!Array.isArray(settings.cardOrder)) settings.cardOrder = [];
  if(typeof settings.cravingSavingsTotal !== 'number') settings.cravingSavingsTotal = 0;
  if(typeof settings.savingsGoalAmount !== 'number') settings.savingsGoalAmount = 0;
  if(!settings.savingsGoalBasis) settings.savingsGoalBasis = 'total';

  let earnedBadges = load(KEYS.badges, []);
  earnedBadges.forEach(b=>{ if(!b.category && BADGE_META[b.k]) b.category = BADGE_META[b.k].category; });
  save(KEYS.badges, earnedBadges);

  // THEME
  const themeSelect = $('#themeSwitch');
  function applyTheme(mode){ themeSelect.value = mode; const root = document.documentElement; if(mode==='light'){ root.setAttribute('data-theme','light'); } else if(mode==='dark'){ root.setAttribute('data-theme','dark'); } else { root.removeAttribute('data-theme'); } save(KEYS.theme, mode); }
  (function initTheme(){ const mode = load(KEYS.theme, 'system'); applyTheme(mode); })();
  themeSelect.addEventListener('change', ()=> applyTheme(themeSelect.value));

  // TABS (default LOG)
  $$('.tab-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  function switchTab(id){
    $$('.tab-btn').forEach(b=>{ const active = (b.dataset.tab===id); b.classList.toggle('active', active); b.setAttribute('aria-selected', active? 'true':'false'); });
    $$('.tab-panel').forEach(p=> p.classList.toggle('active', p.id===id));
    if(id==='history') renderHistory();
    if(id==='plan') renderPlan();
    if(id==='dashboard') renderDashboard();
    if(id==='log') renderLogTriggers();
  }

  // UTIL
  const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'});
  const fmtTime = (d) => new Date(d).toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit'});
  const todayKey = (d=new Date()) => d.toISOString().slice(0,10);
  const randId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  const groupByDay = (arr) => arr.reduce((acc,e)=>{ const k = e.ts.slice(0,10); (acc[k]=acc[k]||[]).push(e); return acc; },{});
  const dayTotals = (arr) => Object.fromEntries(Object.entries(groupByDay(arr)).map(([k,v])=>[k, v.filter(x=>x.type!=='craving').reduce((s,e)=>s+Number(e.count||0),0)]));
  const getPlanLimit = (dateISO) => { const f=(settings.plan||[]).find(p=>p.date===dateISO); return f?Number(f.limit):null; };
  const perCigPrice = ()=> settings.cigsPerPack ? (Number(settings.costPerPack||0)/Number(settings.cigsPerPack||1)) : 0;
  const lastNDates = (n) => { const out=[]; const now = new Date(); now.setHours(0,0,0,0); for(let i=n-1;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i); out.push(d); } return out; };

  // NOTIFICATIONS
  async function notify(title, body){ try{ if(!('Notification' in window)) return; if(Notification.permission==='granted'){ new Notification(title,{ body }); if('vibrate' in navigator) navigator.vibrate([80,40,80]); } else if(Notification.permission!=='denied'){ const perm = await Notification.requestPermission(); if(perm==='granted'){ new Notification(title,{ body }); if('vibrate' in navigator) navigator.vibrate([80,40,80]); } } } catch{} }

  // TOASTS
  function showToast(msg){ const c = $('#toastContainer'); if(!c) return; const el = document.createElement('div'); el.className='toast'; el.setAttribute('role','status'); el.textContent = msg; c.appendChild(el); setTimeout(()=>{ el.style.opacity=0; el.style.transform='translateY(8px)'; setTimeout(()=> el.remove(), 300); }, 4200); }

  // DASHBOARD
  function renderDashboard(){
    applyCardOrder();
    const totals = dayTotals(entries); const tKey = todayKey(); const todayCount = totals[tKey] || 0; $('#todayCount').textContent = todayCount; const limit = getPlanLimit(tKey); $('#todayLimit').textContent = limit ?? '—'; $('#remaining').textContent = (limit!=null) ? Math.max(0, limit - todayCount) : '—';
    renderSparkline(totals); renderMoney(); computeAndRenderStreaksAndBadges(totals); draw30DayChart(totals); drawTriggersHeatmapHours(); hydrateTimer(); renderBadgesGallery(); initDragDrop();
  }

  function renderSparkline(totals){ const days = []; const now = new Date(); for(let i=6;i>=0;i--){ const d = new Date(now); d.setDate(now.getDate()-i); const k = todayKey(d); days.push({k, count: totals[k]||0, limit: getPlanLimit(k)}); } const max = Math.max(5, ...days.map(d=> (d.limit ?? d.count))); const sp = $('#sparkline'); sp.innerHTML=''; const tKey = todayKey(); days.forEach(d=>{ const h = Math.round((Math.min(Math.max(d.count, d.limit??0), max)/max)*100); const bar = document.createElement('div'); bar.className = 'sparkbar' + (d.limit!=null && d.count>d.limit ? ' over':'' ) + (d.k===tKey ? ' today':'' ); bar.style.height = Math.max(4,h) + '%'; bar.title = `${d.k}: ${d.count}${d.limit!=null?` / limit ${d.limit}`:''}`; sp.appendChild(bar); }); const sum7 = days.reduce((s,d)=>s+d.count,0); $('#weeklySummary').textContent = `${sum7} cigarettes in last 7 days` + (settings.baseline? ` (baseline: ${settings.baseline*7}/week)`:''); }

  function renderMoney(){
    const {start, end} = (function(d=new Date()){ return {start:new Date(d.getFullYear(), d.getMonth(), 1), end:new Date(d.getFullYear(), d.getMonth()+1, 0)}; })();
    const monthTotal = entries.filter(e=>{ const dt=new Date(e.ts); return e.type!=='craving' && dt>=start && dt<=end; }).reduce((s,e)=>s+Number(e.count||0),0);
    const pricePerCig = perCigPrice();
    const spent = monthTotal * pricePerCig;
    const baselineMonth = settings.baseline ? settings.baseline * end.getDate() : null;
    const saved = baselineMonth!=null ? Math.max(0,(baselineMonth - monthTotal) * pricePerCig) : 0;
    const timerCompletions = entries.filter(e=> e.type==='craving' && e.action==='complete' && (new Date(e.ts))>=start && (new Date(e.ts))<=end).length;
    const savedCraving = timerCompletions * pricePerCig;

    const fmt = (n)=> new Intl.NumberFormat(undefined,{style:'currency',currencyDisplay:'symbol', currency:'INR'}).format(n||0);
    $('#moneySpent').textContent = fmt(spent);
    $('#moneySaved').textContent = fmt(saved);
    $('#moneyCravingSaved').textContent = fmt(savedCraving);
    $('#moneyCravingSavedTotal').textContent = fmt(settings.cravingSavingsTotal||0);

    // Savings Goal progress
    const goal = Number(settings.savingsGoalAmount||0);
    const basis = settings.savingsGoalBasis || 'total';
    const current = basis==='month' ? savedCraving : (settings.cravingSavingsTotal||0);
    const pct = goal>0 ? Math.min(100, Math.round((current/goal)*100)) : 0;
    const bar = $('#savingsProgressBar'); if(bar){ bar.style.width = pct+'%'; }
    $('#savingsGoalText').textContent = goal>0 ? fmt(goal) + (basis==='month'?' (this month)':' (total)') : '—';
    $('#savingsProgressPct').textContent = pct+'%';
  }

  // Quick log & undo (gated by timer)
  $('#quickLog1').addEventListener('click', ()=> addEntry({count:1}));
  $('#undoLast').addEventListener('click', ()=> { const last = entries[entries.length-1]; if(!last) return alert('No entries to undo.'); if(confirm('Remove the last entry?')){ entries.pop(); save(KEYS.entries, entries); renderDashboard(); if($('#history').classList.contains('active')) renderHistory(); }});

  // LOG form
  const logForm = $('#logForm');
  logForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    if(timer.running){ alert('Craving timer is running — logging is disabled until it ends.'); return; }
    const count = Number($('#count').value||1);
    const when = $('#when').value ? new Date($('#when').value) : new Date();
    const trigger = $('#triggerSelect').value || '';
    const mood = $('#mood').value || '';
    const note = $('#note').value?.trim() || '';
    addEntry({count, ts: when.toISOString(), trigger, mood, note});
    logForm.reset(); renderLogTriggers();
  });

  function addEntry({count=1, ts=(new Date()).toISOString(), trigger='', mood='', note=''}){
    if(timer.running){ alert('Craving timer is running — logging is disabled until it ends.'); return; }
    const e = { type:'smoke', id: randId(), ts, count:Number(count)||1, trigger, mood, note };
    entries.push(e); entries.sort((a,b)=> a.ts.localeCompare(b.ts));
    save(KEYS.entries, entries);
    renderDashboard(); if($('#history').classList.contains('active')) renderHistory();
  }

  // HISTORY
  function renderHistory(){
    const list = $('#historyList'); list.innerHTML = '';
    const groups = Object.entries(groupByDay(entries)).sort((a,b)=> b[0].localeCompare(a[0]));
    if(groups.length===0){ list.innerHTML = '<p class="muted">No entries yet. Log your first cigarette from the Log tab or the + Log 1 button.</p>'; return; }

    for(const [day, items] of groups){
      const dayTotal = items.filter(x=>x.type!=='craving').reduce((s,e)=>s+Number(e.count||0),0);
      const wrapper = document.createElement('div');
      const header = document.createElement('div'); header.className = 'row'; header.innerHTML = `<h3 style="margin:0">${fmtDate(day)}</h3><span class="muted">Total: ${dayTotal}</span>`; wrapper.appendChild(header);

      items.sort((a,b)=> a.ts.localeCompare(b.ts));
      items.forEach(e=>{
        const item = document.createElement('div'); item.className = 'item';
        const left = document.createElement('div'); const right = document.createElement('div'); right.className='actions';
        if(e.type==='craving'){
          const label = e.action==='start'?'Started': e.action==='pause'?'Paused': e.action==='reset'?'Reset': e.action==='delay'?`Delay +${e.deltaMin||5}m`: e.action==='milestone'?`Milestone — ${e.label||''}`: e.action==='complete'?'Completed':'Craving';
          const extra = e.intensity? ` • Intensity: ${e.intensity}`:'';
          const note = e.note? ` • “${String(e.note).replace(/</g,'&lt;')}`+'”':'';
          const saved = (e.saved!=null)? ` • Saved: ₹${Number(e.saved).toFixed(2)}`:'';
          left.innerHTML = `<div><strong>Craving</strong> — ${label}${extra}${saved} at ${fmtTime(e.ts)}</div><div class="muted">${note}</div>`;
        } else {
          left.innerHTML = `
            <div><strong>${e.count}</strong> at ${fmtTime(e.ts)}</div>
            <div class="muted">${e.trigger?`Trigger: <span class=\"badge\">${e.trigger}</span>`:''} ${e.mood?`Mood: <span class=\"badge\">${e.mood}</span>`:''}</div>
            ${e.note?`<div class=\"muted\">“${e.note.replace(/</g,'&lt;')}”</div>`:''}
          `;
        }
        const del = document.createElement('button'); del.className='btn danger'; del.textContent='Delete';
        del.addEventListener('click',()=>{ if(confirm('Delete this item?')){ entries = entries.filter(x=>x.id!==e.id); save(KEYS.entries, entries); renderHistory(); renderDashboard(); }});
        right.appendChild(del);
        item.appendChild(left); item.appendChild(right); wrapper.appendChild(item);
      });

      list.appendChild(wrapper);
    }
  }

  // TRIGGERS
  function renderLogTriggers(){
    const sel = $('#triggerSelect'); sel.innerHTML='';
    const optEmpty = document.createElement('option'); optEmpty.value=''; optEmpty.textContent='— choose —'; sel.appendChild(optEmpty);
    settings.triggers.forEach(t=>{ const o=document.createElement('option'); o.value=t; o.textContent=t; sel.appendChild(o); });
    const chips = $('#chipsRow'); chips.innerHTML='';
    settings.triggers.forEach(t=>{ const b=document.createElement('button'); b.type='button'; b.className='chip'; b.textContent=t; b.addEventListener('click', ()=>{ if(timer.running){ showToast('Timer running — logging disabled.'); return; } $('#triggerSelect').value=t; $('#count').value=1; $('#when').value=''; $('#mood').value=''; $('#note').value=''; $('#count').focus(); }); chips.appendChild(b); });
    setLoggingGatedState();
  }

  function renderPlanTriggers(){
    const sel = $('#planTriggersSelect'); sel.innerHTML='';
    settings.triggers.forEach(t=>{ const o=document.createElement('option'); o.value=t; o.textContent=t; sel.appendChild(o); });
    const wrap = $('#planTriggersEditor'); wrap.innerHTML='';
    settings.triggers.forEach((t,idx)=>{
      const row = document.createElement('div'); row.className='row'; row.style.justifyContent='space-between'; row.style.margin='6px 0';
      const label = document.createElement('div'); label.textContent = t;
      const actions = document.createElement('div'); actions.className='row';
      const up = document.createElement('button'); up.className='btn'; up.textContent='↑'; up.title='Move up'; up.addEventListener('click',()=>{ if(idx>0){ const tmp=settings.triggers[idx-1]; settings.triggers[idx-1]=settings.triggers[idx]; settings.triggers[idx]=tmp; save(KEYS.settings, settings); renderPlanTriggers(); renderLogTriggers(); }});
      const down = document.createElement('button'); down.className='btn'; down.textContent='↓'; down.title='Move down'; down.addEventListener('click',()=>{ if(idx<settings.triggers.length-1){ const tmp=settings.triggers[idx+1]; settings.triggers[idx+1]=settings.triggers[idx]; settings.triggers[idx]=tmp; save(KEYS.settings, settings); renderPlanTriggers(); renderLogTriggers(); }});
      const del = document.createElement('button'); del.className='btn danger'; del.textContent='Delete'; del.addEventListener('click',()=>{ if(confirm(`Delete trigger \"${t}\"?`)){ settings.triggers.splice(idx,1); save(KEYS.settings, settings); renderPlanTriggers(); renderLogTriggers(); }});
      actions.appendChild(up); actions.appendChild(down); actions.appendChild(del);
      row.appendChild(label); row.appendChild(actions); wrap.appendChild(row);
    });
    $('#planAddTriggerBtn').onclick = ()=>{ const val = ($('#planNewTrigger').value||'').trim(); if(!val) return; if(settings.triggers.includes(val)){ showToast('Trigger already exists.'); return; } settings.triggers.push(val); save(KEYS.settings, settings); $('#planNewTrigger').value=''; renderPlanTriggers(); renderLogTriggers(); };
  }

  // PLAN
  function generatePlan(baseline, quitDate){ const plan = []; const startDate = new Date(); startDate.setHours(0,0,0,0); let daily = Math.max(0, Math.round(baseline)); for(let d=0; d<90; d++){ const cur = new Date(startDate); cur.setDate(startDate.getDate()+d); if(d>0 && d%7===0){ daily = Math.round(daily * 0.8); } const iso = cur.toISOString().slice(0,10); if(quitDate && iso >= quitDate){ plan.push({date: iso, limit: 0}); } else plan.push({date: iso, limit: Math.max(0, daily)}); } return plan; }

  function renderPlan(){
    $('#baseline').value = settings.baseline ?? '';
    $('#quitDate').value = settings.quitDate ?? '';
    $('#costPerPack').value = settings.costPerPack ?? '';
    $('#cigsPerPack').value = settings.cigsPerPack ?? '';
    $('#timerMinutes').value = settings.timerMinutes ?? 10;
    $('#savingsGoalAmount').value = settings.savingsGoalAmount ?? '';
    $('#savingsGoalBasis').value = settings.savingsGoalBasis || 'total';
    renderPlanTriggers();

    const grid = $('#planGrid'); grid.innerHTML = '';
    if(!settings.plan || settings.plan.length===0){ grid.innerHTML = '<p class="muted">No plan yet. Enter baseline and optional quit date, then click Generate.</p>'; return; }
    const todayISO = todayKey();
    settings.plan.forEach(p=>{
      const card = document.createElement('div'); card.className='plan-day'+(p.date===todayISO?' today':'');
      const h = document.createElement('h4'); h.textContent = new Date(p.date).toLocaleDateString(undefined,{month:'short', day:'numeric', weekday:'short'});
      const input = document.createElement('input'); input.type='number'; input.min='0'; input.value = p.limit;
      input.addEventListener('change', ()=>{ p.limit = Number(input.value||0); save(KEYS.settings, settings); if($('#dashboard').classList.contains('active')) renderDashboard(); });
      card.appendChild(h); card.appendChild(input); grid.appendChild(card);
    });
  }

  $('#generatePlan').addEventListener('click', ()=>{
    const baseline = Number($('#baseline').value||settings.baseline||0);
    const qd = $('#quitDate').value || settings.quitDate || null;
    settings.baseline = baseline>0?baseline:null; settings.quitDate = qd;
    settings.costPerPack = Number($('#costPerPack').value||settings.costPerPack||0);
    settings.cigsPerPack = Number($('#cigsPerPack').value||settings.cigsPerPack||20);
    settings.timerMinutes = Math.max(1, Number($('#timerMinutes').value||settings.timerMinutes||10));
    if(baseline>0){ settings.plan = generatePlan(baseline, qd); }
    save(KEYS.settings, settings); renderPlan(); renderDashboard(); renderLogTriggers();
  });
  $('#clearPlan').addEventListener('click', ()=>{ if(confirm('Clear your plan?')){ settings.plan=[]; save(KEYS.settings, settings); renderPlan(); renderDashboard(); }});

  // Savings Goal actions
  $('#saveSavingsGoal').addEventListener('click', ()=>{ settings.savingsGoalAmount = Math.max(0, Number($('#savingsGoalAmount').value||0)); settings.savingsGoalBasis = $('#savingsGoalBasis').value||'total'; save(KEYS.settings, settings); showToast('Savings goal saved.'); renderDashboard(); });
  $('#clearSavingsGoal').addEventListener('click', ()=>{ settings.savingsGoalAmount = 0; save(KEYS.settings, settings); showToast('Savings goal cleared.'); renderDashboard(); });

  // EXPORT / IMPORT
  function download(filename, text){ const blob = new Blob([text], {type:'text/plain;charset=utf-8'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
  $('#exportJson').addEventListener('click', ()=>{ const data = { entries, settings, badges: earnedBadges }; download('smokeless_export_'+todayKey()+'.json', JSON.stringify(data, null, 2)); });
  $('#exportCsv').addEventListener('click', ()=>{ const header = 'type,id,ts,count,trigger,mood,action,note\n'; const lines = entries.map(e=>{ const type = e.type||'smoke'; const id = e.id; const ts = e.ts; const count = e.count??0; const trigger = e.trigger||''; const mood = e.mood||''; const action = e.action||''; const note = (e.note||'').replaceAll('\n',' ').replaceAll('"','""'); return [type,id,ts,count,trigger,mood,action,note].map(v=>`"${String(v)}"`).join(','); }); download('smokeless_entries_'+todayKey()+'.csv', header + lines.join('\n')); });
  $('#importFile').addEventListener('change', async (ev)=>{ const file = ev.target.files?.[0]; if(!file) return; const text = await file.text(); try { if(file.name.endsWith('.json')){ const obj = JSON.parse(text); mergeData(obj.entries||[], obj.settings||{}, obj.badges||[]); } else if(file.name.endsWith('.csv')){ const rows = text.split(/\r?\n/).filter(Boolean); const hdr = rows.shift(); const cols = hdr.toLowerCase().split(',').map(h=>h.trim().replace(/\"/g,'')); const idx = (name)=> cols.findIndex(h=>h===name); const iType = idx('type'); const iId=idx('id'); const iTs=idx('ts'); const iCount=idx('count'); const iTrigger=idx('trigger'); const iMood=idx('mood'); const iAction=idx('action'); const iNote=idx('note'); const newEntries = rows.map(r=>{ const cols = r.match(/\"(?:(?:\"\"|[^\"])*)\"/g)?.map(c=>c.slice(1,-1).replaceAll('""','"')) || r.split(','); const type = iType>=0? cols[iType] : 'smoke'; return { type, id: cols[iId]||randId(), ts: cols[iTs]||new Date().toISOString(), count: Number(cols[iCount]|| (type==='smoke'?1:0)), trigger: cols[iTrigger]||'', mood: cols[iMood]||'', action: cols[iAction]||'', note: cols[iNote]||'' }; }); mergeData(newEntries, {}, []); } else { alert('Unsupported file type. Please select a .json or .csv file'); } } catch(err){ console.error(err); alert('Import failed: '+err.message); } finally { ev.target.value = ''; } });

  function mergeData(newEntries, newSettings, newBadges){ const existingIds = new Set(entries.map(e=>e.id)); let added = 0; newEntries.forEach(e=>{ if(!existingIds.has(e.id)){ entries.push(e); added++; }}); entries.sort((a,b)=> a.ts.localeCompare(b.ts)); settings = { ...settings, ...newSettings }; if(!Array.isArray(settings.triggers) || settings.triggers.length===0) settings.triggers = DEFAULT_TRIGGERS.slice(); const have = new Set(earnedBadges.map(b=>b.k)); newBadges.forEach(b=>{ if(b && b.k && !have.has(b.k)){ if(!b.category && BADGE_META[b.k]) b.category = BADGE_META[b.k].category; earnedBadges.push(b); have.add(b.k); }}); save(KEYS.entries, entries); save(KEYS.settings, settings); save(KEYS.badges, earnedBadges); alert(`Import complete. ${added} new entries merged.`); renderDashboard(); renderHistory(); renderPlan(); renderLogTriggers(); }

  // STREAKS & BADGES
  function computeAndRenderStreaksAndBadges(totals){ const dates = lastNDates(120); let within=0, zero=0; for(let i=dates.length-1;i>=0;i--){ const iso = todayKey(dates[i]); const count = totals[iso]||0; const limit = getPlanLimit(iso); const okWithin = (limit!=null && count<=limit); const okZero = (count===0); if(i===dates.length-1){ within = okWithin?1:0; zero = okZero?1:0; } else { if(okWithin && within === (dates.length-1-i)) within++; else if(!okWithin && within!==0) within=0; if(okZero && zero === (dates.length-1-i)) zero++; else if(!okZero && zero!==0) zero=0; } }
    $('#streakWithin').textContent = within; $('#streakZero').textContent = zero;
    const d14 = lastNDates(14); const last7 = d14.slice(7), prev7 = d14.slice(0,7);
    const sum = (arr)=> arr.reduce((s,d)=>{ const k=todayKey(d); return s + (totals[k]||0); },0);
    const last7sum = sum(last7), prev7sum = sum(prev7);
    let weeklyChange = '—';
    if(prev7sum>0){ const diff = last7sum - prev7sum; const pct = Math.round((diff/prev7sum)*100); weeklyChange = (pct===0? '0%': (pct>0? '+'+pct+'% ↑':'-'+Math.abs(pct)+'% ↓')) + ` (${last7sum} vs ${prev7sum})`; }
    else if(last7sum>0){ weeklyChange = `+${100}% ↑ (${last7sum} vs 0)`; }
    else { weeklyChange = '0% (no logs)'; }
    $('#weeklyChange').textContent = weeklyChange;

    const badges = [];
    const pushBadge=(k,label)=> badges.push({k,label,category:(BADGE_META[k]?.category)||'streaks'});
    if(within>=1) pushBadge('first-within','First day within limit');
    if(within>=3) pushBadge('within-3','3‑day within‑limit streak');
    if(within>=7) pushBadge('within-7','7‑day within‑limit streak');
    if(zero>=1) pushBadge('zero-1','First zero‑day');
    if(zero>=3) pushBadge('zero-3','72 hours clear');
    if(prev7sum>0 && (prev7sum-last7sum)/prev7sum>=0.2) pushBadge('drop-20','20% weekly drop');

    const wrap = $('#badgesList'); wrap.innerHTML='';
    if(badges.length===0){ wrap.innerHTML = '<span class="muted">No new badges yet — you got this!</span>'; }
    else badges.forEach(b=>{ const el=document.createElement('span'); el.className='badge'; el.textContent=b.label; wrap.appendChild(el); });

    const have = new Set(earnedBadges.map(b=>b.k));
    badges.forEach(b=>{ if(!have.has(b.k)){ earnedBadges.push({ ...b, ts: new Date().toISOString() }); have.add(b.k); }});
    save(KEYS.badges, earnedBadges);
  }

  // Savings badges
  function checkSavingsBadges(){ const total = settings.cravingSavingsTotal||0; SAVINGS_THRESHOLDS.forEach(th =>{ const key='save-'+th; const have = earnedBadges.find(b=>b.k===key); if(!have && total>=th){ earnedBadges.push({k:key, label:`Saved ₹${th}+`, category:'savings', ts:new Date().toISOString()}); } }); save(KEYS.badges, earnedBadges); }

  // Badges Gallery
  function renderBadgesGallery(){ const filter = settings.badgeFilter || 'all'; $$('#badgesFilter .chip').forEach(ch=> ch.classList.toggle('active', ch.dataset.cat===filter)); const g = $('#badgesGallery'); g.innerHTML=''; if(!earnedBadges || earnedBadges.length===0){ g.innerHTML = '<span class="muted">No badges earned yet.</span>'; return; } const list = earnedBadges.filter(b=> filter==='all' ? true : (b.category||'streaks')===filter); list.sort((a,b)=> (a.ts||'').localeCompare(b.ts||'')); list.forEach(b=>{ const el=document.createElement('span'); el.className='badge'; el.title = `${b.category||''} • ${b.ts? new Date(b.ts).toLocaleString():''}`; el.textContent = b.label; g.appendChild(el); }); }
  $('#badgesFilter')?.addEventListener('click', (e)=>{ const btn = e.target.closest('.chip'); if(!btn) return; settings.badgeFilter = btn.dataset.cat; save(KEYS.settings, settings); renderBadgesGallery(); });

  // CHARTS
  function setCanvasSize(canvas){ const dpr = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect(); if(rect.width===0){ canvas.width = canvas.width; return canvas.getContext('2d'); } canvas.width = Math.max(320, Math.floor(rect.width*dpr)); canvas.height = Math.floor((rect.height||260)*dpr); const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr); return ctx; }
  function draw30DayChart(totals){ const canvas = $('#chart30'); if(!canvas) return; const ctx = setCanvasSize(canvas); const dates = lastNDates(30); const data = dates.map(d=> ({k: todayKey(d), v: totals[todayKey(d)]||0, limit: getPlanLimit(todayKey(d))})); const maxV = Math.max(5, ...data.map(x=> Math.max(x.v, x.limit??0))); const W = canvas.clientWidth || 640, H = 260; const pl=36, pr=10, pt=10, pb=26; const iw=W-pl-pr, ih=H-pt-pb; ctx.clearRect(0,0,W,H); ctx.fillStyle = '#0b1324'; ctx.fillRect(0,0,W,H); ctx.strokeStyle = '#22304f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl, pt); ctx.lineTo(pl, pt+ih); ctx.lineTo(pl+iw, pt+ih); ctx.stroke(); ctx.font = '12px system-ui'; ctx.fillStyle = '#94a3b8'; ctx.textAlign='right'; const steps = 4; for(let i=0;i<=steps;i++){ const y = pt + ih - (ih*i/steps); const val = Math.round(maxV*i/steps); ctx.strokeStyle='#1f2a44'; ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(pl+iw, y); ctx.stroke(); ctx.fillText(String(val), pl-6, y+4); } ctx.textAlign='center'; const stepX = Math.max(1, Math.floor(dates.length/6)); for(let i=0;i<dates.length;i+=stepX){ const x = pl + (iw*i/(dates.length-1)); const lab = (dates[i].getMonth()+1)+'/'+dates[i].getDate(); ctx.fillText(lab, x, pt+ih+18); } ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.beginPath(); data.forEach((p,i)=>{ const x = pl + (iw*i/(data.length-1)); const y = pt + ih - (p.v/maxV)*ih; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke(); ctx.strokeStyle = '#64748b'; ctx.setLineDash([4,4]); ctx.beginPath(); data.forEach((p,i)=>{ const x = pl + (iw*i/(data.length-1)); const lim = (p.limit!=null?p.limit:NaN); const y = isNaN(lim)?NaN: pt + ih - (lim/maxV)*ih; if(i===0) ctx.moveTo(x,y||0); else if(!isNaN(y)) ctx.lineTo(x,y); }); ctx.stroke(); ctx.setLineDash([]); }
  function drawTriggersHeatmapHours(){ const canvas = $('#heatmap'); if(!canvas) return; const ctx = setCanvasSize(canvas); const triggers = settings.triggers.concat(['']); const dates = lastNDates(30); const startMs = dates[0].getTime(); const counts = {}; triggers.forEach(t=> counts[t]=Array(24).fill(0)); entries.forEach(e=>{ const dt = new Date(e.ts); if(dt.getTime()>=startMs){ const hour = dt.getHours(); const trig = (e.type==='smoke'? (e.trigger||'') : ''); const t = triggers.includes(trig)?trig:''; counts[t][hour] += Number(e.count||0); } }); const W = canvas.clientWidth || 640, H = 340; ctx.clearRect(0,0,W,H); ctx.fillStyle='#0b1324'; ctx.fillRect(0,0,W,H); const pl=90, pt=18, pr=10, pb=28; const cols=24, rows=triggers.length; const cw=(W-pl-pr)/cols, rh=(H-pt-pb)/rows; ctx.font='12px system-ui'; ctx.fillStyle='#94a3b8'; ctx.textAlign='center'; for(let i=0;i<cols;i++){ const x = pl + i*cw + cw/2; ctx.fillText(String(i), x, H-8); } ctx.textAlign='right'; triggers.forEach((t,i)=> ctx.fillText(t||'Other/None', pl-8, pt + i*rh + rh/2 + 4)); const maxVal = Math.max(1, ...Object.values(counts).flat()); function cellColor(v){ const a = v/maxVal; const r = Math.round(34 + a*80), g = Math.round(197 - a*60), b = Math.round(94 - a*10); return `rgba(${r}, ${g}, ${b}, 1)`; } for(let r=0;r<rows;r++){ for(let c=0;c<cols;c++){ const t = triggers[r]; const v = counts[t][c]; ctx.fillStyle = cellColor(v); const x = pl + c*cw + 2, y = pt + r*rh + 2; ctx.fillRect(x, y, Math.max(0,cw-4), Math.max(0,rh-4)); } } }

  // CRAVING TIMER
  let timer = load(KEYS.timer, { remainingMs: (settings.timerMinutes||10)*60*1000, running: false, lastTick: null, milestones:{} }); if(!timer.milestones) timer.milestones = {};
  let timerInterval = null;
  const tips = ['Take 10 slow breaths — in through the nose, out through the mouth.','Sip cold water and let the craving pass.','Walk for 2 minutes; movement changes the urge.','Delay by 5 minutes and re‑check the craving.','Text a friend or note why you want to quit.','Do a quick stretch: neck, shoulders, wrists.','Chew sugar‑free gum or have a healthy snack.'];
  function formatMMSS(ms){ const s=Math.max(0,Math.floor(ms/1000)); const m=String(Math.floor(s/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); return `${m}:${ss}`; }
  function updateTimerUI(){ $('#timerDisplay').textContent = formatMMSS(timer.remainingMs); setLoggingGatedState(); }
  function showRandomTip(){ $('#timerTip').textContent = 'Tip: ' + tips[Math.floor(Math.random()*tips.length)]; }
  function setLoggingGatedState(){ const gating = !!timer.running; $('#quickLog1').disabled = gating; $('#logSaveBtn').disabled = gating; $$('#chipsRow .chip').forEach(ch => ch.disabled = gating); $('#loggingDisabledMsg').style.display = gating? 'block':'none'; }

  function maybeToastMilestones(){ const ms5 = 5*60*1000, ms2 = 2*60*1000; if(timer.running){ if(timer.remainingMs <= ms5 && !timer.milestones['m5']){ showToast('5:00 left — walk for 2 minutes?'); notify('5:00 left','Walk for 2 minutes?'); timer.milestones['m5']=true; logCravingEvent('milestone',{label:'5:00 left'}); } if(timer.remainingMs <= ms2 && !timer.milestones['m2']){ showToast('2:00 left — sip some water.'); notify('2:00 left','Sip some water.'); timer.milestones['m2']=true; logCravingEvent('milestone',{label:'2:00 left'}); } } }

  function tick(){ if(!timer.running) return; const now = Date.now(); const last = timer.lastTick || now; const diff = now - last; timer.remainingMs = Math.max(0, timer.remainingMs - diff); timer.lastTick = now; maybeToastMilestones(); updateTimerUI(); if(timer.remainingMs===0){ clearInterval(timerInterval); timerInterval=null; timer.running=false; showRandomTip(); onTimerCompleted(); } save(KEYS.timer, timer); }

  function getCravingStartMeta(){ const intensity = Number($('#cravingIntensity')?.value||3); const note = ($('#cravingNote')?.value||'').trim(); return {intensity, note}; }

  function startTimer(){ if(timer.running) return; if(timer.remainingMs<=0) timer.remainingMs = (settings.timerMinutes||10)*60*1000; timer.running=true; timer.lastTick=Date.now(); timer.milestones={}; if(!timerInterval) timerInterval=setInterval(tick, 500); save(KEYS.timer, timer); showRandomTip(); updateTimerUI(); showToast('Craving timer started — you got this.'); notify('Craving timer','Started — you got this.'); const meta=getCravingStartMeta(); logCravingEvent('start', {durationMin: Math.round(timer.remainingMs/60000), intensity: meta.intensity, note: meta.note}); }
  function pauseTimer(){ if(!timer.running) return; timer.running=false; save(KEYS.timer, timer); if(timerInterval){ clearInterval(timerInterval); timerInterval=null; } updateTimerUI(); logCravingEvent('pause', {remaining: formatMMSS(timer.remainingMs)}); }
  function resetTimer(){ const wasRunning = timer.running; timer.running=false; timer.remainingMs=(settings.timerMinutes||10)*60*1000; timer.lastTick=null; timer.milestones={}; updateTimerUI(); save(KEYS.timer, timer); if(timerInterval){ clearInterval(timerInterval); timerInterval=null; } logCravingEvent('reset', {wasRunning}); }
  function delay5(){ if(timer.running){ timer.remainingMs += 5*60*1000; logCravingEvent('delay',{deltaMin:5}); } else { timer.remainingMs = 5*60*1000; timer.running=true; timer.lastTick=Date.now(); timer.milestones={}; if(!timerInterval) timerInterval=setInterval(tick, 500); const meta=getCravingStartMeta(); logCravingEvent('start', {durationMin:5, intensity: meta.intensity, note: meta.note}); } save(KEYS.timer, timer); showRandomTip(); updateTimerUI(); showToast('Delay added: +5:00'); }
  function hydrateTimer(){ if(!timer.running && (!timer.remainingMs || timer.remainingMs<=0)) timer.remainingMs=(settings.timerMinutes||10)*60*1000; updateTimerUI(); if(timer.running){ if(!timerInterval){ timer.lastTick=Date.now(); timerInterval=setInterval(tick, 500); } } }

  function onTimerCompleted(){
    awardBadgeOnce('crave-done', 'Craving timer completed', 'timer');
    const price = perCigPrice(); settings.cravingSavingsTotal = (settings.cravingSavingsTotal||0) + price; save(KEYS.settings, settings);
    checkSavingsBadges();
    const fmt = (n)=> new Intl.NumberFormat(undefined,{style:'currency',currencyDisplay:'symbol', currency:'INR'}).format(n||0);
    showToast(`Timer done! Saved ≈ ${fmt(price)}. Total: ${fmt(settings.cravingSavingsTotal)}.`);
    notify('Craving complete', `Saved ≈ ${fmt(price)}. Total savings: ${fmt(settings.cravingSavingsTotal)}.`);
    logCravingEvent('complete', {saved: price});
    save(KEYS.badges, earnedBadges); renderBadgesGallery(); renderDashboard();
  }

  function logCravingEvent(action, data={}){ const e = { type:'craving', id: randId(), ts: new Date().toISOString(), action, ...data }; entries.push(e); entries.sort((a,b)=> a.ts.localeCompare(b.ts)); save(KEYS.entries, entries); if($('#history').classList.contains('active')) renderHistory(); }
  function awardBadgeOnce(k, label, category){ const have = new Set(earnedBadges.map(b=>b.k)); const cat = category || (BADGE_META[k]?.category)||'timer'; if(!have.has(k)){ earnedBadges.push({k,label,category:cat,ts:new Date().toISOString()}); save(KEYS.badges, earnedBadges); } }

  $('#timerStart').addEventListener('click', startTimer);
  $('#timerPause').addEventListener('click', pauseTimer);
  $('#timerReset').addEventListener('click', resetTimer);
  $('#timerDelay5').addEventListener('click', delay5);

  // DRAG & DROP CARDS (with button safety)
  function initDragDrop(){
    const container = $('#cardsContainer');
    const cards = $$('#cardsContainer .card[draggable="true"]');

    // Prevent drag from starting on interactive elements inside cards
    cards.forEach(card=>{
      card.querySelectorAll('button, input, select, textarea, a, canvas, [data-nodrag]').forEach(el=>{
        el.setAttribute('draggable','false');
        el.addEventListener('dragstart', (e)=>{ e.stopPropagation(); e.preventDefault(); }, {capture:true});
      });
    });

    cards.forEach(card=>{
      card.addEventListener('dragstart', dragStart);
      card.addEventListener('dragover', dragOver);
      card.addEventListener('drop', dropped);
      card.addEventListener('dragend', dragEnd);
    });

    function dragStart(e){ e.dataTransfer.setData('text/plain', e.currentTarget.dataset.card); e.currentTarget.classList.add('dragging'); }
    function dragOver(e){ e.preventDefault(); const dragging = $('.dragging'); if(!dragging) return; const after = getDragAfterElement(container, e.clientY); if(after==null) container.appendChild(dragging); else container.insertBefore(dragging, after); }
    function dropped(e){ e.preventDefault(); const dragging = $('.dragging'); if(dragging) dragging.classList.remove('dragging'); saveCardOrder(); }
    function dragEnd(){ const dragging = $('.dragging'); if(dragging) dragging.classList.remove('dragging'); saveCardOrder(); }
    function getDragAfterElement(container, y){ const els = [...container.querySelectorAll('.card[draggable="true"]:not(.dragging)')]; return els.reduce((closest, child)=>{ const box = child.getBoundingClientRect(); const offset = y - box.top - box.height/2; if(offset<0 && offset>closest.offset){ return { offset, element: child }; } else { return closest; } }, { offset: Number.NEGATIVE_INFINITY }).element; }
  }
  function saveCardOrder(){ const order = $$('#cardsContainer .card[draggable="true"]').map(c=> c.dataset.card); settings.cardOrder = order; save(KEYS.settings, settings); }
  function applyCardOrder(){ const order = settings.cardOrder||[]; const container = $('#cardsContainer'); const map = {}; $$('#cardsContainer .card[draggable="true"]').forEach(c=> map[c.dataset.card]=c); if(order.length){ order.forEach(key=>{ if(map[key]) container.appendChild(map[key]); }); Object.keys(map).forEach(k=>{ if(!order.includes(k)) container.appendChild(map[k]); }); }
  }

  // PWA
  if('serviceWorker' in navigator){ window.addEventListener('load', ()=> navigator.serviceWorker.register('service-worker.js').catch(()=>{})); }

  // Initial renders
  renderLogTriggers();
  renderDashboard();
})();
