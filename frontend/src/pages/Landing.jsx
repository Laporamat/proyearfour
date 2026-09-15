import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import s from './Landing.module.css'

export default function Landing() {
  const { user }  = useAuth()
  const navigate  = useNavigate()

  const cta = user ? {
    label: 'ไปที่ Dashboard →',
    onClick: () => navigate('/dashboard'),
  } : {
    label: 'เข้าสู่ระบบด้วย Google',
    onClick: () => navigate('/login'),
  }

  return (
    <div className={s.page}>
      {/* ── Nav ─────────────────────────── */}
      <nav className={s.nav}>
        <div className={s.brand}>
          <div className={s.brandMark}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <polyline points="3 17 9 11 13 15 21 7" />
              <polyline points="14 7 21 7 21 14" />
            </svg>
          </div>
          <span>QuantAI</span>
        </div>
        <div className={s.navLinks}>
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#stack">Stack</a>
          {user ? (
            <button data-testid="landing-dashboard-btn" className={s.btnDark} onClick={() => navigate('/dashboard')}>
              Dashboard →
            </button>
          ) : (
            <Link data-testid="landing-login-btn" to="/login" className={s.btnDark}>Sign in</Link>
          )}
        </div>
      </nav>

      {/* ── Hero ────────────────────────── */}
      <header className={s.hero}>
        <div className={s.heroTag}>
          <span className="pulse-dot green" /> Live · 25 assets · THB
        </div>
        <h1 className={s.heroTitle}>
          จัดพอร์ตอัจฉริยะด้วย <span className={s.accent}>AI + Quant</span>
          <br />ในแดชบอร์ดเดียว
        </h1>
        <p className={s.heroSub}>
          รวมข้อมูลตลาดสด — หุ้นไทย · หุ้นเทศ · ทองคำ · พันธบัตร —
          แล้วให้ Modern Portfolio Theory + Machine Learning ช่วยตัดสินใจ
          ว่าควรถือสัดส่วนอะไร ในสภาวะตลาดแบบไหน
        </p>
        <div className={s.heroCTA}>
          <button data-testid="hero-primary-cta" className={s.btnPrimary} onClick={cta.onClick}>
            {cta.label}
          </button>
          <a href="#features" className={s.btnGhost}>ดูว่าทำอะไรได้บ้าง</a>
        </div>
        <div className={s.heroStats}>
          <div><b>1.94</b><span>Sharpe Ratio</span></div>
          <div><b>25</b><span>Assets</span></div>
          <div><b>60s</b><span>Auto refresh</span></div>
          <div><b>3</b><span>Regime states</span></div>
        </div>
      </header>

      {/* ── Features ────────────────────── */}
      <section id="features" className={s.section}>
        <div className={s.sectionHead}>
          <h2>ทุกอย่างที่นักลงทุนสาย Quant ต้องการ</h2>
          <p>ไม่ต้องเปิดหลายเว็บอีก — จบในหน้าเดียว</p>
        </div>
        <div className={s.grid}>
          {FEATURES.map((f, i) => (
            <div className={s.card} key={f.title} style={{animationDelay: `${i*60}ms`}}>
              <div className={s.cardIcon}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────── */}
      <section id="how" className={s.section}>
        <div className={s.sectionHead}>
          <h2>3 ขั้นตอน จบ</h2>
          <p>ตั้งแต่ล็อกอินถึงเห็นสัดส่วนที่แนะนำ ใช้เวลาไม่ถึงนาที</p>
        </div>
        <div className={s.steps}>
          {STEPS.map((st, i) => (
            <div className={s.step} key={st.title}>
              <span className={s.stepNum}>{String(i+1).padStart(2,'0')}</span>
              <h3>{st.title}</h3>
              <p>{st.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stack strip ──────────────────── */}
      <section id="stack" className={s.stackStrip}>
        <span className={s.stackLabel}>Powered by</span>
        <div className={s.stackTags}>
          {['Yahoo Finance', 'FastAPI', 'React 19', 'Recharts', 'scikit-learn', 'SciPy Optimize', 'GPT-4o-mini'].map(t => (
            <span className={s.tag} key={t}>{t}</span>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────── */}
      <section className={s.finalCTA}>
        <h2>เริ่มใช้งานเดี๋ยวนี้ — ฟรี</h2>
        <p>เข้าด้วย Google บัญชีเดียว ไม่ต้องจำรหัส ไม่ต้องกรอกฟอร์ม</p>
        <button data-testid="footer-cta" className={s.btnPrimaryLg} onClick={cta.onClick}>
          {cta.label}
        </button>
      </section>

      <footer className={s.footer}>
        <span>© 2026 QuantAI · Portfolio System</span>
        <span>Not investment advice · Data delayed 15 min</span>
      </footer>
    </div>
  )
}

const FEATURES = [
  { icon:'📊', title:'Auto Portfolio Optimizer',
    desc:'Modern Portfolio Theory หา Max Sharpe / Min Vol ให้อัตโนมัติ จากสินทรัพย์ 25 ตัว รวมหุ้นไทย + เทศ + ทอง + พันธบัตร' },
  { icon:'🎯', title:'Market Regime Detection',
    desc:'Random Forest แยกภาวะตลาดเป็น Bull / Neutral / Bear พร้อมค่าความน่าจะเป็นแบบเรียลไทม์' },
  { icon:'⚡', title:'Live Prices in THB',
    desc:'ดึงราคาสดจาก Yahoo Finance ทุก 60 วิ พร้อมแปลงเป็นบาทด้วยอัตราแลกเปลี่ยนล่าสุด ไม่ต้องกดโหลด' },
  { icon:'💬', title:'AI Chat Assistant',
    desc:'ถามเป็นภาษาไทย “จัดพอร์ตให้หน่อย” “ตลาดตอนนี้เป็นยังไง” — LLM เรียกเครื่องมือคำนวณให้เอง' },
  { icon:'📈', title:'Efficient Frontier',
    desc:'จำลอง 10,000 พอร์ตด้วย Monte Carlo แล้ววาดเส้น Frontier ให้เห็นว่าจุดที่เลือกดีที่สุดจริง' },
  { icon:'🔐', title:'Sign-in with Google',
    desc:'บัญชีปลอดภัยด้วย OAuth — ไม่มีรหัสให้ลืม ไม่มีฟอร์มให้กรอก เข้าครั้งแรกใช้ได้ 7 วัน' },
]

const STEPS = [
  { title:'Sign in ด้วย Google',
    desc:'คลิกปุ่ม Sign in — จัดการโดย Emergent OAuth ปลอดภัย ไม่ต้องกรอกรหัสในแอพ' },
  { title:'เปิด Dashboard',
    desc:'ระบบดึงราคา 25 สินทรัพย์ + คำนวณพอร์ตที่แนะนำ + วิเคราะห์สภาวะตลาดให้อัตโนมัติ' },
  { title:'ถาม AI ต่อ',
    desc:'คุยกับผู้ช่วย AI เพื่อขอ insight เจาะลึก หรือปรับเป้าหมาย เช่น เน้น Volatility ต่ำ' },
]
