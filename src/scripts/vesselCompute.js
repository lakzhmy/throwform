/**
 * vesselCompute.js
 * Local compute wrapper for the ThrowForm pottery configurator.
 *
 * This wraps the Rhino Compute API call and splits the Grasshopper
 * response into separate docs:
 *   - vesselDoc        → the main vessel geometry ("Geometry" output)
 *   - ribToolDoc       → the rib/shaping tool ("Rib Tool" output)
 *
 * We need our own wrapper because the shared compute.js lumps all
 * geometry outputs into a single File3dm document.
 */

import rhino3dm from 'https://cdn.jsdelivr.net/npm/rhino3dm@8.0.0-beta2/rhino3dm.module.js'
import RhinoCompute from 'compute-rhino3d'
import { store } from '@/stores/storeSingletons'

// Same server as the shared compute.js
RhinoCompute.url = 'https://compute8.iaac.net/'
RhinoCompute.apiKey = 'macad2026'

let rhino // rhino3dm WASM module (loaded once)

/**
 * Initialize the rhino3dm WASM module. Call once before computing.
 */
async function initRhino() {
  if (!rhino) {
    rhino = await rhino3dm()
    console.log('Loaded rhino3dm (local).')
  }
}

/**
 * Run the Grasshopper definition and split outputs.
 *
 * @param {Object} data - Key/value pairs matching GH input names
 * @param {string} definitionPath - URL/path to the .gh file
 * @returns {{ vesselDoc: File3dm, ribToolDoc: File3dm }}
 */
async function computeVessel(data, definitionPath) {
  store.computing = true

  // 1. Load the Grasshopper definition
  const res = await fetch(definitionPath)
  const buffer = await res.arrayBuffer()
  const def = new Uint8Array(buffer)

  // 2. Build input data trees for each parameter
  const trees = []
  for (const [key, value] of Object.entries(data)) {
    const param = new RhinoCompute.Grasshopper.DataTree(key)
    param.append([0], Array.isArray(value) ? value : [value])
    trees.push(param)
  }

  // 3. Call Rhino Compute
  const startTime = performance.now()
  const ghResult = await RhinoCompute.Grasshopper.evaluateDefinition(def, trees)
  const duration = (performance.now() - startTime) / 1000
  console.log(`GH compute: ${duration.toFixed(3)}s`)

  // 4. Split the response into vessel, rib tool, and profile curve documents
  const vesselDoc = new rhino.File3dm()
  const ribToolDoc = new rhino.File3dm()
  const profileCurveDoc = new rhino.File3dm()
  const metadata = []

  for (const outputValue of ghResult.values) {
    const paramName = outputValue.ParamName

    // Choose which doc to add geometry to based on the GH output name
    let targetDoc
    if (paramName === 'Rib Tool') {
      targetDoc = ribToolDoc
    } else if (paramName === 'Profile Curve') {
      targetDoc = profileCurveDoc      // profile silhouette curve
    } else {
      targetDoc = vesselDoc            // main vessel geometry (fallback)
    }

    for (const [key, treeValue] of Object.entries(outputValue.InnerTree)) {
      for (const d of treeValue) {
        const dataType = String(d.type)
        if (dataType.includes('Geometry')) {
          const parsed = JSON.parse(d.data)
          const rhinoObj = rhino.CommonObject.decode(parsed)
          targetDoc.objects().add(rhinoObj, null)
        } else {
          // Non-geometry outputs (numbers, text) → metadata
          metadata.push({
            name: paramName,
            value: JSON.parse(d.data),
          })
        }
      }
    }
  }

  store.computing = false
  return { vesselDoc, ribToolDoc, profileCurveDoc, metadata }
}

/**
 * Download a File3dm document as a .3dm file.
 */
function download3dm(doc, fileName) {
  const options = new rhino.File3dmWriteOptions()
  options.version = 7
  const buffer = doc.toByteArrayOptions(options)
  const blob = new Blob([buffer], { type: 'application/octet-stream' })
  const link = document.createElement('a')
  link.href = window.URL.createObjectURL(blob)
  link.download = fileName + '.3dm'
  link.click()
}

export { initRhino, computeVessel, download3dm }
