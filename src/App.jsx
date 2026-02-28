import { useState, useRef, useEffect } from "react";

const API = "https://absensi-backend-production-7b1d.up.railway.app/api";
const KAMPUS = { lat: -8.495774, lng: 119.906692, nama: "Politeknik eLBajo Commodus" };
const RADIUS_METER = 100;

function hitungJarak(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function parseJam(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.replace(/\s/g,"").split("-");
  if (parts.length < 2) return null;
  const [h1,m1] = parts[0].split(":").map(Number);
  const [h2,m2] = parts[1].split(":").map(Number);
  if (isNaN(h1)||isNaN(m1)||isNaN(h2)||isNaN(m2)) return null;
  return { mulai: h1*60+m1, selesai: h2*60+m2 };
}

function cekJamAbsen(timeStr) {
  const jam = parseJam(timeStr);
  if (!jam) return { boleh: true, pesan: "" };
  const now = new Date();
  const menit = now.getHours()*60+now.getMinutes();
  if (menit < jam.mulai) {
    const s = jam.mulai-menit;
    return { boleh: false, pesan: `Belum waktunya! Mulai jam ${timeStr.split("-")[0].trim()}. ${Math.floor(s/60)>0?Math.floor(s/60)+"j ":""}${s%60}m lagi.` };
  }
  if (menit > jam.selesai) return { boleh: false, pesan: `Waktu absen habis! Berakhir jam ${timeStr.split("-").pop().trim()}.` };
  return { boleh: true, pesan: "" };
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function exportPDF(data, courses) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const now = new Date();
  const tgl = now.toLocaleDateString("id-ID", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  doc.setFillColor(29,78,216); doc.rect(0,0,297,32,"F");
  doc.setTextColor(255,255,255);
  doc.setFontSize(18); doc.setFont("helvetica","bold");
  doc.text("LAPORAN ABSENSI MAHASISWA", 148, 13, { align:"center" });
  doc.setFontSize(11); doc.setFont("helvetica","normal");
  doc.text("Politeknik eLBajo Commodus", 148, 21, { align:"center" });
  doc.text(`Dicetak: ${tgl}`, 148, 28, { align:"center" });
  doc.setTextColor(30,41,59); doc.setFontSize(10);
  doc.text(`Total Mahasiswa: ${[...new Set(data.map(d=>d.nim))].length}  |  Total Absensi: ${data.length}  |  Hadir: ${data.filter(d=>d.status==="hadir").length}  |  Izin: ${data.filter(d=>d.status==="izin").length}  |  Sakit: ${data.filter(d=>d.status==="sakit").length}`, 14, 44);
  doc.autoTable({
    startY: 50,
    head: [["No","Nama Mahasiswa","NIM","Mata Kuliah","Tanggal","Jam Masuk","Jam Pulang","Lokasi","Status"]],
    body: data.map((a,i) => [i+1, a.mahasiswa_name||"-", a.nim||"-", a.matkul_name||"-", a.date?new Date(a.date).toLocaleDateString("id-ID"):"-", a.time||"-", a.pulang_time||"-", a.latitude?`${parseFloat(a.latitude).toFixed(4)}, ${parseFloat(a.longitude).toFixed(4)}`:"Tidak tersedia", (a.status||"alpha").toUpperCase()]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [29,78,216], textColor: 255, fontStyle: "bold", halign:"center" },
    alternateRowStyles: { fillColor: [248,250,255] },
    columnStyles: { 0:{halign:"center",cellWidth:10}, 4:{halign:"center"}, 5:{halign:"center"}, 6:{halign:"center"}, 8:{halign:"center",fontStyle:"bold"} },
  });
  const pc = doc.internal.getNumberOfPages();
  for (let i=1;i<=pc;i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(100,116,139); doc.text(`Halaman ${i} dari ${pc}  |  AbsensiKu - Politeknik eLBajo Commodus`, 148, 208, { align:"center" }); }
  doc.save(`Laporan_Absensi_${now.toISOString().split("T")[0]}.pdf`);
}

async function exportExcel(data) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  const XLSX = window.XLSX;
  const now = new Date();
  const rows = [
    ["LAPORAN ABSENSI MAHASISWA - POLITEKNIK ELBAJO COMMODUS"],
    [`Dicetak: ${now.toLocaleDateString("id-ID",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}`],
    [],
    ["No","Nama Mahasiswa","NIM","Mata Kuliah","Tanggal","Jam Masuk","Jam Pulang","Latitude","Longitude","Status"],
    ...data.map((a,i) => [i+1, a.mahasiswa_name||"-", a.nim||"-", a.matkul_name||"-", a.date?new Date(a.date).toLocaleDateString("id-ID"):"-", a.time||"-", a.pulang_time||"-", a.latitude?parseFloat(a.latitude).toFixed(6):"-", a.longitude?parseFloat(a.longitude).toFixed(6):"-", (a.status||"alpha").toUpperCase()]),
    [], ["RINGKASAN"], ["Total",data.length], ["Hadir",data.filter(d=>d.status==="hadir").length], ["Izin",data.filter(d=>d.status==="izin").length], ["Sakit",data.filter(d=>d.status==="sakit").length], ["Alpha",data.filter(d=>!d.status||d.status==="alpha").length],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{wch:5},{wch:25},{wch:15},{wch:25},{wch:15},{wch:12},{wch:12},{wch:15},{wch:15},{wch:10}];
  ws["!merges"] = [{s:{r:0,c:0},e:{r:0,c:9}},{s:{r:1,c:0},e:{r:1,c:9}}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Laporan Absensi");
  XLSX.writeFile(wb, `Laporan_Absensi_${now.toISOString().split("T")[0]}.xlsx`);
}

const api = {
  post: async (p,b,t)=>(await fetch(API+p,{method:"POST",headers:{"Content-Type":"application/json",...(t&&{Authorization:`Bearer ${t}`})},body:JSON.stringify(b)})).json(),
  get: async (p,t)=>(await fetch(API+p,{headers:{Authorization:`Bearer ${t}`}})).json(),
  delete: async (p,t)=>(await fetch(API+p,{method:"DELETE",headers:{Authorization:`Bearer ${t}`}})).json(),
  postForm: async (p,f,t)=>(await fetch(API+p,{method:"POST",headers:{Authorization:`Bearer ${t}`},body:f})).json(),
};

function Badge({ status }) {
  const c={hadir:{bg:"#d1fae5",color:"#065f46",label:"Hadir"},izin:{bg:"#fef3c7",color:"#92400e",label:"Izin"},sakit:{bg:"#dbeafe",color:"#1e40af",label:"Sakit"},alpha:{bg:"#fee2e2",color:"#991b1b",label:"Alpha"},proses:{bg:"#f0f9ff",color:"#0369a1",label:"Sedang Hadir"}}[status]||{bg:"#fee2e2",color:"#991b1b",label:"Alpha"};
  return <span style={{background:c.bg,color:c.color,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600}}>{c.label}</span>;
}

function ConfirmHapus({ data, onConfirm, onCancel }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3000,padding:16}}>
      <div style={{background:"#fff",borderRadius:20,padding:28,maxWidth:340,width:"100%",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        <div style={{fontSize:48,marginBottom:12}}>🗑️</div>
        <div style={{fontWeight:800,fontSize:17,color:"#1e293b",marginBottom:8}}>Hapus Data Absensi?</div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:20,lineHeight:1.6}}>
          <b>{data.mahasiswa_name}</b> — <b>{data.matkul_name}</b><br/>
          Tanggal: <b>{data.date?new Date(data.date).toLocaleDateString("id-ID"):"-"}</b><br/>
          <span style={{color:"#ef4444",fontWeight:600}}>Tidak bisa dikembalikan!</span>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel} style={{flex:1,padding:"11px",border:"none",borderRadius:10,background:"#f0f4ff",color:"#64748b",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
          <button onClick={onConfirm} style={{flex:1,padding:"11px",border:"none",borderRadius:10,background:"#ef4444",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Ya, Hapus</button>
        </div>
      </div>
    </div>
  );
}

// ── Shared styles ────────────────────────────────────────────────────────────
const G = {
  card: { background:"#fff", borderRadius:14, padding:"14px 16px", boxShadow:"0 1px 8px rgba(0,0,0,.07)", border:"1px solid #e2e8f0", marginBottom:10 },
  input: { width:"100%", padding:"10px 13px", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:13, fontFamily:"Outfit,sans-serif", outline:"none" },
  btn: (bg,color="white") => ({ padding:"10px 18px", border:"none", borderRadius:10, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"Outfit,sans-serif", background:bg, color, display:"inline-flex", alignItems:"center", gap:5, whiteSpace:"nowrap" }),
};

function LoginPage({ onLogin }) {
  const [nim,setNim]=useState(""); const [pw,setPw]=useState(""); const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  const login = async () => {
    if (!nim||!pw) return setErr("NIM dan password harus diisi!");
    setLoading(true); setErr("");
    try {
      const r = await api.post("/auth/login",{nim,password:pw});
      if (r.token){localStorage.setItem("token",r.token);localStorage.setItem("user",JSON.stringify(r.user));onLogin(r.user,r.token);}
      else setErr(r.message||"Login gagal");
    } catch { setErr("Tidak bisa konek ke server!"); }
    setLoading(false);
  };
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#1e3a8a,#0ea5e9)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:"Outfit,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Outfit',sans-serif;}`}</style>
      <div style={{background:"#fff",borderRadius:24,padding:"36px 28px",width:"100%",maxWidth:400,boxShadow:"0 24px 64px rgba(0,0,0,.2)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:64,height:64,background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",borderRadius:20,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:14}}><span style={{fontSize:28}}>📚</span></div>
          <div style={{fontSize:26,fontWeight:900,color:"#1e293b"}}>AbsensiKu</div>
          <div style={{fontSize:13,color:"#64748b",marginTop:4}}>Politeknik eLBajo Commodus</div>
        </div>
        {err&&<div style={{background:"#fee2e2",color:"#991b1b",padding:"10px 16px",borderRadius:10,fontSize:13,marginBottom:14}}>⚠️ {err}</div>}
        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:"#1e293b",display:"block",marginBottom:6}}>NIM / Username</label>
          <input style={G.input} value={nim} onChange={e=>setNim(e.target.value)} placeholder="Masukkan NIM..." />
        </div>
        <div style={{marginBottom:22}}>
          <label style={{fontSize:13,fontWeight:600,color:"#1e293b",display:"block",marginBottom:6}}>Password</label>
          <input style={G.input} type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} placeholder="Masukkan password..." />
        </div>
        <button style={{...G.btn("linear-gradient(135deg,#1d4ed8,#0ea5e9)"),width:"100%",justifyContent:"center",padding:14,fontSize:15,opacity:loading?.6:1}} onClick={login} disabled={loading}>{loading?"Memverifikasi...":"Masuk →"}</button>
      </div>
    </div>
  );
}

