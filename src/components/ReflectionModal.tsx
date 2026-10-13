import React, { useState } from 'react';
import { User, ReflectionPayload } from '../types';
import { X, BookOpen, Shield, Lock, Users, Stethoscope } from 'lucide-react';

interface ReflectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: ReflectionPayload, shareWithPartner: boolean, shareWithTherapist: boolean) => void;
  partner?: User;
  therapist?: User;
}

const PROMPTS = [
  'Between-Session Observation',
  'Trigger, Physical Sensation & Response',
  'Communication Breakthrough with Partner',
  'Personal Vulnerability Journal',
  'Boundary Upheld or Tested',
  'Gratitude & Micro-Moments of Peace',
];

export const ReflectionModal: React.FC<ReflectionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  partner,
  therapist,
}) => {
  const [selectedPrompt, setSelectedPrompt] = useState<string>(PROMPTS[0]);
  const [title, setTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [shareWithPartner, setShareWithPartner] = useState<boolean>(false);
  const [shareWithTherapist, setShareWithTherapist] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    onSubmit(
      {
        prompt: selectedPrompt,
        title: title.trim() || selectedPrompt,
        body: body.trim(),
      },
      shareWithPartner,
      shareWithTherapist
    );

    // Reset and close
    setTitle('');
    setBody('');
    setShareWithPartner(false);
    setShareWithTherapist(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Between-Session Reflection</h2>
              <p className="text-xs text-slate-500">Deepen insights between your therapy sessions</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Prompt Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Select Reflection Focus
            </label>
            <select
              value={selectedPrompt}
              onChange={e => setSelectedPrompt(e.target.value)}
              className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 p-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
            >
              {PROMPTS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Title or Key Theme
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Navigating difficult conversation at dinner"
              className="w-full text-sm rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Your Reflection
            </label>
            <textarea
              rows={5}
              required
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write freely. Describe what happened, your somatic signals, feelings, and what you're noticing..."
              className="w-full text-sm rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
            />
          </div>

          {/* Explicit Privacy & Sharing Controls */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Explicit Privacy Controls
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Sharing is always an explicit, per-entry choice. Unshared entries can never be viewed by your partner or therapist.
            </p>

            <div className="space-y-2 pt-1">
              {partner && (
                <label className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-slate-300">
                  <input
                    type="checkbox"
                    checked={shareWithPartner}
                    onChange={e => setShareWithPartner(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <div className="flex items-center gap-2 text-xs">
                    <Users className="w-4 h-4 text-indigo-500" />
                    <span className="font-medium text-slate-800">Share with Partner ({partner.name})</span>
                  </div>
                </label>
              )}

              {therapist && (
                <label className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-slate-300">
                  <input
                    type="checkbox"
                    checked={shareWithTherapist}
                    onChange={e => setShareWithTherapist(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <div className="flex items-center gap-2 text-xs">
                    <Stethoscope className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium text-slate-800">Share with Therapist ({therapist.name})</span>
                  </div>
                </label>
              )}

              {!shareWithPartner && !shareWithTherapist && (
                <div className="flex items-center gap-1.5 text-xs text-indigo-800 bg-indigo-50 p-2 rounded-lg">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>Kept strictly Private. Stored securely in your private vault only.</span>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
            >
              Save Reflection
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
