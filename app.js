const $=id=>document.getElementById(id);
const cfg=window.QRLINK_CONFIG||{};
// Guards against the common mistake of pasting the REST/Auth/Storage endpoint
// line instead of the bare Project URL (e.g. ".../rest/v1" or ".../storage/v1"),
// which otherwise causes "Invalid path specified in request URL" on every request.
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
const supabaseReady=configured&&libLoaded;
const db=supabaseReady?window.supabase.createClient(supabaseUrl,cfg.SUPABASE_ANON_KEY):null;
const form=$('cardForm'), notice=$('notice'), result=$('result'), linksList=$('linksList');
let photoData=''; let links=[];

if(supabaseReady){
  $('modeBadge').textContent='Supabase connected';
  $('modeBadge').classList.add('connected');
}else{
  $('modeBadge').textContent='Supabase not connected';
  $('modeBadge').classList.add('error');
  $('createBtn').disabled=true;
  if(!libLoaded){
    show('Could not load the Supabase library. Check your internet connection and reload the page.','error');
  }else{
    show('Add your Supabase project URL and anon key to config.js, then reload this page.','error');
  }
}

const linkPresets=[['Instagram','https://instagram.com/'],['TikTok','https://tiktok.com/@'],['LinkedIn','https://linkedin.com/in/'],['X / Twitter','https://x.com/'],['Facebook','https://facebook.com/'],['GitHub','https://github.com/'],['YouTube','https://youtube.com/'],['Website','https://']];

