import * as THREE from 'three';
import anime from 'animejs';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

import { PLANET_RADIUS, PLANET_COLOR, LIGHT_INTENSITY } from './constants/planet.js';
import { PIN_RADIUS, PIN_STYLES } from './constants/pins.js';
import { ARC_STYLES, ARC_HEIGHT, ARC_SEGMENTS, ARC_FLIGHT_DURATION } from './constants/arcs.js';
import { WAVE_HEIGHT, WAVE_RING_WIDTH, WAVE_MAX_RADIUS, WAVE_DURATION } from './constants/waves.js';
import { MAP_IMAGE, MAP_RADIUS, MAP_DOT_RADIUS, MAP_DOT_COLOR, MAP_LON_OFFSET } from './constants/map.js';
import { LOCATIONS } from './constants/locations.js';
import { CONNECTIONS } from './constants/connections.js';

const planetLon = lon => lon + MAP_LON_OFFSET;

const latLon = (lat, lon, radius = PIN_RADIUS) => new THREE.Vector3().setFromSphericalCoords(
  radius,
  THREE.MathUtils.degToRad(90 - lat),
  THREE.MathUtils.degToRad(planetLon(lon))
).toArray();

const WAVES = LOCATIONS.map(({ lat, lon }) => {
  const duration = THREE.MathUtils.randFloat(...WAVE_DURATION);
  return {
    center: new THREE.Vector3(...latLon(lat, lon, MAP_RADIUS)),
    duration,
    delay: Math.random() * duration
  };
});

const waveUniforms = {
  waveCenters: { value: WAVES.map(wave => wave.center) },
  waveProgress: { value: WAVES.map(() => 0) },
  waveHeight: { value: WAVE_HEIGHT },
  waveRingWidth: { value: WAVE_RING_WIDTH },
  waveMaxRadius: { value: WAVE_MAX_RADIUS }
};

const loadImage = src => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

const getLandPoints = image => {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const points = [];
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const alpha = data[(y * canvas.width + x) * 4 + 3];
      if (alpha > 200) {
        const lat = 90 - (y + .5) / canvas.height * 180;
        const lon = (x + .5) / canvas.width * 360 - 180;
        points.push([lat, lon]);
      }
    }
  }
  return points;
};

const createMapDots = landPoints => {
  const placer = new THREE.Object3D();

  const dots = landPoints.map(([lat, lon]) => {
    placer.position.set(...latLon(lat, lon, MAP_RADIUS));
    placer.lookAt(placer.position.clone().multiplyScalar(2));
    placer.updateMatrix();

    const dot = new THREE.CircleGeometry(MAP_DOT_RADIUS, 6).applyMatrix4(placer.matrix);

    const vertexCount = dot.attributes.position.count;
    const centers = Array.from({ length: vertexCount }, () => placer.position.toArray()).flat();
    dot.setAttribute('dotCenter', new THREE.Float32BufferAttribute(centers, 3));

    return dot;
  });

  const geometry = mergeGeometries(dots);
  return new THREE.Mesh(geometry, createMapDotsMaterial());
};

