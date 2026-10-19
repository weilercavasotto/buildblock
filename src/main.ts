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
  UI_CLICK_SELECTOR,
  GROUND_Y,
  LIGHTS,
  ROUGHNESS,
  SAVE,
  SCENE,
  DEFAULT_GRID_CELLS,
  TEXT,
  WORLD,
  applyTheme,
  hexToNumber,
} from './constants';
import { PhysicsWorld } from './play/physics-world';
import { Sky } from './scene/sky';
import { keepCameraAboveGround, limitCamera, panArea } from './camera-limits';
import { VehicleController } from './play/vehicle-controller';
import { MenuScene } from './menu/menu-scene';
import { FrameLimiter } from './frame-limiter';
import { createSave, engineDriveOf, getSave, gridCellsOf, updateSave } from './save';
import { CursorMode } from './types';
import './styles/main.css';
import { FpsCounter } from './ui/fps-counter';
import { openCatalog } from './ui/catalog-dialog';
import { confirmDialog } from './ui/confirm-dialog';
import { ControlsPanel } from './ui/controls-panel';
import { sound } from './audio/sound';
import { VehicleSound } from './audio/vehicle-sound';
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
  let gridCells = DEFAULT_GRID_CELLS;
  /** Where the camera may be panned to while building (see `panArea`); null when it has to be computed again. */
  let panBox: THREE.Box3 | null = null;
  const setGridSize = (cells: number) => {
    gridCells = cells;
    panBox = null;
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
    panBox = null;
    if (activeSave) updateSave(activeSave, grid.all());
  });
  const history = new History(grid);
  const build = new BuildMode(scene, camera, renderer.domElement, grid, history);

  type Mode = 'menu' | 'build' | 'play';
  let mode: Mode = 'menu';
  const menuScene = new MenuScene(scene, camera);
  let physics: PhysicsWorld | null = null;
  let vehicle: VehicleController | null = null;
  let vehicleSound: VehicleSound | null = null;

  const startPlay = () => {
    stopPlay();
    physics = new PhysicsWorld(grid);
    vehicle = new VehicleController(physics.wheels);
    hud.setNotice(grid.engineDrive && physics.wheels.length > 0 && vehicle.poweredWheels === 0 ? TEXT.hud.noEngine : null);
    scene.add(physics.group);
    controlsPanel.show(grid.all());
    vehicleSound = new VehicleSound();
    sound.play('click'); // the standard button sound (Play, Reset and the P / R keys)
    mode = 'play';
    build.setEnabled(false);
    gridLines!.visible = false;
    hud.setMode('play');
  };

  const stopPlay = () => {
    controlsPanel.hide();
    if (vehicleSound) sound.play('click'); // the same sound for Stop (and Esc / P)
    vehicleSound?.dispose();
    vehicleSound = null;
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
      sound.play('confirm');
      void loading.run([
        {
          label: TEXT.loading.loadGame,
          run: () => {
            activeSave = null; // do not rewrite the save (and bump its date) just because it was loaded
            setGridSize(gridCellsOf(save));
            grid.engineDrive = engineDriveOf(save);
            grid.load(save.parts, save.format !== SAVE.format);
            activeSave = id;
            history.clear();
          },
        },
        { label: TEXT.loading.buildArea, run: enterBuild },
      ]);
    },
    onNew: (name, gridCells) => {
      sound.play('confirm');
      void loading.run([
        {
          label: TEXT.loading.newGame,
          run: () => {
            activeSave = null;
            setGridSize(gridCells);
            grid.engineDrive = true;
            grid.clear();
            activeSave = createSave(name, gridCells).id;
            history.clear();
          },
        },
        { label: TEXT.loading.buildArea, run: enterBuild },
      ]);
    },
  });

  const controlsPanel = new ControlsPanel();
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
      if (confirmed) history.run(() => build.removeAnimated(() => grid.clear()));
    },
    onMenu: () => void loading.run([{ label: TEXT.loading.toMenu, run: enterMenu }]),
    onSaves: () => {
      if (physics) stop(); // the keys of the name field must not drive the vehicle
      menu.openSaves();
    },
    onMode: (mode) => setCursorMode(mode),
    onRotate: (direction) => build.rotate(direction),
    onTilt: (direction) => build.tilt(direction),
    onHelp: toggleHelpDialog,
    onUndo: () => history.undo(),
    onRedo: () => history.redo(),
  });
  history.subscribe(() => hud.setHistoryState(history.canUndo, history.canRedo));

  // Cursor modes (I / B / E / R): what the left mouse button does (it never moves the camera: in inspect mode a drag draws a
  // selection box).
  const palette = new PaintPalette((color) => build.setPaintColor(color));
  const setCursorMode = (mode: CursorMode) => {
    if (mode !== build.cursorMode) sound.play('mode', { pitch: 0.9 + 0.1 * CURSOR_MODES.findIndex((m) => m.id === mode) });
    build.setMode(mode);
    hud.setCursorMode(mode);
    palette.show(mode === 'paint');
    controls.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN,
    };
    document.body.dataset.cursorMode = mode;
    hud.setRotateEnabled(build.canRotate);
    hud.setTiltEnabled(build.canTilt);
  };
  setCursorMode('build');
  hotbar.subscribe(() => {
    hud.setRotateEnabled(build.canRotate); // after build.setTool(...) so canRotate is up to date
    hud.setTiltEnabled(build.canTilt);
  });
  hotbar.onUserSelect(() => {
    sound.play('tick');
    setCursorMode('build'); // choosing a part to place means building
  });

  const inspector = new PartInspector(grid, {
    onRemove: (part) => history.run(() => build.removeAnimated(() => grid.remove(part.cell))),
    onWeight: (part, weight, connected) => history.run(() => grid.setWeight(part.cell, weight, connected)),
    onTire: (part, tire, wholeBody) => history.run(() => grid.setTire(part.cell, tire, wholeBody)),
    onStroke: (part, stroke) => history.run(() => grid.setStroke(part.cell, stroke)),
    onSpeed: (part, speed) => history.run(() => grid.setSpeed(part.cell, speed)),
    onPower: (part, power, connected) => history.run(() => grid.setPower(part.cell, power, connected)),
    onBrake: (part, strength, wholeBody) => history.run(() => grid.setBrake(part.cell, strength, wholeBody)),
    onSuspension: (part, strength) => history.run(() => grid.setSuspension(part.cell, strength)),
    onRemoveMany: (parts) =>
      history.run(() =>
        build.removeAnimated(() => {
          for (const part of parts) grid.remove(part.cell);
        }),
      ),
    onMove: (direction) => build.moveSelectionBy(direction),
    onClose: () => build.select(null),
  });
  build.onSelectionChange((parts) => inspector.show(parts));
  hud.setHistoryState(history.canUndo, history.canRedo);
  enterMenu();
  void loading.hide();

  // The sound button (and M): mute / unmute, saved with the settings.
  const soundButton = document.getElementById('btn-sound')!;
  const showSound = () => {
    soundButton.classList.toggle('muted', sound.muted);
    soundButton.title = sound.muted ? TEXT.hud.soundOff : TEXT.hud.soundOn;
    soundButton.setAttribute('aria-label', soundButton.title);
  };
  soundButton.onclick = () => {
    sound.toggleMuted();
    soundButton.blur();
    sound.play('click');
  };
  sound.onMuteChange(showSound);
  showSound();
  // The buttons of the menus, dialogs and panels click when pressed (the other sounds belong to what the button does).
  document.addEventListener(
    'click',
    (e) => {
      const button = (e.target as Element).closest?.('button');
      if (button && !button.disabled && button.matches(UI_CLICK_SELECTOR)) sound.play('click');
    },
    true,
  );

  addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
      sound.toggleMuted();
      if (!sound.muted) sound.play('click');
      return;
    }
    if (menu.overGame) return; // the saved-games panel is open over the game: typing a name must not trigger shortcuts
    if (e.code === 'F3') {
      e.preventDefault();
      fps.toggle();
    }
    if (e.code === 'KeyH' && mode !== 'menu' && !e.ctrlKey && !e.metaKey && !e.altKey && !isHelpOpen()) {
      toggleHelpDialog();
      return;
    }
    // Esc also stops while playing (a dialog that is open takes the Esc itself: see `openModal`).
    if (e.code === 'Escape' && mode === 'play') {
      stop();
      return;
    }
    // P plays, and stops again while playing (like the Play / Stop button).
    if (e.code === 'KeyP' && mode !== 'menu' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (physics) stop();
      else startPlay();
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
    // W / S (and the Up / Down arrows) tilt the part to place; with A / D they only rotate it while building (while playing
    // they drive, which is handled elsewhere).
    if ((e.code === 'KeyW' || e.code === 'KeyS' || e.code === 'ArrowUp' || e.code === 'ArrowDown') && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      build.tilt(e.code === 'KeyW' || e.code === 'ArrowUp' ? 1 : -1);
    }
    const modeKey = CURSOR_MODES.find((mode) => mode.code === e.code);
    if (modeKey && !e.shiftKey && !e.altKey) setCursorMode(modeKey.id);
    if (/^Digit[1-9]$/.test(e.code)) hotbar.select(Number(e.code.slice(5)) - 1);
    if (e.code === 'KeyC') openCatalog(hotbar);
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
      physics.level = vehicle?.level ?? 0;
      physics.throttle = vehicle?.throttle ?? 0;
      physics.rotating = vehicle?.rotating ?? false;
      physics.extended = vehicle?.extended ?? false;
      physics.boosting = vehicle?.boosting ?? false;
      physics.thrusting = vehicle?.thrusting ?? false;
      physics.steering = vehicle?.steering ?? false;
      physics.pilot = vehicle?.pilot ?? { pitch: 0, roll: 0, yaw: 0 };
      physics.step(dt);
      if (vehicle) {
        vehicleSound?.update(
          physics.audioState(),
          { level: vehicle.level, braking: vehicle.braking, boosting: vehicle.boosting, thrusting: vehicle.thrusting, rotors: vehicle.rotating },
          dt,
        );
      }
      if (physics.focus) {
        const t = physics.focus.translation();
        const next = new THREE.Vector3(t.x, t.y, t.z);
        camera.position.add(next.clone().sub(controls.target));
        controls.target.copy(next);
      }
    }
    if (mode !== 'menu') {
      // While building the camera cannot be panned away from the creation; while playing it follows the vehicle wherever it goes.
      if (mode === 'build') panBox ??= panArea(grid.all(), gridCells);
      limitCamera(controls, camera, mode === 'build' ? panBox : null);
      controls.update();
      keepCameraAboveGround(controls, camera);
      build.update(dt);
    }
    sky.update(timer.getElapsed(), camera.position);
    fps.frame(timer.getElapsed());
    renderer.render(scene, camera);
  });
}

main();
