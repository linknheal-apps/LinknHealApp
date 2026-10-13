import React, { useState } from 'react';
import { User } from '../types';
import { rlsEngine } from '../database/rlsEngine';
import { X, Terminal, Play, ShieldAlert, CheckCircle, Database } from 'lucide-react';

interface RawQuerySimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  users: User[];
}

export const RawQuerySimulator: React.FC<RawQuerySimulatorProps> = ({
  isOpen,
  onClose,
  currentUser,
  users,
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
  const [querySql, setQuerySql] = useState<string>('SELECT * FROM entries;');
  const [result, setResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleRunQuery = () => {
    const res = rlsEngine.executeRawQuery(selectedUserId, querySql);
    setResult(res);
  };

  const selectedUserObj = users.find(u => u.id === selectedUserId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-slate-900 text-slate-100 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-700 max-h-[90vh] flex flex-col font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-xl">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">Direct Database SQL Console</h3>
              <p className="text-xs text-slate-400">
                Testing Task T016: Proving RLS is evaluated in the PostgreSQL engine, not in frontend code
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-mono">SET LOCAL app.current_user_id =</span>
              <select
                value={selectedUserId}
                onChange={e => {
                  setSelectedUserId(e.target.value);
                  setResult(null);
                }}
                className="bg-slate-900 border border-slate-700 text-emerald-400 font-mono text-xs rounded-lg px-2.5 py-1 focus:outline-none"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    '{u.id}' ({u.name} - {u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuerySql('SELECT * FROM entries;')}
                className={`text-xs px-2.5 py-1 rounded-md font-mono ${
                  querySql === 'SELECT * FROM entries;'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                entries
              </button>
              <button
                onClick={() => setQuerySql('SELECT * FROM shares;')}
                className={`text-xs px-2.5 py-1 rounded-md font-mono ${
                  querySql === 'SELECT * FROM shares;'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                shares
              </button>
            </div>
          </div>

          {/* SQL Input */}
          <div className="relative">
            <textarea
              rows={2}
              value={querySql}
              onChange={e => setQuerySql(e.target.value)}
              className="w-full bg-slate-950 font-mono text-xs text-emerald-300 p-3 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleRunQuery}
              className="absolute right-3 bottom-3 flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
            >
              <Play className="w-3.5 h-3.5" />
              Run Query
            </button>
          </div>

          {/* Results Output */}
          <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 min-h-[160px] max-h-[35vh] overflow-y-auto font-mono text-xs">
            {result ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
                  <span>Returned Rows: <strong className="text-emerald-400">{result.rowCount}</strong></span>
                  <span className="text-[11px] text-slate-500">Session User: {selectedUserObj?.name}</span>
                </div>

                {/* Execution Plan */}
                <div className="text-[11px] text-slate-500 space-y-0.5">
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Planner & RLS Filter:</div>
                  {result.executionPlan.map((p: string, i: number) => (
                    <div key={i} className="text-slate-400">{p}</div>
                  ))}
                </div>

                {/* Output Rows */}
                {result.rows.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-xs italic bg-slate-900/60 rounded-lg">
                    (0 rows returned — RLS Filter rejected all records for this identity)
                  </div>
                ) : (
                  <div className="overflow-x-auto pt-2">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          {Object.keys(result.rows[0]).map(k => (
                            <th key={k} className="p-1.5 font-bold uppercase">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {result.rows.map((r: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-900/80">
                            {Object.values(r).map((val: any, vidx: number) => (
                              <td key={vidx} className="p-1.5 text-slate-300 truncate max-w-xs">
                                {String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">
                Click "Run Query" to evaluate PostgreSQL RLS under the chosen role identity.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 mt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
