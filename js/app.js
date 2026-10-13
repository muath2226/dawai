// ===== دوائي — منطق التطبيق =====
const $ = s => document.querySelector(s);
let stream = null;
let deferredPrompt = null;

// Splash
setTimeout(()=> $('#splash').classList.add('hide'), 1400);

// تنقل
function go(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  $('#page-'+page).classList.add('active');
  document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active', b.dataset.go===page));
  window.scrollTo({top:0, behavior:'smooth'});
  if(page!=='scan') stopCam();
}
document.querySelectorAll('.bottom-nav button').forEach(b=> b.onclick = ()=> go(b.dataset.go));
window.go = go;

// Toast
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), 2500);
}

// بطاقة دواء — تعرض: التجاري + المادة + النوع + 3 فوائد + 3 موانع
function drugCard(d, badge){
  return `<div class="drug-card">
    ${badge?`<span class="match-badge">✅ ${badge}</span>`:''}
    <div class="drug-top">
      <div class="drug-ico">${d.icon}</div>
      <div><b>${d.trade}</b><small>المادة الفعالة: ${d.sci}</small></div>
    </div>
    <span class="type-tag">🏷️ ${d.type}</span>
    <div class="drug-sec benefit"><h4>✨ الفائدة</h4><ul>${d.benefits.slice(0,3).map(x=>`<li>• ${x}</li>`).join('')}</ul></div>
    <div class="drug-sec danger"><h4>⛔ موانع الاستخدام</h4><ul>${d.cons.slice(0,3).map(x=>`<li>• ${x}</li>`).join('')}</ul></div>
    <div class="card-actions">
      <button class="btn-primary" onclick="quickAdd('${d.trade.replace(/'/g,"")}')">➕ أضف لجدولي</button>
      <button class="btn-ghost" onclick="go('my')">🗓️ جدولي</button>
    </div>
    <small style="display:block;margin-top:8px;color:#999">⚠️ معلومات استرشادية — استشر الصيدلي أو الطبيب</small>
  </div>`;
}

// الرئيسية: تصنيفات + chips + cards
const CATS = {
  all:  ()=>true,
  heart:   d=>[4,8,11,13,14,15,16,17,18,19,20,21,22].includes(d.id),
  sugar:   d=>[5,23,24,25,26,27,28].includes(d.id),
  bones:   d=>[2,10,29,30,31,32,33,34].includes(d.id),
  stomach: d=>[3,6,35,36,37,38,39,40,41].includes(d.id),
  kidney:  d=>[16,42,43,44,45].includes(d.id),
  liver:   d=>[46,47,48].includes(d.id)
};
let curCat = 'all';
function renderHome(cat){
  if(cat) curCat = cat;
  const list = DRUGS.filter(CATS[curCat]);
  document.querySelectorAll('#catRow .cat').forEach(b=>b.classList.toggle('active', b.dataset.cat===curCat));
  $('#drugCount').textContent = `(${list.length} دواء)`;
  $('#homeChips').innerHTML = list.map(d=>`<button class="chip" onclick="showDrug(${d.id})">${d.icon} ${d.trade}</button>`).join('');
  $('#homeCards').innerHTML = list.slice(0,3).map(d=>drugCard(d)).join('');
}
document.querySelectorAll('#catRow .cat').forEach(b=> b.onclick = ()=>{ renderHome(b.dataset.cat); });
function showDrug(id){
  const d = DRUGS.find(x=>x.id===id);
  $('#homeCards').innerHTML = drugCard(d);
  window.scrollTo({top:200,behavior:'smooth'});
}

// البحث
function renderSearch(q=''){
  q = q.trim();
  const res = !q ? DRUGS : DRUGS.filter(d =>
    d.trade.includes(q) || d.sci.includes(q) || d.type.includes(q) ||
    d.keys.some(k=> k.toLowerCase().includes(q.toLowerCase()) || q.toLowerCase().includes(k.toLowerCase()))
  );
  $('#searchResults').innerHTML = res.length
    ? res.map(d=>drugCard(d)).join('')
    : `<div class="no-match">😕 لم نجد "<b>${q}</b>" في القاعدة التجريبية<br><small>جرّب: بنادول، بروفين، أوجمنتين، كونكور...</small></div>`;
}
$('#searchInput').addEventListener('input', e=> renderSearch(e.target.value));

