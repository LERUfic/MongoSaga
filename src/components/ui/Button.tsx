import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const baseClass = "px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2";
    const variants = {
      primary: "bg-cyan-600 hover:bg-cyan-700 text-white shadow-md",
      secondary: "bg-white border border-[var(--border-color)] text-slate-700 hover:bg-slate-50",
      danger: "bg-red-500 hover:bg-red-600 text-white shadow-md",
    };
    return (
      <button ref={ref} className={`${baseClass} ${variants[variant]} ${className || ''}`} {...props} />
    );
  }
);
Button.displayName = 'Button';
