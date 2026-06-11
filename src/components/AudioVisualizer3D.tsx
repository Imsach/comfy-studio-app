import { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { VisualizerMode, ParticleDensity } from '../types';

interface AudioVisualizer3DProps {
  isPlaying: boolean;
  colorScheme?: 'emerald' | 'cyan' | 'sky';
  mode?: VisualizerMode;
  speed?: number;
  intensity?: number;
  particleDensity?: ParticleDensity;
}

const DENSITY_MAP: Record<ParticleDensity, number> = { low: 60, medium: 150, high: 300 };

export default function AudioVisualizer3D({
  isPlaying,
  colorScheme = 'emerald',
  mode = 'bars',
  speed = 1,
  intensity = 1,
  particleDensity = 'medium',
}: AudioVisualizer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playingRef = useRef(isPlaying);
  const speedRef = useRef(speed);
  const intensityRef = useRef(intensity);

  const colors = useMemo(() => {
    switch (colorScheme) {
      case 'cyan': return { primary: 0x06b6d4, secondary: 0x14b8a6, glow: 0x22d3ee };
      case 'sky': return { primary: 0x0ea5e9, secondary: 0x06b6d4, glow: 0x38bdf8 };
      default: return { primary: 0x10b981, secondary: 0x14b8a6, glow: 0x34d399 };
    }
  }, [colorScheme]);

  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { intensityRef.current = intensity; }, [intensity]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const pCount = DENSITY_MAP[particleDensity];
    let rafId = 0;
    let time = 0;

    const animateFns: Array<(t: number) => void> = [];
    scene.userData.animateFns = animateFns;

    const getP = () => playingRef.current;
    const getS = () => speedRef.current;
    const getI = () => intensityRef.current;

    if (mode === 'bars') {
      setupBars(scene, camera, colors, pCount, getP, getS, getI);
    } else if (mode === 'wave') {
      setupWave(scene, camera, colors, pCount, getP, getS, getI);
    } else if (mode === 'spiral') {
      setupSpiral(scene, camera, colors, pCount, getP, getS, getI);
    } else if (mode === 'nebula') {
      setupNebula(scene, camera, colors, pCount, getP, getS, getI);
    } else if (mode === 'aurora') {
      setupAurora(scene, camera, colors, pCount, getP, getS, getI);
    } else if (mode === 'rings') {
      setupRings(scene, camera, colors, pCount, getP, getS, getI);
    } else {
      setupGalaxy(scene, camera, colors, pCount, getP, getS, getI);
    }

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      time += 0.016;
      for (const fn of scene.userData.animateFns as Array<(t: number) => void>) fn(time);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
        if (obj instanceof THREE.Points) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
      scene.clear();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [colors, mode, particleDensity]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-100' : 'opacity-30'}`}
      style={{ pointerEvents: 'none' }}
    />
  );
}

type GetNum = () => number;
type GetBool = () => boolean;
interface Colors { primary: number; secondary: number; glow: number }

