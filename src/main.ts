import '@fontsource-variable/orbitron';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BuildMode } from './build/build-mode';
import { Grid } from './build/grid';
import { History } from './build/history';
import {
  CAMERA,
  CELL_SIZE,
  COLORS,
  CURSOR_MODES,
  GROUND_Y,
  LIGHTS,
  ROUGHNESS,
  SCENE,
  DEFAULT_GRID_CELLS,
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
import { createSave, getSave, gridCellsOf, updateSave } from './save';
import { CursorMode } from './types';
import './styles/main.css';
import { FpsCounter } from './ui/fps-counter';
import { openCatalog } from './ui/catalog-dialog';
import { confirmDialog } from './ui/confirm-dialog';
import { Hud } from './ui/hud';
import { Hotbar } from './ui/hotbar';
import { PaintPalette } from './ui/paint-palette';
import { PartInspector } from './ui/part-inspector';
import { isHelpOpen, toggleHelpDialog } from './ui/help-dialog';
import { ZoomControl } from './ui/zoom-control';
import { Menu } from './ui/menu';
import { LoadingScreen } from './ui/loading-screen';

async function main(): Promise<void> {
  applyTheme();
  document.documentElement.classList.add('ready'); // reveals the page (see the inline style in index.html)
  const loading = new LoadingScreen();
  loading.show(TEXT.loading.boot.physics);
  loading.setProgress(0.1);
  await RAPIER.init();
  loading.setProgress(0.5, TEXT.loading.boot.world);

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
  sun.shadow.bias = LIGHTS.shadowBias;
  sun.shadow.normalBias = LIGHTS.shadowNormalBias;
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
  // The lines of the floor grid, one square per cell; rebuilt when a game with another grid size is opened.
  let gridLines: THREE.GridHelper | undefined;
  const setGridSize = (cells: number) => {
    const visible = gridLines?.visible ?? false;
    if (gridLines) {
      scene.remove(gridLines);
      gridLines.geometry.dispose();
    }
    gridLines = new THREE.GridHelper(
      cells * CELL_SIZE,
      cells,
      hexToNumber(COLORS.scene.gridMajor),
      hexToNumber(COLORS.scene.gridMinor),
    );
    // The grid spans the cells -n/2 … n/2 - 1, so it is shifted half a cell to put its lines on the cell borders.
    gridLines.position.set(-CELL_SIZE / 2, GROUND_Y + SCENE.gridLift, -CELL_SIZE / 2);
    gridLines.visible = visible;
    scene.add(gridLines);
    grid.setSize(cells);
  };

  const grid = new Grid();
  setGridSize(DEFAULT_GRID_CELLS);
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
    gridLines!.visible = false;
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
    gridLines!.visible = true;
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
    gridLines!.visible = false;
    hud.setVisible(false);
    zoom.setVisible(false);
    menuScene.start();
    menu.show();
  };

  // Scene changes go through the loading screen: one labelled step per phase (see `LoadingScreen.run`).
  const menu = new Menu({
    onLoad: (id) => {
      const save = getSave(id);
      if (!save) return;
      void loading.run([
        {
          label: TEXT.loading.loadGame,
          run: () => {
            activeSave = null; // do not rewrite the save (and bump its date) just because it was loaded
            setGridSize(gridCellsOf(save));
            grid.load(save.parts);
            activeSave = id;
            history.clear();
          },
        },
        { label: TEXT.loading.buildArea, run: enterBuild },
      ]);
    },
    onNew: (name, gridCells) => {
      void loading.run([
        {
          label: TEXT.loading.newGame,
          run: () => {
            activeSave = null;
            setGridSize(gridCells);
            grid.clear();
            activeSave = createSave(name, gridCells).id;
            history.clear();
          },
        },
        { label: TEXT.loading.buildArea, run: enterBuild },
      ]);
    },
  });

  const fps = new FpsCounter();
  const hotbar = new Hotbar(() => openCatalog(hotbar));
  hotbar.subscribe((part) => build.setTool(part));

  const hud = new Hud({
    onTogglePlay: () => (physics ? stop() : startPlay()),
    onReset: () => startPlay(),
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
    onMenu: () => void loading.run([{ label: TEXT.loading.toMenu, run: enterMenu }]),
    onMode: (mode) => setCursorMode(mode),
    onRotate: (direction) => build.rotate(direction),
    onHelp: toggleHelpDialog,
    onUndo: () => history.undo(),
    onRedo: () => history.redo(),
  });
  history.subscribe(() => hud.setHistoryState(history.canUndo, history.canRedo));

  // Cursor modes (Q / W / E / R): what the left mouse button does. The camera buttons depend on it: in build and remove
  // mode the left button is taken, in inspect mode it also rotates the camera (a click without movement inspects).
  const palette = new PaintPalette((color) => build.setPaintColor(color));
  const setCursorMode = (mode: CursorMode) => {
    build.setMode(mode);
    hud.setCursorMode(mode);
    palette.show(mode === 'paint');
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
    onWeight: (part, weight, connected) => history.run(() => grid.setWeight(part.cell, weight, connected)),
    onTire: (part, tire, wholeBody) => history.run(() => grid.setTire(part.cell, tire, wholeBody)),
    onSuspension: (part, strength) => history.run(() => grid.setSuspension(part.cell, strength)),
    onClose: () => build.select(null),
  });
  build.onSelectionChange((part) => inspector.show(part));
  hud.setHistoryState(history.canUndo, history.canRedo);
  enterMenu();
  void loading.hide();

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
    if (e.code === 'KeyB' || e.code === 'KeyC') openCatalog(hotbar);
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
