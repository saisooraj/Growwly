'use client'

import { Fragment, useState, useMemo } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, Plus, Phone, Trash2, Check, Edit2 } from 'lucide-react'
import { addContact, updateContact, deleteContact, deleteBorrowing } from '@/lib/firestore'
import { useAuth } from '@/context/AuthContext'
import { useAppStore } from '@/store/appStore'
import { useRefreshData } from '@/hooks/useData'
import { formatCurrencyFull } from '@/lib/utils'
import type { Contact } from '@/types'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const AVATAR_PALETTES = [
  { bg: 'oklch(0.82 0.12 158)', text: 'oklch(0.28 0.09 152)' },
  { bg: 'oklch(0.82 0.13 245)', text: 'oklch(0.3  0.1  245)' },
  { bg: 'oklch(0.85 0.14 75)',  text: 'oklch(0.35 0.1  60)'  },
  { bg: 'oklch(0.82 0.16 286)', text: 'oklch(0.32 0.12 286)' },
  { bg: 'oklch(0.82 0.18 358)', text: 'oklch(0.34 0.12 358)' },
  { bg: 'oklch(0.82 0.14 200)', text: 'oklch(0.3  0.1  200)' },
]
function avatarPalette(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length]
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function ContactsModal({ open, onClose }: Props) {
  const { user } = useAuth()
  const refresh = useRefreshData()
  const { contacts, borrowings, setContacts, setBorrowings } = useAppStore()

  const [search, setSearch] = useState('')
  const [addName, setAddName] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Inline edit state
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ contact: Contact; hasBorrowings: boolean } | null>(null)

  // Merge contacts + borrowing-derived names into a unified list
  const allPeople = useMemo(() => {
    const contactMap = new Map(contacts.map(c => [c.name.toLowerCase(), c]))
    const borrowingNames = Array.from(new Set(borrowings.map(b => b.person)))
    const merged: { name: string; contact: Contact | null }[] = []

    // All contacts (may or may not have borrowings)
    contacts.forEach(c => merged.push({ name: c.name, contact: c }))

    // Borrowing names not in contacts
    borrowingNames.forEach(name => {
      if (!contactMap.has(name.toLowerCase())) {
        merged.push({ name, contact: null })
      }
    })

    return merged.sort((a, b) => a.name.localeCompare(b.name))
  }, [contacts, borrowings])

  const filtered = useMemo(() =>
    allPeople.filter(p => p.name.toLowerCase().includes(search.toLowerCase())),
    [allPeople, search]
  )

  // Net balance per person
  function netBalance(name: string) {
    const records = borrowings.filter(b => b.person.toLowerCase() === name.toLowerCase() && b.status !== 'repaid')
    const lent = records.filter(b => b.type === 'lent').reduce((s, b) => s + (b.amount - b.repaidAmount), 0)
    const owed = records.filter(b => b.type === 'borrowed').reduce((s, b) => s + (b.amount - b.repaidAmount), 0)
    return { lent, owed, net: lent - owed }
  }

  async function handleAdd() {
    if (!user || !addName.trim()) return
    setSaving(true)
    try {
      const id = await addContact(user.uid, { name: addName.trim(), ...(addPhone.trim() ? { phone: addPhone.trim() } : {}) })
      setContacts([...contacts, { id, userId: user.uid, name: addName.trim(), phone: addPhone.trim() || undefined, createdAt: new Date().toISOString() }])
      setAddName(''); setAddPhone(''); setAddOpen(false)
      toast.success('Contact added')
    } catch { toast.error('Failed to add') } finally { setSaving(false) }
  }

  async function handleSaveEdit() {
    if (!editId || !editName.trim()) return
    setSaving(true)
    try {
      await updateContact(editId, { name: editName.trim(), phone: editPhone.trim() || undefined })
      setContacts(contacts.map(c => c.id === editId ? { ...c, name: editName.trim(), phone: editPhone.trim() || undefined } : c))
      setEditId(null)
      toast.success('Saved')
    } catch { toast.error('Failed to save') } finally { setSaving(false) }
  }

  async function handleDelete(contact: Contact, deleteRecords: boolean) {
    try {
      if (contact.id) await deleteContact(contact.id)
      setContacts(contacts.filter(c => c.id !== contact.id))
      if (deleteRecords) {
        const toDelete = borrowings.filter(b => b.person.toLowerCase() === contact.name.toLowerCase())
        await Promise.all(toDelete.map(b => deleteBorrowing(b.id)))
        setBorrowings(borrowings.filter(b => b.person.toLowerCase() !== contact.name.toLowerCase()))
      }
      await refresh()
      toast.success(deleteRecords ? 'Contact & records deleted' : 'Contact removed')
    } catch { toast.error('Failed to delete') }
    setDeleteTarget(null)
  }

  async function handleDeleteUntracked(name: string) {
    try {
      const toDelete = borrowings.filter(b => b.person.toLowerCase() === name.toLowerCase())
      await Promise.all(toDelete.map(b => deleteBorrowing(b.id)))
      setBorrowings(borrowings.filter(b => b.person.toLowerCase() !== name.toLowerCase()))
      await refresh()
      toast.success('Person & records deleted')
    } catch { toast.error('Failed') }
    setDeleteTarget(null)
  }

  return (
    <>
      <Transition appear show={open} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          <Transition.Child as={Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
            leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-end sm:items-center justify-center p-4">
              <Transition.Child as={Fragment}
                enter="ease-out duration-200" enterFrom="opacity-0 translate-y-4" enterTo="opacity-100 translate-y-0"
                leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                <Dialog.Panel className="w-full max-w-md bg-white dark:bg-[#0F1120] border border-transparent dark:border-[#1E2140] rounded-2xl shadow-xl overflow-hidden">

                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <Dialog.Title className="text-base font-semibold text-slate-800 dark:text-white">
                      People
                    </Dialog.Title>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        onClick={() => setAddOpen(v => !v)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '5px 10px', borderRadius: 8, border: 'none',
                          background: 'var(--brand-soft)', color: 'var(--brand-ink)',
                          fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        <Plus size={12} strokeWidth={2.5} /> Add
                      </button>
                      <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '70vh', overflowY: 'auto' }}>

                    {/* Add form */}
                    {addOpen && (
                      <div style={{
                        background: 'var(--surface-2)', borderRadius: 12, padding: 14,
                        display: 'flex', flexDirection: 'column', gap: 10,
                        border: '1px solid var(--border)',
                      }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.04em' }}>NEW CONTACT</div>
                        <input
                          className="input" placeholder="Name *" value={addName}
                          onChange={e => setAddName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAdd()}
                          autoFocus
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 10px' }}>
                          <Phone size={13} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
                          <input
                            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', padding: '9px 0', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit' }}
                            placeholder="Phone (optional)"
                            type="tel"
                            value={addPhone}
                            onChange={e => setAddPhone(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={handleAdd} disabled={!addName.trim() || saving}
                            style={{
                              flex: 1, padding: '8px', borderRadius: 8, border: 'none',
                              background: 'var(--brand)', color: '#fff',
                              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                              opacity: !addName.trim() || saving ? 0.5 : 1,
                            }}
                          >
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={() => { setAddOpen(false); setAddName(''); setAddPhone('') }}
                            style={{
                              padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
                              background: 'transparent', color: 'var(--text-3)',
                              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Search */}
                    <input
                      className="input" placeholder="Search people…"
                      value={search} onChange={e => setSearch(e.target.value)}
                    />

                    {/* People list */}
                    {filtered.length === 0 && (
                      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-4)', padding: '24px 0' }}>
                        No people found
                      </p>
                    )}

                    {filtered.map(({ name, contact }) => {
                      const pal = avatarPalette(name)
                      const { lent, owed, net } = netBalance(name)
                      const isEditing = editId === contact?.id
                      const borrowingRecords = borrowings.filter(b => b.person.toLowerCase() === name.toLowerCase())

                      return (
                        <div key={name} style={{
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: 12,
                        }}>
                          {isEditing ? (
                            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <input className="input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name *" autoFocus />
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 10px' }}>
                                <Phone size={13} style={{ color: 'var(--text-4)' }} />
                                <input
                                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', padding: '8px 0', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit' }}
                                  type="tel" placeholder="Phone (optional)"
                                  value={editPhone} onChange={e => setEditPhone(e.target.value)}
                                />
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  onClick={handleSaveEdit} disabled={!editName.trim() || saving}
                                  style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                                >
                                  <Check size={13} /> Save
                                </button>
                                <button onClick={() => setEditId(null)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px' }}>
                              {/* Avatar */}
                              <div style={{ width: 36, height: 36, borderRadius: '50%', background: pal.bg, color: pal.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                                {name[0]?.toUpperCase()}
                              </div>

                              {/* Name + sub-info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                                  {contact?.phone
                                    ? <><Phone size={9} />{contact.phone}</>
                                    : !contact
                                      ? 'from borrowings'
                                      : 'no phone'
                                  }
                                </div>
                              </div>

                              {/* Net balance */}
                              {net !== 0 ? (
                                <div style={{
                                  fontSize: 12, fontWeight: 800, flexShrink: 0,
                                  color: net > 0 ? 'var(--good-ink)' : 'var(--bad-ink)',
                                  background: net > 0 ? 'var(--good-soft)' : 'var(--bad-soft)',
                                  padding: '3px 9px', borderRadius: 999,
                                }}>
                                  {net > 0 ? '+' : '−'}{formatCurrencyFull(Math.abs(net))}
                                </div>
                              ) : borrowingRecords.length > 0 ? (
                                <span style={{ fontSize: 10.5, color: 'var(--text-4)', flexShrink: 0 }}>Settled</span>
                              ) : (
                                <span style={{ fontSize: 10.5, color: 'var(--text-4)', flexShrink: 0 }}>No records</span>
                              )}

                              {/* Actions */}
                              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                                {contact && (
                                  <button
                                    onClick={() => { setEditId(contact.id); setEditName(contact.name); setEditPhone(contact.phone ?? '') }}
                                    style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    if (contact) {
                                      setDeleteTarget({ contact, hasBorrowings: borrowingRecords.length > 0 })
                                    } else {
                                      setDeleteTarget({ contact: { id: '', userId: '', name, createdAt: '' }, hasBorrowings: borrowingRecords.length > 0 })
                                    }
                                  }}
                                  style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bad-soft)'; e.currentTarget.style.color = 'var(--bad-ink)' }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-4)' }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Delete confirm */}
      {deleteTarget && deleteTarget.contact.id && (
        <ConfirmDialog
          open
          title={`Remove ${deleteTarget.contact.name}?`}
          message={
            deleteTarget.hasBorrowings
              ? `${deleteTarget.contact.name} has borrowing records. Remove contact info only, or delete everything?`
              : `Remove ${deleteTarget.contact.name} from your contacts?`
          }
          confirmLabel={deleteTarget.hasBorrowings ? 'Contact only' : 'Delete'}
          onConfirm={() => handleDelete(deleteTarget.contact, false)}
          onClose={() => setDeleteTarget(null)}
          extraAction={deleteTarget.hasBorrowings ? {
            label: 'Contact + all records',
            onAction: () => handleDelete(deleteTarget.contact, true),
          } : undefined}
        />
      )}
      {deleteTarget && !deleteTarget.contact.id && (
        <ConfirmDialog
          open
          title={`Remove ${deleteTarget.contact.name}?`}
          message={`This will delete all borrowing records for ${deleteTarget.contact.name}.`}
          confirmLabel="Delete all records"
          onConfirm={() => handleDeleteUntracked(deleteTarget.contact.name)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
}