const createMapDotsMaterial = () => {
  const material = new THREE.MeshBasicMaterial({ color: MAP_DOT_COLOR });

  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, waveUniforms);

    shader.vertexShader = `
      attribute vec3 dotCenter;
      uniform vec3 waveCenters[${WAVES.length}];
      uniform float waveProgress[${WAVES.length}];
      uniform float waveHeight;
      uniform float waveRingWidth;
      uniform float waveMaxRadius;
      ${shader.vertexShader}
    `.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>

      float lift = 0.0;
      for (int i = 0; i < ${WAVES.length}; i++) {
        float ringRadius = waveProgress[i] * waveMaxRadius;
        float distanceToRing = abs(distance(dotCenter, waveCenters[i]) - ringRadius);
        float onRing = 1.0 - smoothstep(0.0, waveRingWidth, distanceToRing);
        lift += onRing * (1.0 - waveProgress[i]);
      }

      transformed += normalize(dotCenter) * min(lift, 1.0) * waveHeight;
      `
    );
  };

  return material;
};

const findLocation = id => LOCATIONS.find(location => location.id === id);

const createArcPoints = (from, to) => {
  const start = new THREE.Vector3(...latLon(from.lat, from.lon));
  const end = new THREE.Vector3(...latLon(to.lat, to.lon));

  const height = start.distanceTo(end) * ARC_HEIGHT;
  const middle = start.clone().add(end).normalize().multiplyScalar(PIN_RADIUS + height);

  return new THREE.QuadraticBezierCurve3(start, middle, end).getPoints(ARC_SEGMENTS);
};

const createArc = ({ from, to, style }) => {
  const { color, width } = ARC_STYLES[style];
  const points = createArcPoints(findLocation(from), findLocation(to));

  const geometry = new LineGeometry().setPositions(points.flatMap(point => point.toArray()));

  const length = points.reduce((sum, point, i) => i === 0 ? 0 : sum + point.distanceTo(points[i - 1]), 0);
  const material = new LineMaterial({
    color,
    linewidth: width,
    dashed: true,
    dashScale: 1 / length,
    dashSize: 1,
    gapSize: 1,
    dashOffset: 1
  });

  const arc = new Line2(geometry, material);
  arc.computeLineDistances();
  return arc;
};

const getArcDashOffset = time => 1 - 2 * ((time / ARC_FLIGHT_DURATION) % 1);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor('#333', 1);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(12, 1, 0.01, 100);
camera.position.set(10.5, 0, -3.5);
camera.setViewOffset(10, 10, -2, .5, 9, 9);

const controls = new OrbitControls(camera, renderer.domElement);

const scene = new THREE.Scene();

const planetContentsGeometry = new THREE.IcosahedronGeometry(1, 2);
const planetContentsMaterial = new THREE.MeshBasicMaterial({
  opacity: 0,
  transparent: true
})

const planetContents = new THREE.Mesh(
  planetContentsGeometry,
  planetContentsMaterial
);

const lightHolder = new THREE.Group();

const aLight = new THREE.DirectionalLight(0xffffff, LIGHT_INTENSITY);
aLight.position.set(-1.5, 1.7, .7);

const aLight2 = new THREE.DirectionalLight(0xffffff, LIGHT_INTENSITY);
aLight2.position.set(-1.5, .3, .7);

lightHolder.add(aLight, aLight2);

const planetBodyGeometry = new THREE.SphereGeometry(PLANET_RADIUS, 64, 36);
const planetBodyMaterial = new THREE.MeshStandardMaterial({ color: PLANET_COLOR });

const planetBody = new THREE.Mesh(planetBodyGeometry, planetBodyMaterial);

scene.add(planetContents, planetBody, lightHolder);

const arcs = CONNECTIONS.map(createArc);
planetContents.add(...arcs);

let arcsStartTime = null;
arcs.forEach(arc => { arc.visible = false; });

const startArcs = () => {
  arcsStartTime = performance.now() / 1000;
  arcs.forEach(arc => { arc.visible = true; });
};

loadImage(MAP_IMAGE)
  .then(image => planetContents.add(createMapDots(getLandPoints(image))))
  .catch(error => console.error('Не удалось загрузить карту', error));

const addLocationPin = (surfacePosition, { main = false, showDot = true } = {}) => {
  const style = main ? PIN_STYLES.main : PIN_STYLES.secondary;

  const surfacePoint = new THREE.Vector3(...surfacePosition);

  const material = new THREE.MeshBasicMaterial({ color: style.color, side: THREE.DoubleSide });

  const stickGeometry = new THREE.CylinderGeometry(style.stickRadius, style.stickRadius, style.stickHeight, 3);
  stickGeometry.translate(0, style.stickHeight / 2, 0);

  const stick = new THREE.Mesh(stickGeometry, material);
  stick.position.copy(surfacePoint);
  planetContents.add(stick);

  const top = surfacePoint.clone();
  top.y += style.stickHeight;

  if (!showDot) return { stick, dot: null, top };

  const dot = new THREE.Mesh(new THREE.CircleGeometry(style.dotRadius, style.dotSegments), material);
  dot.position.copy(surfacePoint);
  dot.lookAt(new THREE.Vector3());

  planetContents.add(dot);

  return { stick, dot, top };
};

const LABEL_ROTATION = camera.quaternion.clone();

const Y_AXIS = new THREE.Vector3(0, 1, 0);

const CAMERA_LON = Math.atan2(camera.position.x, camera.position.z);

const facingRotation = lon => new THREE.Quaternion()
  .setFromAxisAngle(Y_AXIS, THREE.MathUtils.degToRad(planetLon(lon)) - CAMERA_LON)
  .multiply(LABEL_ROTATION);

const fontLoader = new FontLoader();

fontLoader.load('fonts/font-roboto.json', font => {
  function addText(text, { size, y, color = 0xffffff }) {
    const textGeometry = new TextGeometry(text, {
      font,
      size,
      depth: .001,
      curveSegments: 4,
    });

    const textMaterial = new THREE.MeshBasicMaterial({
      color,
    });

    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.set(.02, y, 0);

    return textMesh;
  }

  function showLocation({ lat, lon, main, labels }) {
    const pin = addLocationPin(latLon(lat, lon), { main });

    const labelGroup = new THREE.Group();
    labelGroup.position.copy(pin.top);
    labelGroup.quaternion.copy(facingRotation(lon));
    planetContents.add(labelGroup);

    let lineY = 0;
    const labelMeshes = labels.map(({ text, color, size = .05 }) => {
      lineY -= size * 1.8;
      return addText(text, { size, y: lineY, color });
    });
    labelGroup.add(...labelMeshes);

    [...labelMeshes, pin.stick, pin.dot].forEach(object => object.scale.setScalar(0));

    const grow = { x: 1, y: 1, z: 1 };
    const timeline = anime.timeline({ easing: 'linear' });

    labelMeshes.forEach((label, i) => {
      timeline.add({ targets: label.scale, ...grow, duration: 600, delay: i === 0 ? 0 : 1000 });
    });

    timeline
      .add({ targets: pin.dot.scale, ...grow, duration: 1500 })
      .add({ targets: pin.stick.scale, ...grow, duration: 1500, delay: 1100 }, '-=1500');

    return timeline.finished;
  }

  Promise.all(LOCATIONS.map(showLocation)).then(startArcs);
})

const loader = new THREE.TextureLoader();

loader.load(
  'images/tree.svg',
  function (texture) {
    texture.colorSpace = THREE.SRGBColorSpace;

    const treeIconGeometry = new THREE.PlaneGeometry(.160, .160);
    treeIconGeometry.translate(0, .160 / 2, 0);

    const treeIconMaterial = new THREE.MeshBasicMaterial( {
        map: texture,
        side: THREE.DoubleSide,
        alphaTest:.5
    });

    const treeIcon = new THREE.Mesh(
      treeIconGeometry,
      treeIconMaterial
    );
    treeIcon.position.set(...latLon(30, 52));
    treeIcon.quaternion.copy(facingRotation(52));
    treeIcon.scale.setScalar(0);

    planetContents.add(treeIcon);

    anime({ targets: treeIcon.scale, x: [0, .7], y: [0, .7], z: [0, 1], duration: 600, easing: 'linear' })
  },
  undefined,
  function ( e ) {
      console.error( e );
  }
);

const resize = () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
};

window.addEventListener('resize', resize);
resize();

renderer.setAnimationLoop(timeMs => {
  const time = timeMs / 1000;

  planetContents.rotation.y = time * THREE.MathUtils.degToRad(-3);

  if (arcsStartTime !== null) {
    const dashOffset = getArcDashOffset(Math.max(0, time - arcsStartTime));
    arcs.forEach(arc => { arc.material.dashOffset = dashOffset; });
  }

  WAVES.forEach((wave, i) => {
    waveUniforms.waveProgress.value[i] = ((time + wave.delay) / wave.duration) % 1;
  });

  lightHolder.quaternion.copy(camera.quaternion);
  renderer.render(scene, camera);
});
