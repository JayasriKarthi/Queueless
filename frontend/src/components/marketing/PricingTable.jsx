import { Fragment } from 'react';
import { Check, Minus } from 'lucide-react';
import { PLANS, COMPARISON_ROWS } from '../../config/plans';
import { formatNumber } from '../../lib/formatters';

function Cell({ value }) {
  if (value === true) return <><Check className="mx-auto h-5 w-5 text-teal" aria-hidden="true" /><span className="sr-only">Included</span></>;
  if (value === false) return <><Minus className="mx-auto h-5 w-5 text-black/25" aria-hidden="true" /><span className="sr-only">Not included</span></>;
  return <span>{formatNumber(value)}</span>;
}

export default function PricingTable() {
  const groups = [...new Set(COMPARISON_ROWS.map((r) => r.group))];
  return (
    <div className="mt-16 relative overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[15px]">
        <caption className="sr-only">Compare plans</caption>
        <thead>
          <tr className="border-b border-black/10">
            <th scope="col" className="py-4 pr-4 font-medium">Compare plans</th>
            {PLANS.map((p) => (
              <th key={p.id} scope="col" className="px-3 py-4 text-center font-medium">{p.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g}>
              <tr>
                <th colSpan={PLANS.length + 1} scope="colgroup" className="pb-2 pt-8 text-sm font-medium text-teal-700">{g}</th>
              </tr>
              {COMPARISON_ROWS.filter((r) => r.group === g).map((row) => (
                <tr key={row.label} className="border-b border-black/5">
                  <th scope="row" className="py-3 pr-4 font-normal text-black/75">{row.label}</th>
                  {PLANS.map((p) => (
                    <td key={p.id} className="px-3 py-3 text-center"><Cell value={row.get(p)} /></td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