// ===== الكاميرا + OCR =====
async function startCam(){
  try{
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}, audio:false});
    const v = $('#video'); v.srcObject = stream; v.hidden = false;
    await v.play();
    $('#cameraPlaceholder').style.display='none'; $('#preview').hidden = true;
    $('#startCamBtn').hidden = true; $('#captureBtn').hidden = false; $('#stopCamBtn').hidden = false;
  }catch(e){ toast('تعذر فتح الكاميرا — اختر صورة من الجوال 📁'); }
}
function stopCam(){
  if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; }
  const v=$('#video'); if(v){v.hidden=true; v.srcObject=null;}
  const sc=$('#startCamBtn'),cp=$('#captureBtn'),st=$('#stopCamBtn');
  if(sc){sc.hidden=false;cp.hidden=true;st.hidden=true;}
}
$('#startCamBtn').onclick = startCam;
$('#stopCamBtn').onclick = ()=>{ stopCam(); $('#cameraPlaceholder').style.display='block'; };
window.stopCam = stopCam;

$('#captureBtn').onclick = async ()=>{
  const v=$('#video'), c=$('#canvas');
  c.width=v.videoWidth||640; c.height=v.videoHeight||480;
  c.getContext('2d').drawImage(v,0,0,c.width,c.height);
  const url=c.toDataURL('image/jpeg',.85);
  $('#preview').src=url; $('#preview').hidden=false; v.hidden=true;
  analyzeImage(url);
};
$('#fileInput').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ $('#preview').src=r.result; $('#preview').hidden=false; $('#cameraPlaceholder').style.display='none'; analyzeImage(r.result); };
  r.readAsDataURL(f);
});
$('#demoBtn').onclick = ()=>{
  const d = DRUGS[Math.floor(Math.random()*DRUGS.length)];
  $('#result').innerHTML = drugCard(d, 'تم التعرف عليه من الصورة (وضع تجريبي)');
  $('#result').scrollIntoView({behavior:'smooth'});
  toast('هذه نتيجة تجريبية — جرّب التصوير الحقيقي 📷');
};

// توحيد النص العربي للمطابقة (أ/إ/آ→ا، ة→ه، ى→ي، إزالة التشكيل)
function norm(s){
  return (s||'').toLowerCase()
    .replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')
    .replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').trim();
}

// تحسين الصورة قبل OCR: تكبير + رمادي + تباين (يرفع الدقة كثيراً)
function prepImage(imgUrl){
  return new Promise(res=>{
    const img = new Image();
    img.onload = ()=>{
      const w = Math.min(img.width*2, 2000);
      const h = Math.round(w*img.height/img.width);
      const c = document.createElement('canvas'); c.width=w; c.height=h;
      const x = c.getContext('2d');
      x.drawImage(img,0,0,w,h);
      const d = x.getImageData(0,0,w,h), p = d.data;
      for(let i=0;i<p.length;i+=4){
        let g = .299*p[i]+.587*p[i+1]+.114*p[i+2];
        g = g<150 ? Math.max(0,g-40) : Math.min(255,g+40); // تباين
        p[i]=p[i+1]=p[i+2]=g;
      }
      x.putImageData(d,0,0);
      res(c.toDataURL('image/jpeg',.9));
    };
    img.onerror = ()=>res(imgUrl);
    img.src = imgUrl;
  });
}

async function analyzeImage(imgUrl){
  const box=$('#ocrStatus'); box.hidden=false; box.textContent='🔍 جارٍ قراءة الاسم من الصورة...';
  $('#result').innerHTML='';
  // 1) إن وُجد مفتاح ذكاء اصطناعي → تعرّف شامل على أي دواء
  const key = localStorage.getItem('gemini_key')||'';
  if(key){
    box.textContent='🤖 الذكاء الاصطناعي يحلل الصورة...';
    const ai = await geminiIdentify(imgUrl, key).catch(()=>null);
    if(ai){ renderAiResult(ai); return; }
    box.textContent='تعثر الذكاء الاصطناعي — أجرب القراءة المحلية...';
  }
  // 2) OCR محلي + مطابقة القاعدة
  try{
    const ready = await prepImage(imgUrl);
    const { data:{ text } } = await Tesseract.recognize(ready, 'ara+eng', {logger:m=>{ if(m.status==='recognizing text') box.textContent=`🔍 تحليل... ${Math.round(m.progress*100)}%`; }});
    const clean = text.replace(/\s+/g,' ').trim().slice(0,120);
    box.textContent = clean ? `📝 النص المرصود: "${clean}"` : 'لم يُرصد نص واضح';
    renderOcrResult(text, clean);
  }catch(e){
    box.textContent='تعذر التحليل — تحقق من الإنترنت ( OCR يحتاج اتصال أول مرة )';
    $('#result').innerHTML = `<div class="no-match">📝 اكتب اسم الدواء يدوياً:<br><br>
      <input id="manualName" class="search-box" placeholder="مثال: فيفادول">
      <button class="btn-primary" style="margin-top:8px" onclick="manualSearch()">🔍 ابحث</button></div>`;
  }
  $('#result').scrollIntoView({behavior:'smooth'});
}

