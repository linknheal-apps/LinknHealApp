import React, { useState } from 'react';
import { User, MoodPayload } from '../types';
import { X, Heart, Shield, Lock, Users, Stethoscope } from 'lucide-react';

interface MoodCheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: MoodPayload, shareWithPartner: boolean, shareWithTherapist: boolean) => void;
  partner?: User;
  therapist?: User;
}

const MOOD_LEVELS = [
  { score: 1, label: 'Terrible', emoji: '😞', color: 'bg-rose-50 border-rose-200 text-rose-700' },
  { score: 2, label: 'Struggling', emoji: '🙁', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { score: 3, label: 'Okay', emoji: '😐', color: 'bg-slate-50 border-slate-200 text-slate-700' },
  { score: 4, label: 'Good', emoji: '🙂', color: 'bg-teal-50 border-teal-200 text-teal-700' },
  { score: 5, label: 'Thriving', emoji: '✨', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
];

const AVAILABLE_TAGS = [
  'Anxiety Surge',
  'Emotional Overload',
  'Triggered in Conversation',
  'Grounding Practice Used',
  'Deep Connection',
  'Sleep Restless',
  'Work Stress',
  'Gratitude',
  'Boundary Upheld',
];

export const MoodCheckinModal: React.FC<MoodCheckinModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  partner,
  therapist,
}) => {
  const [selectedScore, setSelectedScore] = useState<number>(3);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState<string>('');
  const [shareWithPartner, setShareWithPartner] = useState<boolean>(false);
  const [shareWithTherapist, setShareWithTherapist] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const currentLevel = MOOD_LEVELS.find(m => m.score === selectedScore) || MOOD_LEVELS[2];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(
      {
        score: selectedScore,
        label: currentLevel.label,
        tags: selectedTags,
        note: note.trim() || undefined,
      },
      shareWithPartner,
      shareWithTherapist
    );
    // Reset and close
    setSelectedScore(3);
    setSelectedTags([]);
    setNote('');
    setShareWithPartner(false);
    setShareWithTherapist(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Between-Session Mood Check-in</h2>
              <p className="text-xs text-slate-500">Record how you're feeling right now</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          {/* Mood Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Current State: <span className="font-bold text-slate-900">{currentLevel.label}</span>
            </label>
            <div className="grid grid-cols-5 gap-2">
              {MOOD_LEVELS.map(level => {
                const isSelected = selectedScore === level.score;
                return (
                  <button
                    key={level.score}
                    type="button"
                    onClick={() => setSelectedScore(level.score)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                      isSelected
                        ? `${level.color} ring-2 ring-emerald-500 font-semibold shadow-xs`
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="text-2xl mb-1">{level.emoji}</span>
                    <span className="text-[11px] leading-tight">{level.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Context & Physical Sensations
            </label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_TAGS.map(tag => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleTag(tag)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-600 font-medium'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Personal Note / What Happened?
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What triggered this feeling? How did you respond? (Optional)"
              className="w-full text-sm rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
            />
          </div>

          {/* Explicit Privacy & Sharing Controls (Constitution Principle I) */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Explicit Sharing Settings (Per-Entry)
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              In Link & Heal, this entry is <strong className="text-slate-800">100% PRIVATE</strong> to your vault by default.
              Check below only if you explicitly choose to share this specific entry.
            </p>

            <div className="space-y-2 pt-1">
              {partner && (
                <label className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-slate-300">
                  <input
                    type="checkbox"
                    checked={shareWithPartner}
                    onChange={e => setShareWithPartner(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
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
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div className="flex items-center gap-2 text-xs">
                    <Stethoscope className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium text-slate-800">Share with Therapist ({therapist.name})</span>
                  </div>
                </label>
              )}

              {!shareWithPartner && !shareWithTherapist && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>Kept strictly Private. Only you can read this entry.</span>
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
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
            >
              Save Check-in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
