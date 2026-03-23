<template>
  <div id="viewport">
    <div id="threejs-container"></div>
  </div>
</template>

<script setup>
import { onMounted, watch, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { DragControls } from 'three/examples/jsm/controls/DragControls'
import { Rhino3dmLoader } from 'three/addons/loaders/3DMLoader.js'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { initRhino, computeVessel, download3dm } from '../scripts/vesselCompute.js'

const loader = new Rhino3dmLoader()
loader.setLibraryPath('https://cdn.jsdelivr.net/npm/rhino3dm@8.0.0-beta2/')

const props = defineProps(['data', 'path', 'numPoints', 'vesselColor'])
const emits = defineEmits(['updateMetadata', 'ribToolReady', 'pointsUpdated'])

// Auto-compute with debounce when any parameter changes
let computeDebounceTimer = null
watch(() => props.data, () => {
  clearTimeout(computeDebounceTimer)
  computeDebounceTimer = setTimeout(() => {
    compute()
  }, 800)
}, { deep: true })

// Three.js core objects
let renderer, camera, scene, controls, container

// Scene groups: separate vessel geometry from interactive points
let vesselGroup        // holds computed vessel mesh — auto-rotates
let pointsGroup        // holds draggable spheres — static in world space
let profileCurveGroup  // holds the profile silhouette curve

// DragControls
let dragControls
let isDragging = false

// Point sphere tracking
let pointSpheres = []

// Store the docs for download
let lastVesselDoc = null
let lastRibToolDoc = null
let solveCounter = 0

// ─── Point config ────────────────────────────────────────────────────────────
// Visual offset: spheres are displayed this far outside the actual profile radius
// so they sit visually outside the vessel surface. The offset is subtracted
// when emitting positions to Grasshopper.
const POINT_VISUAL_OFFSET = 3

const pointGeometry = new THREE.SphereGeometry(0.5, 16, 16)

const defaultPointMaterial = new THREE.MeshStandardMaterial({
  color: 0xFFFBF0,
  roughness: 0.3,
  metalness: 0.1,
})

const hoverPointMaterial = new THREE.MeshStandardMaterial({
  color: 0x385A49,
  roughness: 0.3,
  metalness: 0.1,
  emissive: 0x1a2d24,
  emissiveIntensity: 0.3,
})

// ─── Init ───────────────────────────────────────────────────────────────────
function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true })

  container = document.getElementById('threejs-container')
  renderer.setSize(container.offsetWidth, container.offsetHeight)
  container.appendChild(renderer.domElement)

  camera = new THREE.PerspectiveCamera(
    75,
    container.offsetWidth / container.offsetHeight,
    0.1,
    1000
  )
  camera.position.set(0, -80, 0)
  camera.up.set(0, 0, 1)

  scene = new THREE.Scene()
  scene.background = new THREE.Color('#724537')

  // Create groups
  vesselGroup = new THREE.Group()
  scene.add(vesselGroup)

  pointsGroup = new THREE.Group()
  scene.add(pointsGroup)

  profileCurveGroup = new THREE.Group()
  scene.add(profileCurveGroup)

  // Warm PBR lighting for terracotta
  const ambientLight = new THREE.AmbientLight(0xfff4e6, 1.2)
  scene.add(ambientLight)

  const keyLight = new THREE.DirectionalLight(0xffd0a0, 2.0)
  keyLight.position.set(40, -60, 80)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0xffe8cc, 0.8)
  fillLight.position.set(-40, 40, 40)
  scene.add(fillLight)

  // Orbit controls with restricted angles
  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0, 10)

  controls.minPolarAngle = 0.1
  controls.maxPolarAngle = Math.PI / 2

  controls.enableDamping = true
  controls.dampingFactor = 0.08

  animate()
}

// ─── UV generation helper ────────────────────────────────────────────────────

/**
 * Ensure a BufferGeometry has UV coordinates.
 * If missing, generate simple planar UVs from XZ position so textures render.
 */
