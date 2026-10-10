import '@fontsource-variable/orbitron';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BuildMode } from './build/build-mode';
import { Grid } from './build/grid';
import {
  CAMERA,
  COLORS,
  GROUND_Y,
  LIGHTS,
  ROUGHNESS,
  SCENE,
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
import './styles/main.css';
import { FpsCounter } from './ui/fps-counter';
import { Hud } from './ui/hud';
import { Menu } from './ui/menu';
import { PartType } from './types';

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
  const build = new BuildMode(scene, camera, renderer.domElement, grid);

  type Mode = 'menu' | 'build' | 'play';
  let mode: Mode = 'menu';
  const menuScene = new MenuScene(scene, camera);
  let physics: PhysicsWorld | null = null;
  let vehicle: VehicleController | null = null;

  const setTool = (tool: PartType) => {
    build.setTool(tool);
    hud.setTool(tool);
  };

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
    stop();
  };

  const enterMenu = () => {
    stopPlay();
    mode = 'menu';
    activeSave = null;
    build.setEnabled(false);
    gridLines.visible = false;
    hud.setVisible(false);
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
      enterBuild();
    },
    onNew: (name) => {
      activeSave = null;
      grid.clear();
      activeSave = createSave(name).id;
      enterBuild();
    },
  });

  const fps = new FpsCounter();

  const hud = new Hud({
    onTool: setTool,
    onTogglePlay: () => (physics ? stop() : startPlay()),
    onClear: () => grid.clear(),
    onMenu: enterMenu,
  });
  setTool('block');
  enterMenu();

  addEventListener('keydown', (e) => {
    if (e.code === 'F3') {
      e.preventDefault();
      fps.toggle();
    }
    if (mode === 'play' && e.code === 'KeyR') startPlay();
    if (mode !== 'build') return;
    if (e.code === 'Digit1') setTool('block');
    if (e.code === 'Digit2') setTool('wheel');
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  if (import.meta.env.DEV) {
    Object.assign(window, { __blocklab: { grid, camera, controls, getPhysics: () => physics, getMode: () => mode, menuScene } });
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
    if (mode !== 'menu') controls.update();
    sky.update(timer.getElapsed(), camera.position);
    fps.frame(timer.getElapsed());
    renderer.render(scene, camera);
  });
}

main();
