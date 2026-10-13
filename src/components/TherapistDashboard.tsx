import React, { useState } from 'react';
import { User, Entry } from '../types';
import { rlsEngine } from '../database/rlsEngine';
import { Stethoscope, ShieldCheck, Lock, UserCheck, Calendar, ClipboardCheck, ArrowUpRight, FileText } from 'lucide-react';

interface TherapistDashboardProps {
  therapistUser: User;
  onRefresh: () => void;
}

export const TherapistDashboard: React.FC<TherapistDashboardProps> = ({
  therapistUser,
  onRefresh,
}) => {
  const clients = rlsEngine.getTherapistClients(therapistUser.id);
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id || '');
  const [assignedNote, setAssignedNote] = useState<string>('');
  const [showAssignPrompt, setShowAssignPrompt] = useState<boolean>(false);

  // Under RLS, Dr. Sarah selects entries
  const visibleEntries = rlsEngine.selectEntries(therapistUser.id);

  // Filter for currently selected client
  const clientEntries = visibleEntries.filter(e => e.owner_id === selectedClientId);
  const selectedClient = clients.find(c => c.id === selectedClientId) || clients[0];

  return (
    <div className="space-y-6">
      {/* Therapist Clinic Banner */}
      <div className="bg-gradient-to-r from-teal-800 to-emerald-900 text-white rounded-2xl p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={therapistUser.avatar}
              alt={therapistUser.name}
              className="w-14 h-14 rounded-2xl object-cover ring-2 ring-emerald-400/40"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">{therapistUser.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                  Clinical Portal (Web)
                </span>
              </div>
              <p className="text-xs text-teal-200 mt-1">
                Between-Sessions Review • Practice Roster ({clients.length} Active Clients)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-teal-900/80 border border-teal-700/60 rounded-xl p-3 text-xs">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="font-semibold text-emerald-100">PostgreSQL RLS Enforced</div>
              <div className="text-teal-300 text-[11px]">You only see records explicitly shared by clients</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Client Roster */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Assigned Clients
          </h3>
          <div className="space-y-2">
            {clients.map(client => {
              const isSelected = client.id === selectedClientId;
              const sharedCount = visibleEntries.filter(e => e.owner_id === client.id).length;

              return (
                <button
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-teal-50 border-teal-300 ring-2 ring-teal-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={client.avatar}
                      alt={client.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{client.name}</h4>
                      <p className="text-[11px] text-slate-500">{client.email}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {sharedCount} shared
                  </span>
                </button>
              );
            })}
          </div>

          {/* RLS Clinical Defense Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1.5">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              Confidentiality Boundary
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Even with an active therapist link, clients' private reflections and unshared couple conversations are excluded at the database level.
            </p>
          </div>
        </div>

        {/* Right Column: Client Shared Stream & Clinical Notes */}
        <div className="lg:col-span-3 space-y-4">
          {selectedClient && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Between-Sessions Submissions: {selectedClient.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Showing {clientEntries.length} entries explicitly shared with Dr. Sarah Vance
                  </p>
                </div>

                <button
                  onClick={() => setShowAssignPrompt(true)}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs transition-colors self-start sm:self-auto"
                >
                  + Assign Between-Session Prompt
                </button>
              </div>

              {/* Assignment Notice Modal / Banner */}
              {showAssignPrompt && (
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-900">
                      Assign Homework or Measure to {selectedClient.name}
                    </span>
                    <button
                      onClick={() => setShowAssignPrompt(false)}
                      className="text-xs text-teal-700 font-bold hover:underline"
                    >
                      Dismiss
                    </button>
                  </div>
                  <input
                    type="text"
                    value={assignedNote}
                    onChange={e => setAssignedNote(e.target.value)}
                    placeholder="e.g. Please log a reflection on the dinner communication breakthrough before Thursday"
                    className="w-full text-xs sm:text-sm p-2.5 rounded-lg border border-teal-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        alert(`Assignment assigned to ${selectedClient.name}: "${assignedNote || 'Standard Weekly Reflection'}"`);
                        setShowAssignPrompt(false);
                        setAssignedNote('');
                      }}
                      className="px-3 py-1.5 text-xs font-bold bg-teal-700 text-white rounded-lg hover:bg-teal-800"
                    >
                      Save Assignment
                    </button>
                  </div>
                </div>
              )}

              {/* Shared Entries Stream */}
              {clientEntries.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                  <Lock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">No entries currently shared with you by {selectedClient.name}</p>
                  <p className="mt-1">
                    Unshared check-ins and journal entries are securely protected in the client's vault.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clientEntries.map(entry => (
                    <div key={entry.id} className="p-4 rounded-xl border border-teal-100 bg-teal-50/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800">
                            {entry.entry_type === 'assessment_response'
                              ? 'Clinical Assessment'
                              : entry.entry_type === 'reflection'
                              ? 'Reflection Note'
                              : 'Mood Check-in'}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">{entry.id}</span>
                        </div>
                        <span className="text-xs text-slate-400">
                          {new Date(entry.created_at).toLocaleDateString()} at {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {entry.entry_type === 'assessment_response' && (
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">
                            {(entry.body as any).assessment_type}
                          </h4>
                          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {Object.entries((entry.body as any).answers || {}).map(([key, val]) => (
                              <div key={key} className="bg-white p-2 rounded-lg border border-teal-100 text-center">
                                <span className="text-[10px] text-slate-500 uppercase block truncate">{key.replace(/_/g, ' ')}</span>
                                <span className="text-xs font-bold text-teal-700">{String(val)} / 5</span>
                              </div>
                            ))}
                          </div>
                          {(entry.body as any).reflection_note && (
                            <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-teal-100 mt-2">
                              <strong>Client Note:</strong> {(entry.body as any).reflection_note}
                            </p>
                          )}
                        </div>
                      )}

                      {entry.entry_type === 'reflection' && (
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{(entry.body as any).title}</h4>
                          <p className="text-xs text-slate-700 mt-1 leading-relaxed bg-white p-3 rounded-lg border border-teal-100">
                            {(entry.body as any).body}
                          </p>
                        </div>
                      )}

                      {entry.entry_type === 'mood_checkin' && (
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                            <span>Mood: {(entry.body as any).label}</span>
                            <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded">Score: {(entry.body as any).score}/5</span>
                          </div>
                          {(entry.body as any).note && (
                            <p className="text-xs text-slate-600 mt-2 bg-white p-2 rounded-lg border border-teal-100">
                              {(entry.body as any).note}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
