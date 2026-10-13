import React, { useState, useEffect } from 'react';
import { TestResult } from '../types';
import { runAdversarialSecuritySuite } from '../services/securityTests';
import { X, ShieldCheck, CheckCircle2, XCircle, Play, FileCode, Check, RefreshCw } from 'lucide-react';

interface SecurityTestSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuiteFinished: () => void;
}

export const SecurityTestSuiteModal: React.FC<SecurityTestSuiteModalProps> = ({
  isOpen,
  onClose,
  onSuiteFinished,
}) => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'results' | 'policies'>('results');
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

  const executeSuite = async () => {
    setIsRunning(true);
    try {
      const results = await runAdversarialSecuritySuite();
      setTestResults(results);
      if (results.length > 0 && !selectedTestId) {
        setSelectedTestId(results[0].id);
      }
      onSuiteFinished();
    } catch (e) {
      console.error('Test suite failure', e);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (isOpen && testResults.length === 0) {
      executeSuite();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const passedCount = testResults.filter(t => t.passed).length;
  const allPassed = testResults.length > 0 && passedCount === testResults.length;
  const activeTest = testResults.find(t => t.id === selectedTestId) || testResults[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${allPassed ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-700'}`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Phase 0 Adversarial Security Test Suite</h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Tasks T010–T016
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Auditing PostgreSQL Row-Level Security isolation across Client, Partner, Therapist, and Adversary
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar & Action */}
        <div className="flex items-center justify-between pt-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('results')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'results'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Test Assertions ({passedCount}/{testResults.length} Passed)
            </button>
            <button
              onClick={() => setActiveTab('policies')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'policies'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              PostgreSQL RLS Policies (SQL)
            </button>
          </div>

          <button
            onClick={executeSuite}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Running Tests...' : 'Re-run Suite'}
          </button>
        </div>

        {/* Tab 1: Test Results */}
        {activeTab === 'results' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 overflow-hidden pt-3">
            {/* Left: Test List */}
            <div className="md:col-span-5 overflow-y-auto space-y-2 pr-1 max-h-[50vh]">
              {testResults.map(t => {
                const isSelected = t.id === activeTest?.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTestId(t.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[11px] font-bold text-slate-500">{t.id} • {t.userStory}</span>
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                        {t.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                        {t.durationMs}ms
                      </span>
                    </div>
                    <div className="font-bold text-xs text-slate-800">{t.name}</div>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{t.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Right: Selected Test Trace & Logs */}
            <div className="md:col-span-7 bg-slate-900 rounded-xl p-4 text-slate-100 flex flex-col overflow-hidden max-h-[50vh]">
              {activeTest ? (
                <div className="space-y-3 flex flex-col h-full">
                  <div className="border-b border-slate-800 pb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 font-mono text-xs font-bold">{activeTest.id}: {activeTest.name}</span>
                      <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold rounded">
                        {activeTest.userStory}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{activeTest.description}</p>
                  </div>

                  <div className="text-xs text-emerald-300 font-medium bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800/40">
                    <strong>Verdict: </strong> {activeTest.details}
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[11px] text-slate-400 pt-1">
                    <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Execution Trace:</div>
                    {activeTest.log.map((step, idx) => (
                      <div key={idx} className="leading-relaxed flex items-start gap-1.5">
                        <span className="text-slate-600 select-none">{idx + 1}.</span>
                        <span className={step.includes('VERIFIED') ? 'text-emerald-400 font-bold' : step.includes('FAIL') ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-slate-500 text-xs">Select a test on the left to inspect its trace</div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: SQL Policy Inspector */}
        {activeTab === 'policies' && (
          <div className="flex-1 overflow-y-auto pt-3">
            <div className="bg-slate-900 text-slate-200 rounded-xl p-4 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 space-y-4">
              <div>
                <span className="text-slate-400 font-bold">-- 1. entries_owner_all: Owner has full read/write on own records</span>
                <p className="text-emerald-400">CREATE POLICY entries_owner_all ON entries</p>
                <p className="text-emerald-400">  FOR ALL</p>
                <p className="text-emerald-400">  USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID);</p>
              </div>

              <div>
                <span className="text-slate-400 font-bold">-- 2. entries_shared_read: Others can SELECT only if explicit share exists</span>
                <p className="text-indigo-400">CREATE POLICY entries_shared_read ON entries</p>
                <p className="text-indigo-400">  FOR SELECT</p>
                <p className="text-indigo-400">  USING (EXISTS (</p>
                <p className="text-indigo-400">    SELECT 1 FROM shares</p>
                <p className="text-indigo-400">    WHERE shares.entry_id = entries.id</p>
                <p className="text-indigo-400">      AND shares.shared_with_user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID</p>
                <p className="text-indigo-400">  ));</p>
              </div>

              <div>
                <span className="text-slate-400 font-bold">-- 3. shares_owner_manage: Only entry owner can insert/delete shares</span>
                <p className="text-teal-400">CREATE POLICY shares_owner_manage ON shares</p>
                <p className="text-teal-400">  FOR ALL</p>
                <p className="text-teal-400">  USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID);</p>
              </div>

              <div>
                <span className="text-slate-400 font-bold">-- 4. shares_visible_to_parties: Owner and recipient can view the share row</span>
                <p className="text-teal-400">CREATE POLICY shares_visible_to_parties ON shares</p>
                <p className="text-teal-400">  FOR SELECT</p>
                <p className="text-teal-400">  USING (</p>
                <p className="text-teal-400">    owner_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID</p>
                <p className="text-teal-400">    OR shared_with_user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID</p>
                <p className="text-teal-400">  );</p>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-4 mt-3 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="text-slate-500">
            Constitution Gate: 100% pass required before any Phase 1 features start.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
