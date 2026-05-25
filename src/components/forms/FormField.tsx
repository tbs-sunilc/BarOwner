import type { ReactNode } from 'react';

const INPUT_CLASS = 'w-full rounded-lg border-slate-300 text-sm';

type FormFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
  hint?: ReactNode;
};

/** Label above control — avoids nesting controls inside a single &lt;label&gt;. */
export function FormField({ label, children, className = '', hint }: FormFieldProps) {
  return (
    <div className={['min-w-0', className].filter(Boolean).join(' ')}>
      <span className="block text-xs font-medium text-slate-600 mb-1.5">{label}</span>
      {children}
      {hint ? <div className="mt-1.5">{hint}</div> : null}
    </div>
  );
}

type FormRowProps = {
  children: ReactNode;
  cols?: 2 | 3;
};

export function FormRow({ children, cols = 2 }: FormRowProps) {
  const colClass = cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2';
  return <div className={`grid grid-cols-1 ${colClass} gap-x-4 gap-y-5`}>{children}</div>;
}

type FormSectionProps = {
  title: string;
  children: ReactNode;
};

export function FormSection({ title, children }: FormSectionProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

type CheckboxFieldProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description: string;
};

/** Aligns with text inputs in a side-by-side grid row. */
export function CheckboxField({ label, checked, onChange, description }: CheckboxFieldProps) {
  return (
    <FormField label={label}>
      <div className="flex min-h-[2.75rem] items-center">
        <label className="inline-flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
          />
          <span className="leading-snug">{description}</span>
        </label>
      </div>
    </FormField>
  );
}

export { INPUT_CLASS };