function ensureUVs(geometry) {
  if (geometry.attributes.uv) return
  geometry.computeBoundingBox()
  const bbox = geometry.boundingBox
  const positions = geometry.attributes.position
  const uvs = new Float32Array(positions.count * 2)
  const rangeX = bbox.max.x - bbox.min.x || 1
  const rangeZ = bbox.max.z - bbox.min.z || 1
  for (let i = 0; i < positions.count; i++) {
    uvs[i * 2]     = (positions.getX(i) - bbox.min.x) / rangeX
    uvs[i * 2 + 1] = (positions.getZ(i) - bbox.min.z) / rangeZ
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
}

// ─── Speckle texture ────────────────────────────────────────────────────────

/**
 * Parse a hex color string to {r, g, b} (0-255).
 */
function hexToRgb(hex) {
  const c = parseInt(hex.replace('#', ''), 16)
  return { r: (c >> 16) & 255, g: (c >> 8) & 255, b: c & 255 }
}

function createSpeckleTexture(baseColor = '#C1603C') {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, size, size)

  // Derive speckle colors from the base color
  const base = hexToRgb(baseColor)
  const darkR = Math.max(0, base.r - 100)
  const darkG = Math.max(0, base.g - 80)
  const darkB = Math.max(0, base.b - 30)
  const lightR = Math.min(255, base.r + 60)
  const lightG = Math.min(255, base.g + 60)
  const lightB = Math.min(255, base.b + 60)

  const rng = () => Math.random()
  for (let i = 0; i < 6000; i++) {
    const x = rng() * size
    const y = rng() * size
    const r = rng() * 2.5 + 0.5
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = rng() > 0.5
      ? `rgba(${darkR}, ${darkG}, ${darkB}, ${0.25 + rng() * 0.35})`
      : `rgba(${lightR}, ${lightG}, ${lightB}, ${0.2 + rng() * 0.3})`
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(4, 4)
  return texture
}

// Watch for vessel color changes — update material without recomputing
watch(() => props.vesselColor, (newColor) => {
  if (!newColor || !vesselGroup) return
  const speckleTexture = createSpeckleTexture(newColor)
  const material = new THREE.MeshStandardMaterial({
    map: speckleTexture,
    roughness: 0.85,
    metalness: 0.0,
  })
  vesselGroup.traverse((child) => {
    if (child.isMesh) {
      ensureUVs(child.geometry)
      child.material = material
    }
  })
})

// ─── Zoom to fit (vessel only) ──────────────────────────────────────────────
function zoomToFit(selection, fitOffset = 1.2) {
  const box = new THREE.Box3()

  for (const object of selection) {
    if (object.isLight) continue
    box.expandByObject(object)
  }

  if (box.isEmpty()) return

  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  const maxSize = Math.max(size.x, size.y, size.z)
  const fitHeightDistance = maxSize / (2 * Math.atan((Math.PI * camera.fov) / 360))
  const fitWidthDistance = fitHeightDistance / camera.aspect
  const distance = fitOffset * Math.max(fitHeightDistance, fitWidthDistance)

  // Center the orbit target on the vessel's center (X=0 to keep symmetric)
  controls.target.set(0, 0, center.z)
  controls.maxDistance = distance * 10

  camera.near = distance / 100
  camera.far = distance * 100
  camera.updateProjectionMatrix()

  // Place camera in front of the vessel (looking along -Y → +Y)
  camera.position.set(0, -distance, center.z)

  controls.update()
}

// ─── Point sphere management ────────────────────────────────────────────────

/**
 * Create, remove, or update point spheres based on the numPoints value.
 * Existing spheres keep their positions; new spheres get default positions.
 */
function syncPointSpheres(numPoints) {
  if (!pointsGroup) return

  const height = props.data?.Height || 10

  // Remove excess spheres
  while (pointSpheres.length > numPoints) {
    const sphere = pointSpheres.pop()
    pointsGroup.remove(sphere)
  }

  // Add missing spheres with default profile positions
  // Creates a natural pottery vessel silhouette: narrow base → wide belly → narrow neck
  while (pointSpheres.length < numPoints) {
    const idx = pointSpheres.length
    const sphere = new THREE.Mesh(
      pointGeometry.clone(),
      defaultPointMaterial.clone()
    )

    const t = (idx + 1) / (numPoints + 1) // 0..1 parameter along height
    const defaultZ = t * height
    // Profile: sin curve gives narrow base, wide belly, narrowing top
    const profileX = 3 + 5 * Math.sin(t * Math.PI)
    // Display sphere offset outward so it sits visually outside the vessel
    sphere.position.set(profileX + POINT_VISUAL_OFFSET, 0, defaultZ)
    sphere.userData.pointIndex = idx

    pointsGroup.add(sphere)
    pointSpheres.push(sphere)
  }

  // Rebuild DragControls with the current set of spheres
  rebuildDragControls()
}

/**
 * Emit current point positions to the parent component.
 */
function emitPointPositions() {
  // Subtract visual offset so GH receives the actual profile radius
  const positions = pointSpheres.map(sphere => ({
    X: sphere.position.x - POINT_VISUAL_OFFSET,
    Y: sphere.position.y,
    Z: sphere.position.z,
  }))
  emits('pointsUpdated', positions)
}

// ─── DragControls setup ─────────────────────────────────────────────────────

function rebuildDragControls() {
  if (dragControls) {
    dragControls.dispose()
    dragControls = null
  }

  if (pointSpheres.length === 0 || !camera || !renderer) return

  dragControls = new DragControls(pointSpheres, camera, renderer.domElement)

  dragControls.addEventListener('dragstart', (event) => {
    isDragging = true
    controls.enabled = false  // disable OrbitControls during drag
    event.object.material = hoverPointMaterial.clone()
  })

  dragControls.addEventListener('drag', (event) => {
    // Constrain to XZ plane (pottery profile)
    event.object.position.y = 0
    // Clamp Z >= 0 (no points below ground)
    event.object.position.z = Math.max(0, event.object.position.z)
    // Clamp X >= offset (so actual profile radius stays >= 0)
    event.object.position.x = Math.max(POINT_VISUAL_OFFSET, event.object.position.x)
  })

  dragControls.addEventListener('dragend', (event) => {
    isDragging = false
    controls.enabled = true  // re-enable OrbitControls
    event.object.material = defaultPointMaterial.clone()

    // Emit updated positions and auto-recompute
    emitPointPositions()
    compute()
  })

  dragControls.addEventListener('hoveron', (event) => {
    if (!isDragging) {
      event.object.material = hoverPointMaterial.clone()
      renderer.domElement.style.cursor = 'grab'
    }
  })

  dragControls.addEventListener('hoveroff', (event) => {
    if (!isDragging) {
      event.object.material = defaultPointMaterial.clone()
      renderer.domElement.style.cursor = ''
    }
  })
}

// Watch for numPoints changes from the slider
watch(() => props.numPoints, (newNum) => {
  if (pointsGroup && newNum != null) {
    syncPointSpheres(Number(newNum))
    emitPointPositions()
  }
})

// ─── Compute ────────────────────────────────────────────────────────────────

async function compute() {
  console.log('Computing vessel...', props.data)

  const { vesselDoc, ribToolDoc, profileCurveDoc, metadata } = await computeVessel(props.data, props.path)
  lastVesselDoc = vesselDoc
  lastRibToolDoc = ribToolDoc

  // Emit rib tool doc to parent (for the preview panel)
  emits('ribToolReady', ribToolDoc)

  // Clear only vessel geometry (not point spheres)
  while (vesselGroup.children.length > 0) {
    vesselGroup.remove(vesselGroup.children[0])
  }

  // Clear profile curve
  while (profileCurveGroup.children.length > 0) {
    profileCurveGroup.remove(profileCurveGroup.children[0])
  }

  // Emit metadata (volume outputs) to parent
  if (metadata && metadata.length > 0) {
    emits('updateMetadata', metadata)
  }

  // Parse and display vessel geometry
  const buffer = new Uint8Array(vesselDoc.toByteArray()).buffer
  loader.parse(buffer, function (object) {
    const speckleTexture = createSpeckleTexture(props.vesselColor || '#C1603C')
    const material = new THREE.MeshStandardMaterial({
      map: speckleTexture,
      roughness: 0.85,
      metalness: 0.0,
    })

    object.traverse((child) => {
      if (child.isMesh) {
        // Generate UV coordinates if missing (some GH outputs don't include them)
        ensureUVs(child.geometry)
        child.material = material
      }
    })

    vesselGroup.add(object)

    // Zoom to fit after first compute
    if (solveCounter === 0) {
      const targets = object.children.length > 0 ? object.children : [object]
      zoomToFit(targets, 1.8)  // wider fit so point spheres are visible
    }
    solveCounter++
    console.log('Compute done')
  })

  // Parse and display profile curve from Grasshopper (comes as mesh geometry)
  // Offset by the same POINT_VISUAL_OFFSET so the curve passes through the spheres
  const curveBuffer = new Uint8Array(profileCurveDoc.toByteArray()).buffer
  loader.parse(curveBuffer, function (curveObject) {
    const curveMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFBF0,
      wireframe: false,
      side: THREE.DoubleSide,
    })

    curveObject.traverse((child) => {
      if (child.isMesh) {
        child.material = curveMaterial
      }
    })

    // Shift curve outward to align with the visually-offset point spheres
    curveObject.position.x += POINT_VISUAL_OFFSET

    profileCurveGroup.add(curveObject)
  })
}

