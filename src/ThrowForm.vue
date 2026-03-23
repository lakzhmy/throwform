<script setup>
import { ref, shallowRef, computed } from 'vue'

// Local components
import GeometryView from './components/GeometryView.vue'
import SliderInput from './components/SliderInput.vue'
import NumericStepper from './components/NumericStepper.vue'
import Header from './components/Header.vue'
import RibToolPreview from './components/RibToolPreview.vue'

// Grasshopper definition file
import def from './assets/Vessel_hops.gh'

// ─── Parameters matching the Grasshopper definition ─────────────────────────
// Each name must match EXACTLY what the GH definition expects

// FORM group
let heightValue = ref(14)
let numPointsValue = ref(7)
let potThicknessValue = ref(0.5)
let curveStyleValue = ref(false)  // false = Nurbs, true = Interpolate

// RIB TOOL group
let ribWidthValue = ref(3)

// WILD group (hidden until Wild is active)
let ridgesValue = ref(12)
let ridgeDepthValue = ref(1.0)
let wildValue = ref(false)

// POINTS — draggable 3D control points from the viewer gumballs
const pointPositionsValue = ref([])  // Array of {X, Y, Z} objects

// ─── Color palette ──────────────────────────────────────────────────────────
const colorPresets = [
  { name: 'Terracotta', hex: '#C1603C' },
  { name: 'Rose',       hex: '#D4A0A0' },
  { name: 'Ochre',      hex: '#B8860B' },
  { name: 'Sage',       hex: '#8FBC8F' },
  { name: 'Sunflower',  hex: '#DAA520' },
  { name: 'Mint',       hex: '#66CDAA' },
  { name: 'Sky',        hex: '#6FA8C7' },
  { name: 'Lavender',   hex: '#B19CD9' },
  { name: 'Deep Blue',  hex: '#4169E1' },
  { name: 'Bronze',     hex: '#8B6914' },
]
const selectedColor = ref('#C1603C')

function selectColor(hex) {
  selectedColor.value = hex
}

// ─── Liquid glass nav bar state ─────────────────────────────────────────────
const activePanel = ref(null)

function togglePanel(panelId) {
  activePanel.value = activePanel.value === panelId ? null : panelId
}

// ─── Path, metadata, and refs ──────────────────────────────────────────────
let path = def
const metadataList = ref([])
const viewerRef = ref(null)
const ribToolDoc = shallowRef(null)

// ─── Material estimate computeds (volumes from GH are in cubic inches) ──────
const clayLbs = computed(() => {
  const vol = metadataList.value.find(m => m.name === 'Material Volume')
  if (!vol) return null
  // clay density 1.6 g/cm³ × 16.387 cm³/in³ ÷ 453.592 g/lb ≈ 0.05781 lb/in³
  return (Number(vol.value) * 0.05781).toFixed(2)
})

const plaGrams = computed(() => {
  const vol = metadataList.value.find(m => m.name === 'Rib Tool Volume')
  if (!vol) return null
  // PLA density 1.24 g/cm³ × 16.387 cm³/in³ ≈ 20.32 g/in³
  return (Number(vol.value) * 20.32).toFixed(1)
})

// ─── Update handler for all inputs ──────────────────────────────────────────
function updateValue(newValue, parameterName) {
  switch (parameterName) {
    case 'Height (in)':       heightValue.value = newValue; break
    case 'Number of Points':  numPointsValue.value = newValue; break
    case 'Rib Width (in)':    ribWidthValue.value = newValue; break
    case 'Ridges':            ridgesValue.value = newValue; break
    case 'Ridge Depth':       ridgeDepthValue.value = newValue; break
    case 'Pot Thickness':     potThicknessValue.value = newValue; break
    case 'Curve Style':       curveStyleValue.value = newValue; break
    case 'Wild?':             wildValue.value = newValue; break
  }
}

// ─── Toggle the Wild? button ────────────────────────────────────────────────
function toggleWild() {
  wildValue.value = !wildValue.value
  if (wildValue.value) {
    // Activate Wild: set Ridges and Ridge Depth to wild values
    ridgesValue.value = 28
    ridgeDepthValue.value = 0.8
  } else {
    // Deactivate Wild: reset to defaults
    ridgesValue.value = 12
    ridgeDepthValue.value = 1.0
  }
}

