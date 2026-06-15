import Image from 'next/image';
import clsx from 'clsx';

interface BrandLogoProps {
  className?: string;
  frameClassName?: string;
  textClassName?: string;
  showText?: boolean;
}

export default function BrandLogo({
  className,
  frameClassName,
  textClassName,
  showText = true,
}: BrandLogoProps) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <span
        className={clsx(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#111318] p-1',
          frameClassName,
        )}
      >
        <Image
          src="/brand/arsonus-mark.png"
          alt=""
          width={700}
          height={650}
          className="h-full w-full object-contain"
        />
      </span>
      {showText && (
        <span className={clsx('font-bold uppercase tracking-wide text-white', textClassName)}>
          BeatHive
        </span>
      )}
    </span>
  );
}
