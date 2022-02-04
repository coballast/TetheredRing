import * as THREE from 'https://cdn.skypack.dev/three@0.133.1/build/three.module.js'
//import * as THREE from '../three.js'

//import { OrbitControls } from 'https://cdn.skypack.dev/three@0.133.1/examples/jsm/controls/OrbitControls.js'
//import { OrbitControls } from '../three.js/examples/jsm/controls/OrbitControls.js'
import { OrbitControls } from './OrbitControlsModified.js'

//import { LineMaterial } from 'https://cdn.skypack.dev/three@0.133.1/examples/jsm/lines/LineMaterial.js'

import { VRButton } from 'https://cdn.skypack.dev/three@0.133.1/examples/jsm/webxr/VRButton.js'
//import { VRButton } from '../three.js/examples/jsm/webxr/VRButton.js'

//import Stats from '/jsm/libs/stats.module.js'

// import vertexShader from './shaders/vertex.glsl'
// import fragmentShader from './shaders/fragment.glsl'
// import atmosphereVertexShader from './shaders/atmosphereVertex.glsl'
// import atmosphereFragmentShader from './shaders/atmosphereFragment.glsl'

import Stats from 'https://cdn.skypack.dev/three@0.133.1/examples/jsm/libs/stats.module.js'
//import { GUI } from '../three.js/examples/jsm/libs/lil-gui.module.min.js'
import { GUI } from 'https://cdn.skypack.dev/three@0.133.1/examples/jsm/libs/dat.gui.module'
import { mainRingTubeGeometry, transitTubeGeometry, transitTrackGeometry } from './TransitTrack.js'
import { TetherGeometry } from './tethers.js'

//import { OBJLoader } from 'https://cdn.skypack.dev/three@0.133.1/examples/jsm/loaders/OBJLoader.js'
import { FBXLoader } from 'https://cdn.skypack.dev/three@0.133.1/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.133.1/examples/jsm/loaders/GLTFLoader.js'
import * as BufferGeometryUtils from 'https://cdn.skypack.dev/three@0.133.1/examples/jsm/utils/BufferGeometryUtils.js'

//import * as dat from 'dat.gui'
import * as tram from './tram.js'
import * as launcher from './launcher.js'
import * as kmlutils from './kmlutils.js'

import { makePlanetTexture } from './planetTexture.js'

const enableVR = false
const enableKMLFileFeature = true
const enableSpecsFileFeature = true
let genKMLFile = false
let genSpecsFile = false
let fastTetherRender = true   // Fast render also uses the jitter reduction technique of creating a mesh with coordinates relative to a point near the ring, and then setting these mesh positions near the ring as well. However, this technique generates coordinates that are not useful for kml file generation.
const majorRedesign = true // False enables work in progress...

// Useful constants that we never plan to change
const gravitationalConstant = 0.0000000000667408
const idealGasConstant = 8314.5 // Joules/kgmole-K
let massOfPlanet = 5.97E+24   // kg   using mass of Earth for now
let radiusOfPlanet = 6378100 // m   using radius of Earth for now
const WGS84FlattenningFactor = 298.257223563    // Used to specify the exact shape of earth, which is approximately an oblate spheroid
const lengthOfSiderealDay = 86164.0905 // seconds    using value for Earth for now

const gui = new GUI()
const folderGeography = gui.addFolder('Location (V6)')
const folderEngineering = gui.addFolder('Engineering')
const folderMaterials = gui.addFolder('Materials')
const folderEconomics = gui.addFolder('Economics')
const folderRendering = gui.addFolder('Rendering')

const targetRadius = 32800000 / Math.PI / 2   // 32800 km is the max size a perfectly circular ring can be and still fits within the Pacific Ocean
const equivalentLatitudePreset = Math.acos(targetRadius/(radiusOfPlanet + 32000)) * 180 / Math.PI

// Hack - distort scale to better illustrate certain concepts
// radiusOfPlanet = 637810
// massOfPlanet = 5.97E+22

// Constants controlled by sliders
const guidParamWithUnits = {
  //equivalentLatitude: 35.473512807508094,
  // Alternate location with the increased diameter needed to reach both US and China's coastlines (note: too large to construct in the Pacific Ocean)
  //equivalentLatitude: 30.8,
  //ringCenterLongitude: 182,
  //ringCenterLatitude: 11,
  //ringFinalAltitude: 32000,  // m
  equivalentLatitude: {value: equivalentLatitudePreset, units: "degrees", autoMap: false, min: 10, max: 80, updateFunction: adjustRingDesign, folder: folderGeography},
  // Final Location
  buildLocationRingCenterLongitude: {value: 213.7, units: "degrees", autoMap: false, min: 0, max: 360, updateFunction: adjustRingLatLon, folder: folderGeography},
  finalLocationRingCenterLongitude: {value: 186.3, units: "degrees", autoMap: false, min: 0, max: 360, updateFunction: adjustRingLatLon, folder: folderGeography},
  buildLocationRingCenterLatitude: {value: -19.2, units: "degrees", autoMap: false, min: -90, max: 90, updateFunction: adjustRingLatLon, folder: folderGeography},
  finalLocationRingCenterLatitude: {value: 14.2, units: "degrees", autoMap: false, min: -90, max: 90, updateFunction: adjustRingLatLon, folder: folderGeography},
  // Build location (assumes equivalentLatitude = 35)
  buildLocationRingEccentricity: {value:1, units: "", autoMap: false, min: 0.97, max: 1.03, step: 0.001, updateFunction: adjustRingDesign, folder: folderGeography},
  finalLocationRingEccentricity: {value:1, units: "", autoMap: false, min: 0.97, max: 1.03, step: 0.001, updateFunction: adjustRingDesign, folder: folderGeography},
  // ToDo: moveRing needs to call adjustRingDesign when buildLocationRingEccentricity differs from finalLocationRingEccentricity
  moveRing: {value:1, units: "", autoMap: false, min: 0, max: 1, updateFunction: adjustRingLatLon, folder: folderGeography},

  // Engineering Parameters - Ring
  ringFinalAltitude: {value:32000, units: "m", autoMap: true, min: 0, max: 200000, updateFunction: adjustRingDesign, folder: folderEngineering},
  ringAmountRaisedFactor: {value:1, units: "", autoMap: true, min: 0, max: 1, updateFunction: adjustRingDesign, folder: folderEngineering},
  numControlPoints: {value: 256, units: '', autoMap: true, min: 4, max: 1024, step: 1, updateFunction: adjustRingDesign, folder: folderEngineering},
  numMainRings: {value:5, units: "", autoMap: true, min: 1, max: 7, step: 1, updateFunction: adjustRingDesign, folder: folderEngineering},
  mainRingTubeRadius: {value:0.5, units: "m", autoMap: true, min: .1, max: 5, updateFunction: adjustRingDesign, folder: folderEngineering},
  mainRingSpacing: {value:10, units: "m", autoMap: true, min: 0, max: 30, updateFunction: adjustRingDesign, folder: folderEngineering},
  massPerMeterOfRing: {value:100, units: "kg", autoMap: true, min: 1, max: 1000, updateFunction: adjustRingDesign, folder: folderEngineering},

  // Engineering Parameters - Tethers
  numTethers: {value:2048, units: "", autoMap: true, min: 4, max: 7200, step: 2, updateFunction: adjustRingDesign, folder: folderEngineering},
  numForkLevels: {value:5, units: "", autoMap: true, min: 0, max: 8, step: 1, updateFunction: adjustRingDesign, folder: folderEngineering},       // The number of times the we want to fork the tethers (i.e. num time you will encounter a fork when travelling from base to a single attachment point)
  tetherSpanOverlapFactor: {value:2, units: "%", autoMap: true, min: 0.5, max: 4, updateFunction: adjustRingDesign, folder: folderEngineering},
  tetherPointBxAvePercent: {value:50, units: "%", autoMap: true, min: 0, max: 100, updateFunction: adjustRingDesign, folder: folderEngineering},
  tetherPointBxDeltaPercent: {value:40, units: "%", autoMap: true, min: 0, max: 50, updateFunction: adjustRingDesign, folder: folderEngineering},
  tetherEngineeringFactor: {value:2, units: "", autoMap: true, min: 0.1, max: 10, updateFunction: adjustRingDesign, folder: folderEngineering},

  // Engineering Parameters - Elevators
  numElevatorCables: {value:1800, units: "", autoMap: true, min: 0, max: 3600, step: 1, updateFunction: adjustRingDesign, folder: folderEngineering},
  numElevatorCars: {value:225, units: "", autoMap: true, min: 0, max: 3600, step: 1, updateFunction: adjustRingDesign, folder: folderEngineering},
  additionalUpperElevatorCable: {value: 10, units: 'm', autoMap: true, min: 0, max: 50, updateFunction: adjustRingDesign, folder: folderEngineering},
  elevatorCableOutwardOffset: {value: -20, units: 'm', autoMap: true, min: -100, max: 0, updateFunction: adjustRingDesign, folder: folderEngineering},
  terminusOutwardOffset: {value: -6.5, units: 'm', autoMap: true, min: -100, max: 0, updateFunction: adjustRingDesign, folder: folderEngineering},
  terminusUpwardOffset: {value: -4, units: 'm', autoMap: true, min: -100, max: 0, updateFunction: adjustRingDesign, folder: folderEngineering},

  // Engineering Parameters - Transit System
  transitTubeUpwardOffset: {value:-100, units: "m", autoMap: true, min: -1000, max: 0, updateFunction: adjustRingDesign, folder: folderEngineering},
  numTransitTrackLevels: {value:2, units: "", autoMap: true, min: 1, max: 3, step: 1, updateFunction: adjustRingDesign, folder: folderEngineering},
  transitTubeOutwardOffset: {value: -10, units: 'm', autoMap: true, min: -100, max: 0, updateFunction: adjustRingDesign, folder: folderEngineering},
  transitTubeTubeRadius: {value: 6, units: 'm', autoMap: true, min: 1, max: 20, updateFunction: adjustRingDesign, folder: folderEngineering},
  transitTubeInteriorPressure: {value: 10, units: 'Pa', autoMap: true, min: .1, max: 1000, updateFunction: adjustRingDesign, folder: folderEngineering},
  transitTubeInteriorGasMolecularWeight: {value: 29, units: 'kg/kgmole', autoMap: true, min: 1, max: 100, updateFunction: adjustRingDesign, folder: folderEngineering},
  transitTubeInteriorTemperature: {value: 20, units: 'C', autoMap: true, min: 0, max: 40, updateFunction: adjustRingDesign, folder: folderEngineering},
  transitTrackCost: {value:18000, units: "USD/m", autoMap: true, min: 1, max: 30000, updateFunction: adjustRingDesign, folder: folderEngineering},  // https://youtu.be/PeYIo91DlWo?t=490
  // This is really "aveNumTransitVehiclesPerTrack" at the moment...
  numTransitVehicles: {value: 450, units: '', autoMap: true, min: 0, max: 3600, step: 1, updateFunction: adjustRingDesign, folder: folderEngineering},
  transitVehicleLength: {value: 20, units: 'm', autoMap: true, min: 1, max: 100, updateFunction: adjustRingDesign, folder: folderEngineering},
  transitVehicleRadius: {value: 2, units: 'm', autoMap: true, min: 1, max: 10, updateFunction: adjustRingDesign, folder: folderEngineering},
  transitVehicleCruisingSpeed: {value: 1100, units: 'm/s', autoMap: true, min: 100, max: 2000, updateFunction: adjustRingDesign, folder: folderEngineering},
  transitSystemEfficiencyAtCruisingSpeed: {value: 0.8, units: '', autoMap: true, min: 0.1, max: 1, updateFunction: adjustRingDesign, folder: folderEngineering},
  transitVehicleCoefficientOfDrag: {value: 0.25, units: '', autoMap: true, min: .1, max: 1, updateFunction: adjustRingDesign, folder: folderEngineering},
  numTerminuses: {value:225, units: "", autoMap: true, min: 0, max: 3600, step: 1, updateFunction: adjustRingDesign, folder: folderEngineering},
  
  // Engineering Parameters - Launch System
  launchTubeUpwardOffset: {value:100, units: "m", autoMap: true, min: -1000, max: 0, updateFunction: adjustRingDesign, folder: folderEngineering},
  launchTubeAcceleration: {value: 30, units: 'm', autoMap: true, min: 1, max: 1000, updateFunction: adjustRingDesign, folder: folderEngineering},
  launchTubeExitVelocity: {value: 8000, units: 'm*s-1', autoMap: true, min: 100, max: 50000, updateFunction: adjustRingDesign, folder: folderEngineering},
  launchVehicleCoefficientOfDrag: {value: 1, units: '', autoMap: true, min: .1, max: 2, updateFunction: adjustRingDesign, folder: folderEngineering},
  launchVehicleRadius: {value: 1, units: '2', autoMap: true, min: .1, max: 10, updateFunction: adjustRingDesign, folder: folderEngineering},

  // Engineering Parameters - Power
  powerRequirement: {value: 1000, units: "W/m", autoMap: true, min: 1, max: 10000, updateFunction: adjustRingDesign, folder: folderEngineering},   // This is the power that is consumed by the rings maglev systems and all equipment supported by the ring, per meter length of the ring.
  powerConductorDensity: {value: 2710, units: "kg*m-3", autoMap: true, min: 10, max: 10000, updateFunction: adjustRingDesign, folder: folderEngineering},  // Value for aluminum
  powerConductorConductivity: {value: 36900000, units: "Siemens*m-1", autoMap: true, min: 10000000, max: 100000000, updateFunction: adjustRingDesign, folder: folderEngineering}, // Value for Aliminum. One siemen is kg−1⋅m−2⋅s3⋅A2
  powerVoltageAcrossLoad: {value: 100000, units: "Volts", autoMap: true, min: 1, max: 10000000, updateFunction: adjustRingDesign, folder: folderEngineering},
  powerLostInConductorFactor: {value: 0.01, units: "", autoMap: true, min: 0, max: 1, updateFunction: adjustRingDesign, folder: folderEngineering},

  // Material Parameters - Tethers
  tetherMaterialDensityCarbonFiber: {value: 1790, units: "kg*m-3", autoMap: false, min: 10, max: 20000, updateFunction: adjustRingDesign, folder: folderMaterials},        // Toray1100GC, https://www.youtube.com/watch?v=yNsjVEm_9TI&t=129s
  tetherMaterialTensileStrengthCarbonFiber: {value: 7000, units: "MPa", autoMap: false, min: 10, max: 100000, updateFunction: adjustRingDesign, folder: folderMaterials},   // Toray1100GC, https://www.youtube.com/watch?v=yNsjVEm_9TI&t=129s
  tetherMaterialCostCarbonFiber: {value: 22, units: "USD/kg", autoMap: false, min: .01, max: 1000, updateFunction: adjustRingDesign, folder: folderMaterials},           // Note: Probably not accurate for Toray1100GC
  tetherMaterialDensityGraphene: {value: 2090, units: "kg*m-3", autoMap: false, min: 10, max: 20000, updateFunction: adjustRingDesign, folder: folderMaterials},        // 
  tetherMaterialTensileStrengthGraphene: {value: 130500, units: "MPa", autoMap: false, min: 10, max: 100000, updateFunction: adjustRingDesign, folder: folderMaterials},   // 
  tetherMaterialCostGraphene: {value: 220, units: "USD/kg", autoMap: false, min: .01, max: 1000, updateFunction: adjustRingDesign, folder: folderMaterials},           // 
  tetherMaterialDensityCustom: {value: 1790, units: "kg*m-3", autoMap: false, min: 10, max: 20000, updateFunction: adjustRingDesign, folder: folderMaterials},
  tetherMaterialTensileStrengthCustom: {value: 7000, units: "MPa", autoMap: false, min: 10, max: 100000, updateFunction: adjustRingDesign, folder: folderMaterials},
  tetherMaterialCostCustom: {value: 22, units: "USD/kg", autoMap: false, min: .01, max: 1000, updateFunction: adjustRingDesign, folder: folderMaterials},
    
  // Economics Parameters
  
  // Rendering Parameters
  showEarthsSurface: {value: true, units: '', autoMap: true, updateFunction: adjustEarthSurfaceVisibility, folder: folderRendering},
  showEarthAxis: {value: false, units: '', autoMap: true, updateFunction: adjustRingDesign, folder: folderRendering},
  showEarthEquator: {value: false, units: '', autoMap: true, updateFunction: adjustRingDesign, folder: folderRendering},
  showMainRingCurve: {value: false, units: '', autoMap: true, updateFunction: adjustRingDesign, folder: folderRendering},
  showMainRings: {value: true, units: '', autoMap: true, updateFunction: adjustRingDesign, folder: folderRendering},
  showTethers: {value: true, units: '', autoMap: true, updateFunction: adjustRingDesign, folder: folderRendering},
  showElevatorCables: {value: true, units: '', autoMap: true, updateFunction: adjustRingDesign, folder: folderRendering},
  showElevatorCars: {value: false, units: '', autoMap: true, updateFunction: adjustRingDesign, folder: folderRendering},
  showLaunchOrbit: {value: false, units: '', autoMap: true, updateFunction: adjustRingDesign, folder: folderRendering},
  showLaunchTrajectory: {value: false, units: '', autoMap: true, updateFunction: adjustRingDesign, folder: folderRendering},
  showLaunchTubes: {value: false, units: '', autoMap: true, updateFunction: adjustRingDesign, folder: folderRendering},
  showTransitSystem: {value: true, units: '', autoMap: true, updateFunction: adjustRingDesign, folder: folderRendering},
  showTransitVehicles: {value: true, units: '', autoMap: true, updateFunction: adjustRingDesign, folder: folderRendering},
  showTerminuses: {value: true, units: '', autoMap: true, updateFunction: adjustRingDesign, folder: folderRendering},
  animateElevators: {value: true, units: '', autoMap: true, updateFunction: adjustRingDesign, folder: folderRendering},
  animateTransitVehicles: {value: false, units: '', autoMap: true, min: 0, max: 1, updateFunction: adjustRingDesign, folder: folderRendering},
  cableVisibility: {value:0.2, units: "", autoMap: true, min: 0, max: 1, updateFunction: adjustCableOpacity, folder: folderRendering},
  tetherVisibility: {value:0.2, units: "", autoMap: true, min: 0, max: 1, updateFunction: adjustTetherOpacity, folder: folderRendering},
  launchTrajectoryVisibility: {value: 1, units: '', autoMap: true, min: 0, max: 1, updateFunction: adjustLaunchTrajectoryOpacity, folder: folderRendering},
  cameraFieldOfView: {value: 45, units: '', autoMap: true, min: 5, max: 90, updateFunction: updateCamerFieldOfView, folder: folderRendering},
}


