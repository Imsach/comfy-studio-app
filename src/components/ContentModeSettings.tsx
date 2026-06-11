import { Sparkles, TrendingUp, Newspaper, Tags, X } from 'lucide-react';
import type { AutoGenContentMode } from '../types';

const CONTENT_MODES: { value: AutoGenContentMode; label: string; desc: string; icon: typeof Sparkles }[] = [
  { value: 'creative', label: 'Creative', desc: 'Original prompts from your theme', icon: Sparkles },
  { value: 'trending', label: 'Trending', desc: 'Based on current art trends & viral aesthetics', icon: TrendingUp },
  { value: 'news', label: 'News-Inspired', desc: 'Transforms current events into art', icon: Newspaper },
  { value: 'categories', label: 'Categories', desc: 'Randomly picks from your chosen topics', icon: Tags },
];

const AVAILABLE_CATEGORIES = [
  'nature', 'sci-fi', 'fantasy', 'portraits', 'architecture', 'abstract',
  'food & drink', 'animals', 'space & cosmos', 'cyberpunk', 'steampunk',
  'minimalist', 'surrealism', 'underwater', 'fashion', 'street photography',
  'macro', 'vintage', 'neon', 'mythological', 'horror', 'romance',
  'winter', 'tropical', 'urban decay', 'bioluminescent', 'medieval',
  'japanese art', 'watercolor', 'oil painting',
];

interface ContentModeSettingsProps {
  mode: AutoGenContentMode;
  categories: string[];
  onModeChange: (mode: AutoGenContentMode) => void;
  onCategoriesChange: (categories: string[]) => void;
}

export default function ContentModeSettings({
  mode,
  categories,
  onModeChange,
  onCategoriesChange,
}: ContentModeSettingsProps) {
  const toggleCategory = (cat: string) => {
    if (categories.includes(cat)) {
      onCategoriesChange(categories.filter((c) => c !== cat));
    } else {
      onCategoriesChange([...categories, cat]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {CONTENT_MODES.map(({ value, label, desc, icon: Icon }) => (
          <button
            key={value}
            onClick={() => onModeChange(value)}
            className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${
              mode === value
                ? 'bg-sky-500/10 border-sky-500/30 ring-1 ring-sky-500/10'
                : 'bg-white/[0.02] border-white/5 hover:border-white/10'
            }`}
          >
            <Icon size={14} className={mode === value ? 'text-sky-400 mt-0.5 flex-shrink-0' : 'text-white/30 mt-0.5 flex-shrink-0'} />
            <div className="min-w-0">
              <span className={`text-xs font-medium block ${mode === value ? 'text-sky-300' : 'text-white/50'}`}>
                {label}
              </span>
              <span className="text-[10px] text-white/20 leading-tight block mt-0.5">{desc}</span>
            </div>
          </button>
        ))}
      </div>

      {mode === 'categories' && (
        <div className="space-y-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <label className="text-xs text-white/40">Select Categories</label>
            {categories.length > 0 && (
              <span className="text-[10px] text-sky-400/60">{categories.length} selected</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {AVAILABLE_CATEGORIES.map((cat) => {
              const isSelected = categories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border transition-all ${
                    isSelected
                      ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                      : 'bg-white/[0.02] border-white/5 text-white/30 hover:text-white/50 hover:border-white/10'
                  }`}
                >
                  <span>{cat}</span>
                  {isSelected && <X size={10} className="text-sky-400/60" />}
                </button>
              );
            })}
          </div>
          {categories.length === 0 && (
            <p className="text-[10px] text-white/20 italic">
              No categories selected - will use default set (nature, sci-fi, fantasy, portraits, architecture)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
