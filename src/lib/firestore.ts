import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  setDoc,
  getDoc,
  orderBy,
  limit as fsLimit,
  startAfter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  Transaction,
  Budget,
  Project,
  Borrowing,
  EmergencyFund,
  UserSettings,
  SavingsGoal,
  UpcomingExpense,
  UpcomingPayment,
  Task,
  Asset,
  Liability,
  HealthRoutine,
  HealthLog,
} from '@/types'

// ── Transactions ────────────────────────────────────────────────────────────

export async function addTransaction(
  userId: string,
  data: Omit<Transaction, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'transactions'), {
    ...data,
    userId,
    createdAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateTransaction(
  id: string,
  data: Partial<Transaction>
): Promise<void> {
  await updateDoc(doc(db, 'transactions', id), data)
}

export async function deleteTransaction(id: string): Promise<void> {
  await deleteDoc(doc(db, 'transactions', id))
}

export async function getUserTransactions(
  userId: string
): Promise<Transaction[]> {
  const q = query(collection(db, 'transactions'), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Transaction))
    .sort((a, b) => {
      const d = b.date.localeCompare(a.date)
      return d !== 0 ? d : b.createdAt.localeCompare(a.createdAt)
    })
}

const PAGE_SIZE = 50

export async function getTransactionsPage(
  userId: string,
  cursor?: QueryDocumentSnapshot,
): Promise<{ transactions: Transaction[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }> {
  const q = cursor
    ? query(collection(db, 'transactions'), where('userId', '==', userId), orderBy('date', 'desc'), orderBy('createdAt', 'desc'), startAfter(cursor), fsLimit(PAGE_SIZE))
    : query(collection(db, 'transactions'), where('userId', '==', userId), orderBy('date', 'desc'), orderBy('createdAt', 'desc'), fsLimit(PAGE_SIZE))
  const snap = await getDocs(q)
  const transactions = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction))
  return {
    transactions,
    lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === PAGE_SIZE,
  }
}

// ── Budgets ──────────────────────────────────────────────────────────────────

export async function setBudget(
  userId: string,
  month: string,
  category: string,
  planned: number
): Promise<void> {
  const id = `${userId}_${month}_${category.replace(/\s+/g, '_').replace(/\//g, '-')}`
  await setDoc(doc(db, 'budgets', id), {
    userId,
    month,
    category,
    planned,
    createdAt: new Date().toISOString(),
  })
}

export async function getUserBudgets(userId: string): Promise<Budget[]> {
  const q = query(
    collection(db, 'budgets'),
    where('userId', '==', userId)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Budget))
}

// ── Projects ─────────────────────────────────────────────────────────────────