const current = guidParamWithUnits['powerRequirement'].value / guidParamWithUnits['powerVoltageAcrossLoad'].value
const powerLostInConductor = guidParamWithUnits['powerRequirement'].value * guidParamWithUnits['powerLostInConductorFactor'].value
const voltageDropOverWires = powerLostInConductor / current
const wireResistance = voltageDropOverWires / current
const wireLength = 2*84354.4319347572  // This needs to be computed in the tether math section
const wireCrossSectionalArea = wireLength / guidParamWithUnits['powerConductorConductivity'].value / wireResistance
const wireCrossSectionalArea_mm2perkm = wireCrossSectionalArea * 1000 * 1000000
const wireDiameter = 2 * Math.sqrt(wireCrossSectionalArea_mm2perkm / Math.PI)

// A = S*V = kg−1⋅m−2⋅s3⋅A2*m-1 * kg·m2·s−3·A−1
// WireResistance = Voltage^2 / Power
// CrossSectionalArea = Length / Conductivity / WireResistance

// Override one of the initial values with a calcuated value...

// The GUI() object doesn't accept out key value pairs, so we need to create a simplified structure in order for GUI to work
const guidParam = {}
Object.entries(guidParamWithUnits).forEach(([k, v]) => {
  guidParam[k] = v.value
})

// Add sliders for each entry in guidParamWithUnits to the gui...
gui.width = 500
console.log(gui)
// Constants controlled by pull-pown lists
const TetherMaterial = {
  Custom: 'CUSTOM',
  CarbonFiber: 'CARBON_FIBER',
  Graphene: 'GRAPHENE',
};
guidParam['TetherMaterial'] = TetherMaterial.CarbonFiber
folderMaterials.add(guidParam, 'TetherMaterial', TetherMaterial ).onChange( updateTetherMaterial );

// Add automapped sliders
Object.entries(guidParamWithUnits).forEach(([k, v]) => {
  if (v.step) {
    guidParamWithUnits[k].folder.add(guidParam, k, v.min, v.max).onChange(v.updateFunction).step(v.step)
  }
  else {
    guidParamWithUnits[k].folder.add(guidParam, k, v.min, v.max).onChange(v.updateFunction)
  }
})

function updateTetherMaterial() {
  switch (guidParam['TetherMaterial']) {
    case TetherMaterial.CarbonFiber:
      dParamWithUnits['tetherMaterialDensity'] = {value: guidParamWithUnits['tetherMaterialDensityCarbonFiber'].value, units: guidParamWithUnits['tetherMaterialDensityCarbonFiber'].units}
      dParamWithUnits['tetherMaterialTensileStrength'] = {value: guidParamWithUnits['tetherMaterialTensileStrengthCarbonFiber'].value, units: guidParamWithUnits['tetherMaterialTensileStrengthCarbonFiber'].units}
      dParamWithUnits['tetherMaterialCost'] = {value: guidParamWithUnits['tetherMaterialCostCarbonFiber'].value, units: guidParamWithUnits['tetherMaterialCostCarbonFiber'].units}
      break;
    case TetherMaterial.Graphene:
      dParamWithUnits['tetherMaterialDensity'] = {value: guidParamWithUnits['tetherMaterialDensityGraphene'].value, units: guidParamWithUnits['tetherMaterialDensityGraphene'].units}
      dParamWithUnits['tetherMaterialTensileStrength'] = {value: guidParamWithUnits['tetherMaterialTensileStrengthGraphene'].value, units: guidParamWithUnits['tetherMaterialTensileStrengthGraphene'].units}
      dParamWithUnits['tetherMaterialCost'] = {value: guidParamWithUnits['tetherMaterialCostGraphene'].value, units: guidParamWithUnits['tetherMaterialCostGraphene'].units}
      break;
    case TetherMaterial.Custom:
      dParamWithUnits['tetherMaterialDensity'] = {value: guidParamWithUnits['tetherMaterialDensityCustom'].value, units: guidParamWithUnits['tetherMaterialDensityCustom'].units}
      dParamWithUnits['tetherMaterialTensileStrength'] = {value: guidParamWithUnits['tetherMaterialTensileStrengthCustom'].value, units: guidParamWithUnits['tetherMaterialTensileStrengthCustom'].units}
      dParamWithUnits['tetherMaterialCost'] = {value: guidParamWithUnits['tetherMaterialCostCustom'].value, units: guidParamWithUnits['tetherMaterialCostCustom'].units}
      break;
  }
}

// Add an additional button to the gui to display instructions for the new user
function displayHelp() {
  alert('"Z" and "X" keys zoom in and out.\n"P" key moves the point that the simulation orbits around to a position just above the planet\'s surface near to where the sprite is pointing.\n')
}
guidParam['Help'] = displayHelp
gui.add(guidParam, 'Help')

// Actual Design Parameters derived from slider values
let dParamWithUnits = {}
const specs = {}
let kmlFile = ''
let specsFile = ''

function updatedParam() {   // Read as "update_dParam"
  Object.entries(guidParamWithUnits).forEach(([k, v]) => {
    v.value = guidParam[k]
  })
  Object.entries(guidParamWithUnits).forEach(([k, v]) => {
    if (v.autoMap) {
      dParamWithUnits[k] = {value: v.value, units: v.units}
    }
  })
  // The following parameters are mapped "manually" from the gui to the model
  dParamWithUnits['equivalentLatitude'] = {value: guidParamWithUnits['equivalentLatitude'].value / 180 * Math.PI, units: "radians"}
  dParamWithUnits['ringCenterLongitude'] = {value: tram.lerp(guidParamWithUnits['buildLocationRingCenterLongitude'].value, guidParamWithUnits['finalLocationRingCenterLongitude'].value, guidParamWithUnits['moveRing'].value)  / 180 * Math.PI, units: "radians"}
  dParamWithUnits['ringCenterLatitude'] = {value: tram.lerp(guidParamWithUnits['buildLocationRingCenterLatitude'].value, guidParamWithUnits['finalLocationRingCenterLatitude'].value, guidParamWithUnits['moveRing'].value) / 180 * Math.PI, units: "radians"}
  dParamWithUnits['ringEccentricity'] = {value: tram.lerp(guidParamWithUnits['buildLocationRingEccentricity'].value, guidParamWithUnits['finalLocationRingEccentricity'].value, guidParamWithUnits['moveRing'].value), units: ""}
  dParamWithUnits['launchTubeLength'] = {value: dParamWithUnits['launchTubeExitVelocity'].value**2 /2 / dParamWithUnits['launchTubeAcceleration'].value, units: "m"}
  dParamWithUnits['launchTubeAccelerationTime'] = {value: dParamWithUnits['launchTubeExitVelocity'].value / dParamWithUnits['launchTubeAcceleration'].value, units: "s"}
  updateTetherMaterial()

  if (genSpecsFile) {
    specsFile = specsFile.concat('// GUI Parameters\n')
    Object.entries(guidParamWithUnits).forEach(([k, v]) => {
      specsFile = specsFile.concat(k + ',' + v.value + ',' + v.units + '\n')
    })

    specsFile = specsFile.concat('// Design Parameters\n')
    Object.entries(dParamWithUnits).forEach(([k, v]) => {
      specsFile = specsFile.concat(k + ',' + v.value + ',' + v.units + '\n')
    })
  }
}

updatedParam()

function adjustRingDesign() {
  updateRing()
}

function adjustEarthSurfaceVisibility() {
  updatedParam()
  planetMeshes.forEach(mesh => {
    mesh.visible = guidParamWithUnits['showEarthsSurface'].value
  })
}

function adjustCableOpacity() {
  updatedParam()
  cableMaterial.opacity = dParamWithUnits['cableVisibility'].value
}

function adjustTetherOpacity() {
  updatedParam()
  tetherMaterial.opacity = dParamWithUnits['tetherVisibility'].value
}

function adjustLaunchTrajectoryOpacity() {
  updatedParam()
  launchTrajectoryMaterial.opacity = dParamWithUnits['launchTrajectoryVisibility'].value
}

function adjustRingLatLon() {
  updatedParam()
  const object1 = scene.getObjectByName("tetheredRingLonCoordSys")
  object1.rotation.y = dParamWithUnits['ringCenterLongitude'].value
  const object2 = scene.getObjectByName("tetheredRingLatCoordSys")
  object2.rotation.x = -dParamWithUnits['ringCenterLatitude'].value
}

// Three.js Rendering Setup
let simContainer = document.querySelector('#simContainer')

const raycaster = new THREE.Raycaster()
const scene = new THREE.Scene()
//scene.fog = new THREE.FogExp2(0x202040, 0.000005)

//scene.background = new THREE.Color( 0xffffff )
//scene.background = null
const fov = dParamWithUnits['cameraFieldOfView'].value
const aspectRatio = simContainer.offsetWidth/simContainer.offsetHeight
//console.log("W,H ", simContainer.offsetWidth, simContainer.offsetHeight)
let nearClippingPlane = 0.1 * radiusOfPlanet
let farClippingPlane = 100 * radiusOfPlanet
let extraDistanceForCamera = 10000

const camera = new THREE.PerspectiveCamera(fov, aspectRatio, nearClippingPlane, farClippingPlane)
const cameraGroup = new THREE.Group()
cameraGroup.add(camera)
camera.position.z = -30 * radiusOfPlanet/8

function updateCamerFieldOfView() {
  updatedParam()
  camera.fov = dParamWithUnits['cameraFieldOfView'].value
}

// Need to add these two lines to have the planet apper in VR
if (enableVR) {
  cameraGroup.position.z = -1.005 * radiusOfPlanet
  cameraGroup.rotation.z = Math.PI / 2
  cameraGroup.rotation.y = -Math.PI / 2
}
scene.add(cameraGroup)

const sunLight = new THREE.DirectionalLight(0xffffff, 1)
sunLight.name = 'sunlight'
sunLight.position.set(0, 6 * radiusOfPlanet/8, -20 * radiusOfPlanet/8)

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  //alpha: true,
  //logarithmicDepthBuffer: true,
  canvas: document.querySelector('canvas')
})
//renderer.setSize(innerWidth, innerHeight)
renderer.setSize(simContainer.offsetWidth, simContainer.offsetHeight)
//renderer.setClearColor( 0x000000, 0 );
//console.log("W,H ", simContainer.offsetWidth, simContainer.offsetHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.xr.enabled = true
renderer.xr.setReferenceSpaceType( 'local' )
//document.body.appendChild(renderer.domElement)
const stats = new Stats()
simContainer.appendChild( stats.dom )

const orbitControls = new OrbitControls(camera, renderer.domElement)
orbitControls.addEventListener('change', orbitControlsEventHandler)

//orbitControls.autoRotate = true
orbitControls.autoRotateSpeed = 0.1
orbitControls.enableDamping = true
//orbitControls.enablePan = true

const AxisEquatorThickness = radiusOfPlanet * 0.004
const planetWidthSegments = 768
const planetHeightSegments = 192

const planetCoordSys = new THREE.Group()