function setupBars(
  scene: THREE.Scene, camera: THREE.PerspectiveCamera, colors: Colors, pCount: number,
  getPlaying: GetBool, getSpeed: GetNum, getIntensity: GetNum,
) {
  camera.position.set(0, 2, 8);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  const barCount = 32;
  const barGeo = new THREE.BoxGeometry(0.15, 1, 0.15);
  const bars: THREE.Mesh[] = [];
  for (let i = 0; i < barCount; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: colors.primary, transparent: true, opacity: 0.6 });
    const mesh = new THREE.Mesh(barGeo, mat);
    const angle = (i / barCount) * Math.PI * 2;
    mesh.position.set(Math.cos(angle) * 3, 0, Math.sin(angle) * 3);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
    bars.push(mesh);
  }

  const positions = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 12;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({ color: colors.glow, size: 0.08, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  (scene.userData.animateFns as Array<(t: number) => void>).push((time) => {
    const playing = getPlaying();
    const spd = getSpeed();
    const int = getIntensity();
    const targetOpacity = playing ? 0.7 : 0.15;

    bars.forEach((bar, i) => {
      const mat = bar.material as THREE.MeshBasicMaterial;
      mat.opacity += (targetOpacity - mat.opacity) * 0.05;
      if (playing) {
        const freq = Math.sin(time * spd * 2 + i * 0.5) * 0.5 + 0.5;
        const bass = Math.sin(time * spd * 1.2 + i * 0.3) * 0.3 + 0.3;
        const targetY = (freq + bass) * 2.5 * int + 0.2;
        bar.scale.y += (targetY - bar.scale.y) * 0.15;
      } else {
        const idle = Math.sin(time * 0.5 + i * 0.2) * 0.15 + 0.2;
        bar.scale.y += (idle - bar.scale.y) * 0.05;
      }
      bar.position.y = bar.scale.y * 0.5;
    });

    particles.rotation.y += playing ? 0.003 * spd : 0.0005;
    const pm = particles.material as THREE.PointsMaterial;
    pm.opacity += ((playing ? 0.5 : 0.15) - pm.opacity) * 0.05;
    pm.size += ((playing ? 0.12 : 0.06) - pm.size) * 0.05;

    camera.position.x = Math.sin(time * 0.15 * spd) * 1.5;
    camera.position.y = 2 + Math.sin(time * 0.2 * spd) * 0.5;
    camera.lookAt(0, 0.5, 0);
  });
}

function setupWave(
  scene: THREE.Scene, camera: THREE.PerspectiveCamera, colors: Colors, pCount: number,
  getPlaying: GetBool, getSpeed: GetNum, getIntensity: GetNum,
) {
  camera.position.set(0, 5, 7);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  const ringCount = 6;
  const perRing = 28;
  const rings: THREE.Mesh[][] = [];
  const sphereGeo = new THREE.SphereGeometry(0.08, 8, 8);

  for (let r = 0; r < ringCount; r++) {
    const ring: THREE.Mesh[] = [];
    const radius = 1.5 + r * 0.8;
    const hue = r / ringCount;
    const color = new THREE.Color().setHSL(hue * 0.15 + (colors.primary === 0x10b981 ? 0.42 : colors.primary === 0x06b6d4 ? 0.52 : 0.57), 0.7, 0.5);
    for (let j = 0; j < perRing; j++) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      const angle = (j / perRing) * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      scene.add(mesh);
      ring.push(mesh);
    }
    rings.push(ring);
  }

  const positions = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 14;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 14;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({ color: colors.glow, size: 0.06, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  (scene.userData.animateFns as Array<(t: number) => void>).push((time) => {
    const playing = getPlaying();
    const spd = getSpeed();
    const int = getIntensity();

    rings.forEach((ring, r) => {
      ring.forEach((mesh, j) => {
        const angle = (j / ring.length) * Math.PI * 2;
        const wavePhase = time * spd * 2 + r * 0.8 + angle * 0.5;
        const amplitude = playing ? 1.2 * int : 0.15;
        mesh.position.y = Math.sin(wavePhase) * amplitude;

        const scale = playing
          ? 1 + Math.sin(wavePhase * 1.5) * 0.5 * int
          : 1;
        mesh.scale.setScalar(scale);

        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity += ((playing ? 0.7 : 0.25) - mat.opacity) * 0.05;
      });
    });

    particles.rotation.y += playing ? 0.002 * spd : 0.0003;
    const pm = particles.material as THREE.PointsMaterial;
    pm.opacity += ((playing ? 0.4 : 0.15) - pm.opacity) * 0.05;

    camera.position.x = Math.sin(time * 0.1 * spd) * 2;
    camera.position.y = 5 + Math.sin(time * 0.15 * spd) * 1;
    camera.position.z = 7 + Math.cos(time * 0.08 * spd) * 1;
    camera.lookAt(0, 0, 0);
  });
}

function setupSpiral(
  scene: THREE.Scene, camera: THREE.PerspectiveCamera, colors: Colors, pCount: number,
  getPlaying: GetBool, getSpeed: GetNum, getIntensity: GetNum,
) {
  camera.position.set(0, 3, 6);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  const helixPoints = 200;
  const helixGeo = new THREE.SphereGeometry(0.06, 6, 6);
  const helixMeshes: THREE.Mesh[] = [];
  const helixGroup = new THREE.Group();

  for (let i = 0; i < helixPoints; i++) {
    const t = (i / helixPoints) * Math.PI * 6;
    const y = (i / helixPoints) * 6 - 3;
    const radius = 1.8 + Math.sin(t * 0.5) * 0.3;
    const hue = i / helixPoints;
    const color = new THREE.Color().setHSL(
      hue * 0.3 + (colors.primary === 0x10b981 ? 0.42 : colors.primary === 0x06b6d4 ? 0.52 : 0.57),
      0.8, 0.55
    );
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 });
    const mesh = new THREE.Mesh(helixGeo, mat);
    mesh.position.set(Math.cos(t) * radius, y, Math.sin(t) * radius);
    mesh.userData.basePos = mesh.position.clone();
    mesh.userData.t = t;
    mesh.userData.idx = i;
    helixGroup.add(mesh);
    helixMeshes.push(mesh);
  }

  for (let i = 0; i < helixPoints; i++) {
    const t = (i / helixPoints) * Math.PI * 6 + Math.PI;
    const y = (i / helixPoints) * 6 - 3;
    const radius = 1.8 + Math.sin(t * 0.5) * 0.3;
    const color = new THREE.Color(colors.secondary);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 });
    const mesh = new THREE.Mesh(helixGeo, mat);
    mesh.position.set(Math.cos(t) * radius, y, Math.sin(t) * radius);
    mesh.userData.basePos = mesh.position.clone();
    mesh.userData.t = t;
    mesh.userData.idx = i;
    helixGroup.add(mesh);
    helixMeshes.push(mesh);
  }

  scene.add(helixGroup);

  const positions = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 3 + Math.random() * 4;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
    positions[i * 3 + 2] = Math.sin(a) * r;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({ color: colors.glow, size: 0.05, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  (scene.userData.animateFns as Array<(t: number) => void>).push((time) => {
    const playing = getPlaying();
    const spd = getSpeed();
    const int = getIntensity();

    helixGroup.rotation.y += playing ? 0.008 * spd : 0.001;

    helixMeshes.forEach((mesh) => {
      const base = mesh.userData.basePos as THREE.Vector3;
      const idx = mesh.userData.idx as number;
      const mat = mesh.material as THREE.MeshBasicMaterial;

      if (playing) {
        const pulse = Math.sin(time * spd * 3 + idx * 0.1) * 0.3 * int;
        mesh.position.x = base.x * (1 + pulse * 0.2);
        mesh.position.z = base.z * (1 + pulse * 0.2);
        mesh.scale.setScalar(1 + Math.abs(pulse) * 0.8);
        mat.opacity += (0.7 - mat.opacity) * 0.05;
      } else {
        mesh.position.x = base.x;
        mesh.position.z = base.z;
        mesh.scale.setScalar(1);
        mat.opacity += (0.25 - mat.opacity) * 0.05;
      }
    });

    particles.rotation.y += playing ? 0.002 * spd : 0.0003;
    const pm = particles.material as THREE.PointsMaterial;
    pm.opacity += ((playing ? 0.4 : 0.15) - pm.opacity) * 0.05;

    camera.position.x = Math.sin(time * 0.12 * spd) * 3;
    camera.position.y = 3 + Math.sin(time * 0.18 * spd) * 1.5;
    camera.position.z = 6 + Math.cos(time * 0.1 * spd) * 1;
    camera.lookAt(0, 0, 0);
  });
}

function setupGalaxy(
  scene: THREE.Scene, camera: THREE.PerspectiveCamera, colors: Colors, pCount: number,
  getPlaying: GetBool, getSpeed: GetNum, getIntensity: GetNum,
) {
  camera.position.set(0, 5, 5);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.2));

  const arms = 4;
  const totalStars = Math.max(300, pCount * 2);
  const galaxyPositions = new Float32Array(totalStars * 3);
  const galaxyColors = new Float32Array(totalStars * 3);
  const starVelocities: number[] = [];

  const colorPrimary = new THREE.Color(colors.primary);
  const colorGlow = new THREE.Color(colors.glow);
  const colorSecondary = new THREE.Color(colors.secondary);

  for (let i = 0; i < totalStars; i++) {
    const arm = i % arms;
    const armAngle = (arm / arms) * Math.PI * 2;
    const dist = Math.pow(Math.random(), 0.6) * 5;
    const spiralAngle = dist * 1.2 + armAngle;
    const scatter = 0.3 * (1 + dist * 0.1);

    galaxyPositions[i * 3] = Math.cos(spiralAngle) * dist + (Math.random() - 0.5) * scatter;
    galaxyPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.2 * (1 + dist * 0.05);
    galaxyPositions[i * 3 + 2] = Math.sin(spiralAngle) * dist + (Math.random() - 0.5) * scatter;

    const mix = dist / 5;
    const starColor = colorPrimary.clone().lerp(mix < 0.5 ? colorGlow : colorSecondary, mix);
    galaxyColors[i * 3] = starColor.r;
    galaxyColors[i * 3 + 1] = starColor.g;
    galaxyColors[i * 3 + 2] = starColor.b;

    starVelocities.push(0.2 + Math.random() * 0.3);
  }

  const galaxyGeo = new THREE.BufferGeometry();
  galaxyGeo.setAttribute('position', new THREE.BufferAttribute(galaxyPositions, 3));
  galaxyGeo.setAttribute('color', new THREE.BufferAttribute(galaxyColors, 3));
  const galaxyMat = new THREE.PointsMaterial({
    size: 0.07,
    transparent: true,
    opacity: 0.6,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
  });
  const galaxyPoints = new THREE.Points(galaxyGeo, galaxyMat);
  scene.add(galaxyPoints);

  const coreGeo = new THREE.SphereGeometry(0.3, 16, 16);
  const coreMat = new THREE.MeshBasicMaterial({ color: colors.glow, transparent: true, opacity: 0.4 });
  const core = new THREE.Mesh(coreGeo, coreMat);
  scene.add(core);

  (scene.userData.animateFns as Array<(t: number) => void>).push((time) => {
    const playing = getPlaying();
    const spd = getSpeed();
    const int = getIntensity();

    galaxyPoints.rotation.y += playing ? 0.004 * spd : 0.0008;

    if (playing) {
      const posAttr = galaxyGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < totalStars; i++) {
        const y = posAttr.getY(i);
        const wave = Math.sin(time * spd * 2 + i * 0.01) * 0.15 * int * starVelocities[i];
        posAttr.setY(i, y + (wave - y) * 0.05);
      }
      posAttr.needsUpdate = true;
    }

    const gm = galaxyPoints.material as THREE.PointsMaterial;
    gm.opacity += ((playing ? 0.8 : 0.35) - gm.opacity) * 0.05;
    gm.size += ((playing ? 0.1 * int : 0.06) - gm.size) * 0.05;

    core.scale.setScalar(playing ? 1 + Math.sin(time * spd * 3) * 0.3 * int : 1);
    coreMat.opacity += ((playing ? 0.6 : 0.2) - coreMat.opacity) * 0.05;

    camera.position.x = Math.sin(time * 0.08 * spd) * 3;
    camera.position.y = 5 + Math.sin(time * 0.12 * spd) * 1.5;
    camera.position.z = 5 + Math.cos(time * 0.06 * spd) * 2;
    camera.lookAt(0, 0, 0);
  });
}

