<template>
  <div class="rib-preview" v-show="hasGeometry">
    <div class="rib-preview-label">Rib Tool</div>
    <div class="rib-preview-canvas" ref="canvasContainer"></div>
  </div>
</template>

<script setup>
/**
 * RibToolPreview.vue
 * A small, fixed front-view renderer that shows the Rib Tool output.
 * Lazily initializes the Three.js scene when geometry first arrives,
 * because the container has 0 dimensions while hidden via v-show.
 */
import { ref, watch, nextTick, toRaw, onMounted } from 'vue'
import * as THREE from 'three'
import { Rhino3dmLoader } from 'three/addons/loaders/3DMLoader.js'

const props = defineProps(['ribToolDoc'])

const loader = new Rhino3dmLoader()
loader.setLibraryPath('https://cdn.jsdelivr.net/npm/rhino3dm@8.0.0-beta2/')

const canvasContainer = ref(null)
const hasGeometry = ref(false)

let renderer, camera, scene
let sceneReady = false

function initScene() {
  if (!canvasContainer.value || sceneReady) return

  const w = canvasContainer.value.offsetWidth
  const h = canvasContainer.value.offsetHeight
  if (w === 0 || h === 0) return // still hidden

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  canvasContainer.value.appendChild(renderer.domElement)

  const aspect = w / h
  const viewSize = 20
  camera = new THREE.OrthographicCamera(
    -viewSize * aspect, viewSize * aspect,
    viewSize, -viewSize,
    0.1, 1000
  )
  // Top-down view: camera above, looking down along -Z
  camera.position.set(0, 0, 100)
  camera.up.set(0, 1, 0)
  camera.lookAt(0, 0, 0)

  scene = new THREE.Scene()
  scene.background = new THREE.Color('#FFFBF0')

  scene.add(new THREE.AmbientLight(0xffffff, 1.0))
  const light = new THREE.DirectionalLight(0xffffff, 1.5)
  light.position.set(10, 10, 50)
  scene.add(light)

  sceneReady = true
}

function renderFrame() {
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

function displayDoc(doc) {
  // Clear old objects
  const toRemove = []
  scene.traverse((child) => {
    if (!child.isLight && child !== scene) toRemove.push(child)
  })
  toRemove.forEach((obj) => scene.remove(obj))

  const buffer = new Uint8Array(doc.toByteArray()).buffer
  loader.parse(buffer, function (object) {
    const material = new THREE.MeshStandardMaterial({
      color: 0x724537,
      roughness: 0.6,
      metalness: 0.1,
    })
    object.traverse((child) => {
      if (child.isMesh) child.material = material
    })

    scene.add(object)

    // Fit camera to the rib tool geometry
    const box = new THREE.Box3().setFromObject(object)
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const w = canvasContainer.value.offsetWidth
      const h = canvasContainer.value.offsetHeight
      const aspect = w / h
      const viewSize = maxDim * 0.7

      camera.left = -viewSize * aspect
      camera.right = viewSize * aspect
      camera.top = viewSize
      camera.bottom = -viewSize
      camera.updateProjectionMatrix()

      // Top-down view: camera above center, looking down along -Z
      camera.position.set(center.x, center.y, center.z + 100)
      camera.up.set(0, 1, 0)
      camera.lookAt(center)
    }

    renderFrame()
  })
}

// Shared logic: show and render a rib tool doc
async function showDoc(rawDoc) {
  if (!rawDoc) return
  const doc = toRaw(rawDoc)

  try {
    const objCount = doc.objects().count
    if (objCount === 0) {
      hasGeometry.value = false
      return
    }

    // Show the panel first, then init scene on next tick (so container has size)
    hasGeometry.value = true
    await nextTick()
    initScene()

    if (!sceneReady) return
    displayDoc(doc)
  } catch (err) {
    console.warn('RibToolPreview: could not render rib tool', err)
    hasGeometry.value = false
  }
}

// Watch for new rib tool docs arriving after mount
watch(() => props.ribToolDoc, showDoc)

// On remount (e.g. panel switch via v-if), render the existing doc
onMounted(() => {
  if (props.ribToolDoc) showDoc(props.ribToolDoc)
})
</script>

<style scoped>
.rib-preview {
  display: flex;
  flex-direction: column;
  border: 1.5px solid #FFFBF0;
  border-radius: 8px;
  overflow: hidden;
  background: #FFFBF0;
  min-width: 140px;
  max-width: 180px;
}

.rib-preview-label {
  font-family: 'Poppins', sans-serif;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #724537;
  padding: 4px 8px;
  text-align: center;
  border-bottom: 1px solid #FFFBF0;
}

.rib-preview-canvas {
  width: 100%;
  height: 120px;
}
</style>
