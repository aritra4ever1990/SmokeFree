// SmokeLess AI proxy server (v9)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8787;
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/', express.static(__dirname));

app.get('/api/health', (req,res)=> res.json({ ok:true, time:new Date().toISOString() }));

app.post('/api/coach', async (req,res)=>{
  try{
    const { message, context } = req.body || {};
    if(!message) return res.status(400).json({ error:'message required' });
    const provider=(process.env.PROVIDER||'azure').toLowerCase();
    const system='You are a compassionate, practical quit‑smoking coach. Be brief (<=120 words), supportive and specific. Offer one actionable step now (breathing, water, short walk or delay), one reframe (urge is temporary), and one small commitment. Personalize using any provided context. Avoid medical claims.';
    const msgs=[ {role:'system', content:system}, {role:'user', content: JSON.stringify({ user_message: message, context: context||{} }) } ];
    let reply='';

    if(provider==='azure'){
      const endpoint=process.env.AZURE_OPENAI_ENDPOINT, deployment=process.env.AZURE_OPENAI_DEPLOYMENT, apiVer=process.env.AZURE_OPENAI_API_VERSION||'2024-05-01-preview';
      const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVer}`;
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json','api-key':process.env.AZURE_OPENAI_KEY}, body: JSON.stringify({ messages: msgs, temperature:0.7, max_tokens:300, top_p:0.9 }) });
      if(!r.ok) throw new Error(await r.text()); const j=await r.json(); reply=j.choices?.[0]?.message?.content?.trim()||'';
    } else {
      const model=process.env.OPENAI_MODEL||'gpt-4o-mini';
      const r = await fetch('https://api.openai.com/v1/chat/completions', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`}, body: JSON.stringify({ model, messages: msgs, temperature:0.7, max_tokens:300, top_p:0.9 }) });
      if(!r.ok) throw new Error(await r.text()); const j=await r.json(); reply=j.choices?.[0]?.message?.content?.trim()||'';
    }

    if(!reply) reply='Take 10 slow breaths, then a 2‑minute walk. This urge will pass. Commit to a 5‑minute delay.';
    res.json({ reply });
  }catch(err){ console.error(err); res.status(500).json({ error:String(err) }); }
});

app.listen(PORT, ()=> console.log(`SmokeLess server running on http://localhost:${PORT}`));
