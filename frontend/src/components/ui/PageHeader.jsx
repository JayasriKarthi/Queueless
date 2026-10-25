import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PageHeader({ title, subtitle, back, badge, primary, secondary }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2">
        {back && (
          <Link to={back} className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-medium tracking-tight">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="ql-subdued mt-0.5 text-[13px]">{subtitle}</p>}
        </div>
      </div>
      {(primary || secondary) && (
        <div className="flex flex-wrap items-center gap-2">
          {secondary}
          {primary}
        </div>
      )}
    </div>
  );
}