// ─── Animate ────────────────────────────────────────────────────────────────

function animate() {
  requestAnimationFrame(animate)

  // No auto-rotation: draggable points need a stable scene

  controls.update()
  renderer.render(scene, camera)
}

// ─── Resize ─────────────────────────────────────────────────────────────────

window.addEventListener('resize', onWindowResize)
function onWindowResize() {
  if (!container) return
  const width = container.offsetWidth
  const height = container.offsetHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

// ─── Download helpers ───────────────────────────────────────────────────────

function downloadVessel3dm() {
  if (lastVesselDoc) download3dm(lastVesselDoc, 'ThrowForm_Vessel')
}

function downloadRibTool3dm() {
  if (!lastRibToolDoc) return
  const buffer = new Uint8Array(lastRibToolDoc.toByteArray()).buffer
  loader.parse(buffer, (object) => {
    const exporter = new STLExporter()
    const binaryStl = exporter.parse(object, { binary: true })
    const blob = new Blob([binaryStl], { type: 'application/octet-stream' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'ThrowForm_RibTool.stl'
    link.click()
  })
}

function downloadSTL() {
  // Export vessel group only (no point spheres)
  const exporter = new STLExporter()
  const stlString = exporter.parse(vesselGroup)
  const blob = new Blob([stlString], { type: 'text/plain' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'ThrowForm_Vessel.stl'
  link.click()
}

defineExpose({ downloadVessel3dm, downloadRibTool3dm, downloadSTL })

// ─── Mount ──────────────────────────────────────────────────────────────────

onMounted(async () => {
  init()
  await initRhino()

  // Initialize point spheres and emit positions to parent
  syncPointSpheres(Number(props.numPoints) || 5)
  emitPointPositions()

  // Wait for parent's computeData to update with point positions before computing
  await nextTick()
  compute()
})
</script>

<style scoped>
#viewport {
  height: 100%;
  width: 100%;
  min-width: 200px;
  position: inherit;
}

#threejs-container {
  height: 100%;
  width: 100%;
  min-width: 200px;
  position: inherit;
}
</style>
