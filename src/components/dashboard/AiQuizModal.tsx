import React, { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { generateQuizWithAi, getAiCredits } from '@/lib/ai-generator';
import { Quiz } from '@/lib/types';
import { Bot, Loader2, Sparkles, Wand2, X, Zap } from 'lucide-react';

interface AiQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuizGenerated: (quiz: Quiz) => void;
}

export const AiQuizModal: React.FC<AiQuizModalProps> = ({
  isOpen,
  onClose,
  onQuizGenerated,
}) => {
  const { lang } = useLanguage();
  const [topic, setTopic] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [category, setCategory] = useState('BCS & Government Jobs');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');

  if (!isOpen) return null;

  const credits = getAiCredits();

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isGenerating) return;

    setIsGenerating(true);
    setGenerationStep(lang === 'bn' ? 'মডেল পেপার ও অপশন সিন্থেসিস করা হচ্ছে...' : 'Synthesizing questions and explanations...');

    try {
      const generated = await generateQuizWithAi({
        topic: topic.trim(),
        sourceText: sourceText.trim() || undefined,
        questionCount,
        difficulty,
        category,
        language: 'both',
      });
      setIsGenerating(false);
      onQuizGenerated(generated);
      onClose();
    } catch (err) {
      console.error('Quiz generation error:', err);
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isGenerating}
          className="absolute right-4 top-4 rounded-xl border border-border p-1.5 hover:bg-accent text-muted-foreground disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between pr-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">
                {lang === 'bn' ? 'AI কুইজ স্টুডিও' : 'AI Assessment Generator'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {lang === 'bn' ? 'জেমিনি AI দিয়ে মুহূর্তেই মডেল টেস্ট তৈরি করুন' : 'Generate bilingual test papers in seconds'}
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-500/30 px-2.5 py-1 text-[11px] font-mono font-bold text-violet-600 dark:text-violet-400">
            <Zap className="h-3 w-3" />
            <span>{credits} Credits</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleGenerate} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              {lang === 'bn' ? 'বিষয় বা সিলেবাস টপিক (Topic / Prompt) *' : 'Quiz Topic / Subject Prompt *'}
            </label>
            <input
              type="text"
              required
              disabled={isGenerating}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={lang === 'bn' ? 'যেমন: ৪৬তম বিসিএস মুক্তিযুদ্ধ ও বাংলাদেশ সংবিধান, ICT...' : 'e.g. 46th BCS Bangladesh Affairs & Constitution, Cyber Security...'}
              className="w-full rounded-2xl border-2 border-border bg-background px-4 py-3 text-sm font-semibold text-foreground outline-none focus:border-primary disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              {lang === 'bn' ? 'ঐচ্ছিক: লেকচার নোট বা সার্কুলার টেক্সট পেস্ট করুন' : 'Optional: Paste lecture notes or reference article'}
            </label>
            <textarea
              rows={3}
              disabled={isGenerating}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder={lang === 'bn' ? 'এখানে অনুচ্ছেদ, অনুচ্ছেদভিত্তিক প্রশ্ন বা কারিকুলাম পেস্ট করুন...' : 'Paste text snippet or syllabus excerpts...'}
              className="w-full rounded-2xl border-2 border-border bg-background p-3 text-xs text-foreground outline-none focus:border-primary disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                {lang === 'bn' ? 'প্রশ্ন সংখ্যা' : 'Question Count'}
              </label>
              <select
                disabled={isGenerating}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-background p-2.5 text-xs font-bold text-foreground outline-none focus:border-primary"
              >
                <option value={3}>3 Questions (Express)</option>
                <option value={5}>5 Questions (Standard)</option>
                <option value={10}>10 Questions (Complete Test)</option>
                <option value={20}>20 Questions (Full Mock Paper)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                {lang === 'bn' ? 'কঠিনতার মাত্রা' : 'Difficulty Level'}
              </label>
              <select
                disabled={isGenerating}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="w-full rounded-xl border border-border bg-background p-2.5 text-xs font-bold text-foreground outline-none focus:border-primary"
              >
                <option value="easy">Easy (সহজ / প্রিলিমিনারি)</option>
                <option value="medium">Medium (মাঝারি / স্ট্যান্ডার্ড)</option>
                <option value="hard">Hard (উচ্চতর / বিসিএস ক্যাডার লেভেল)</option>
              </select>
            </div>
          </div>

          {isGenerating && (
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3.5 flex items-center gap-3 animate-in fade-in">
              <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
              <div className="text-xs font-semibold text-primary">
                {generationStep}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={!topic.trim() || isGenerating}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-violet-600 py-3.5 text-sm font-extrabold text-white shadow-glow hover:opacity-95 transition disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating Exam Paper...</span>
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                <span>Generate Test with AI (1 Credit)</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
