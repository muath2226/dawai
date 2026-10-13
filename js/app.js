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

// الرئيسية: chips + cards
function renderHome(){
  $('#homeChips').innerHTML = DRUGS.map(d=>`<button class="chip" onclick="showDrug(${d.id})">${d.icon} ${d.trade}</button>`).join('');
  $('#homeCards').innerHTML = DRUGS.slice(0,3).map(d=>drugCard(d)).join('');
}
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

async function analyzeImage(imgUrl){
  const box=$('#ocrStatus'); box.hidden=false; box.textContent='🔍 جارٍ قراءة الاسم من الصورة...';
  $('#result').innerHTML='';
  try{
    const { data:{ text } } = await Tesseract.recognize(imgUrl, 'ara+eng', {logger:m=>{ if(m.status==='recognizing text') box.textContent=`🔍 تحليل... ${Math.round(m.progress*100)}%`; }});
    const clean = text.replace(/\s+/g,' ').trim().slice(0,120);
    box.textContent = clean ? `📝 النص المرصود: "${clean}"` : 'لم يُرصد نص واضح';
    const found = matchDrug(text);
    if(found){
      $('#result').innerHTML = drugCard(found, 'تم التعرف عليه من الصورة ✅');
      toast('تم التعرف على الدواء ✅');
    }else{
      $('#result').innerHTML = `<div class="no-match">😕 لم نتعرف على الدواء من النص: "<b>${clean||'—'}</b>"<br><small>تأكد من وضوح الاسم والإضاءة، أو ابحث يدوياً</small><br><br><button class="btn-primary" onclick="go('search')">🔍 بحث يدوي</button></div>`;
    }
  }catch(e){
    box.textContent='تعذر التحليل — تحقق من الإنترنت ( OCR يحتاج اتصال أول مرة )';
    const found = DRUGS[0];
    $('#result').innerHTML = drugCard(found, 'نتيجة تجريبية (تعذر OCR)');
  }
  $('#result').scrollIntoView({behavior:'smooth'});
}
function matchDrug(text){
  if(!text) return null;
  const t = text.toLowerCase();
  let best=null, bestScore=0;
  DRUGS.forEach(d=>{
    let s=0;
    d.keys.forEach(k=>{
      const kk=k.toLowerCase();
      if(t.includes(kk)) s+= kk.length>4?3:2;
    });
    // تطابق جزئي: أول 4 حروف من الاسم التجاري
    if(t.includes(d.trade.slice(0,4))) s+=2;
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
renderHome(); renderSearch(); renderMy();
