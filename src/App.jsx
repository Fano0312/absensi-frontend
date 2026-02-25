import { useState, useRef, useEffect } from "react";

const API = "https://absensi-backend-production-7b1d.up.railway.app/api";
const KAMPUS = { lat: -8.4539, lng: 119.8851, nama: "Politeknik eLBajo Commodus" };
const RADIUS_METER = 100;
const TOLERANSI_MENIT = 30; // bisa absen 30 menit setelah jam mulai

function hitungJarak(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// Parse jam dari string "08:00 - 10:00" atau "08:00-10:00"
function parseJam(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.replace(/\s/g,"").split("-");
  if (parts.length < 2) return null;
  const [jamMulai, jamSelesai] = parts;
  const [h1, m1] = jamMulai.split(":").map(Number);
  const [h2, m2] = jamSelesai.split(":").map(Number);
  if (isNaN(h1)||isNaN(m1)||isNaN(h2)||isNaN(m2)) return null;
  return { mulai: h1*60+m1, selesai: h2*60+m2 };
}

function cekJamAbsen(timeStr) {
  const jam = parseJam(timeStr);
  if (!jam) return { boleh: true, pesan: "" };
  const now = new Date();
  const menitSekarang = now.getHours()*60 + now.getMinutes();
  const batasAwal = jam.mulai - 0; // tepat jam mulai
  const batasAkhir = jam.selesai;  // sampai jam selesai
  if (menitSekarang < batasAwal) {
    const selisih = batasAwal - menitSekarang;
    const jam_ = Math.floor(selisih/60), mnt = selisih%60;
    return { boleh: false, pesan: `Belum waktunya! Kuliah mulai jam ${timeStr.split("-")[0].trim()}. ${jam_>0?jam_+"j ":""}${mnt}m lagi.` };
  }
  if (menitSekarang > batasAkhir) {
    return { boleh: false, pesan: `Waktu absen sudah habis! Kuliah berakhir jam ${timeStr.split("-").pop().trim()}.` };
  }
  return { boleh: true, pesan: "" };
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Outfit',sans-serif;background:#f0f4ff;}
  .sidebar{width:240px;background:linear-gradient(160deg,#1e3a8a,#1d4ed8);padding:24px 16px;display:flex;flex-direction:column;gap:6px;min-height:100vh;position:fixed;left:0;top:0;bottom:0;z-index:100;transition:transform .3s;}
  .main-content{margin-left:240px;padding:28px;min-height:100vh;}
  .overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99;}
  .hamburger{display:none;position:fixed;top:16px;left:16px;z-index:200;background:#1d4ed8;border:none;border-radius:10px;padding:10px;cursor:pointer;}
  .stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;}
  .table-wrap{overflow-x:auto;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,.06);}
  table{width:100%;border-collapse:collapse;background:#fff;min-width:600px;}
  th{padding:14px 16px;text-align:left;font-size:13px;font-weight:600;background:#1d4ed8;color:#fff;}
  td{padding:12px 16px;font-size:13px;border-bottom:1px solid #f1f5f9;}
  tr:last-child td{border-bottom:none;}
  tr:nth-child(even) td{background:#f8faff;}
  .form-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;}
  .card{background:#fff;border-radius:16px;padding:18px 20px;box-shadow:0 1px 8px rgba(0,0,0,.07);border:1px solid #e2e8f0;margin-bottom:12px;}
  .stat-card{background:#fff;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,.06);border:1px solid #e2e8f0;}
  .toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#10b981;color:#fff;padding:12px 28px;border-radius:30px;font-weight:700;font-size:14px;z-index:2000;box-shadow:0 4px 20px rgba(0,0,0,.2);white-space:nowrap;}
  .input{width:100%;padding:11px 14px;border-radius:10px;border:1.5px solid #e2e8f0;font-size:14px;font-family:'Outfit',sans-serif;outline:none;transition:border .2s;}
  .input:focus{border-color:#1d4ed8;}
  .btn{padding:12px 24px;border:none;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;font-family:'Outfit',sans-serif;}
  .btn-primary{background:linear-gradient(135deg,#1d4ed8,#0ea5e9);color:#fff;}
  .btn-primary:disabled{opacity:.5;cursor:not-allowed;}
  .btn-secondary{background:#f0f4ff;color:#64748b;}
  .btn-danger{background:#ef4444;color:#fff;}
  .btn-full{width:100%;padding:14px;}
  .si{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:12px;border:none;background:transparent;color:#fff;cursor:pointer;font-family:'Outfit',sans-serif;font-size:14px;width:100%;text-align:left;transition:background .2s;}
  .si.active{background:rgba(255,255,255,.2);font-weight:700;}
  .si.logout{color:rgba(255,255,255,.6);}
  .nav-tabs{display:flex;background:#f0f4ff;border-radius:12px;padding:4px;gap:4px;}
  .nav-tab{flex:1;padding:10px 0;background:transparent;border:none;cursor:pointer;border-radius:10px;transition:.2s;font-family:'Outfit',sans-serif;font-size:13px;font-weight:500;color:#64748b;}
  .nav-tab.active{background:#fff;color:#1d4ed8;font-weight:700;}
  .mini4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
  .fade-in{animation:fadeIn .3s ease;}
  @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
  .pulse{animation:pulse 1.5s infinite;}
  @media(max-width:768px){
    .sidebar{transform:translateX(-100%);}
    .sidebar.open{transform:translateX(0);}
    .overlay.open{display:block;}
    .hamburger{display:flex;align-items:center;justify-content:center;}
    .main-content{margin-left:0;padding:16px;padding-top:68px;}
    .stats-grid{grid-template-columns:repeat(2,1fr);gap:12px;}
    .form-grid{grid-template-columns:1fr;}
  }
  @media(max-width:480px){
    .stats-grid{grid-template-columns:1fr;}
    .main-content{padding:12px;padding-top:68px;}
  }
`;

const api = {
  post: async (p,b,t)=>(await fetch(API+p,{method:"POST",headers:{"Content-Type":"application/json",...(t&&{Authorization:`Bearer ${t}`})},body:JSON.stringify(b)})).json(),
  get: async (p,t)=>(await fetch(API+p,{headers:{Authorization:`Bearer ${t}`}})).json(),
  postForm: async (p,f,t)=>(await fetch(API+p,{method:"POST",headers:{Authorization:`Bearer ${t}`},body:f})).json(),
};

function Badge({ status }) {
  const c={hadir:{bg:"#d1fae5",color:"#065f46",label:"Hadir"},izin:{bg:"#fef3c7",color:"#92400e",label:"Izin"},sakit:{bg:"#dbeafe",color:"#1e40af",label:"Sakit"},alpha:{bg:"#fee2e2",color:"#991b1b",label:"Alpha"}}[status]||{bg:"#fee2e2",color:"#991b1b",label:"Alpha"};
  return <span style={{background:c.bg,color:c.color,padding:"3px 12px",borderRadius:20,fontSize:12,fontWeight:600}}>{c.label}</span>;
}

function JamBadge({ timeStr }) {
  const cek = cekJamAbsen(timeStr);
  const jam = parseJam(timeStr);
  if (!jam) return null;
  const now = new Date();
  const menit = now.getHours()*60+now.getMinutes();
  const sedangBerlangsung = menit >= jam.mulai && menit <= jam.selesai;
  return (
    <span style={{background:sedangBerlangsung?"#d1fae5":cek.boleh?"#f0fdf4":"#fee2e2",color:sedangBerlangsung?"#065f46":"#991b1b",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,marginLeft:6}}>
      {sedangBerlangsung?"🟢 Berlangsung":"🔴 Di luar jam"}
    </span>
  );
}

// ── Login ────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [nim,setNim]=useState(""); const [pw,setPw]=useState(""); const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  const login = async () => {
    if (!nim||!pw) return setErr("NIM dan password harus diisi!");
    setLoading(true); setErr("");
    try {
      const r = await api.post("/auth/login",{nim,password:pw});
      if (r.token) { localStorage.setItem("token",r.token); localStorage.setItem("user",JSON.stringify(r.user)); onLogin(r.user,r.token); }
      else setErr(r.message||"Login gagal");
    } catch { setErr("Tidak bisa konek ke server!"); }
    setLoading(false);
  };
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#1e3a8a,#0ea5e9)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <style>{css}</style>
      <div style={{background:"#fff",borderRadius:24,padding:"40px 36px",width:"100%",maxWidth:420,boxShadow:"0 24px 64px rgba(0,0,0,.2)"}} className="fade-in">
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:68,height:68,background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",borderRadius:22,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16}}><span style={{fontSize:30}}>📚</span></div>
          <div style={{fontSize:28,fontWeight:900,color:"#1e293b"}}>AbsensiKu</div>
          <div style={{fontSize:13,color:"#64748b",marginTop:4}}>Politeknik eLBajo Commodus</div>
        </div>
        {err && <div style={{background:"#fee2e2",color:"#991b1b",padding:"10px 16px",borderRadius:10,fontSize:13,marginBottom:16}}>⚠️ {err}</div>}
        <div style={{marginBottom:16}}>
          <label style={{fontSize:13,fontWeight:600,color:"#1e293b",display:"block",marginBottom:6}}>NIM / Username</label>
          <input className="input" value={nim} onChange={e=>setNim(e.target.value)} placeholder="Masukkan NIM..." />
        </div>
        <div style={{marginBottom:24}}>
          <label style={{fontSize:13,fontWeight:600,color:"#1e293b",display:"block",marginBottom:6}}>Password</label>
          <input className="input" type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Masukkan password..." onKeyDown={e=>e.key==="Enter"&&login()} />
        </div>
        <button className="btn btn-primary btn-full" onClick={login} disabled={loading}>{loading?"Memverifikasi...":"Masuk →"}</button>
      </div>
    </div>
  );
}

// ── Modal Absen dengan Geofencing + Cek Jam ──────────────────────────────────
function AbsenModal({ course, token, onClose, onSuccess }) {
  const videoRef=useRef(null); const canvasRef=useRef(null);
  const [stream,setStream]=useState(null);
  const [photo,setPhoto]=useState(null); const [blob,setBlob]=useState(null);
  const [lokasi,setLokasi]=useState(null); const [jarak,setJarak]=useState(null);
  const [statusLokasi,setStatusLokasi]=useState("loading");
  const [step,setStep]=useState("cek");
  const [loading,setLoading]=useState(false);
  const [jamCek]=useState(()=>cekJamAbsen(course.time));
  const [waktuSekarang,setWaktuSekarang]=useState(new Date());

  useEffect(()=>{
    const t=setInterval(()=>setWaktuSekarang(new Date()),1000);
    return ()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    navigator.geolocation?.getCurrentPosition(
      pos=>{
        const lat=pos.coords.latitude,lng=pos.coords.longitude;
        setLokasi({lat,lng});
        setJarak(hitungJarak(lat,lng,KAMPUS.lat,KAMPUS.lng));
        setStatusLokasi(hitungJarak(lat,lng,KAMPUS.lat,KAMPUS.lng)<=RADIUS_METER?"ok":"jauh");
      },
      ()=>setStatusLokasi("gagal"),
      {enableHighAccuracy:true,timeout:10000}
    );
  },[]);

  const mulaiKamera = ()=>{
    setStep("camera");
    navigator.mediaDevices?.getUserMedia({video:{facingMode:"user"}}).then(s=>{setStream(s);if(videoRef.current)videoRef.current.srcObject=s;}).catch(()=>{});
  };

  const takePhoto=()=>{
    const c=canvasRef.current,v=videoRef.current;
    c.width=v.videoWidth||320;c.height=v.videoHeight||240;
    c.getContext("2d").drawImage(v,0,0);
    setPhoto(c.toDataURL("image/jpeg"));
    c.toBlob(b=>setBlob(b),"image/jpeg");
    stream?.getTracks().forEach(t=>t.stop());
    setStep("confirm");
  };

  const submit=async()=>{
    // Cek jam lagi saat submit
    const cekUlang = cekJamAbsen(course.time);
    if (!cekUlang.boleh) { alert("⏰ "+cekUlang.pesan); return; }
    setLoading(true);
    const f=new FormData();
    f.append("matkul_id",course.id);
    if (lokasi){f.append("latitude",lokasi.lat);f.append("longitude",lokasi.lng);}
    if (blob) f.append("foto",blob,"selfie.jpg");
    const r=await api.postForm("/absensi/checkin",f,token);
    if (r.message==="Absensi berhasil!"){setStep("success");setTimeout(()=>{onSuccess();onClose();},1800);}
    else{alert(r.message);setLoading(false);}
  };

  const jam=parseJam(course.time);
  const menitNow=waktuSekarang.getHours()*60+waktuSekarang.getMinutes();
  const sedangBerlangsung=jam&&menitNow>=jam.mulai&&menitNow<=jam.selesai;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:1000}}>
      <div style={{background:"#fff",borderRadius:"24px 24px 0 0",padding:24,width:"100%",maxWidth:500,maxHeight:"92vh",overflowY:"auto"}} className="fade-in">
        {/* Header modal */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div>
            <div style={{fontWeight:700,fontSize:16,color:"#1e293b"}}>📋 {course.name}</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:2}}>
              {course.code} • ⏰ {course.time}
              <span style={{marginLeft:6,background:sedangBerlangsung?"#d1fae5":"#fee2e2",color:sedangBerlangsung?"#065f46":"#991b1b",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>
                {sedangBerlangsung?"🟢 Berlangsung":"🔴 Di luar jam"}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{border:"none",background:"#f0f4ff",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:18}}>✕</button>
        </div>

        {/* Jam sekarang */}
        <div style={{background:"#f8faff",borderRadius:12,padding:"10px 14px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:13,color:"#64748b"}}>🕐 Jam sekarang</div>
          <div style={{fontWeight:800,fontSize:18,color:"#1e293b"}}>
            {waktuSekarang.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
          </div>
        </div>

        {/* Cek jam kuliah */}
        {!jamCek.boleh && (
          <div style={{background:"#fee2e2",borderRadius:14,padding:20,textAlign:"center",marginBottom:12}}>
            <div style={{fontSize:48,marginBottom:10}}>⏰</div>
            <div style={{fontWeight:800,color:"#991b1b",fontSize:16}}>Di Luar Jam Kuliah!</div>
            <div style={{fontSize:13,color:"#7f1d1d",marginTop:8,lineHeight:1.6}}>{jamCek.pesan}</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:8}}>Jam kuliah: <b>{course.time}</b></div>
            <button className="btn btn-secondary" onClick={onClose} style={{marginTop:16,width:"100%"}}>Tutup</button>
          </div>
        )}

        {/* Konten absen (hanya tampil jika jam OK) */}
        {jamCek.boleh && (
          <>
            {step==="cek" && (
              <>
                {statusLokasi==="loading" && (
                  <div style={{textAlign:"center",padding:28}}>
                    <div style={{fontSize:48,marginBottom:12}} className="pulse">📍</div>
                    <div style={{fontWeight:600,color:"#1e293b"}}>Mengecek lokasi...</div>
                    <div style={{fontSize:13,color:"#64748b",marginTop:6}}>Pastikan GPS aktif</div>
                  </div>
                )}
                {statusLokasi==="ok" && (
                  <>
                    <div style={{borderRadius:14,overflow:"hidden",border:"3px solid #10b981",marginBottom:12}}>
                      <iframe src={`https://www.openstreetmap.org/export/embed.html?bbox=${KAMPUS.lng-.003},${KAMPUS.lat-.003},${KAMPUS.lng+.003},${KAMPUS.lat+.003}&layer=mapnik&marker=${KAMPUS.lat},${KAMPUS.lng}`} width="100%" height="200" style={{border:"none",display:"block"}} title="Peta" />
                    </div>
                    <div style={{background:"#f0fdf4",borderRadius:12,padding:"10px 14px",marginBottom:16}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#065f46"}}>✅ Lokasi terverifikasi</div>
                      <div style={{fontSize:12,color:"#64748b",marginTop:2}}>Jarak ke kampus: <b>{Math.round(jarak)} meter</b></div>
                    </div>
                    <button className="btn btn-primary btn-full" onClick={mulaiKamera}>📸 Ambil Foto Selfie</button>
                  </>
                )}
                {statusLokasi==="jauh" && (
                  <>
                    <div style={{borderRadius:14,overflow:"hidden",border:"3px solid #ef4444",marginBottom:12}}>
                      <iframe src={`https://www.openstreetmap.org/export/embed.html?bbox=${KAMPUS.lng-.003},${KAMPUS.lat-.003},${KAMPUS.lng+.003},${KAMPUS.lat+.003}&layer=mapnik&marker=${KAMPUS.lat},${KAMPUS.lng}`} width="100%" height="200" style={{border:"none",display:"block"}} title="Peta" />
                    </div>
                    <div style={{background:"#fee2e2",borderRadius:14,padding:18,textAlign:"center"}}>
                      <div style={{fontSize:36,marginBottom:8}}>🚫</div>
                      <div style={{fontWeight:700,color:"#991b1b",fontSize:16}}>Di Luar Area Kampus!</div>
                      <div style={{fontSize:13,color:"#7f1d1d",marginTop:6}}>Kamu berada <b>{Math.round(jarak)} meter</b> dari kampus.<br/>Absen hanya bisa dalam radius <b>{RADIUS_METER} meter</b>.</div>
                    </div>
                    <button className="btn btn-secondary" onClick={onClose} style={{width:"100%",marginTop:12}}>Tutup</button>
                  </>
                )}
                {statusLokasi==="gagal" && (
                  <div style={{textAlign:"center",padding:24}}>
                    <div style={{fontSize:48,marginBottom:12}}>❌</div>
                    <div style={{fontWeight:700,color:"#991b1b"}}>GPS Tidak Aktif!</div>
                    <div style={{fontSize:13,color:"#64748b",marginTop:8}}>Aktifkan GPS di HP kamu lalu coba lagi.</div>
                    <button className="btn btn-secondary" onClick={onClose} style={{marginTop:16}}>Tutup</button>
                  </div>
                )}
              </>
            )}

            {step==="camera" && (
              <>
                <div style={{background:"#000",borderRadius:16,overflow:"hidden",marginBottom:14,height:250,position:"relative"}}>
                  <video ref={videoRef} autoPlay playsInline style={{width:"100%",height:"100%",objectFit:"cover"}} />
                  <div style={{position:"absolute",inset:12,border:"2px solid rgba(255,255,255,.4)",borderRadius:12}} />
                </div>
                <canvas ref={canvasRef} style={{display:"none"}} />
                <div style={{background:"#f0fdf4",borderRadius:10,padding:"8px 14px",fontSize:12,color:"#065f46",marginBottom:12}}>
                  ✅ Lokasi OK • {Math.round(jarak)}m dari kampus • ⏰ {course.time}
                </div>
                <button className="btn btn-primary btn-full" onClick={takePhoto}>📸 Ambil Foto</button>
              </>
            )}

            {step==="confirm" && (
              <>
                <img src={photo} style={{width:"100%",borderRadius:16,marginBottom:14}} alt="selfie" />
                <div style={{background:"#f0fdf4",borderRadius:10,padding:"8px 14px",fontSize:12,color:"#065f46",marginBottom:14}}>
                  ✅ {Math.round(jarak)}m dari kampus • ⏰ {course.time}
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button className="btn btn-secondary" onClick={()=>setStep("camera")} style={{flex:1}}>Ulangi</button>
                  <button className="btn btn-primary" onClick={submit} disabled={loading} style={{flex:2}}>{loading?"Menyimpan...":"✓ Konfirmasi Absen"}</button>
                </div>
              </>
            )}

            {step==="success" && (
              <div style={{textAlign:"center",padding:28}}>
                <div style={{fontSize:72,marginBottom:16}}>✅</div>
                <div style={{fontWeight:800,fontSize:22,color:"#10b981"}}>Absensi Berhasil!</div>
                <div style={{fontSize:14,color:"#64748b",marginTop:8}}>{new Date().toLocaleString("id-ID")}</div>
                <div style={{fontSize:13,color:"#1d4ed8",marginTop:4}}>📍 Terverifikasi di kampus</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Dashboard Mahasiswa ──────────────────────────────────────────────────────
function MahasiswaDashboard({ user, token, onLogout }) {
  const [tab,setTab]=useState("home");
  const [courses,setCourses]=useState([]);
  const [riwayat,setRiwayat]=useState([]);
  const [selected,setSelected]=useState(null);
  const [toast,setToast]=useState("");
  const [lokasi,setLokasi]=useState(null);
  const [jarak,setJarak]=useState(null);
  const [jamSekarang,setJamSekarang]=useState(new Date());

  useEffect(()=>{
    api.get("/matkul",token).then(d=>setCourses(Array.isArray(d)?d:[]));
    api.get("/absensi/riwayat",token).then(d=>setRiwayat(Array.isArray(d)?d:[]));
    navigator.geolocation?.watchPosition(pos=>{
      setLokasi({lat:pos.coords.latitude,lng:pos.coords.longitude});
      setJarak(hitungJarak(pos.coords.latitude,pos.coords.longitude,KAMPUS.lat,KAMPUS.lng));
    },()=>{},{enableHighAccuracy:true});
    const t=setInterval(()=>setJamSekarang(new Date()),1000);
    return()=>clearInterval(t);
  },[]);

  const hadir=riwayat.filter(a=>a.status==="hadir").length;
  const izin=riwayat.filter(a=>a.status==="izin").length;
  const sakit=riwayat.filter(a=>a.status==="sakit").length;
  const alpha=riwayat.length-hadir-izin-sakit;
  const pct=riwayat.length>0?Math.round(hadir/riwayat.length*100):0;
  const dalamRadius=jarak!==null&&jarak<=RADIUS_METER;

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(""),3000);};
  const handleSuccess=()=>{api.get("/absensi/riwayat",token).then(d=>setRiwayat(Array.isArray(d)?d:[]));showToast("✅ Absensi berhasil!");};

  return (
    <div style={{maxWidth:480,margin:"0 auto",minHeight:"100vh",background:"#f0f4ff"}}>
      <style>{css}</style>

      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",padding:"24px 20px 60px",color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div>
            <div style={{fontSize:13,opacity:.8,marginBottom:2}}>Selamat datang 👋</div>
            <div style={{fontSize:21,fontWeight:800}}>{user.name}</div>
            <div style={{fontSize:12,opacity:.7,marginTop:2}}>{user.prodi} • Sem {user.semester}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:20,fontWeight:800}}>{jamSekarang.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</div>
            <div style={{fontSize:11,opacity:.7}}>{jamSekarang.toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"short"})}</div>
            <button onClick={onLogout} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:10,padding:"4px 12px",color:"#fff",cursor:"pointer",fontSize:12,fontFamily:"inherit",marginTop:4}}>Keluar</button>
          </div>
        </div>

        {/* Status lokasi */}
        <div style={{background:"rgba(255,255,255,.15)",borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>{jarak===null?"📍":dalamRadius?"🏫":"⚠️"}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600}}>
              {jarak===null?"Mendeteksi lokasi...":dalamRadius?"Di dalam area kampus":"Di luar area kampus"}
            </div>
            {jarak!==null && <div style={{fontSize:11,opacity:.8}}>Jarak: {Math.round(jarak)}m dari kampus • Batas: {RADIUS_METER}m</div>}
          </div>
          {jarak!==null && (
            <span style={{background:dalamRadius?"#10b981":"#ef4444",borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:700}}>
              {dalamRadius?"✅ OK":"❌"}
            </span>
          )}
        </div>
      </div>

      <div style={{padding:"0 16px",marginTop:-40,paddingBottom:100}} className="fade-in">

        {/* Beranda */}
        {tab==="home" && (
          <>
            <div className="mini4" style={{marginBottom:16}}>
              {[{l:"Hadir",v:hadir,c:"#10b981"},{l:"Izin",v:izin,c:"#f59e0b"},{l:"Sakit",v:sakit,c:"#3b82f6"},{l:"Nilai",v:pct+"%",c:pct>=75?"#10b981":"#ef4444"}].map((s,i)=>(
                <div key={i} style={{background:"#fff",borderRadius:14,padding:"12px 6px",textAlign:"center",boxShadow:"0 2px 10px rgba(0,0,0,.08)"}}>
                  <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Peta */}
            {lokasi && (
              <div style={{marginBottom:16}}>
                <div style={{fontWeight:700,fontSize:14,color:"#1e293b",marginBottom:8}}>📍 Posisi Kamu Sekarang</div>
                <div style={{borderRadius:14,overflow:"hidden",border:`3px solid ${dalamRadius?"#10b981":"#ef4444"}`}}>
                  <iframe src={`https://www.openstreetmap.org/export/embed.html?bbox=${KAMPUS.lng-.004},${KAMPUS.lat-.004},${KAMPUS.lng+.004},${KAMPUS.lat+.004}&layer=mapnik&marker=${KAMPUS.lat},${KAMPUS.lng}`} width="100%" height="170" style={{border:"none",display:"block"}} title="Peta" />
                </div>
                <div style={{marginTop:8,padding:"10px 14px",background:dalamRadius?"#f0fdf4":"#fef2f2",borderRadius:12,fontSize:13,fontWeight:600,color:dalamRadius?"#065f46":"#991b1b"}}>
                  {dalamRadius?"🎯 Kamu dalam area kampus — bisa absen!":"⚠️ Kamu di luar area kampus — tidak bisa absen"}
                </div>
              </div>
            )}

            {/* Daftar Matkul */}
            <div style={{fontWeight:700,fontSize:14,color:"#1e293b",marginBottom:10}}>📚 Mata Kuliah Hari Ini</div>
            {courses.length===0 && <div className="card" style={{textAlign:"center",color:"#64748b",fontSize:14}}>Belum ada mata kuliah</div>}
            {courses.map(c=>{
              const today=new Date().toISOString().split("T")[0];
              const sudahAbsen=riwayat.find(a=>a.matkul_id===c.id&&a.date===today);
              const jamOk=cekJamAbsen(c.time);
              const bisa=!sudahAbsen&&jamOk.boleh&&dalamRadius;
              return (
                <div key={c.id} className="card">
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,color:"#1e293b",fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                      <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{c.code} • {c.room}</div>
                      <div style={{fontSize:12,color:"#64748b",marginTop:1,display:"flex",alignItems:"center",flexWrap:"wrap",gap:4}}>
                        ⏰ {c.time}
                        <JamBadge timeStr={c.time} />
                      </div>
                      {!jamOk.boleh && !sudahAbsen && (
                        <div style={{fontSize:11,color:"#ef4444",marginTop:4}}>⚠️ {jamOk.pesan}</div>
                      )}
                    </div>
                    <div style={{flexShrink:0}}>
                      {sudahAbsen ? <Badge status="hadir" /> : (
                        <button
                          onClick={()=>setSelected(c)}
                          disabled={!bisa}
                          className="btn btn-primary"
                          style={{padding:"8px 14px",fontSize:13,opacity:bisa?1:.4,cursor:bisa?"pointer":"not-allowed"}}>
                          📸 Absen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Log Absensi */}
        {tab==="history" && (
          <>
            <div style={{fontWeight:700,fontSize:14,color:"#1e293b",marginBottom:10,marginTop:4}}>📋 Log Absensi</div>
            <div className="card" style={{marginBottom:14}}>
              <div style={{fontWeight:600,marginBottom:10,color:"#1e293b",fontSize:14}}>📊 Rekap Kehadiran</div>
              <div className="mini4" style={{marginBottom:12}}>
                {[{l:"Hadir",v:hadir,c:"#10b981"},{l:"Izin",v:izin,c:"#f59e0b"},{l:"Sakit",v:sakit,c:"#3b82f6"},{l:"Alpha",v:alpha,c:"#ef4444"}].map((s,i)=>(
                  <div key={i} style={{background:"#f8faff",borderRadius:10,padding:"10px 6px",textAlign:"center"}}>
                    <div style={{fontWeight:800,fontSize:18,color:s.c}}>{s.v}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#64748b",marginBottom:4}}>
                <span>Persentase Kehadiran</span>
                <span style={{fontWeight:700,color:pct>=75?"#10b981":"#ef4444"}}>{pct}%</span>
              </div>
              <div style={{background:"#f0f4ff",borderRadius:20,height:8,overflow:"hidden"}}>
                <div style={{width:pct+"%",height:"100%",background:pct>=75?"#10b981":"#ef4444",borderRadius:20,transition:"width .5s"}} />
              </div>
              {pct<75 && <div style={{fontSize:11,color:"#ef4444",marginTop:6}}>⚠️ Kehadiran di bawah 75%! Harap segera hadir.</div>}
            </div>
            {riwayat.length===0 && <div className="card" style={{textAlign:"center",color:"#64748b"}}>Belum ada riwayat absensi</div>}
            {riwayat.map((a,i)=>(
              <div key={i} className="card" style={{padding:"14px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:600,color:"#1e293b",fontSize:14}}>{a.matkul_name}</div>
                    <div style={{fontSize:12,color:"#64748b",marginTop:2}}>📅 {a.date} • 🕐 {a.time}</div>
                    {a.latitude && <div style={{fontSize:11,color:"#10b981",marginTop:2}}>📍 Lokasi kampus terverifikasi</div>}
                  </div>
                  <Badge status={a.status} />
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"#fff",borderTop:"1px solid #e2e8f0",padding:"8px 16px 16px",zIndex:50}}>
        <div className="nav-tabs">
          {[{k:"home",l:"🏠 Beranda"},{k:"history",l:"📋 Log Absensi"}].map(t=>(
            <button key={t.k} className={`nav-tab ${tab===t.k?"active":""}`} onClick={()=>setTab(t.k)}>{t.l}</button>
          ))}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
      {selected && <AbsenModal course={selected} token={token} onClose={()=>setSelected(null)} onSuccess={handleSuccess} />}
    </div>
  );
}

// ── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard({ user, token, onLogout }) {
  const [tab,setTab]=useState("overview");
  const [open,setOpen]=useState(false);
  const [laporan,setLaporan]=useState([]);
  const [absensi,setAbsensi]=useState([]);
  const [courses,setCourses]=useState([]);
  const [nm,setNm]=useState({name:"",code:"",day:"",time:"",room:""});
  const [loadingAdd,setLoadingAdd]=useState(false);

  useEffect(()=>{
    api.get("/laporan/semua",token).then(d=>setLaporan(Array.isArray(d)?d:[]));
    api.get("/absensi/semua",token).then(d=>setAbsensi(Array.isArray(d)?d:[]));
    api.get("/matkul",token).then(d=>setCourses(Array.isArray(d)?d:[]));
  },[]);

  const tambah=async()=>{
    if (!nm.name||!nm.code) return alert("Nama dan kode wajib diisi!");
    setLoadingAdd(true);
    const r=await api.post("/matkul",{...nm,dosen_id:user.id},token);
    if (r.id){setCourses(p=>[...p,r]);setNm({name:"",code:"",day:"",time:"",room:""});alert("Berhasil!");}
    else alert(r.message);
    setLoadingAdd(false);
  };

  const nav=[{k:"overview",i:"🏠",l:"Overview"},{k:"matkul",i:"📚",l:"Mata Kuliah"},{k:"mahasiswa",i:"👥",l:"Mahasiswa"},{k:"laporan",i:"📊",l:"Laporan"}];
  const setT=k=>{setTab(k);setOpen(false);};

  return (
    <div style={{display:"flex",minHeight:"100vh"}}>
      <style>{css}</style>
      <button className="hamburger" onClick={()=>setOpen(p=>!p)}><span style={{color:"#fff",fontSize:22}}>☰</span></button>
      <div className={`overlay ${open?"open":""}`} onClick={()=>setOpen(false)} />
      <div className={`sidebar ${open?"open":""}`}>
        <div style={{color:"#fff",fontWeight:900,fontSize:20,marginBottom:28,paddingLeft:8,paddingTop:8}}>AbsensiKu<div style={{fontSize:12,fontWeight:400,opacity:.6,marginTop:2}}>Panel Admin</div></div>
        {nav.map(n=><button key={n.k} className={`si ${tab===n.k?"active":""}`} onClick={()=>setT(n.k)}><span style={{fontSize:18}}>{n.i}</span>{n.l}</button>)}
        <div style={{flex:1}} />
        <button className="si logout" onClick={onLogout}><span>🚪</span>Keluar</button>
      </div>

      <div className="main-content fade-in">
        <div style={{marginBottom:24}}>
          <div style={{fontSize:24,fontWeight:800,color:"#1e293b"}}>{nav.find(n=>n.k===tab)?.i} {nav.find(n=>n.k===tab)?.l}</div>
          <div style={{fontSize:13,color:"#64748b",marginTop:4}}>Selamat datang, {user.name}</div>
        </div>

        {tab==="overview" && (
          <>
            <div className="stats-grid">
              {[{l:"Total Mahasiswa",v:laporan.length,c:"#1d4ed8"},{l:"Mata Kuliah",v:courses.length,c:"#0ea5e9"},{l:"Total Absensi",v:absensi.length,c:"#10b981"}].map((s,i)=>(
                <div key={i} className="stat-card">
                  <div style={{fontSize:32,fontWeight:900,color:s.c}}>{s.v}</div>
                  <div style={{fontSize:13,color:"#64748b",marginTop:4}}>{s.l}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <div style={{fontWeight:700,marginBottom:10,color:"#1e293b",fontSize:15}}>⚙️ Pengaturan Absensi</div>
              <div style={{fontSize:13,color:"#64748b",lineHeight:1.8}}>
                🏫 Kampus: <b>{KAMPUS.nama}</b><br/>
                📍 Koordinat: {KAMPUS.lat}, {KAMPUS.lng}<br/>
                📏 Radius absen: <b style={{color:"#10b981"}}>{RADIUS_METER} meter</b><br/>
                ⏰ Jam absen: <b style={{color:"#1d4ed8"}}>Sesuai jam mata kuliah masing-masing</b>
              </div>
            </div>
          </>
        )}

        {tab==="matkul" && (
          <>
            <div className="stat-card" style={{marginBottom:20}}>
              <div style={{fontWeight:700,marginBottom:14,color:"#1e293b",fontSize:15}}>➕ Tambah Mata Kuliah</div>
              <div style={{fontSize:12,color:"#64748b",marginBottom:12,background:"#f0f9ff",padding:"8px 12px",borderRadius:8}}>
                💡 Format jam: <b>08:00-10:00</b> (mahasiswa hanya bisa absen di antara jam ini)
              </div>
              <div className="form-grid">
                {[{k:"name",l:"Nama Matkul",p:"Pemrograman Web"},{k:"code",l:"Kode",p:"TI301"},{k:"day",l:"Hari",p:"Senin"},{k:"time",l:"Jam (08:00-10:00)",p:"08:00-10:00"},{k:"room",l:"Ruangan",p:"Lab A"}].map(f=>(
                  <div key={f.k}>
                    <label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>{f.l}</label>
                    <input className="input" value={nm[f.k]} onChange={e=>setNm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.p} />
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" onClick={tambah} disabled={loadingAdd} style={{marginTop:16}}>{loadingAdd?"Menyimpan...":"✓ Tambah Matkul"}</button>
            </div>
            {courses.length===0 && <div className="card" style={{textAlign:"center",color:"#64748b"}}>Belum ada mata kuliah</div>}
            {courses.map(c=>(
              <div key={c.id} className="card">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:700,color:"#1e293b"}}>{c.name}</div>
                    <div style={{fontSize:13,color:"#64748b",marginTop:4}}>{c.code} • {c.day} • {c.room}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:700,color:"#1d4ed8",fontSize:14}}>⏰ {c.time}</div>
                    <JamBadge timeStr={c.time} />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {tab==="mahasiswa" && (
          <>
            {laporan.length===0 && <div className="card" style={{textAlign:"center",color:"#64748b"}}>Belum ada data</div>}
            {laporan.map(m=>(
              <div key={m.id} className="card">
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:46,height:46,borderRadius:14,background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:18,flexShrink:0}}>{m.name?.[0]}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,color:"#1e293b"}}>{m.name}</div>
                    <div style={{fontSize:12,color:"#64748b"}}>{m.nim} • {m.prodi}</div>
                    <div style={{marginTop:8,background:"#f0f4ff",borderRadius:20,height:6,overflow:"hidden"}}>
                      <div style={{width:(m.persentase||0)+"%",height:"100%",background:m.persentase>=75?"#10b981":"#ef4444",borderRadius:20}} />
                    </div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:3}}>Kehadiran: {m.persentase||0}%</div>
                  </div>
                  <div style={{fontWeight:800,fontSize:20,color:m.persentase>=75?"#10b981":"#ef4444",flexShrink:0}}>{m.persentase||0}%</div>
                </div>
              </div>
            ))}
          </>
        )}

        {tab==="laporan" && (
          <div className="table-wrap">
            <table>
              <thead><tr>{["Mahasiswa","NIM","Mata Kuliah","Tanggal","Waktu","Lokasi","Status"].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {absensi.length===0 && <tr><td colSpan={7} style={{textAlign:"center",color:"#64748b",padding:24}}>Belum ada data</td></tr>}
                {absensi.map((a,i)=>(
                  <tr key={i}>
                    <td style={{fontWeight:600}}>{a.mahasiswa_name}</td>
                    <td style={{color:"#64748b"}}>{a.nim}</td>
                    <td style={{color:"#64748b"}}>{a.matkul_name}</td>
                    <td style={{color:"#64748b"}}>{a.date}</td>
                    <td style={{color:"#64748b"}}>{a.time}</td>
                    <td style={{color:"#64748b",fontSize:12}}>{a.latitude?`📍 ${parseFloat(a.latitude).toFixed(4)}, ${parseFloat(a.longitude).toFixed(4)}`:"-"}</td>
                    <td><Badge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem("user"));}catch{return null;}});
  const [token,setToken]=useState(()=>localStorage.getItem("token")||null);
  const login=(u,t)=>{setUser(u);setToken(t);};
  const logout=()=>{localStorage.removeItem("token");localStorage.removeItem("user");setUser(null);setToken(null);};
  if (!user) return <LoginPage onLogin={login} />;
  if (user.role==="admin") return <AdminDashboard user={user} token={token} onLogout={logout} />;
  return <MahasiswaDashboard user={user} token={token} onLogout={logout} />;
}
