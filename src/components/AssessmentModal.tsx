import React, { useState } from 'react';
import { User, AssessmentPayload } from '../types';
import { X, ClipboardCheck, Shield, Lock, Stethoscope } from 'lucide-react';

interface AssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: AssessmentPayload, shareWithTherapist: boolean) => void;
  therapist?: User;
}

const QUESTIONS = [
  { id: 'calm_baseline', text: 'How frequently did you feel emotionally grounded this past week?' },
  { id: 'stress_recovery', text: 'When conflict or stress occurred, how effectively were you able to recover?' },
  { id: 'open_communication', text: 'Did you feel safe expressing vulnerable feelings when needed?' },
  { id: 'sleep_restoration', text: 'Did your sleep feel restorative and physically replenishing?' },
];

export const AssessmentModal: React.FC<AssessmentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  therapist,
}) => {
  const [answers, setAnswers] = useState<Record<string, number>>({
    calm_baseline: 3,
    stress_recovery: 3,
    open_communication: 3,
    sleep_restoration: 3,
  });
  const [note, setNote] = useState<string>('');
  const [shareWithTherapist, setShareWithTherapist] = useState<boolean>(true);

  if (!isOpen) return null;

  const totalScore = Object.values(answers).reduce((a, b) => a + b, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(
      {
        assessment_type: 'Weekly Regulation & Stress Inventory (Phase 0 Protocol)',
        answers,
        summary_score: totalScore,
        reflection_note: note.trim() || undefined,
      },
      shareWithTherapist
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Between-Session Clinical Measure</h2>
              <p className="text-xs text-slate-500">Weekly Regulation & Stress Inventory</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <p className="text-xs text-slate-500">
            Rate each item on a 1–5 scale (1 = Rarely / Severe struggle, 5 = Consistently / Optimal regulation).
          </p>

          <div className="space-y-3">
            {QUESTIONS.map(q => (
              <div key={q.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs font-semibold text-slate-800 mb-2">{q.text}</p>
                <div className="flex items-center justify-between gap-1">
                  {[1, 2, 3, 4, 5].map(rating => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id]: rating }))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        answers[q.id] === rating
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Context for Therapist (Optional Note)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Any specific context you would like to discuss during your next session?"
              className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Explicit Privacy & Sharing */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Clinical Sharing Preference
              </span>
            </div>

            {therapist ? (
              <label className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-slate-300">
                <input
                  type="checkbox"
                  checked={shareWithTherapist}
                  onChange={e => setShareWithTherapist(e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                />
                <div className="flex items-center gap-2 text-xs">
                  <Stethoscope className="w-4 h-4 text-teal-600" />
                  <span className="font-medium text-slate-800">Submit to Therapist ({therapist.name})</span>
                </div>
              </label>
            ) : (
              <p className="text-xs text-slate-500">No therapist currently linked.</p>
            )}

            {!shareWithTherapist && (
              <div className="flex items-center gap-1.5 text-xs text-teal-800 bg-teal-50 p-2 rounded-lg">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>Private only. Not visible to therapist or partner.</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs font-semibold text-slate-600">
              Total Score: <span className="text-teal-700 text-sm font-bold">{totalScore} / 20</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition-colors"
              >
                Submit Measure
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
