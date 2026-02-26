import { useState, useRef, useEffect } from "react";

const API = "https://absensi-backend-production-7b1d.up.railway.app/api";
const KAMPUS = { lat: -8.4539, lng: 119.8851, nama: "Politeknik eLBajo Commodus" };
const RADIUS_METER = 100;

// --- UTILS ---
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
  return { mulai: h1*60+m1, selesai: h2*60+m2 };
}

function cekJamAbsen(timeStr) {
  const jam = parseJam(timeStr);
  if (!jam) return { boleh: true, pesan: "" };
  const now = new Date();
  const menit = now.getHours()*60+now.getMinutes();
  if (menit < jam.mulai) return { boleh: false, pesan: `Belum waktunya! Kuliah jam ${timeStr.split("-")[0].trim()}` };
  if (menit > jam.selesai) return { boleh: false, pesan: `Waktu habis! Berakhir jam ${timeStr.split("-").pop().trim()}` };
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

// --- EXPORTS ---
async function exportPDF(data, courses) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.text("LAPORAN ABSENSI MAHASISWA", 14, 15);
  doc.autoTable({
    startY: 25,
    head: [["No","Nama","NIM","Matkul","Tanggal","Masuk","Pulang","Status"]],
    body: data.map((a,i) => [
      i+1, a.mahasiswa_name, a.nim, a.matkul_name,
      new Date(a.date).toLocaleDateString("id-ID"),
      a.time||"-", a.pulang_time||"-", (a.status||"alpha").toUpperCase()
    ]),
  });
  doc.save("Laporan_Absensi.pdf");
}

async function exportExcel(data) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  const ws = window.XLSX.utils.json_to_sheet(data);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, "Absensi");
  window.XLSX.writeFile(wb, "Laporan_Absensi.xlsx");
}

