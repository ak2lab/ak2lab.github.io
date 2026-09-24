// ファーストビューの3D。図面として描いたロゴの部品を、同じ位置で立体へ押し出す
import {
  AdditiveBlending, AmbientLight, BufferGeometry, Color, DirectionalLight, EdgesGeometry, ExtrudeGeometry,
  Float32BufferAttribute, Group, HalfFloatType, Line, LineBasicMaterial, LineLoop, LineSegments, MathUtils, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, NeutralToneMapping, PerspectiveCamera, Plane, PlaneGeometry,
  PMREMGenerator, PointLight, Points, Raycaster, Scene, ShaderMaterial, Shape, SphereGeometry, Vector2, Vector3,
  WebGLRenderTarget, WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LOGO_CENTER, LOGO_EXTENT, LOGO_PARTS, LOGO_VIEWBOX } from './logo.js';

const hero = document.querySelector('.hero');
const canvas = hero?.querySelector('.hero-canvas');
const visual = hero?.querySelector('.hero-visual');
const scatterButton = hero?.querySelector('[data-scatter]');
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const moving = () => root.dataset.motion !== 'off' && !reduced.matches;

const UNIT = 120;                    // 1024座標の120を3Dの1とする
const HALF = LOGO_EXTENT / 2 / UNIT; // ロゴの半分の幅
const DEPTH = 46 / UNIT;             // 押し出す厚み。線の太さとほぼ同じ
const HANDOFF_AT = 1750;             // 図面を描き終える時刻。CSSの描画と合わせる（ページを開いてからのミリ秒）
const REST = { x: 0.07, y: -0.24 };  // 休んでいるときの向き。少し斜めにして奥行きを見せる

