import * as React from 'react';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl py-2 px-3 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all shadow-sm ${className || ''}`}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
