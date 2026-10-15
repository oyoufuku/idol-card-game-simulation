import {useEffect,useState} from 'react';
import {SHARED_RULES} from '../data/shared-rules';
import {DetailSheet} from './DetailSheet';
export function SharedRulebook({onOpenChange}:{onOpenChange?:(open:boolean)=>void}){
 const [open,setOpen]=useState(false),[search,setSearch]=useState('');
 useEffect(()=>{onOpenChange?.(open);},[open,onOpenChange]);
 useEffect(()=>{const show=(event:Event)=>{setSearch(String((event as CustomEvent).detail||''));setOpen(true);};window.addEventListener('open-shared-rulebook',show);return()=>window.removeEventListener('open-shared-rulebook',show);},[]);
 const query=search.trim().toLowerCase(),rules=SHARED_RULES.filter(r=>[r.code,r.title,r.summary,r.detail].join(' ').toLowerCase().includes(query));
 return <><button className="rulebook-button" onClick={()=>{setSearch('');setOpen(true);}}>共通ルール</button>{open&&<DetailSheet title="共通ルールブック" onClose={()=>setOpen(false)}><label>用語・ルールを検索<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label>{rules.map(r=><section className="shared-rule" key={r.code}><h3>{r.code} · {r.title}</h3><p><strong>{r.summary}</strong></p><p>{r.detail}</p></section>)}{!rules.length&&<p>該当するルールはありません。</p>}</DetailSheet>}</>;
}
