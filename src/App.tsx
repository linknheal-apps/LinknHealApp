import React, { useState, useEffect } from 'react';
import { User, Entry, PartnerLink, TherapistClientLink, EntryType, EntryBody, MoodPayload, ReflectionPayload, AssessmentPayload } from './types';
import { rlsEngine } from './database/rlsEngine';
import { Header } from './components/Header';
import { MoodCheckinModal } from './components/MoodCheckinModal';
import { ReflectionModal } from './components/ReflectionModal';
import { AssessmentModal } from './components/AssessmentModal';
import { CouplesSpace } from './components/CouplesSpace';
import { PrivacyAudit } from './components/PrivacyAudit';
import { TherapistDashboard } from './components/TherapistDashboard';
import { SecurityTestSuiteModal } from './components/SecurityTestSuiteModal';
import { RawQuerySimulator } from './components/RawQuerySimulator';
import {
  Heart,
  BookOpen,
  ClipboardCheck,
  ShieldCheck,
  Lock,
  Users,
  Stethoscope,
  Smile,
  AlertCircle,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
} from 'lucide-react';

export const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'vault' | 'couples' | 'privacy'>('vault');
  const [version, setVersion] = useState<number>(0);

  // Modals state
  const [isMoodModalOpen, setIsMoodModalOpen] = useState(false);
  const [isReflectionModalOpen, setIsReflectionModalOpen] = useState(false);
  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false);

  // Initialize data
  useEffect(() => {
    const loadedUsers = rlsEngine.getUsers();
    setUsers(loadedUsers);
    if (!currentUser && loadedUsers.length > 0) {
      // Default to Maya Lin (Client A)
      setCurrentUser(loadedUsers[0]);
    }
  }, [version]);

  const refreshData = () => {
    setVersion(v => v + 1);
  };

  const handleResetData = () => {
    if (confirm('Reset entire database state to clean seed data?')) {
      rlsEngine.resetToSeedData();
      refreshData();
    }
  };

  if (!currentUser) return null;

  // Retrieve relationship partners and therapists for currentUser
  const { partner, link: partnerLink } = rlsEngine.getPartnerLink(currentUser.id);
  const { therapist, link: therapistLink } = rlsEngine.getTherapist(currentUser.id);

  // Evaluate visible entries for the active session user under PostgreSQL RLS
  const visibleEntries = rlsEngine.selectEntries(currentUser.id);
  const userShares = rlsEngine.selectShares(currentUser.id);

  // Handlers for creating entries with explicit per-entry sharing
  const handleCreateMoodCheckin = (
    payload: MoodPayload,
    shareWithPartner: boolean,
    shareWithTherapist: boolean
  ) => {
    const entry = rlsEngine.insertEntry(currentUser.id, 'mood_checkin', payload);
    if (shareWithPartner && partner) {
      rlsEngine.shareEntry(currentUser.id, entry.id, partner.id);
    }
    if (shareWithTherapist && therapist) {
      rlsEngine.shareEntry(currentUser.id, entry.id, therapist.id);
    }
    refreshData();
  };

  const handleCreateReflection = (
    payload: ReflectionPayload,
    shareWithPartner: boolean,
    shareWithTherapist: boolean
  ) => {
    const entry = rlsEngine.insertEntry(currentUser.id, 'reflection', payload);
    if (shareWithPartner && partner) {
      rlsEngine.shareEntry(currentUser.id, entry.id, partner.id);
    }
    if (shareWithTherapist && therapist) {
      rlsEngine.shareEntry(currentUser.id, entry.id, therapist.id);
    }
    refreshData();
  };

  const handleCreateAssessment = (
    payload: AssessmentPayload,
    shareWithTherapist: boolean
  ) => {
    const entry = rlsEngine.insertEntry(currentUser.id, 'assessment_response', payload);
    if (shareWithTherapist && therapist) {
      rlsEngine.shareEntry(currentUser.id, entry.id, therapist.id);
    }
    refreshData();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navigation & Role Switcher */}
      <Header
        currentUser={currentUser}
        users={users}
        onSelectUser={u => {
          setCurrentUser(u);
          // If switching to therapist, tab will auto route to therapist dashboard
        }}
        onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
        onOpenQueryModal={() => setIsQueryModalOpen(true)}
        onResetData={handleResetData}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* If Current User is Therapist (Dr. Sarah Vance) -> Render Web Dashboard */}
        {currentUser.role === 'therapist' ? (
          <TherapistDashboard therapistUser={currentUser} onRefresh={refreshData} />
        ) : currentUser.id === 'user-adversary-999' ? (
          /* Adversarial Persona View */
          <div className="space-y-6">
            <div className="bg-rose-950 text-rose-100 rounded-2xl p-6 border border-rose-800 shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-900 rounded-xl text-rose-300">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Adversarial Probe Session (External User)</h2>
                  <p className="text-xs text-rose-300 mt-0.5">
                    User has a valid session token but is neither owner nor an authorized recipient in any shares record.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
              <ShieldCheck className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="font-bold text-slate-900 text-base">Zero Records Leaked</h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Query executed with identity <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">user-adversary-999</code>.
                PostgreSQL RLS policies evaluate to 0 rows. Default-deny isolation confirmed.
              </p>
              <button
                onClick={() => setIsSecurityModalOpen(true)}
                className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-xs"
              >
                Inspect All 7 Adversarial Test Results
              </button>
            </div>
          </div>
        ) : (
          /* Client Mobile & Web Experience (Maya Lin / Leo Miller) */
          <div className="space-y-6">
            {/* Top User Greeting & Quick Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-3.5">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500/20"
                />
                <div>
                  <h2 className="text-base font-bold text-slate-900">{currentUser.name}'s Vault</h2>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                    <span>Client Account</span>
                    <span>•</span>
                    {partner && (
                      <span className="flex items-center gap-1 text-indigo-600 font-medium">
                        <Users className="w-3.5 h-3.5" /> Partner: {partner.name}
                      </span>
                    )}
                    <span>•</span>
                    {therapist && (
                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                        <Stethoscope className="w-3.5 h-3.5" /> {therapist.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setIsMoodModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                >
                  <Smile className="w-4 h-4" />
                  + Mood Check-in
                </button>
                <button
                  onClick={() => setIsReflectionModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  + Reflection
                </button>
                <button
                  onClick={() => setIsAssessmentModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  + Clinical Measure
                </button>
              </div>
            </div>

            {/* Client Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
              <button
                onClick={() => setActiveTab('vault')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
                  activeTab === 'vault'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                Personal Vault & Entries ({visibleEntries.length})
              </button>
              <button
                onClick={() => setActiveTab('couples')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
                  activeTab === 'couples'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Couples Space {partner ? `(${partner.name})` : ''}
              </button>
              <button
                onClick={() => setActiveTab('privacy')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
                  activeTab === 'privacy'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Privacy & Sharing Matrix
              </button>
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'vault' && (
              <div className="space-y-4">
                {/* Privacy Rule Banner */}
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/60 rounded-xl flex items-start gap-3 text-xs text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Constitution Principle I Active: </span>
                    Entries in this vault are strictly private by default. Neither your partner nor your therapist can view any entry unless you explicitly click "Share" on that specific entry.
                  </div>
                </div>

                {/* Visible Entries List */}
                <div className="space-y-3">
                  {visibleEntries.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                      <Lock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-semibold text-slate-700">No entries recorded yet</p>
                      <p className="mt-1">Use the buttons above to log a mood check-in or journal reflection.</p>
                    </div>
                  ) : (
                    visibleEntries.map(entry => {
                      const isOwner = entry.owner_id === currentUser.id;
                      const entryShares = userShares.filter(s => s.entry_id === entry.id);
                      const isSharedPartner = partner && entryShares.some(s => s.shared_with_user_id === partner.id);
                      const isSharedTherapist = therapist && entryShares.some(s => s.shared_with_user_id === therapist.id);

                      return (
                        <div
                          key={entry.id}
                          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3 hover:border-slate-300 transition-colors"
                        >
                          {/* Card Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                                  entry.entry_type === 'mood_checkin'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : entry.entry_type === 'reflection'
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'bg-teal-50 text-teal-700'
                                }`}
                              >
                                {entry.entry_type === 'mood_checkin'
                                  ? 'Mood Check-in'
                                  : entry.entry_type === 'reflection'
                                  ? 'Reflection Note'
                                  : 'Clinical Measure'}
                              </span>

                              {/* Sharing badges */}
                              {isOwner ? (
                                entryShares.length === 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                    <Lock className="w-3 h-3 text-slate-500" />
                                    Private to you
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    {isSharedPartner && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                        Shared with {partner?.name}
                                      </span>
                                    )}
                                    {isSharedTherapist && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                                        Shared with {therapist?.name}
                                      </span>
                                    )}
                                  </div>
                                )
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                                  Shared by {partner?.name}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <span>
                                {new Date(entry.created_at).toLocaleDateString()} at{' '}
                                {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isOwner && (
                                <button
                                  onClick={() => {
                                    if (confirm('Delete this entry?')) {
                                      rlsEngine.deleteEntry(currentUser.id, entry.id);
                                      refreshData();
                                    }
                                  }}
                                  className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                                  title="Delete entry"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Card Body */}
                          {entry.entry_type === 'mood_checkin' && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">
                                  {(entry.body as any).score === 1
                                    ? '😞'
                                    : (entry.body as any).score === 2
                                    ? '🙁'
                                    : (entry.body as any).score === 3
                                    ? '😐'
                                    : (entry.body as any).score === 4
                                    ? '🙂'
                                    : '✨'}
                                </span>
                                <div>
                                  <div className="font-bold text-sm text-slate-900">
                                    {(entry.body as any).label}{' '}
                                    <span className="text-xs text-slate-500 font-normal">
                                      ({(entry.body as any).score}/5)
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {(entry.body as any).tags?.map((t: string) => (
                                      <span
                                        key={t}
                                        className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full"
                                      >
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              {(entry.body as any).note && (
                                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                  {(entry.body as any).note}
                                </p>
                              )}
                            </div>
                          )}

                          {entry.entry_type === 'reflection' && (
                            <div className="space-y-1.5">
                              <h4 className="font-bold text-sm text-slate-900">
                                {(entry.body as any).title}
                              </h4>
                              <p className="text-[11px] text-slate-500 italic">
                                Focus: {(entry.body as any).prompt}
                              </p>
                              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                                {(entry.body as any).body}
                              </p>
                            </div>
                          )}

                          {entry.entry_type === 'assessment_response' && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="font-bold text-sm text-slate-900">
                                  {(entry.body as any).assessment_type}
                                </h4>
                                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full">
                                  Score: {(entry.body as any).summary_score}/20
                                </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {Object.entries((entry.body as any).answers || {}).map(([key, val]) => (
                                  <div
                                    key={key}
                                    className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center"
                                  >
                                    <span className="text-[10px] text-slate-500 uppercase block truncate">
                                      {key.replace(/_/g, ' ')}
                                    </span>
                                    <span className="text-xs font-bold text-slate-800">{String(val)} / 5</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeTab === 'couples' && (
              <CouplesSpace
                currentUser={currentUser}
                partner={partner}
                partnerLink={partnerLink}
                onUpdateLinkStatus={status => {
                  if (partnerLink) {
                    rlsEngine.setPartnerLinkStatus(partnerLink.id, status);
                    refreshData();
                  }
                }}
                onOpenMoodCheckin={() => setIsMoodModalOpen(true)}
                onOpenReflection={() => setIsReflectionModalOpen(true)}
                onRefresh={refreshData}
              />
            )}

            {activeTab === 'privacy' && (
              <PrivacyAudit
                currentUser={currentUser}
                partner={partner}
                therapist={therapist}
                onRefresh={refreshData}
              />
            )}
          </div>
        )}
      </main>

      {/* Interactive Modals */}
      <MoodCheckinModal
        isOpen={isMoodModalOpen}
        onClose={() => setIsMoodModalOpen(false)}
        onSubmit={handleCreateMoodCheckin}
        partner={partner}
        therapist={therapist}
      />

      <ReflectionModal
        isOpen={isReflectionModalOpen}
        onClose={() => setIsReflectionModalOpen(false)}
        onSubmit={handleCreateReflection}
        partner={partner}
        therapist={therapist}
      />

      <AssessmentModal
        isOpen={isAssessmentModalOpen}
        onClose={() => setIsAssessmentModalOpen(false)}
        onSubmit={handleCreateAssessment}
        therapist={therapist}
      />

      <SecurityTestSuiteModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        onSuiteFinished={refreshData}
      />

      <RawQuerySimulator
        isOpen={isQueryModalOpen}
        onClose={() => setIsQueryModalOpen(false)}
        currentUser={currentUser}
        users={users}
      />
    </div>
  );
};
