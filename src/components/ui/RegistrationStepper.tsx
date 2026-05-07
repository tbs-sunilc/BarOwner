type Step = 'BusinessInfo' | 'Documents' | 'Subscription';

const STEPS: ReadonlyArray<{ id: Step; label: string }> = [
  { id: 'BusinessInfo', label: 'Business Info' },
  { id: 'Documents', label: 'Documents' },
  { id: 'Subscription', label: 'Subscription' },
];

type Props = {
  current: Step;
};

export function RegistrationStepper({ current }: Props) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);

  return (
    <div className="my-2.5 flex items-center gap-2">
      {STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;

        return (
          <div key={step.id} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none">
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={[
                  'grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold',
                  done && 'border-[color:var(--color-success)] bg-[color:var(--color-success)] text-white',
                  active && 'border-accent bg-ink text-ivory',
                  !done && !active && 'border-hairline bg-ivory-2 text-soft',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {done ? '✓' : idx + 1}
              </div>
              <span
                className={[
                  'truncate text-xs font-semibold',
                  done && 'text-[color:var(--color-success)]',
                  active && 'text-accent-lo',
                  !done && !active && 'text-soft',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={['h-px flex-1', done ? 'bg-[color:var(--color-success)]/50' : 'bg-hairline'].join(' ')} />
            )}
          </div>
        );
      })}
    </div>
  );
}
