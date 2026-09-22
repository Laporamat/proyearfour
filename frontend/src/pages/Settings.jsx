import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { api } from '../hooks/useApi'
import s from './Settings.module.css'

export default function Settings() {
  const { user, logout, setUser } = useAuth()
  const { theme, toggle } = useTheme()

  // ── Profile ──
  const [name, setName] = useState(user?.name || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')

  // ── Change password ──
  const isOAuth = user?.provider === 'google' && !user?.hasPassword
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [pwError, setPwError] = useState('')

  // ── Delete account ──
  const [showDelete, setShowDelete] = useState(false)
  const [delPassword, setDelPassword] = useState('')
  const [delSaving, setDelSaving] = useState(false)
  const [delError, setDelError] = useState('')

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    setProfileMsg('')
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('บันทึกไม่สำเร็จ')
      const updated = await res.json()
      setUser(updated)
      setProfileMsg('บันทึกแล้ว ✓')
    } catch (e) {
      setProfileMsg(e.message)
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    setPwError('')
    setPwMsg('')
    if (pwForm.next !== pwForm.confirm) {
      setPwError('รหัสผ่านใหม่ไม่ตรงกัน')
      return
    }
    if (pwForm.next.length < 8) {
      setPwError('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร')
      return
    }
    setPwSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.next }),
      })
      const data = await res.json().catch({})
      if (!res.ok) throw new Error(data.detail || 'เปลี่ยนรหัสผ่านไม่สำเร็จ')
      setPwMsg('เปลี่ยนรหัสผ่านสำเร็จ — กรุณาเข้าสู่ระบบใหม่')
      setPwForm({ current: '', next: '', confirm: '' })
      setTimeout(() => logout(), 2000)
    } catch (e) {
      setPwError(e.message)
    } finally {
      setPwSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDelError('')
    setDelSaving(true)
    try {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: delPassword }),
      })
      const data = await res.json().catch({})
      if (!res.ok) throw new Error(data.detail || 'ลบบัญชีไม่สำเร็จ')
      setUser(null)
      window.location.href = '/'
    } catch (e) {
      setDelError(e.message)
    } finally {
      setDelSaving(false)
    }
  }

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1>Settings</h1>
          <p className={s.sub}>จัดการบัญชีและการตั้งค่า</p>
        </div>
      </header>

      {/* ── Appearance ── */}
      <div className={`card ${s.section}`}>
        <h2 className={s.sectionTitle}>รูปแบบการแสดงผล</h2>
        <div className={s.row}>
          <div>
            <div className={s.label}>โหมดสี</div>
            <div className={s.desc}>สลับระหว่างโหมดกลางวันและกลางคืน</div>
          </div>
          <button className={`btn btn-ghost ${s.themeToggle}`} onClick={toggle}>
            {theme === 'light' ? '☀️ กลางวัน' : '🌙 กลางคืน'}
          </button>
        </div>
      </div>

      {/* ── Profile ── */}
      <div className={`card ${s.section}`}>
        <h2 className={s.sectionTitle}>โปรไฟล์</h2>
        <div className={s.field}>
          <label className={s.fieldLabel}>อีเมล</label>
          <input className={s.input} value={user?.email || ''} disabled />
        </div>
        <div className={s.field}>
          <label className={s.fieldLabel}>ชื่อที่แสดง</label>
          <input
            className={s.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="ชื่อของคุณ"
          />
        </div>
        <div className={s.fieldActions}>
          {profileMsg && <span className={s.successMsg}>{profileMsg}</span>}
          <button className="btn btn-primary" onClick={handleSaveProfile} disabled={savingProfile || name === user?.name}>
            {savingProfile ? <span className="spinner" /> : 'บันทึก'}
          </button>
        </div>
      </div>

      {/* ── Change Password ── */}
      <div className={`card ${s.section}`}>
        <h2 className={s.sectionTitle}>เปลี่ยนรหัสผ่าน</h2>
        {isOAuth ? (
          <p className={s.infoText}>บัญชีนี้ใช้ Google OAuth — ไม่มีรหัสผ่านให้เปลี่ยน</p>
        ) : (
          <>
            <div className={s.field}>
              <label className={s.fieldLabel}>รหัสผ่านปัจจุบัน</label>
              <input
                className={s.input}
                type="password"
                value={pwForm.current}
                onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
              />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>รหัสผ่านใหม่</label>
              <input
                className={s.input}
                type="password"
                value={pwForm.next}
                onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
              />
            </div>
            <div className={s.field}>
              <label className={s.fieldLabel}>ยืนยันรหัสผ่านใหม่</label>
              <input
                className={s.input}
                type="password"
                value={pwForm.confirm}
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
              />
            </div>
            {pwError && <p className={s.error}>{pwError}</p>}
            {pwMsg && <p className={s.successMsg}>{pwMsg}</p>}
            <div className={s.fieldActions}>
              <button
                className="btn btn-primary"
                onClick={handleChangePassword}
                disabled={pwSaving || !pwForm.current || !pwForm.next}
              >
                {pwSaving ? <span className="spinner" /> : 'เปลี่ยนรหัสผ่าน'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Danger Zone ── */}
      <div className={`card ${s.section} ${s.dangerZone}`}>
        <h2 className={`${s.sectionTitle} ${s.dangerTitle}`}>ลบบัญชี</h2>
        <p className={s.desc}>การลบบัญชีจะลบข้อมูลทั้งหมดของคุณอย่างถาวร — พอร์ตการลงทุน, Watchlist, และการตั้งค่าทั้งหมด</p>
        {!showDelete ? (
          <button className={`btn ${s.dangerBtn}`} onClick={() => setShowDelete(true)}>
            ลบบัญชีของฉัน
          </button>
        ) : (
          <div className={s.deleteConfirm}>
            {!isOAuth && (
              <div className={s.field}>
                <label className={s.fieldLabel}>กรอกรหัสผ่านเพื่อยืนยัน</label>
                <input
                  className={s.input}
                  type="password"
                  value={delPassword}
                  onChange={e => setDelPassword(e.target.value)}
                  placeholder="รหัสผ่าน"
                />
              </div>
            )}
            {delError && <p className={s.error}>{delError}</p>}
            <div className={s.fieldActions}>
              <button className="btn btn-ghost" onClick={() => { setShowDelete(false); setDelError(''); setDelPassword('') }}>
                ยกเลิก
              </button>
              <button className={`btn ${s.dangerBtn}`} onClick={handleDeleteAccount} disabled={delSaving || (!isOAuth && !delPassword)}>
                {delSaving ? <span className="spinner" /> : 'ยืนยันลบบัญชี'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