planetCoordSys.position.x = 0
planetCoordSys.position.y = 0
planetCoordSys.position.z = 0
//planetCoordSys.scale.y = 1.0 - 1.0/WGS84FlattenningFactor // Squishes the earth (and everything else) by the correct flattening factor

let eightTextureMode = false
let TextureMode24x12 = false
let TextureModeOpenLayers = false;
if (enableVR) {
  planetCoordSys.rotation.y = Math.PI * -5.253 / 16
  planetCoordSys.rotation.x = Math.PI * -4 / 16
  eightTextureMode = true
}
else {
  eightTextureMode = false
  TextureMode24x12 = true
}

scene.add(planetCoordSys)

const planetMeshes = []
let filename
let letter

if (TextureMode24x12) {
  const w = 24
  const h = 12
  for (let j=0; j<h; j++) {
    for (let i = 0; i<w; i++) {
      if ((j!=2) || (i!=3)) {
        filename = `./textures/24x12/LR/earth_LR_${w}x${h}_${i}x${j}.jpg`
      }
      else {
        filename = `./textures/24x12/HR/earth_HR_${w}x${h}_${i}x${j}.jpg`
      }
      console.log(filename)
      const planetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(radiusOfPlanet, planetWidthSegments/w, planetHeightSegments/h, i*Math.PI*2/w, Math.PI*2/w, j*Math.PI/h, Math.PI/h),
        new THREE.ShaderMaterial({
          //vertexShader: vertexShader,
          //fragmentShader: fragmentShader,
          vertexShader: document.getElementById( 'vertexShader' ).textContent,
          fragmentShader: document.getElementById( 'fragmentShader' ).textContent,
          uniforms: {
            planetTexture: {
              //value: new THREE.TextureLoader().load( './textures/bluemarble_16384.png' )
              value: new THREE.TextureLoader().load(filename),
            }
          },
          //displacementMap: new THREE.TextureLoader().load( './textures/HighRes/EARTH_DISPLACE_42K_16BITS_preview.jpg' ),
          //displacementScale: 500000,
        })
      )
      planetMesh.name = 'planet'
      planetMesh.rotation.y = -Math.PI/2  // This is needed to have the planet's texture align with the planet's Longintitude system
      planetMeshes.push(planetMesh)
    }
  }
}
else if (TextureModeOpenLayers) {
  const planetMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radiusOfPlanet, planetWidthSegments, planetHeightSegments),
    new THREE.ShaderMaterial({
      vertexShader: document.getElementById('vertexShader').textContent,
      fragmentShader: document.getElementById('fragmentShader').textContent,
      uniforms: {
        planetTexture: {
          value: undefined,
        }
      }
    })
  )
  makePlanetTexture(planetMesh, orbitControls, camera, radiusOfPlanet, false, (planetTexture) => {
    planetMesh.material.uniforms.planetTexture.value = planetTexture;
    planetMesh.material.uniforms.planetTexture.needsUpdate = true;
  });

  planetMesh.name = 'planet'
  planetMesh.rotation.y = -Math.PI / 2  // This is needed to have the planet's texture align with the planet's Longintitude system
  planetMeshes.push(planetMesh)


}
else if (eightTextureMode) {
  let letter
  for (let j=0; j<2; j++) {
    for (let i = 0; i<4; i++) {
      //if ((j==0) && ((i==0) || (i==3))) {
      if ((j==0) && (i==0)) {
        letter = String.fromCharCode(65+i)
        filename = `./textures/world.topo.200404.3x21600x21600.${letter}${j+1}.jpg`
        //filename = `./textures/world.topo.200404.3x16384x16384.${letter}${j+1}.jpg`
        console.log(letter, filename)
        const planetMesh = new THREE.Mesh(
          new THREE.SphereGeometry(radiusOfPlanet, planetWidthSegments, planetHeightSegments, i*Math.PI/2, Math.PI/2, j*Math.PI/2, Math.PI/2),
          new THREE.ShaderMaterial({
            //vertexShader: vertexShader,
            //fragmentShader: fragmentShader,
            vertexShader: document.getElementById( 'vertexShader' ).textContent,
            fragmentShader: document.getElementById( 'fragmentShader' ).textContent,
            uniforms: {
              planetTexture: {
                //value: new THREE.TextureLoader().load( './textures/bluemarble_16384.png' )
                value: new THREE.TextureLoader().load(filename),
              }
            },
            //displacementMap: new THREE.TextureLoader().load( './textures/HighRes/EARTH_DISPLACE_42K_16BITS_preview.jpg' ),
            //displacementScale: 500000,
          })
        )
        planetMesh.name = 'planet'
        planetMesh.rotation.y = -Math.PI/2  // This is needed to have the planet's texture align with the planet's Longintitude system
        planetMeshes.push(planetMesh)
      }
    }
  }
}
else {
  const planetMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radiusOfPlanet, planetWidthSegments, planetHeightSegments),
    // new THREE.MeshPhongMaterial({
    //   //roughness: 1,
    //   //metalness: 0,
    //   map: new THREE.TextureLoader().load( './textures/bluemarble_4096.jpg' ),
    //   //map: new THREE.TextureLoader().load( './textures/bluemarble_16384.png' ),
    //   //map: new THREE.TextureLoader().load( './textures/earthmap1k.jpg' ),
    //   //bumpMap: new THREE.TextureLoader().load( './textures/earthbump.jpg' ),
    //   //bumpScale: 1000000,
    //   //displacementMap: new THREE.TextureLoader().load( './textures/HighRes/EARTH_DISPLACE_42K_16BITS_preview.jpg' ),
    //   //displacementScale: 20000,
    // })
    // Hack
    new THREE.ShaderMaterial({
      //vertexShader: vertexShader,
      //fragmentShader: fragmentShader,
      vertexShader: document.getElementById( 'vertexShader' ).textContent,
      fragmentShader: document.getElementById( 'fragmentShader' ).textContent,
      uniforms: {
        planetTexture: {
          //value: new THREE.TextureLoader().load( './textures/bluemarble_4096.jpg' )
          value: new THREE.TextureLoader().load( './textures/bluemarble_16384.jpg' )
          //value: new THREE.TextureLoader().load( './textures/bluemarble_16384.png' )
          //value: new THREE.TextureLoader().load( './textures/human_population_density_map.png' )
        }
      }
    })
  )
  planetMesh.name = 'planet'
  planetMesh.rotation.y = -Math.PI/2  // This is needed to have the planet's texture align with the planet's Longintitude system
  planetMeshes.push(planetMesh)
}
//planetMesh.castShadow = true

const atmosphereMesh = new THREE.Mesh(
  new THREE.SphereGeometry(radiusOfPlanet, planetWidthSegments/16, planetHeightSegments/16),
  new THREE.ShaderMaterial({
    //vertexShader: atmosphereVertexShader,
    //fragmentShader: atmosphereFragmentShader,
    vertexShader: document.getElementById( 'atmosphereVertexShader' ).textContent,
    fragmentShader: document.getElementById( 'atmosphereFragmentShader' ).textContent,

    blending: THREE.AdditiveBlending,
    side: THREE.BackSide
  })
)
atmosphereMesh.name = 'atmosphere'

// ToDo: Scaling this sphere as opposed to setting its radius directly seems a bit hacky.
atmosphereMesh.scale.set(1.1, 1.1 * (1.0 - 1.0/WGS84FlattenningFactor), 1.1)
//atmosphereMesh.receiveShadow = true

// Experimental code
// const plane = new THREE.mesh(new THREE.PlaneGeometry(2, 2, 512, 512), 
//   new THREE.MeshStandardMaterial(
//     {
//       map: earthBaseColor,
//       normalMap: earthNormalMap,
//       displacementMap: earthDisplacementMap,
//       displacementScale: 0.1,
//       roughnessMap: earthRoughnessMap,
//       roughness: 0.5,
//       aoMap: earthAmbienOcclusionMap,
//     }
//   )
// )
// plane.geometry.atributes.uv2 = plane.geometry.atributes.uv
// scene.add(plane)

// const earth2Geometry = new THREE.SphereGeometry(radiusOfPlanet, planetWidthSegments, planetHeightSegments, 0, Math.PI/2, 0, Math.PI/2)
// const earth2Material = new THREE.MeshPhongMaterial({
//   roughness: 1,
//   metalness: 0,
//   map: new THREE.TextureLoader().load( './textures/world.topo.200404.3x21600x21600.A1.jpg' ),
//   //map: new THREE.TextureLoader().load( './textures/bluemarble_16384.png' ),
//   //map: new THREE.TextureLoader().load( './textures/earthmap1k.jpg' ),
//   //bumpMap: new THREE.TextureLoader().load( './textures/earthbump.jpg' ),
//   //bumpScale: 1000000,
//   displacementMap: new THREE.TextureLoader().load( './textures/HighRes/EARTH_DISPLACE_42K_16BITS_preview.jpg' ),
//   displacementScale: 20000,
// })
// const earth2Mesh = new THREE.Mesh(earth2Geometry, earth2Material)
// earth2Mesh.rotation.y = -Math.PI/2  // This is needed to have the planet's texture align with the planet's Longintitude system
//earthMesh.position = 
//scene.add(earth2Mesh)

const grayMaterial = new THREE.MeshBasicMaterial({color: 0x3f3f4f})
const whiteMaterial = new THREE.MeshBasicMaterial({color: 0x5f5f5f})
const greenMaterial = new THREE.MeshLambertMaterial({color: 0x005f00})
const metalicMaterial = new THREE.MeshLambertMaterial({color: 0x878681, transparent: false})
const transparentMaterial1 = new THREE.MeshPhongMaterial( {vertexColors: true, transparent: true, opacity: 0.35})
const transparentMaterial2 = new THREE.MeshLambertMaterial({color: 0xffff80, transparent: true, opacity: 0.35})
var tetherMaterial = new THREE.LineBasicMaterial({
  vertexColors: THREE.VertexColors,
  color: 0x4897f8,     // This line doesn't seem to work
  transparent: true,
  opacity: dParamWithUnits['tetherVisibility'].value
})
var cableMaterial = new THREE.LineBasicMaterial({
  vertexColors: THREE.VertexColors,
  //color: 0x4897f8,
  transparent: true,
  opacity: dParamWithUnits['cableVisibility'].value
})

planetCoordSys.add(sunLight)
planetMeshes.forEach(mesh => {
  planetCoordSys.add(mesh)
})
planetCoordSys.add(atmosphereMesh)

if (dParamWithUnits['showEarthAxis'].value) {
  const axisGeometry = new THREE.CylinderGeometry(AxisEquatorThickness, AxisEquatorThickness, 2.5*radiusOfPlanet, 4, 1, false)
  const axisMesh = new THREE.Mesh(axisGeometry, grayMaterial)
  axisMesh.name = 'axis'
  planetCoordSys.add(axisMesh)
}

if (dParamWithUnits['showEarthEquator'].value) {
  const equatorGeometry = new THREE.TorusGeometry(radiusOfPlanet, AxisEquatorThickness, 8, 128)
  const equatorMesh = new THREE.Mesh(equatorGeometry, grayMaterial)
  equatorMesh.name = 'equator'
  equatorMesh.rotation.x = 3.1415927/2
  planetCoordSys.add(equatorMesh)
}

if (dParamWithUnits['showLaunchOrbit'].value) {
  const OrbitalAltitude = 200000 // m
  const launchOrbitGeometry = new THREE.TorusGeometry(radiusOfPlanet + OrbitalAltitude, AxisEquatorThickness, 8, 128)
  const launchOrbitMesh = new THREE.Mesh(launchOrbitGeometry, grayMaterial)
  launchOrbitMesh.name = 'launchOrbit'
  //launchOrbitMesh.setRotationFromEuler(Math.PI/2 + dParamWithUnits['ringCenterLatitude'].value - (Math.PI/2 - dParamWithUnits['equivalentLatitude'].value), Math.PI/2 + dParamWithUnits['ringCenterLongitude'].value, 0)
  launchOrbitMesh.rotateY(dParamWithUnits['ringCenterLongitude'].value)
  launchOrbitMesh.rotateX(Math.PI/2 - dParamWithUnits['ringCenterLatitude'].value + (Math.PI/2 - dParamWithUnits['equivalentLatitude'].value))
  planetCoordSys.add(launchOrbitMesh)
}

// const orbitControlsCenterMarker = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), grayMaterial)
// orbitControlsCenterMarker.name = 'orbitControlsCenterMarker'
// let orbitControlsCenterMarkerSize = 5000
// orbitControlsCenterMarker.position.x = 0
// orbitControlsCenterMarker.position.y = 0
// orbitControlsCenterMarker.position.z = -radiusOfPlanet
// orbitControlsCenterMarker.scale.x = orbitControlsCenterMarkerSize
// orbitControlsCenterMarker.scale.y = orbitControlsCenterMarkerSize
// orbitControlsCenterMarker.scale.z = orbitControlsCenterMarkerSize
// scene.add(orbitControlsCenterMarker)

// const orbitControlsSurfaceMarker = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), greenMaterial)
// orbitControlsSurfaceMarker.name = 'orbitControlsSurfaceMarker'
// let orbitControlsSurfaceMarkerSize = 50000
// orbitControlsSurfaceMarker.position.x = 0
// orbitControlsSurfaceMarker.position.y = 0
// orbitControlsSurfaceMarker.position.z = -radiusOfPlanet
// orbitControlsSurfaceMarker.scale.x = orbitControlsSurfaceMarkerSize
// orbitControlsSurfaceMarker.scale.y = orbitControlsSurfaceMarkerSize
// orbitControlsSurfaceMarker.scale.z = orbitControlsSurfaceMarkerSize
// orbitControlsSurfaceMarker.visible = false
// scene.add(orbitControlsSurfaceMarker)

// Add Some Stars
const starGeometry = new THREE.BufferGeometry()
const starVertices = []
for ( let i = 0; i < 10000;) {
  // Probably should eliminate all of the stars that are too close to the planet 
  // starVertices.push( THREE.MathUtils.randFloatSpread( 2000 * radiusOfPlanet/8 ) ) // x
  // starVertices.push( THREE.MathUtils.randFloatSpread( 2000 * radiusOfPlanet/8 ) ) // y
  // starVertices.push( THREE.MathUtils.randFloatSpread( 2000 * radiusOfPlanet/8 ) ) // z
  // Better code...
  // Create stars at random positions and then push them all 2,000,000 km away from the origin
  const XYZ = new THREE.Vector3(
    THREE.MathUtils.randFloat(-1, 1),
    THREE.MathUtils.randFloat(-1, 1),
    THREE.MathUtils.randFloat(-1, 1))
  if (XYZ.length()<=1) {
    // The random position needs to be not on the origin and also within a unit sphere
    XYZ.normalize().multiplyScalar(256 * radiusOfPlanet)
    starVertices.push(XYZ.x, XYZ.y, XYZ.z)
    i++
  }
}
starGeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( starVertices, 3 ) )
const stars = new THREE.Points( starGeometry, new THREE.PointsMaterial( { color: 0xFFFFFF } ) )
stars.name = 'stars'
planetCoordSys.add(stars)  // Todo: This might make the stars rotate with planet. Maybe need another Group...

