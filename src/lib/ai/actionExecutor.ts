import {
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from '@/lib/firestore'
import type { PendingAction, AddTransactionPayload, UpdateTransactionPayload, DeleteTransactionPayload } from './types'

export interface ActionResult {
  success: boolean
  message: string
  newTransactionId?: string
}

export async function executeAction(
  action: PendingAction,
  userId: string
): Promise<ActionResult> {
  switch (action.type) {
    case 'add_transaction': {
      const p = action.payload as AddTransactionPayload
      const id = await addTransaction(userId, {
        type: p.type,
        amount: p.amount,
        category: p.category,
        date: p.date,
        notes: p.notes ?? '',
      })
      return {
        success: true,
        message: `Added ${p.type} of ₹${p.amount.toLocaleString()} (${p.category}) on ${formatDate(p.date)}.`,
        newTransactionId: id,
      }
    }

    case 'update_transaction': {
      const p = action.payload as UpdateTransactionPayload
      const { id, description: _desc, ...fields } = p
      await updateTransaction(id, fields)
      return {
        success: true,
        message: `Transaction updated successfully.`,
      }
    }

    case 'delete_transaction': {
      const p = action.payload as DeleteTransactionPayload
      await deleteTransaction(p.id)
      return {
        success: true,
        message: `Deleted: ${p.description}`,
      }
    }

    default:
      return { success: false, message: 'Unknown action type.' }
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}
