// src/components/ui/MultiChipSelect.tsx
'use client';
import { memo } from 'react';

interface Props {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  capitalize?: boolean;
}

function MultiChipSelect({ options, selected, onChange, capitalize = true }: Props) {
  const toggle = (opt: string) => {
    onChange(
      selected.includes(opt)
        ? selected.filter(s => s !== opt)
        : [...selected, opt],
    );
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => {
        const isSelected = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all duration-150 ${
              isSelected
                ? 'bg-accent/20 text-accent-bright border-accent/40 shadow-[0_0_8px_rgba(247,148,29,0.15)]'
                : 'bg-white/[0.03] text-[#6b6f82] border-white/[0.06] hover:border-white/[0.12] hover:text-[#8b8fa8]'
            }`}
          >
            {capitalize ? opt.charAt(0).toUpperCase() + opt.slice(1) : opt}
          </button>
        );
      })}
    </div>
  );
}

export default memo(MultiChipSelect);