// "Gimbal" code for the tetheredRingRefCoordSys    
const tetheredRingLonCoordSys = new THREE.Group();
tetheredRingLonCoordSys.name = "tetheredRingLonCoordSys"
planetCoordSys.add(tetheredRingLonCoordSys)
tetheredRingLonCoordSys.position.x = 0
tetheredRingLonCoordSys.position.y = 0
tetheredRingLonCoordSys.rotation.y = dParamWithUnits['ringCenterLongitude'].value

const tetheredRingLatCoordSys = new THREE.Group();
tetheredRingLatCoordSys.name = "tetheredRingLatCoordSys"
tetheredRingLonCoordSys.add(tetheredRingLatCoordSys)
tetheredRingLatCoordSys.rotation.x = -dParamWithUnits['ringCenterLatitude'].value

const tetheredRingRefCoordSys = new THREE.Group();
tetheredRingRefCoordSys.name = 'tetheredRingRefCoordSys'
tetheredRingLatCoordSys.add(tetheredRingRefCoordSys)
tetheredRingRefCoordSys.rotation.x = Math.PI/2
//tetheredRingRefCoordSys.rotation.y = Math.PI/4  // This is done so that the eccentricity adjustment is where we need it to be
// The above line puts the reference coordinate system's y-axis at lat/lon {0, 0} when RingCenterLat==0 and RingCenterLon==0
// This is needed because the ring will be centered around the coordinate system's y-axis
// We want the ring centered around the y-axis because .setFromSphericalCoords's polar angle is relative to the y-axis

// Generate the main ring
let crv = new tram.commonRingVariables(radiusOfPlanet, dParamWithUnits['ringFinalAltitude'].value, dParamWithUnits['equivalentLatitude'].value, dParamWithUnits['ringAmountRaisedFactor'].value)
let ecv = new tram.elevatorCarVariables(gravitationalConstant, massOfPlanet, radiusOfPlanet, dParamWithUnits, crv)
let tvv = new tram.transitVehicleVariables(gravitationalConstant, massOfPlanet, radiusOfPlanet, dParamWithUnits, crv)

const mainRingCurveLineMeshes = []
let ringCurve
constructMainRingCurve()

function constructMainRingCurve() {
  const controlPoints = []

  const e = dParamWithUnits['ringEccentricity'].value
  for (let a = 0, i = 0; i<dParamWithUnits['numControlPoints'].value; a+=Math.PI*2/dParamWithUnits['numControlPoints'].value, i++) {
    const angleInRingCoordSys = Math.acos(crv.mainRingRadius / (radiusOfPlanet+crv.currentMainRingAltitude)) * Math.sqrt((e*Math.cos(a))**2 + (1/e*Math.sin(a))**2)
    const rInRingCoordSys = (radiusOfPlanet+crv.currentMainRingAltitude) * Math.cos(angleInRingCoordSys)
    const yInRingCoordSys = (radiusOfPlanet+crv.currentMainRingAltitude) * Math.sin(angleInRingCoordSys)
    const xInRingCoordSys = rInRingCoordSys * Math.cos(a)
    const zInRingCoordSys = rInRingCoordSys * Math.sin(a)
    controlPoints.push(new THREE.Vector3(xInRingCoordSys, yInRingCoordSys, zInRingCoordSys))
  }

  ringCurve = new THREE.CatmullRomCurve3(controlPoints)
  ringCurve.curveType = 'centripetal'
  ringCurve.closed = true
  ringCurve.tension = 0
  let points
  if (dParamWithUnits['showMainRingCurve'].value || genKMLFile) {
    const numPointsOnMainRingCurve = 8192
    points = ringCurve.getPoints( numPointsOnMainRingCurve )
  }

  if (dParamWithUnits['showMainRingCurve'].value) {
    // Debug - Draw a loop along the curve to check that it is correctly positioned
    const mainRingCurveLineMesh = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints( points ),
      new THREE.LineBasicMaterial( { color: 0x00ff00 } )
    )
    mainRingCurveLineMeshes.name = 'mainRingCurveLine'
    mainRingCurveLineMeshes.push(mainRingCurveLineMesh)
    mainRingCurveLineMeshes.forEach(mesh => tetheredRingRefCoordSys.add(mesh))
  }

  if (genKMLFile) {
    //KML file placemark creation code for the ring and elevator cables.
    kmlFile = kmlFile.concat(kmlutils.kmlMainRingPlacemarkHeader)
    let xyzWorld, xyzPlanet
    let coordString, firstCoordString

    planetCoordSys.updateWorldMatrix(true)
    tetheredRingLonCoordSys.updateMatrixWorld(true)
    tetheredRingLatCoordSys.updateMatrixWorld(true)
    tetheredRingRefCoordSys.updateMatrixWorld(true)
    points.forEach((point, i) => {
      xyzWorld = tetheredRingRefCoordSys.localToWorld(point.clone())
      xyzPlanet = planetCoordSys.worldToLocal(xyzWorld.clone())
      const lla = tram.xyz2lla(xyzPlanet.x, xyzPlanet.y, xyzPlanet.z)
      coordString = '          ' + Math.round(lla.lon*10000000)/10000000 + ',' + Math.round(lla.lat*10000000)/10000000 + ',' + Math.round(Math.abs(lla.alt)*1000)/1000 + '\n'
      if (i==0) {
        firstCoordString = coordString
      }
      kmlFile = kmlFile.concat(coordString)
    })
    kmlFile = kmlFile.concat(firstCoordString)  // We need to repeat the first coordinate to close the loop
    kmlFile = kmlFile.concat(kmlutils.kmlPlacemarkFooter)
  }
}

const numWedges = 64   // Wedges are used to keep points within meshes from becoming too spread out, losing precision, and then starting to jitter
let start, end

console.log("V6")

const mainRingMeshes = []
constructMainRings()
function constructMainRings() {
  if (dParamWithUnits['showMainRings'].value) {
    console.log("Constructing Main Rings")
    let mainRingGeometries = []
    const mro = (dParamWithUnits['numMainRings'].value - 1)/2
    const referencePoint = new THREE.Vector3()

    for (let j = 0; j<numWedges; j++) {
      start = j / numWedges
      end = (j+1) / numWedges
      referencePoint.copy( ringCurve.getPointAt( (start+end)/2 ) )

      for (let i = 0; i<dParamWithUnits['numMainRings'].value; i++) {
        mainRingGeometries[i] = new mainRingTubeGeometry(ringCurve, start, end, referencePoint, 8192/numWedges, (i-mro) * dParamWithUnits['mainRingSpacing'].value, dParamWithUnits['mainRingTubeRadius'].value)
      }
      const mainRingMesh = new THREE.Mesh(BufferGeometryUtils.mergeBufferGeometries( mainRingGeometries ), metalicMaterial)
      mainRingMesh.name = 'mainRing'
      mainRingMesh.position.copy(referencePoint)
      mainRingMeshes.push(mainRingMesh)
    }
    mainRingMeshes.forEach(mesh => tetheredRingRefCoordSys.add(mesh))
  }
}

const transitSystemMeshes = []
const trackOffsetsList = [[-0.33, 0.45], [0.33, 0.45], [-0.33, -0.12], [0.33, -0.12]]

constructTransitSystem()
function constructTransitSystem() {
  if (dParamWithUnits['showTransitSystem'].value) {
    console.log("Constructing Transit System")
    // Add the transit tube
    // crv.y0, crv.yc, and crv.yf are the initial, current, and final distances between the center of the earth and the center of mass of the moving rings.
    const transitTube_r = crv.mainRingRadius + tram.offset_r(dParamWithUnits['transitTubeOutwardOffset'].value, dParamWithUnits['transitTubeUpwardOffset'].value, crv.currentEquivalentLatitude)
    const transitTube_y = crv.yc + tram.offset_y(dParamWithUnits['transitTubeOutwardOffset'].value, dParamWithUnits['transitTubeUpwardOffset'].value, crv.currentEquivalentLatitude)

    const trackHalfWidth = 0.2
    const trackHalfHeight = 0.05
    const referencePoint = new THREE.Vector3()
    let outwardOffset = [], upwardOffset = []
    for (let i = 0; i<trackOffsetsList.length; i++) {
      outwardOffset[i] = dParamWithUnits['transitTubeOutwardOffset'].value + trackOffsetsList[i][0] * dParamWithUnits['transitTubeTubeRadius'].value 
      upwardOffset[i] = dParamWithUnits['transitTubeUpwardOffset'].value + trackOffsetsList[i][1] * dParamWithUnits['transitTubeTubeRadius'].value
    }
    for (let j = 0; j<numWedges; j++) {
      start = j / numWedges
      end = (j+1) / numWedges
      referencePoint.copy( ringCurve.getPointAt( (start+end)/2 ) )

      for (let i = 0; i<dParamWithUnits['numMainRings'].value; i++) {
        const mainRingGeometry = new transitTubeGeometry(ringCurve, start, end, referencePoint, 8192/numWedges, dParamWithUnits['transitTubeOutwardOffset'].value, dParamWithUnits['transitTubeUpwardOffset'].value, dParamWithUnits['transitTubeTubeRadius'].value)
        const mainRingMesh = new THREE.Mesh(mainRingGeometry, metalicMaterial)
        mainRingMesh.position.copy(referencePoint)
        mainRingMeshes.push( mainRingMesh )
      }

      const tubeGeometry = new transitTubeGeometry(ringCurve, start, end, referencePoint, 8192/numWedges, dParamWithUnits['transitTubeOutwardOffset'].value, dParamWithUnits['transitTubeUpwardOffset'].value, dParamWithUnits['transitTubeTubeRadius'].value)
      const transitTubeMesh = new THREE.Mesh(tubeGeometry, transparentMaterial1)
      transitTubeMesh.position.copy(referencePoint)
      transitSystemMeshes.push( transitTubeMesh )

      // Add four tracks inside the transit tube
      for (let i = 0; i<trackOffsetsList.length; i++) {
        const trackGeometry = new transitTrackGeometry(ringCurve, start, end, referencePoint, 8192/numWedges, outwardOffset[i], upwardOffset[i], trackHalfWidth, trackHalfHeight)
        const transitTrackMesh = new THREE.Mesh(trackGeometry, metalicMaterial)
        transitTrackMesh.position.copy(referencePoint)
        transitSystemMeshes.push( transitTrackMesh )
      }
    }
    transitSystemMeshes.forEach(mesh => tetheredRingRefCoordSys.add(mesh))
  }
}

const transitVehicleMeshes = []
constructTransitVehicles()

function constructTransitVehicles() {
  if (dParamWithUnits['showTransitSystem'].value && dParamWithUnits['showTransitVehicles'].value) {
    console.log("Constructing Transit Vehicles")
    const C_D = dParamWithUnits['transitVehicleCoefficientOfDrag'].value
    const P = dParamWithUnits['transitTubeInteriorPressure'].value
    const MW = dParamWithUnits['transitTubeInteriorGasMolecularWeight'].value
    const T = dParamWithUnits['transitTubeInteriorTemperature'].value
    const ρ = P * MW / (T+273.15) / idealGasConstant
    specs['transitTubeInteriorGasDensity'] = {value: ρ, units: "kg*m-3"}
    const A = Math.PI * dParamWithUnits['transitVehicleRadius'].value**2
    const V = dParamWithUnits['transitVehicleCruisingSpeed'].value
    const F = C_D * ρ * A * V**2
    specs['transitVehicleAerodynamicDragForce'] = {value: F, units: "N"}
    const η = dParamWithUnits['transitSystemEfficiencyAtCruisingSpeed'].value
    specs['transitVehiclePowerConsumptionWhenCruising'] = {value: F * V / η, units: "W"}

    const loader = new GLTFLoader()
    loader.load('models/TransitCar.glb', addTransitVehicles,
      // called when loading is in progresses
      function ( xhr ) {
        console.log( ( xhr.loaded / xhr.total * 100 ) + '% transit car loaded' );
      },
      // called when loading has errors
      function ( error ) {
        console.log( 'An error happened', error );
      }
    )
    
    function addTransitVehicles({ scene }) {
      // Add Transit Vehicles
      
      const object = scene.children[0]
      //object.visible = false
      for (let a = 0, j = 0; j<dParamWithUnits['numTransitVehicles'].value; a+=Math.PI*2/dParamWithUnits['numTransitVehicles'].value, j++) {
        for (let i = 0; i<trackOffsetsList.length; i++) {
          const outwardOffset = dParamWithUnits['transitTubeOutwardOffset'].value + trackOffsetsList[i][0] * dParamWithUnits['transitTubeTubeRadius'].value
          const upwardOffset = dParamWithUnits['transitTubeUpwardOffset'].value + trackOffsetsList[i][1] * dParamWithUnits['transitTubeTubeRadius'].value - dParamWithUnits['transitVehicleRadius'].value - 0.35  // Last is half of the track height
          transitVehicleMeshes.push(makeTransitVehicleMesh(object, outwardOffset, upwardOffset, a, i))
        }
      }

      function makeTransitVehicleMesh(object, outwardOffset, upwardOffset, a, i) {
        //const transitVehicleGeometry = new THREE.CylinderGeometry(dParamWithUnits['transitVehicleRadius'].value, dParamWithUnits['transitVehicleRadius'].value, dParamWithUnits['transitVehicleLength'].value, 64, 1)
        //const transitVehicleMesh = new THREE.Mesh(transitVehicleGeometry, metalicMaterial)
        const transitVehicleMesh = object.clone()
        computeTransitVehiclePositionAndRotation(transitVehicleMesh, outwardOffset, upwardOffset, a, 0)
        transitVehicleMesh.userData = {'a': a, 'i': i}
        return transitVehicleMesh
      }

      transitVehicleMeshes.forEach(mesh => tetheredRingRefCoordSys.add(mesh))
    }
  }
}

function computeTransitVehiclePositionAndRotation(transitVehicleMesh, outwardOffset, upwardOffset, a, d) {
  const transitVehiclePosition_r = crv.mainRingRadius + tram.offset_r(outwardOffset, upwardOffset, crv.currentEquivalentLatitude)
  const a2 = a + d/transitVehiclePosition_r
  transitVehicleMesh.position.set(transitVehiclePosition_r * Math.cos(a2), crv.yc + tram.offset_y(outwardOffset, upwardOffset, crv.currentEquivalentLatitude), transitVehiclePosition_r * Math.sin(a2))
  transitVehicleMesh.rotation.set(0, -a2, crv.currentEquivalentLatitude)
  transitVehicleMesh.rotateZ(-Math.PI/2)
}