function uid(){return crypto.randomUUID?crypto.randomUUID().replaceAll('-',''):Date.now().toString(36)+Math.random().toString(36).slice(2);}
function initials(n){return String(n||'QR').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'QR';}
function show(msg,type=''){notice.textContent=msg;notice.className=`notice ${type}`;notice.classList.remove('hidden');}
function hide(){notice.classList.add('hidden');}
function safeUrl(v){v=String(v||'').trim();if(!v)return '';try{let u=new URL(/^https?:\/\//i.test(v)?v:'https://'+v);if(!['http:','https:'].includes(u.protocol))return '';return u.href}catch{return ''}}
function addLink(label='',url=''){links.push({id:uid(),label,url});renderLinkRows();}
function renderLinkRows(){
  linksList.innerHTML='';
  links.forEach((l,i)=>{
    const row=document.createElement('div');
    row.className='link-row';
    row.innerHTML=`<div class="link-index">${String(i+1).padStart(2,'0')}</div><div class="link-fields"><input class="link-label" maxlength="40" placeholder="Link name" value="${escapeAttr(l.label)}"><input class="link-url" maxlength="500" placeholder="https://example.com/your-profile" value="${escapeAttr(l.url)}"></div><button type="button" class="remove-link" aria-label="Remove link">×</button>`;
    row.querySelector('.link-label').oninput=e=>{l.label=e.target.value;renderPreview()};
    row.querySelector('.link-url').oninput=e=>{l.url=e.target.value;renderPreview()};
    row.querySelector('.remove-link').onclick=()=>{links=links.filter(x=>x.id!==l.id);renderLinkRows();renderPreview()};
    linksList.append(row);
  });
  $('linkCount').textContent=`${links.length} link${links.length===1?'':'s'}`;
  renderPreview();
}
function escapeAttr(v){return String(v||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;')}
function escapeHtml(v){const d=document.createElement('div');d.textContent=v;return d.innerHTML}
function renderPreview(){
  const name=$('name').value.trim(),bio=$('bio').value.trim();
  $('previewName').textContent=name||'Your Name';
  $('previewBio').textContent=bio||'Your short bio appears here';
  $('previewAvatar').textContent=photoData?'':initials(name);
  $('previewAvatar').style.backgroundImage=photoData?`url("${photoData}")`:'';
  const email=$('email').value.trim(),phone=$('phone').value.trim();
  $('previewContact').textContent=email||phone?[email,phone].filter(Boolean).join(' · '):'';
  const box=$('previewLinks');
  box.innerHTML='';
  const valid=links.filter(x=>x.label.trim()&&safeUrl(x.url));
  if(!valid.length){box.innerHTML='<div class="empty-links">Your links will appear here</div>';return}
  valid.forEach(x=>{
    const a=document.createElement('a');
    a.href=safeUrl(x.url);
    a.target='_blank';
    a.rel='noopener noreferrer';
    a.innerHTML=`<span>${escapeHtml(x.label)}</span><b>↗</b>`;
    box.append(a);
  });
}

$('addLink').onclick=()=>addLink();
['name','bio','email','phone'].forEach(id=>$(id).addEventListener('input',renderPreview));
$('photo').onchange=e=>{
  const f=e.target.files?.[0];
  if(!f)return;
  if(f.size>5*1024*1024){show('Photo must be 5 MB or smaller.','error');e.target.value='';return}
  const r=new FileReader();
  r.onload=()=>{photoData=r.result;renderPreview()};
  r.readAsDataURL(f);
};
$('resetBtn').onclick=()=>{
  form.reset();
  photoData='';
  links=[];
  addLink('Instagram','');
  addLink('WhatsApp','');
  renderLinkRows();
  result.classList.add('hidden');
  hide();
};

async function saveRemote(data){
  let photo_url='';
  const file=$('photo').files?.[0];
  if(file){
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
    const path=`${uid()}.${ext}`;
    const {error}=await db.storage.from('profile-photos').upload(path,file,{contentType:file.type,upsert:false});
    if(error)throw new Error('Photo upload failed: '+error.message);
    photo_url=db.storage.from('profile-photos').getPublicUrl(path).data.publicUrl;
  }
  const {data:row,error}=await db.from('cards').insert({...data,photo_url}).select('id').single();
  if(error)throw new Error(error.message);
  return {...data,id:row.id,photo_url};
}

function publicUrl(id){return `${location.origin}${location.pathname.replace(/\/[^/]*$/,'/')}card.html?id=${encodeURIComponent(id)}`.replace(/\s/g,'')}
// Renders into a container element (this library appends its own canvas inside it)
// and returns that canvas, or null on the rare browser with no canvas support.
function generateQr(container,url){
  container.innerHTML='';
  new QRCode(container,{text:url,width:220,height:220,colorDark:'#0b1020',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H});
  return container.querySelector('canvas');
}

form.onsubmit=async e=>{
  e.preventDefault();
  hide();
  result.classList.add('hidden');
  if(!supabaseReady)return show('Supabase is not connected. Add your credentials to config.js and reload the page.','error');
  const name=$('name').value.trim(),email=$('email').value.trim();
  if(!name)return show('Please enter a display name.','error');
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return show('Please enter a valid email address.','error');
  const cleanLinks=links.map(x=>({label:x.label.trim(),url:safeUrl(x.url)})).filter(x=>x.label||x.url);
  if(cleanLinks.some(x=>!x.label||!x.url))return show('Every link needs both a name and a valid URL.','error');
  const data={name,bio:$('bio').value.trim(),email,phone:$('phone').value.trim(),links:cleanLinks};
  $('createBtn').disabled=true;
  $('createBtn').innerHTML='Creating your QR…';
  try{
    const saved=await saveRemote(data);
    const url=publicUrl(saved.id);
    const qrContainer=document.createElement('div');
    const qrCanvas=generateQr(qrContainer,url);
    const card=$('previewCard');
    card.querySelector('.qr-area').innerHTML='';
    const box=document.createElement('div');
    box.className='qr-generated';
    box.append(qrContainer);
    const small=document.createElement('small');
    small.textContent='Unique QR code';
    box.append(small);
    card.querySelector('.qr-area').append(box);
    const downloadBtn=qrCanvas?'<button class="button secondary" id="download">Download QR</button>':'';
    result.innerHTML=`<div class="result-title">Your card is ready</div><div class="result-url">${escapeHtml(url)}</div><div class="result-buttons"><button class="button primary" id="copy">Copy link</button><a class="button secondary" href="${url}" target="_blank">Open card</a>${downloadBtn}</div>`;
    result.classList.remove('hidden');
    $('copy').onclick=async()=>{await navigator.clipboard.writeText(url);$('copy').textContent='Copied ✓'};
    if(qrCanvas){
      $('download').onclick=()=>{const a=document.createElement('a');a.href=qrCanvas.toDataURL('image/png');a.download=`qrlink-${saved.id}.png`;a.click()};
    }
    show('Unique QR created successfully.','success');
  }catch(err){
    show(err.message||'Could not create the card.','error');
  }finally{
    $('createBtn').disabled=!supabaseReady;
    $('createBtn').innerHTML='Generate unique QR <span>→</span>';
  }
};

addLink('Instagram','');
addLink('WhatsApp','');
renderLinkRows();
