import { Trash2 } from 'lucide-react';
import { L } from '../../i18n';

export function LogTable<T extends { _id: string }>({
  kind,
  rows,
  columns,
  canDelete,
  onDelete,
}: {
  kind: 'feed' | 'mortality' | 'expense' | 'sale' | 'weight';
  rows: T[];
  columns: [string, (row: T) => string][];
  canDelete: boolean;
  onDelete: (kind: 'feed' | 'mortality' | 'expense' | 'sale' | 'weight', logId: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {columns.map(([label]) => <th key={label} className="px-4 py-3 text-left font-medium">{label}</th>)}
            <th className="px-4 py-3 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length + 1} className="px-4 py-10 text-center text-slate-400">{L('No records yet.')}</td></tr>
          ) : rows.map((row) => (
            <tr key={row._id}>
              {columns.map(([label, render]) => (
                <td key={label} className="px-4 py-3 text-slate-700 dark:text-slate-200">{render(row)}</td>
              ))}
              <td className="px-4 py-3 text-right">
                {canDelete && (
                  <button type="button" onClick={() => onDelete(kind, row._id)} className="text-slate-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