const launchTubeMeshes = []
function constructLaunchTube() {
  // Add the launch tube
  // crv.y0, crv.yc, and crv.yf are the initial, current, and final distances between the center of the earth and the center of mass of the moving rings.
  const launchTubeOutwardOffset = 10
  const launchTubeRadius = crv.mainRingRadius + tram.offset_r(launchTubeOutwardOffset, -dParamWithUnits['launchTubeUpwardOffset'].value, crv.currentEquivalentLatitude)
  const launchTube_y = crv.yc + tram.offset_y(launchTubeOutwardOffset, -dParamWithUnits['launchTubeUpwardOffset'].value, crv.currentEquivalentLatitude)
  const launchTubeArc = dParamWithUnits['launchTubeLength'].value/(2*Math.PI*launchTubeRadius)*2*Math.PI
  
  const launchTubeTubeRadius = 10000
  const launchTubeRadialSegments = 8
  const launchTubeTubularSegments = 1024
  const launchTubeGeometry = new THREE.TorusGeometry(launchTubeRadius, launchTubeTubeRadius, launchTubeRadialSegments, launchTubeTubularSegments, launchTubeArc)
  const launchTubeMesh = new THREE.Mesh(launchTubeGeometry, transparentMaterial1)
  launchTubeMesh.rotation.x = Math.PI/2      // We need a torus that sits on the x-z plane because .setFromSphericalCoords's polar angle is reletive to the y-axis
  launchTubeMesh.rotation.z = Math.PI/2      // We need a torus that sits on the x-z plane because .setFromSphericalCoords's polar angle is reletive to the y-axis
  launchTubeMesh.position.y = launchTube_y
  launchTubeMeshes.push(launchTubeMesh)

  // Add four tracks inside the transit tube
  // These really need to be a more like a ribbon with a rectangular cross-section but to do that I will need to implement a custom geometry. For now, torus geometry...
  function makeTrackMesh(outwardOffset, upwardOffset, width, height, launchTubeRadius, launchTubePosition_y, currentEquivalentLatitude) {
    const trackInnerRadius = launchTubeRadius + tram.offset_r(outwardOffset - width/2, upwardOffset - height/2, crv.currentEquivalentLatitude)
    const trackOuterRadius = launchTubeRadius + tram.offset_r(outwardOffset + width/2, upwardOffset - height/2, crv.currentEquivalentLatitude)
    const thetaSegments = 1024
    //const trackGeometry = new THREE.RingGeometry(trackInnerRadius, trackOuterRadius, thetaSegments)
    const trackGeometry = new THREE.TorusGeometry((trackInnerRadius + trackOuterRadius)/2, width, 8, thetaSegments, launchTubeArc)
    const launchTrackMesh = new THREE.Mesh(trackGeometry, metalicMaterial)
    launchTrackMesh.rotation.x = Math.PI/2
    launchTrackMesh.position.y = launchTubePosition_y + tram.offset_y(outwardOffset, upwardOffset, crv.currentEquivalentLatitude)
    return launchTrackMesh
  }
  
  const trackWidth = 0.5
  const trackHeight = 0.2
  const launcherTrackOffsetsList = [[-0.45, 0.8], [0.45, 0.8]]
  for (let i = 0; i<launcherTrackOffsetsList.length; i++) {
    let outwardOffset = launcherTrackOffsetsList[i][0] * launchTubeTubeRadius 
    let upwardOffset = launcherTrackOffsetsList[i][1] * launchTubeTubeRadius
    launchTubeMeshes.push(makeTrackMesh(outwardOffset, upwardOffset, trackWidth, trackHeight, launchTubeRadius, launchTubeMesh.position.y, crv.currentEquivalentLatitude))
  }
  launchTubeMeshes.forEach(mesh => tetheredRingRefCoordSys.add(mesh))
}
// Create the launch sytem
if (dParamWithUnits['showLaunchTubes'].value) {
  console.log("Constructing Launch Tube")
  constructLaunchTube()
}

const elevatorCableMeshes = []
constructElevatorCables()
function constructElevatorCables() {
  if (dParamWithUnits['showElevatorCables'].value) {
    console.log("Constructing Elevator Cables")
    
    // Add elevator cables
    // crv.y0, crv.yc, and crv.yf are the initial, current, and final distances between the center of the earth and the center of mass of the moving rings.
    const cableOutwardOffset = dParamWithUnits['transitTubeOutwardOffset'].value - dParamWithUnits['transitTubeTubeRadius'].value + dParamWithUnits['elevatorCableOutwardOffset'].value
    const elevatorCableUpperAttachPnt_r = crv.mainRingRadius + tram.offset_r(cableOutwardOffset, dParamWithUnits['transitTubeUpwardOffset'].value + dParamWithUnits['additionalUpperElevatorCable'].value, crv.currentEquivalentLatitude)
    const elevatorCableUpperElevatorTerminus_r = crv.mainRingRadius + tram.offset_r(cableOutwardOffset, dParamWithUnits['transitTubeUpwardOffset'].value, crv.currentEquivalentLatitude)
    const elevatorCableLowerAttachPnt_r = crv.mainRingRadius + tram.offset_r(cableOutwardOffset, -crv.currentMainRingAltitude, crv.currentEquivalentLatitude)
    const elevatorCableUpperAttachPnt_y = crv.yc + tram.offset_y(cableOutwardOffset, dParamWithUnits['transitTubeUpwardOffset'].value + dParamWithUnits['additionalUpperElevatorCable'].value, crv.currentEquivalentLatitude)
    const elevatorCableUpperElevatorTerminus_y = crv.yc + tram.offset_y(cableOutwardOffset, dParamWithUnits['transitTubeUpwardOffset'].value, crv.currentEquivalentLatitude)
    const elevatorCableLowerAttachPnt_y = crv.yc + tram.offset_y(cableOutwardOffset, -crv.currentMainRingAltitude, crv.currentEquivalentLatitude)
    //const elevatorCableTubeRadius = 1000.01
    //const elevatorCableTubularSegments = 8 

    const upperElevatorTerminusLength = 2*(-dParamWithUnits['elevatorCableOutwardOffset'].value)
    const upperElevatorTerminusWidth = 20
    const upperElevatorTerminusThickness = 10 
    const upperElevatorTerminusGeometry = new THREE.BoxGeometry(upperElevatorTerminusLength, upperElevatorTerminusThickness, upperElevatorTerminusWidth)
    const upperElevatorTerminusMesh = new THREE.Mesh(upperElevatorTerminusGeometry, transparentMaterial2)

    // planetCoordSys.updateWorldMatrix(true)
    // tetheredRingLonCoordSys.updateMatrixWorld(true)
    // tetheredRingLatCoordSys.updateMatrixWorld(true)
    // tetheredRingRefCoordSys.updateMatrixWorld(true)

    const n = dParamWithUnits['numElevatorCables'].value
    const wedgeReferencePoints = Array(numWedges)
    for (let wedgeIndex = 0; wedgeIndex<numWedges; wedgeIndex++) {
      wedgeReferencePoints[wedgeIndex] = new THREE.Vector3()
      wedgeReferencePoints[wedgeIndex].copy( ringCurve.getPointAt( (wedgeIndex+0.5) / numWedges ) )
      ringCurve.getPointAt( (wedgeIndex+0.5) / numWedges )
    }
    const pointSets = Array(numWedges).fill().map(entry => [])  // declare an array of empty arrays for storing points
    for (let a = 0, i = 0; i<n; a+=Math.PI*2/n, i++) {
      const wedgeIndex = Math.floor(i * numWedges / n)

      const elevatorCableUpperAttachPnt = new THREE.Vector3(
        elevatorCableUpperAttachPnt_r * Math.cos(a),
        elevatorCableUpperAttachPnt_y,
        elevatorCableUpperAttachPnt_r * Math.sin(a)
      )
      const elevatorCableLowerAttachPnt = new THREE.Vector3(
        elevatorCableLowerAttachPnt_r * Math.cos(a),
        elevatorCableLowerAttachPnt_y,
        elevatorCableLowerAttachPnt_r * Math.sin(a)
      )

      // For performance reasons, within each wedge all of the elevator cables are collected into a single geometry  
      const wedgeReferencePoint = wedgeReferencePoints[wedgeIndex]
      pointSets[wedgeIndex].push(elevatorCableUpperAttachPnt.sub(wedgeReferencePoint))
      pointSets[wedgeIndex].push(elevatorCableLowerAttachPnt.sub(wedgeReferencePoint))
      // Now create an array of two points use that to make a LineSegment Geometry
      //tempGeometry.setAttribute("color", new THREE.Float32BufferAttribute(0x0000ff, 3) )
          }
    for (let wedgeIndex = 0; wedgeIndex<numWedges; wedgeIndex++) {
      const pointSet = pointSets[wedgeIndex]
      const elevatorCableMesh =  new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pointSet), cableMaterial)
      pointSet.splice(0, pointSet.length)  // Empty the array
      elevatorCableMesh.position.copy(wedgeReferencePoints[wedgeIndex])
      elevatorCableMeshes.push(elevatorCableMesh)
    }
    elevatorCableMeshes.forEach(mesh => tetheredRingRefCoordSys.add(mesh))
  }
}

let elevatorAltitude = (crv.currentMainRingAltitude+dParamWithUnits['transitTubeUpwardOffset'].value) - 20
const elevatorCarMeshes = []
constructElevatorCars()
function constructElevatorCars() {
  if (dParamWithUnits['showElevatorCars'].value) {  
    console.log("Constructing Elevator Cars")
    
    //const loader = new OBJLoader()
    const loader = new FBXLoader()//
    loader.load(
      //'models/ElevatorPod.obj',
      'models/Elevator.fbx',
      addCars,
      // called when loading is in progresses
      function ( xhr ) {
        console.log( ( xhr.loaded / xhr.total * 100 ) + '% elevator car loaded' )
      },
      // called when loading has errors
      function ( error ) {
        console.log( 'An error happened' )
      }
    )
    
    function addCars(object) {
      // Add elevator Cars
      // crv.y0, crv.yc, and crv.yf are the initial, current, and final distances between the center of the earth and the center of mass of the moving rings.
      const cableOutwardOffset = dParamWithUnits['transitTubeOutwardOffset'].value - dParamWithUnits['transitTubeTubeRadius'].value + dParamWithUnits['elevatorCableOutwardOffset'].value
      const elevatorCarPosition_r = crv.mainRingRadius + tram.offset_r(cableOutwardOffset, elevatorAltitude-crv.currentMainRingAltitude, crv.currentEquivalentLatitude)
      const elevatorCarPosition_y = crv.yc + tram.offset_y(cableOutwardOffset, elevatorAltitude-crv.currentMainRingAltitude, crv.currentEquivalentLatitude)

      //const elevatorCarMesh = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 10, 16), metalicMaterial)
      const elevatorCarMesh = object
      //elevatorCarMesh.scale.set(0.01, 0.01, 0.01)
        
      for (let a = 0, i = 0; i<dParamWithUnits['numElevatorCars'].value; a+=Math.PI*2/dParamWithUnits['numElevatorCars'].value, i++) {
        const elevatorCarPosition = new THREE.Vector3(
          elevatorCarPosition_r * Math.cos(a),
          elevatorCarPosition_y,
          elevatorCarPosition_r * Math.sin(a)
        )
        
        // Add elevator car
        elevatorCarMesh.position.set(elevatorCarPosition.x, elevatorCarPosition.y, elevatorCarPosition.z)
        elevatorCarMesh.rotation.x = 0
        elevatorCarMesh.rotation.y = -a
        elevatorCarMesh.rotation.z = crv.currentEquivalentLatitude - Math.PI/2
        elevatorCarMesh.userData = a
        elevatorCarMeshes.push(elevatorCarMesh.clone())
      }
      elevatorCarMeshes.forEach(mesh => tetheredRingRefCoordSys.add(mesh))
    }
  }
}

const terminusMeshes = []
constructTerminuses()
function constructTerminuses() {
  if (dParamWithUnits['showTerminuses'].value) {  
    console.log("Constructing Trminuses")
    
    //const loader = new OBJLoader()
    const loader = new FBXLoader()//
    loader.load(
      'models/TransitTerminus.fbx',
      //'models/Elevator.fbx',
      addTerminuses,
      // called when loading is in progresses
      function ( xhr ) {
        console.log( ( xhr.loaded / xhr.total * 100 ) + '% terminus loaded' )
      },
      // called when loading has errors
      // function ( error ) {
      //   console.log( 'An error happened' )
      // }
    )
    
    function addTerminuses(object) {
      // Add Transit Terminuses
      // crv.y0, crv.yc, and crv.yf are the initial, current, and final distances between the center of the earth and the center of mass of the moving rings.
      const terminusOutwardOffset = dParamWithUnits['transitTubeOutwardOffset'].value - dParamWithUnits['transitTubeTubeRadius'].value + dParamWithUnits['terminusOutwardOffset'].value
      const terminusUpwardOffset = dParamWithUnits['transitTubeUpwardOffset'].value + dParamWithUnits['terminusUpwardOffset'].value
      const terminusPosition_r = crv.mainRingRadius + tram.offset_r(terminusOutwardOffset, terminusUpwardOffset, crv.currentEquivalentLatitude)
      const terminusPosition_y = crv.yc + tram.offset_y(terminusOutwardOffset, terminusUpwardOffset, crv.currentEquivalentLatitude)
      
      //const terminusMesh = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 10, 16), metalicMaterial)
      const terminusMesh = object
      //terminusMesh.scale.set(0.01, 0.01, 0.01)
        
      for (let a = 0, i = 0; i<dParamWithUnits['numTerminuses'].value; a+=Math.PI*2/dParamWithUnits['numTerminuses'].value, i++) {
        const terminusPosition = new THREE.Vector3(
          terminusPosition_r * Math.cos(a),
          terminusPosition_y,
          terminusPosition_r * Math.sin(a)
        )
        
        // Add terminus
        terminusMesh.position.set(terminusPosition_r * Math.cos(a), terminusPosition_y, terminusPosition_r * Math.sin(a))
        terminusMesh.rotation.set(0, -a, crv.currentEquivalentLatitude)
        terminusMesh.rotateZ(-Math.PI/2)
        terminusMesh.rotateY(-Math.PI/2)

        //terminusMesh.position.set(terminusPosition.x, terminusPosition.y, terminusPosition.z)
        // terminusMesh.rotation.x = 0
        // terminusMesh.rotation.y = -a
        // terminusMesh.rotation.z = crv.currentEquivalentLatitude - Math.PI/2
        terminusMeshes.push(terminusMesh.clone())
      }
      terminusMeshes.forEach(mesh => tetheredRingRefCoordSys.add(mesh))

      // function computeTransitVehiclePositionAndRotation(transitVehicleMesh, outwardOffset, upwardOffset, a, d) {
      //   const transitVehiclePosition_r = crv.mainRingRadius + tram.offset_r(outwardOffset, upwardOffset, crv.currentEquivalentLatitude)
      //   const a2 = a + d/transitVehiclePosition_r
      //   transitVehicleMesh.position.set(transitVehiclePosition_r * Math.cos(a2), crv.yc + tram.offset_y(outwardOffset, upwardOffset, crv.currentEquivalentLatitude), transitVehiclePosition_r * Math.sin(a2))
      //   transitVehicleMesh.rotation.set(0, -a2, crv.currentEquivalentLatitude)
      //   transitVehicleMesh.rotateZ(-Math.PI/2)
      // }
      

      // const elevatorCableUpperElevatorTerminus = new THREE.Vector3(
      //   elevatorCableUpperElevatorTerminus_r * Math.cos(a),
      //   elevatorCableUpperElevatorTerminus_y,
      //   elevatorCableUpperElevatorTerminus_r * Math.sin(a)
      // )
      // Add platforms at the top and bottom of each the elevator cable 
      // upperElevatorTerminusMesh.rotation.x = 0
      // upperElevatorTerminusMesh.rotation.y = -a
      // upperElevatorTerminusMesh.rotation.z = crv.currentEquivalentLatitude - Math.PI/2
      // upperElevatorTerminusMesh.position.set(elevatorCableUpperElevatorTerminus.x, elevatorCableUpperElevatorTerminus.y, elevatorCableUpperElevatorTerminus.z)
      // elevatorCableMeshes.push(upperElevatorTerminusMesh.clone())
      // // For the lower terminus, just duplicating the upperElevatorTerminus for now
      // upperElevatorTerminusMesh.position.set(elevatorCableLowerAttachPnt.x, elevatorCableLowerAttachPnt.y, elevatorCableLowerAttachPnt.z)
      // elevatorCableMeshes.push(upperElevatorTerminusMesh.clone())

    }
  }
}


