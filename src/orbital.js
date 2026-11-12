const regions = JSON.parse(document.getElementById('world-data').textContent);
const $ = id => document.getElementById(id);
let world, selected = null;
const seen = new Set();
function select(id) {
  const r = regions.find(r=>r.id===id || r.projects.some(p=>p.id===id));
  if (!r) return;
  const project = r.projects.find(p=>p.id===id);
  selected = r.id;
  $('panel').hidden = false;
  document.body.classList.add('panel-open');
  $('p-kind').textContent = r.title;
  $('p-title').textContent = project?.title || r.place;
  $('p-blurb').textContent = project?.summary || r.blurb;
  $('p-temp').textContent = r.temperature;
  $('p-climate').textContent = r.climate;
  $('panel').style.setProperty('--c', r.color);
  $('region-page').href = r.href;
  $('region-projects').replaceChildren();
  for (const p of project ? [project] : r.projects) {
    const a = document.createElement('a'); a.className='project-entry'; a.href=p.href;
    const title = document.createElement('b'); title.textContent=p.title;
    const small=document.createElement('small');small.textContent=p.validation+(p.archived?' · Archived':'');
    a.append(title,small); $('region-projects').append(a);
  }
  if (!project) for (const n of r.slots) {
    const card=document.createElement('p');card.className='uncharted';card.textContent=`Challenge ${n} · Uncharted / coming soon`;$('region-projects').append(card);
  }
  document.querySelectorAll('[data-region]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.region===r.id)));
  world?.flyTo(project ? id : 'region:'+r.id);
  seen.add(id);world?.setMarks(id,seen);
  history.replaceState(null,'','#'+r.id);
}
function overview() {
  selected=null;$('panel').hidden=true;document.body.classList.remove('panel-open');world?.flyTo(null);world?.setMarks(null,seen);
  document.querySelectorAll('[data-region]').forEach(b=>b.setAttribute('aria-pressed','false'));
  history.replaceState(null,'',location.pathname);
}
document.querySelectorAll('[data-region]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.region)));
$('overview').addEventListener('click',overview);$('close').addEventListener('click',overview);
$('regions-open').addEventListener('click',e=>{e.preventDefault();$('region-nav').querySelector('button').focus();});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') {overview();$('overview').focus();}
  if(e.target.closest('input,textarea'))return;
  if(e.key==='ArrowRight'||e.key==='ArrowLeft') {
    e.preventDefault();let i=regions.findIndex(r=>r.id===selected);i=(i+(e.key==='ArrowRight'?1:-1)+regions.length)%regions.length;select(regions[i].id);
    document.querySelector(`[data-region="${regions[i].id}"]`).scrollIntoView({block:'nearest',inline:'center'});
  }
});
try {
  const {createWorld}=await import('./world3d.js');
  const bodies=[];
  regions.forEach(r=>{
    bodies.push({id:'region:'+r.id,title:r.place,color:r.color,region:r.id,hub:true,index:r.index,island:{climate:r.environment,b:r.building},planet:{phase:r.index*.7,size:1.75,speed:.01}});
    [...r.projects,...r.slots.map(n=>({id:'uncharted:'+n,title:`Challenge ${n}`,uncharted:true}))].forEach((p,i,all)=>bodies.push({
      ...p,region:r.id,index:r.index,color:r.color,slot:i,count:all.length,island:{climate:r.environment,b:p.id==='healthcare-eks-secops'?'shield':p.id==='aws-retail-microservices-eks'?'rocket':p.id==='gcp-ai-log-analyzer'?'observatory':p.id==='github-actions-oidc-s3-pipeline'?'gear':r.building},planet:{phase:i/all.length*Math.PI*2,size:.68,speed:.035},
    }));
  });
  world=createWorld({canvas:$('stage'),labelsHost:$('plabels'),projects:bodies,onPick:id=>{if(id==='contact')location.href='mailto:zeinhaidara@gmail.com';else if(id.startsWith('region:'))select(id.slice(7));else if(!id.startsWith('uncharted:'))select(id);},onInteract:()=>document.body.classList.add('touched'),mode:'night'});
  world.flyTo('region:capital');
  document.body.classList.add('gl');$('world-status').textContent=`12 regions · ${regions.reduce((n,r)=>n+r.projects.length,0)} projects · open World overview to see every orbit`;
  if(location.hash)select(location.hash.slice(1));
  document.addEventListener('visibilitychange',()=>world.pause(document.hidden));
} catch(e) {
  console.error('3D world unavailable',e);$('world-status').textContent='3D is unavailable on this device. All regions and projects are available below.';
  document.body.classList.add('nogl');$('fallback').open=true;
}
