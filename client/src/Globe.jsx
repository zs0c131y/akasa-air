import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { reducedMotion } from './motion.js';

/**
 * A flat-shaded route globe, facing India: latitude and longitude lines, a handful of domestic routes as arcs,
 * and small markers travelling along them. Drawn with Three.js, no textures, no glow. It is decoration only:
 * it sways gently, stops for reduced motion, and quietly renders nothing if WebGL is unavailable.
 */
const CITIES = {
  BLR: [12.97, 77.59], BOM: [19.08, 72.88], DEL: [28.61, 77.21], CCU: [22.57, 88.36],
  MAA: [13.08, 80.27], AMD: [23.02, 72.57], HYD: [17.39, 78.49], COK: [9.93, 76.27], PNQ: [18.52, 73.86],
};
const ROUTES = [['BLR', 'BOM'], ['BOM', 'DEL'], ['DEL', 'CCU'], ['BOM', 'AMD'], ['BLR', 'MAA'], ['BLR', 'COK'], ['HYD', 'DEL'], ['BOM', 'PNQ'], ['CCU', 'BLR']];
const R = 1;

const toVec = ([lat, lon], r = R) => {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
};

function arcPoints(a, b, lift = 0.16, n = 48) {
  const va = toVec(a);
  const vb = toVec(b);
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const p = va.clone().lerp(vb, t).normalize().multiplyScalar(R + Math.sin(Math.PI * t) * lift);
    pts.push(p);
  }
  return pts;
}

/** Reads a colour token from the element itself, so the globe follows a local `.dark` wrapper as well as the page theme. */
const cssColour = (el, name) => {
  const raw = getComputedStyle(el).getPropertyValue(name).trim().split(/\s+/).map(parseFloat);
  const [h, s, l] = raw;
  return new THREE.Color().setHSL(h / 360, s / 100, l / 100);
};

export default function Globe({ className }) {
  const mount = useRef(null);

  useEffect(() => {
    const el = mount.current;
    if (!el) return undefined;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return undefined; // no WebGL: the page simply has no globe
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.cssText = 'position:absolute;inset:0;display:block;width:100%;height:100%';
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.set(0, 0, 4.4);
    const globe = new THREE.Group();
    scene.add(globe);

    // Graticule
    const lineMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.3 });
    const grat = [];
    for (let lat = -60; lat <= 60; lat += 20) {
      const pts = [];
      for (let lon = 0; lon <= 360; lon += 6) pts.push(toVec([lat, lon - 180]));
      grat.push(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
    for (let lon = 0; lon < 360; lon += 20) {
      const pts = [];
      for (let lat = -90; lat <= 90; lat += 6) pts.push(toVec([lat, lon - 180]));
      grat.push(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
    grat.forEach((l) => globe.add(l));
    // Invisible occluder: hides the far side of the graticule without painting anything.
    const rim = new THREE.Mesh(new THREE.SphereGeometry(R * 0.995, 48, 32), new THREE.MeshBasicMaterial({ colorWrite: false }));
    globe.add(rim);

    // Routes, cities, travellers
    const arcMat = new THREE.LineBasicMaterial();
    const nodeMat = new THREE.MeshBasicMaterial();
    const planeMat = new THREE.MeshBasicMaterial();
    const curves = ROUTES.map(([a, b]) => arcPoints(CITIES[a], CITIES[b]));
    curves.forEach((pts) => globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), arcMat)));
    Object.values(CITIES).forEach((c) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), nodeMat);
      m.position.copy(toVec(c, R + 0.004));
      globe.add(m);
    });
    const travellers = curves.slice(0, 6).map((pts, i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), planeMat);
      globe.add(m);
      return { m, pts, offset: i / 6 };
    });

    const paint = () => {
      const ink = cssColour(el, '--foreground');
      const flame = cssColour(el, '--flame');
      lineMat.color.copy(ink);
      arcMat.color.copy(flame);
      nodeMat.color.copy(ink);
      planeMat.color.copy(flame);
    };
    paint();
    const observer = new MutationObserver(paint);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // Face India: centre on ~ lat 20, lon 79
    globe.rotation.x = THREE.MathUtils.degToRad(20);
    const base = -Math.atan2(toVec([20, 79]).x, toVec([20, 79]).z);
    globe.rotation.y = base;

    const resize = () => {
      const w = el.clientWidth || 400;
      const h = el.clientHeight || 400;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const still = reducedMotion();
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(el);
    const clock = new THREE.Clock();
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const t = clock.getElapsedTime();
      if (!still) {
        globe.rotation.y = base + Math.sin(t * 0.18) * 0.22;
        travellers.forEach(({ m, pts, offset }) => {
          const k = ((t * 0.12 + offset) % 1) * (pts.length - 1);
          m.position.copy(pts[Math.floor(k)]);
        });
      }
      renderer.render(scene, camera);
    };
    if (still) {
      travellers.forEach(({ m, pts }) => m.position.copy(pts[Math.floor(pts.length / 2)]));
      renderer.render(scene, camera);
    } else frame();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      ro.disconnect();
      io.disconnect();
      scene.traverse((o) => { o.geometry?.dispose?.(); });
      [lineMat, arcMat, nodeMat, planeMat, rim.material].forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mount} className={className} aria-hidden="true" />;
}
