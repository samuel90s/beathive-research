// src/components/sounds/WaveformBar.tsx
'use client';
import { memo } from 'react';

interface Props {
  data: number[];
  isActive: boolean;
  progress: number; // 0–100
}

function WaveformBar({ data, isActive, progress }: Props) {
  const raw = data?.length ? data : Array(48).fill(0).map((_, i) => Math.sin(i * 0.4) * 0.4 + 0.5);
  const max = Math.max(...raw, 1);
  const bars = raw.map((v) => (v as number) / max);
  const progressIdx = Math.floor((progress / 100) * bars.length);

  return (
    <div className="flex items-center gap-[2px] h-9 w-full overflow-hidden">
      {bars.map((height, i) => {
        const played = isActive && i < progressIdx;
        const active = isActive && !played;
        const h = Math.max(3, Math.round(height * 32));
        return (
          <div
            key={i}
            className="flex-1 rounded-[1px] transition-all duration-75"
            style={{
              height: `${h}px`,
              backgroundColor: played
                ? '#F7941D'
                : active
                ? 'rgba(247,148,29,0.35)'
                : 'rgba(255,255,255,0.1)',
              minWidth: '2px',
            }}
          />
        );
      })}
    </div>
  );
}

export default memo(WaveformBar);
