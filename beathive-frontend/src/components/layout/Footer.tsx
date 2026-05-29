import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-surface border-t border-rim mt-16">
      <div className="max-w-7xl mx-auto px-4 pt-12 pb-8">

        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4 w-fit">
              <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
                <div className="flex items-end gap-[2px] h-3">
                  {[40, 90, 65, 80].map((h, i) => (
                    <span key={i} className="w-[3px] bg-accent/70 rounded-full" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              <span className="text-base font-bold">
                <span className="text-white">beat</span><span className="text-accent-bright">hive</span>
              </span>
            </Link>
            <p className="text-sm text-[#6b6f82] leading-relaxed max-w-xs">
              Premium sound effects for content creators, game developers, and filmmakers. License-ready, instantly downloadable.
            </p>
            <div className="flex items-center gap-3 mt-5">
              {[
                { label: '10K+', desc: 'Sounds' },
                { label: '500+', desc: 'Creators' },
              ].map((s) => (
                <div key={s.label} className="px-3 py-2 card rounded-lg text-center">
                  <p className="text-sm font-bold text-accent-bright">{s.label}</p>
                  <p className="text-[10px] text-[#6b6f82] mt-0.5">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Explore */}
          <div>
            <p className="text-[10px] font-semibold text-[#5a5d72] uppercase tracking-widest mb-4">Explore</p>
            <ul className="space-y-2.5">
              {[
                { href: '/browse', label: 'Browse Sounds' },
                { href: '/browse?soundType=sfx', label: 'Sound Effects' },
                { href: '/browse?soundType=music', label: 'Music' },
                { href: '/pricing', label: 'Pricing' },
                { href: '/wishlist', label: 'Wishlist' },
              ].map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-[#6b6f82] hover:text-accent-bright transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Creator */}
          <div>
            <p className="text-[10px] font-semibold text-[#5a5d72] uppercase tracking-widest mb-4">Creator</p>
            <ul className="space-y-2.5">
              {[
                { href: '/studio', label: 'Studio' },
                { href: '/dashboard', label: 'Dashboard' },
                { href: '/auth/register', label: 'Start Uploading' },
              ].map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-[#6b6f82] hover:text-accent-bright transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <p className="text-[10px] font-semibold text-[#5a5d72] uppercase tracking-widest mb-4">Support</p>
            <ul className="space-y-2.5">
              {[
                { href: '/faq', label: 'FAQ' },
                { href: '#', label: 'Terms of Service' },
                { href: '#', label: 'Privacy Policy' },
                { href: '#', label: 'Contact' },
              ].map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-[#6b6f82] hover:text-accent-bright transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-rim pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[#4a4d5e]">© {new Date().getFullYear()} Arsonus. All rights reserved.</p>
          <p className="text-xs text-[#4a4d5e]">Made with <span className="text-accent/60">♪</span> for creators.</p>
        </div>
      </div>
    </footer>
  );
}
