import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { cx } from '../../lib/cx';
import Spinner from './Spinner';

const VARIANTS = {
  primary: 'rounded-lg bg-admin-primary text-white hover:bg-[#1A1A1A] shadow-[inset_0_-1px_0_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.15)] dark:bg-neutral-100 dark:text-[#1A1A1A] dark:hover:bg-white',
  secondary: 'rounded-lg bg-white text-[#303030] border border-admin-border hover:bg-[#F7F7F7] shadow-card dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-700',
  destructive: 'rounded-lg bg-[#C70A24] text-white hover:bg-[#A30A1F]',
  plain: 'rounded-lg text-[#005BD3] hover:underline px-1 dark:text-sky-400',
  ghost: 'rounded-lg text-[#303030] hover:bg-black/5 dark:text-neutral-200 dark:hover:bg-white/10',
  teal: 'rounded-lg bg-teal text-white hover:bg-teal-hover',
  brand: 'rounded-xl bg-[var(--brand)] text-[var(--brand-contrast)] hover:brightness-95 shadow-sm',
  brandOutline: 'rounded-xl border border-[var(--brand)] text-[var(--brand)] bg-transparent hover:bg-[var(--brand-soft)]',
  pill: 'rounded-full bg-ink text-white hover:bg-ink-soft',
  pillLight: 'rounded-full bg-white text-ink hover:bg-cream',
  pillOutline: 'rounded-full border border-ink/80 text-ink hover:bg-ink hover:text-white',
  pillOutlineLight: 'rounded-full border border-white/60 text-white hover:bg-white hover:text-ink',
};

const SIZES = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-11 px-5 text-[15px]',
  xl: 'h-14 px-7 text-base',
  icon: 'h-9 w-9',
};

const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', to, href, loading, icon: Icon, iconRight: IconRight, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const classes = cx(
    'inline-flex items-center justify-center gap-2 font-medium transition select-none whitespace-nowrap',
    'disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:pointer-events-none',
    VARIANTS[variant],
    variant === 'plain' ? 'h-auto' : SIZES[size],
    className,
  );
  const content = (
    <>
      {loading ? <Spinner /> : Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      {children}
      {IconRight && <IconRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
    </>
  );
  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} aria-disabled={disabled || undefined} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a ref={ref} href={href} className={classes} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
});

export default Button;