function setupNebula(
  scene: THREE.Scene, camera: THREE.PerspectiveCamera, colors: Colors, pCount: number,
  getPlaying: GetBool, getSpeed: GetNum, getIntensity: GetNum,
) {
  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);

  const totalParticles = Math.max(500, pCount * 4);
  const positions = new Float32Array(totalParticles * 3);
  const velocities = new Float32Array(totalParticles * 3);
  const particleColors = new Float32Array(totalParticles * 3);
  const sizes = new Float32Array(totalParticles);

  const c1 = new THREE.Color(colors.primary);
  const c2 = new THREE.Color(colors.glow);
  const c3 = new THREE.Color(colors.secondary);

  for (let i = 0; i < totalParticles; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = Math.pow(Math.random(), 0.4) * 5;
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
    positions[i * 3 + 2] = Math.cos(phi) * r;

    velocities[i * 3] = (Math.random() - 0.5) * 0.02;
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;

    const mix = Math.random();
    const color = mix < 0.33 ? c1 : mix < 0.66 ? c2 : c3;
    particleColors[i * 3] = color.r;
    particleColors[i * 3 + 1] = color.g;
    particleColors[i * 3 + 2] = color.b;
    sizes[i] = 0.03 + Math.random() * 0.08;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    size: 0.08,
    transparent: true,
    opacity: 0.6,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  const coreGeo = new THREE.SphereGeometry(0.5, 16, 16);
  const coreMat = new THREE.MeshBasicMaterial({ color: colors.glow, transparent: true, opacity: 0.15 });
  const core = new THREE.Mesh(coreGeo, coreMat);
  scene.add(core);

  (scene.userData.animateFns as Array<(t: number) => void>).push((time) => {
    const playing = getPlaying();
    const spd = getSpeed();
    const int = getIntensity();

    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < totalParticles; i++) {
      let x = posAttr.getX(i);
      let y = posAttr.getY(i);
      let z = posAttr.getZ(i);

      if (playing) {
        const pulse = Math.sin(time * spd * 2 + i * 0.005) * 0.02 * int;
        x += velocities[i * 3] * spd + pulse;
        y += velocities[i * 3 + 1] * spd + Math.cos(time * spd * 1.5 + i * 0.01) * 0.005 * int;
        z += velocities[i * 3 + 2] * spd;
      }

      const dist = Math.sqrt(x * x + y * y + z * z);
      if (dist > 6) {
        const scale = 0.5 / dist;
        x *= scale; y *= scale; z *= scale;
      }

      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;

    points.rotation.y += playing ? 0.003 * spd : 0.0005;
    points.rotation.x += playing ? 0.001 * spd : 0.0002;

    mat.opacity += ((playing ? 0.8 : 0.35) - mat.opacity) * 0.05;
    mat.size += ((playing ? 0.12 * int : 0.06) - mat.size) * 0.05;

    core.scale.setScalar(playing ? 1 + Math.sin(time * spd * 2) * 0.4 * int : 1);
    coreMat.opacity += ((playing ? 0.25 : 0.08) - coreMat.opacity) * 0.05;

    camera.position.x = Math.sin(time * 0.06 * spd) * 4;
    camera.position.y = Math.cos(time * 0.08 * spd) * 2;
    camera.position.z = 8 + Math.sin(time * 0.04 * spd) * 2;
    camera.lookAt(0, 0, 0);
  });
}

