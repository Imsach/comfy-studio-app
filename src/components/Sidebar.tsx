import { useState } from 'react';
import {
  Image,
  Pencil,
  Music,
  Box,
  Wand2,
  Clock,
  Settings,
  FileText,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff,
  Zap,
  Menu,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useJobStore } from '../store/jobStore';
import type { PageId } from '../types';

interface NavItem {
  id: PageId;
  label: string;
  shortLabel?: string;
  icon: React.ReactNode;
  mobileIcon: React.ReactNode;
  color: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'text-to-image', label: 'Text to Image', shortLabel: 'Image', icon: <Image size={18} />, mobileIcon: <Image size={20} />, color: 'text-cyan-400' },
  { id: 'image-edit', label: 'Image Edit', shortLabel: 'Edit', icon: <Pencil size={18} />, mobileIcon: <Pencil size={20} />, color: 'text-amber-400' },
  { id: 'audio', label: 'Audio', icon: <Music size={18} />, mobileIcon: <Music size={20} />, color: 'text-emerald-400' },
  { id: '3d', label: '3D Generation', shortLabel: '3D', icon: <Box size={18} />, mobileIcon: <Box size={20} />, color: 'text-rose-400' },
  { id: 'auto-gen', label: 'Auto Generate', shortLabel: 'Auto', icon: <Wand2 size={18} />, mobileIcon: <Wand2 size={20} />, color: 'text-sky-400' },
];

const BOTTOM_ITEMS: NavItem[] = [
  { id: 'history', label: 'History', icon: <Clock size={18} />, mobileIcon: <Clock size={20} />, color: 'text-white/50' },
  { id: 'docs', label: 'Documentation', shortLabel: 'Docs', icon: <FileText size={18} />, mobileIcon: <FileText size={20} />, color: 'text-white/50' },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} />, mobileIcon: <Settings size={20} />, color: 'text-white/50' },
];

export default function Sidebar() {
  const currentPage = useAppStore((s) => s.currentPage);
  const setPage = useAppStore((s) => s.setPage);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const connectionStatus = useAppStore((s) => s.connectionStatus);
  const activeJobs = useJobStore((s) => s.activeJobs);
  const [mobileOpen, setMobileOpen] = useState(false);

  const processingCount = activeJobs.filter((j) => j.status === 'processing' || j.status === 'pending').length;

  const handleNavClick = (id: PageId) => {
    setPage(id);
    setMobileOpen(false);
  };

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-12 bg-[#0c0c14]/95 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-gradient-to-br from-cyan-500/20 to-teal-500/20">
            <Zap size={14} className="text-cyan-400" />
          </div>
          <span className="text-sm font-semibold text-white">Mufiji</span>
        </div>
        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' ? (
            <Wifi size={14} className="text-emerald-400" />
          ) : (
            <WifiOff size={14} className="text-red-400/60" />
          )}
          {processingCount > 0 && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-cyan-500/10 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] text-cyan-300">{processingCount}</span>
            </div>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-all"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}
      {mobileOpen && (
        <div className="md:hidden fixed top-12 right-0 z-50 w-56 bg-[#0c0c14]/95 backdrop-blur-xl border-l border-b border-white/5 rounded-bl-xl shadow-2xl animate-fade-in max-h-[calc(100vh-3rem)] overflow-y-auto">
          <nav className="py-2 px-2 space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  currentPage === item.id
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
              >
                <span className={currentPage === item.id ? item.color : 'text-white/30'}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="border-t border-white/5 py-2 px-2 space-y-0.5">
            {BOTTOM_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  currentPage === item.id
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0c0c14]/95 backdrop-blur-xl border-t border-white/5 safe-area-bottom">
        <div className="flex items-center justify-around px-1 py-1.5 max-w-md mx-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all min-w-0 flex-1 ${
                currentPage === item.id
                  ? 'text-white'
                  : 'text-white/25 active:text-white/50'
              }`}
            >
              <span className={currentPage === item.id ? item.color : ''}>{item.mobileIcon}</span>
              <span className="text-[9px] truncate w-full text-center leading-tight">
                {item.shortLabel || item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <aside
        className={`hidden md:flex flex-col h-screen bg-[#0c0c14]/80 backdrop-blur-xl border-r border-white/5 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-white/5">
          <div className="flex-shrink-0 p-1.5 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/20">
            <Zap size={16} className="text-cyan-400" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-white tracking-tight">Mufiji</span>
          )}
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-200 group ${
                currentPage === item.id
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
              }`}
            >
              <span
                className={`flex-shrink-0 ${
                  currentPage === item.id ? item.color : 'text-white/30 group-hover:text-white/50'
                }`}
              >
                {item.icon}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        {processingCount > 0 && (
          <div className="mx-2 mb-2 px-2.5 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              {!collapsed && (
                <span className="text-xs text-cyan-300">
                  {processingCount} job{processingCount > 1 ? 's' : ''} running
                </span>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-white/5 py-2 px-2 space-y-0.5">
          {BOTTOM_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-200 ${
                currentPage === item.id
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]'
              }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </div>

        <div className="border-t border-white/5 px-2 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 px-2">
            {connectionStatus === 'connected' ? (
              <Wifi size={14} className="text-emerald-400" />
            ) : (
              <WifiOff size={14} className="text-red-400/60" />
            )}
            {!collapsed && (
              <span className={`text-xs ${connectionStatus === 'connected' ? 'text-emerald-400/60' : 'text-red-400/40'}`}>
                {connectionStatus === 'connected' ? 'Online' : 'Offline'}
              </span>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md text-white/20 hover:text-white/40 hover:bg-white/5 transition-all"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </aside>
    </>
  );
}
