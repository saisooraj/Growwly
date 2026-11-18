'use client'

import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { exportAllUserData, importAllUserData, deleteAllUserData } from '@/lib/firestore'
import { useRefreshData } from '@/hooks/useData'
import { downloadJSON } from '@/lib/utils'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Sym, MONO, card, rowTitle, sub, SavedChip, Note, Modal, btnOutline, btnGhostBad, field, useSavedFlash } from './ui'

const backupName = () => `growwly-backup-${new Date().toISOString().split('T')[0]}.json`

function DeleteAccountDialog({ open, onClose, onExport }: { open: boolean; onClose: () => void; onExport: () => void }) {
  const { user, logout } = useAuth()
  const [text, setText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const ok = text.trim().toLowerCase() === 'delete'
  const close = () => { if (!deleting) { setText(''); onClose() } }

  async function doDelete() {
    if (!user || !ok) return
    setDeleting(true)
    try {
      await deleteAllUserData(user.uid, user)
      // Auth account is now deleted — sign out cleans up local state
      await logout()
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'auth/requires-recent-login') toast.error('Please sign out and sign back in, then try again.')
      else toast.error('Failed to delete account. Please try again.')
    } finally {
      setDeleting(false)
      setText('')
      onClose()
    }
  }

  return (
    <Modal open={open} onClose={close} label="Delete account" width={420} closable={!deleting}>
      <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--bad-bg)', color: 'var(--bad)', display: 'grid', placeItems: 'center', marginTop: -14, flex: 'none' }}>
        <Sym name="delete" size={28} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em' }}>Delete account?</div>
        <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--mut)', marginTop: 4 }}>This permanently erases your Growwly data and can&apos;t be undone.</div>
      </div>
      <Note tone="warn" icon="warning" style={{ alignSelf: 'stretch' }}>
        <b style={{ fontWeight: 600 }}>Taking a break?</b> Signing out keeps everything for when you&apos;re back.{' '}
        <button onClick={onExport} style={{ border: 0, padding: 0, background: 'none', color: 'inherit', font: 'inherit', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>Export a backup</button> first if you might want it later.
      </Note>
      <div style={{ alignSelf: 'stretch', padding: '14px 16px', borderRadius: 18, background: 'var(--sf2)', border: '1px solid var(--line)', fontSize: 13, lineHeight: 1.7, color: 'var(--mut)' }}>
        <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>Everything goes:</div>
        <div>All transactions and income records</div>
        <div>Savings goals, projects and borrowings</div>
        <div>Net worth assets and liabilities</div>
        <div>Emergency fund, settings and badges</div>
      </div>
      <label style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13.5, color: 'var(--mut)' }}>Type <b style={{ color: 'var(--bad)', fontFamily: MONO }}>delete</b> to confirm</span>
        <input
          className="set-field" value={text} onChange={e => setText(e.target.value)} disabled={deleting}
          placeholder="delete" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          style={{ ...field(46), fontFamily: MONO, fontSize: 15, borderColor: ok ? 'var(--bad)' : undefined }}
        />
      </label>
      <div style={{ alignSelf: 'stretch', display: 'flex', gap: 8 }}>
        <button onClick={close} disabled={deleting} style={{ ...btnOutline(44, 12, 14), flex: 1 }}>Cancel</button>
        <button
          onClick={doDelete} disabled={!ok || deleting}
          style={{ flex: 1, height: 44, border: 0, borderRadius: 12, fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: ok && !deleting ? 'pointer' : 'default', background: ok ? 'var(--bad)' : 'var(--line)', color: ok ? '#fff' : 'var(--mut)' }}
        >
          {deleting ? 'Deleting…' : <><Sym name="delete" size={18} />Delete forever</>}
        </button>
      </div>
    </Modal>
  )
}

export default function DataSection() {
  const { user } = useAuth()
  const refresh = useRefreshData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingImport, setPendingImport] = useState<any | null>(null)
  const [badFile, setBadFile] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [saved, flash] = useSavedFlash()

  async function handleExport() {
    if (!user) return
    setExporting(true)
    try {
      const data = await exportAllUserData(user.uid)
      downloadJSON(data, backupName())
      flash('backup')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user || !e.target.files?.[0]) return
    const file = e.target.files[0]
    setBadFile(null)
    try {
      const data = JSON.parse(await file.text())
      if (!data.transactions || !data.userId) { setBadFile(file.name); return }
      setPendingImport(data)
    } catch {
      setBadFile(file.name)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function doImport() {
    if (!user || !pendingImport) return
    setImporting(true)
    try {
      await importAllUserData(user.uid, pendingImport)
      await refresh()
      toast.success('Data imported successfully')
    } catch {
      toast.error('Import failed')
    } finally {
      setImporting(false)
      setPendingImport(null)
    }
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '20px 24px' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--acc-soft)', color: 'var(--acc-txt)', display: 'grid', placeItems: 'center', flex: 'none' }}><Sym name="download" size={22} /></div>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={rowTitle}>Export a backup</span>
            {saved === 'backup' && <SavedChip small label="Downloaded" />}
          </div>
          <div style={sub}>Transactions, budgets, projects, borrowings and your emergency fund, in one file.</div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: 'var(--mut)', marginTop: 6 }}>{backupName()}</div>
        </div>
        <button onClick={handleExport} disabled={exporting} style={{ ...btnOutline(38, 12, 14), padding: '0 14px', gap: 8, opacity: exporting ? 0.6 : 1 }}>{exporting ? 'Exporting…' : 'Export .json'}</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '20px 24px', borderTop: '1px solid var(--line)' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--sf2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', flex: 'none' }}><Sym name="upload" size={22} /></div>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={rowTitle}>Restore from a backup</div>
          <div style={sub}>Replaces everything in this account with the file&apos;s contents. We&apos;ll ask before overwriting.</div>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={importing} style={{ ...btnOutline(38, 12, 14), padding: '0 14px', gap: 8, opacity: importing ? 0.6 : 1 }}>{importing ? 'Restoring…' : 'Choose .json file'}</button>
        <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImport} />
      </div>
      {badFile && (
        <Note tone="bad" icon="error" style={{ margin: '-6px 24px 20px 78px' }}>
          <b style={{ fontWeight: 600 }}>“{badFile}” isn&apos;t a Growwly backup.</b> Choose a file exported from this page — it starts with growwly-backup-.
        </Note>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '18px 24px', borderTop: '1px solid var(--line)', background: 'var(--sf2)' }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={rowTitle}>Delete account</div>
          <div style={sub}>Permanently erase your Growwly data. Export a backup first if you might want it back.</div>
        </div>
        <button onClick={() => setDeleteOpen(true)} style={{ ...btnGhostBad(36, 14), padding: '0 12px' }}>Delete account…</button>
      </div>

      <ConfirmDialog
        open={!!pendingImport}
        message="This will overwrite your existing data with the backup file. Continue?"
        confirmLabel="Import"
        onConfirm={doImport}
        onClose={() => setPendingImport(null)}
      />
      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onExport={handleExport} />
    </div>
  )
}
