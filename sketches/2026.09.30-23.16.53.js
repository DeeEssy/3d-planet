const canvasSketch = require('canvas-sketch');

global.THREE = require('three');

const anime = require('animejs');

require('three/examples/js/controls/OrbitControls');
require('three/examples/js/loaders/FontLoader');
require('three/examples/js/geometries/TextGeometry');
require('three/examples/js/utils/BufferGeometryUtils');

const PLANET_RADIUS = 1.0499;
const PIN_HEIGHT_ABOVE_PLANET = .03;
const PIN_RADIUS = PLANET_RADIUS + PIN_HEIGHT_ABOVE_PLANET;

const PIN_STYLES = {
  main: { stickRadius: .004, stickHeight: .18, dotRadius: .017, dotSegments: 14, color: 0x86c3f9 },
  secondary: { stickRadius: .002, stickHeight: .1, dotRadius: .01, dotSegments: 8, color: 0x008DFB }
};

const MAP_IMAGE = 'images/map.png';
const MAP_RADIUS = PLANET_RADIUS + .002;
const MAP_DOT_RADIUS = .004;
const MAP_DOT_COLOR = 0x5b7fd1;
const CITY_COLOR = 0xc4e2ff;
const MAP_LON_OFFSET = 98;

const planetLon = lon => lon + MAP_LON_OFFSET;

const latLon = (lat, lon, radius = PIN_RADIUS) => new THREE.Vector3().setFromSphericalCoords(
  radius,
  THREE.MathUtils.degToRad(90 - lat),
  THREE.MathUtils.degToRad(planetLon(lon))
).toArray();

const LOCATIONS = [
  {
    lat: 51.5,
    lon: -0.1,
    main: true,
    labels: [
      { text: 'UK', size: .03 },
      { text: 'London', color: CITY_COLOR, size: .02 }
    ]
  },
  {
    lat: 30,
    lon: 31.2,
    labels: [
      { text: 'Egypt', size: .03 },
      { text: 'Cairo', color: CITY_COLOR, size: .02 }
    ]
  },
  {
    lat: 48.9,
    lon: 2.4,
    labels: [
      { text: 'France', size: .03 },
      { text: 'Paris', color: CITY_COLOR, size: .02 }
    ]
  },
  {
    lat: 40.7,
    lon: -74,
    main: true,
    labels: [
      { text: 'USA', size: .03 },
      { text: 'New York', color: CITY_COLOR, size: .02 }
    ]
  },
  {
    lat: 50.5,
    lon: 30.5,
    main: true,
    labels: [
      { text: 'Ukraine', size: .03 },
      { text: 'Kyiv', color: CITY_COLOR, size: .02 }
    ]
  },
  {
    lat: 35.7,
    lon: 139.7,
    labels: [
      { text: 'Japan', size: .03 },
      { text: 'Tokyo', color: CITY_COLOR, size: .02 }
    ]
  },
  {
    lat: 39.9,
    lon: 116.4,
    labels: [
      { text: 'China', size: .03 },
      { text: 'Beijing', color: CITY_COLOR, size: .02 }
    ]
  },
  {
    lat: 34.1,
    lon: -118.2,
    labels: [
      { text: 'USA', size: .03 },
      { text: 'Los Angeles', color: CITY_COLOR, size: .02 }
    ]
  }
];

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
    return new THREE.CircleGeometry(MAP_DOT_RADIUS, 6).applyMatrix4(placer.matrix);
  });

  const geometry = THREE.BufferGeometryUtils.mergeBufferGeometries(dots);
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: MAP_DOT_COLOR }));
};

const settings = {
  animate: true,
  context: 'webgl',
  attributes: { antialias: true }
};

const sketch = ({ context }) => {
  const renderer = new THREE.WebGLRenderer({
    context
  });

  renderer.setClearColor('#333', 1);

  const camera = new THREE.PerspectiveCamera(12, 1, 0.01, 100);
  camera.position.set(10.5, 0, -3.5);
  camera.setViewOffset(10, 10, -2, .5, 9, 9);

  const controls = new THREE.OrbitControls(camera, context.canvas);

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

  const aLight = new THREE.DirectionalLight(0xffffff, 2);
  aLight.position.set(-1.5, 1.7, .7);

  const aLight2 = new THREE.DirectionalLight(0xffffff, 2);
  aLight2.position.set(-1.5, .3, .7);

  lightHolder.add(aLight, aLight2);

  const planetBodyGeometry = new THREE.SphereGeometry(PLANET_RADIUS, 64, 36);
  const planetBodyMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x091e5a) });

  const planetBody = new THREE.Mesh(planetBodyGeometry, planetBodyMaterial);

  scene.add(planetContents, planetBody, lightHolder);

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

  const fontLoader = new THREE.FontLoader();

  fontLoader.load('fonts/font-roboto.json', font => {
    function addText(text, { size, y, color = 0xffffff }) {
      const textGeometry = new THREE.TextGeometry(text, {
        font,
        size,
        height: .001,
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
    }

    LOCATIONS.forEach(showLocation);
  })

  const loader = new THREE.TextureLoader();

  loader.load(
    'images/tree.svg',
    function (texture) {
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

  return {
    resize ({ pixelRatio, viewportWidth, viewportHeight }) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(viewportWidth, viewportHeight);
      camera.aspect = viewportWidth / viewportHeight;
      camera.updateProjectionMatrix();
    },
    render ({ time, deltaTime }) {
      planetContents.rotation.y = time * THREE.MathUtils.degToRad(-3);

      lightHolder.quaternion.copy(camera.quaternion);
      renderer.render(scene, camera);
    },
    unload () {
      renderer.dispose();
    }
  };
};

canvasSketch(sketch, settings);
