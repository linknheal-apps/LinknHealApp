import React from 'react';
import { User, Entry } from '../types';
import { rlsEngine } from '../database/rlsEngine';
import { ShieldCheck, Lock, Users, Stethoscope, Trash2, Share2, CheckCircle2 } from 'lucide-react';

interface PrivacyAuditProps {
  currentUser: User;
  partner?: User;
  therapist?: User;
  onRefresh: () => void;
}

export const PrivacyAudit: React.FC<PrivacyAuditProps> = ({
  currentUser,
  partner,
  therapist,
  onRefresh,
}) => {
  // Query all entries owned by current user
  const entries = rlsEngine.selectEntries(currentUser.id).filter(e => e.owner_id === currentUser.id);
  const shares = rlsEngine.selectShares(currentUser.id);

  const handleToggleShare = (entry: Entry, targetUserId: string) => {
    const isCurrentlyShared = shares.some(
      s => s.entry_id === entry.id && s.shared_with_user_id === targetUserId
    );

    if (isCurrentlyShared) {
      rlsEngine.revokeShare(currentUser.id, entry.id, targetUserId);
    } else {
      rlsEngine.shareEntry(currentUser.id, entry.id, targetUserId);
    }
    onRefresh();
  };

  const handleDeleteEntry = (entryId: string) => {
    if (confirm('Permanently delete this entry from your vault?')) {
      rlsEngine.deleteEntry(currentUser.id, entryId);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Privacy Constitution Overview */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Your Privacy & Sharing Matrix</h3>
            <p className="text-xs text-slate-500">
              Link & Heal Principle I: No entry is visible to anyone without an explicit row in the <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-800 font-mono">shares</code> table.
            </p>
          </div>
        </div>
      </div>

      {/* Entries Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Vault Entries & Granular Permissions ({entries.length})
          </h4>
          <span className="text-xs text-slate-500">Owner ID: <code className="font-mono text-[11px] text-slate-700">{currentUser.id}</code></span>
        </div>

        {entries.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <Lock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">Your vault is currently empty</p>
            <p className="mt-1">Add a mood check-in or reflection to view and audit its privacy controls.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {entries.map(entry => {
              const entryShares = shares.filter(s => s.entry_id === entry.id);
              const isSharedWithPartner = partner ? entryShares.some(s => s.shared_with_user_id === partner.id) : false;
              const isSharedWithTherapist = therapist ? entryShares.some(s => s.shared_with_user_id === therapist.id) : false;
              const isStrictlyPrivate = entryShares.length === 0;

              return (
                <div key={entry.id} className="p-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Entry Details */}
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          entry.entry_type === 'mood_checkin'
                            ? 'bg-emerald-50 text-emerald-700'
                            : entry.entry_type === 'reflection'
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-teal-50 text-teal-700'
                        }`}>
                          {entry.entry_type === 'mood_checkin' ? 'Mood Check-in' : entry.entry_type === 'reflection' ? 'Reflection' : 'Assessment'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">{entry.id}</span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {entry.entry_type === 'mood_checkin' && (
                        <p className="text-xs text-slate-700 font-medium">
                          Mood: {(entry.body as any).label} ({(entry.body as any).score}/5) • {(entry.body as any).tags?.join(', ')}
                        </p>
                      )}

                      {entry.entry_type === 'reflection' && (
                        <p className="text-xs text-slate-800 font-medium">
                          "{(entry.body as any).title}" — <span className="text-slate-500 font-normal">{(entry.body as any).body?.substring(0, 80)}...</span>
                        </p>
                      )}

                      {entry.entry_type === 'assessment_response' && (
                        <p className="text-xs text-slate-800 font-medium">
                          {(entry.body as any).assessment_type} (Score: {(entry.body as any).summary_score}/20)
                        </p>
                      )}

                      {/* Current Status Badge */}
                      <div className="pt-1 flex items-center gap-2">
                        {isStrictlyPrivate ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <Lock className="w-3 h-3 text-emerald-600" />
                            Strictly Private (0 shares)
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isSharedWithPartner && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                <Users className="w-3 h-3 text-indigo-600" />
                                Shared with Partner ({partner?.name})
                              </span>
                            )}
                            {isSharedWithTherapist && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                                <Stethoscope className="w-3 h-3 text-teal-600" />
                                Shared with Therapist ({therapist?.name})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Permissions Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {partner && (
                        <button
                          onClick={() => handleToggleShare(entry, partner.id)}
                          className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold border transition-colors flex items-center gap-1.5 ${
                            isSharedWithPartner
                              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <Users className="w-3.5 h-3.5" />
                          {isSharedWithPartner ? 'Revoke Partner' : 'Share Partner'}
                        </button>
                      )}

                      {therapist && (
                        <button
                          onClick={() => handleToggleShare(entry, therapist.id)}
                          className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold border transition-colors flex items-center gap-1.5 ${
                            isSharedWithTherapist
                              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <Stethoscope className="w-3.5 h-3.5" />
                          {isSharedWithTherapist ? 'Revoke Therapist' : 'Share Therapist'}
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Delete entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
