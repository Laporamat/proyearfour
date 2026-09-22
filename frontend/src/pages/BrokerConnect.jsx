import s from './BrokerConnect.module.css'

const BROKERS = [
  {
    name: 'Interactive Brokers',
    desc: 'เชื่อมต่อผ่าน IBKR API — สั่งซื้อขายหุ้นสดจริง, ดูพอร์ตเรียลไทม์',
    status: 'coming_soon',
    logo: '🏦',
  },
  {
    name: 'Sarathull',
    desc: 'Broker ไทย — รองรับหุ้น SET/mai ผ่าน API',
    status: 'coming_soon',
    logo: '🇹🇭',
  },
  {
    name: 'Binance',
    desc: 'สำหรับ crypto portfolio tracking (อนาคต)',
    status: 'coming_soon',
    logo: '₿',
  },
]

export default function BrokerConnect() {
  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1>Broker Connect</h1>
          <p className={s.sub}>เชื่อมต่อกับ broker เพื่อซื้อขายหุ้นจริง + ดูพอร์ตแบบเรียลไทม์</p>
        </div>
      </header>

      <div className={s.warning}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>ฟีเจอร์นี้อยู่ในระยะวางแผน — การซื้อขายจริงต้องผ่านการรับรองจาก broker และกฎหมายหลักทรัพย์</span>
      </div>

      <div className={s.grid}>
        {BROKERS.map(b => (
          <div key={b.name} className={`card ${s.brokerCard}`}>
            <div className={s.brokerLogo}>{b.logo}</div>
            <h3>{b.name}</h3>
            <p className={s.brokerDesc}>{b.desc}</p>
            <button className="btn btn-ghost" disabled>
              Coming Soon
            </button>
          </div>
        ))}
      </div>

      <div className={`card ${s.featureCard}`}>
        <h3>ฟีเจอร์ที่จะมีเมื่อเชื่อมต่อแล้ว</h3>
        <ul className={s.featureList}>
          <li>✓ สั่งซื้อ/ขายหุ้นจริงจากในแอป</li>
          <li>✓ ดูพอร์ตเรียลไทม์ — มูลค่าอัพเดททุกวินาที</li>
          <li>✓ ซิงค์ holdings อัตโนมัติ — ไม่ต้องเพิ่มเอง</li>
          <li>✓ ตั้ง stop-loss / take-profit อัตโนมัติ</li>
          <li>✓ ประวัติการซื้อขาย + ใบสั่งซื้อ</li>
          <li>✓ รับแจ้งเตือนเมื่อคำสั่งเสร็จ</li>
        </ul>
      </div>
    </div>
  )
}
