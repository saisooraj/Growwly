'use client'

import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function PrivacyPage() {
  const router = useRouter()

  function dismiss() {
    if (window.history.length <= 1) window.close()
    else router.back()
  }

  function handleAgree() {
    // Signal the sign-up form in the original tab to auto-check the privacy box.
    // The localStorage storage event fires in all OTHER open tabs.
    localStorage.setItem('gw_privacy_agreed', Date.now().toString())
    dismiss()
  }

  return (
    <div className="min-h-screen bg-[#06030F] text-white px-4 py-12">
      <div className="max-w-2xl mx-auto">

        <button
          onClick={dismiss}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-10 transition-colors"
        >
          <ArrowLeft size={15} />
          Back
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/25 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={18} className="text-brand-400" />
          </div>
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
        </div>
        <p className="text-slate-500 text-sm mb-10">Last updated: July 2026</p>

        <div className="space-y-8 text-slate-300 text-sm leading-relaxed">

          <section>
            <h2 className="text-white font-semibold text-base mb-2">What we collect</h2>
            <p>Growwly stores the financial data you enter — transactions, budgets, savings goals, and borrowings — along with your account details (email or phone number) to identify your account.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">How your data is stored</h2>
            <p>All data is stored in Firebase (Google Cloud), protected by Firestore security rules. Only your own account can read or write your data within the app.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">Developer access</h2>
            <p>
              As the developer and Firebase administrator, I have technical access to the underlying database. I want to be transparent about this:{' '}
              I can see your data, but I will not. Access is limited to situations where you have explicitly asked for support and granted permission. Your financial data is never browsed, analysed, or used for any purpose other than keeping the app running.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">Data sharing</h2>
            <p>Your data is never sold, rented, or shared with any third party. It is not used for advertising or analytics.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">Your rights</h2>
            <p>You can delete your account and all associated data at any time from Settings. If you have questions or want a copy of your data, contact me at{' '}
              <a href="mailto:saisoorajpnair@gmail.com" className="text-brand-400 hover:text-brand-300 underline underline-offset-2">
                saisoorajpnair@gmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-2">Changes to this policy</h2>
            <p>If this policy changes in a material way, you will be notified in the app before the changes take effect.</p>
          </section>

        </div>

        <div className="mt-12 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleAgree}
            className="flex-1 bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3.5 rounded-2xl transition-colors text-sm"
          >
            I Understand & Agree
          </button>
          <button
            onClick={dismiss}
            className="flex-1 bg-white/6 hover:bg-white/10 border border-white/10 text-slate-400 font-medium py-3.5 rounded-2xl transition-colors text-sm"
          >
            Go Back
          </button>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Continuing to use Growwly means you accept this policy.
        </p>

      </div>
    </div>
  )
}
