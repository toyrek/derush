// fluide.js — un fluide en deux dimensions, calculé par la carte graphique (WebGL 2) : de l'encre, de la fumée.
//
// Adapté pour Dérush de « WebGL Fluid Simulation » de Pavel Dobryakov
// (https://github.com/PavelDoGreat/WebGL-Fluid-Simulation, commit a2d2929), sous licence MIT :
//
//   MIT License — Copyright (c) 2017 Pavel Dobryakov
//   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
//   documentation files (the "Software"), to deal in the Software without restriction, including without limitation
//   the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
//   to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//   The above copyright notice and this permission notice shall be included in all copies or substantial portions of
//   the Software.
//   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
//   THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
//   CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
//   IN THE SOFTWARE.
//
// Ce qui est repris : les calculs du fluide (les tourbillons, la divergence, la pression, le transport), réécrits pour
// WebGL 2. Ce qui change : plus de souris ni d'interface, plus de halo ni de rayons ; le pas de temps est donné par la
// page (toujours le même), les gouttes aussi ; l'image finale est une encre sur du papier (ou une fumée sur du noir).
// Un fluide est une SIMULATION : la page qui s'en sert écrit window.toile.suite = true.

const SOMMETS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
out vec2 vUv, vL, vR, vT, vB;
uniform vec2 texelSize;
void main () {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;
const TETE = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv, vL, vR, vT, vB;
out vec4 sortie;
`;
const FRAGMENTS = {
  goutte: `uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color; uniform vec2 point; uniform float radius;
    void main () { vec2 p = vUv - point; p.x *= aspectRatio; vec3 splat = exp(-dot(p, p) / radius) * color; sortie = vec4(texture(uTarget, vUv).xyz + splat, 1.0); }`,
  transport: `uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 texelSize; uniform float dt; uniform float dissipation;
    void main () { vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize; sortie = texture(uSource, coord) / (1.0 + dissipation * dt); }`,
  divergence: `uniform sampler2D uVelocity;
    void main () {
      float L = texture(uVelocity, vL).x; float R = texture(uVelocity, vR).x; float T = texture(uVelocity, vT).y; float B = texture(uVelocity, vB).y;
      vec2 C = texture(uVelocity, vUv).xy;
      if (vL.x < 0.0) { L = -C.x; } if (vR.x > 1.0) { R = -C.x; } if (vT.y > 1.0) { T = -C.y; } if (vB.y < 0.0) { B = -C.y; }
      sortie = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
    }`,
  rotation: `uniform sampler2D uVelocity;
    void main () { float L = texture(uVelocity, vL).y; float R = texture(uVelocity, vR).y; float T = texture(uVelocity, vT).x; float B = texture(uVelocity, vB).x; sortie = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0); }`,
  tourbillon: `uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;
    void main () {
      float L = texture(uCurl, vL).x; float R = texture(uCurl, vR).x; float T = texture(uCurl, vT).x; float B = texture(uCurl, vB).x; float C = texture(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      force /= length(force) + 0.0001; force *= curl * C; force.y *= -1.0;
      vec2 v = texture(uVelocity, vUv).xy + force * dt;
      sortie = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
    }`,
  pression: `uniform sampler2D uPressure; uniform sampler2D uDivergence;
    void main () { float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x; float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;
      sortie = vec4((L + R + B + T - texture(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0); }`,
  gradient: `uniform sampler2D uPressure; uniform sampler2D uVelocity;
    void main () { float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x; float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;
      sortie = vec4(texture(uVelocity, vUv).xy - vec2(R - L, T - B), 0.0, 1.0); }`,
  attenuer: `uniform sampler2D uTexture; uniform float value;
    void main () { sortie = value * texture(uTexture, vUv); }`,
  // l'image : l'encre retire de la lumière au papier (elle ne s'ajoute pas), s'accumule un peu sur ses bords comme une
  // aquarelle qui sèche, et le papier a son grain. En mode fumée : la matière s'ajoute sur un fond sombre.
  image: `uniform sampler2D uTexture; uniform vec2 texelSize; uniform vec3 papier; uniform float force; uniform float bord; uniform float grain; uniform float fumee; uniform float aspectRatio;
    float h (vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main () {
      vec3 e = max(texture(uTexture, vUv).rgb, 0.0);
      vec3 eL = texture(uTexture, vL).rgb, eR = texture(uTexture, vR).rgb, eT = texture(uTexture, vT).rgb, eB = texture(uTexture, vB).rgb;
      float pente = length(vec2(dot(eR - eL, vec3(0.333)), dot(eT - eB, vec3(0.333))));
      vec2 q = vUv * vec2(aspectRatio, 1.0);
      float fibre = (h(floor(q * 900.0)) - 0.5) * 0.6 + (h(floor(q * 260.0)) - 0.5) * 0.4;
      vec3 encre = papier * exp(-(e * force + pente * bord)) * (1.0 + grain * fibre);
      vec3 nuage = papier + (1.0 - exp(-e * force)) * (1.0 + grain * fibre);
      sortie = vec4(mix(encre, nuage, fumee), 1.0);
    }`,
};

/**
 * Crée un fluide sur un canevas. `simulation` et `encre` : la finesse du calcul et celle de l'image (en lignes).
 * Rend {goutte, pas, dessiner, vider}.
 */
export function creerFluide(canvas, {simulation = 256, encre = 1024, pression = 20, tourbillon = 24, dissipationVitesse = 0.3, dissipationEncre = 0.06} = {}) {
  const gl = canvas.getContext('webgl2', {alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true});
  if (!gl) throw new Error('WebGL 2 n’est pas disponible : essaie « --gl logiciel ».');
  if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('La carte graphique ne sait pas dessiner dans une texture à virgule : essaie « --gl logiciel ».');
  gl.getExtension('OES_texture_float_linear');
  const compiler = (type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`fluide.js : ${gl.getShaderInfoLog(s)}`); return s; };
  const sommets = compiler(gl.VERTEX_SHADER, SOMMETS);
  const programme = (nom) => {
    const p = gl.createProgram();
    gl.attachShader(p, sommets);
    gl.attachShader(p, compiler(gl.FRAGMENT_SHADER, TETE + FRAGMENTS[nom]));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`fluide.js : ${gl.getProgramInfoLog(p)}`);
    const u = {};
    for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) { const n = gl.getActiveUniform(p, i).name; u[n] = gl.getUniformLocation(p, n); }
    return {p, u};
  };
  const P = Object.fromEntries(Object.keys(FRAGMENTS).map((n) => [n, programme(n)]));
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  const ratio = canvas.width / canvas.height;
  const taille = (lignes) => (ratio >= 1 ? [Math.round(lignes * ratio), lignes] : [lignes, Math.round(lignes / ratio)]);
  const cible = ([w, h], interne, format, filtre) => {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtre);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filtre);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, interne, w, h, 0, format, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {texture, fbo, w, h, tx: 1 / w, ty: 1 / h, lier(i) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, texture); return i; }};
  };
  const double = (...a) => { let lu = cible(...a), ecrit = cible(...a); return {get lu() { return lu; }, get ecrit() { return ecrit; }, tourner() { [lu, ecrit] = [ecrit, lu]; }}; };
  const S = taille(simulation), E = taille(encre);
  const vitesse = double(S, gl.RG16F, gl.RG, gl.LINEAR);
  const teinte = double(E, gl.RGBA16F, gl.RGBA, gl.LINEAR);
  const press = double(S, gl.R16F, gl.RED, gl.NEAREST);
  const diverg = cible(S, gl.R16F, gl.RED, gl.NEAREST);
  const rot = cible(S, gl.R16F, gl.RED, gl.NEAREST);
  const dessinerVers = (c) => {
    if (c) { gl.viewport(0, 0, c.w, c.h); gl.bindFramebuffer(gl.FRAMEBUFFER, c.fbo); } else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  };
  const lancer = (prog) => { gl.useProgram(prog.p); return prog.u; };
  gl.disable(gl.BLEND);

  return {
    /**
     * Une goutte : sa place (x, y de 0 à 1, y vers le haut), son élan (dx, dy), sa couleur visible [r, v, b] de 0 à 1,
     * sa quantité, son rayon (0,002 : une goutte ; 0,01 : une flaque).
     */
    goutte({x, y, dx = 0, dy = 0, couleur = [0.1, 0.1, 0.1], quantite = 1, rayon = 0.0025, fumee = false}) {
      let u = lancer(P.goutte);
      gl.uniform1i(u.uTarget, vitesse.lu.lier(0));
      gl.uniform1f(u.aspectRatio, ratio);
      gl.uniform2f(u.point, x, y);
      gl.uniform3f(u.color, dx, dy, 0);
      gl.uniform1f(u.radius, rayon);
      dessinerVers(vitesse.ecrit);
      vitesse.tourner();
      u = lancer(P.goutte);
      gl.uniform1i(u.uTarget, teinte.lu.lier(0));
      gl.uniform1f(u.aspectRatio, ratio);
      gl.uniform2f(u.point, x, y);
      // une encre retire la lumière qu'elle ne renvoie pas : on range « 1 − couleur » ; une fumée ajoute sa couleur
      const c = fumee ? couleur : couleur.map((v) => 1 - v);
      gl.uniform3f(u.color, c[0] * quantite, c[1] * quantite, c[2] * quantite);
      gl.uniform1f(u.radius, rayon);
      dessinerVers(teinte.ecrit);
      teinte.tourner();
    },
    /** Avance le fluide de dt secondes (donne toujours le même dt). */
    pas(dt) {
      let u = lancer(P.rotation);
      gl.uniform2f(u.texelSize, vitesse.lu.tx, vitesse.lu.ty);
      gl.uniform1i(u.uVelocity, vitesse.lu.lier(0));
      dessinerVers(rot);
      u = lancer(P.tourbillon);
      gl.uniform2f(u.texelSize, vitesse.lu.tx, vitesse.lu.ty);
      gl.uniform1i(u.uVelocity, vitesse.lu.lier(0));
      gl.uniform1i(u.uCurl, rot.lier(1));
      gl.uniform1f(u.curl, tourbillon);
      gl.uniform1f(u.dt, dt);
      dessinerVers(vitesse.ecrit);
      vitesse.tourner();
      u = lancer(P.divergence);
      gl.uniform2f(u.texelSize, vitesse.lu.tx, vitesse.lu.ty);
      gl.uniform1i(u.uVelocity, vitesse.lu.lier(0));
      dessinerVers(diverg);
      u = lancer(P.attenuer);
      gl.uniform1i(u.uTexture, press.lu.lier(0));
      gl.uniform1f(u.value, 0.8);
      dessinerVers(press.ecrit);
      press.tourner();
      u = lancer(P.pression);
      gl.uniform2f(u.texelSize, vitesse.lu.tx, vitesse.lu.ty);
      gl.uniform1i(u.uDivergence, diverg.lier(0));
      for (let i = 0; i < pression; i++) { gl.uniform1i(u.uPressure, press.lu.lier(1)); dessinerVers(press.ecrit); press.tourner(); }
      u = lancer(P.gradient);
      gl.uniform2f(u.texelSize, vitesse.lu.tx, vitesse.lu.ty);
      gl.uniform1i(u.uPressure, press.lu.lier(0));
      gl.uniform1i(u.uVelocity, vitesse.lu.lier(1));
      dessinerVers(vitesse.ecrit);
      vitesse.tourner();
      u = lancer(P.transport);
      gl.uniform2f(u.texelSize, vitesse.lu.tx, vitesse.lu.ty);
      gl.uniform1i(u.uVelocity, vitesse.lu.lier(0));
      gl.uniform1i(u.uSource, vitesse.lu.lier(0));
      gl.uniform1f(u.dt, dt);
      gl.uniform1f(u.dissipation, dissipationVitesse);
      dessinerVers(vitesse.ecrit);
      vitesse.tourner();
      gl.uniform1i(u.uVelocity, vitesse.lu.lier(0));
      gl.uniform1i(u.uSource, teinte.lu.lier(1));
      gl.uniform1f(u.dissipation, dissipationEncre);
      dessinerVers(teinte.ecrit);
      teinte.tourner();
    },
    /** Dessine l'image : `papier` [r, v, b] ; `force` de l'encre ; `bord` (l'encre plus sombre sur ses bords) ; `grain` du papier ; `fumee` (true : sur fond sombre). */
    dessiner({papier = [0.95, 0.92, 0.86], force = 1.6, bord = 6, grain = 0.05, fumee = false} = {}) {
      const u = lancer(P.image);
      gl.uniform2f(u.texelSize, teinte.lu.tx, teinte.lu.ty);
      gl.uniform1i(u.uTexture, teinte.lu.lier(0));
      gl.uniform3f(u.papier, ...papier);
      gl.uniform1f(u.force, force);
      gl.uniform1f(u.bord, fumee ? 0 : bord);
      gl.uniform1f(u.grain, grain);
      gl.uniform1f(u.fumee, fumee ? 1 : 0);
      gl.uniform1f(u.aspectRatio, ratio);
      dessinerVers(null);
    },
    /** Tout remet à zéro (pour rejouer depuis le début). */
    vider() {
      gl.clearColor(0, 0, 0, 1);
      for (const c of [vitesse.lu, vitesse.ecrit, teinte.lu, teinte.ecrit, press.lu, press.ecrit, diverg, rot]) { gl.bindFramebuffer(gl.FRAMEBUFFER, c.fbo); gl.viewport(0, 0, c.w, c.h); gl.clear(gl.COLOR_BUFFER_BIT); }
    },
  };
}
