import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import TextToImage from './pages/TextToImage';
import ImageEdit from './pages/ImageEdit';
import AudioGen from './pages/AudioGen';
import ThreeDGen from './pages/ThreeDGen';
import AutoGen from './pages/AutoGen';
import History from './pages/History';
import Settings from './pages/Settings';
import Docs from './pages/Docs';
import { useAppStore } from './store/appStore';
import { useServerStore } from './store/serverStore';
import { checkConnection, getAllServerUrls, getSystemStats } from './services/comfyClient';
import { getDB } from './lib/database';

function PageContent() {
  const currentPage = useAppStore((s) => s.currentPage);

  switch (currentPage) {
    case 'text-to-image':
      return <TextToImage />;
    case 'image-edit':
      return <ImageEdit />;
    case 'audio':
      return <AudioGen />;
    case '3d':
      return <ThreeDGen />;
    case 'auto-gen':
      return <AutoGen />;
    case 'history':
      return <History />;
    case 'settings':
      return <Settings />;
    case 'docs':
      return <Docs />;
    default:
      return <TextToImage />;
  }
}

function removeLoader() {
  const el = document.getElementById('app-loader');
  if (el) {
    el.style.transition = 'opacity 0.4s ease-out';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }
}

export default function App() {
  const [ready, setReady] = useState(false);
  const setConnectionStatus = useAppStore((s) => s.setConnectionStatus);
  const setStatus = useServerStore((s) => s.setStatus);

  useEffect(() => {
    getDB().then(() => {
      setReady(true);
      removeLoader();
    });
  }, []);

  useEffect(() => {
    const pollServers = async () => {
      const servers = getAllServerUrls();
      const connected = await checkConnection();
      setConnectionStatus(connected ? 'connected' : 'disconnected');

      for (const server of servers) {
        try {
          const stats = await getSystemStats(server.url);
          setStatus(server.id, {
            serverId: server.id,
            url: server.url,
            connected: true,
            gpus: stats.gpus,
            queueRemaining: stats.queueRemaining,
            lastChecked: Date.now(),
          });
        } catch {
          setStatus(server.id, {
            serverId: server.id,
            url: server.url,
            connected: false,
            gpus: [],
            queueRemaining: 0,
            lastChecked: Date.now(),
          });
        }
      }
    };

    pollServers();
    const interval = setInterval(pollServers, 10000);
    return () => clearInterval(interval);
  }, [setConnectionStatus, setStatus]);

  if (!ready) return null;

  return (
    <div className="flex h-screen bg-[#08080f] text-white overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pt-12 pb-16 md:pt-0 md:pb-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
          <PageContent />
        </div>
      </main>
    </div>
  );
}
