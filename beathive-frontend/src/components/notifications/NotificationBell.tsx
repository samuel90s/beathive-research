'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { notificationsApi } from '@/lib/api/notifications';
import { useAuthStore } from '@/lib/store/auth.store';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}j`;
  return `${Math.floor(hours / 24)}h`;
}

export default function NotificationBell() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(20),
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!isAuthenticated) return null;

  const unreadCount = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  const markAllRead = async () => {
    await notificationsApi.markAllRead();
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markRead = async (id: string) => {
    await notificationsApi.markRead(id).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'relative p-2 rounded-lg transition-all duration-150',
          open ? 'text-accent-bright bg-accent/10' : 'text-[#6b6f82] hover:text-white hover:bg-white/[0.05]',
        )}
        title="Notifikasi"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-carmine text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-24px)] bg-surface border border-rim rounded-2xl shadow-elevated z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-rim flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Notifikasi</p>
              <p className="text-xs text-[#6b6f82]">{unreadCount} belum dibaca</p>
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-accent-bright hover:underline">
                Tandai dibaca
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm text-[#6b6f82]">No notifications yet.</p>
              </div>
            ) : (
              items.map((item) => {
                const content = (
                  <div
                    onClick={() => markRead(item.id)}
                    className={clsx(
                      'px-4 py-3 border-b border-rim last:border-b-0 transition-colors cursor-pointer',
                      item.readAt ? 'hover:bg-white/[0.03]' : 'bg-accent/[0.06] hover:bg-accent/[0.09]',
                    )}
                  >
                    <div className="flex gap-3">
                      <span className={clsx('mt-1 w-2 h-2 rounded-full flex-shrink-0', item.readAt ? 'bg-[#3a3c4e]' : 'bg-accent')} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                          <span className="text-[10px] text-[#5a5d72] flex-shrink-0">{timeAgo(item.createdAt)}</span>
                        </div>
                        <p className="text-xs text-[#8b8fa8] mt-1 leading-relaxed line-clamp-2">{item.message}</p>
                      </div>
                    </div>
                  </div>
                );

                return item.actionUrl ? (
                  <Link key={item.id} href={item.actionUrl} onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  <div key={item.id}>{content}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