function KameraModal({ onPhoto, onClose }) {
  const videoRef=useRef(null); const canvasRef=useRef(null); const [stream,setStream]=useState(null);
  useEffect(()=>{
    navigator.mediaDevices?.getUserMedia({video:{facingMode:"user"}}).then(s=>{setStream(s);if(videoRef.current)videoRef.current.srcObject=s;}).catch(()=>{});
    return()=>stream?.getTracks().forEach(t=>t.stop());
  },[]);
  const ambil=()=>{
    const c=canvasRef.current,v=videoRef.current;
    c.width=v.videoWidth||320; c.height=v.videoHeight||240;
    c.getContext("2d").drawImage(v,0,0);
    c.toBlob(blob=>{stream?.getTracks().forEach(t=>t.stop());onPhoto(c.toDataURL("image/jpeg"),blob);},"image/jpeg");
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.9)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:2000,padding:16,fontFamily:"Outfit,sans-serif"}}>
      <div style={{background:"#000",borderRadius:18,overflow:"hidden",width:"100%",maxWidth:380,marginBottom:14}}>
        <video ref={videoRef} autoPlay playsInline style={{width:"100%",display:"block"}} />
      </div>
      <canvas ref={canvasRef} style={{display:"none"}} />
      <div style={{display:"flex",gap:12}}>
        <button style={G.btn("#f0f4ff","#64748b")} onClick={onClose}>Batal</button>
        <button style={G.btn("linear-gradient(135deg,#1d4ed8,#0ea5e9)")} onClick={ambil}>📸 Ambil Foto</button>
      </div>
    </div>
  );
}