// ─── Computed data object sent to Grasshopper ───────────────────────────────
const computeData = computed(() => {
  const pointStrings = pointPositionsValue.value.map(p =>
    '{"X":' + p.X + ',"Y":' + p.Y + ',"Z":' + p.Z + '}'
  )

  const result = {
    'Height': Number(heightValue.value),
    'Number of Points': Number(numPointsValue.value),
    'Rib Width': Number(ribWidthValue.value),
    'Ridges': Number(ridgesValue.value),
    'Ridge Depth': Number(ridgeDepthValue.value),
    'Pot Thickness': Number(potThicknessValue.value),
    'Curve Style': curveStyleValue.value,
    'Wild?': wildValue.value,
  }

  if (pointStrings.length > 0) {
    result['Points'] = pointStrings
  }

  return result
})

// ─── Receive metadata from Grasshopper ──────────────────────────────────────
function receiveMetadata(newMetadata) {
  if (newMetadata && Array.isArray(newMetadata)) {
    metadataList.value = newMetadata
  }
}

// ─── Rib Tool received from GeometryView ────────────────────────────────────
function onRibToolReady(doc) {
  ribToolDoc.value = doc
}

// ─── Point positions updated from 3D viewer drag ────────────────────────────
function onPointsUpdated(positions) {
  pointPositionsValue.value = positions
}

// ─── Download handlers (call exposed methods on GeometryView) ───────────────
function downloadVessel3dm() {
  viewerRef.value?.downloadVessel3dm()
}
function downloadRibTool3dm() {
  viewerRef.value?.downloadRibTool3dm()
}
function downloadSTL() {
  viewerRef.value?.downloadSTL()
}
</script>

