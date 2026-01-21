// SmokeLess — v3 with delay 5 min, persistent badges, hour×trigger heatmap, timer gating
(function(){
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

  const KEYS = {
    entries: 'smoke_entries_v1',
    settings: 'smoke_settings_v1',
    timer: 'smoke_timer_v1',
    badges: 'smoke_badges_v1'
  };

  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  // State
  let entries = load(KEYS.entries, []);
  let settings = load(KEYS.settings, { costPerPack: 0, cigsPerPack: 20, baseline: null, quitDate: null, plan: [], timerMinutes: 10 });
  let earnedBadges = load(KEYS.badges, []); // [{k,label,ts}]

  // Tabs
  $$('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
    $$('.tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const id = btn.dataset.tab;
    $$('.tab-panel').forEach(p=>p.classList.remove('active'));
    $('#' + id).classList.add('active');
    if(id==='history') renderHistory();
    if(id==='plan') renderPlan();
    if(id==='dashboard') renderDashboard();
  }));

  // ---- UTIL ----
  const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'});
  const fmtTime = (d) => new Date(d).toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit'});
  const todayKey = (d=new Date()) => d.toISOString().slice(0,10);
  const randId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  const groupByDay = (arr) => arr.reduce((acc,e)=>{ const k = e.ts.slice(0,10); (acc[k]=acc[k]||[]).push(e); return acc; },{});
  const dayTotals = (arr) => Object.fromEntries(Object.entries(groupByDay(arr)).map(([k,v])=>[k, v.reduce((s,e)=>s+Number(e.count||0),0)]));
  const getPlanLimit = (dateISO) => { const f=(settings.plan||[]).find(p=>p.date===dateISO); return f?Number(f.limit):null; };

  const lastNDates = (n) => { const out=[]; const now = new Date(); now.setHours(0,0,0,0); for(let i=n-1;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i); out.push(d); } return out; };

  // ---- DASHBOARD ----
  function renderDashboard(){
    const totals = dayTotals(entries);
    const tKey = todayKey();
    const todayCount = totals[tKey] || 0;
    $('#todayCount').textContent = todayCount;

    const limit = getPlanLimit(tKey);
    $('#todayLimit').textContent = limit ?? '—';
    $('#remaining').textContent = (limit!=null) ? Math.max(0, limit - todayCount) : '—';

    renderSparkline(totals);
    renderMoney();
    computeAndRenderStreaksAndBadges(totals);
    draw30DayChart(totals);
    drawTriggersHeatmapHours();
    hydrateTimer();
    renderBadgesGallery();
  }

  // 7-day trend sparkline
  function renderSparkline(totals){
    const days = []; const now = new Date();
    for(let i=6;i>=0;i--){ const d = new Date(now); d.setDate(now.getDate()-i); const k = todayKey(d); days.push({k, count: totals[k]||0, limit: getPlanLimit(k)}); }
    const max = Math.max(5, ...days.map(d=> (d.limit ?? d.count)));
    const sp = $('#sparkline'); sp.innerHTML = '';
    const tKey = todayKey();
    days.forEach(d=>{
      const h = Math.round((Math.min(Math.max(d.count, d.limit??0), max)/max)*100);
      const bar = document.createElement('div');
      bar.className = 'sparkbar' + (d.limit!=null && d.count>d.limit ? ' over':'' ) + (d.k===tKey ? ' today':'' );
      bar.style.height = Math.max(4,h) + '%';
      bar.title = `${d.k}: ${d.count}${d.limit!=null?` / limit ${d.limit}`:''}`;
      sp.appendChild(bar);
    });
    const sum7 = days.reduce((s,d)=>s+d.count,0);
    $('#weeklySummary').textContent = `${sum7} cigarettes in last 7 days` + (settings.baseline? ` (baseline: ${settings.baseline*7}/week)`:'');
  }

  // Money
  function renderMoney(){
    const {start, end} = (function(d=new Date()){ return {start:new Date(d.getFullYear(), d.getMonth(), 1), end:new Date(d.getFullYear(), d.getMonth()+1, 0)}; })();
    const monthTotal = entries.filter(e=>{ const dt=new Date(e.ts); return dt>=start && dt<=end; }).reduce((s,e)=>s+Number(e.count||0),0);
    const pricePerCig = perCigPrice();
    const spent = monthTotal * pricePerCig;
    const baselineMonth = settings.baseline ? settings.baseline * end.getDate() : null;
    const saved = baselineMonth!=null ? Math.max(0,(baselineMonth - monthTotal) * pricePerCig) : 0;
    const fmtCurrency = (n)=> new Intl.NumberFormat(undefined,{style:'currency',currencyDisplay:'symbol', currency:'INR'}).format(n||0);
    $('#moneySpent').textContent = fmtCurrency(spent);
    $('#moneySaved').textContent = fmtCurrency(saved);
  }
  function perCigPrice(){ return settings.cigsPerPack ? (Number(settings.costPerPack||0)/Number(settings.cigsPerPack||1)) : 0; }

  // Quick log & undo (gated by timer)
  $('#quickLog1').addEventListener('click', ()=> addEntry({count:1}));
  $('#undoLast').addEventListener('click', ()=> { const last = entries[entries.length-1]; if(!last) return alert('No entries to undo.'); if(confirm('Remove the last entry?')){ entries.pop(); save(KEYS.entries, entries); renderDashboard(); if($('#history').classList.contains('active')) renderHistory(); }});

  // Log form
  const logForm = $('#logForm');
  logForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    if(timer.running){ alert('Craving timer is running — logging is disabled until it ends.'); return; }
    const count = Number($('#count').value||1);
    const when = $('#when').value ? new Date($('#when').value) : new Date();
    const trigger = $('#trigger').value || '';
    const mood = $('#mood').value || '';
    const note = $('#note').value?.trim() || '';
    addEntry({count, ts: when.toISOString(), trigger, mood, note});
    logForm.reset();
  });
  $$('#log .chip').forEach(ch => ch.addEventListener('click', ()=>{ $('#trigger').value = ch.dataset.trigger; $('#count').value = 1; $('#when').value=''; $('#mood').value=''; $('#note').value=''; $('#count').focus(); }));

  function addEntry({count=1, ts=(new Date()).toISOString(), trigger='', mood='', note=''}){
    if(timer.running){ alert('Craving timer is running — logging is disabled until it ends.'); return; }
    const e = { id: randId(), ts, count:Number(count)||1, trigger, mood, note };
    entries.push(e); entries.sort((a,b)=> a.ts.localeCompare(b.ts));
    save(KEYS.entries, entries);
    renderDashboard(); if($('#history').classList.contains('active')) renderHistory();
  }

  // ---- HISTORY ----
  function renderHistory(){
    const list = $('#historyList'); list.innerHTML = '';
    const groups = Object.entries(groupByDay(entries)).sort((a,b)=> b[0].localeCompare(a[0]));
    if(groups.length===0){ list.innerHTML = '<p class="muted">No entries yet. Log your first cigarette from the Log tab or the + Log 1 button.</p>'; return; }
    for(const [day, items] of groups){
      const dayTotal = items.reduce((s,e)=>s+Number(e.count||0),0);
      const wrapper = document.createElement('div');
      const header = document.createElement('div'); header.className = 'row'; header.innerHTML = `<h3 style="margin:0">${fmtDate(day)}</h3><span class="muted">Total: ${dayTotal}</span>`; wrapper.appendChild(header);
      items.sort((a,b)=> a.ts.localeCompare(b.ts));
      items.forEach(e=>{
        const item = document.createElement('div'); item.className = 'item';
        const left = document.createElement('div'); const right = document.createElement('div'); right.className='actions';
        left.innerHTML = `
          <div><strong>${e.count}</strong> at ${fmtTime(e.ts)}</div>
          <div class="muted">${e.trigger?`Trigger: <span class="badge">${e.trigger}</span>`:''} ${e.mood?`Mood: <span class="badge">${e.mood}</span>`:''}</div>
          ${e.note?`<div class=\"muted\">“${e.note.replace(/</g,'&lt;')}”</div>`:''}
        `;
        const del = document.createElement('button'); del.className='btn danger'; del.textContent='Delete';
        del.addEventListener('click',()=>{ if(confirm('Delete this entry?')){ entries = entries.filter(x=>x.id!==e.id); save(KEYS.entries, entries); renderHistory(); renderDashboard(); }});
        right.appendChild(del);
        item.appendChild(left); item.appendChild(right); wrapper.appendChild(item);
      });
      list.appendChild(wrapper);
    }
  }

  // ---- PLAN ----
  function generatePlan(baseline, quitDate){
    const plan = []; const startDate = new Date(); startDate.setHours(0,0,0,0); let daily = Math.max(0, Math.round(baseline));
    for(let d=0; d<90; d++){
      const cur = new Date(startDate); cur.setDate(startDate.getDate()+d);
      if(d>0 && d%7===0){ daily = Math.round(daily * 0.8); }
      const iso = cur.toISOString().slice(0,10);
      if(quitDate && iso >= quitDate){ plan.push({date: iso, limit: 0}); }
      else plan.push({date: iso, limit: Math.max(0, daily)});
    }
    return plan;
  }

  function renderPlan(){
    $('#baseline').value = settings.baseline ?? '';
    $('#quitDate').value = settings.quitDate ?? '';
    $('#costPerPack').value = settings.costPerPack ?? '';
    $('#cigsPerPack').value = settings.cigsPerPack ?? '';
    $('#timerMinutes').value = settings.timerMinutes ?? 10;

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
    save(KEYS.settings, settings); renderPlan(); renderDashboard();
  });
  $('#clearPlan').addEventListener('click', ()=>{ if(confirm('Clear your plan?')){ settings.plan=[]; save(KEYS.settings, settings); renderPlan(); renderDashboard(); }});

  // ---- EXPORT / IMPORT ----
  function download(filename, text){ const blob = new Blob([text], {type:'text/plain;charset=utf-8'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
  $('#exportJson').addEventListener('click', ()=>{ const data = { entries, settings, badges: earnedBadges }; download('smokeless_export_'+todayKey()+'.json', JSON.stringify(data, null, 2)); });
  $('#exportCsv').addEventListener('click', ()=>{ const header = 'id,ts,count,trigger,mood,note\n'; const lines = entries.map(e=> [e.id, e.ts, e.count, e.trigger||'', e.mood||'', (e.note||'').replaceAll('\n',' ').replaceAll('"','""')].map(v=>`"${String(v)}"`).join(',')); download('smokeless_entries_'+todayKey()+'.csv', header + lines.join('\n')); });
  $('#importFile').addEventListener('change', async (ev)=>{
    const file = ev.target.files?.[0]; if(!file) return; const text = await file.text();
    try {
      if(file.name.endsWith('.json')){ const obj = JSON.parse(text); mergeData(obj.entries||[], obj.settings||{}, obj.badges||[]); }
      else if(file.name.endsWith('.csv')){
        const rows = text.split(/\r?\n/).filter(Boolean); const hdr = rows.shift();
        const idx = (name)=> hdr.toLowerCase().split(',').findIndex(h=>h.trim().replace(/\"/g,'')===name);
        const iId=idx('id'), iTs=idx('ts'), iCount=idx('count'), iTrigger=idx('trigger'), iMood=idx('mood'), iNote=idx('note');
        const newEntries = rows.map(r=>{ const cols = r.match(/\"(?:(?:\"\"|[^\"])*)\"/g)?.map(c=>c.slice(1,-1).replaceAll('""','"')) || r.split(','); return { id: cols[iId]||randId(), ts: cols[iTs]||new Date().toISOString(), count: Number(cols[iCount]||1), trigger: cols[iTrigger]||'', mood: cols[iMood]||'', note: cols[iNote]||'' }; });
        mergeData(newEntries, {}, []);
      } else { alert('Unsupported file type. Please select a .json or .csv file'); }
    } catch(err){ console.error(err); alert('Import failed: '+err.message); } finally { ev.target.value = ''; }
  });
  function mergeData(newEntries, newSettings, newBadges){
    const existingIds = new Set(entries.map(e=>e.id)); let added = 0; newEntries.forEach(e=>{ if(!existingIds.has(e.id)){ entries.push(e); added++; }});
    entries.sort((a,b)=> a.ts.localeCompare(b.ts));
    // merge settings (shallow)
    settings = { ...settings, ...newSettings };
    // merge badges by key
    const have = new Set(earnedBadges.map(b=>b.k));
    newBadges.forEach(b=>{ if(b && b.k && !have.has(b.k)){ earnedBadges.push(b); have.add(b.k); }});
    save(KEYS.entries, entries); save(KEYS.settings, settings); save(KEYS.badges, earnedBadges);
    alert(`Import complete. ${added} new entries merged.`);
    renderDashboard(); renderHistory(); renderPlan();
  }

  // ---- STREAKS & BADGES ----
  function computeAndRenderStreaksAndBadges(totals){
    const dates = lastNDates(120);
    let within=0, zero=0; let bestWithin=0, bestZero=0;
    for(let i=dates.length-1;i>=0;i--){
      const iso = todayKey(dates[i]); const count = totals[iso]||0; const limit = getPlanLimit(iso);
      const okWithin = (limit!=null && count<=limit);
      const okZero = (count===0);
      if(i===dates.length-1){ within = okWithin?1:0; zero = okZero?1:0; }
      else {
        if(okWithin && within === (dates.length-1-i)) within++; else if(!okWithin && within!==0) within=0;
        if(okZero && zero === (dates.length-1-i)) zero++; else if(!okZero && zero!==0) zero=0;
      }
      bestWithin = Math.max(bestWithin, within); bestZero = Math.max(bestZero, zero);
    }
    $('#streakWithin').textContent = within; $('#streakZero').textContent = zero;

    // weekly improvement
    const d14 = lastNDates(14); const last7 = d14.slice(7), prev7 = d14.slice(0,7);
    const sum = (arr)=> arr.reduce((s,d)=>{ const k=todayKey(d); return s + (totals[k]||0); },0);
    const last7sum = sum(last7), prev7sum = sum(prev7);
    let weeklyChange = '—';
    if(prev7sum>0){ const diff = last7sum - prev7sum; const pct = Math.round((diff/prev7sum)*100); weeklyChange = (pct===0? '0%': (pct>0? '+'+pct+'% ↑':'-'+Math.abs(pct)+'% ↓')) + ` (${last7sum} vs ${prev7sum})`; }
    else if(last7sum>0){ weeklyChange = `+${100}% ↑ (${last7sum} vs 0)`; }
    else { weeklyChange = '0% (no logs)'; }
    $('#weeklyChange').textContent = weeklyChange;

    // transient badges based on current state
    const badges = [];
    if(within>=1) badges.push({k:'first-within', label:'First day within limit'});
    if(within>=3) badges.push({k:'within-3', label:'3‑day within‑limit streak'});
    if(within>=7) badges.push({k:'within-7', label:'7‑day within‑limit streak'});
    if(zero>=1) badges.push({k:'zero-1', label:'First zero‑day'});
    if(zero>=3) badges.push({k:'zero-3', label:'72 hours clear'});
    if(prev7sum>0 && (prev7sum-last7sum)/prev7sum>=0.2) badges.push({k:'drop-20', label:'20% weekly drop'});

    // display transient badges
    const wrap = $('#badgesList'); wrap.innerHTML='';
    if(badges.length===0){ wrap.innerHTML = '<span class="muted">No new badges yet — you got this!</span>'; }
    else badges.forEach(b=>{ const el=document.createElement('span'); el.className='badge'; el.textContent=b.label; wrap.appendChild(el); });

    // persist newly earned badges (by key)
    const have = new Set(earnedBadges.map(b=>b.k));
    badges.forEach(b=>{ if(!have.has(b.k)){ earnedBadges.push({ ...b, ts: new Date().toISOString() }); have.add(b.k); }});
    save(KEYS.badges, earnedBadges);
  }

  function renderBadgesGallery(){
    const g = $('#badgesGallery'); g.innerHTML='';
    if(!earnedBadges || earnedBadges.length===0){ g.innerHTML = '<span class="muted">No badges earned yet.</span>'; return; }
    earnedBadges.sort((a,b)=> (a.ts||'').localeCompare(b.ts||''));
    earnedBadges.forEach(b=>{ const el=document.createElement('span'); el.className='badge'; el.title = b.ts ? new Date(b.ts).toLocaleString() : ''; el.textContent = b.label; g.appendChild(el); });
  }

  // ---- CHARTS (Canvas) ----
  function setCanvasSize(canvas){ const dpr = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect(); if(rect.width===0){ canvas.width = canvas.width; return canvas.getContext('2d'); } canvas.width = Math.max(320, Math.floor(rect.width*dpr)); canvas.height = Math.floor((rect.height||260)*dpr); const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr); return ctx; }

  function draw30DayChart(totals){
    const canvas = $('#chart30'); if(!canvas) return; const ctx = setCanvasSize(canvas);
    const dates = lastNDates(30);
    const data = dates.map(d=> ({k: todayKey(d), v: totals[todayKey(d)]||0, limit: getPlanLimit(todayKey(d))}));
    const maxV = Math.max(5, ...data.map(x=> Math.max(x.v, x.limit??0)));
    const W = canvas.clientWidth || 640, H = 260; const pl=36, pr=10, pt=10, pb=26; const iw=W-pl-pr, ih=H-pt-pb;
    ctx.clearRect(0,0,W,H); ctx.fillStyle = '#0b1324'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = '#22304f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl, pt); ctx.lineTo(pl, pt+ih); ctx.lineTo(pl+iw, pt+ih); ctx.stroke();
    ctx.font = '12px system-ui'; ctx.fillStyle = '#94a3b8'; ctx.textAlign='right';
    const steps = 4; for(let i=0;i<=steps;i++){ const y = pt + ih - (ih*i/steps); const val = Math.round(maxV*i/steps); ctx.strokeStyle='#1f2a44'; ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(pl+iw, y); ctx.stroke(); ctx.fillText(String(val), pl-6, y+4); }
    ctx.textAlign='center'; const stepX = Math.max(1, Math.floor(dates.length/6)); for(let i=0;i<dates.length;i+=stepX){ const x = pl + (iw*i/(dates.length-1)); const lab = (dates[i].getMonth()+1)+'/'+dates[i].getDate(); ctx.fillText(lab, x, pt+ih+18); }
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.beginPath(); data.forEach((p,i)=>{ const x = pl + (iw*i/(data.length-1)); const y = pt + ih - (p.v/maxV)*ih; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();
    ctx.strokeStyle = '#64748b'; ctx.setLineDash([4,4]); ctx.beginPath(); data.forEach((p,i)=>{ const x = pl + (iw*i/(data.length-1)); const lim = (p.limit!=null?p.limit:NaN); const y = isNaN(lim)?NaN: pt + ih - (lim/maxV)*ih; if(i===0) ctx.moveTo(x,y||0); else if(!isNaN(y)) ctx.lineTo(x,y); }); ctx.stroke(); ctx.setLineDash([]);
  }

  function drawTriggersHeatmapHours(){
    const canvas = $('#heatmap'); if(!canvas) return; const ctx = setCanvasSize(canvas);
    const triggers = ['Stress','After meal','Coffee/Tea','Alcohol','Social','Boredom','Commute','Other',''];
    const dates = lastNDates(30); const startMs = dates[0].getTime();
    // counts by trigger x hour(0..23)
    const counts = {}; triggers.forEach(t=> counts[t]=Array(24).fill(0));
    entries.forEach(e=>{ const dt = new Date(e.ts); if(dt.getTime()>=startMs){ const hour = dt.getHours(); const trig = e.trigger||''; const t = triggers.includes(trig)?trig:''; counts[t][hour] += Number(e.count||0); } });

    const W = canvas.clientWidth || 640, H = 340; ctx.clearRect(0,0,W,H); ctx.fillStyle='#0b1324'; ctx.fillRect(0,0,W,H);
    const pl=90, pt=18, pr=10, pb=28; const cols=24, rows=triggers.length; const cw=(W-pl-pr)/cols, rh=(H-pt-pb)/rows;
    ctx.font='12px system-ui'; ctx.fillStyle='#94a3b8'; ctx.textAlign='center';
    for(let i=0;i<cols;i++){ const x = pl + i*cw + cw/2; ctx.fillText(String(i), x, H-8); }
    ctx.textAlign='right'; triggers.forEach((t,i)=> ctx.fillText(t||'Other/None', pl-8, pt + i*rh + rh/2 + 4));

    const maxVal = Math.max(1, ...Object.values(counts).flat());
    function cellColor(v){ const a = v/maxVal; const r = Math.round(34 + a*80), g = Math.round(197 - a*60), b = Math.round(94 - a*10); return `rgba(${r}, ${g}, ${b}, 1)`; }

    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const t = triggers[r]; const v = counts[t][c]; ctx.fillStyle = cellColor(v);
        const x = pl + c*cw + 2, y = pt + r*rh + 2; ctx.fillRect(x, y, Math.max(0,cw-4), Math.max(0,rh-4));
      }
    }
  }

  // ---- CRAVING TIMER ----
  let timer = load(KEYS.timer, { remainingMs: (settings.timerMinutes||10)*60*1000, running: false, lastTick: null });
  let timerInterval = null;
  const tips = [
    'Take 10 slow breaths — in through the nose, out through the mouth.',
    'Sip cold water and let the craving pass.',
    'Walk for 2 minutes; movement changes the urge.',
    'Delay by 5 minutes and re‑check the craving.',
    'Text a friend or note why you want to quit.',
    'Do a quick stretch: neck, shoulders, wrists.',
    'Chew sugar‑free gum or have a healthy snack.',
  ];
  function formatMMSS(ms){ const s=Math.max(0,Math.floor(ms/1000)); const m=String(Math.floor(s/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); return `${m}:${ss}`; }
  function updateTimerUI(){ $('#timerDisplay').textContent = formatMMSS(timer.remainingMs); setLoggingGatedState(); }
  function showRandomTip(){ $('#timerTip').textContent = 'Tip: ' + tips[Math.floor(Math.random()*tips.length)]; }
  function setLoggingGatedState(){
    const gating = !!timer.running;
    $('#quickLog1').disabled = gating;
    $('#logSaveBtn').disabled = gating;
    $('#loggingDisabledMsg').style.display = gating? 'block':'none';
  }
  function tick(){
    if(!timer.running) return; const now = Date.now(); const last = timer.lastTick || now; const diff = now - last; timer.remainingMs = Math.max(0, timer.remainingMs - diff); timer.lastTick = now; updateTimerUI();
    if(timer.remainingMs===0){ clearInterval(timerInterval); timerInterval=null; timer.running=false; showRandomTip(); onTimerCompleted(); }
    save(KEYS.timer, timer);
  }
  function startTimer(){ if(timer.running) return; if(timer.remainingMs<=0) timer.remainingMs = (settings.timerMinutes||10)*60*1000; timer.running=true; timer.lastTick=Date.now(); if(!timerInterval) timerInterval=setInterval(tick, 500); save(KEYS.timer, timer); showRandomTip(); updateTimerUI(); }
  function pauseTimer(){ timer.running=false; save(KEYS.timer, timer); if(timerInterval){ clearInterval(timerInterval); timerInterval=null; } updateTimerUI(); }
  function resetTimer(){ timer.running=false; timer.remainingMs=(settings.timerMinutes||10)*60*1000; timer.lastTick=null; updateTimerUI(); save(KEYS.timer, timer); if(timerInterval){ clearInterval(timerInterval); timerInterval=null; } }
  function delay5(){ if(timer.running){ timer.remainingMs += 5*60*1000; } else { timer.remainingMs = 5*60*1000; timer.running=true; timer.lastTick=Date.now(); if(!timerInterval) timerInterval=setInterval(tick, 500); }
    save(KEYS.timer, timer); showRandomTip(); updateTimerUI(); }
  function hydrateTimer(){ // reset base if plan updated
    if(!timer.running && (!timer.remainingMs || timer.remainingMs<=0)) timer.remainingMs=(settings.timerMinutes||10)*60*1000;
    updateTimerUI(); if(timer.running){ if(!timerInterval){ timer.lastTick=Date.now(); timerInterval=setInterval(tick, 500); } }
  }
  function onTimerCompleted(){
    // award badge for completing a timer
    awardBadgeOnce('crave-done', 'Craving timer completed');
    const price = perCigPrice();
    const fmtCurrency = (n)=> new Intl.NumberFormat(undefined,{style:'currency',currencyDisplay:'symbol', currency:'INR'}).format(n||0);
    alert(`Craving timer done! You just saved the price of 1 cigarette: ${fmtCurrency(price)}.`);
    save(KEYS.badges, earnedBadges);
    renderBadgesGallery(); renderDashboard();
  }
  function awardBadgeOnce(k, label){ const have = new Set(earnedBadges.map(b=>b.k)); if(!have.has(k)){ earnedBadges.push({k,label,ts:new Date().toISOString()}); save(KEYS.badges, earnedBadges); } }

  $('#timerStart').addEventListener('click', startTimer);
  $('#timerPause').addEventListener('click', pauseTimer);
  $('#timerReset').addEventListener('click', resetTimer);
  $('#timerDelay5').addEventListener('click', delay5);

  // ---- PWA ----
  if('serviceWorker' in navigator){ window.addEventListener('load', ()=> navigator.serviceWorker.register('service-worker.js').catch(()=>{})); }

  // Initial render
  renderDashboard();
})();
