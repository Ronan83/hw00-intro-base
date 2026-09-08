import {vec3, vec4} from 'gl-matrix';
import Stats from 'stats-js';
import * as DAT from 'dat.gui';
import Icosphere from './geometry/Icosphere';
import Square from './geometry/Square';
import Cube from './geometry/Cube';
import Drawable from './rendering/gl/Drawable';
import planetVertSource from './shaders/planet-vert.glsl?raw';
import planetFragSource from './shaders/planet-frag.glsl?raw';
import OpenGLRenderer from './rendering/gl/OpenGLRenderer';
import Camera from './Camera';
import {setGL} from './globals';
import ShaderProgram, {Shader} from './rendering/gl/ShaderProgram';

import backgroundVertSource from './shaders/background-vert.glsl?raw';
import backgroundFragSource from './shaders/background-frag.glsl?raw';

import lambertVertSource from './shaders/lambert-vert.glsl?raw';
import lambertFragSource from './shaders/lambert-frag.glsl?raw';

// Define an object with application parameters and button callbacks
// This will be referred to by dat.GUI's functions that add GUI elements.
const controls = {
  tesselations: 5,
  'Load Scene': loadScene, // A function pointer, essentially
  color: [255, 60, 40],
  model: 'Cube',
  shader: 'Planet',
  wobbleSpeed: 0.02,
  wobbleAmp: 0.04,
};

let icosphere: Icosphere;
let square: Square;
let cube: Cube;
let prevTesselations: number = 5;
let time: number = 0;

function loadScene() {
  icosphere = new Icosphere(vec3.fromValues(0, 0, 0), 1, controls.tesselations);
  icosphere.create();
  square = new Square(vec3.fromValues(0, 0, 0));
  square.create();
  cube = new Cube(vec3.fromValues(0, 0, 0), 2);
  cube.create();
}

function main() {
  // Initial display for framerate
  const stats = Stats();
  stats.setMode(0);
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.left = '0px';
  stats.domElement.style.top = '0px';
  document.body.appendChild(stats.domElement);

  // Add controls to the gui
  const gui = new DAT.GUI();
  gui.add(controls, 'tesselations', 0, 8).step(1);
  gui.add(controls, 'Load Scene');
  gui.addColor(controls, 'color');
  gui.add(controls, 'model', ['Icosphere', 'Cube', 'Square']);
  gui.add(controls, 'shader', ['Planet', 'Lambert']);
  gui.add(controls, 'wobbleSpeed', 0, 0.1).step(0.005);
  gui.add(controls, 'wobbleAmp', 0, 0.3).step(0.01);

  // get canvas and webgl context
  const canvas = <HTMLCanvasElement> document.getElementById('canvas');
  const gl = <WebGL2RenderingContext> canvas.getContext('webgl2');
  if (!gl) {
    alert('WebGL 2 not supported!');
  }
  // `setGL` is a function imported above which sets the value of `gl` in the `globals.ts` module.
  // Later, we can import `gl` from `globals.ts` to access it
  setGL(gl);

  // Initial call to load scene
  loadScene();

  const camera = new Camera(vec3.fromValues(0, 0, 5), vec3.fromValues(0, 0, 0));

  const renderer = new OpenGLRenderer(canvas);
  renderer.setClearColor(0.2, 0.2, 0.2, 1);
  gl.enable(gl.DEPTH_TEST);

  const lambert = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, lambertVertSource),
    new Shader(gl.FRAGMENT_SHADER, lambertFragSource),
  ]);

  const planet = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, planetVertSource),
    new Shader(gl.FRAGMENT_SHADER, planetFragSource),
  ]);

  const background = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, backgroundVertSource),
    new Shader(gl.FRAGMENT_SHADER, backgroundFragSource),
  ]);

  // This function will be called every frame
    function tick() {
    camera.update();
    stats.begin();
    gl.viewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.clear();

    time++;
    lambert.setTime(time);

    // Draw the starfield first, with depth writes off so it never
    // occludes the planet.
    gl.depthMask(false);
    background.setTime(time);
    background.setDimensions(window.innerWidth, window.innerHeight);
    renderer.render(camera, background, [square], vec4.fromValues(0, 0, 0, 1));
    gl.depthMask(true);



    if(controls.tesselations != prevTesselations)
    {
      prevTesselations = controls.tesselations;
      icosphere = new Icosphere(vec3.fromValues(0, 0, 0), 1, prevTesselations);
      icosphere.create();
    }
    
    let drawable: Drawable;
    if (controls.model === 'Cube') {
      drawable = cube;
    } else if (controls.model === 'Square') {
      drawable = square;
    } else {
      drawable = icosphere;
    }

    let prog = (controls.shader === 'Planet') ? planet : lambert;

    time++;
    prog.setTime(time);
    prog.setWobble(controls.wobbleSpeed, controls.wobbleAmp);

    renderer.render(camera, prog, [
      drawable,
    ], vec4.fromValues(
      controls.color[0] / 255,
      controls.color[1] / 255,
      controls.color[2] / 255,
      1
    ));

    stats.end();

    // Tell the browser to call `tick` again whenever it renders a new frame
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', function() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.setAspectRatio(window.innerWidth / window.innerHeight);
    camera.updateProjectionMatrix();
  }, false);

  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.setAspectRatio(window.innerWidth / window.innerHeight);
  camera.updateProjectionMatrix();

  // Start the render loop
  tick();
}

main();
