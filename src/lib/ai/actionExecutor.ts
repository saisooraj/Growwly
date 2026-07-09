import {
  addTransaction,
  updateTransaction,
  deleteTransaction,
  setBudget,
  addSavingsGoal,
  addProject,
} from '@/lib/firestore'
import type {
  PendingAction,
  AddTransactionPayload,
  UpdateTransactionPayload,
  DeleteTransactionPayload,
  SetBudgetPayload,
  CreateGoalPayload,
  CreateProjectPayload,
} from './types'

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
      return { success: true, message: 'Transaction updated successfully.' }
    }

    case 'delete_transaction': {
      const p = action.payload as DeleteTransactionPayload
      await deleteTransaction(p.id)
      return { success: true, message: `Deleted: ${p.description}` }
    }

    case 'set_budget': {
      const p = action.payload as SetBudgetPayload
      await setBudget(userId, p.month, p.category, p.amount)
      return {
        success: true,
        message: `Budget set: ${p.category} → ₹${p.amount.toLocaleString()} for ${p.month}.`,
      }
    }

    case 'create_goal': {
      const p = action.payload as CreateGoalPayload
      await addSavingsGoal(userId, {
        name: p.name,
        emoji: '🎯',
        targetAmount: p.targetAmount,
        currentAmount: 0,
        ...(p.targetDate ? { targetDate: p.targetDate } : {}),
      })
      return {
        success: true,
        message: `Goal "${p.name}" created — target ₹${p.targetAmount.toLocaleString()}.`,
      }
    }

    case 'create_project': {
      const p = action.payload as CreateProjectPayload
      await addProject(userId, {
        name: p.name,
        description: p.description ?? '',
        totalBudget: p.totalBudget,
        paid: 0,
        status: 'active',
        startDate: new Date().toISOString().slice(0, 10),
        ...(p.endDate ? { endDate: p.endDate } : {}),
      })
      return {
        success: true,
        message: `Project "${p.name}" created with ₹${p.totalBudget.toLocaleString()} budget.`,
      }
    }

    default:
      return { success: false, message: 'Unknown action type.' }
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch {
    return dateStr
  }
}
