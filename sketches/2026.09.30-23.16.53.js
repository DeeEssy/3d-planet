const canvasSketch = require('canvas-sketch');

global.THREE = require('three');

const anime = require('animejs');

require('three/examples/js/controls/OrbitControls');
require('three/examples/js/loaders/FontLoader');
require('three/examples/js/geometries/TextGeometry');

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

  const planetGeometry = new THREE.IcosahedronGeometry(1, 2);

  const lightHolder = new THREE.Group();

  const aLight = new THREE.DirectionalLight(0xffffff, 2);
  aLight.position.set(-1.5, 1.7, .7);

  const aLight2 = new THREE.DirectionalLight(0xffffff, 2);
  aLight2.position.set(-1.5, .3, .7);

  lightHolder.add(aLight, aLight2);

  const materialIcosahedron = new THREE.MeshBasicMaterial({
    opacity: 0,
    transparent: true
  })

  const mesh = new THREE.Mesh(
    planetGeometry,
    materialIcosahedron
  );

  const parent = mesh;

  const geomHide = new THREE.SphereGeometry(1.0499, 64, 36);
  const matHide = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x091e5a) });

  const meshHide = new THREE.Mesh(geomHide, matHide);

  scene.add(mesh);
  scene.add(meshHide);
  scene.add(lightHolder);

  const PIN_STYLES = {
    main: { stickRadius: .004, stickHeight: .18, dotRadius: .017, dotSegments: 24, color: 0x86c3f9 },
    secondary: { stickRadius: .002, stickHeight: .1, dotRadius: .01, dotSegments: 12, color: 0x008DFB }
  };

  const addLocationPin = (surfacePosition, { main = false, showDot = true } = {}) => {
    const style = main ? PIN_STYLES.main : PIN_STYLES.secondary;

    const surfacePoint = new THREE.Vector3(...surfacePosition);

    const material = new THREE.MeshBasicMaterial({ color: style.color, side: THREE.DoubleSide });

    const stickGeometry = new THREE.CylinderGeometry(style.stickRadius, style.stickRadius, style.stickHeight, 3);
    stickGeometry.translate(0, style.stickHeight / 2, 0);

    const stick = new THREE.Mesh(stickGeometry, material);
    stick.position.copy(surfacePoint);
    parent.add(stick);

    const top = surfacePoint.clone();
    top.y += style.stickHeight;

    if (!showDot) return { stick, dot: null, top };

    const dot = new THREE.Mesh(new THREE.CircleGeometry(style.dotRadius, style.dotSegments), material);
    dot.position.copy(surfacePoint);
    dot.lookAt(new THREE.Vector3());

    parent.add(dot);

    return { stick, dot, top };
  };

  const PIN_RADIUS = 1.09;

  const latLon = (lat, lon) => new THREE.Vector3().setFromSphericalCoords(
    PIN_RADIUS,
    THREE.MathUtils.degToRad(90 - lat),
    THREE.MathUtils.degToRad(lon)
  ).toArray();

  const LOCATIONS = [
    {
      position: latLon(30, 113),
      main: true,
      labels: [
        { text: 'UK', size: .03 },
        { text: 'London', color: 0x84B3DF, size: .02 }
      ]
    },
    {
      position: latLon(0, 90),
      labels: [
        { text: 'Egypt', size: .03 },
        { text: 'Cairo', color: 0x84B3DF, size: .02 }
      ]
    }
  ];

  const LABEL_ROTATION = camera.quaternion.clone();

  const fontLoader = new THREE.FontLoader();

  fontLoader.load('fonts/font-roboto.json', font => {
    function addText(text, { size, y, color = 0xffffff }) {
      const textGeomatry = new THREE.TextGeometry(text, {
        font,
        size,
        height: .001,
        curveSegments: 12,
      });

      const textMaterial = new THREE.MeshBasicMaterial({
        color,
        side: THREE.FrontSide
      });

      const textMesh = new THREE.Mesh(textGeomatry, textMaterial);
      textMesh.position.set(.02, y, 0);

      return textMesh;
    }

    function showLocation({ position, main, labels }) {
      const pin = addLocationPin(position, { main });

      const labelGroup = new THREE.Group();
      labelGroup.position.copy(pin.top);
      labelGroup.quaternion.copy(LABEL_ROTATION);
      parent.add(labelGroup);

      let lineY = 0;
      const labelMeshes = labels.map(({ text, color, size = .05 }) => {
        lineY -= size * 1.4;
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

  return {
    resize ({ pixelRatio, viewportWidth, viewportHeight }) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(viewportWidth, viewportHeight);
      camera.aspect = viewportWidth / viewportHeight;
      camera.updateProjectionMatrix();
    },
    render ({ time, deltaTime }) {
      parent.rotation.y = time * THREE.MathUtils.degToRad(-3);

      lightHolder.quaternion.copy(camera.quaternion);
      renderer.render(scene, camera);
    },
    unload () {
      renderer.dispose();
    }
  };
};

canvasSketch(sketch, settings);