// Tethers
const tethers = []
constructTethers()
function constructTethers() {
  if (dParamWithUnits['showTethers'].value) {
    console.log("Constructing Tethers")
    const tetherGeometry = new TetherGeometry(radiusOfPlanet, gravitationalConstant, massOfPlanet, crv, dParamWithUnits, specs, fastTetherRender, genKMLFile, kmlFile)
    const tempTetherMesh = new THREE.LineSegments(tetherGeometry, tetherMaterial)
    if (fastTetherRender) {
      const n = dParamWithUnits['numTethers'].value
      const k = 2 * Math.PI * 2 / n
      for (let i=0; i<n/2; i++) {     // Really should be currentCatenaryTypes.length, but that value is hidden from us here
        const θ = i * k
        const referencePoint = new THREE.Vector3().setFromSphericalCoords(radiusOfPlanet + crv.currentMainRingAltitude, -(Math.PI/2 - crv.currentEquivalentLatitude), θ)
        tempTetherMesh.position.copy(referencePoint)
        tempTetherMesh.rotation.y = θ
        tethers[i] = tempTetherMesh.clone()
        tetheredRingRefCoordSys.add(tethers[i])
      }
    }
    else {
      tethers[0] = tempTetherMesh.clone()
      tetheredRingRefCoordSys.add(tethers[0])
    }
  }
}

if (dParamWithUnits['showLaunchTrajectory'].value) {
  // Launch Trajectory Line
  const l = new launcher.launcher()
  const angleFromNorthPole = (Math.PI/2 - dParamWithUnits['ringCenterLatitude'].value + (Math.PI/2 - crv.currentEquivalentLatitude))
  const launcherExitPosition = new THREE.Vector3().setFromSphericalCoords(
    radiusOfPlanet + crv.currentMainRingAltitude,
    angleFromNorthPole,
    dParamWithUnits['ringCenterLongitude'].value
  )

  const launcherExitMarker = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), greenMaterial)
  let launcherExitMarkerSize = 1000
  launcherExitMarker.position.copy(launcherExitPosition)
  launcherExitMarker.scale.set(launcherExitMarkerSize, launcherExitMarkerSize, launcherExitMarkerSize)
  planetCoordSys.add(launcherExitMarker)

  l.Update()
  let ADandV
  ADandV = l.GetAltitudeDistanceAndVelocity(0)
  //const displacement = new THREE.Vector3(0, 0, 0)
  //let distanceTraveledInsideTube = 0
  //let distanceTraveledOutsideTube = 0
  //let angularDistance = (distanceTraveledInsideTube-dParamWithUnits['launchTubeLength'].value)/crv.mainRingRadius
  //let prevVehiclePostion = new THREE.Vector3(crv.mainRingRadius * Math.sin(angularDistance), crv.yf, crv.mainRingRadius * Math.cos(angularDistance))

  let t = 0
  let prevVehiclePostion = new THREE.Vector3(
    (l.R_Earth + ADandV.Altitude) * Math.sin(ADandV.Distance/(l.R_Earth + ADandV.Altitude)),
    crv.yf,
    (l.R_Earth + ADandV.Altitude) * Math.cos(ADandV.Distance/(l.R_Earth + ADandV.Altitude)))
  let currVehiclePostion  = new THREE.Vector3(0, 0, 0)
  const color = new THREE.Color()
  const launchTrajectoryPoints = []
  const launchTrajectoryColors = []

  for (t=1; t<3*dParamWithUnits['launchTubeAccelerationTime'].value; t++) {
    // distanceTraveledInsideTube = 0.5 * dParamWithUnits['launchTubeAcceleration'].value * t**2
    // distanceTraveledOutsideTube = Math.max(0, dParamWithUnits['launchTubeExitVelocity'].value * (t - dParamWithUnits['launchTubeAccelerationTime'].value))
    // angularDistance = Math.min(0, (distanceTraveledInsideTube-dParamWithUnits['launchTubeLength'].value)/crv.mainRingRadius)
    // currVehiclePostion = new THREE.Vector3(
    //   crv.mainRingRadius * Math.sin(angularDistance) + distanceTraveledOutsideTube,
    //   crv.yf,
    //   crv.mainRingRadius * Math.cos(angularDistance))
    //displacement.add()
    //currVehiclePostion = prevVehiclePostion.clone().add(displacement)
    //console.log(prevVehiclePostion, currVehiclePostion)

    ADandV = l.GetAltitudeDistanceAndVelocity(t)
    currVehiclePostion = new THREE.Vector3(
      (l.R_Earth + ADandV.Altitude) * Math.sin(ADandV.Distance/(l.R_Earth + ADandV.Altitude)),
      crv.yf,
      (l.R_Earth + ADandV.Altitude) * Math.cos(ADandV.Distance/(l.R_Earth + ADandV.Altitude)))
    
    launchTrajectoryPoints.push(prevVehiclePostion)
    launchTrajectoryPoints.push(currVehiclePostion)
    prevVehiclePostion = currVehiclePostion.clone()
    color.setHSL(0.5 , 0.5, 1.0 * ((t%10==9) || (t%60==58)))   // Draw line with thick and thin tick marks
    launchTrajectoryColors.push(color.r, color.g, color.b)
    launchTrajectoryColors.push(color.r, color.g, color.b)
    
    const currentAltitude = 32000
    const airDensity = l.GetAirDensity(currentAltitude)
    const vehicleVelocity = 8000  // ToDo
    const vehicleCrossSectionalArea = Math.PI * dParamWithUnits['launchVehicleRadius'].value**2
    const forceOfDrag = dParamWithUnits['launchVehicleCoefficientOfDrag'].value * airDensity * vehicleCrossSectionalArea * vehicleVelocity**2
    const powerToOvercomeDrag = forceOfDrag * vehicleVelocity

  }

  const launchTrajectoryGeometry = new THREE.BufferGeometry().setFromPoints(launchTrajectoryPoints)
  launchTrajectoryGeometry.setAttribute( 'color', new THREE.Float32BufferAttribute( launchTrajectoryColors, 3 ) );

  var launchTrajectoryMaterial = new THREE.LineBasicMaterial({
    vertexColors: THREE.VertexColors,
    transparent: true,
    opacity: dParamWithUnits['launchTrajectoryVisibility'].value
  })
  const launchTrajectoryMesh = new THREE.LineSegments(launchTrajectoryGeometry, launchTrajectoryMaterial)
  tetheredRingRefCoordSys.add( launchTrajectoryMesh )
  //planetCoordSys.add( launchTrajectoryMesh )
  // End Launch Trajectory Line
}

calculateAdditionalSpecs()
function calculateAdditionalSpecs() {
  const transitTube_r = crv.mainRingRadius + tram.offset_r(dParamWithUnits['transitTubeOutwardOffset'].value, dParamWithUnits['transitTubeUpwardOffset'].value, crv.currentEquivalentLatitude)
  const transitTubeSurfaceArea = (2 * Math.PI * dParamWithUnits['transitTubeTubeRadius'].value) * (2 * Math.PI * transitTube_r)
  const transitTubeInteriorVolume = (Math.PI * dParamWithUnits['transitTubeTubeRadius'].value**2) * (2 * Math.PI * transitTube_r)
  specs['transitTubeSurfaceArea'] = {value: transitTubeSurfaceArea, units: "m2"}
  specs['transitTubeInteriorVolume'] = {value: transitTubeInteriorVolume, units: "m3"}

  // Calculate equivalent space elevator mass and cost
  let T
  for (let f = 0; f<1; f++) {
    T = dParamWithUnits['tetherMaterialTensileStrength'].value*1000000 / dParamWithUnits['tetherEngineeringFactor'].value
    T *= 2**f
    const hoursInSiderealDay = 23.9344696
  	const ClimberEmptyMass = 1000 //kg
    const ClimberPayloadMass = 19000 //kg
    const ClimberFuelMass = 100 //kg
    const ClimberInitialAltitude = 0 // m
    const ClimberMaxAccelleration = 9.8 // m/s2
    const ClimberTotalMass = ClimberEmptyMass + ClimberPayloadMass + ClimberFuelMass
    const GravityForce = (gravitationalConstant * ClimberTotalMass * massOfPlanet) / (radiusOfPlanet + ClimberInitialAltitude)**2
    const CentripetalForce = -ClimberTotalMass * (2 * Math.PI * (radiusOfPlanet + ClimberInitialAltitude) / (hoursInSiderealDay * 3600))**2 / (radiusOfPlanet + ClimberInitialAltitude)
    const LowerTerminusAnchoringForce = 10000 // N
    const TotalLoadForce = GravityForce + CentripetalForce + ClimberMaxAccelleration * ClimberTotalMass + LowerTerminusAnchoringForce
    const A_s = TotalLoadForce / (T*1000000)
    const ρ = dParamWithUnits['tetherMaterialDensity'].value
    const R = radiusOfPlanet
    const R_g = R+35786000 //m
    const R_a = R_g * 2
    const g = 9.8  // m/s2
    const step = 1
    let r
    let A
    let V
    V = 0
    let A_prev = A_s
    console.log(A_s, T)
    for (r = R+step; r<R_a; r+=step) {
      A = A_s * Math.exp(ρ*g*R**2/T*(1/R + R**2/2/R_g**3 - 1/r - r**2/2/R_g**3))
      V += (A_prev + A)/2 * step
      A_prev = A
    }
    const M = V * ρ
    const spaceElevatorCost = M * dParamWithUnits['tetherMaterialCost'].value
    console.log("Difference: "+M/1118123379.2339551)
    console.log(f, V, M, spaceElevatorCost, spaceElevatorCost / (ClimberPayloadMass/g))

    if (f==1) {
      specs['spaceElevatorTetherVolumeWithSameMaterials'] = {value: V, units: "m3"}
      specs['spaceElevatorTetherMassWithSameMaterials'] = {value: M, units: "kg"}
      specs['spaceElevatorTetherCostWithSameMaterials'] = {value: spaceElevatorCost, units: "USD"}
      specs['spaceElevatorTetherCostPerKgOfLoadWithSameMaterials'] = {value: spaceElevatorCost / (ClimberPayloadMass/g), units: "USD"}
    }
  }
}

function updateRing() {
  
  // Deletion Section
  mainRingCurveLineMeshes.forEach(mesh => {
    mesh.geometry.dispose()
    mesh.material.dispose()
    tetheredRingRefCoordSys.remove(mesh)
  })
  mainRingCurveLineMeshes.splice(0, mainRingCurveLineMeshes.length)

  if (majorRedesign) {
    mainRingMeshes.forEach(mesh => {
      mesh.geometry.dispose()
      mesh.material.dispose()
      tetheredRingRefCoordSys.remove(mesh)
    })
    mainRingMeshes.splice(0, mainRingMeshes.length)
  }

  if (dParamWithUnits['showTransitSystem'].value) {
    if (majorRedesign) {
      transitSystemMeshes.forEach(mesh => {
        mesh.geometry.dispose()
        mesh.material.dispose()
        tetheredRingRefCoordSys.remove(mesh)
      })
      transitSystemMeshes.splice(0, transitSystemMeshes.length)
    }
  }

  if (dParamWithUnits['showLaunchTubes'].value) {
    launchTubeMeshes.forEach(mesh => {
      mesh.geometry.dispose()
      mesh.material.dispose()
      tetheredRingRefCoordSys.remove(mesh)
    })
    launchTubeMeshes.splice(0, launchTubeMeshes.length)
  }

  if (dParamWithUnits['showElevatorCables'].value) {
    elevatorCableMeshes.forEach(mesh => {
      mesh.geometry.dispose()
      mesh.material.dispose()
      tetheredRingRefCoordSys.remove(mesh)
    })
    elevatorCableMeshes.splice(0, elevatorCableMeshes.length)

    // ToDo: We're going to implement dynamic allocation of elevatorCarMeshes and terminusMeshes, so later these will be deleted...
    elevatorCarMeshes.forEach(mesh => {
      //mesh.geometry.dispose()
      //mesh.material.dispose()
      tetheredRingRefCoordSys.remove(mesh)
    })
    elevatorCarMeshes.splice(0, elevatorCarMeshes.length)

    // terminusMeshes.forEach(mesh => {
    //   //mesh.geometry.dispose()
    //   //mesh.material.dispose()
    //   tetheredRingRefCoordSys.remove(mesh)
    // })
    // terminusMeshes.splice(0, terminusMeshes.length)

    if (dParamWithUnits['showTransitVehicles'].value) {
      //console.log(transitVehicleMeshes)
      transitVehicleMeshes.forEach(mesh => {
        //mesh.geometry.dispose()
        //mesh.material.dispose()
        tetheredRingRefCoordSys.remove(mesh)
      })
      transitVehicleMeshes.splice(0, transitVehicleMeshes.length)
    }

  }

  tethers.forEach(tether => {
    tether.geometry.dispose()
    tether.material.dispose()
    //tether.color.dispose()
    tetheredRingRefCoordSys.remove(tether)
  })
  tethers.splice(0, tethers.length)

  // Update the parameters prior to reconsrructing the scene
  updatedParam()

  // Reconstruction Section
  crv = new tram.commonRingVariables(radiusOfPlanet, dParamWithUnits['ringFinalAltitude'].value, dParamWithUnits['equivalentLatitude'].value, dParamWithUnits['ringAmountRaisedFactor'].value)
  ecv = new tram.elevatorCarVariables(gravitationalConstant, massOfPlanet, radiusOfPlanet, dParamWithUnits, crv)
 
  constructMainRingCurve()
  if (majorRedesign) {
    constructMainRings()
  }
  else {
    mainRingMeshes.forEach((mesh, i) => {
      mesh.position.y = crv.yc +   (i-((dParamWithUnits['numMainRings'].value-1)/2))*dParamWithUnits['mainRingSpacing'].value
    })
  }

  if (dParamWithUnits['showTransitSystem'].value) {
    if (majorRedesign) {
      constructTransitSystem()
      if (dParamWithUnits['showTransitVehicles'].value) {
        constructTransitVehicles()
      }   
    }
    else {
      transitSystemMeshes.forEach((mesh, i) => {
        const transitTube_y = crv.yc + tram.offset_y(dParamWithUnits['transitTubeOutwardOffset'].value, dParamWithUnits['transitTubeUpwardOffset'].value, crv.currentEquivalentLatitude)
        if (i==0) {
          mesh.position.y = transitTube_y
        }
        else {
          //const outwardOffset = trackOffsetsList[i-1][0] * dParamWithUnits['transitTubeTubeRadius'].value 
          //const upwardOffset = trackOffsetsList[i-1][1] * dParamWithUnits['transitTubeTubeRadius'].value
          //mesh.position.y = transitTube_y + tram.offset_y(outwardOffset, upwardOffset, crv.currentEquivalentLatitude)
        }
      })
    }
  }

  if (dParamWithUnits['showLaunchTubes'].value) {
    console.log("Updating Launch Tube")
    constructLaunchTube()
  }
  constructElevatorCables()
  constructElevatorCars()
  constructTerminuses()
  console.log("Updating Tethers")
  constructTethers()

  calculateAdditionalSpecs()

  if (genSpecsFile) {
    console.log("Generating Specs File")
    specsFile = specsFile.concat('// Derived Specifications\n')
    Object.entries(specs).forEach(([k, v]) => {
      specsFile = specsFile.concat(k + ',' + v.value + ',' + v.units + '\n')
    })
  }
}

