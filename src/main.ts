import '@fontsource-variable/orbitron';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BuildMode } from './build/build-mode';
import { Grid } from './build/grid';
import { PhysicsWorld } from './play/physics-world';
import { VehicleController } from './play/vehicle-controller';
import { MenuScene } from './menu/menu-scene';
import { createSave, getSave, updateSave } from './save';
import { Hud } from './ui/hud';
import { Menu } from './ui/menu';
import { PartType } from './types';

async function main(): Promise<void> {
  await RAPIER.init();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc5e8);
  scene.fog = new THREE.Fog(0x9fc5e8, 60, 160);

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);
  camera.position.set(6, 6, 9);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.5, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.495;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7a5a, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(12, 20, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 80 });
  scene.add(sun);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0x7fae6a, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  scene.add(floor);
  const gridLines = new THREE.GridHelper(60, 60, 0x2f4f2f, 0x4f7f4f);
  gridLines.position.y = -0.499;
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
    camera.position.set(6, 6, 9);
    controls.target.set(0, 0.5, 0);
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

  const hud = new Hud({
    onTool: setTool,
    onTogglePlay: () => (physics ? stop() : startPlay()),
    onClear: () => grid.clear(),
    onMenu: enterMenu,
  });
  setTool('block');
  enterMenu();

  addEventListener('keydown', (e) => {
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
  renderer.setAnimationLoop(() => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
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
    renderer.render(scene, camera);
  });
}

main();
