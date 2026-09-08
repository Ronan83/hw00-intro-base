import {vec3, vec4} from 'gl-matrix';
import Drawable from '../rendering/gl/Drawable';
import {gl} from '../globals';

class Cube extends Drawable {
  indices: Uint32Array;
  positions: Float32Array;
  normals: Float32Array;
  center: vec4;

  constructor(center: vec3, public sideLength: number = 2) {
    super();
    this.center = vec4.fromValues(center[0], center[1], center[2], 1);
  }

  create() {
    const s = this.sideLength * 0.5;

    // 每个面的法线 n 和两个面内方向 u, v
    const faces: Array<{n: number[], u: number[], v: number[]}> = [
      {n: [ 1, 0, 0], u: [0, 1, 0], v: [0, 0, 1]},
      {n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0]},
      {n: [ 0, 1, 0], u: [0, 0, 1], v: [1, 0, 0]},
      {n: [ 0,-1, 0], u: [1, 0, 0], v: [0, 0, 1]},
      {n: [ 0, 0, 1], u: [1, 0, 0], v: [0, 1, 0]},
      {n: [ 0, 0,-1], u: [0, 1, 0], v: [1, 0, 0]},
    ];

    const pos: number[] = [];
    const nor: number[] = [];
    const idx: number[] = [];

    for (let f = 0; f < faces.length; ++f) {
      const face = faces[f];
      const n = face.n, u = face.u, v = face.v;
      const signs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

      for (let k = 0; k < 4; ++k) {
        const su = signs[k][0], sv = signs[k][1];
        pos.push(
          this.center[0] + s * (n[0] + su * u[0] + sv * v[0]),
          this.center[1] + s * (n[1] + su * u[1] + sv * v[1]),
          this.center[2] + s * (n[2] + su * u[2] + sv * v[2]),
          1
        );
        nor.push(n[0], n[1], n[2], 0);
      }

      const base = f * 4;
      idx.push(base, base + 1, base + 2);
      idx.push(base, base + 2, base + 3);
    }

    this.positions = new Float32Array(pos);
    this.normals = new Float32Array(nor);
    this.indices = new Uint32Array(idx);

    this.generateIdx();
    this.generatePos();
    this.generateNor();

    this.count = this.indices.length;

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufIdx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufNor);
    gl.bufferData(gl.ARRAY_BUFFER, this.normals, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPos);
    gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.STATIC_DRAW);

    console.log(`Created cube with ${this.positions.length / 4} vertices`);
  }
};

export default Cube;