const mouse = {
  x: undefined,
  y: undefined
}
let intersectionPoint = new THREE.Vector3
let targetPoint = new THREE.Vector3
let animateRingRaising = false
let animateRingLowering = false
let animateZoomingIn = false
let animateZoomingOut = false
let animateCameraGoingUp = false
let animateCameraGoingDown = false
const clock = new THREE.Clock();
let timeSinceStart = 0
let prevWeAreNear1 = NaN
let prevWeAreNear2 = NaN

function animate() {
  renderer.setAnimationLoop( renderFrame )
}

function renderFrame() {
  //requestAnimationFrame(animate)
  //simContainer = document.querySelector('#simContainer')
  //console.log(simContainer.offsetWidth, simContainer.offsetHeight)
  //renderer.setViewport( 0, 0, simContainer.offsetWidth, simContainer.offsetHeight )

  if (orbitControlsEarthRingLerpFactor!=1) {
    console.log("Lerping...")
    orbitControlsEarthRingLerpFactor = tram.clamp(orbitControlsEarthRingLerpFactor + orbitControlsEarthRingLerpSpeed, 0, 1)

    orbitControls.enabled = false
    orbitControls.target.lerpVectors(previousTargetPoint, orbitControlsTargetPoint, orbitControlsEarthRingLerpFactor)
    const upVector = new THREE.Vector3()
    upVector.lerpVectors(previousUpVector, orbitControlsTargetUpVector, orbitControlsEarthRingLerpFactor).normalize()
    camera.up.copy(upVector)
    orbitControls.upDirection.copy(upVector)
    orbitControls.screenSpacePanning = false
    orbitControls.enabled = true
    orbitControls.update()
  }
  else {
    orbitControls.maxPolarAngle = orbitControlsNewMaxPolarAngle
    // const offTarget = orbitControls.target.clone().sub(orbitControlsTargetPoint).length()
    // console.log(offTarget)
    // if ((offTarget>100) && (offTarget<10000) && (orbitControlsTargetPoint.length()>radiusOfPlanet)) {
    //   orbitControls.target.lerp(orbitControlsTargetPoint, 0.02)
    //   console.log("pulling towards last target")
    // }
  }

  //planetMesh.rotation.y += 0.000001
  if (animateZoomingIn || animateZoomingOut) {
    var offset = new THREE.Vector3
    offset.copy( orbitControls.object.position ).sub( orbitControls.target )
    if (animateZoomingIn) {
      offset.multiplyScalar(0.995)
    } else if (animateZoomingOut) {
      offset.multiplyScalar(1.005)
    }
    orbitControls.object.position.copy( orbitControls.target ).add( offset );
  }
  orbitControls.update()
  const delta = clock.getDelta()
  timeSinceStart += delta

  //virtualTransitVehicles.animate(timeSinceStart)
  
  if (animateRingRaising || animateRingLowering) {
    Object.entries(guidParamWithUnits).forEach(([k, v]) => {
      v.value = guidParam[k]
    })
  
    if (animateRingRaising) {
      guidParamWithUnits['ringAmountRaisedFactor'].value = Math.min(1, guidParamWithUnits['ringAmountRaisedFactor'].value+delta*0.01)
      if (guidParamWithUnits['ringAmountRaisedFactor'].value==1) animateRingRaising = false
    }
    if (animateRingLowering) {
      guidParamWithUnits['ringAmountRaisedFactor'].value = Math.max(0, guidParamWithUnits['ringAmountRaisedFactor'].value-delta*0.01)
      if (guidParamWithUnits['ringAmountRaisedFactor'].value==0) animateRingLowering = false
      //cameraGroup.position.z -= -0.0001 * radiusOfPlanet
      //console.log(cameraGroup.position.z/radiusOfPlanet)
    }
    Object.entries(guidParamWithUnits).forEach(([k, v]) => {
      guidParam[k] = v.value
    })
      
    adjustRingDesign()
  }
  if (animateCameraGoingUp || animateCameraGoingDown) {
    if (animateCameraGoingUp) {
      camera.position.multiplyScalar(1.000001)
      orbitControls.target.multiplyScalar(1.000001)
      if (camera.position.length()>=radiusOfPlanet + 100000) animateCameraGoingUp = false
    }
    if (animateCameraGoingDown) {
      camera.position.multiplyScalar(0.999999)
      orbitControls.target.multiplyScalar(0.999999)
      if (camera.position.length()<=radiusOfPlanet) animateCameraGoingDown = false
    }
  }

  if (dParamWithUnits['showElevatorCables'].value && dParamWithUnits['animateElevators'].value) {
    elevatorAltitude = tram.getElevatorCarAltitude(dParamWithUnits, crv, ecv, timeSinceStart)
    //console.log(elevatorAltitude)
    const cableOutwardOffset = dParamWithUnits['transitTubeOutwardOffset'].value - dParamWithUnits['transitTubeTubeRadius'].value + dParamWithUnits['elevatorCableOutwardOffset'].value
    elevatorCarMeshes.forEach(mesh => {
      const a = mesh.userData
      const elevatorCarPosition_r = crv.mainRingRadius + tram.offset_r(cableOutwardOffset, elevatorAltitude-crv.currentMainRingAltitude, crv.currentEquivalentLatitude)
      const elevatorCarPosition_y = crv.yc + tram.offset_y(cableOutwardOffset, elevatorAltitude-crv.currentMainRingAltitude, crv.currentEquivalentLatitude)
      mesh.position.set(elevatorCarPosition_r * Math.cos(a), elevatorCarPosition_y, elevatorCarPosition_r * Math.sin(a))
    })
  }

  if (dParamWithUnits['showTransitSystem'].value && dParamWithUnits['showTransitVehicles'].value && dParamWithUnits['animateTransitVehicles'].value) {
    const transitVehiclePosition = tram.getTransitVehiclePosition(dParamWithUnits, crv, tvv, timeSinceStart)
    const sign = [0, -1, 0, 1]
    transitVehicleMeshes.forEach(mesh => {
      const a = mesh.userData.a
      const i = mesh.userData.i

      const outwardOffset = dParamWithUnits['transitTubeOutwardOffset'].value + trackOffsetsList[i][0] * dParamWithUnits['transitTubeTubeRadius'].value
      const upwardOffset = dParamWithUnits['transitTubeUpwardOffset'].value + trackOffsetsList[i][1] * dParamWithUnits['transitTubeTubeRadius'].value - dParamWithUnits['transitVehicleRadius'].value - .35  // Last is half of the track height
      computeTransitVehiclePositionAndRotation(mesh, outwardOffset, upwardOffset, a, transitVehiclePosition * sign[i])
    })
  }

  const weAreNear1 = (camera.position.length() > (radiusOfPlanet + crv.currentMainRingAltitude)*1.1)
  if (weAreNear1 !== prevWeAreNear1) {
    if (weAreNear1) {
      // To improve rendering performance when zoomed out, make parts of the ring invisible
      stars.visible = true
      transitSystemMeshes.forEach(mesh => {mesh.visible = false})
      transitVehicleMeshes.forEach(mesh => {mesh.visible = false})
      mainRingMeshes.forEach(mesh => {mesh.visible = false})
      elevatorCarMeshes.forEach(mesh => {mesh.visible = false})
      terminusMeshes.forEach(mesh => {mesh.visible = false})
    }
    else {
      stars.visible = false
      transitSystemMeshes.forEach(mesh => {mesh.visible = true})
      transitVehicleMeshes.forEach(mesh => {mesh.visible = true})
      mainRingMeshes.forEach(mesh => {mesh.visible = true})
      elevatorCarMeshes.forEach(mesh => {mesh.visible = true})
      terminusMeshes.forEach(mesh => {mesh.visible = true})
    }
  }
  prevWeAreNear1 = weAreNear1

  const weAreNear2 = (camera.position.length() > radiusOfPlanet*4)
  if (weAreNear2 !== prevWeAreNear2) {
    if (weAreNear2) {
      launchTubeMeshes.forEach(mesh => {mesh.visible = false})
      elevatorCableMeshes.forEach(mesh => {mesh.visible = false})
    }
    else {
      launchTubeMeshes.forEach(mesh => {mesh.visible = true})
      elevatorCableMeshes.forEach(mesh => {mesh.visible = true})
    }
  }
  prevWeAreNear2 = weAreNear2

  renderer.render(scene, camera)
  transitSystemMeshes.forEach(mesh => {mesh.visible = true})

  stats.update();
}

console.log("Adding resize event listener")
window.addEventListener( 'resize', onWindowResize )
function onWindowResize() {
  simContainer = document.querySelector('#simContainer')
  camera.aspect = simContainer.offsetWidth/simContainer.offsetHeight
  camera.updateProjectionMatrix()
  //console.log(simContainer.offsetWidth, simContainer.offsetHeight)
  renderer.setSize( simContainer.offsetWidth, simContainer.offsetHeight)
  //console.log("resizing...", simContainer.offsetWidth, simContainer.offsetHeight)
}

console.log("Adding keydown event listener")
document.addEventListener( 'keydown', onKeyDown )

console.log("Adding mousemove event listener")
addEventListener('mousemove', (event) => {
  mouse.x = 2 * (event.clientX / simContainer.offsetWidth) - 1
  mouse.y = 1 - 2 * (event.clientY / simContainer.offsetHeight)
})

console.log("Adding keydown event listener")
console.log("Adding VR button")
document.body.appendChild( VRButton.createButton( renderer ) )

console.log("Calling animate")
animate()

// function findNearestPointOnRing(intersectionPoint) {
//   // Goal is to find a point on the ring to use as the target point for the orbit controls, to mke it easier to zoom in close when starting from very far away.
//   // There is defintaely a more direct formula forthis - I'm being lazy!
//   // This apporoach involves zipping around the ring and finding the point that is closest to the point above the globe where the user's cursor was when they pressed 'P'
//   const r = radiusOfPlanet + dParamWithUnits['ringFinalAltitude'].value * dParamWithUnits['ringAmountRaisedFactor'].value
//   const ω = -(Math.PI/2 - dParamWithUnits['equivalentLatitude'].value)
//   let pointOnRing = new THREE.Vector3()
//   const cursorPoint = intersectionPoint.multiplyScalar((radiusOfPlanet + dParamWithUnits['ringFinalAltitude'].value * dParamWithUnits['ringAmountRaisedFactor'].value)/radiusOfPlanet)

//   let minDistace
//   let bestPoint = new THREE.Vector3()
//   for (let i = 0; i<dParamWithUnits['numTethers'].value; i+=dParamWithUnits['numTethers'].value/4) {
//     const θ = i / dParamWithUnits['numTethers'].value * 2.0 * Math.PI
//     pointOnRing.setFromSphericalCoords(r, ω, θ).localToWorld()
//     //console.log(pointOnRing)
//     const d = pointOnRing.distanceTo(cursorPoint)
//     if ((i==0) || (d<minDistace)) {
//       minDistace = d
//       bestPoint.copy(pointOnRing)
//     }
//   }
//   return bestPoint
// }