// --- STYLES (Optimized for Mobile) ---
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Outfit',sans-serif;background:#f8fafc;color:#1e293b;overflow-x:hidden;}
  
  .container{width:100%;max-width:1200px;margin:0 auto;padding:16px;}
  .card{background:#fff;border-radius:16px;padding:16px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);margin-bottom:16px;border:1px solid #f1f5f9;}
  
  /* Layout Admin */
  .admin-layout{display:flex;min-height:100vh;}
  .sidebar{width:260px;background:#1e3a8a;color:#fff;padding:24px;position:fixed;height:100vh;transition:0.3s;}
  .main-content{flex:1;margin-left:260px;padding:24px;width:calc(100% - 260px);}

  /* Stats Grid */
  .stats-grid{display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:12px;margin-bottom:20px;}
  .stat-item{background:#fff;padding:16px;border-radius:12px;text-align:center;box-shadow:0 2px 4px rgba(0,0,0,0.05);}

  /* Responsive Table */
  .table-container{width:100%;overflow-x:auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;}
  table{width:100%;border-collapse:collapse;min-width:600px;}
  th{background:#f1f5f9;padding:12px;text-align:left;font-size:12px;font-weight:700;}
  td{padding:12px;border-top:1px solid #f1f5f9;font-size:13px;}

  /* Mobile Bottom Nav */
  .bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e2e8f0;padding:10px;z-index:100;}
  .nav-inner{display:flex;justify-content:space-around;}
  .nav-btn{background:none;border:none;font-family:inherit;font-size:11px;color:#64748b;display:flex;flex-direction:column;align-items:center;gap:4px;}
  .nav-btn.active{color:#1d4ed8;font-weight:700;}

  /* Forms */
  .form-group{margin-bottom:12px;}
  .label{display:block;font-size:12px;font-weight:600;margin-bottom:4px;}
  .input{width:100%;padding:10px;border-radius:8px;border:1px solid #cbd5e1;font-family:inherit;}

  /* Buttons */
  .btn{padding:10px 16px;border-radius:8px;border:none;font-weight:600;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;}
  .btn-primary{background:#1d4ed8;color:#fff;}
  .btn-danger{background:#ef4444;color:#fff;}
  .btn-success{background:#10b981;color:#fff;}

  @media (max-width: 768px) {
    .sidebar{display:none;}
    .main-content{margin-left:0;width:100%;padding:16px;padding-bottom:80px;}
    .bottom-nav{display:block;}
    .stats-grid{grid-template-columns:repeat(2, 1fr);}
    .hide-mobile{display:none;}
  }
`;

const api = {
  post: async (p,b,t)=>(await fetch(API+p,{method:"POST",headers:{"Content-Type":"application/json",...(t&&{Authorization:`Bearer ${t}`})},body:JSON.stringify(b)})).json(),
  get: async (p,t)=>(await fetch(API+p,{headers:{Authorization:`Bearer ${t}`}})).json(),
  delete: async (p,t)=>(await fetch(API+p,{method:"DELETE",headers:{Authorization:`Bearer ${t}`}})).json(),
  postForm: async (p,f,t)=>(await fetch(API+p,{method:"POST",headers:{Authorization:`Bearer ${t}`},body:f})).json(),
};

// --- COMPONENTS ---
function Badge({ status }) {
  const styles = {
    hadir: { bg: "#dcfce7", text: "#166534" },
    izin: { bg: "#fef9c3", text: "#854d0e" },
    sakit: { bg: "#dbeafe", text: "#1e40af" }
  };
  const s = styles[status] || { bg: "#fee2e2", text: "#991b1b" };
  return <span style={{ background: s.bg, color: s.text, padding: "2px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: "700" }}>{status.toUpperCase()}</span>;
}

function LoginPage({ onLogin }) {
  const [nim, setNim] = useState("");
  const [pw, setPw] = useState("");
  const handle = async () => {
    const r = await api.post("/auth/login", { nim, password: pw });
    if (r.token) {
      localStorage.setItem("token", r.token);
      localStorage.setItem("user", JSON.stringify(r.user));
      onLogin(r.user, r.token);
    } else alert("Login Gagal!");
  };
  return (
    <div style={{ background: "#1e3a8a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="card" style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
        <h2 style={{ marginBottom: 20 }}>Login Absensi</h2>
        <input className="input" style={{ marginBottom: 10 }} placeholder="NIM" value={nim} onChange={e=>setNim(e.target.value)} />
        <input className="input" style={{ marginBottom: 20 }} type="password" placeholder="Password" value={pw} onChange={e=>setPw(e.target.value)} />
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={handle}>Masuk</button>
      </div>
    </div>
  );
}

function AdminDashboard({ user, token, onLogout }) {
  const [tab, setTab] = useState("laporan");
  const [absensi, setAbsensi] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/absensi/semua", token).then(d => setAbsensi(Array.isArray(d) ? d : []));
  }, []);

  return (
    <div className="admin-layout">
      <div className="sidebar">
        <h3>Admin Panel</h3>
        <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 20 }}>{user.name}</p>
        <button className="btn" style={{ color: "#fff", width: "100%", justifyContent: "flex-start" }} onClick={() => setTab("laporan")}>📊 Laporan</button>
        <button className="btn" style={{ color: "#fff", width: "100%", justifyContent: "flex-start" }} onClick={onLogout}>🚪 Keluar</button>
      </div>

      <div className="main-content">
        <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h2>{tab === "laporan" ? "Laporan Absensi" : "Dashboard"}</h2>
          <div className="hide-mobile">
            <button className="btn btn-success" onClick={() => exportExcel(absensi)} style={{ marginRight: 8 }}>Excel</button>
            <button className="btn btn-danger" onClick={() => exportPDF(absensi)}>PDF</button>
          </div>
        </header>

        <div className="stats-grid">
          <div className="stat-item">
            <div style={{ fontSize: 20, fontWeight: 800 }}>{absensi.length}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>Total Absen</div>
          </div>
          <div className="stat-item">
            <div style={{ fontSize: 20, fontWeight: 800, color: "#10b981" }}>{absensi.filter(a => a.status === "hadir").length}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>Hadir</div>
          </div>
        </div>

        {tab === "laporan" && (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama Mahasiswa</th>
                  <th className="hide-mobile">Matkul</th>
                  <th>Waktu</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {absensi.map((a, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{a.mahasiswa_name}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>{a.nim}</div>
                    </td>
                    <td className="hide-mobile">{a.matkul_name}</td>
                    <td>{a.time}</td>
                    <td><Badge status={a.status || "hadir"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bottom-nav">
        <div className="nav-inner">
          <button className={`nav-btn ${tab === "laporan" ? "active" : ""}`} onClick={() => setTab("laporan")}><span>📊</span>Laporan</button>
          <button className="nav-btn" onClick={() => exportPDF(absensi)}><span>📄</span>PDF</button>
          <button className="nav-btn" onClick={onLogout}><span>🚪</span>Keluar</button>
        </div>
      </div>
    </div>
  );
}

// --- MAIN APP ---
export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user")));
  const [token, setToken] = useState(() => localStorage.getItem("token"));

  useEffect(() => {
    // Tambahkan viewport meta tag via JS untuk memastikan mobile-responsive
    const meta = document.createElement('meta');
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
    document.getElementsByTagName('head')[0].appendChild(meta);
  }, []);

  if (!user) return <LoginPage onLogin={(u, t) => { setUser(u); setToken(t); }} />;

  return (
    <>
      <style>{css}</style>
      {user.role === "admin" ? (
        <AdminDashboard user={user} token={token} onLogout={() => { setUser(null); localStorage.clear(); }} />
      ) : (
        <div style={{ padding: 20, textAlign: "center" }}>
          <h2>Halo, {user.name}</h2>
          <p>Dashboard Mahasiswa dalam pengembangan...</p>
          <button className="btn btn-danger" onClick={() => { setUser(null); localStorage.clear(); }}>Keluar</button>
        </div>
      )}
    </>
  );
}
