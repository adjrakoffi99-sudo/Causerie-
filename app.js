const API=(location.hostname==="localhost"||location.hostname==="127.0.0.1")?"http://localhost:3000/api":"/api";
let token=localStorage.getItem("causerie_token"), me=null, currentUser=null, users=[], tracks=[], currentTrack=-1;
const $=id=>document.getElementById(id);
async function api(path,opts={}){opts.headers={...(opts.headers||{}),"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})};const r=await fetch(API+path,opts);const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Erreur serveur");return d}
function showApp(){ $("auth").hidden=true;$("app").hidden=false;$("welcome").textContent="Bonjour "+me.name+" 👋";loadUsers()}
function showAuth(){ $("auth").hidden=false;$("app").hidden=true}
async function register(){try{me=await api("/auth/register",{method:"POST",body:JSON.stringify({name:$("name").value.trim()||"Moi",phone:$("phone").value.trim(),password:$("password").value})});token=me.token;localStorage.setItem("causerie_token",token);$("status").textContent="Connecté";showApp()}catch(e){$("authMsg").textContent=e.message}}
async function login(){try{me=await api("/auth/login",{method:"POST",body:JSON.stringify({phone:$("phone").value.trim(),password:$("password").value})});token=me.token;localStorage.setItem("causerie_token",token);$("status").textContent="Connecté";showApp()}catch(e){$("authMsg").textContent=e.message}}
async function loadUsers(){try{users=await api("/users");renderUsers(users)}catch(e){}}
function renderUsers(list){$("users").innerHTML=list.map(u=>`<div class="user" data-id="${u.id}">👤 ${esc(u.name)}<small> ${esc(u.phone)}</small></div>`).join("")||"Aucun utilisateur";document.querySelectorAll(".user").forEach(x=>x.onclick=()=>selectUser(Number(x.dataset.id)))}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function selectUser(id){currentUser=users.find(x=>x.id===id);$("chatTitle").textContent=currentUser.name;try{const d=await api("/messages/"+id);$("messages").innerHTML=d.map(m=>`<div class="msg"><b>${esc(m.sender_name)}</b>: ${esc(m.body)}<small> ${new Date(m.created_at).toLocaleTimeString()}</small></div>`).join("");$("messages").scrollTop=1e9}catch(e){}}
async function send(){if(!currentUser||!$("message").value.trim())return;const body=$("message").value.trim();try{await api("/messages",{method:"POST",body:JSON.stringify({to:currentUser.id,body})});$("message").value="";selectUser(currentUser.id)}catch(e){alert(e.message)}}
$("register").onclick=register;$("login").onclick=login;$("find").onclick=()=>{const q=$("search").value.toLowerCase();renderUsers(users.filter(u=>(u.name+" "+u.phone).toLowerCase().includes(q)))};$("send").onclick=send;$("message").onkeydown=e=>{if(e.key==="Enter")send()};$("logout").onclick=()=>{localStorage.removeItem("causerie_token");token=null;location.reload()};

const DB="CauserieMusicDB",STORE="tracks";
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:"id",autoIncrement:true});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function saveTrack(t){const db=await openDB();return new Promise((res,rej)=>{const q=db.transaction(STORE,"readwrite").objectStore(STORE).add(t);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}
async function getTracks(){const db=await openDB();return new Promise((res,rej)=>{const q=db.transaction(STORE).objectStore(STORE).getAll();q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}
function renderMusic(){const c=$("musicList");c.innerHTML=tracks.map((t,i)=>`<div class="music"><span>${esc(t.name)}</span><button onclick="playTrack(${i})">▶</button></div>`).join("")}
window.playTrack=i=>{currentTrack=i;$("player").src=URL.createObjectURL(tracks[i].blob);$("player").play();renderMusic()}
$("music").onchange=async e=>{for(const f of e.target.files){await saveTrack({name:f.name,blob:f,type:f.type})}tracks=await getTracks();renderMusic();if(currentTrack<0&&tracks.length)playTrack(0);e.target.value=""}
$("prev").onclick=()=>{if(!tracks.length)return;currentTrack=(currentTrack-1+tracks.length)%tracks.length;playTrack(currentTrack)}
$("next").onclick=()=>{if(!tracks.length)return;currentTrack=(currentTrack+1)%tracks.length;playTrack(currentTrack)}
$("pause").onclick=()=>{const p=$("player");p.paused?p.play():p.pause()}
$("player").onended=()=>{if(tracks.length){currentTrack=(currentTrack+1)%tracks.length;playTrack(currentTrack)}}
getTracks().then(x=>{tracks=x;renderMusic()});
if(token){api("/me").then(x=>{me=x;$("status").textContent="Connecté";showApp()}).catch(()=>{localStorage.removeItem("causerie_token");token=null})}