function AbsenModal({ course, tipe, token, lokasi, jarak, onClose, onSuccess }) {
  const [step,setStep]=useState("foto"); const [photo,setPhoto]=useState(null); const [blob,setBlob]=useState(null); const [err,setErr]=useState("");
  const warna=tipe==="masuk"?"#059669":"#d97706";
  const label=tipe==="masuk"?"Absen Masuk":"Absen Pulang";
  const handlePhoto=(d,b)=>{setPhoto(d);setBlob(b);setStep("confirm");};
  const submit=async()=>{
    setStep("loading");
    const cek=cekJamAbsen(course.time);
    if (!cek.boleh){setErr("⏰ "+cek.pesan);setStep("error");return;}
    const f=new FormData();
    f.append("matkul_id",course.id); f.append("tipe",tipe);
    if (lokasi){f.append("latitude",lokasi.lat);f.append("longitude",lokasi.lng);}
    if (blob) f.append("foto",blob,"selfie.jpg");
    try {
      const r=await api.postForm("/absensi/checkin",f,token);
      if (r.message?.includes("berhasil")||r.message==="Absensi berhasil!"){setStep("success");setTimeout(()=>{onSuccess();onClose();},1800);}
      else{setErr(r.message||"Gagal");setStep("error");}
    } catch{setErr("Tidak bisa konek!");setStep("error");}
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:1000,fontFamily:"Outfit,sans-serif"}}>
      <div style={{background:"#fff",borderRadius:"24px 24px 0 0",padding:22,width:"100%",maxWidth:500,maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div><div style={{fontWeight:700,fontSize:15,color:"#1e293b"}}>{tipe==="masuk"?"🟢":"🔴"} {label}</div><div style={{fontSize:12,color:"#64748b"}}>{course.name} • {course.time}</div></div>
          <button onClick={onClose} style={{border:"none",background:"#f0f4ff",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:18}}>✕</button>
        </div>
        <div style={{background:"#f0fdf4",borderRadius:10,padding:"8px 14px",marginBottom:14,fontSize:13,color:"#065f46",fontWeight:600}}>✅ {Math.round(jarak)}m dari kampus</div>
        {step==="foto"&&<KameraModal onPhoto={handlePhoto} onClose={onClose} />}
        {step==="confirm"&&(<>
          <img src={photo} style={{width:"100%",borderRadius:14,marginBottom:12}} alt="selfie" />
          <div style={{background:"#f8faff",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#64748b"}}>
            {tipe==="masuk"?"🟢":"🔴"} {label} • 🕐 {new Date().toLocaleTimeString("id-ID")} • 📍 {Math.round(jarak)}m
          </div>
          <div style={{display:"flex",gap:10}}>
            <button style={{...G.btn("#f0f4ff","#64748b"),flex:1,justifyContent:"center"}} onClick={()=>setStep("foto")}>📷 Ulangi</button>
            <button style={{...G.btn(warna),flex:2,justifyContent:"center"}} onClick={submit}>✓ Konfirmasi</button>
          </div>
        </>)}
        {step==="loading"&&<div style={{textAlign:"center",padding:28}}><div style={{fontSize:44,marginBottom:10,animation:"pulse 1.5s infinite"}}>⏳</div><div style={{fontWeight:600}}>Menyimpan...</div></div>}
        {step==="success"&&<div style={{textAlign:"center",padding:24}}><div style={{fontSize:64,marginBottom:12}}>{tipe==="masuk"?"✅":"👋"}</div><div style={{fontWeight:800,fontSize:20,color:"#10b981"}}>{label} Berhasil!</div></div>}
        {step==="error"&&<div style={{textAlign:"center",padding:22}}><div style={{fontSize:44,marginBottom:10}}>❌</div><div style={{fontWeight:700,color:"#991b1b",fontSize:14}}>{err}</div><button style={{...G.btn("#f0f4ff","#64748b"),marginTop:14,width:"100%",justifyContent:"center"}} onClick={onClose}>Tutup</button></div>}
      </div>
    </div>
  );
}

// ── Mahasiswa Dashboard ──────────────────────────────────────────────────────
function MahasiswaDashboard({ user, token, onLogout }) {
  const [tab,setTab]=useState("home"); const [courses,setCourses]=useState([]); const [riwayat,setRiwayat]=useState([]);
  const [modal,setModal]=useState(null); const [toast,setToast]=useState({msg:"",type:"success"});
  const [lokasi,setLokasi]=useState(null); const [jarak,setJarak]=useState(null); const [jam,setJam]=useState(new Date());

  useEffect(()=>{
    api.get("/matkul",token).then(d=>setCourses(Array.isArray(d)?d:[]));
    api.get("/absensi/riwayat",token).then(d=>setRiwayat(Array.isArray(d)?d:[]));
    navigator.geolocation?.watchPosition(pos=>{setLokasi({lat:pos.coords.latitude,lng:pos.coords.longitude});setJarak(hitungJarak(pos.coords.latitude,pos.coords.longitude,KAMPUS.lat,KAMPUS.lng));},()=>{},{enableHighAccuracy:true});
    const t=setInterval(()=>setJam(new Date()),1000);
    return()=>clearInterval(t);
  },[]);

  const hadir=riwayat.filter(a=>a.status==="hadir").length;
  const izin=riwayat.filter(a=>a.status==="izin").length;
  const sakit=riwayat.filter(a=>a.status==="sakit").length;
  const alpha=riwayat.length-hadir-izin-sakit;
  const pct=riwayat.length>0?Math.round(hadir/riwayat.length*100):0;
  const dalamRadius=jarak!==null&&jarak<=RADIUS_METER;
  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast({msg:"",type:"success"}),3000);};
  const refreshRiwayat=()=>api.get("/absensi/riwayat",token).then(d=>setRiwayat(Array.isArray(d)?d:[]));
  const today=new Date().toISOString().split("T")[0];
  const getStatus=(id)=>{
    const a=riwayat.filter(x=>x.matkul_id===id&&x.date===today);
    return{sudahMasuk:a.find(x=>x.tipe==="masuk"||!x.tipe),sudahPulang:a.find(x=>x.tipe==="pulang")};
  };

  return (
    <div style={{maxWidth:480,margin:"0 auto",minHeight:"100vh",background:"#f0f4ff",fontFamily:"Outfit,sans-serif",position:"relative"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Outfit',sans-serif;background:#f0f4ff;}@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}`}</style>

      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",padding:"22px 18px 58px",color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div>
            <div style={{fontSize:12,opacity:.8,marginBottom:2}}>Selamat datang 👋</div>
            <div style={{fontSize:20,fontWeight:800}}>{user.name}</div>
            <div style={{fontSize:11,opacity:.7,marginTop:2}}>{user.prodi} • Sem {user.semester}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:22,fontWeight:900}}>{jam.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</div>
            <div style={{fontSize:11,opacity:.7}}>{jam.toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short"})}</div>
            <button onClick={onLogout} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,padding:"3px 10px",color:"#fff",cursor:"pointer",fontSize:11,fontFamily:"inherit",marginTop:4}}>Keluar</button>
          </div>
        </div>
        <div style={{background:"rgba(255,255,255,.15)",borderRadius:12,padding:"9px 13px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>{jarak===null?"📍":dalamRadius?"🏫":"⚠️"}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:600}}>{jarak===null?"Mendeteksi lokasi...":dalamRadius?"Di dalam area kampus":"Di luar area kampus"}</div>
            {jarak!==null&&<div style={{fontSize:10,opacity:.8}}>Jarak: {Math.round(jarak)}m • Batas: {RADIUS_METER}m</div>}
          </div>
          {jarak!==null&&<span style={{background:dalamRadius?"#10b981":"#ef4444",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700}}>{dalamRadius?"✅":"❌"}</span>}
        </div>
      </div>

      <div style={{padding:"0 14px",marginTop:-38,paddingBottom:90}}>
        {tab==="home"&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
              {[{l:"Hadir",v:hadir,c:"#10b981"},{l:"Izin",v:izin,c:"#f59e0b"},{l:"Sakit",v:sakit,c:"#3b82f6"},{l:"Nilai",v:pct+"%",c:pct>=75?"#10b981":"#ef4444"}].map((s,i)=>(
                <div key={i} style={{background:"#fff",borderRadius:12,padding:"10px 4px",textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,.08)"}}>
                  <div style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</div>
                  <div style={{fontSize:10,color:"#64748b",marginTop:2}}>{s.l}</div>
                </div>
              ))}
            </div>
            {lokasi&&(
              <div style={{marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:6}}>📍 Posisi Kamu</div>
                <div style={{borderRadius:12,overflow:"hidden",border:`3px solid ${dalamRadius?"#10b981":"#ef4444"}`}}>
                  <iframe src={`https://www.openstreetmap.org/export/embed.html?bbox=${KAMPUS.lng-.004},${KAMPUS.lat-.004},${KAMPUS.lng+.004},${KAMPUS.lat+.004}&layer=mapnik&marker=${KAMPUS.lat},${KAMPUS.lng}`} width="100%" height="150" style={{border:"none",display:"block"}} title="Peta" />
                </div>
                <div style={{marginTop:6,padding:"9px 13px",background:dalamRadius?"#f0fdf4":"#fef2f2",borderRadius:10,fontSize:12,fontWeight:600,color:dalamRadius?"#065f46":"#991b1b"}}>
                  {dalamRadius?"🎯 Kamu dalam area kampus — bisa absen!":"⚠️ Di luar area kampus — tidak bisa absen"}
                </div>
              </div>
            )}
            <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:8}}>📚 Mata Kuliah</div>
            {courses.length===0&&<div style={{...G.card,textAlign:"center",color:"#64748b",fontSize:13}}>Belum ada mata kuliah</div>}
            {courses.map(c=>{
              const{sudahMasuk,sudahPulang}=getStatus(c.id);
              const jamOk=cekJamAbsen(c.time); const j2=parseJam(c.time);
              const mNow=new Date().getHours()*60+new Date().getMinutes();
              const berlangsung=j2&&mNow>=j2.mulai&&mNow<=j2.selesai;
              return(
                <div key={c.id} style={G.card}>
                  <div style={{marginBottom:10}}>
                    <div style={{fontWeight:700,color:"#1e293b",fontSize:14}}>{c.name}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{c.code} • {c.room}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:2,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                      ⏰ {c.time}
                      <span style={{background:berlangsung?"#d1fae5":"#fee2e2",color:berlangsung?"#065f46":"#991b1b",padding:"1px 7px",borderRadius:20,fontSize:10,fontWeight:600}}>
                        {berlangsung?"🟢 Berlangsung":"🔴 Di luar jam"}
                      </span>
                    </div>
                    {!jamOk.boleh&&<div style={{fontSize:10,color:"#ef4444",marginTop:3}}>⚠️ {jamOk.pesan}</div>}
                  </div>
                  <div style={{display:"flex",gap:7}}>
                    {sudahMasuk?(
                      <div style={{flex:1,background:"#f0fdf4",borderRadius:9,padding:"7px 10px",textAlign:"center",border:"1.5px solid #10b981"}}>
                        <div style={{fontSize:10,color:"#065f46",fontWeight:600}}>✅ Masuk</div>
                        <div style={{fontSize:11,color:"#64748b",fontWeight:700}}>{sudahMasuk.time}</div>
                      </div>
                    ):(
                      <button style={{...G.btn("linear-gradient(135deg,#059669,#10b981)"),flex:1,justifyContent:"center",fontSize:12,padding:"9px 4px",opacity:(jamOk.boleh&&dalamRadius)?1:.4}} disabled={!jamOk.boleh||!dalamRadius} onClick={()=>setModal({course:c,tipe:"masuk"})}>🟢 Masuk</button>
                    )}
                    {sudahPulang?(
                      <div style={{flex:1,background:"#fff7ed",borderRadius:9,padding:"7px 10px",textAlign:"center",border:"1.5px solid #f59e0b"}}>
                        <div style={{fontSize:10,color:"#92400e",fontWeight:600}}>🔴 Pulang</div>
                        <div style={{fontSize:11,color:"#64748b",fontWeight:700}}>{sudahPulang.time}</div>
                      </div>
                    ):sudahMasuk?(
                      <button style={{...G.btn("linear-gradient(135deg,#d97706,#f59e0b)"),flex:1,justifyContent:"center",fontSize:12,padding:"9px 4px",opacity:(jamOk.boleh&&dalamRadius)?1:.4}} disabled={!jamOk.boleh||!dalamRadius} onClick={()=>setModal({course:c,tipe:"pulang"})}>🔴 Pulang</button>
                    ):(
                      <div style={{flex:1,background:"#f8faff",borderRadius:9,padding:"7px 10px",textAlign:"center",border:"1.5px solid #e2e8f0"}}>
                        <div style={{fontSize:10,color:"#94a3b8"}}>Masuk dulu</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab==="log"&&(
          <>
            <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:8,marginTop:4}}>📋 Log Absensi</div>
            <div style={{...G.card,marginBottom:12}}>
              <div style={{fontWeight:600,marginBottom:8,fontSize:13}}>📊 Rekap Kehadiran</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
                {[{l:"Hadir",v:hadir,c:"#10b981"},{l:"Izin",v:izin,c:"#f59e0b"},{l:"Sakit",v:sakit,c:"#3b82f6"},{l:"Alpha",v:alpha,c:"#ef4444"}].map((s,i)=>(
                  <div key={i} style={{background:"#f8faff",borderRadius:10,padding:"8px 4px",textAlign:"center"}}>
                    <div style={{fontWeight:800,fontSize:16,color:s.c}}>{s.v}</div>
                    <div style={{fontSize:10,color:"#64748b"}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#64748b",marginBottom:3}}><span>Kehadiran</span><span style={{fontWeight:700,color:pct>=75?"#10b981":"#ef4444"}}>{pct}%</span></div>
              <div style={{background:"#f0f4ff",borderRadius:20,height:7,overflow:"hidden"}}>
                <div style={{width:pct+"%",height:"100%",background:pct>=75?"#10b981":"#ef4444",borderRadius:20}} />
              </div>
              {pct<75&&<div style={{fontSize:10,color:"#ef4444",marginTop:5}}>⚠️ Kehadiran di bawah 75%!</div>}
            </div>
            {riwayat.length===0&&<div style={{...G.card,textAlign:"center",color:"#64748b",fontSize:13}}>Belum ada riwayat</div>}
            {riwayat.map((a,i)=>(
              <div key={i} style={{...G.card,padding:"12px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,color:"#1e293b",fontSize:13}}>{a.matkul_name}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:2}}>📅 {a.date}</div>
                    <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                      <div style={{background:"#f0fdf4",borderRadius:9,padding:"5px 10px",border:"1px solid #bbf7d0"}}>
                        <div style={{fontSize:10,color:"#065f46",fontWeight:600}}>🟢 Masuk</div>
                        <div style={{fontSize:12,fontWeight:700}}>{a.time||"-"}</div>
                      </div>
                      <div style={{background:a.pulang_time?"#fff7ed":"#f8faff",borderRadius:9,padding:"5px 10px",border:`1px solid ${a.pulang_time?"#fed7aa":"#e2e8f0"}`}}>
                        <div style={{fontSize:10,color:a.pulang_time?"#92400e":"#94a3b8",fontWeight:600}}>🔴 Pulang</div>
                        <div style={{fontSize:12,fontWeight:700,color:a.pulang_time?"#1e293b":"#cbd5e1"}}>{a.pulang_time||"Belum"}</div>
                      </div>
                    </div>
                  </div>
                  <Badge status={a.status} />
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"#fff",borderTop:"1px solid #e2e8f0",padding:"6px 14px 12px",zIndex:50}}>
        <div style={{display:"flex",background:"#f0f4ff",borderRadius:12,padding:4,gap:4}}>
          {[{k:"home",l:"🏠 Beranda"},{k:"log",l:"📋 Log Absensi"}].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{flex:1,padding:"10px 0",border:"none",cursor:"pointer",borderRadius:10,fontFamily:"Outfit,sans-serif",fontSize:12,fontWeight:tab===t.k?700:500,color:tab===t.k?"#1d4ed8":"#64748b",background:tab===t.k?"#fff":"transparent"}}>{t.l}</button>
          ))}
        </div>
      </div>

      {toast.msg&&<div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:toast.type==="success"?"#10b981":"#ef4444",color:"#fff",padding:"11px 24px",borderRadius:30,fontWeight:700,fontSize:13,zIndex:9999,whiteSpace:"nowrap"}}>{toast.msg}</div>}
      {modal&&lokasi&&<AbsenModal course={modal.course} tipe={modal.tipe} token={token} lokasi={lokasi} jarak={jarak} onClose={()=>setModal(null)} onSuccess={()=>{refreshRiwayat();showToast(`✅ ${modal.tipe==="masuk"?"Absen masuk":"Absen pulang"} berhasil!`);}} />}
      {modal&&!lokasi&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
          <div style={{background:"#fff",borderRadius:18,padding:24,maxWidth:300,textAlign:"center",fontFamily:"Outfit,sans-serif"}}>
            <div style={{fontSize:44,marginBottom:10}}>📍</div>
            <div style={{fontWeight:700,color:"#991b1b"}}>GPS Tidak Aktif!</div>
            <button style={{...G.btn("#f0f4ff","#64748b"),marginTop:14,width:"100%",justifyContent:"center"}} onClick={()=>setModal(null)}>Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard({ user, token, onLogout }) {
  const [tab,setTab]=useState("overview");
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [laporan,setLaporan]=useState([]); const [absensi,setAbsensi]=useState([]); const [courses,setCourses]=useState([]);
  const [nm,setNm]=useState({name:"",code:"",day:"",time:"",room:""});
  const [loadingAdd,setLoadingAdd]=useState(false); const [loadingExport,setLoadingExport]=useState("");
  const [hapusData,setHapusData]=useState(null); const [toast,setToast]=useState({msg:"",type:"success"});
  const [filter,setFilter]=useState("");
  const [isMobile,setIsMobile]=useState(window.innerWidth<=768);

  useEffect(()=>{
    api.get("/laporan/semua",token).then(d=>setLaporan(Array.isArray(d)?d:[]));
    api.get("/absensi/semua",token).then(d=>setAbsensi(Array.isArray(d)?d:[]));
    api.get("/matkul",token).then(d=>setCourses(Array.isArray(d)?d:[]));
    const handleResize=()=>setIsMobile(window.innerWidth<=768);
    window.addEventListener("resize",handleResize);
    return()=>window.removeEventListener("resize",handleResize);
  },[]);

  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast({msg:"",type:"success"}),3000);};
  const tambah=async()=>{
    if (!nm.name||!nm.code) return alert("Nama dan kode wajib diisi!");
    setLoadingAdd(true);
    const r=await api.post("/matkul",{...nm,dosen_id:user.id},token);
    if (r.id){setCourses(p=>[...p,r]);setNm({name:"",code:"",day:"",time:"",room:""});showToast("✅ Mata kuliah ditambahkan!");}
    else showToast(r.message,"error");
    setLoadingAdd(false);
  };
  const hapusAbsensi=async()=>{
    if (!hapusData) return;
    try {
      const r=await api.delete(`/absensi/${hapusData.id}`,token);
      if (r.success||r.message?.includes("berhasil")){setAbsensi(p=>p.filter(a=>a.id!==hapusData.id));showToast("🗑️ Data berhasil dihapus!");}
      else showToast(r.message||"Gagal","error");
    } catch{showToast("Gagal menghapus","error");}
    setHapusData(null);
  };
  const handleExportPDF=async()=>{setLoadingExport("pdf");try{await exportPDF(absensi,courses);showToast("✅ PDF didownload!");}catch{showToast("Gagal export PDF","error");}setLoadingExport("");};
  const handleExportExcel=async()=>{setLoadingExport("excel");try{await exportExcel(absensi);showToast("✅ Excel didownload!");}catch{showToast("Gagal export Excel","error");}setLoadingExport("");};
  const absensiFiltered=filter?absensi.filter(a=>a.mahasiswa_name?.toLowerCase().includes(filter.toLowerCase())||a.nim?.includes(filter)||a.matkul_name?.toLowerCase().includes(filter.toLowerCase())):absensi;

  const navItems=[{k:"overview",i:"🏠",l:"Overview"},{k:"matkul",i:"📚",l:"Matkul"},{k:"mahasiswa",i:"👥",l:"Mahasiswa"},{k:"laporan",i:"📊",l:"Laporan"}];
  const setT=k=>{setTab(k);setSidebarOpen(false);};

  const mainContent = (
    <div style={{padding:isMobile?"12px 14px":"24px",paddingBottom:isMobile?90:24,minHeight:"100vh",background:"#f0f4ff",fontFamily:"Outfit,sans-serif",width:"100%"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Outfit',sans-serif;background:#f0f4ff;}`}</style>

      {/* Top bar */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        {isMobile&&(
          <button onClick={()=>setSidebarOpen(true)} style={{background:"#1d4ed8",border:"none",borderRadius:10,padding:"8px 11px",cursor:"pointer",fontSize:18,color:"#fff",flexShrink:0}}>☰</button>
        )}
        <div>
          <div style={{fontSize:isMobile?18:22,fontWeight:800,color:"#1e293b"}}>{navItems.find(n=>n.k===tab)?.i} {navItems.find(n=>n.k===tab)?.l}</div>
          <div style={{fontSize:12,color:"#64748b",marginTop:2}}>Halo, {user.name}</div>
        </div>
      </div>

      {tab==="overview"&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(3,1fr)",gap:12,marginBottom:18}}>
            {[{l:"Mahasiswa",v:laporan.length,c:"#1d4ed8"},{l:"Mata Kuliah",v:courses.length,c:"#0ea5e9"},{l:"Total Absensi",v:absensi.length,c:"#10b981"}].map((s,i)=>(
              <div key={i} style={{background:"#fff",borderRadius:14,padding:"16px",boxShadow:"0 2px 10px rgba(0,0,0,.06)",border:"1px solid #e2e8f0"}}>
                <div style={{fontSize:isMobile?24:28,fontWeight:900,color:s.c}}>{s.v}</div>
                <div style={{fontSize:12,color:"#64748b",marginTop:4}}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={G.card}>
            <div style={{fontWeight:700,marginBottom:10,color:"#1e293b",fontSize:14}}>⚙️ Pengaturan Sistem</div>
            <div style={{fontSize:13,color:"#64748b",lineHeight:2}}>
              🏫 <b>{KAMPUS.nama}</b><br/>
              📏 Radius: <b style={{color:"#10b981"}}>{RADIUS_METER} meter</b><br/>
              ⏰ Jam: <b style={{color:"#1d4ed8"}}>Sesuai jam matkul</b><br/>
              📸 <b>Selfie + GPS + Absen Masuk & Pulang</b>
            </div>
          </div>
        </>
      )}

      {tab==="matkul"&&(
        <>
          <div style={{...G.card,marginBottom:16}}>
            <div style={{fontWeight:700,marginBottom:12,color:"#1e293b",fontSize:14}}>➕ Tambah Mata Kuliah</div>
            <div style={{fontSize:12,color:"#0ea5e9",marginBottom:10,background:"#f0f9ff",padding:"7px 11px",borderRadius:8}}>💡 Format jam: <b>08:00-12:00</b></div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,1fr)",gap:10}}>
              {[{k:"name",l:"Nama Matkul",p:"Pemrograman Web"},{k:"code",l:"Kode",p:"TI301"},{k:"day",l:"Hari",p:"Senin"},{k:"time",l:"Jam",p:"08:00-12:00"},{k:"room",l:"Ruangan",p:"Lab A"}].map(f=>(
                <div key={f.k}>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>{f.l}</label>
                  <input style={G.input} value={nm[f.k]} onChange={e=>setNm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.p} />
                </div>
              ))}
            </div>
            <button style={{...G.btn("linear-gradient(135deg,#1d4ed8,#0ea5e9)"),marginTop:14,opacity:loadingAdd?.6:1}} onClick={tambah} disabled={loadingAdd}>{loadingAdd?"Menyimpan...":"✓ Tambah Matkul"}</button>
          </div>
          {courses.length===0&&<div style={{...G.card,textAlign:"center",color:"#64748b"}}>Belum ada mata kuliah</div>}
          {courses.map(c=>(
            <div key={c.id} style={G.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div><div style={{fontWeight:700,color:"#1e293b",fontSize:14}}>{c.name}</div><div style={{fontSize:12,color:"#64748b",marginTop:3}}>{c.code} • {c.day} • {c.room}</div></div>
                <div style={{fontWeight:700,color:"#1d4ed8",fontSize:13}}>⏰ {c.time}</div>
              </div>
            </div>
          ))}
        </>
      )}

      {tab==="mahasiswa"&&(
        <>
          {laporan.length===0&&<div style={{...G.card,textAlign:"center",color:"#64748b"}}>Belum ada data</div>}
          {laporan.map(m=>(
            <div key={m.id} style={G.card}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#1d4ed8,#0ea5e9)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:17,flexShrink:0}}>{m.name?.[0]}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,color:"#1e293b",fontSize:14}}>{m.name}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{m.nim} • {m.prodi}</div>
                  <div style={{marginTop:7,background:"#f0f4ff",borderRadius:20,height:6,overflow:"hidden"}}>
                    <div style={{width:(m.persentase||0)+"%",height:"100%",background:m.persentase>=75?"#10b981":"#ef4444",borderRadius:20}} />
                  </div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:2}}>Kehadiran: {m.persentase||0}%</div>
                </div>
                <div style={{fontWeight:800,fontSize:18,color:m.persentase>=75?"#10b981":"#ef4444",flexShrink:0}}>{m.persentase||0}%</div>
              </div>
            </div>
          ))}
        </>
      )}

      {tab==="laporan"&&(
        <>
          {/* Export buttons */}
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button style={{...G.btn("linear-gradient(135deg,#dc2626,#ef4444)"),flex:1,justifyContent:"center"}} onClick={handleExportPDF} disabled={loadingExport==="pdf"}>
                {loadingExport==="pdf"?"⏳ Exporting...":"📄 Export PDF"}
              </button>
              <button style={{...G.btn("linear-gradient(135deg,#15803d,#22c55e)"),flex:1,justifyContent:"center"}} onClick={handleExportExcel} disabled={loadingExport==="excel"}>
                {loadingExport==="excel"?"⏳ Exporting...":"📊 Export Excel"}
              </button>
            </div>
            <input style={{...G.input}} placeholder="🔍 Cari nama / NIM / mata kuliah..." value={filter} onChange={e=>setFilter(e.target.value)} />
          </div>
          <div style={{fontSize:12,color:"#64748b",marginBottom:8}}>Total: <b>{absensiFiltered.length}</b> data</div>
          <div style={{overflowX:"auto",borderRadius:14,boxShadow:"0 2px 12px rgba(0,0,0,.06)",WebkitOverflowScrolling:"touch"}}>
            <table style={{width:"100%",borderCollapse:"collapse",background:"#fff",minWidth:700}}>
              <thead>
                <tr>{["No","Nama","NIM","Mata Kuliah","Tanggal","🟢 Masuk","🔴 Pulang","Lokasi","Status","Hapus"].map(h=><th key={h} style={{padding:"11px 10px",textAlign:"left",fontSize:11,fontWeight:700,background:"#1d4ed8",color:"#fff",whiteSpace:"nowrap"}}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {absensiFiltered.length===0&&<tr><td colSpan={10} style={{textAlign:"center",color:"#64748b",padding:28,fontSize:13}}>Belum ada data absensi</td></tr>}
                {absensiFiltered.map((a,i)=>(
                  <tr key={a.id||i} style={{background:i%2===0?"#fff":"#f8faff"}}>
                    <td style={{padding:"10px 10px",fontSize:11,color:"#94a3b8",textAlign:"center"}}>{i+1}</td>
                    <td style={{padding:"10px 10px",fontSize:11,fontWeight:600,color:"#1e293b"}}>{a.mahasiswa_name}</td>
                    <td style={{padding:"10px 10px",fontSize:11,color:"#64748b"}}>{a.nim}</td>
                    <td style={{padding:"10px 10px",fontSize:11,color:"#64748b"}}>{a.matkul_name}</td>
                    <td style={{padding:"10px 10px",fontSize:11,color:"#64748b",whiteSpace:"nowrap"}}>{a.date?new Date(a.date).toLocaleDateString("id-ID"):"-"}</td>
                    <td style={{padding:"10px 10px",fontSize:11}}><span style={{color:"#065f46",fontWeight:700}}>🟢 {a.time||"-"}</span></td>
                    <td style={{padding:"10px 10px",fontSize:11}}><span style={{color:"#92400e",fontWeight:700}}>🔴 {a.pulang_time||"-"}</span></td>
                    <td style={{padding:"10px 10px",fontSize:10,color:"#64748b"}}>{a.latitude?`📍${parseFloat(a.latitude).toFixed(3)}`:"-"}</td>
                    <td style={{padding:"10px 10px"}}><Badge status={a.pulang_time ? a.status : "proses"} /></td>
                    <td style={{padding:"10px 10px"}}>
                      <button onClick={()=>setHapusData(a)} style={{padding:"5px 10px",border:"none",borderRadius:8,background:"#ef4444",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div style={{fontFamily:"Outfit,sans-serif",background:"#f0f4ff",minHeight:"100vh"}}>
      {/* Overlay mobile */}
      {isMobile&&sidebarOpen&&(
        <div onClick={()=>setSidebarOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:199}} />
      )}

      {/* Sidebar */}
      <div style={{
        width:220, background:"linear-gradient(160deg,#1e3a8a,#1d4ed8)",
        padding:"20px 14px", display:"flex", flexDirection:"column", gap:4,
        position:"fixed", left:0, top:0, bottom:0, zIndex:200,
        transition:"transform .3s",
        transform: isMobile ? (sidebarOpen?"translateX(0)":"translateX(-100%)") : "translateX(0)",
        overflowY:"auto",
      }}>
        <div style={{color:"#fff",fontWeight:900,fontSize:17,marginBottom:22,paddingLeft:4}}>
          AbsensiKu
          <div style={{fontSize:11,fontWeight:400,opacity:.6,marginTop:2}}>Panel Admin</div>
        </div>
        {navItems.map(n=>(
          <button key={n.k} onClick={()=>setT(n.k)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",background:tab===n.k?"rgba(255,255,255,.2)":"transparent",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:tab===n.k?700:400,width:"100%",textAlign:"left"}}>
            <span style={{fontSize:17}}>{n.i}</span>{n.l}
          </button>
        ))}
        <div style={{flex:1}} />
        <button onClick={onLogout} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",background:"transparent",color:"rgba(255,255,255,.6)",cursor:"pointer",fontFamily:"inherit",fontSize:13,width:"100%",textAlign:"left"}}>
          <span>🚪</span>Keluar
        </button>
      </div>

      {/* Main — full width on mobile, with left margin on desktop */}
      <div style={{marginLeft:isMobile?0:220,minHeight:"100vh",background:"#f0f4ff"}}>
        {mainContent}
      </div>

      {/* Bottom Nav MOBILE ONLY */}
      {isMobile&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:"2px solid #e2e8f0",zIndex:300,padding:"6px 0 10px"}}>
          <div style={{display:"flex",justifyContent:"space-around"}}>
            {[...navItems,{k:"__logout",i:"🚪",l:"Keluar"}].map(n=>(
              <button key={n.k} onClick={()=>n.k==="__logout"?onLogout():setT(n.k)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"5px 8px",border:"none",background:"transparent",cursor:"pointer",fontFamily:"inherit",fontSize:10,color:tab===n.k?"#1d4ed8":"#64748b",minWidth:54}}>
                <div style={{fontSize:20,padding:"3px 7px",borderRadius:9,background:tab===n.k?"#eff6ff":"transparent"}}>{n.i}</div>
                <span style={{fontWeight:tab===n.k?700:400}}>{n.l}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {toast.msg&&<div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:toast.type==="success"?"#10b981":"#ef4444",color:"#fff",padding:"11px 24px",borderRadius:30,fontWeight:700,fontSize:13,zIndex:9999,whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(0,0,0,.2)"}}>{toast.msg}</div>}
      {hapusData&&<ConfirmHapus data={hapusData} onConfirm={hapusAbsensi} onCancel={()=>setHapusData(null)} />}
    </div>
  );
}

export default function App() {
  const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem("user"));}catch{return null;}});
  const [token,setToken]=useState(()=>localStorage.getItem("token")||null);

  // ── Auto-refresh data user dari server supaya prodi/semester selalu terbaru ──
  useEffect(()=>{
    const savedToken=localStorage.getItem("token");
    if (!savedToken) return;
    fetch(API+"/auth/me",{headers:{Authorization:`Bearer ${savedToken}`}})
      .then(r=>r.json())
      .then(freshUser=>{
        if (freshUser.id){
          localStorage.setItem("user",JSON.stringify(freshUser));
          setUser(freshUser);
        }
      })
      .catch(()=>{});
  },[]);

  const login=(u,t)=>{localStorage.setItem("token",t);localStorage.setItem("user",JSON.stringify(u));setUser(u);setToken(t);};
  const logout=()=>{localStorage.removeItem("token");localStorage.removeItem("user");setUser(null);setToken(null);};
  if (!user) return <LoginPage onLogin={login} />;
  if (user.role==="admin") return <AdminDashboard user={user} token={token} onLogout={logout} />;
  return <MahasiswaDashboard user={user} token={token} onLogout={logout} />;
}
