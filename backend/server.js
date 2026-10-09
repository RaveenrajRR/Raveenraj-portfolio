import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, 'data.json');
const MESSAGES = path.join(__dirname, 'messages.json');
const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors({ origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : ['http://localhost:5173'] }));
app.use(express.json({ limit: '1mb' }));
async function readData(){ return JSON.parse(await fs.readFile(DATA,'utf8')); }
async function writeData(data){ await fs.writeFile(DATA, JSON.stringify(data,null,2)); }
const id = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
app.get('/api/health', (_req,res)=>res.json({ok:true,service:'Raveenraj Portfolio API'}));
app.get('/api/portfolio', async (_req,res)=>{ try{res.json(await readData())}catch{res.status(500).json({error:'Unable to read portfolio data'})} });
app.get('/api/skills', async (req,res)=>{ try{let items=(await readData()).skills; const cat=String(req.query.category||'All'); const q=String(req.query.q||'').toLowerCase(); if(cat!=='All') items=items.filter(x=>x.category===cat); if(q) items=items.filter(x=>`${x.name} ${x.category} ${x.description}`.toLowerCase().includes(q)); res.json(items)}catch{res.status(500).json({error:'Unable to read skills'})} });
app.get('/api/projects', async (req,res)=>{ try{let items=(await readData()).projects; for(const [key,field] of [['type','type'],['level','level'],['scope','scope']]) if(req.query[key] && req.query[key]!=='All') items=items.filter(x=>x[field]===req.query[key]); const q=String(req.query.q||'').toLowerCase(); if(q) items=items.filter(x=>`${x.name} ${x.description} ${x.stack.join(' ')}`.toLowerCase().includes(q)); res.json(items)}catch{res.status(500).json({error:'Unable to read projects'})} });
app.post('/api/contact', async (req,res)=>{ const {name,email,message}=req.body||{}; if(!name?.trim()||!email?.trim()||!message?.trim()) return res.status(400).json({error:'Name, email and message are required.'}); if(!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({error:'Please enter a valid email.'}); try{let all=[]; try{all=JSON.parse(await fs.readFile(MESSAGES,'utf8'))}catch{} all.push({id:id(),name:name.trim().slice(0,100),email:email.trim().slice(0,200),message:message.trim().slice(0,3000),createdAt:new Date().toISOString()}); await fs.writeFile(MESSAGES,JSON.stringify(all,null,2)); res.status(201).json({ok:true,message:'Message saved. Thanks for reaching out!'})}catch{res.status(500).json({error:'Could not save message.'})} });
// Local starter admin endpoints. Add auth before deploying publicly.
app.put('/api/admin/profile', async(req,res)=>{try{const d=await readData(); d.profile={...d.profile,...req.body}; await writeData(d); res.json(d.profile)}catch{res.status(500).json({error:'Could not update profile'})}});
app.post('/api/admin/skills', async(req,res)=>{try{const d=await readData(); const item={id:id(),...req.body}; if(!item.name||!item.category) return res.status(400).json({error:'Skill name and category required'}); d.skills.push(item); await writeData(d); res.status(201).json(item)}catch{res.status(500).json({error:'Could not add skill'})}});
app.put('/api/admin/skills/:id', async(req,res)=>{try{const d=await readData(); const i=d.skills.findIndex(x=>x.id===req.params.id); if(i<0)return res.status(404).json({error:'Skill not found'}); d.skills[i]={...d.skills[i],...req.body,id:d.skills[i].id}; await writeData(d); res.json(d.skills[i])}catch{res.status(500).json({error:'Could not update skill'})}});
app.delete('/api/admin/skills/:id', async(req,res)=>{try{const d=await readData(); d.skills=d.skills.filter(x=>x.id!==req.params.id); await writeData(d); res.json({ok:true})}catch{res.status(500).json({error:'Could not delete skill'})}});
app.post('/api/admin/projects', async(req,res)=>{try{const d=await readData(); const item={id:id(),stack:[],...req.body}; if(!item.name) return res.status(400).json({error:'Project name required'}); d.projects.push(item); await writeData(d); res.status(201).json(item)}catch{res.status(500).json({error:'Could not add project'})}});
app.put('/api/admin/projects/:id', async(req,res)=>{try{const d=await readData(); const i=d.projects.findIndex(x=>x.id===req.params.id); if(i<0)return res.status(404).json({error:'Project not found'}); d.projects[i]={...d.projects[i],...req.body,id:d.projects[i].id}; await writeData(d); res.json(d.projects[i])}catch{res.status(500).json({error:'Could not update project'})}});
app.delete('/api/admin/projects/:id', async(req,res)=>{try{const d=await readData(); d.projects=d.projects.filter(x=>x.id!==req.params.id); await writeData(d); res.json({ok:true})}catch{res.status(500).json({error:'Could not delete project'})}});
app.listen(PORT,()=>console.log(`Portfolio API running at http://localhost:${PORT}`));