<template>
  <div class="throwform-app">
    <!-- Brand header -->
    <Header title="ThrowForm" />

    <!-- Full-bleed viewer with glass overlay controls -->
    <div class="viewer-wrapper">
      <div class="viewer-area">
        <GeometryView
          ref="viewerRef"
          :data="computeData"
          :path="path"
          :numPoints="numPointsValue"
          :vesselColor="selectedColor"
          @updateMetadata="receiveMetadata"
          @ribToolReady="onRibToolReady"
          @pointsUpdated="onPointsUpdated"
        />
      </div>

      <!-- ── Glass popup panels ──────────────────────────────────── -->
      <Transition name="panel" mode="out-in">

        <!-- FORM panel -->
        <div v-if="activePanel === 'form'" class="glass-panel" key="form">
          <div class="panel-heading">Form</div>

          <div class="curve-toggle">
            <label class="curve-toggle-label">Curve Style</label>
            <div class="curve-toggle-btns">
              <button
                class="curve-opt"
                :class="{ active: !curveStyleValue }"
                @click="curveStyleValue = false"
              >Nurbs</button>
              <button
                class="curve-opt"
                :class="{ active: curveStyleValue }"
                @click="curveStyleValue = true"
              >Interpolate</button>
            </div>
          </div>

          <SliderInput title="Height (in)" :myValue="heightValue" :min="1" :max="20" :step="1" @update="updateValue" />
          <SliderInput title="Number of Points" :myValue="numPointsValue" :min="1" :max="10" :step="1" @update="updateValue" />
          <SliderInput title="Pot Thickness" :myValue="potThicknessValue" :min="0.1" :max="1.0" :step="0.1" @update="updateValue" />

          <span v-if="clayLbs" class="material-estimate">~{{ clayLbs }} lbs clay</span>
        </div>

        <!-- COLOR panel -->
        <div v-else-if="activePanel === 'color'" class="glass-panel color-panel" key="color">
          <div class="panel-heading">Color</div>
          <div class="color-grid">
            <button
              v-for="preset in colorPresets"
              :key="preset.hex"
              class="color-swatch"
              :class="{ selected: selectedColor === preset.hex }"
              :style="{ backgroundColor: preset.hex }"
              :title="preset.name"
              @click="selectColor(preset.hex)"
            ></button>
          </div>
        </div>

        <!-- WILD panel -->
        <div v-else-if="activePanel === 'wild'" class="glass-panel wild-panel" key="wild">
          <div class="panel-header-row">
            <span class="panel-heading">Wild</span>
            <button class="wild-switch" :class="{ on: wildValue }" @click="toggleWild">
              <span class="wild-switch-thumb"></span>
            </button>
          </div>

          <div class="wild-controls" :class="{ dimmed: !wildValue }">
            <NumericStepper title="Ridges" :val="ridgesValue" :min="4" :max="40" :step="2" @update="updateValue" />
            <NumericStepper title="Ridge Depth" :val="ridgeDepthValue" :min="0.8" :max="1.4" :step="0.1" @update="updateValue" />
          </div>
        </div>

        <!-- TOOL panel — side-by-side: preview + controls -->
        <div v-else-if="activePanel === 'tool'" class="glass-panel tool-panel" key="tool">
          <div class="tool-layout">
            <!-- Left: Rib Tool preview -->
            <div class="tool-preview-side">
              <RibToolPreview :ribToolDoc="ribToolDoc" />
            </div>

            <!-- Right: Tool controls -->
            <div class="tool-controls-side">
              <div class="panel-heading">Tool</div>

              <NumericStepper title="Rib Width (in)" :val="ribWidthValue" :min="0" :max="10" :step="1" @update="updateValue" />

              <button class="rib-download-btn" @click="downloadRibTool3dm">
                Download 3D print file
              </button>

              <div class="export-section">
                <span class="export-label">Export Vessel</span>
                <div class="export-btns">
                  <button class="dl-btn" @click="downloadVessel3dm">.3dm</button>
                  <button class="dl-btn" @click="downloadSTL">.stl</button>
                </div>
              </div>

              <span v-if="plaGrams" class="material-estimate">~{{ plaGrams }}g PLA</span>
            </div>
          </div>
        </div>
      </Transition>

      <!-- ── Floating glass navigation bar ───────────────────────── -->
      <nav class="glass-nav">
        <button
          class="glass-nav-item"
          :class="{ active: activePanel === 'form' }"
          @click="togglePanel('form')"
        >Form</button>

        <button
          class="glass-nav-item"
          :class="{ active: activePanel === 'color' }"
          @click="togglePanel('color')"
        >Color</button>

        <button
          class="glass-nav-item"
          :class="{ active: activePanel === 'wild', 'wild-on': wildValue }"
          @click="togglePanel('wild')"
        >Wild</button>

        <button
          class="glass-nav-item"
          :class="{ active: activePanel === 'tool' }"
          @click="togglePanel('tool')"
        >Tool</button>
      </nav>

    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
body { margin: 0; }
</style>

<style scoped>
/* ─── App container ──────────────────────────────────────────────────────── */
.throwform-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  font-family: 'Poppins', sans-serif;
  background-color: #FFFBF0;
}

/* ─── Viewer wrapper (now the main body of the app) ──────────────────────── */
.viewer-wrapper {
  flex: 1;
  min-height: 0;
  padding: 0 24px 24px;
  position: relative;
  background-color: #FFFBF0;
}

