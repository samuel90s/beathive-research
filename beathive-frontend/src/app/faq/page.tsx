'use client';
import { useState } from 'react';
import Link from 'next/link';

const faqs = [
  { category: 'General', items: [
    { q: 'What is Arsonus?', a: 'Arsonus is a premium sound effects marketplace. You can browse, preview, and download high-quality SFX for your videos, games, podcasts, and creative projects.' },
    { q: 'Do I need an account to download sounds?', a: 'Yes. You need a free account to download sounds. Free-tier sounds are available to all registered users (up to 3 downloads/day), while Pro sounds require an active subscription (up to 20 downloads/day) or per-item purchase.' },
    { q: 'What audio formats are available?', a: 'Sounds are available in WAV, MP3, OGG, and FLAC depending on the upload. The format is shown on each sound listing.' },
  ]},
  { category: 'Licensing', items: [
    { q: 'What license do I get when I download a free sound?', a: 'Free sounds come with a personal license. You may use them in non-commercial projects such as personal YouTube videos (non-monetized), school projects, and hobbyist content. Commercial use requires a subscription or per-item purchase.' },
    { q: 'What is the difference between Personal and Commercial license?', a: 'A Personal license allows use in non-commercial projects only. A Commercial license allows use in paid work, advertisements, client projects, and any monetized content. Both are perpetual — they do not expire.' },
    { q: 'Can I use sounds I downloaded through a subscription after it expires?', a: 'Yes. Once you download a sound under an active subscription, you retain the right to use it in the project you downloaded it for. However, you cannot download new sounds after your subscription expires.' },
    { q: 'Can I resell or redistribute Arsonus sounds?', a: 'No. Reselling or redistributing sounds — in any form, modified or unmodified — is strictly prohibited under all license types.' },
  ]},
  { category: 'Subscription & Payments', items: [
    { q: 'What payment methods are accepted?', a: 'We accept QRIS, bank transfer, credit/debit cards, and other methods via Midtrans payment gateway.' },
    { q: 'How do I cancel my subscription?', a: 'Subscriptions are billed monthly and do not auto-renew automatically in the current version. Contact support if you need assistance.' },
    { q: 'I paid but my plan did not change. What should I do?', a: 'After completing payment, the system verifies your transaction server-side. If your plan still shows Free after a minute, try refreshing the page or logging out and back in. Contact support if the issue persists.' },
  ]},
  { category: 'Uploading & Creator Earnings', items: [
    { q: 'Can I upload my own sound effects?', a: 'Yes! Any registered user can upload sounds. All uploads go through a review process before they are published. Our team checks for quality, originality, and compliance with our content policy.' },
    { q: 'How long does the review process take?', a: 'Reviews typically take 1–3 business days. You will see the status (Pending, Approved, or Rejected) in your Studio page along with feedback if rejected.' },
    { q: 'How do creator earnings work?', a: 'Each month, 25% of total subscription revenue is pooled into a creator fund. This pool is distributed proportionally based on how many times each PRO sound was downloaded during that month.' },
    { q: 'When can I withdraw my earnings?', a: 'You can request a withdrawal once your balance reaches Rp 50,000. Go to Studio → Earnings → Request Withdrawal. Payouts are processed manually within 3–5 business days.' },
  ]},
  { category: 'Downloads', items: [
    { q: 'What is inside the downloaded ZIP file?', a: 'Every download includes the audio file and a license.txt file documenting your license type, your name, the invoice number, and the terms of use.' },
    { q: 'Can I re-download a sound I purchased?', a: 'Yes. Go to Dashboard → Purchase History and click the Download button next to any paid item to re-download it anytime.' },
  ]},
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-rim last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-4 py-4 text-left">
        <span className="text-sm font-medium text-[#c4c6d8]">{q}</span>
        <svg className={`w-4 h-4 text-[#4a4d5e] flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && <p className="text-sm text-[#6b6f82] leading-relaxed pb-4 pr-8">{a}</p>}
    </div>
  );
}

export default function FaqPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-2xl font-semibold text-white mb-2">Frequently Asked Questions</h1>
        <p className="text-sm text-[#6b6f82]">Everything you need to know about Arsonus.</p>
      </div>

      <div className="space-y-4">
        {faqs.map((section) => (
          <div key={section.category} className="card rounded-2xl px-6">
            <h2 className="text-[10px] font-semibold text-accent-bright uppercase tracking-widest pt-5 pb-1">
              {section.category}
            </h2>
            {section.items.map((item) => <FaqItem key={item.q} q={item.q} a={item.a} />)}
          </div>
        ))}
      </div>

      <div className="mt-8 text-center card rounded-2xl p-8">
        <p className="text-sm font-medium text-[#c4c6d8] mb-1">Still have questions?</p>
        <p className="text-sm text-[#6b6f82] mb-5">Browse sounds or check out our pricing plans.</p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/browse" className="px-5 py-2.5 text-sm font-medium btn-accent rounded-xl">Browse Sounds</Link>
          <Link href="/pricing" className="px-5 py-2.5 text-sm font-medium btn-ghost rounded-xl">See Pricing</Link>
        </div>
      </div>
    </div>
  );
}
