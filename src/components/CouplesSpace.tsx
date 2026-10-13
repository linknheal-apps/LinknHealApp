import React from 'react';
import { User, Entry, PartnerLink, Share } from '../types';
import { Heart, ShieldAlert, ShieldCheck, Lock, Users, AlertCircle, Calendar } from 'lucide-react';
import { rlsEngine } from '../database/rlsEngine';

interface CouplesSpaceProps {
  currentUser: User;
  partner?: User;
  partnerLink?: PartnerLink;
  onUpdateLinkStatus: (status: 'active' | 'pending' | 'ended') => void;
  onOpenMoodCheckin: () => void;
  onOpenReflection: () => void;
  onRefresh: () => void;
}

export const CouplesSpace: React.FC<CouplesSpaceProps> = ({
  currentUser,
  partner,
  partnerLink,
  onUpdateLinkStatus,
  onOpenMoodCheckin,
  onOpenReflection,
  onRefresh,
}) => {
  if (!partner) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="font-bold text-slate-800 text-lg">No Linked Partner</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          Switch to Maya Lin or Leo Miller to view the couples between-sessions space.
        </p>
      </div>
    );
  }

  // Under RLS, query what entries are visible to the current user
  const visibleEntries = rlsEngine.selectEntries(currentUser.id);

  // Entries that belong to partner AND are shared with current user
  const partnerSharedEntries = visibleEntries.filter(e => e.owner_id === partner.id);

  // Entries owned by current user that are shared with partner
  const myShares = rlsEngine.selectShares(currentUser.id);
  const myEntriesSharedWithPartner = visibleEntries.filter(e => {
    if (e.owner_id !== currentUser.id) return false;
    return myShares.some(s => s.entry_id === e.id && s.shared_with_user_id === partner.id);
  });

  const isLinkEnded = partnerLink?.status === 'ended';

  return (
    <div className="space-y-6">
      {/* Partner Connection Banner */}
      <div className="bg-gradient-to-br from-indigo-50/70 via-white to-pink-50/40 rounded-2xl border border-indigo-100 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-xs"
              />
              <img
                src={partner.avatar}
                alt={partner.name}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-xs absolute -bottom-1 -right-1"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900">{currentUser.name} & {partner.name}</h3>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    partnerLink?.status === 'active'
                      ? 'bg-emerald-100 text-emerald-800'
                      : partnerLink?.status === 'ended'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {partnerLink?.status === 'active' ? 'Active Link' : partnerLink?.status === 'ended' ? 'Link Ended' : 'Pending Link'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Couples Between-Sessions Space • Explicit Sharing Vault
              </p>
            </div>
          </div>

          {/* Relationship Status Controller to test isolation */}
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-xs p-1.5 rounded-xl border border-indigo-100 text-xs">
            <span className="text-slate-500 font-medium pl-1">Link State:</span>
            <select
              value={partnerLink?.status || 'active'}
              onChange={e => onUpdateLinkStatus(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700 focus:outline-none"
            >
              <option value="active">Active</option>
              <option value="ended">Ended (Adversarial test 6)</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Isolation Explanation */}
        <div className="mt-4 p-3 bg-white/90 rounded-xl border border-indigo-100/80 flex items-start gap-2.5 text-xs text-slate-600">
          <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-800">Strict Privacy Guarantee: </strong>
            Neither partner can ever read the other's unshared check-ins, journal entries, or clinical assessments.
            Even when your relationship status is "Active", items are strictly private unless explicitly shared via the per-entry share toggle.
          </div>
        </div>
      </div>

      {/* Quick Sharing Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <span className="text-xs font-semibold text-slate-600">
          Share a between-sessions update with {partner.name}:
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenMoodCheckin}
            className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
          >
            + Mood Check-in
          </button>
          <button
            onClick={onOpenReflection}
            className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
          >
            + Reflection Note
          </button>
        </div>
      </div>

      {/* Shared Feed Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Shared by Partner to Me */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-600" />
              Shared by {partner.name} with You ({partnerSharedEntries.length})
            </h4>
          </div>

          {partnerSharedEntries.length === 0 ? (
            <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
              <Lock className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">No entries shared by {partner.name} yet</p>
              <p className="mt-1">
                {partner.name}'s private entries are inaccessible by design. Switch to {partner.name}'s role to share an entry with you!
              </p>
            </div>
          ) : (
            partnerSharedEntries.map(entry => (
              <div key={entry.id} className="bg-white rounded-xl border border-indigo-100 p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                    {entry.entry_type === 'reflection' ? 'Reflection' : 'Mood Check-in'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </span>
                </div>

                {entry.entry_type === 'reflection' && (
                  <div>
                    <h5 className="font-bold text-sm text-slate-900">{(entry.body as any).title}</h5>
                    <p className="text-xs text-slate-500 italic mt-0.5">Focus: {(entry.body as any).prompt}</p>
                    <p className="text-xs text-slate-700 mt-2 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      {(entry.body as any).body}
                    </p>
                  </div>
                )}

                {entry.entry_type === 'mood_checkin' && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <span>Mood: {(entry.body as any).label}</span>
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">Score: {(entry.body as any).score}/5</span>
                    </div>
                    {(entry.body as any).note && (
                      <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded-lg">{(entry.body as any).note}</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Shared by Me to Partner */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-600" />
              Shared by You with {partner.name} ({myEntriesSharedWithPartner.length})
            </h4>
          </div>

          {myEntriesSharedWithPartner.length === 0 ? (
            <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
              <p className="font-semibold text-slate-700">You haven't shared any entries with {partner.name} yet</p>
              <p className="mt-1">
                Create a check-in or reflection and check the "Share with Partner" option.
              </p>
            </div>
          ) : (
            myEntriesSharedWithPartner.map(entry => (
              <div key={entry.id} className="bg-white rounded-xl border border-emerald-100 p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {entry.entry_type === 'reflection' ? 'Reflection' : 'Mood Check-in'}
                  </span>
                  <button
                    onClick={() => {
                      rlsEngine.revokeShare(currentUser.id, entry.id, partner.id);
                      onRefresh();
                    }}
                    className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold"
                  >
                    Revoke Share
                  </button>
                </div>

                {entry.entry_type === 'reflection' && (
                  <div>
                    <h5 className="font-bold text-sm text-slate-900">{(entry.body as any).title}</h5>
                    <p className="text-xs text-slate-700 mt-1 line-clamp-2">{(entry.body as any).body}</p>
                  </div>
                )}

                {entry.entry_type === 'mood_checkin' && (
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Mood: {(entry.body as any).label} ({(entry.body as any).score}/5)</p>
                    {(entry.body as any).note && <p className="text-xs text-slate-600 mt-1">{(entry.body as any).note}</p>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