// يعرض نتيجة OCR مع إمكانية تصحيح النص ثم البحث
function renderOcrResult(text, clean){
  const found = matchDrug(text);
  const editBox = `<div class="ocr-edit">
      <label>📝 النص المقروء (صحّحه إن كان ناقصاً ثم ابحث):</label>
      <div style="display:flex;gap:6px;margin-top:6px">
        <input id="ocrText" class="search-box" value="${(clean||'').replace(/"/g,'')}">
        <button class="btn-primary" style="width:auto;white-space:nowrap" onclick="manualSearch('ocrText')">🔍</button>
      </div>
    </div>`;
  if(found){
    $('#result').innerHTML = editBox + drugCard(found, 'تم التعرف عليه من الصورة ✅');
    toast('تم التعرف على الدواء ✅');
  }else{
    $('#result').innerHTML = editBox + `<div class="no-match">😕 لم أجد "<b>${clean||'—'}</b>" في القاعدة المحلية (${DRUGS.length} دواءً)<br>
      <small>• صحّح النص بالأعلى واضغط 🔍<br>• أو فعّل <b>التعرف الشامل بالذكاء الاصطناعي</b> بالأسفل ليتعرف على أي دواء</small><br><br>
      <button class="btn-primary" onclick="go('search')">🔍 بحث يدوي</button></div>`;
  }
}
window.manualSearch = (inputId)=>{
  const q = inputId ? $('#'+inputId).value : $('#manualName').value;
  const found = matchDrug(q);
  if(found){ $('#result').innerHTML = drugCard(found, 'تم التعرف عليه ✅'); }
  else { go('search'); $('#searchInput').value=q; renderSearch(q); toast('انقلت للبحث اليدوي 🔍'); }
};

// تعرّف شامل عبر Gemini Vision (يتعرف على أي دواء + يولّد البطاقة)
async function geminiIdentify(imgUrl, key){
  const base64 = imgUrl.split(',')[1];
  const prompt = `انظر لصورة علبة الدواء هذه. أعد JSON فقط بهذا الشكل (بدون أي نص إضافي):
{"trade":"الاسم التجاري","sci":"المادة الفعالة والتركيز","type":"النوع مثل: مسكن، مضاد حيوي، خافض ضغط","benefits":["فائدة1 قصيرة","فائدة2","فائدة3"],"cons":["مانع1 قصير","مانع2","مانع3"]}
إن لم تكن الصورة لدواء أعد: {"error":"not a drug"}`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,{
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({contents:[{parts:[{text:prompt},{inline_data:{mime_type:'image/jpeg',data:base64}}]}]})
  });
  if(!r.ok) throw 0;
  const j = await r.json();
  const txt = (j.candidates?.[0]?.content?.parts?.[0]?.text||'').replace(/```json|```/g,'').trim();
  const o = JSON.parse(txt);
  if(o.error || !o.trade) throw 0;
  o.benefits=(o.benefits||[]).slice(0,3); o.cons=(o.cons||[]).slice(0,3);
  return o;
}
function renderAiResult(o){
  const d = {trade:o.trade, sci:o.sci||'—', type:o.type||'دواء', icon:'🤖', benefits:o.benefits, cons:o.cons};
  $('#ocrStatus').textContent='🤖 تم التعرف بالذكاء الاصطناعي ✅';
  $('#result').innerHTML = drugCard(d, 'تعرف شامل بالذكاء الاصطناعي 🤖');
  $('#result').scrollIntoView({behavior:'smooth'});
  toast('تم التعرف على الدواء بالذكاء الاصطناعي ✅');
}
// حفظ مفتاح Gemini (مجاني) من صفحة التصوير
function saveGeminiKey(){
  const v = $('#geminiKey').value.trim();
  if(v){ localStorage.setItem('gemini_key', v); toast('تم تفعيل التعرف الشامل 🤖✅'); }
  else { localStorage.removeItem('gemini_key'); toast('تم إيقاف الذكاء الاصطناعي'); }
  updateAiBadge();
}
function updateAiBadge(){
  const on = !!(localStorage.getItem('gemini_key'));
  const b = $('#aiBadge'); if(b) b.textContent = on ? '🤖 التعرف الشامل: مفعّل ✅' : '🤖 التعرف الشامل: متوقف';
}

function matchDrug(text){
  if(!text) return null;
  const t = norm(text);
  if(!t) return null;
  let best=null, bestScore=0;
  const hit = (needle)=>{
    const n = norm(needle);
    if(!n || n.length<3) return 0;
    if(t.includes(n)) return n.length>4?3:2;
    // تطابق أول 5 حروف (يفيد مع أخطاء OCR)
    if(n.length>=5 && t.includes(n.slice(0,5))) return 1;
    return 0;
  };
  DRUGS.forEach(d=>{
    let s = hit(d.trade) + hit(d.sci.split(' ')[0]);
    d.keys.forEach(k=> s += hit(k));
    (typeof ALIASES!=='undefined' ? ALIASES : []).forEach(a=>{
      if(a.id===d.id) a.names.forEach(n=> s += hit(n));
    });
    if(s>bestScore){bestScore=s;best=d;}
  });
  return bestScore>0?best:null;
}

