import { Loader2, CheckCircle2, XCircle, X } from 'lucide-react';
import { useJobStore } from '../store/jobStore';
import type { Generation } from '../types';

const TYPE_LABELS: Record<string, string> = {
  image: 'Text to Image',
  edit: 'Image Edit',
  audio: 'Audio',
  '3d': '3D Generation',
};

function JobItem({ job }: { job: Generation }) {
  const removeJob = useJobStore((s) => s.removeJob);

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-white/5 rounded-lg border border-white/5">
      <div className="flex-shrink-0">
        {job.status === 'processing' && <Loader2 size={16} className="text-cyan-400 animate-spin" />}
        {job.status === 'completed' && <CheckCircle2 size={16} className="text-emerald-400" />}
        {job.status === 'failed' && <XCircle size={16} className="text-red-400" />}
        {job.status === 'pending' && <Loader2 size={16} className="text-white/30" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/40">{TYPE_LABELS[job.type] || job.type}</p>
        <p className="text-sm text-white/80 truncate">{job.prompt || 'No prompt'}</p>
        {job.status === 'processing' && (
          <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        )}
      </div>
      {(job.status === 'completed' || job.status === 'failed') && (
        <button
          onClick={() => removeJob(job.id)}
          className="p-1 text-white/30 hover:text-white/60 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default function JobQueue() {
  const activeJobs = useJobStore((s) => s.activeJobs);
  const clearJobs = useJobStore((s) => s.clearJobs);

  if (activeJobs.length === 0) return null;

  const hasCompleted = activeJobs.some((j) => j.status === 'completed' || j.status === 'failed');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Queue</h3>
        {hasCompleted && (
          <button onClick={clearJobs} className="text-xs text-white/30 hover:text-white/60 transition-colors">
            Clear all
          </button>
        )}
      </div>
      <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
        {activeJobs.map((job) => (
          <JobItem key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
