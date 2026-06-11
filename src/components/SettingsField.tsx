interface SettingsFieldProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

export default function SettingsField({ label, description, children }: SettingsFieldProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <label className="text-sm text-white/80 font-medium">{label}</label>
        {description && <p className="text-xs text-white/30 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}