function onKeyDown( event ) {
  Object.entries(guidParamWithUnits).forEach(([k, v]) => {
    v.value = guidParam[k]
  })
  
  switch ( event.keyCode ) {
    case 79: /*O*/
      orbitControls.target.set(0, 0, 0)
      orbitControls.rotateSpeed = 1
      orbitControls.upDirection.set(0, 1, 0)
      orbitControls.maxPolarAngle = Math.PI
      orbitControlsNewMaxPolarAngle = Math.PI
      camera.up.set(0, 1, 0)
      break;
    case 80: /*P*/
      raycaster.setFromCamera(mouse, camera)
      let planetIntersects = []
      planetMeshes.forEach(mesh => {
        planetIntersects.push.apply(planetIntersects, raycaster.intersectObject(mesh))
      })
      let transitTubeIntersects = []
      if (dParamWithUnits['showTransitSystem'].value) {
        transitSystemMeshes.forEach(mesh => {
          transitTubeIntersects.push.apply(transitTubeIntersects, raycaster.intersectObject(mesh))
        })
      }
      if (transitTubeIntersects.length>0) {
        intersectionPoint = transitTubeIntersects[0].point
        targetPoint = intersectionPoint
        extraDistanceForCamera = 100
        orbitControls.rotateSpeed = 0.05
      }
      else if (planetIntersects.length>0) { // Note: would probably be advisable to assert here that there is only one intersection point.
        intersectionPoint = planetIntersects[0].point
        // Because we want to orbit around a point at the altitude of the ring...
        targetPoint = intersectionPoint.multiplyScalar((radiusOfPlanet + crv.currentMainRingAltitude)/radiusOfPlanet)
        extraDistanceForCamera = 10000
        orbitControls.rotateSpeed = 0.9
        // Uncomment this line if you want to print lat, lon, and alt to console
        //console.log(tram.xyz2lla(intersectionPoint.x, intersectionPoint.y, intersectionPoint.z))
      }
      if (planetIntersects.length>0 || transitTubeIntersects.length>0) {
        previousTargetPoint.copy(orbitControls.target.clone())
        previousUpVector.copy(orbitControls.upDirection.clone())
        orbitControlsTargetPoint.copy(targetPoint.clone())
        orbitControlsTargetUpVector = planetCoordSys.worldToLocal(orbitControlsTargetPoint.clone()).normalize()
        orbitControlsEarthRingLerpFactor = 0
        orbitControlsEarthRingLerpSpeed = 1/32
        orbitControlsNewMaxPolarAngle = Math.PI/2 + .1
      }
      break;
    case 81: /*Q*/
      orbitControls.autoRotate ^= true
      break;
    // case 82: /*R*/
    //   dParamWithUnits['ringCenterLongitude'].value -= 0.1
    //   updateRing()
    //   break; 
    // case 84: /*T*/
    //   dParamWithUnits['ringCenterLongitude'].value += 0.1
    //   updateRing()
    //   break;
    case 82: /*R*/
      // Raise the Ring
      animateRingRaising = !animateRingRaising
      animateRingLowering = false
      break;
    case 76: /*L*/
      // Lower the Ring
      animateRingRaising = false
      animateRingLowering = !animateRingLowering
      break;
    case 85: /*U*/
      // Move the Camera Up
      animateCameraGoingUp = !animateCameraGoingUp
      animateCameraGoingDown = false 
      break; 
    case 68: /*D*/
      animateCameraGoingDown = !animateCameraGoingDown
      animateCameraGoingUp = false 
      break;
    case 87: /*W*/
      // This executes and instantaneous "Warp" to a position much closer to the ring
      orbitControls.maxPolarAngle = Math.PI/2 + .1
      orbitControlsNewMaxPolarAngle = Math.PI/2 + .1
      orbitControls.target.set(-3763210.8232434946, 4673319.5670904, -2255256.723306473)
      orbitControls.upDirection.set(-0.5870824578788134, 0.7290700269983701, -0.351839570519814)
      orbitControls.object.position.set(-3764246.447379286, 4672428.630481427, -2255483.089866906)
      camera.up.set(-0.5870824578788134, 0.7290700269983701, -0.351839570519814)
      toRingAlreadyTriggered = true
      toPlanetAlreadyTriggered = false
      orbitControlsTargetPoint.copy(orbitControls.target.clone())
      orbitControlsTargetUpVector.copy(orbitControls.upDirection.clone())
      orbitControls.update()
      // guidParamWithUnits['numForkLevels'].value = 8
      // for (var i in gui.__controllers) {
      //   gui.__controllers[i].updateDisplay()
      // }
      // updatedParam()
      // updateRing()
      break;
    case 88: /*X*/
      animateZoomingIn = false
      animateZoomingOut = !animateZoomingOut
      break;
    case 90: /*Z*/
      animateZoomingIn = !animateZoomingIn
      animateZoomingOut = false
      break;
    case 69: /*E*/
      recomputeNearFarClippingPlanes()
      break;
    case 70: /*F*/
      guidParamWithUnits['ringFinalAltitude'].value = 200000  // m
      guidParamWithUnits['equivalentLatitude'].value = Math.acos(targetRadius/(radiusOfPlanet + guidParamWithUnits['ringFinalAltitude'].value)) * 180 / Math.PI
      guidParamWithUnits['ringAmountRaisedFactor'].value = 0.01
      guidParamWithUnits['numMainRings'].value = 1
      //guidParamWithUnits['mainRingTubeRadius'].value = 1
      guidParamWithUnits['numTethers'].value = 180
      guidParamWithUnits['numForkLevels'].value = 6
      guidParamWithUnits['tetherSpanOverlapFactor'].value = 1
      guidParamWithUnits['tetherPointBxAvePercent'].value = 0.8
      guidParamWithUnits['tetherPointBxDeltaPercent'].value = 0
      guidParamWithUnits['tetherEngineeringFactor'].value = 0.5
      guidParamWithUnits['numElevatorCables'].value = 180
      guidParamWithUnits['numElevatorCars'].value = 0
      guidParamWithUnits['numTerminuses'].value = 0
      adjustRingDesign()
      guidParamWithUnits['moveRing'].value = 0
      adjustRingLatLon()
      guidParamWithUnits['cableVisibility'].value = 0.1
      adjustCableOpacity()
      guidParamWithUnits['tetherVisibility'].value = 1
      adjustTetherOpacity()
      planetCoordSys.rotation.y = 2 * Math.PI * -(213.7+180) / 360
      planetCoordSys.rotation.x = 2 * Math.PI * (90+19.2) / 360
      break;
  }
    Object.entries(guidParamWithUnits).forEach(([k, v]) => {
      guidParam[k] = v.value
    })
}

function orbitControlsEventHandler() {
  //console.log("recomputing near/far")
  recomputeNearFarClippingPlanes()
  //console.log("auto-adjusting orbit target")
  autoAdjustOrbitControlsCenter()
  //console.log("done")
}

function recomputeNearFarClippingPlanes() {
  // Calculate the distance to the nearest object - for this we will use the sphere encompassing the Earth and it's stratosphere
  // Multiply that by the cosine of thecamera's fulstrum angle
  camera.near = Math.max(10, camera.position.distanceTo(planetMeshes[0].position) - (radiusOfPlanet+dParamWithUnits['ringFinalAltitude'].value+extraDistanceForCamera)) * Math.cos(camera.getEffectiveFOV()*Math.PI/180)
  // Far calculation: Use the pythagorean theorm to compute distance to the Earth's horizon,
  // then add the distrance from there to the edge of the sphere that represents the atmosphere,
  // then pad this sum by a factor of 1.5
  const d1Squared = camera.position.distanceTo(planetMeshes[0].position)**2 - radiusOfPlanet**2
  const d2Squared = (radiusOfPlanet*1.1)**2 - radiusOfPlanet**2
  let d1, d2
  if (d1Squared>0) {
    d1 = Math.sqrt(d1Squared)
  }
  else {
    d1 = 0
  }
  if (d2Squared>0) {
    d2 = Math.sqrt(d2Squared)
  }
  else {
    d2 = 0
  }
  camera.far = Math.max(camera.near*16384, (d1 + d2) * 1.5)

  // Hack
  if (enableVR) {
    camera.near = 0.0001 * radiusOfPlanet
    camera.far = 1 * radiusOfPlanet
  }
  //console.log(camera.near, camera.near*16384, (d1+d2)*1.5, camera.far, 2)
  camera.updateProjectionMatrix()
  nearClippingPlane = camera.near
  farClippingPlane = camera.far
}

let previousUpVector = new THREE.Vector3(0, 1, 0)
let orbitControlsTargetUpVector = new THREE.Vector3(0, 1, 0)
let previousTargetPoint = new THREE.Vector3(0, 0, 0)
let orbitControlsTargetPoint = new THREE.Vector3(0, 0, 0)
let toRingAlreadyTriggered = false
let toPlanetAlreadyTriggered = true
let orbitControlsEarthRingLerpFactor = 1 // When 1, this indicates no tweening is in progress
let orbitControlsEarthRingLerpSpeed
let orbitControlsNewMaxPolarAngle = Math.PI

function autoAdjustOrbitControlsCenter() {
  const distanceToCenterOfEarth = camera.position.length()
  const innerTransitionDistance = radiusOfPlanet+1000000
  const outerTransitionDistance = radiusOfPlanet+2000000
  if (distanceToCenterOfEarth>outerTransitionDistance) {
    toRingAlreadyTriggered = false  // Reset the trigger
    if (!toPlanetAlreadyTriggered) {
      //previousTargetPoint.copy(orbitControlsTargetPoint.clone())
      //previousUpVector.copy(orbitControlsTargetUpVector.clone())
      previousTargetPoint.copy(orbitControls.target.clone())
      previousUpVector.copy(orbitControls.upDirection.clone())
      orbitControlsTargetPoint.set(0, 0, 0)
      // ToDo: Need to find the nearest point on the ring to the orbitControlsSurfaceMarker and set orbitControlsTargetPoint to that
      orbitControlsTargetUpVector.set(0, 1, 0)
      orbitControlsEarthRingLerpFactor = 0
      orbitControlsEarthRingLerpSpeed = 1/256
      orbitControls.maxPolarAngle = Math.PI
      orbitControlsNewMaxPolarAngle = Math.PI
      orbitControls.rotateSpeed = 1
      //orbitControlsSurfaceMarker.visible = false
      toPlanetAlreadyTriggered = true
    }
  }
  //else if ((distanceToCenterOfEarth>innerTransitionDistance) && (distanceToCenterOfEarth<outerTransitionDistance)) {
    //const pointAboveEarthsSurface = pointOnEarthsSurface.clone().multiplyScalar((radiusOfPlanet + crv.currentMainRingAltitude)/radiusOfPlanet)
    //orbitControlsSurfaceMarker.position.copy(pointAboveEarthsSurface)
    //orbitControlsSurfaceMarker.visible = true
  //}
  else if (distanceToCenterOfEarth<=innerTransitionDistance) {
    if (!toRingAlreadyTriggered) {
      const screenCenter = new THREE.Vector2(0, 0) // The center of the screen is, by definition, (0,0)
      raycaster.setFromCamera(screenCenter, camera)
      console.log("raycasting")
      const planetIntersects = []
      planetMeshes.forEach(mesh => {
        planetIntersects.push.apply(planetIntersects, raycaster.intersectObject(mesh))
      })
      const pointOnEarthsSurface = planetIntersects[0].point
      // Second criteria is that we're sufficiently close to the point that the user wants to zoom into, even if they are zooming in at an oblique angle.
      const distanceToPointOnEarthsSurface = pointOnEarthsSurface.clone().sub(camera.position).length()
      if (distanceToPointOnEarthsSurface<innerTransitionDistance) {
        //previousTargetPoint.copy(orbitControlsTargetPoint.clone())
        //previousUpVector.copy(orbitControlsTargetUpVector.clone())
        previousTargetPoint.copy(orbitControls.target.clone())
        previousUpVector.copy(orbitControls.upDirection.clone())
        // ToDo: Need to find the nearest point on the ring to the orbitControlsSurfaceMarker and set orbitControlsTargetPoint to that
        // Convert pointOnEarthsSurface into tetheredRingRefCoordSys
        const localPoint = tetheredRingRefCoordSys.worldToLocal(pointOnEarthsSurface.clone()).normalize()
        // Then compute it's theata value
        const originalTheta = Math.atan2(localPoint.z, localPoint.x)
        // Round theta to align it with the position of an elevator cable
        const numGoodSpots = Math.min(dParamWithUnits['numTransitVehicles'].value, dParamWithUnits['numElevatorCables'].value)
        const roundedTheta = Math.round(originalTheta/(Math.PI*2)*numGoodSpots) / numGoodSpots * Math.PI*2
        // Then find a point on the ring with the same theta value
        const transitTube_r = crv.mainRingRadius + tram.offset_r(dParamWithUnits['transitTubeOutwardOffset'].value, dParamWithUnits['transitTubeUpwardOffset'].value, crv.currentEquivalentLatitude)
        const transitTube_y = crv.yc + tram.offset_y(dParamWithUnits['transitTubeOutwardOffset'].value, dParamWithUnits['transitTubeUpwardOffset'].value, crv.currentEquivalentLatitude)
        localPoint.set(transitTube_r*Math.cos(roundedTheta), transitTube_y, transitTube_r*Math.sin(roundedTheta))
        // Convert that point back into planetCoordSys
        const worldPoint = tetheredRingRefCoordSys.localToWorld(localPoint.clone())
        //orbitControlsCenterMarker.position.copy(worldPoint.clone())
        orbitControlsTargetPoint.copy(worldPoint.clone())
        orbitControlsTargetUpVector = planetCoordSys.worldToLocal(worldPoint.clone()).normalize()
        orbitControlsEarthRingLerpFactor = 0
        orbitControlsEarthRingLerpSpeed = 1/256
        orbitControlsNewMaxPolarAngle = Math.PI/2 + .1
        orbitControls.rotateSpeed = 0.9
        //orbitControlsSurfaceMarker.visible = false
        toRingAlreadyTriggered = true
      }
    }
    toPlanetAlreadyTriggered = false // Reset trigger      
  }
}

if (enableKMLFileFeature) {
  // This code creates the button that downloads a .kml file which can be displayed using
  // Google Earth's "Create Project" button, followed by "Import KML file from computer"
  var textFile = null
  var makeTextFile = function () {
    genKMLFile = true
    const prevFastTetherRender = fastTetherRender
    fastTetherRender = false // Can't generate a KML file when using the fast tether rendering technique
    kmlFile = ''
    kmlFile = kmlutils.kmlFileHeader
    updateRing()
    genKMLFile = false
    fastTetherRender = prevFastTetherRender
    var data = new Blob([kmlFile], {type: 'text/plain'})
    // If we are replacing a previously generated file we need to manually revoke the object URL to avoid memory leaks.
    if (textFile !== null) {
      window.URL.revokeObjectURL(textFile)
    }
    textFile = window.URL.createObjectURL(data)
    return textFile
  }

  var createkml = document.getElementById('createkml')

  createkml.addEventListener('click', function () {
    var link = document.createElement('a')
    link.setAttribute('download', 'tethered_ring.kml')
    link.href = makeTextFile()
    document.body.appendChild(link)

    // wait for the link to be added to the document
    window.requestAnimationFrame(function () {
      var event = new MouseEvent('click')
      link.dispatchEvent(event)
      document.body.removeChild(link)
    })
  }, false)
}

if (enableSpecsFileFeature) {
  // This code creates the button that downloads a .csv file which can be loadd into Excel
  var textFile = null
  var makeTextFile = function () {
    genSpecsFile = true
    const prevFastTetherRender = fastTetherRender
    specsFile = ''
    updateRing()
    genSpecsFile = false
    fastTetherRender = prevFastTetherRender
    var data = new Blob([specsFile], {type: 'text/plain'})
    // If we are replacing a previously generated file we need to manually revoke the object URL to avoid memory leaks.
    if (textFile !== null) {
      window.URL.revokeObjectURL(textFile)
    }
    textFile = window.URL.createObjectURL(data)
    return textFile
  }

  var createSpecs = document.getElementById('createSpecs')

  createSpecs.addEventListener('click', function () {
    var link = document.createElement('a')
    link.setAttribute('download', 'tethered_ring.csv')
    link.href = makeTextFile()
    document.body.appendChild(link)

    // wait for the link to be added to the document
    window.requestAnimationFrame(function () {
      var event = new MouseEvent('click')
      link.dispatchEvent(event)
      document.body.removeChild(link)
    })
  }, false)
}