.viewer-area {
  height: 100%;
  border-radius: 16px;
  overflow: hidden;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  LIQUID GLASS NAVIGATION BAR                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

.glass-nav {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 32px;
  background: rgba(255, 251, 240, 0.45);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow:
    0 2px 16px rgba(50, 40, 36, 0.10),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
  z-index: 20;
}

.glass-nav-item {
  position: relative;
  padding: 10px 22px;
  border-radius: 24px;
  border: none;
  background: transparent;
  font-family: 'Poppins', sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  color: #332824;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  user-select: none;
}

.glass-nav-item:hover {
  background: rgba(114, 69, 55, 0.08);
}

.glass-nav-item:active {
  transform: scale(0.94);
}

.glass-nav-item.active {
  background: rgba(114, 69, 55, 0.18);
  color: #5a2e1f;
}

/* Wild indicator dot — shows when wild mode is active */
.glass-nav-item.wild-on::after {
  content: '';
  position: absolute;
  top: 6px;
  right: 10px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #B7503A;
  box-shadow: 0 0 4px rgba(183, 80, 58, 0.5);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  GLASS POPUP PANELS                                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

.glass-panel {
  position: absolute;
  bottom: 110px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px 24px;
  border-radius: 20px;
  background: rgba(255, 251, 240, 0.55);
  backdrop-filter: blur(28px) saturate(160%);
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow:
    0 8px 40px rgba(50, 40, 36, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
  z-index: 15;
  min-width: 240px;
  max-width: 320px;
}

/* ─── Panel transition ───────────────────────────────────────────────────── */
.panel-enter-active {
  transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}
.panel-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.panel-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(10px) scale(0.96);
}
.panel-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(6px) scale(0.98);
}

/* ─── Panel headings ─────────────────────────────────────────────────────── */
.panel-heading {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #332824;
  text-transform: uppercase;
  padding-bottom: 2px;
}

.panel-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* ─── Curve Style toggle ─────────────────────────────────────────────────── */
.curve-toggle {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.curve-toggle-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #1d1d1b;
}

.curve-toggle-btns {
  display: flex;
  border-radius: 6px;
  overflow: hidden;
  border: 1.5px solid #724537;
}

.curve-opt {
  flex: 1;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: #724537;
  font-family: 'Poppins', sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.curve-opt.active {
  background: #724537;
  color: #FFFBF0;
}

.curve-opt:not(.active):hover {
  background: rgba(114, 69, 55, 0.1);
}

/* ─── Wild switch (iOS toggle style) ─────────────────────────────────────── */
.wild-switch {
  position: relative;
  width: 44px;
  height: 24px;
  border-radius: 12px;
  border: none;
  background: #c5b8b0;
  cursor: pointer;
  transition: background 0.25s ease;
  padding: 0;
  flex-shrink: 0;
}

.wild-switch.on {
  background: #B7503A;
}

.wild-switch-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.wild-switch.on .wild-switch-thumb {
  transform: translateX(20px);
}

/* ─── Wild controls dimmed state ─────────────────────────────────────────── */
.wild-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: opacity 0.2s;
}

.wild-controls.dimmed {
  opacity: 0.35;
  pointer-events: none;
}

/* ─── Material estimate text ─────────────────────────────────────────────── */
.material-estimate {
  font-size: 0.72rem;
  font-weight: 400;
  color: #724537;
  margin-top: 2px;
}

/* ─── Color palette grid ─────────────────────────────────────────────────── */
.color-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-top: 2px;
}

.color-swatch {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 2.5px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.color-swatch:hover {
  transform: scale(1.1);
}

.color-swatch.selected {
  border-color: #332824;
  box-shadow: 0 0 0 2px #FFFBF0, 0 0 0 4px #332824;
}

/* ─── Tool panel — side-by-side layout ────────────────────────────────────── */
.tool-panel {
  min-width: auto;
  max-width: 480px;
}

.tool-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.tool-preview-side {
  flex-shrink: 0;
}

.tool-preview-side :deep(.rib-preview) {
  position: static;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(114, 69, 55, 0.15);
  border-radius: 10px;
  min-width: 150px;
  max-width: 170px;
}

.tool-preview-side :deep(.rib-preview-canvas) {
  height: 140px;
}

.tool-controls-side {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 180px;
}

.rib-download-btn {
  background-color: #385A49;
  color: #FFFBF0;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-family: 'Poppins', sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
}

.rib-download-btn:hover {
  background-color: #2a4639;
}

/* ─── Export section ─────────────────────────────────────────────────────── */
.export-section {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(114, 69, 55, 0.12);
}

.export-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #724537;
  text-transform: uppercase;
}

.export-btns {
  display: flex;
  gap: 4px;
}

.dl-btn {
  background: none;
  border: 1.5px solid #724537;
  border-radius: 4px;
  color: #724537;
  font-family: 'Poppins', sans-serif;
  font-size: 0.65rem;
  font-weight: 600;
  padding: 3px 8px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.dl-btn:hover {
  background: #724537;
  color: #FFFBF0;
}
</style>
