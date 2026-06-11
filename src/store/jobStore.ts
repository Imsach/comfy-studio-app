import { create } from 'zustand';
import type { Generation } from '../types';

interface JobState {
  activeJobs: Generation[];
  addJob: (job: Generation) => void;
  updateJob: (id: string, updates: Partial<Generation>) => void;
  removeJob: (id: string) => void;
  clearJobs: () => void;
}

export const useJobStore = create<JobState>((set) => ({
  activeJobs: [],
  addJob: (job) => set((s) => ({ activeJobs: [job, ...s.activeJobs] })),
  updateJob: (id, updates) =>
    set((s) => ({
      activeJobs: s.activeJobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
    })),
  removeJob: (id) => set((s) => ({ activeJobs: s.activeJobs.filter((j) => j.id !== id) })),
  clearJobs: () => set({ activeJobs: [] }),
}));
