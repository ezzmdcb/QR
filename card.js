const $=id=>document.getElementById(id),cfg=window.QRLINK_CONFIG||{};
// Same URL normalization as app.js — strips an accidentally-pasted
// /rest/v1, /storage/v1, etc. suffix down to the bare Project URL.
function normalizeSupabaseUrl(u){
  u=String(u||'').trim();
  if(!u)return '';
  if(!/^https?:\/\//i.test(u))u='https://'+u;
  try{
    const parsed=new URL(u);
    return parsed.origin;
  }catch{return ''}
}
const supabaseUrl=normalizeSupabaseUrl(cfg.SUPABASE_URL);
const configured=Boolean(supabaseUrl&&cfg.SUPABASE_ANON_KEY);
const libLoaded=Boolean(window.supabase);
const remote=configured&&libLoaded;
const db=remote?window.supabase.createClient(supabaseUrl,cfg.SUPABASE_ANON_KEY):null;
const id=new URLSearchParams(location.search).get('id');

function initials(n){return String(n||'QR').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
function showError(m){$('error').textContent=m;$('error').classList.remove('hidden');$('publicCard').classList.add('hidden')}
function escapeHtml(v){const d=document.createElement('div');d.textContent=v;return d.innerHTML}

async function load(){
  if(!id)throw Error('This profile link is missing its ID.');
  if(!remote)throw Error(libLoaded?'This site is not connected to Supabase yet.':'Could not load the Supabase library. Check your internet connection.');
  const {data,error}=await db.from('cards').select('*').eq('id',id).single();
  if(error||!data)throw Error('Profile not found.');
  return data;
}

function addLink(label,url){
  if(!url)return;
  const a=document.createElement('a');
  a.href=url;
  a.target='_blank';
  a.rel='noopener noreferrer';
  a.innerHTML=`<span>${escapeHtml(label)}</span><b>↗</b>`;
  $('links').append(a);
}

function vcard(c){
  let s=['BEGIN:VCARD','VERSION:3.0',`FN:${c.name||''}`];
  if(c.phone)s.push(`TEL:${c.phone}`);
  if(c.email)s.push(`EMAIL:${c.email}`);
  s.push('END:VCARD');
  const blob=new Blob([s.join('\r\n')],{type:'text/vcard'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`${c.name||'contact'}.vcf`;
  a.click();
  URL.revokeObjectURL(a.href);
}

(async()=>{
  try{
    const c=await load();
    document.title=`${c.name} — QRLink`;
    $('name').textContent=c.name;
    $('bio').textContent=c.bio||'';
    $('avatar').textContent=initials(c.name);
    const photo=c.photo_url||c.photo_data;
    if(photo){$('avatar').style.backgroundImage=`url("${photo}")`;$('avatar').textContent=''}
    if(c.email||c.phone){$('contact').textContent=[c.email,c.phone].filter(Boolean).join(' · ')}
    let links=Array.isArray(c.links)?c.links:[];
    if(!links.length){
      links=[['Instagram',c.instagram],['WhatsApp',c.whatsapp?`https://wa.me/${String(c.whatsapp).replace(/\D/g,'')}`:''],['LinkedIn',c.linkedin],['Website',c.website],[c.custom_label,c.custom_url]].map(x=>({label:x[0],url:x[1]}));
    }
    links.forEach(x=>addLink(x.label,x.url));
    new QRCode($('qr'),{text:location.href,width:230,height:230,colorDark:'#0b1020',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H});
    $('shareBtn').onclick=async()=>{
      try{
        if(navigator.share)await navigator.share({title:`${c.name} — QRLink`,url:location.href});
        else{await navigator.clipboard.writeText(location.href);$('shareBtn').textContent='Link copied ✓'}
      }catch{}
    };
    $('contactBtn').onclick=()=>vcard(c);
  }catch(e){
    showError(e.message);
  }
})();
