import { passwordStrength } from '../../lib/validators';
import { cx } from '../../lib/cx';

const COLORS = ['bg-[#E3E3E3]', 'bg-[#E51C00]', 'bg-[#E2A100]', 'bg-teal', 'bg-[#29845A]'];

export default function PasswordStrength({ value }) {
  const { score, label } = passwordStrength(value);
  if (!value) return null;
  return (
    <div className="mt-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cx('h-1 flex-1 rounded-full', i <= score ? COLORS[score] : 'bg-[#E3E3E3]')} />
        ))}
      </div>
      <p className="ql-help mt-1">Password strength: {label}</p>
    </div>
  );
}