// ===== جدولي — localStorage =====
const LS='dawai_my_meds_v1';
const TAKEN_LS='dawai_taken_';
function loadMeds(){ try{return JSON.parse(localStorage.getItem(LS))||[]}catch{return []} }
function saveMeds(m){ localStorage.setItem(LS, JSON.stringify(m)); renderMy(); }
function todayKey(){ return new Date().toISOString().slice(0,10); }
function takenMap(){ try{return JSON.parse(localStorage.getItem(TAKEN_LS+todayKey()))||{}}catch{return {}} }
function setTaken(idx){ const m=takenMap(); m[idx]=true; localStorage.setItem(TAKEN_LS+todayKey(), JSON.stringify(m)); renderMy(); }

window.quickAdd = (name)=>{
  $('#fName').value = name;
  go('my');
  setTimeout(()=>{ $('#fTime').focus(); toast('أكمل الوقت واضغط حفظ 💾'); },300);
};

$('#addForm').addEventListener('submit', e=>{
  e.preventDefault();
  const meds=loadMeds();
  const repeat=parseInt($('#fRepeat').value);
  const base=$('#fTime').value;
  const times = repeat===1?[base]: repeat===2?[base,'20:00']: [base,'14:00','20:00'];
  times.forEach(t=> meds.push({name:$('#fName').value.trim(), time:t, dose:$('#fDose').value, note:$('#fNote').value.trim(), created:Date.now()}));
  saveMeds(meds);
  e.target.reset(); $('#fTime').value='08:00';
  toast('تمت الإضافة لجدولك ✅');
  scheduleNotif(meds[meds.length-1]);
});

function renderMy(){
  const meds=loadMeds().sort((a,b)=>a.time.localeCompare(b.time));
  const taken=takenMap();
  const takenCount=Object.keys(taken).length;
  $('#statTotal').textContent=meds.length;
  $('#statToday').textContent=meds.length;
  $('#statTaken').textContent=takenCount;
  const badge=$('#navBadge');
  const left=meds.length-takenCount;
  badge.hidden = left<=0; badge.textContent=left;
  $('#myList').innerHTML = meds.length? meds.map((m,i)=>`
    <div class="med-item ${taken[i]?'taken':''}">
      <div class="time">${m.time}<small>${m.dose}</small></div>
      <div class="info"><b>${m.name}</b><small>${m.note||'—'}</small></div>
      <div class="med-actions">
        ${taken[i]?'<span>✅</span>':`<button class="mini-btn done" onclick="setTaken(${i})">تم ✔</button>`}
        <button class="mini-btn del" onclick="delMed(${i})">🗑</button>
      </div>
    </div>`).join('')
    : `<div class="empty">📭 جدولك فارغ<br>صوّر دواءً وأضفه أو أضفه يدوياً بالأعلى</div>`;
}
window.delMed = (i)=>{
  const meds=loadMeds().sort((a,b)=>a.time.localeCompare(b.time));
  meds.splice(i,1); saveMeds(meds);
};
window.setTaken = setTaken;
$('#clearTakenBtn').onclick = ()=>{ localStorage.removeItem(TAKEN_LS+todayKey()); renderMy(); };

// تنبيهات
$('#notifBtn').onclick = async ()=>{
  if(!('Notification' in window)) return toast('التنبيهات غير مدعومة');
  const p = await Notification.requestPermission();
  toast(p==='granted'?'تم تفعيل التنبيهات 🔔':'تم رفض التنبيهات');
};
function scheduleNotif(med){
  if(!('Notification' in window) || Notification.permission!=='granted') return;
  try{
    const [h,mi]=med.time.split(':').map(Number);
    const now=new Date(); const target=new Date(); target.setHours(h,mi,0,0);
    const ms=target-now; if(ms<=0) return;
    setTimeout(()=> new Notification('💊 موعد دوائك', {body:`${med.name} — ${med.dose}`}), ms);
  }catch{}
}

// تثبيت PWA
window.addEventListener('beforeinstallprompt', e=>{
  e.preventDefault(); deferredPrompt=e;
  $('#installBtn').hidden=false;
});
$('#installBtn').onclick = async ()=>{
  if(!deferredPrompt) return toast('استخدم قائمة المتصفح ← إضافة للشاشة الرئيسية');
  deferredPrompt.prompt(); deferredPrompt=null; $('#installBtn').hidden=true;
};

// init
renderHome(); renderSearch(); renderMy(); updateAiBadge();
const _gk = $('#geminiKey'); if(_gk) _gk.value = localStorage.getItem('gemini_key')||'';
