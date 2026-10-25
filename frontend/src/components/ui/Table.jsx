import { cx } from '../../lib/cx';
import Skeleton from './Skeleton';

// Polaris-style index table. When rows are selected, the bulk-actions bar replaces the header.
export default function Table({ columns, rows, rowKey = 'id', selectable, selected = [], onSelect, bulkActions, onRowClick, loading, empty, caption }) {
  const allIds = rows.map((r) => r[rowKey]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));
  const toggleAll = () => onSelect(allSelected ? [] : allIds);
  const toggle = (id) => onSelect(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const colSpan = columns.length + (selectable ? 1 : 0);

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          {selectable && selected.length > 0 ? (
            <tr className="bg-[#F7F7F7] dark:bg-neutral-800">
              <th className="w-10 px-3 py-2">
                <input type="checkbox" aria-label="Select all rows" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-[#303030]" />
              </th>
              <th colSpan={columns.length} className="px-3 py-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{selected.length} selected</span>
                  {bulkActions}
                </div>
              </th>
            </tr>
          ) : (
            <tr className="bg-[#F7F7F7] text-xs text-admin-muted dark:bg-neutral-800 dark:text-neutral-400">
              {selectable && (
                <th className="w-10 px-3 py-2">
                  <input type="checkbox" aria-label="Select all rows" checked={allSelected} onChange={toggleAll} disabled={!rows.length} className="h-4 w-4 accent-[#303030]" />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cx('px-3 py-2 font-medium whitespace-nowrap', c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }, (_, i) => (
              <tr key={i} className="border-t border-admin-border dark:border-neutral-800">
                <td colSpan={colSpan} className="px-3 py-3">
                  <Skeleton className="h-4 w-full" />
                </td>
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="p-4">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const id = row[rowKey];
              const isSel = selected.includes(id);
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cx(
                    'border-t border-admin-border dark:border-neutral-800 transition-colors',
                    isSel ? 'bg-[#F1F1F1] dark:bg-neutral-800' : 'hover:bg-[#F7F7F7] dark:hover:bg-neutral-800/60',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {selectable && (
                    <td className="w-10 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select row ${id}`} checked={isSel} onChange={() => toggle(id)} className="h-4 w-4 accent-[#303030]" />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={cx('px-3 py-2.5 align-middle', c.className)}>
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pageCount, onChange, total, label = 'results' }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-admin-border bg-[#F7F7F7] px-3 py-2 text-xs text-admin-muted dark:bg-neutral-800 dark:border-neutral-800">
      <span>{total} {label}</span>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="h-8 rounded-md border border-admin-border bg-white px-2.5 disabled:opacity-40 dark:bg-neutral-900 dark:border-neutral-700" aria-label="Previous page">
          Previous
        </button>
        <span className="px-2">Page {page} of {Math.max(1, pageCount)}</span>
        <button type="button" disabled={page >= pageCount} onClick={() => onChange(page + 1)} className="h-8 rounded-md border border-admin-border bg-white px-2.5 disabled:opacity-40 dark:bg-neutral-900 dark:border-neutral-700" aria-label="Next page">
          Next
        </button>
      </div>
    </div>
  );
}