function setupAurora(
  scene: THREE.Scene, camera: THREE.PerspectiveCamera, colors: Colors, pCount: number,
  getPlaying: GetBool, getSpeed: GetNum, getIntensity: GetNum,
) {
  camera.position.set(0, 2, 8);
  camera.lookAt(0, 2, 0);

  const curtainCount = 5;
  const segmentsPerCurtain = 80;
  const curtains: { mesh: THREE.Mesh; basePositions: Float32Array; phase: number }[] = [];

  const c1 = new THREE.Color(colors.primary);
  const c2 = new THREE.Color(colors.glow);

  for (let c = 0; c < curtainCount; c++) {
    const geo = new THREE.PlaneGeometry(12, 4, segmentsPerCurtain, 8);
    const basePositions = new Float32Array(geo.attributes.position.array);

    const colorsArr = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < geo.attributes.position.count; i++) {
      const y = (geo.attributes.position.getY(i) + 2) / 4;
      const mix = new THREE.Color().lerpColors(c1, c2, y);
      colorsArr[i * 3] = mix.r;
      colorsArr[i * 3 + 1] = mix.g;
      colorsArr[i * 3 + 2] = mix.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colorsArr, 3));

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = -c * 1.5;
    mesh.position.y = 2 + c * 0.3;
    scene.add(mesh);
    curtains.push({ mesh, basePositions, phase: c * 1.2 });
  }

  const starCount = Math.max(200, pCount * 2);
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPositions[i * 3] = (Math.random() - 0.5) * 20;
    starPositions[i * 3 + 1] = Math.random() * 8 - 1;
    starPositions[i * 3 + 2] = (Math.random() - 0.5) * 15 - 3;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.04, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(starGeo, starMat));

  (scene.userData.animateFns as Array<(t: number) => void>).push((time) => {
    const playing = getPlaying();
    const spd = getSpeed();
    const int = getIntensity();

    curtains.forEach(({ mesh, basePositions, phase }) => {
      const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const amplitude = playing ? 0.8 * int : 0.15;

      for (let i = 0; i < posAttr.count; i++) {
        const bx = basePositions[i * 3];
        const by = basePositions[i * 3 + 1];
        const wave1 = Math.sin(time * spd * 1.5 + bx * 0.5 + phase) * amplitude;
        const wave2 = Math.sin(time * spd * 0.8 + bx * 0.3 + phase * 2) * amplitude * 0.5;
        const heightFactor = (by + 2) / 4;
        posAttr.setY(i, by + (wave1 + wave2) * heightFactor);
        posAttr.setZ(i, basePositions[i * 3 + 2] + Math.sin(time * spd + bx * 0.2 + phase) * 0.3 * amplitude);
      }
      posAttr.needsUpdate = true;

      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity += ((playing ? 0.25 : 0.08) - mat.opacity) * 0.05;
    });

    starMat.opacity += ((playing ? 0.5 : 0.3) - starMat.opacity) * 0.05;

    camera.position.x = Math.sin(time * 0.05 * spd) * 3;
    camera.position.y = 2 + Math.sin(time * 0.07 * spd) * 0.8;
    camera.lookAt(0, 2.5, -2);
  });
}

