import '@fontsource-variable/orbitron';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BuildMode } from './build/build-mode';
import { Grid } from './build/grid';
import { History } from './build/history';
import {
  CAMERA,
  COLORS,
  CURSOR_MODES,
  GROUND_Y,
  LIGHTS,
  ROUGHNESS,
  SCENE,
  TEXT,
  WORLD,
  applyTheme,
  hexToNumber,
} from './constants';
import { PhysicsWorld } from './play/physics-world';
import { Sky } from './scene/sky';
import { VehicleController } from './play/vehicle-controller';
import { MenuScene } from './menu/menu-scene';
import { FrameLimiter } from './frame-limiter';
import { createSave, getSave, updateSave } from './save';
import { CursorMode } from './types';
import './styles/main.css';
import { FpsCounter } from './ui/fps-counter';
import { openCatalog } from './ui/catalog-dialog';
import { confirmDialog } from './ui/confirm-dialog';
import { Hud } from './ui/hud';
import { Hotbar } from './ui/hotbar';
import { PartInspector } from './ui/part-inspector';
import { isHelpOpen, toggleHelpDialog } from './ui/help-dialog';
import { ZoomControl } from './ui/zoom-control';
import { Menu } from './ui/menu';

async function main(): Promise<void> {
  applyTheme();
  await RAPIER.init();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const skyColor = hexToNumber(COLORS.scene.sky);
  scene.background = new THREE.Color(skyColor);
  scene.fog = new THREE.Fog(skyColor, SCENE.fogNear, SCENE.fogFar);

  const camera = new THREE.PerspectiveCamera(CAMERA.fov, innerWidth / innerHeight, CAMERA.near, CAMERA.far);
  camera.position.set(...CAMERA.startPosition);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...CAMERA.startTarget);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * CAMERA.maxPolarFactor;
  const zoom = new ZoomControl(controls, camera);

  /**
   * `maxPolarAngle` only keeps the camera above its target; panning (right drag) moves the target itself, which could
   * take both below the terrain. Clamp the target to the ground and the camera to a minimum height above it.
   */
  const keepCameraAboveGround = () => {
    const minCameraY = GROUND_Y + CAMERA.minHeight;
    if (controls.target.y >= GROUND_Y && camera.position.y >= minCameraY) return;
    controls.target.y = Math.max(controls.target.y, GROUND_Y);
    camera.position.y = Math.max(camera.position.y, minCameraY);
    camera.lookAt(controls.target);
  };
  // Stop browsers from starting "autoscroll" on a middle press.
  renderer.domElement.addEventListener('mousedown', (e) => {
    if (e.button === 1) e.preventDefault();
  });

  const sky = new Sky();
  scene.add(sky.mesh);

  scene.add(new THREE.HemisphereLight(
      hexToNumber(COLORS.white),
      hexToNumber(COLORS.scene.hemisphereGround),
      LIGHTS.hemisphereIntensity,
    ));
  const sun = new THREE.DirectionalLight(hexToNumber(COLORS.white), LIGHTS.sunIntensity);
  sun.position.set(...LIGHTS.sunPosition);
  sun.castShadow = true;
  sun.shadow.mapSize.set(LIGHTS.shadowMapSize, LIGHTS.shadowMapSize);
  const extent = LIGHTS.shadowExtent;
  Object.assign(sun.shadow.camera, {
    left: -extent,
    right: extent,
    top: extent,
    bottom: -extent,
    near: LIGHTS.shadowNear,
    far: LIGHTS.shadowFar,
  });
  scene.add(sun);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(SCENE.floorSize, SCENE.floorSize),
    new THREE.MeshStandardMaterial({ color: hexToNumber(COLORS.scene.floor), roughness: ROUGHNESS.floor }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = GROUND_Y;
  floor.receiveShadow = true;
  scene.add(floor);
  const gridLines = new THREE.GridHelper(
    SCENE.gridSize,
    SCENE.gridDivisions,
    hexToNumber(COLORS.scene.gridMajor),
    hexToNumber(COLORS.scene.gridMinor),
  );
  gridLines.position.y = GROUND_Y + SCENE.gridLift;
  scene.add(gridLines);

  const grid = new Grid();
  let activeSave: string | null = null;
  grid.subscribe(() => {
    if (activeSave) updateSave(activeSave, grid.all());
  });
  const history = new History(grid);
  const build = new BuildMode(scene, camera, renderer.domElement, grid, history);

  type Mode = 'menu' | 'build' | 'play';
  let mode: Mode = 'menu';
  const menuScene = new MenuScene(scene, camera);
  let physics: PhysicsWorld | null = null;
  let vehicle: VehicleController | null = null;

  const startPlay = () => {
    stopPlay();
    physics = new PhysicsWorld(grid);
    vehicle = new VehicleController(physics.wheels);
    scene.add(physics.group);
    mode = 'play';
    build.setEnabled(false);
    gridLines.visible = false;
    hud.setMode('play');
  };

  const stopPlay = () => {
    vehicle?.dispose();
    if (physics) {
      scene.remove(physics.group);
      physics.dispose();
    }
    vehicle = physics = null;
  };

  const stop = () => {
    stopPlay();
    mode = 'build';
    build.setEnabled(true);
    gridLines.visible = true;
    hud.setMode('build');
  };

  const enterBuild = () => {
    menuScene.stop();
    menu.hide();
    camera.position.set(...CAMERA.startPosition);
    controls.target.set(...CAMERA.startTarget);
    controls.update();
    hud.setVisible(true);
    zoom.setVisible(true);
    zoom.sync();
    stop();
  };

  const enterMenu = () => {
    stopPlay();
    mode = 'menu';
    activeSave = null;
    build.setEnabled(false);
    gridLines.visible = false;
    hud.setVisible(false);
    zoom.setVisible(false);
    menuScene.start();
    menu.show();
  };

  const menu = new Menu({
    onLoad: (id) => {
      const save = getSave(id);
      if (!save) return;
      activeSave = null; // do not rewrite the save (and bump its date) just because it was loaded
      grid.load(save.parts);
      activeSave = id;
      history.clear();
      enterBuild();
    },
    onNew: (name) => {
      activeSave = null;
      grid.clear();
      activeSave = createSave(name).id;
      history.clear();
      enterBuild();
    },
  });

  const fps = new FpsCounter();
  const hotbar = new Hotbar(() => openCatalog(hotbar));
  hotbar.subscribe((part) => build.setTool(part));

  const hud = new Hud({
    onTogglePlay: () => (physics ? stop() : startPlay()),
    onClear: async () => {
      const count = grid.all().length;
      if (count === 0) return; // nothing to clear: no popup
      const { title, message, confirm, cancel } = TEXT.clearDialog;
      const confirmed = await confirmDialog({
        title,
        message: message(count),
        confirmLabel: confirm,
        cancelLabel: cancel,
        danger: true,
      });
      if (confirmed) history.run(() => grid.clear());
    },
    onMenu: enterMenu,
    onMode: (mode) => setCursorMode(mode),
    onRotate: (direction) => build.rotate(direction),
    onHelp: toggleHelpDialog,
    onUndo: () => history.undo(),
    onRedo: () => history.redo(),
  });
  history.subscribe(() => hud.setHistoryState(history.canUndo, history.canRedo));

  // Cursor modes (Q / W / E): what the left mouse button does. The camera buttons depend on it: in build and remove
  // mode the left button is taken, in inspect mode it also rotates the camera (a click without movement inspects).
  const setCursorMode = (mode: CursorMode) => {
    build.setMode(mode);
    hud.setCursorMode(mode);
    controls.mouseButtons = {
      LEFT: mode === 'inspect' ? THREE.MOUSE.ROTATE : null,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN,
    };
    document.body.dataset.cursorMode = mode;
    hud.setRotateEnabled(build.canRotate);
  };
  setCursorMode('build');
  hotbar.subscribe(() => hud.setRotateEnabled(build.canRotate)); // after build.setTool(...) so canRotate is up to date
  hotbar.onUserSelect(() => setCursorMode('build')); // choosing a part to place means building

  const inspector = new PartInspector(grid, {
    onRemove: (part) => history.run(() => grid.remove(part.cell)),
    onClose: () => build.select(null),
  });
  build.onSelectionChange((part) => inspector.show(part));
  hud.setHistoryState(history.canUndo, history.canRedo);
  enterMenu();

  addEventListener('keydown', (e) => {
    if (e.code === 'F3') {
      e.preventDefault();
      fps.toggle();
    }
    if (e.code === 'KeyH' && mode !== 'menu' && !e.ctrlKey && !e.metaKey && !e.altKey && !isHelpOpen()) {
      toggleHelpDialog();
      return;
    }
    if (mode === 'play' && e.code === 'KeyR') startPlay();
    if (mode !== 'build') return;
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      // Ctrl/Cmd+Z undo, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z redo. Not while a paint stroke is in progress.
      const isUndo = e.code === 'KeyZ' && !e.shiftKey;
      const isRedo = e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey);
      if (isUndo || isRedo) {
        e.preventDefault();
        if (build.isPainting) return;
        if (isUndo) history.undo();
        else history.redo();
      }
      return;
    }
    // A / D rotate the part to place (they steer while playing, which is handled elsewhere).
    if ((e.code === 'KeyA' || e.code === 'KeyD') && !e.shiftKey && !e.altKey) build.rotate(e.code === 'KeyD' ? 1 : -1);
    const modeKey = CURSOR_MODES.find((mode) => mode.code === e.code);
    if (modeKey && !e.shiftKey && !e.altKey) setCursorMode(modeKey.id);
    if (/^Digit[1-9]$/.test(e.code)) hotbar.select(Number(e.code.slice(5)) - 1);
    if (e.code === 'KeyB') openCatalog(hotbar);
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  if (import.meta.env.DEV) {
    Object.assign(window, { __blocklab: { grid, camera, controls, getPhysics: () => physics, getVehicle: () => vehicle, getMode: () => mode, menuScene, build, history, zoom, hotbar } });
  }

  const timer = new THREE.Timer();
  const limiter = new FrameLimiter();
  renderer.setAnimationLoop((nowMs) => {
    if (!limiter.shouldRender(nowMs)) return;
    timer.update();
    const dt = Math.min(timer.getDelta(), WORLD.maxFrameTime);
    if (mode === 'menu') {
      menuScene.update(dt);
    } else if (physics) {
      vehicle?.update();
      physics.step(dt);
      if (physics.focus) {
        const t = physics.focus.translation();
        const next = new THREE.Vector3(t.x, t.y, t.z);
        camera.position.add(next.clone().sub(controls.target));
        controls.target.copy(next);
      }
    }
    if (mode !== 'menu') {
      controls.update();
      keepCameraAboveGround();
      build.update(dt);
    }
    sky.update(timer.getElapsed(), camera.position);
    fps.frame(timer.getElapsed());
    renderer.render(scene, camera);
  });
}

main();
