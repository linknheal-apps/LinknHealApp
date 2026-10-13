import React from 'react';
import { User } from '../types';
import { ShieldCheck, UserCheck, Terminal, RotateCcw, Lock, Stethoscope } from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  users: User[];
  onSelectUser: (user: User) => void;
  onOpenSecurityModal: () => void;
  onOpenQueryModal: () => void;
  onResetData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  users,
  onSelectUser,
  onOpenSecurityModal,
  onOpenQueryModal,
  onResetData,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm ring-4 ring-emerald-50">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">Link & Heal</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  RLS Active
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Between-Sessions Companion • Strict Privacy Foundation</p>
            </div>
          </div>

          {/* Persona Switcher & Tools */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Active User Switcher */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1">
              <span className="text-xs font-medium text-slate-500 pl-2 hidden md:inline">Current Role:</span>
              <select
                value={currentUser.id}
                onChange={(e) => {
                  const target = users.find(u => u.id === e.target.value);
                  if (target) onSelectUser(target);
                }}
                className="bg-white text-xs sm:text-sm font-semibold text-slate-800 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role === 'therapist' ? 'Therapist' : user.id.includes('adversary') ? 'Adversary' : 'Client'})
                  </option>
                ))}
              </select>
            </div>

            {/* Test Suite Button */}
            <button
              onClick={onOpenSecurityModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
              title="Run the 7 Phase 0 Adversarial Security Tests"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Adversarial Tests</span>
              <span className="sm:hidden">Tests</span>
            </button>

            {/* Raw SQL Query Sandbox */}
            <button
              onClick={onOpenQueryModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors"
              title="Test direct SQL query under this role's RLS session"
            >
              <Terminal className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">SQL Console</span>
            </button>

            {/* Reset Seed Data */}
            <button
              onClick={onResetData}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Reset Database to Clean Seed State"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