function setupRings(
  scene: THREE.Scene, camera: THREE.PerspectiveCamera, colors: Colors, pCount: number,
  getPlaying: GetBool, getSpeed: GetNum, getIntensity: GetNum,
) {
  camera.position.set(0, 4, 7);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.2));

  const ringCount = 8;
  const rings: { mesh: THREE.Mesh; radius: number; rotSpeed: number; axis: THREE.Vector3 }[] = [];

  for (let i = 0; i < ringCount; i++) {
    const radius = 1.5 + i * 0.5;
    const tubeRadius = 0.02 + Math.random() * 0.03;
    const geo = new THREE.TorusGeometry(radius, tubeRadius, 8, 64);
    const hue = i / ringCount;
    const color = new THREE.Color().setHSL(
      hue * 0.2 + (colors.primary === 0x10b981 ? 0.42 : colors.primary === 0x06b6d4 ? 0.52 : 0.57),
      0.7, 0.55
    );
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);

    const axis = new THREE.Vector3(
      Math.random() - 0.5,
      1 + Math.random(),
      Math.random() - 0.5
    ).normalize();
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

    scene.add(mesh);
    rings.push({ mesh, radius, rotSpeed: 0.3 + Math.random() * 0.5, axis });
  }

  const particlePositions = new Float32Array(pCount * 3);
  const particleVelocities = new Float32Array(pCount);
  for (let i = 0; i < pCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1 + Math.random() * 5;
    particlePositions[i * 3] = Math.cos(a) * r;
    particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 4;
    particlePositions[i * 3 + 2] = Math.sin(a) * r;
    particleVelocities[i] = 0.3 + Math.random() * 0.5;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const pMat = new THREE.PointsMaterial({ color: colors.glow, size: 0.06, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  const coreGeo = new THREE.IcosahedronGeometry(0.6, 2);
  const coreMat = new THREE.MeshBasicMaterial({ color: colors.glow, transparent: true, opacity: 0.3, wireframe: true });
  const core = new THREE.Mesh(coreGeo, coreMat);
  scene.add(core);

  (scene.userData.animateFns as Array<(t: number) => void>).push((time) => {
    const playing = getPlaying();
    const spd = getSpeed();
    const int = getIntensity();

    rings.forEach(({ mesh, rotSpeed, axis }, i) => {
      const speed = playing ? rotSpeed * spd : rotSpeed * 0.1;
      mesh.rotateOnAxis(axis, speed * 0.016);

      if (playing) {
        const pulse = 1 + Math.sin(time * spd * 2 + i * 0.8) * 0.15 * int;
        mesh.scale.setScalar(pulse);
      } else {
        mesh.scale.setScalar(1);
      }

      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity += ((playing ? 0.6 : 0.25) - mat.opacity) * 0.05;
    });

    core.rotation.x += playing ? 0.01 * spd : 0.002;
    core.rotation.y += playing ? 0.015 * spd : 0.003;
    const coreScale = playing ? 1 + Math.sin(time * spd * 3) * 0.3 * int : 1;
    core.scale.setScalar(coreScale);
    coreMat.opacity += ((playing ? 0.4 : 0.15) - coreMat.opacity) * 0.05;

    particles.rotation.y += playing ? 0.003 * spd : 0.0005;
    const posAttr = pGeo.getAttribute('position') as THREE.BufferAttribute;
    if (playing) {
      for (let i = 0; i < pCount; i++) {
        const y = posAttr.getY(i);
        const wave = Math.sin(time * spd * 2 + i * 0.05) * 0.01 * int * particleVelocities[i];
        posAttr.setY(i, y + wave);
      }
      posAttr.needsUpdate = true;
    }
    pMat.opacity += ((playing ? 0.5 : 0.2) - pMat.opacity) * 0.05;

    camera.position.x = Math.sin(time * 0.1 * spd) * 4;
    camera.position.y = 4 + Math.sin(time * 0.13 * spd) * 1.5;
    camera.position.z = 7 + Math.cos(time * 0.07 * spd) * 2;
    camera.lookAt(0, 0, 0);
  });
}