export async function addProject(
  userId: string,
  data: Omit<Project, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'projects'), {
    ...data,
    userId,
    createdAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateProject(
  id: string,
  data: Partial<Project>
): Promise<void> {
  await updateDoc(doc(db, 'projects', id), data)
}

export async function deleteProject(id: string): Promise<void> {
  await deleteDoc(doc(db, 'projects', id))
}

export async function getUserProjects(userId: string): Promise<Project[]> {
  const q = query(collection(db, 'projects'), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Project))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// ── Borrowings ───────────────────────────────────────────────────────────────

export async function addBorrowing(
  userId: string,
  data: Omit<Borrowing, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'borrowings'), {
    ...data,
    userId,
    createdAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateBorrowing(
  id: string,
  data: Partial<Borrowing>
): Promise<void> {
  await updateDoc(doc(db, 'borrowings', id), data)
}

export async function deleteBorrowing(id: string): Promise<void> {
  await deleteDoc(doc(db, 'borrowings', id))
}

export async function getUserBorrowings(userId: string): Promise<Borrowing[]> {
  const q = query(collection(db, 'borrowings'), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Borrowing))
    .sort((a, b) => b.date.localeCompare(a.date))
}

// ── Emergency Fund ───────────────────────────────────────────────────────────

export async function getEmergencyFund(
  userId: string
): Promise<EmergencyFund | null> {
  const ref = doc(db, 'emergencyFunds', userId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as EmergencyFund
}

export async function setEmergencyFund(
  userId: string,
  data: Omit<EmergencyFund, 'id' | 'userId'>
): Promise<void> {
  await setDoc(doc(db, 'emergencyFunds', userId), {
    ...data,
    userId,
    lastUpdated: new Date().toISOString(),
  })
}

// ── User Settings ─────────────────────────────────────────────────────────────

export async function getUserSettings(
  userId: string
): Promise<UserSettings | null> {
  const ref = doc(db, 'userSettings', userId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as UserSettings
}

export async function setUserSettings(
  userId: string,
  data: Partial<UserSettings>
): Promise<void> {
  const ref = doc(db, 'userSettings', userId)
  const existing = await getDoc(ref)
  if (existing.exists()) {
    await updateDoc(ref, { ...data, updatedAt: new Date().toISOString() })
  } else {
    await setDoc(ref, {
      ...data,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function addHealthRoutine(
  userId: string,
  data: Omit<HealthRoutine, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'healthRoutines'), {
    ...data, userId, createdAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateHealthRoutine(id: string, data: Partial<HealthRoutine>): Promise<void> {
  await updateDoc(doc(db, 'healthRoutines', id), data)
}

export async function deleteHealthRoutine(id: string): Promise<void> {
  await deleteDoc(doc(db, 'healthRoutines', id))
}

export async function getUserHealthRoutines(userId: string): Promise<HealthRoutine[]> {
  const q = query(collection(db, 'healthRoutines'), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as HealthRoutine))
    .sort((a, b) => a.order - b.order)
}

export async function upsertHealthLog(
  userId: string,
  date: string,
  routineId: string,
  count: number,
): Promise<void> {
  const id = `${userId}_${date}_${routineId}`
  await setDoc(doc(db, 'healthLogs', id), {
    userId, date, routineId, count,
    completedAt: count > 0 ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
  }, { merge: true })
}

export async function getHealthLogs(userId: string, fromDate: string): Promise<HealthLog[]> {
  // Single where clause (no composite index needed); filter by date in JS
  const q = query(collection(db, 'healthLogs'), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as HealthLog))
    .filter(l => l.date >= fromDate)
}

// ── Push Subscriptions ────────────────────────────────────────────────────────

export async function savePushSubscription(
  userId: string,
  subscription: PushSubscriptionJSON
): Promise<void> {
  const ref = doc(db, 'pushSubscriptions', userId)
  await setDoc(ref, { userId, subscription, updatedAt: new Date().toISOString() })
}

export async function deletePushSubscription(userId: string): Promise<void> {
  await deleteDoc(doc(db, 'pushSubscriptions', userId))
}

// ── Savings Goals ─────────────────────────────────────────────────────────────

export async function addSavingsGoal(
  userId: string,
  data: Omit<SavingsGoal, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'savingsGoals'), {
    ...data,
    userId,
    createdAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateSavingsGoal(
  id: string,
  data: Partial<SavingsGoal>
): Promise<void> {
  await updateDoc(doc(db, 'savingsGoals', id), data)
}

export async function deleteSavingsGoal(id: string): Promise<void> {
  await deleteDoc(doc(db, 'savingsGoals', id))
}

export async function getUserSavingsGoals(userId: string): Promise<SavingsGoal[]> {
  const q = query(collection(db, 'savingsGoals'), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as SavingsGoal))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// ── Backup / Restore ─────────────────────────────────────────────────────────

export async function exportAllUserData(userId: string) {
  const [transactions, budgets, projects, borrowings, emergencyFund, settings] =
    await Promise.all([
      getUserTransactions(userId),
      getUserBudgets(userId),
      getUserProjects(userId),
      getUserBorrowings(userId),
      getEmergencyFund(userId),
      getUserSettings(userId),
    ])
  return {
    exportedAt: new Date().toISOString(),
    userId,
    transactions,
    budgets,
    projects,
    borrowings,
    emergencyFund,
    settings,
  }
}

export async function importAllUserData(
  userId: string,
  data: Awaited<ReturnType<typeof exportAllUserData>>
): Promise<void> {
  const batch: Promise<unknown>[] = []

  for (const t of data.transactions) {
    const { id, ...rest } = t
    batch.push(setDoc(doc(db, 'transactions', id), { ...rest, userId }))
  }
  for (const b of data.budgets) {
    const { id, ...rest } = b
    batch.push(setDoc(doc(db, 'budgets', id), { ...rest, userId }))
  }
  for (const p of data.projects) {
    const { id, ...rest } = p
    batch.push(setDoc(doc(db, 'projects', id), { ...rest, userId }))
  }
  for (const borrow of data.borrowings) {
    const { id, ...rest } = borrow
    batch.push(setDoc(doc(db, 'borrowings', id), { ...rest, userId }))
  }
  if (data.emergencyFund) {
    batch.push(setEmergencyFund(userId, data.emergencyFund))
  }
  if (data.settings) {
    batch.push(setUserSettings(userId, data.settings))
  }

  await Promise.all(batch)
}

// ── Upcoming Expenses ─────────────────────────────────────────────────────────

export async function getUserUpcoming(userId: string): Promise<UpcomingExpense[]> {
  const q = query(collection(db, 'upcoming'), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as UpcomingExpense)
}

export async function addUpcoming(
  userId: string,
  data: Omit<UpcomingExpense, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'upcoming'), {
    ...data,
    userId,
    createdAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateUpcoming(
  id: string,
  data: Partial<UpcomingExpense>
): Promise<void> {
  await updateDoc(doc(db, 'upcoming', id), data)
}

export async function deleteUpcoming(id: string): Promise<void> {
  await deleteDoc(doc(db, 'upcoming', id))
}

// ── Upcoming Payments ─────────────────────────────────────────────────────────

export async function getUserUpcomingPayments(userId: string): Promise<UpcomingPayment[]> {
  const q = query(collection(db, 'upcomingPayments'), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as UpcomingPayment)
}

export async function addUpcomingPayment(
  userId: string,
  data: Omit<UpcomingPayment, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'upcomingPayments'), {
    ...data,
    userId,
    createdAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateUpcomingPayment(
  id: string,
  data: Partial<UpcomingPayment>
): Promise<void> {
  await updateDoc(doc(db, 'upcomingPayments', id), data)
}

export async function deleteUpcomingPayment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'upcomingPayments', id))
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export async function getUserTasks(userId: string): Promise<Task[]> {
  const q = query(collection(db, 'tasks'), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task))
}

export async function addTask(
  userId: string,
  data: Omit<Task, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'tasks'), {
    ...data,
    userId,
    createdAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateTask(id: string, data: Partial<Task>): Promise<void> {
  await updateDoc(doc(db, 'tasks', id), data)
}

export async function deleteTask(id: string): Promise<void> {
  await deleteDoc(doc(db, 'tasks', id))
}

// ── Net Worth — Assets ─────────────────────────────────────────────────────────

export async function getUserAssets(userId: string): Promise<Asset[]> {
  const q = query(collection(db, 'assets'), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Asset)
}

export async function addAsset(userId: string, data: Omit<Asset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = new Date().toISOString()
  const ref = await addDoc(collection(db, 'assets'), { ...data, userId, createdAt: now, updatedAt: now })
  return ref.id
}

export async function updateAsset(id: string, data: Partial<Asset>): Promise<void> {
  await updateDoc(doc(db, 'assets', id), { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteAsset(id: string): Promise<void> {
  await deleteDoc(doc(db, 'assets', id))
}

// ── Net Worth — Liabilities ────────────────────────────────────────────────────

export async function getUserLiabilities(userId: string): Promise<Liability[]> {
  const q = query(collection(db, 'liabilities'), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Liability)
}

export async function addLiability(userId: string, data: Omit<Liability, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = new Date().toISOString()
  const ref = await addDoc(collection(db, 'liabilities'), { ...data, userId, createdAt: now, updatedAt: now })
  return ref.id
}

export async function updateLiability(id: string, data: Partial<Liability>): Promise<void> {
  await updateDoc(doc(db, 'liabilities', id), { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteLiability(id: string): Promise<void> {
  await deleteDoc(doc(db, 'liabilities', id))
}