const clamp01 = value => Math.min(Math.max(value, 0), 1);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function start() {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch {
    return; // WebGLが使えない環境では図面のSVGをそのまま見せる
  }
  const accent = new Color(0x3d8bff);
  renderer.setClearColor(0x05070b, 1);
  // 明るい部分が白へ抜けるときも青の色相を保つ
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new Scene();
  // 金属の面に映り込む環境。起動時に一度だけ作る
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();

  const camera = new PerspectiveCamera(30, 1, 0.1, 120);
  camera.position.set(0, 0, 13);
  scene.add(new AmbientLight(0x9fc2ff, 0.2));
  const keyLight = new DirectionalLight(0xdce8ff, 0.9);
  keyLight.position.set(-4, 5, 8);
  const rimLight = new DirectionalLight(accent, 2.4); // 背後から縁を青く照らす
  rimLight.position.set(6, -2, -6);
  const pointerLight = new PointLight(accent, 7, 9, 2);
  scene.add(keyLight, rimLight, pointerLight);

  // ロゴの部品。各部品の中心で回るよう、形を中心へ寄せてから押し出す
  const stage = new Group();
  const pivot = new Group();
  stage.add(pivot);
  scene.add(stage);
  const parts = LOGO_PARTS.map(({ points }, index) => {
    const cx = points.reduce((sum, [x]) => sum + x, 0) / points.length;
    const cy = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
    const shape = new Shape(points.map(([x, y]) => new Vector2((x - cx) / UNIT, -(y - cy) / UNIT)));
    const geometry = new ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false });
    geometry.translate(0, 0, -DEPTH / 2);
    const material = new MeshStandardMaterial({
      color: 0x0b1b36, metalness: 0.86, roughness: 0.32, envMapIntensity: 0.6,
      emissive: accent, emissiveIntensity: 0.04,
      // 面を少し奥へずらし、縁の線が面に食われて途切れないようにする
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
    const mesh = new Mesh(geometry, material);
    const edgeMaterial = new LineBasicMaterial({ color: accent.clone() });
    mesh.add(new LineSegments(new EdgesGeometry(geometry, 20), edgeMaterial));
    const home = new Vector3((cx - LOGO_CENTER) / UNIT, -(cy - LOGO_CENTER) / UNIT, 0);
    mesh.position.copy(home);
    pivot.add(mesh);
    return { mesh, material, edgeMaterial, home, index, lift: 0, velocity: new Vector3(), spin: new Vector3() };
  });

  // ロゴの背後の照準。目盛りの輪、外周を回る弧、輪の上を走る光点
  const hud = new Group();
  hud.position.z = -0.9;
  stage.add(hud);
  const R = 3.1;
  const arc = (radius, from, to, segments) => {
    const list = [];
    for (let i = 0; i <= segments; i++) {
      const a = from + (to - from) * i / segments;
      list.push(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    }
    return list;
  };
  const lines = list => new BufferGeometry().setAttribute('position', new Float32BufferAttribute(list, 3));
  const hudMaterials = [];
  const hudMaterial = opacity => {
    const material = new LineBasicMaterial({ color: accent, transparent: true, opacity, depthWrite: false });
    material.userData.opacity = opacity;
    hudMaterials.push(material);
    return material;
  };
  const dial = new Group();
  dial.add(new LineLoop(lines(arc(R, 0, Math.PI * 2, 256).slice(0, -3)), hudMaterial(0.32)));
  const ticks = [];
  for (let i = 0; i < 120; i++) {
    const a = i / 120 * Math.PI * 2, outer = R + (i % 10 === 0 ? 0.3 : 0.16);
    ticks.push(Math.cos(a) * (R + 0.08), Math.sin(a) * (R + 0.08), 0, Math.cos(a) * outer, Math.sin(a) * outer, 0);
  }
  dial.add(new LineSegments(lines(ticks), hudMaterial(0.2)));
  const arcs = new Group();
  for (let i = 0; i < 3; i++) {
    const from = i * Math.PI * 2 / 3;
    arcs.add(new Line(lines(arc(R + 0.46, from, from + 0.62, 48)), hudMaterial(0.7)));
  }
  const node = new Mesh(new SphereGeometry(0.045, 12, 12), new MeshBasicMaterial({ color: new Color(0xbcd6ff).multiplyScalar(2.2), transparent: true }));
  node.material.userData.opacity = 1;
  hudMaterials.push(node.material);
  hud.add(dial, arcs, node);

  // 波打つ点の床。ポインターの下に波紋、分解したときは衝撃波が広がる
  const floorGeometry = new PlaneGeometry(44, 22, 176, 88);
  floorGeometry.rotateX(-Math.PI / 2);
  const floorUniforms = {
    uTime: { value: 0 }, uPixel: { value: 1 }, uColor: { value: accent },
    uPointer: { value: new Vector3(0, 0, 99) },
    uImpact: { value: new Vector3(0, 0, -1) }, // x・yが衝撃の位置、zが経過秒（負なら無し）
  };
  const floor = new Points(floorGeometry, new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: floorUniforms,
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uPixel;
      uniform vec3 uPointer;
      uniform vec3 uImpact;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float h = sin(p.x * 0.38 + uTime * 0.6) * 0.24 + sin(p.z * 0.55 - uTime * 0.45) * 0.2 + sin((p.x * 0.6 + p.z) * 0.3 + uTime * 0.3) * 0.3;
        float d = distance(p.xz, uPointer.xz);
        h += sin(d * 2.2 - uTime * 3.0) * 0.16 * exp(-d * 0.4);
        float r = distance(p.xz, uImpact.xy);
        h += step(0.0, uImpact.z) * exp(-pow(r - uImpact.z * 7.0, 2.0) * 0.8) * 0.6 * exp(-uImpact.z * 1.3);
        p.y += h;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPixel * (1.0 + h * 0.9) * (12.0 / -mv.z);
        vAlpha = smoothstep(34.0, 8.0, -mv.z) * clamp(0.2 + h * 0.85, 0.06, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        if (r > 0.5) discard;
        gl_FragColor = vec4(uColor, smoothstep(0.5, 0.05, r) * vAlpha);
      }`,
  }));
  scene.add(floor);

  // 漂う塵
  const dustCount = innerWidth < 760 ? 330 : 780;
  const dustPositions = [], dustSeeds = [];
  for (let i = 0; i < dustCount; i++) {
    dustPositions.push(MathUtils.randFloatSpread(28), MathUtils.randFloat(0, 10), MathUtils.randFloat(-14, 4));
    dustSeeds.push(Math.random());
  }
  const dustGeometry = new BufferGeometry();
  dustGeometry.setAttribute('position', new Float32BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute('seed', new Float32BufferAttribute(dustSeeds, 1));
  const dustUniforms = { uTime: { value: 0 }, uPixel: { value: 1 }, uColor: { value: accent } };
  scene.add(new Points(dustGeometry, new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: dustUniforms,
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uPixel;
      attribute float seed;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y = mod(p.y + uTime * (0.1 + seed * 0.16), 10.0) - 4.0;
        p.x += sin(uTime * 0.25 + seed * 20.0) * 0.3;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPixel * (1.4 + seed * 2.6) * (11.0 / -mv.z);
        vAlpha = (0.45 + 0.35 * sin(uTime * (0.8 + seed * 1.6) + seed * 40.0)) * smoothstep(26.0, 7.0, -mv.z);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        if (r > 0.5) discard;
        gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.4), smoothstep(0.5, 0.0, r) * vAlpha);
      }`,
  })));

  // 光のにじみ。細い線がギザギザにならないよう、描画先にマルチサンプルを使う（対応する端末のみ）
  const samples = renderer.extensions.has('EXT_color_buffer_float') ? 4 : 0;
  const composer = new EffectComposer(renderer, new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples }));
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new Vector2(1, 1), 0.75, 0.5, 0.22));
  composer.addPass(new OutputPass());

  // 大きさと位置。ロゴはページのグリッドにある .hero-visual の枠に合わせる
  let width = 1, height = 1, heroLeft = 0, heroPageTop = 0;
  let dpr = Math.min(devicePixelRatio || 1, innerWidth < 760 ? 1.5 : 1.75);
  const viewHeight = () => 2 * camera.position.z * Math.tan(MathUtils.degToRad(camera.fov / 2));
  function layout() {
    const heroBox = hero.getBoundingClientRect();
    const box = visual.getBoundingClientRect();
    width = Math.max(1, heroBox.width);
    height = Math.max(1, heroBox.height);
    heroLeft = heroBox.left;
    heroPageTop = heroBox.top + scrollY;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const perPx = viewHeight() / height;
    const cx = box.left + box.width / 2 - heroBox.left, cy = box.top + box.height / 2 - heroBox.top;
    const scale = box.width * (LOGO_EXTENT / LOGO_VIEWBOX[2]) * perPx / (HALF * 2);
    stage.position.set((cx - width / 2) * perPx, -(cy - height / 2) * perPx, 0);
    stage.scale.setScalar(scale);
    floor.position.set(0, stage.position.y - (HALF + 0.9) * scale, -4.5);
    const pixel = dpr * height / 900;
    floorUniforms.uPixel.value = pixel * 2.6;
    dustUniforms.uPixel.value = pixel * 2.6;
    if (ready) renderStill();
  }

  // ポインター
  const pointer = new Vector2(), smooth = new Vector2(), probe = new Vector2();
  const raycaster = new Raycaster();
  const logoPlane = new Plane(new Vector3(0, 0, 1), 0);
  const floorPlane = new Plane(new Vector3(0, 1, 0), 0);
  const hit = new Vector3(), local = new Vector3(), floorHit = new Vector3(), away = new Vector3(0, 0, 99);
  let pointerActive = false, overLogo = false;
  const toPointer = (event, target) => target.set(
    (event.clientX - heroLeft) / width * 2 - 1,
    -((event.pageY - heroPageTop) / height) * 2 + 1,
  );
  // ポインターがロゴの上にあるか（ロゴの面の座標で判定）
  function onLogo(ndc) {
    raycaster.setFromCamera(ndc, camera);
    if (!raycaster.ray.intersectPlane(logoPlane, hit)) return false;
    local.copy(hit);
    pivot.worldToLocal(local);
    return Math.abs(local.x) < HALF && Math.abs(local.y) < HALF;
  }
  hero.addEventListener('pointermove', event => {
    toPointer(event, pointer);
    pointerActive = true;
    wake();
  }, { passive: true });
  hero.addEventListener('pointerleave', () => {
    pointerActive = false;
    pointer.set(0, 0);
  });

  // 分解と組み立て。部品はばねで元の位置へ戻る
  let flash = 0, impactAt = -1;
  function scatter() {
    if (!ready || !moving()) return;
    for (const part of parts) {
      const out = new Vector3(part.home.x, part.home.y, 0).normalize();
      part.velocity.set(out.x * 8 + MathUtils.randFloatSpread(4), out.y * 8 + MathUtils.randFloatSpread(4), MathUtils.randFloat(4, 10));
      part.spin.set(MathUtils.randFloatSpread(10), MathUtils.randFloatSpread(10), MathUtils.randFloatSpread(6));
    }
    flash = 1;
    impactAt = clock;
    wake();
  }
  hero.addEventListener('click', event => {
    if (event.target.closest('a, button') || !ready || !moving()) return;
    if (onLogo(toPointer(event, probe))) scatter();
  });
  scatterButton?.addEventListener('click', scatter);

  // 1フレーム分の計算
  let ready = false, visible = true, frame = 0, last = 0, clock = 0, introStart = -1;
  const stiffness = 34, damping = 2 * Math.sqrt(stiffness) * 0.5;
  function step(dt) {
    clock += dt;
    smooth.lerp(pointer, 1 - Math.exp(-dt * 4.5));

    // 登場: 平らな図面から押し出し、休む向きへ回る。登場中はポインターの影響を抑える
    let grow = 1, settle = 1;
    if (introStart >= 0) {
      const t = clock - introStart;
      grow = easeOut(clamp01((t - 0.1) / 1.25));
      settle = easeInOut(clamp01((t - 0.15) / 1.6));
      if (t > 1.9) introStart = -1;
    }
    pivot.rotation.set((REST.x - smooth.y * 0.2) * settle, (REST.y + smooth.x * 0.32) * settle + Math.sin(clock * 0.6) * 0.025 * settle, 0);
    pivot.position.y = Math.sin(clock * 0.8) * 0.05 * settle;
    hud.scale.setScalar(0.86 + 0.14 * settle);
    hud.rotation.set(-smooth.y * 0.12 * settle, smooth.x * 0.18 * settle, 0);
    for (const material of hudMaterials) material.opacity = material.userData.opacity * settle;
    dial.rotation.z = clock * 0.05;
    arcs.rotation.z = -clock * 0.22;
    node.position.set(Math.cos(clock * 0.9) * R, Math.sin(clock * 0.9) * R, 0);
    camera.position.set(smooth.x * 0.4 * settle, smooth.y * 0.25 * settle, 13);
    camera.lookAt(0, 0, 0);
    scene.updateMatrixWorld();

    // ポインターが指す場所。近い部品を手前へ浮かせ、光を置く
    const live = moving();
    raycaster.setFromCamera(smooth, camera);
    const hasHit = pointerActive && raycaster.ray.intersectPlane(logoPlane, hit) !== null;
    if (hasHit) {
      local.copy(hit);
      pivot.worldToLocal(local);
      pointerLight.position.set(hit.x, hit.y, 2.2);
    } else pointerLight.position.set(stage.position.x - 3, stage.position.y + 3, 6);
    const over = hasHit && live && Math.abs(local.x) < HALF && Math.abs(local.y) < HALF;
    if (over !== overLogo) hero.classList.toggle('is-over-logo', overLogo = over);
    floorPlane.constant = -floor.position.y;
    floorUniforms.uPointer.value.copy(pointerActive && raycaster.ray.intersectPlane(floorPlane, floorHit) ? floorHit.sub(floor.position) : away);
    floorUniforms.uImpact.value.set(stage.position.x - floor.position.x, -floor.position.z, impactAt >= 0 ? clock - impactAt : -1);
    if (impactAt >= 0 && clock - impactAt > 4) impactAt = -1;

    for (const part of parts) {
      const { mesh, home, velocity, spin } = part;
      const distance = hasHit ? Math.hypot(local.x - home.x, local.y - home.y) : 99;
      part.lift += (Math.pow(Math.max(0, 1 - distance / 1.5), 2) - part.lift) * (1 - Math.exp(-dt * 7));
      velocity.x += ((home.x - mesh.position.x) * stiffness - velocity.x * damping) * dt;
      velocity.y += ((home.y - mesh.position.y) * stiffness - velocity.y * damping) * dt;
      velocity.z += ((part.lift * 0.32 - mesh.position.z) * stiffness - velocity.z * damping) * dt;
      mesh.position.addScaledVector(velocity, dt);
      spin.x += (-mesh.rotation.x * stiffness - spin.x * damping) * dt;
      spin.y += (-mesh.rotation.y * stiffness - spin.y * damping) * dt;
      spin.z += (-mesh.rotation.z * stiffness - spin.z * damping) * dt;
      mesh.rotation.set(mesh.rotation.x + spin.x * dt, mesh.rotation.y + spin.y * dt, mesh.rotation.z + spin.z * dt);
      mesh.scale.z = Math.max(0.02, grow);
      // 描いた順に部品を流れる光。止めているときは流さない
      const pulse = live ? Math.pow(Math.max(0, Math.sin(clock * 1.25 - part.index * 0.42)), 14) : 0;
      part.material.emissiveIntensity = 0.04 + pulse * 0.28 + part.lift * 0.3 + flash * 0.4;
      part.edgeMaterial.color.copy(accent).multiplyScalar(0.85 + pulse * 0.9 + part.lift * 0.9 + flash * 1.2);
    }
    flash *= Math.exp(-dt * 3);
    floorUniforms.uTime.value = clock;
    dustUniforms.uTime.value = clock;
  }

  // 止めたときは、部品を元の位置へ戻した静止画にする
  function settleNow() {
    introStart = -1;
    flash = 0;
    impactAt = -1;
    pointerActive = false;
    pointer.set(0, 0);
    smooth.set(0, 0);
    for (const part of parts) {
      part.mesh.position.copy(part.home);
      part.mesh.rotation.set(0, 0, 0);
      part.velocity.set(0, 0, 0);
      part.spin.set(0, 0, 0);
      part.lift = 0;
    }
    if (overLogo) hero.classList.toggle('is-over-logo', overLogo = false);
  }
  function renderStill() {
    step(0);
    composer.render();
  }

  // 遅い端末では解像度を少しずつ下げる
  let sampled = 0, slow = 0;
  function watch(dt) {
    if (dpr <= 1 || introStart >= 0) return;
    sampled++;
    if (dt > 1 / 40) slow++;
    if (sampled < 90) return;
    if (slow > 45) {
      dpr = Math.max(1, dpr - 0.25);
      layout();
    }
    sampled = slow = 0;
  }

  const running = () => ready && visible && !document.hidden && moving();
  function tick(now) {
    frame = 0;
    const dt = last ? Math.min((now - last) / 1000, 1 / 15) : 1 / 60;
    last = now;
    step(dt);
    composer.render();
    watch(dt);
    if (running()) frame = requestAnimationFrame(tick);
    else last = 0;
  }
  function wake() {
    if (!frame && running()) frame = requestAnimationFrame(tick);
  }
  function update() {
    if (scatterButton) scatterButton.hidden = !ready || !moving();
    if (!ready) return;
    if (!moving()) settleNow();
    if (running()) wake();
    else {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      renderStill();
    }
  }

  let resizeFrame = 0;
  const resizer = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(layout);
  });
  resizer.observe(hero);
  resizer.observe(visual);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }).observe(hero);
  document.addEventListener('visibilitychange', update);
  document.addEventListener('motionchange', update);
  reduced.addEventListener('change', update);
  // 描画の環境を失ったときは図面のSVGへ戻す
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    ready = false;
    cancelAnimationFrame(frame);
    frame = 0;
    hero.classList.remove('is-3d', 'is-over-logo');
    if (scatterButton) scatterButton.hidden = true;
  });

  // 図面を描いている間にシェーダーを用意しておき、切り替えの瞬間に引っかからないようにする
  const handoff = () => setTimeout(() => {
    ready = true;
    layout();
    if (moving()) introStart = clock;
    renderStill();
    hero.classList.add('is-3d');
    update();
  }, moving() ? Math.max(0, HANDOFF_AT - performance.now()) : 0);
  const warm = renderer.extensions.has('KHR_parallel_shader_compile')
    ? renderer.compileAsync(scene, camera)
    : Promise.resolve(renderer.compile(scene, camera));
  warm.catch(() => {}).then(() => {
    layout();
    composer.render();
    handoff();
  });
}

if (hero && canvas && visual) start();
