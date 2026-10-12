import {Canvas, useFrame} from '@react-three/fiber';
import {useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';

const CHERRY = '#d62e2e';
const NAVY = '#1f3d7a';

/** Diagonal qizil-oq-ko'k chiziqli tekstura (bir marta chiziladi, keyin faqat offset siljiydi — juda arzon). */
function useStripeTexture() {
  return useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    const band = size / 4;
    const colors = [CHERRY, '#ffffff', NAVY, '#ffffff'];
    // Diagonal chiziqlar: tekstura takrorlanganda choklar ko'rinmasligi uchun chegaradan tashqariga ham chizamiz
    for (let i = -8; i < 12; i++) {
      ctx.fillStyle = colors[((i % 4) + 4) % 4];
      ctx.beginPath();
      ctx.moveTo(i * band, 0);
      ctx.lineTo(i * band + band, 0);
      ctx.lineTo(i * band + band - size, size);
      ctx.lineTo(i * band - size, size);
      ctx.closePath();
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 2.5);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, []);
}

function Pole({lowPower}: {lowPower: boolean}) {
  const group = useRef<THREE.Group>(null);
  const texture = useStripeTexture();
  const segments = lowPower ? 32 : 64;

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((state, delta) => {
    // Chiziqlar "aylanadi": teksturani siljitish — geometriya o'zgarmaydi
    texture.offset.y -= delta * 0.35;
    const g = group.current;
    if (!g) return;
    // Sichqoncha/barmoq tomonga yumshoq burilish + yengil tebranish
    const targetY = state.pointer.x * 0.5;
    const targetX = -state.pointer.y * 0.15;
    g.rotation.y += (targetY - g.rotation.y) * Math.min(1, delta * 3);
    g.rotation.x += (targetX - g.rotation.x) * Math.min(1, delta * 3);
    g.position.y = Math.sin(state.clock.elapsedTime * 1.2) * 0.06;
  });

  // Muhit xaritasi (envMap) yo'q — og'ir bo'lardi. Shuning uchun metallik o'rtacha: yorug'likdan yaltiraydi, lekin qoraymaydi.
  const chrome = <meshStandardMaterial color="#eef1f5" metalness={0.45} roughness={0.22} />;
  const gold = <meshStandardMaterial color="#e0b93a" metalness={0.4} roughness={0.3} />;

  return (
    <group ref={group} rotation={[0, 0, 0.08]}>
      {/* Chiziqli ichki silindr */}
      <mesh>
        <cylinderGeometry args={[0.42, 0.42, 3, segments, 1, true]} />
        <meshStandardMaterial map={texture} roughness={0.35} metalness={0.05} />
      </mesh>
      {/* Shisha naycha (yarim shaffof — PhysicalMaterial transmission'dan ancha arzon) */}
      <mesh>
        <cylinderGeometry args={[0.5, 0.5, 3, segments, 1, true]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.14} roughness={0.05} metalness={0.2} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Yuqori va pastki xrom halqalar */}
      {[1.62, -1.62].map((y) => (
        <group key={y} position={[0, y, 0]}>
          <mesh>
            <cylinderGeometry args={[0.62, 0.62, 0.24, segments]} />
            {chrome}
          </mesh>
          <mesh position={[0, y > 0 ? 0.14 : -0.14, 0]}>
            <cylinderGeometry args={[0.48, 0.66, 0.06, segments]} />
            {gold}
          </mesh>
        </group>
      ))}
      {/* Yuqoridagi shar */}
      <mesh position={[0, 2.08, 0]}>
        <sphereGeometry args={[0.36, segments, segments / 2]} />
        {chrome}
      </mesh>
      {/* Pastki uchli qism */}
      <mesh position={[0, -2.02, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.3, 0.5, segments]} />
        {gold}
      </mesh>
    </group>
  );
}

/**
 * 3D aylanuvchi barber-pole.
 * Ishlash: ekrandan chiqsa render to'xtaydi (frameloop="never"), telefonda piksel zichligi va detal kamaytiriladi.
 */
export default function Pole3D({className}: {className?: string}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const lowPower = useMemo(() => window.matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {rootMargin: '100px'});
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className={className} aria-hidden>
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, lowPower ? 1.5 : 2]}
        camera={{position: [0, 0, 6.2], fov: 42}}
        gl={{antialias: !lowPower, alpha: true, powerPreference: lowPower ? 'low-power' : 'default'}}
      >
        <hemisphereLight args={['#ffffff', '#f1e8d6', 0.9]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 4, 5]} intensity={1.6} />
        <directionalLight position={[-4, -1, 2]} intensity={0.5} color="#ffd9c7" />
        <pointLight position={[0, 0, 3]} intensity={0.6} />
        <Pole lowPower={lowPower} />
      </Canvas>
    </div>
  );
}
