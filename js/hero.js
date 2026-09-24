// ファーストビューの3D。SVGで描いたロゴの線を、同じ位置で立体に置き換える
import {
  AdditiveBlending, AmbientLight, NeutralToneMapping, BoxGeometry, BufferGeometry, Color, DirectionalLight, EdgesGeometry,
  Float32BufferAttribute, Group, LineBasicMaterial, LineDashedMaterial, LineLoop, LineSegments, MathUtils, Mesh,
  MeshStandardMaterial, PerspectiveCamera, Plane, PlaneGeometry, PointLight, Points, Raycaster, Scene,
  ShaderMaterial, SphereGeometry, MeshBasicMaterial, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const hero = document.querySelector('.hero');
const canvas = hero?.querySelector('.hero-canvas');
const svgLogo = hero?.querySelector('.hero-logo');
const scatterButton = hero?.querySelector('[data-scatter]');
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const moving = () => root.dataset.motion !== 'off' && !reduced.matches;

// SVGのロゴと同じ線。座標はviewBox 96〜416の値
const T = 21;
const SEGMENTS = [
  [108, 116, 316, 116], [118, 104, 118, 398], [279, 116, 115, 398], [274, 116, 274, 362],
  [175, 295, 254, 295], [280, 285, 350, 205], [300, 282, 394, 390], [394, 206, 394, 404],
  [156, 394, 404, 394],
  // 右上の「2」。角が欠けないよう、曲がり角の側だけ線幅の半分を延ばす
  [332, 116, 394, 116, 0, 1], [394, 116, 394, 142, 1, 1], [394, 142, 342, 156, 1, 1],
  [342, 156, 342, 180, 1, 1], [342, 180, 404, 180, 1, 0],
];
const UNIT = 64;
const LOGO_SIZE = 320 / UNIT;

function start() {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return; // WebGLが使えない環境ではSVGのロゴをそのまま見せる
  }
  const accent = new Color(0x3d8bff);
  renderer.setClearColor(0x05070b, 1);
  // 明るい部分が白へ抜けるときも青の色相を保つ
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 80);
  camera.position.set(0, 0, 10);

  scene.add(new AmbientLight(0x8fb6ff, 0.35));
  const keyLight = new DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(3, 4, 6);
  scene.add(keyLight);
  const pointerLight = new PointLight(accent, 12, 14, 2);
  scene.add(pointerLight);

  // ロゴの棒
  const stage = new Group();
  const logo = new Group();
  stage.add(logo);
  scene.add(stage);
  const bars = SEGMENTS.map(([x1, y1, x2, y2, extendStart = 0, extendEnd = 0], index) => {
    const dx = x2 - x1, dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    const ux = dx / length, uy = dy / length;
    const sx = x1 - ux * extendStart * T / 2, sy = y1 - uy * extendStart * T / 2;
    const ex = x2 + ux * extendEnd * T / 2, ey = y2 + uy * extendEnd * T / 2;
    const size = Math.hypot(ex - sx, ey - sy) / UNIT;
    const geometry = new BoxGeometry(size, T / UNIT, T / UNIT);
    const material = new MeshStandardMaterial({ color: 0x0c1830, metalness: 0.55, roughness: 0.32, emissive: accent, emissiveIntensity: 0.15 });
    const mesh = new Mesh(geometry, material);
    const edgeMaterial = new LineBasicMaterial({ color: accent.clone() });
    mesh.add(new LineSegments(new EdgesGeometry(geometry), edgeMaterial));
    logo.add(mesh);
    const target = new Vector3(((sx + ex) / 2 - 256) / UNIT, -((sy + ey) / 2 - 256) / UNIT, 0);
    const angle = -Math.atan2(ey - sy, ex - sx);
    mesh.position.copy(target);
    mesh.rotation.z = angle;
    return { mesh, material, edgeMaterial, target, angle, index, push: 0, velocity: new Vector3(), spin: new Vector3() };
  });

  // 周回する輪と光の粒
  const rings = new Group();
  stage.add(rings);
  function ring(radius, dashed) {
    const points = [];
    for (let i = 0; i < 160; i++) {
      const a = i / 160 * Math.PI * 2;
      points.push(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
    const material = dashed
      ? new LineDashedMaterial({ color: accent, dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0.55 })
      : new LineBasicMaterial({ color: accent, transparent: true, opacity: 0.28 });
    const line = new LineLoop(geometry, material);
    if (dashed) line.computeLineDistances();
    rings.add(line);
    return line;
  }
  const innerRing = ring(3.35, true);
  const outerRing = ring(3.9, false);
  innerRing.rotation.set(1.18, 0.2, 0);
  outerRing.rotation.set(1.28, -0.28, 0);
  const node = new Mesh(new SphereGeometry(0.06, 12, 12), new MeshBasicMaterial({ color: new Color(0x9cc4ff).multiplyScalar(3) }));
  innerRing.add(node);
  rings.scale.setScalar(0);

  // 波打つ床
  const fieldGeometry = new PlaneGeometry(40, 18, 150, 66);
  fieldGeometry.rotateX(-Math.PI / 2);
  const field = new Points(fieldGeometry, new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uPointer: { value: new Vector3(0, 0, 99) }, uColor: { value: accent } },
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uPixel;
      uniform vec3 uPointer;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float h = sin(p.x * 0.42 + uTime * 0.7) * 0.28 + sin(p.z * 0.6 - uTime * 0.5) * 0.22 + sin((p.x * 0.7 + p.z) * 0.35 + uTime * 0.35) * 0.35;
        float d = distance(p.xz, uPointer.xz);
        h += sin(d * 2.4 - uTime * 3.2) * 0.22 * exp(-d * 0.32);
        p.y += h;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPixel * (1.4 + h * 1.1) * (10.0 / -mv.z);
        vAlpha = smoothstep(30.0, 7.0, -mv.z) * clamp(0.25 + h * 0.9, 0.08, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        if (r > 0.5) discard;
        gl_FragColor = vec4(uColor, smoothstep(0.5, 0.0, r) * vAlpha);
      }`,
  }));
  field.position.set(0, -2.7, -5);
  scene.add(field);

  // 漂う塵
  const dustCount = innerWidth < 760 ? 220 : 520;
  const dust = [];
  for (let i = 0; i < dustCount; i++) dust.push(MathUtils.randFloatSpread(26), MathUtils.randFloat(0, 9), MathUtils.randFloat(-12, 3), Math.random());
  const dustGeometry = new BufferGeometry();
  dustGeometry.setAttribute('position', new Float32BufferAttribute(dust.filter((_, i) => i % 4 !== 3), 3));
  dustGeometry.setAttribute('seed', new Float32BufferAttribute(dust.filter((_, i) => i % 4 === 3), 1));
  const dustMaterial = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uColor: { value: accent } },
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uPixel;
      attribute float seed;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y = mod(p.y + uTime * (0.12 + seed * 0.2), 9.0) - 3.5;
        p.x += sin(uTime * 0.3 + seed * 20.0) * 0.3;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPixel * (1.0 + seed * 2.2) * (8.0 / -mv.z);
        vAlpha = (0.35 + 0.65 * sin(uTime * (1.0 + seed * 2.0) + seed * 40.0) * 0.5 + 0.3) * smoothstep(24.0, 6.0, -mv.z);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        if (r > 0.5) discard;
        gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.35) * 1.4, smoothstep(0.5, 0.0, r) * vAlpha);
      }`,
  });
  scene.add(new Points(dustGeometry, dustMaterial));

  // 光のにじみ
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.95, 0.55, 0.12);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // 大きさとロゴの位置。SVGのロゴも同じ場所へ置く
  let width = 1, height = 1, dpr = 1;
  const viewHeight = () => 2 * camera.position.z * Math.tan(MathUtils.degToRad(camera.fov / 2));
  function layout() {
    const box = hero.getBoundingClientRect();
    width = Math.max(1, box.width); height = Math.max(1, box.height);
    dpr = Math.min(devicePixelRatio || 1, width < 760 ? 1.25 : 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const vh = viewHeight(), vw = vh * camera.aspect;
    let scale, x = 0, y = 0;
    if (camera.aspect >= 1.1) {
      scale = Math.min(0.8, vh * 0.62 / LOGO_SIZE, vw * 0.36 / LOGO_SIZE);
      x = vw * 0.22;
    } else {
      scale = Math.min(vw * 0.62 / LOGO_SIZE, vh * 0.34 / LOGO_SIZE);
      y = vh * 0.2;
    }
    stage.position.set(x, y, 0);
    stage.scale.setScalar(scale);
    const size = LOGO_SIZE * scale / vh * height;
    hero.style.setProperty('--logo-x', `${(0.5 + x / vw) * width}px`);
    hero.style.setProperty('--logo-y', `${(0.5 - y / vh) * height}px`);
    hero.style.setProperty('--logo-size', `${size}px`);
    const pixel = dpr * height / 900;
    field.material.uniforms.uPixel.value = pixel * 3;
    dustMaterial.uniforms.uPixel.value = pixel * 3;
    render(performance.now(), true);
  }

  // ポインター
  const pointer = new Vector2(0, 0);
  const smoothPointer = new Vector2(0, 0);
  let pointerActive = false;
  const raycaster = new Raycaster();
  const logoPlane = new Plane(new Vector3(0, 0, 1), 0);
  const floorPlane = new Plane(new Vector3(0, 1, 0), 2.7);
  const hit = new Vector3(), local = new Vector3(), floorHit = new Vector3(), away = new Vector3(0, 0, 99);
  hero.addEventListener('pointermove', event => {
    const box = hero.getBoundingClientRect();
    pointer.set((event.clientX - box.left) / box.width * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1);
    pointerActive = true;
    wake();
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { pointerActive = false; pointer.set(0, 0); });

  // 分解と組み立て。ばねで元の位置へ戻る
  function scatter() {
    if (!moving()) return;
    for (const bar of bars) {
      const out = bar.target.clone().setZ(0).normalize();
      bar.velocity.set(out.x * 10 + MathUtils.randFloatSpread(12), out.y * 10 + MathUtils.randFloatSpread(12), MathUtils.randFloat(6, 16));
      bar.spin.set(MathUtils.randFloatSpread(22), MathUtils.randFloatSpread(22), MathUtils.randFloatSpread(14));
    }
    wake();
  }
  canvas.parentElement.addEventListener('click', scatter);
  scatterButton?.addEventListener('click', scatter);

  // 描画
  let ready = false, introStart = -1, frame = 0, last = 0, clock = 0, visible = true;
  const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const stiffness = 38, damping = 2 * Math.sqrt(stiffness) * 0.5;

  function step(dt) {
    clock += dt;
    smoothPointer.lerp(pointer, 1 - Math.exp(-dt * 4));

    // ロゴの向き。登場時に一回転して奥行きを見せる
    let spin = 0;
    if (introStart >= 0) {
      const t = Math.min((clock - introStart) / 2.2, 1);
      spin = easeInOut(t) * Math.PI * 2;
      rings.scale.setScalar(easeInOut(Math.min((clock - introStart) / 1.6, 1)));
      if (t >= 1) introStart = -2;
    } else if (introStart === -2) rings.scale.setScalar(1);
    logo.rotation.y = smoothPointer.x * 0.4 + spin;
    logo.rotation.x = -smoothPointer.y * 0.25;
    logo.position.y = Math.sin(clock * 0.8) * 0.06;
    innerRing.rotation.z = clock * 0.35;
    outerRing.rotation.z = -clock * 0.18;
    node.position.set(Math.cos(clock * 1.3) * 3.35, Math.sin(clock * 1.3) * 3.35, 0);

    camera.position.x = smoothPointer.x * 0.5;
    camera.position.y = smoothPointer.y * 0.3;
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    // ポインターが指す場所
    raycaster.setFromCamera(smoothPointer, camera);
    const hasHit = pointerActive && raycaster.ray.intersectPlane(logoPlane, hit);
    if (hasHit) {
      pointerLight.position.set(hit.x, hit.y, 2);
      stage.updateMatrixWorld();
      local.copy(hit);
      logo.worldToLocal(local);
    } else pointerLight.position.set(stage.position.x, stage.position.y + 2, 4);
    field.material.uniforms.uPointer.value.copy(pointerActive && raycaster.ray.intersectPlane(floorPlane, floorHit) ? floorHit.sub(field.position) : away);

    for (const bar of bars) {
      const { mesh, target } = bar;
      const d = hasHit ? Math.hypot(local.x - target.x, local.y - target.y) : 99;
      const push = Math.pow(Math.max(0, 1 - d / 1.7), 2);
      bar.push += (push - bar.push) * (1 - Math.exp(-dt * 8));
      const tz = bar.push * 0.9;
      const ax = (target.x - mesh.position.x) * stiffness - bar.velocity.x * damping;
      const ay = (target.y - mesh.position.y) * stiffness - bar.velocity.y * damping;
      const az = (tz - mesh.position.z) * stiffness - bar.velocity.z * damping;
      bar.velocity.x += ax * dt; bar.velocity.y += ay * dt; bar.velocity.z += az * dt;
      mesh.position.addScaledVector(bar.velocity, dt);
      bar.spin.x += (-mesh.rotation.x * stiffness - bar.spin.x * damping) * dt;
      bar.spin.y += (-mesh.rotation.y * stiffness - bar.spin.y * damping) * dt;
      bar.spin.z += ((bar.angle - mesh.rotation.z) * stiffness - bar.spin.z * damping) * dt;
      mesh.rotation.x += bar.spin.x * dt; mesh.rotation.y += bar.spin.y * dt; mesh.rotation.z += bar.spin.z * dt;

      // 線を順に流れる光
      const pulse = Math.pow(Math.max(0, Math.sin(clock * 1.7 - bar.index * 0.5)), 10);
      bar.material.emissiveIntensity = 0.2 + pulse * 0.35 + bar.push * 0.45;
      bar.edgeMaterial.color.copy(accent).multiplyScalar(0.9 + pulse * 0.8 + bar.push * 0.8);
    }

    field.material.uniforms.uTime.value = clock;
    dustMaterial.uniforms.uTime.value = clock;
  }

  function render(now, still = false) {
    frame = 0;
    const dt = last && !still ? Math.min((now - last) / 1000, 1 / 15) : 0;
    last = still ? 0 : now;
    step(dt);
    composer.render();
    if (!still && running()) frame = requestAnimationFrame(render);
  }
  const running = () => ready && visible && !document.hidden && moving();
  function wake() {
    if (!frame && running()) { last = 0; frame = requestAnimationFrame(render); }
  }
  function update() {
    if (scatterButton) scatterButton.hidden = !ready || !moving();
    if (!running()) { cancelAnimationFrame(frame); frame = 0; if (ready) render(performance.now(), true); }
    else wake();
  }

  new ResizeObserver(layout).observe(hero);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; update(); }).observe(hero);
  document.addEventListener('visibilitychange', update);
  document.addEventListener('motionchange', update);
  reduced.addEventListener('change', update);

  // SVGの線を描き終えてから立体へ切り替える
  const drawn = moving() ? new Promise(resolve => setTimeout(resolve, 1500)) : Promise.resolve();
  drawn.then(() => {
    ready = true;
    layout();
    hero.classList.add('is-3d');
    if (moving()) introStart = clock;
    else rings.scale.setScalar(1);
    update();
  });
}

if (hero && canvas && svgLogo) start();
