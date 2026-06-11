import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Download, RotateCcw } from 'lucide-react';

interface ThreeViewerProps {
  modelUrl?: string;
  onDownload?: () => void;
}

export default function ThreeViewer({ modelUrl, onDownload }: ThreeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    animationId: number;
    mesh: THREE.Mesh | null;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);

    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(2, 2, 3);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x404060, 2);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0x00cccc, 3);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);
    const dirLight2 = new THREE.DirectionalLight(0x008888, 1.5);
    dirLight2.position.set(-3, 2, -3);
    scene.add(dirLight2);

    const gridHelper = new THREE.GridHelper(6, 12, 0x1a1a2e, 0x0d0d1a);
    scene.add(gridHelper);

    let mesh: THREE.Mesh | null = null;
    if (!modelUrl) {
      const geometry = new THREE.IcosahedronGeometry(1, 1);
      const material = new THREE.MeshStandardMaterial({
        color: 0x00cccc,
        roughness: 0.3,
        metalness: 0.7,
        wireframe: false,
      });
      mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const edges = new THREE.EdgesGeometry(geometry);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.15 });
      const wireframe = new THREE.LineSegments(edges, lineMaterial);
      mesh.add(wireframe);
    }

    let angle = 0;
    const animate = () => {
      const id = requestAnimationFrame(animate);
      sceneRef.current!.animationId = id;
      angle += 0.005;
      if (mesh) {
        mesh.rotation.y = angle;
        mesh.position.y = Math.sin(angle * 2) * 0.05;
      }
      renderer.render(scene, camera);
    };

    sceneRef.current = { scene, camera, renderer, animationId: 0, mesh };
    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(sceneRef.current?.animationId || 0);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [modelUrl]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[#0a0a0f]">
      <div ref={containerRef} className="w-full h-80" />
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {onDownload && modelUrl && (
          <button
            onClick={onDownload}
            className="p-2 rounded-lg bg-black/60 backdrop-blur-sm text-white/60 hover:text-cyan-400 border border-white/10 transition-all duration-200"
          >
            <Download size={14} />
          </button>
        )}
        <button
          onClick={() => {
            const mesh = sceneRef.current?.mesh;
            if (mesh) mesh.rotation.set(0, 0, 0);
          }}
          className="p-2 rounded-lg bg-black/60 backdrop-blur-sm text-white/60 hover:text-white border border-white/10 transition-all duration-200"
        >
          <RotateCcw size={14} />
        </button>
      </div>
      {!modelUrl && (
        <div className="absolute bottom-3 left-3">
          <span className="text-xs text-white/30 bg-black/40 backdrop-blur-sm px-2 py-1 rounded">Preview</span>
        </div>
      )}
    </div>
  );
}
