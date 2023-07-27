import * as THREE from 'three'
import { BoxGeometry } from 'three'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Quaternion } from 'three/src/math/Quaternion.js'
//import { XYChart } from './XYChart.js'
import { ScrewGeometry } from './ScrewGeometry.js'
import { SledGrapplerPlacementInfo, SledGrapplerGeometry } from './SledGrapplerGeometry.js'
import { CatmullRomSuperCurve3 } from './SuperCurves'
import { CircleSuperCurve3 } from './SuperCurves'
import { LineSuperCurve3 } from './SuperCurves'
import * as kmlutils from './kmlutils.js'
import * as tram from './tram.js'
import { virtualLaunchVehicle } from './LaunchVehicle.js'
import { virtualLaunchSled } from './LaunchSled.js'
import { virtualMassDriverTube } from './MassDriverTube.js'
import { virtualMassDriverRail } from './MassDriverRail.js'
import { virtualMassDriverBracket } from './MassDriverBracket.js'
import { virtualMassDriverScrew } from './MassDriverScrew.js'
import { virtualEvacuatedTube } from './EvacuatedTube.js'

//import { arrow } from './markers.js'
//import { FrontSide } from 'three'

//import * as THREE from 'https://cdn.skypack.dev/three@0.133.1/build/three.module.js'

class referenceFrame {
  constructor(numWedges) {
    this.timeSinceStart = 0
    this.startWedgeIndex = -1
    this.finishWedgeIndex = -1
    this.prevStartWedgeIndex = -1
    this.prevFinishWedgeIndex = -1
    const makePlaceHolderEntry = () => ({
      'virtualLaunchVehicles': [],
      'virtualLaunchSleds': [],
      'virtualMassDriverTubes': [],
      'virtualMassDriverRails': [],
      'virtualMassDriverBrackets': [],
      'virtualMassDriverScrews': [],
      'virtualEvacuatedTubes': [],
    })
    this.wedges = new Array(numWedges).fill().map( makePlaceHolderEntry )
  }
}

class FacesGeometry extends THREE.BufferGeometry {
  constructor(
    inputVertices = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)],
    inputIndices = [
      0, 1, 2,
      0, 2, 3,
      0, 3, 1,
      3, 2, 1]
    ) {
    super();
    this.type = 'FacesGeometry';
		this.parameters = {
			inputVertices: inputVertices,
			inputIndices: inputIndices
		};

    const vertices = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i<inputIndices.length/3; i++) {
      vertices.push(inputVertices[inputIndices[i*3+0]].x, inputVertices[inputIndices[i*3+0]].y, inputVertices[inputIndices[i*3+0]].z);
      vertices.push(inputVertices[inputIndices[i*3+1]].x, inputVertices[inputIndices[i*3+1]].y, inputVertices[inputIndices[i*3+1]].z);
      vertices.push(inputVertices[inputIndices[i*3+2]].x, inputVertices[inputIndices[i*3+2]].y, inputVertices[inputIndices[i*3+2]].z);
      const normal = new THREE.Vector3().crossVectors(inputVertices[inputIndices[i*3+0]].clone().sub(inputVertices[inputIndices[i*3+1]]), inputVertices[inputIndices[i*3+0]].clone().sub(inputVertices[inputIndices[i*3+2]])).normalize();
      normals.push(normal.x, normal.y, normal.z);
      normals.push(normal.x, normal.y, normal.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(0, 0, 0, 0, 0, 0);
      indices.push(i*3+0, i*3+1, i*3+2);
    }
    this.setIndex(indices);
    this.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
    this.setAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
    this.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );
  }
  copy( source ) {
		super.copy( source );
		this.parameters = Object.assign( {}, source.parameters );
		return this;
	}

}

class launchVehicleModel {
  constructor(dParamWithUnits) {
    // Manually Create the Launch Vehicle

    const lengthSegments = 2
    const radius = dParamWithUnits['launchVehicleRadius'].value
    const radialSegments = 32
    const bodyLength = dParamWithUnits['launchVehicleBodyLength'].value
    const noseConeLength = dParamWithUnits['launchVehicleNoseConeLength'].value
    const flameLength = bodyLength * 1.5

    // Create the vehicle's body
    const launchVehicleBodyGeometry = new THREE.CylinderGeometry(radius, radius, bodyLength, radialSegments, lengthSegments, false)
    launchVehicleBodyGeometry.name = "body"
    launchVehicleBodyGeometry.translate(0, bodyLength/2, 0)
    // Create the nose cone
    const launchVehicleNoseConeGeometry = new THREE.ConeGeometry(radius, noseConeLength, radialSegments, lengthSegments, true)
    launchVehicleNoseConeGeometry.name = "noseCone"
    launchVehicleNoseConeGeometry.translate(0, (bodyLength+noseConeLength)/2 + bodyLength/2, 0)
    // Create the fins
    const finLength = bodyLength * 0.5
    const finThickness = 0.2
    const finHeight = radius * 0.5
    const finVertices = [
      new THREE.Vector3(0, finLength, radius),   // Leading edge of fin
      new THREE.Vector3(finThickness/2, 0.1, radius),  // Left trailing edge of fin
      new THREE.Vector3(-finThickness/2, 0.1, radius),  // Right trailing edge of fin
      new THREE.Vector3(0, 0, radius+finHeight)  // Back trailing edge of fin
    ]
    const finIndices = [
      0, 1, 2,
      0, 2, 3,
      0, 3, 1,
      3, 2, 1
    ]
    const launchVehicleFin0Geometry = new FacesGeometry(finVertices, finIndices)

    launchVehicleFin0Geometry.name = "fin0"
    const launchVehicleFin1Geometry = launchVehicleFin0Geometry.clone()
    launchVehicleFin1Geometry.name = "fin1"
    launchVehicleFin1Geometry.rotateY(Math.PI*2/3)
    const launchVehicleFin2Geometry = launchVehicleFin0Geometry.clone()
    launchVehicleFin2Geometry.name = "fin2"
    launchVehicleFin2Geometry.rotateY(-Math.PI*2/3)

    // Create the vehicle's flame
    const launchVehicleFlameGeometry = new THREE.CylinderGeometry(radius*.9, radius*0.4, flameLength, radialSegments, lengthSegments, false)
    launchVehicleFlameGeometry.name = "rocketEngine"
    launchVehicleFlameGeometry.translate(0, -(bodyLength+flameLength)/2 + bodyLength/2, 0)

    // Merge the nosecone into the body
    const launchVehicleGeometry = BufferGeometryUtils.mergeBufferGeometries([launchVehicleBodyGeometry, launchVehicleNoseConeGeometry, launchVehicleFin0Geometry, launchVehicleFin1Geometry, launchVehicleFin2Geometry])

    const launchVehicleMaterial = new THREE.MeshPhongMaterial( {color: 0x7f3f00})
    const launchVehicleFlameMaterial = new THREE.MeshPhongMaterial( {color: 0x000000, emissive: 0xdfa0df, emissiveIntensity: 1.25, transparent: true, opacity: 0.5})
    const launchVehicleBodyMesh = new THREE.Mesh(launchVehicleGeometry, launchVehicleMaterial)
    launchVehicleBodyMesh.name = 'body'
    const launchVehicleFlameMesh = new THREE.Mesh(launchVehicleFlameGeometry, launchVehicleFlameMaterial)
    launchVehicleFlameMesh.name = 'flame'
    const launchVehiclePointLightMesh = new THREE.Points(
      new THREE.BufferGeometry().setAttribute( 'position', new THREE.Float32BufferAttribute( [0, 0, 0], 3) ),
      new THREE.PointsMaterial( { color: 0xFFFFFF } ) )
    launchVehiclePointLightMesh.name = 'pointLight'
    const launchVehicleMesh = new THREE.Group().add(launchVehicleBodyMesh).add(launchVehicleFlameMesh)
    launchVehicleMesh.name = 'launchVehicle'
    launchVehiclePointLightMesh.visible = dParamWithUnits['showLaunchVehiclePointLight'].value
    launchVehicleMesh.add(launchVehiclePointLightMesh)
    return launchVehicleMesh
  }
}
class launchSledModel {
  constructor(dParamWithUnits, massDriverSuperCurve, launcherMassDriverLength, massDriverScrewSegments, massDriverScrewTexture) {
    // Manually Create the Launch Vehicle

    const lengthSegments = 2
    const width = dParamWithUnits['launchSledWidth'].value
    const height = dParamWithUnits['launchSledHeight'].value
    const radialSegments = 32
    const bodyLength = dParamWithUnits['launchSledBodyLength'].value
    const numGrapplers = dParamWithUnits['launchSledNumGrapplers'].value

    // Create the sled's body (note: y-axis is in the direction the rocket is pointing, z-axis is up when the rocket is lying on it's side)
    const launchSledBodyGeometry = new THREE.BoxGeometry(width, bodyLength, height, 1, 1, 1)
    launchSledBodyGeometry.translate(0, bodyLength/2, 0)
    const launchSledBodyMaterial = new THREE.MeshPhongMaterial( {color: 0x7f3f00})
    const launchSledBodyMesh = new THREE.Mesh(launchSledBodyGeometry, launchSledBodyMaterial)
    launchSledBodyMesh.name = 'body'
    const launchSledMesh = new THREE.Group().add(launchSledBodyMesh)
    launchSledMesh.name = 'launchSled'

    // Create the sled's grapplers
    const baseDistanceAlongScrew = 0
    const firstGrapplerDistance = 0
    const lastGrapplerDistance = bodyLength
    const grapplerSpacing = 1.0 / numGrapplers * bodyLength
    for (let i = 0, grapplerDistance = firstGrapplerDistance; grapplerDistance<lastGrapplerDistance; i++, grapplerDistance += grapplerSpacing) {
      const launchSledGrapplerMesh = createSledGrapplerMesh(dParamWithUnits, baseDistanceAlongScrew, bodyLength, grapplerDistance, massDriverScrewTexture)
      launchSledGrapplerMesh.name = 'leftGrappler'
      launchSledGrapplerMesh.userData = i
      launchSledMesh.add(launchSledGrapplerMesh.clone())
      launchSledGrapplerMesh.name = 'rightGrappler'
      launchSledGrapplerMesh.userData = i
      launchSledGrapplerMesh.scale.set(-1, 1, 1)
      launchSledMesh.add(launchSledGrapplerMesh.clone())
    }
    return launchSledMesh
  }
}



class massDriverTubeModel {
  // Each model along the mass driver curve is unique, since the pitch of the mass driver's drive thread changes along it's length
  // so instead of dynamically allocating models from a pool of identical unallocated models, we need to create a unique model for each portion of the mass driver curve.
  // We can't dynamically reallocate these models, since each model always has to be placed in the location that it was designed for.
  // However, we can still hide and models, and also not update them, when they are too far from the camera to be visible.
  constructor(dParamWithUnits, massDriverSuperCurve, segmentIndex) {

    const massDriverTubeSegments = dParamWithUnits['launcherMassDriverTubeNumModels'].value
    const radius = dParamWithUnits['launcherMassDriverTubeRadius'].value
    const modelLengthSegments = 32    // This model, which is a segment of the whole mass driver, is itself divided into this many lengthwise segments
    const modelRadialSegments = 32
    const tubePoints = []

    // Now we need a reference point in the middle of this segment of the whole mass driver
    const modelsCurvePosition = (segmentIndex + 0.5) / massDriverTubeSegments
    const refPoint = massDriverSuperCurve.getPointAt(modelsCurvePosition)
    const modelForward = new THREE.Vector3(0, 1, 0) // The direction that the model considers "forward"
    const modelUpward = new THREE.Vector3(0, 0, 1)  // The direction that the model considers "upward"
    const orientation = massDriverSuperCurve.getQuaternionAt(modelForward, modelUpward, modelsCurvePosition).invert()

    // We need to define a curve for this segment of the mass driver, and then use that curve to create a tube geometry for this model
    for (let i = 0; i<=modelLengthSegments; i++) {
      const modelsCurvePosition = (segmentIndex + i/modelLengthSegments) / massDriverTubeSegments
      tubePoints.push(massDriverSuperCurve.getPointAt(modelsCurvePosition).sub(refPoint).applyQuaternion(orientation))
    }
    const massDriverSegementCurve = new CatmullRomSuperCurve3(tubePoints)
    const massDriverTubeGeometry = new THREE.TubeGeometry(massDriverSegementCurve, modelLengthSegments, radius, modelRadialSegments, false)
    const massDriverTubeMaterial = new THREE.MeshPhongMaterial( {side: THREE.DoubleSide, transparent: true, opacity: 0.25})
    const massDriverTubeMesh = new THREE.Mesh(massDriverTubeGeometry, massDriverTubeMaterial)
    return massDriverTubeMesh
  }
}
class massDriverRailModel {
  // Each model along the mass driver curve is unique, since the pitch of the mass driver's drive thread changes along it's length
  // so instead of dynamically allocating models from a pool of identical unallocated models, we need to create a unique model for each portion of the mass driver curve.
  // We can't dynamically reallocate these models, since each model always has to be placed in the location that it was designed for.
  // However, we can still hide and models, and also not update them, when they are too far from the camera to be visible.
  constructor(dParamWithUnits, massDriverSuperCurve, segmentIndex) {

    const massDriverRailSegments = dParamWithUnits['launcherMassDriverTubeNumModels'].value
    const width = dParamWithUnits['launcherMassDriverRailWidth'].value
    const height = dParamWithUnits['launcherMassDriverRailHeight'].value
    const modelLengthSegments = 32    // This model, which is a segment of the whole mass driver, is itself divided into this many lengthwise segments
    const modelRadialSegments = 32
    const tubePoints = []
    const shape = new THREE.Shape()
    shape.moveTo( width/2 , height/2 )
    shape.lineTo( width/2 , -height/2 )
    shape.lineTo( -width/2 , -height/2 )
    shape.lineTo( -width/2 , height/2 )
    shape.lineTo( width/2 , height/2 )
    // Now we need a reference point in the middle of this segment of the whole mass driver
    const modelsCurvePosition = (segmentIndex + 0.5) / massDriverRailSegments
    const refPoint = massDriverSuperCurve.getPointAt(modelsCurvePosition)
    const modelForward = new THREE.Vector3(0, 1, 0) // The direction that the model considers "forward"
    const modelUpward = new THREE.Vector3(0, 0, 1)  // The direction that the model considers "upward"
    const orientation = massDriverSuperCurve.getQuaternionAt(modelForward, modelUpward, modelsCurvePosition).invert()

    // We need to define a curve for this segment of the mass driver, and then use that curve to create a tube geometry for this model
    for (let i = 0; i<=modelLengthSegments; i++) {
      const modelsCurvePosition = (segmentIndex + i/modelLengthSegments) / massDriverRailSegments
      tubePoints.push(massDriverSuperCurve.getPointAt(modelsCurvePosition).sub(refPoint).applyQuaternion(orientation))
    }
    const massDriverSegementCurve = new CatmullRomSuperCurve3(tubePoints)
    const extrudeSettings = {
      steps: 2,
      depth: 1,
      extrudePath: massDriverSegementCurve
    }
    const massDriverRailGeometry = new THREE.ExtrudeGeometry( shape, extrudeSettings )
    const massDriverRailMaterial = new THREE.MeshPhongMaterial( {color: 0x71797E })
    const massDriverRailMesh = new THREE.Mesh(massDriverRailGeometry, massDriverRailMaterial)
    return massDriverRailMesh
  }
}
class massDriverBracketModel {
  // Each model along the mass driver curve is unique, since the pitch of the mass driver's drive thread changes along it's length
  // so instead of dynamically allocating models from a pool of identical unallocated models, we need to create a unique model for each portion of the mass driver curve.
  // We can't dynamically reallocate these models, since each model always has to be placed in the location that it was designed for.
  // However, we can still hide and models, and also not update them, when they are too far from the camera to be visible.
  constructor(dParamWithUnits, massDriverSuperCurve, launcherMassDriverLength, massDriverScrewSegments, segmentIndex) {

    const width = dParamWithUnits['launcherMassDriverBracketWidth'].value
    const height = dParamWithUnits['launcherMassDriverBracketHeight'].value
    const bracketThickness = dParamWithUnits['launcherMassDriverScrewBracketThickness'].value
    const bracketUpwardsOffset = dParamWithUnits['launchSledUpwardsOffset'].value - dParamWithUnits['launchSledHeight'].value/2 - dParamWithUnits['launcherMassDriverBracketHeight'].value/2
    const screwSidewaysOffset = dParamWithUnits['launcherMassDriverScrewSidewaysOffset'].value
    const screwUpwardsOffset = dParamWithUnits['launcherMassDriverScrewUpwardsOffset'].value
    const shaftRadius = dParamWithUnits['launcherMassDriverScrewShaftRadius'].value

    const segmentSpacing = launcherMassDriverLength / massDriverScrewSegments

    const modelLengthSegments = 1    // This model, which is a segment of the whole mass driver, is itself divided into this many lengthwise segments
    const modelRadialSegments = 32
    const shape = new THREE.Shape()
    shape.moveTo( 0 , height/2 )
    shape.lineTo( -width/2 , height/2 )
    for (let a = 8; a<=24; a++) {
      shape.lineTo( -screwSidewaysOffset + Math.cos(a/16*Math.PI)*shaftRadius , (screwUpwardsOffset-bracketUpwardsOffset) + Math.sin(a/16*Math.PI)*shaftRadius )
    }
    for (let a = 24; a<=40; a++) {
      shape.lineTo( +screwSidewaysOffset + Math.cos(a/16*Math.PI)*shaftRadius , (screwUpwardsOffset-bracketUpwardsOffset) + Math.sin(a/16*Math.PI)*shaftRadius )
    }
    shape.lineTo( width/2 , height/2 )
    shape.lineTo( 0 , height/2 )
    // Now we need a reference point in the middle of this segment of the whole mass driver
    const modelsCurvePosition = (segmentIndex + 0.5) / massDriverScrewSegments
    const refPoint = massDriverSuperCurve.getPointAt(modelsCurvePosition)
    const modelForward = new THREE.Vector3(0, 1, 0) // The direction that the model considers "forward"
    const modelUpward = new THREE.Vector3(0, 0, 1)  // The direction that the model considers "upward"
    const orientation = massDriverSuperCurve.getQuaternionAt(modelForward, modelUpward, modelsCurvePosition).invert()

    // We need to define a curve for this segment of the mass driver, and then use that curve to create a tube geometry for this model
    const tubePoints = []
    for (let i = 0; i<=modelLengthSegments; i++) {
      const modelsCurvePosition = (segmentIndex + (i-0.5) * bracketThickness/segmentSpacing) / massDriverScrewSegments
      tubePoints.push(massDriverSuperCurve.getPointAt(modelsCurvePosition).sub(refPoint).applyQuaternion(orientation))
    }
    const upDirection = new THREE.Vector3(-1, 0, 0)
    const massDriverSegementCurve = new LineSuperCurve3(tubePoints[0], tubePoints[1], upDirection, upDirection)
    const extrudeSettings = {
      steps: 2,
      depth: 1,
      extrudePath: massDriverSegementCurve
    }
    const massDriverBracketGeometry = new THREE.ExtrudeGeometry( shape, extrudeSettings )
    const massDriverBracketMaterial = new THREE.MeshPhongMaterial( {color: 0x71797E})
    const massDriverBracketMesh = new THREE.Mesh(massDriverBracketGeometry, massDriverBracketMaterial)
    return massDriverBracketMesh
  }
}
class massDriverScrewModel {
  // Each model along the mass driver curve is unique, since the pitch of the mass driver's drive thread changes along it's length
  // so instead of dynamically allocating models from a pool of identical unallocated models, we need to create a unique model for each portion of the mass driver curve.
  // We can't dynamically reallocate these models, since each model always has to be placed in the location that it was designed for.
  // However, we can still hide and models, and also not update them, when they are too far from the camera to be visible.
  constructor(dParamWithUnits, launcherMassDriverLength, massDriverScrewSegments, segmentIndex, massDriverScrewTexture) {

    const shaftRadius = dParamWithUnits['launcherMassDriverScrewShaftRadius'].value
    const threadRadius = dParamWithUnits['launcherMassDriverScrewThreadRadius'].value
    const threadThickness = dParamWithUnits['launcherMassDriverScrewThreadThickness'].value
    const threadStarts = dParamWithUnits['launcherMassDriverScrewThreadStarts'].value
    const launcherMassDriverScrewRevolutionsPerSecond = dParamWithUnits['launcherMassDriverScrewRevolutionsPerSecond'].value
    const launcherMassDriverForwardAcceleration = dParamWithUnits['launcherMassDriverForwardAcceleration'].value
    const launcherMassDriverInitialVelocity = dParamWithUnits['launcherMassDriverInitialVelocity'].value
    const bracketThickness = dParamWithUnits['launcherMassDriverScrewBracketThickness'].value
    
    // The point of breaking the screw into segments relates to the need to display the brackets.
    const modelLengthSegments = 256 // this needs to be related to the number of turns per segment, and more segments are needed when the pitch is finer
    const modelRadialSegments = 24 / Math.min(threadStarts, 4)

    const segmentSpacing = launcherMassDriverLength / massDriverScrewSegments
    const baseDistanceAlongScrew = segmentIndex * segmentSpacing
    const screwLength = segmentSpacing - bracketThickness

    const massDriverScrewGeometry = new ScrewGeometry(
      screwLength,
      modelLengthSegments,
      shaftRadius,
      threadRadius,
      threadThickness,
      threadStarts,
      baseDistanceAlongScrew,
      launcherMassDriverInitialVelocity,
      launcherMassDriverScrewRevolutionsPerSecond,
      launcherMassDriverForwardAcceleration,
      modelRadialSegments)
    const massDriverScrewMaterial = new THREE.MeshPhongMaterial( {map: massDriverScrewTexture})
    const massDriverScrewMesh = new THREE.Mesh(massDriverScrewGeometry, massDriverScrewMaterial)

    return massDriverScrewMesh
  }
}

function createSledGrapplerMesh(dParamWithUnits, baseDistanceAlongScrew, bodyLength, grapplerDistance, massDriverScrewTexture) {
  // Each model along the mass driver curve is unique, since the pitch of the mass driver's drive thread changes along it's length
  // so instead of dynamically allocating models from a pool of identical unallocated models, we need to create a unique model for each portion of the mass driver curve.
  // We can't dynamically reallocate these models, since each model always has to be placed in the location that it was designed for.
  // However, we can still hide and models, and also not update them, when they are too far from the camera to be visible.
  const shaftRadius = dParamWithUnits['launcherMassDriverScrewShaftRadius'].value
  const threadRadius = dParamWithUnits['launcherMassDriverScrewThreadRadius'].value
  const threadThickness = dParamWithUnits['launcherMassDriverScrewThreadThickness'].value
  const threadStarts = dParamWithUnits['launcherMassDriverScrewThreadStarts'].value
  const launcherMassDriverScrewRevolutionsPerSecond = dParamWithUnits['launcherMassDriverScrewRevolutionsPerSecond'].value
  const launcherMassDriverForwardAcceleration = dParamWithUnits['launcherMassDriverForwardAcceleration'].value
  const launcherMassDriverInitialVelocity = dParamWithUnits['launcherMassDriverInitialVelocity'].value
  const numGrapplers = dParamWithUnits['launchSledNumGrapplers'].value
  const magnetThickness = dParamWithUnits['launchSledGrapplerMagnetThickness'].value
  const shaftToGrapplerPad = dParamWithUnits['launchSledShaftToGrapplerPad'].value
  const additionalRotation = 0

  const info = new SledGrapplerPlacementInfo(
    shaftRadius,
    threadRadius,
    threadThickness,
    threadStarts,
    launcherMassDriverScrewRevolutionsPerSecond,
    launcherMassDriverForwardAcceleration,
    launcherMassDriverInitialVelocity,
    baseDistanceAlongScrew,
    bodyLength,
    numGrapplers,
    magnetThickness,
    shaftToGrapplerPad,
    additionalRotation
  )
  info.generatePlacementInfo(grapplerDistance)

  const sledGrapplerGeometry = new SledGrapplerGeometry(
    shaftRadius,
    threadRadius,
    threadThickness,
    threadStarts,
    launcherMassDriverScrewRevolutionsPerSecond,
    launcherMassDriverForwardAcceleration,
    launcherMassDriverInitialVelocity,
    baseDistanceAlongScrew,
    bodyLength,
    numGrapplers,
    magnetThickness,
    shaftToGrapplerPad,
    additionalRotation,
    grapplerDistance,
    info.offset
  )

  const sledGrapplerMaterial = new THREE.MeshPhongMaterial({wireframe: false, color: 0x3f7f3f})
  //const sledGrapplerMaterial = new THREE.MeshStandardMaterial({map: massDriverScrewTexture})
  return new THREE.Mesh(sledGrapplerGeometry, sledGrapplerMaterial)
}

class evacuatedTubeModel {
  // Each model along the mass driver curve is unique, since the pitch of the mass driver's drive thread changes along it's length
  // so instead of dynamically allocating models from a pool of identical unallocated models, we need to create a unique model for each portion of the mass driver curve.
  // We can't dynamically reallocate these models, since each model always has to be placed in the location that it was designed for.
  // However, we can still hide and models, and also not update them, when they are too far from the camera to be visible.
  constructor(dParamWithUnits, evacuatedTubeCurve, segmentIndex) {

    const evacuatedTubeSegments = dParamWithUnits['launcherEvacuatedTubeNumModels'].value
    const radius = dParamWithUnits['launcherEvacuatedTubeRadius'].value
    const modelLengthSegments = 32
    const modelRadialSegments = 32
    const tubePoints = []

    // Now we need a reference point in the middle of this segment of the whole mass driver
    const modelsCurvePosition = (segmentIndex + 0.5) / evacuatedTubeSegments
    const refPoint = evacuatedTubeCurve.getPoint(modelsCurvePosition)
    const orientation = new THREE.Quaternion()
    orientation.setFromUnitVectors(evacuatedTubeCurve.getTangent(modelsCurvePosition), new THREE.Vector3(0, 1, 0))

    // We need to define a curve for this segment of the mass driver, and then use that curve to create a tube geometry for this model
    for (let i = 0; i<=modelLengthSegments; i++) {
      const modelsCurvePosition = (segmentIndex + i/modelLengthSegments) / evacuatedTubeSegments
      tubePoints.push(evacuatedTubeCurve.getPoint(modelsCurvePosition).sub(refPoint).applyQuaternion(orientation))
    }

    const evacuatedTubeSegementCurve = new CatmullRomSuperCurve3(tubePoints)
    const evacuatedTubeTubeGeometry = new THREE.TubeGeometry(evacuatedTubeSegementCurve, modelLengthSegments, radius, modelRadialSegments, false)
    const evacuatedTubeTubeMaterial = new THREE.MeshPhongMaterial( {side: THREE.DoubleSide, transparent: true, opacity: 0.25})
    const evacuatedTubeTubeMesh = new THREE.Mesh(evacuatedTubeTubeGeometry, evacuatedTubeTubeMaterial)

    return evacuatedTubeTubeMesh
  }
}




export class launcher {

    constructor(dParamWithUnits, planetCoordSys, tetheredRingRefCoordSys, radiusOfPlanet, mainRingCurve, crv, xyChart, clock, specs, genLauncherKMLFile, kmlFile) {
      this.const_G = 0.0000000000667408;
      this.clock = clock
      this.versionNumber = 0

      // Possible User defined (e.g. if user changes the planet)
      this.const_g = 9.8;
      this.const_M = 5.9722E+24;
      this.mu = this.const_G * this.const_M;
      this.R_Earth = 6371000;
      this.xyChart = xyChart

      // User defined parameters
      this.MPayload = 60000;
      this.Alt_LEO = 400000;
      this.Alt_Perigee = 48000;
      this.WholesaleElectricityCost = 0.05;
      this.LiquidHydrogenCostPerGallon = 0.98;
      this.LiquidOxygenCostPerGallon = 0.67;
      this.MassOfOneGallonOfLiquidHydrogen = 0.2679; // kg / Gallon
      this.MassOfOneGallonOfLiquidOxygen = 4.322; // kg / Gallon
      this.MassOfHydrogen = 384071 * this.MassOfOneGallonOfLiquidHydrogen;
      this.MassOfOxygen = 141750 * this.MassOfOneGallonOfLiquidOxygen;
      this.FuelCostPerkg = (this.MassOfHydrogen / this.MassOfOneGallonOfLiquidHydrogen * this.LiquidHydrogenCostPerGallon + this.MassOfOxygen / this.MassOfOneGallonOfLiquidOxygen * this.LiquidOxygenCostPerGallon) / (this.MassOfHydrogen + this.MassOfOxygen);
      this.EstimatedCostToFuelSLSToLEO = ((979452 - 85270) + (30710 - 3490)) * this.FuelCostPerkg / 95000;
      this.RocketsSpecificImpulse = 452; // RS-25
      this.RocketEnginesMass = 3527; // RS-25
      this.LauncherEfficiency = 0.75;
      this.MaxGees = 3;
      this.LauncherAltitude = 32000;
      this.Alt_EvacuatedTube = 32000;
      this.VehicleRadius = 2.4/2; // Assuming a cylindrically shaped vehicle the diameter of an RS-25 Rocket Engine
      this.CoefficientOfDrag = 0.4;

      this.scene = planetCoordSys

      this.timeWithinMassDriver = dParamWithUnits['launcherMassDriverExitVelocity'].value / dParamWithUnits['launcherMassDriverForwardAcceleration'].value
    
      const redMaterial = new THREE.MeshLambertMaterial({color: 0xdf4040})
      const greenMaterial = new THREE.MeshLambertMaterial({color: 0x40df40})
      const blueMaterial = new THREE.MeshLambertMaterial({color: 0x4040df})
      this.LaunchTrajectoryMarker1 = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), redMaterial)
      const LaunchTrajectoryMarkerSize = dParamWithUnits['launcherMarkerRadius'].value
      this.LaunchTrajectoryMarker1.scale.set(LaunchTrajectoryMarkerSize, LaunchTrajectoryMarkerSize, LaunchTrajectoryMarkerSize)
      this.LaunchTrajectoryMarker2 = this.LaunchTrajectoryMarker1.clone()
      this.LaunchTrajectoryMarker2.material = greenMaterial
      this.LaunchTrajectoryMarker3 = this.LaunchTrajectoryMarker1.clone()
      this.LaunchTrajectoryMarker3.material = blueMaterial
      this.LaunchTrajectoryMarker4 = this.LaunchTrajectoryMarker1.clone()
      planetCoordSys.add(this.LaunchTrajectoryMarker1)
      planetCoordSys.add(this.LaunchTrajectoryMarker2)
      planetCoordSys.add(this.LaunchTrajectoryMarker3)
      planetCoordSys.add(this.LaunchTrajectoryMarker4)
      this.LaunchTrajectoryMarker1.visible = dParamWithUnits['showLaunchTrajectory'].value
      this.LaunchTrajectoryMarker2.visible = dParamWithUnits['showLaunchTrajectory'].value
      this.LaunchTrajectoryMarker3.visible = dParamWithUnits['showLaunchTrajectory'].value
      this.LaunchTrajectoryMarker4.visible = dParamWithUnits['showLaunchTrajectory'].value

      this.launchTrajectoryCurve = null
      this.launchTrajectoryMesh = null

      this.numWedges = 1
      this.unallocatedLaunchVehicleModels = []
      this.unallocatedLaunchSledModels = []
      this.refFrames = [
        // For vehicles cruising at a steady speed...
        new referenceFrame(this.numWedges)
      ]
      this.actionFlags = new Array(this.numWedges).fill(0)
      this.perfOptimizedThreeJS = dParamWithUnits['perfOptimizedThreeJS'].value ? 1 : 0

      this.updateTrajectoryCurves(dParamWithUnits, planetCoordSys, tetheredRingRefCoordSys, radiusOfPlanet, mainRingCurve, crv, specs, genLauncherKMLFile, kmlFile)
      // Next, create all of the virtual objects that will be placed along the launch trajectory curve

      // Hack
      this.massDriverScrewTexture = new THREE.TextureLoader().load( './textures/steelTexture.jpg' )

      // Add the virtual launch sleds and launch vehicles
      const tInc = dParamWithUnits['launchVehicleSpacingInSeconds'].value
      let t, n, wedgeIndex
      // Put all of the virtual launch vehicles into the same wedge for now
      wedgeIndex = 0
      const refFrame = this.refFrames[0]
      // Hack - remove "&& (n<150)"
      for (t = -.02, n = 0; (t<this.durationOfLaunchTrajectory) && (n<50); t += tInc, n++) {
        refFrame.wedges[wedgeIndex]['virtualLaunchSleds'].push(new virtualLaunchSled(-t, this.unallocatedLaunchSledModels))
        refFrame.wedges[wedgeIndex]['virtualLaunchVehicles'].push(new virtualLaunchVehicle(-t, this.unallocatedLaunchVehicleModels))
      }

      // Create and add the launch sleds
      const launchSledMesh = new launchSledModel(dParamWithUnits, this.massDriverSuperCurve, this.launcherMassDriverLength, this.massDriverScrewSegments, this.massDriverScrewTexture)
      // n = dParamWithUnits['launchVehicleNumModels'].value
      addLaunchSleds(launchSledMesh, this.scene, this.unallocatedLaunchSledModels, 'launchSled', 1, n, this.perfOptimizedThreeJS)

      function addLaunchSleds(object, myScene, unallocatedModelsList, objName, scaleFactor, n, perfOptimizedThreeJS) {
        object.updateMatrixWorld()
        object.visible = false
        object.name = objName
        object.traverse(child => {
          if (child!==object) {
            child.name = objName+'_'+child.name
          }
        })
        if (perfOptimizedThreeJS) object.children.forEach(child => child.freeze())
        object.scale.set(scaleFactor, scaleFactor, scaleFactor)
        for (let i=0; i<n; i++) {
          const tempModel = object.clone()
          myScene.add(tempModel)
          unallocatedModelsList.push(tempModel)
        }
      }

      // Create and add the launch vechicle models
      const launchVehicleMesh = new launchVehicleModel(dParamWithUnits)
      // n = dParamWithUnits['launchVehicleNumModels'].value
      addLaunchVehicles(launchVehicleMesh, this.scene, this.unallocatedLaunchVehicleModels, 'launchVehicle', 1, n, this.perfOptimizedThreeJS)

      function addLaunchVehicles(object, myScene, unallocatedModelsList, objName, scaleFactor, n, perfOptimizedThreeJS) {
        object.updateMatrixWorld()
        object.visible = false
        object.name = objName
        object.traverse(child => {
          if (child!==object) {
            child.name = objName+'_'+child.name
          }
        })
        if (perfOptimizedThreeJS) object.children.forEach(child => child.freeze())
        object.scale.set(scaleFactor, scaleFactor, scaleFactor)
        for (let i=0; i<n; i++) {
          const tempModel = object.clone()
          myScene.add(tempModel)
          unallocatedModelsList.push(tempModel)
        }
      }

      // Add the virtual mass drivers and a model for each virtual mass driver

      // ToDo: Since there's a one-to-one mapping between real and virtual components here, consider whether virtual components are really needed.
      
      wedgeIndex = 0
      n = dParamWithUnits['launcherMassDriverTubeNumModels'].value
      for (let i = 0; i < n; i++) {
        const d = (i+0.5)/n
        const vmdt = new virtualMassDriverTube(d)
        refFrame.wedges[wedgeIndex]['virtualMassDriverTubes'].push(vmdt)
        vmdt.model = new massDriverTubeModel(dParamWithUnits, this.massDriverSuperCurve, i)
        vmdt.model.name = 'massDriverTube'
        this.scene.add(vmdt.model)
        const vmdr = new virtualMassDriverRail(d)
        refFrame.wedges[wedgeIndex]['virtualMassDriverRails'].push(vmdr)
        vmdr.model = new massDriverRailModel(dParamWithUnits, this.massDriverSuperCurve, i)
        vmdr.model.name = 'massDriverRail'
        this.scene.add(vmdr.model)
      }

      n = this.massDriverScrewSegments
      const halfBracketThickness = dParamWithUnits['launcherMassDriverScrewBracketThickness'].value / 2 / this.launcherMassDriverLength
      // Hack: Until we figure out a more efficient way to generate screw models for large numbers of screws
      this.nLimit = 20

      for (let i = 0; i < Math.min(this.nLimit, n); i++) {
        const d = (i+0.5)/n - halfBracketThickness
        const leftmodel = new massDriverScrewModel(dParamWithUnits, this.launcherMassDriverLength, this.massDriverScrewSegments, i, this.massDriverScrewTexture)
        leftmodel.name = 'massDriverScrew'
        for (let lr = -1; lr < 2; lr+=2) {
          const vmds = new virtualMassDriverScrew(d, lr)
          refFrame.wedges[wedgeIndex]['virtualMassDriverScrews'].push(vmds)
          vmds.model = leftmodel.clone()
          vmds.model.scale.set(lr, 1, 1)
          this.scene.add(vmds.model)
        }
        const vmdb = new virtualMassDriverBracket(d)
        refFrame.wedges[wedgeIndex]['virtualMassDriverBrackets'].push(vmdb)
        vmdb.model = new massDriverBracketModel(dParamWithUnits, this.massDriverSuperCurve, this.launcherMassDriverLength, this.massDriverScrewSegments, i)
        vmdb.model.name = 'massDriverBracket'
        this.scene.add(vmdb.model)
      }

      // Add the virtual evacuated tube and a model for each virtual evacuated tube
      wedgeIndex = 0
      n = dParamWithUnits['launcherEvacuatedTubeNumModels'].value
      for (let i = 0; i < n; i++) {
        const orientation = new THREE.Quaternion
        orientation.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.evacuatedTubeCurve.getTangentAt((i+0.5)/n))
        const vet = new virtualEvacuatedTube((i+0.5)/n, orientation)        
        refFrame.wedges[wedgeIndex]['virtualEvacuatedTubes'].push(vet)
        vet.model = new evacuatedTubeModel(dParamWithUnits, this.evacuatedTubeCurve, i)
        vet.model.name = 'evacuatedTube'
        this.scene.add(vet.model)
      }

      this.update(dParamWithUnits)
    }

    update(dParamWithUnits) {
      this.versionNumber++
      virtualMassDriverTube.update(dParamWithUnits, this.massDriverSuperCurve, this.versionNumber)
      virtualMassDriverRail.update(dParamWithUnits, this.massDriverSuperCurve, this.versionNumber)
      virtualMassDriverBracket.update(dParamWithUnits, this.massDriverSuperCurve, this.versionNumber)
      virtualMassDriverScrew.update(dParamWithUnits, this.massDriverSuperCurve, this.versionNumber)
      virtualEvacuatedTube.update(dParamWithUnits, this.evacuatedTubeCurve)
      virtualLaunchSled.update(dParamWithUnits, this.massDriverSuperCurve, this.launcherMassDriverLength, this.scene, this.clock)
      virtualLaunchVehicle.update(dParamWithUnits, this.launchTrajectoryCurve, this.massDriverSuperCurve, this.launcherMassDriverLength, this.durationOfLaunchTrajectory, this.timeWithinMassDriver, this.curveUpTime, this.timeWithinEvacuatedTube)
      this.animateLaunchVehicles = dParamWithUnits['animateLaunchVehicles'].value ? 1 : 0
      this.animateLaunchSleds = dParamWithUnits['animateLaunchSleds'].value ? 1 : 0

      const wedgeIndex = 0
      const n = this.massDriverScrewSegments
      const refFrame = this.refFrames[0]
      const screwsArray = refFrame.wedges[wedgeIndex]['virtualMassDriverScrews']

      this.LaunchTrajectoryMarker1.visible = dParamWithUnits['showLaunchTrajectory'].value
      this.LaunchTrajectoryMarker2.visible = dParamWithUnits['showLaunchTrajectory'].value
      this.LaunchTrajectoryMarker3.visible = dParamWithUnits['showLaunchTrajectory'].value
      this.LaunchTrajectoryMarker4.visible = dParamWithUnits['showLaunchTrajectory'].value
      this.xyChart.chartGroup.visible = dParamWithUnits['showXYChart'].value

      // Very Hacky...
      // if (screwsArray.length == 2 * this.nLimit) {
      //   // Hack: Until we figure out a more efficient way to generate screw models for large numbers of screws
      //   for (let i = 0; i < Math.min(this.nLimit, n); i++) {
      //     for (let lr = -1; lr < 2; lr+=2) {
      //       //const vmds = new virtualMassDriverScrew((i+0.5)/n, orientation, lr)
      //       const index = i*2+(1+lr)/2
      //       const oldModel = refFrame.wedges[wedgeIndex]['virtualMassDriverScrews'][index].model
      //       this.scene.remove(oldModel)
      //       const newModel = new massDriverScrewModel(dParamWithUnits, this.launcherMassDriverLength, this.massDriverScrewSegments, i, this.massDriverScrewTexture)
      //       refFrame.wedges[wedgeIndex]['virtualMassDriverScrews'][index].model = newModel
      //       this.scene.add(newModel)
      //     }
      //   }
      // }
    }

    updateTrajectoryCurves(dParamWithUnits, planetCoordSys, tetheredRingRefCoordSys, radiusOfPlanet, mainRingCurve, crv, specs, genLauncherKMLFile, kmlFile) {
      // The goal is to position the suspended portion of the evacuated launch tube under the tethered ring's tethers. The portion of the launch tube that contains the mass driver will be on the planet's surface.
      // Let's start by defining the sothern most point on the ring as the end of the mass driver. Then we can create a curve that initially follows the surface of the Earth and then, from the end of the mass driver,
      // follows a hyperbolic trajectory away from the earth.

      // console.print: console.log without filename/line number
      console.print = function (...args) {
        queueMicrotask (console.log.bind (console, ...args));
      }

      // ***************************************************************
      // Design the mass driver
      // ***************************************************************

      let forwardAcceleration
      let upwardAcceleration
      let timeNow = this.clock.getElapsedTime()
      function gotStuckCheck(clock, timeNow, t, msg) {
        if (t%2==0) {
          if (timeNow + 2 < clock.getElapsedTime()) {
            console.log('Stuck in ', msg)
            return true
          }
          else {
            return false
          }
        }
        else {
          return false
        }
      }

      const launcherMassDriverInitialVelocity = dParamWithUnits['launcherMassDriverInitialVelocity'].value
      const launcherMassDriverExitVelocity = dParamWithUnits['launcherMassDriverExitVelocity'].value
      const launcherMassDriverAltitude = dParamWithUnits['launcherMassDriverAltitude'].value
      const launcherEvacuatedTubeExitAltitude = dParamWithUnits['launcherEvacuatedTubeExitAltitude'].value

      forwardAcceleration = dParamWithUnits['launcherMassDriverForwardAcceleration'].value

      // Determine the time in the mass driver from acceleration, initial velocity, and final velocity
      // vf = v0 + at, therefore t = (vf-v0)/a
      const launcherMassDriverAccelerationTime = (launcherMassDriverExitVelocity - launcherMassDriverInitialVelocity) / forwardAcceleration
      specs['launcherMassDriverAccelerationTime'] = {value: launcherMassDriverAccelerationTime, units: 's'}
      this.timeWithinMassDriver = launcherMassDriverAccelerationTime

      const launcherMassDriverLength = launcherMassDriverInitialVelocity * launcherMassDriverAccelerationTime + 0.5 * forwardAcceleration * launcherMassDriverAccelerationTime**2
      specs['launcherMassDriverLength'] = {value: launcherMassDriverLength, units: 's'}
      this.launcherMassDriverLength = launcherMassDriverLength
      this.launcherMassDriverScrewModelRoughLength = dParamWithUnits['launcherMassDriverScrewModelRoughLength'].value  // This is the length we want to specify for dynamic model allocation purposes, not a real dimension used to specify the hardware.
      this.massDriverScrewSegments = Math.ceil(launcherMassDriverLength / this.launcherMassDriverScrewModelRoughLength)

      // ***************************************************************
      // Design the ramp. The ramp is positioned at the end of the mass driver to divert the vehicle's trajectory skwards.
      // ***************************************************************
      // Clamp the altitude of the ramp to be between the altitude of the launcher and the altitude of the main ring.
      const launcherRampExitAltitude = Math.max(launcherMassDriverAltitude, Math.min(dParamWithUnits['launcherRampExitAltitude'].value, launcherEvacuatedTubeExitAltitude))
      const launcherMassDriverUpwardAcceleration = dParamWithUnits['launcherMassDriverUpwardAcceleration'].value
      const accelerationOfGravity = 9.8 // m/s2 // ToDo: Should make this a function of the selected planet
      const allowableUpwardTurningRadius = launcherMassDriverExitVelocity**2 / (launcherMassDriverUpwardAcceleration - accelerationOfGravity)

      // Make a triangle ABC where A is the center of the planet, B is the end of the ramp, and C is the center of the circle that defines the allowable turning radius
      const triangleSideAB = radiusOfPlanet + launcherRampExitAltitude
      const triangleSideAC = radiusOfPlanet + launcherMassDriverAltitude + allowableUpwardTurningRadius
      const triangleSideBC = allowableUpwardTurningRadius
      // Use law of cosines to find the angles at C and B
      const angleACB = Math.acos((triangleSideAC**2 + triangleSideBC**2 - triangleSideAB**2) / (2*triangleSideAC*triangleSideBC))
      const angleABC = Math.acos((triangleSideAB**2 + triangleSideBC**2 - triangleSideAC**2) / (2*triangleSideAB*triangleSideBC))
      const angleBAC = Math.PI - angleACB - angleABC
      const upwardAngleAtEndOfRamp = Math.PI - angleABC

      const rampBaseLength = angleBAC * (radiusOfPlanet + launcherMassDriverAltitude) // This is the length along the base of the ramp, measured at ground level, assuming the altitude of the ground is the same as the altitude of the launcher

      // console.log('triangleSideAB', triangleSideAB)
      // console.log('triangleSideAC', triangleSideAC)
      // console.log('triangleSideBC', triangleSideBC)
      // console.log('angleACB', angleACB, angleACB*180/Math.PI)
      // console.log('upwardAngleAtEndOfRamp', upwardAngleAtEndOfRamp, upwardAngleAtEndOfRamp*180/Math.PI)

      this.launcherRampLength = angleACB * allowableUpwardTurningRadius
      this.curveUpTime = this.launcherRampLength / launcherMassDriverExitVelocity // ToDo: This is inaccurate as it does not take into account the loss of speed due to coasting up teh ramp.

      // Let's define the end of the ramp as the launcher's exit position, since from that point on the vehicles will either be coasting or accelerating under their own power.
      // Also, it's a position that we can stick at the top of a mountain ridge and from their adjust parameters like launcer accelleration, etc.
      
      const evacuatedTubeEntrancePositionAroundRing = dParamWithUnits['evacuatedTubeEntrancePositionAroundRing'].value
      const evacuatedTubeEntrancePositionInRingRefCoordSys = mainRingCurve.getPoint(evacuatedTubeEntrancePositionAroundRing)
      // Adjust the altitude of the positions to place it the correct distance above the earth's surface
      evacuatedTubeEntrancePositionInRingRefCoordSys.multiplyScalar((radiusOfPlanet + launcherRampExitAltitude) / (radiusOfPlanet + crv.currentMainRingAltitude))
      const evacuatedTubeEntrancePosition = planetCoordSys.worldToLocal(tetheredRingRefCoordSys.localToWorld(evacuatedTubeEntrancePositionInRingRefCoordSys.clone()))

      // ***************************************************************
      // Now design the evacuated tube that the vehicles will travel within from the end of the ramp to the altitude of the main ring.  
      // ***************************************************************

      const R0 = new THREE.Vector3(radiusOfPlanet + launcherRampExitAltitude, 0, 0)  // This is the vehicle's altitude (measured from the plantet's center) and downrange position at the exit of the launcher
      
      // for (let launcherMassDriverExitVelocity = 100; launcherMassDriverExitVelocity<8000; launcherMassDriverExitVelocity+=100) {
      //   const V0 = new THREE.Vector3(launcherMassDriverExitVelocity * Math.sin(upwardAngleAtEndOfRamp), launcherMassDriverExitVelocity * Math.cos(upwardAngleAtEndOfRamp), 0) // This is the vehicle's velocity vector at the exit of the launcher
      //   const coe = this.orbitalElementsFromStateVector(R0, V0)
      //   const c = coe.semimajorAxis * coe.eccentricity
      //   const apogeeDistance = coe.semimajorAxis + c
      //   const speedAtApogee = Math.sqrt(this.mu * (2 / apogeeDistance - 1 / coe.semimajorAxis))
      //   const speedOfCircularizedOrbit = Math.sqrt(this.mu / apogeeDistance)
      //   const deltaVNeededToCircularizeOrbit = speedOfCircularizedOrbit - speedAtApogee
      //   const launchVehicleRocketExhaustVelocity = dParamWithUnits['launchVehicleRocketExhaustVelocity'].value
      //   const m0Overmf = Math.exp(deltaVNeededToCircularizeOrbit / launchVehicleRocketExhaustVelocity)
      //   console.print(launcherMassDriverExitVelocity, Math.round(apogeeDistance - radiusOfPlanet), Math.round(deltaVNeededToCircularizeOrbit), Math.round(m0Overmf * 100)/100)
      // }

      const V0 = new THREE.Vector3(launcherMassDriverExitVelocity * Math.sin(upwardAngleAtEndOfRamp), launcherMassDriverExitVelocity * Math.cos(upwardAngleAtEndOfRamp), 0) // This is the vehicle's velocity vector at the exit of the launcher
      const coe = this.orbitalElementsFromStateVector(R0, V0)
      const c = coe.semimajorAxis * coe.eccentricity
      const apogeeDistance = coe.semimajorAxis + c
      const speedAtApogee = Math.sqrt(this.mu * (2 / apogeeDistance - 1 / coe.semimajorAxis))
      const speedOfCircularizedOrbit = Math.sqrt(this.mu / apogeeDistance)
      const deltaVNeededToCircularizeOrbit = speedOfCircularizedOrbit - speedAtApogee
      const launchVehicleRocketExhaustVelocity = dParamWithUnits['launchVehicleRocketExhaustVelocity'].value
      const m0Overmf = Math.exp(deltaVNeededToCircularizeOrbit / launchVehicleRocketExhaustVelocity)
      //console.log(coe)
      console.log('speedAtApogee', speedAtApogee)
      console.log('apogeeAltitude', apogeeDistance - radiusOfPlanet)
      console.log('deltaVNeededToCircularizeOrbit', deltaVNeededToCircularizeOrbit)
      console.log('m0Overmf', m0Overmf)

      // Better V0 calculation - we need to take into account the rotation of the planet...
      //const V0 = new THREE.Vector2(launcherMassDriverExitVelocity * Math.sin(upwardAngleAtEndOfRamp), launcherMassDriverExitVelocity * Math.cos(upwardAngleAtEndOfRamp)) // This is the vehicle's velocity vector at the exit of the launcher
      //console.log(R0, V0)

      // We want to find the downrange distance where the vehicle's altitude is equal to the desired suspended evacuated tube exit altitude (or the ground, if it's not going fast enough).
      // We will solve for this iteratively, although there's probably a better way...
      // We will also assume that the vehicle will not fire it's rocket engine while it is within the evacuated tube.
      let t = 0
      let tStep = .1 // second
      let RV, distSquared
      let converging = true
      let lastDifference = -1

      const planetRadiusSquared = radiusOfPlanet**2
      const ringDistSquared = (radiusOfPlanet + launcherEvacuatedTubeExitAltitude)**2
      //console.log('Calculating downrange distance from end of ramp to a point on the hyperbolic trajectory at the ring\'s altitude')
      for (t = 0; (Math.abs(tStep)>0.01) && t<dParamWithUnits['launcherCoastTime'].value && converging; t+=tStep) {
        RV = this.RV_from_R0V0andt(R0.x, R0.y, V0.x, V0.y, t)
        distSquared = RV.R.x**2 + RV.R.y**2
        const withinBoundaries = (distSquared < ringDistSquared) && (distSquared > planetRadiusSquared) 
        if (withinBoundaries ^ (tStep>0)) {
          tStep = -tStep/2
        }
        else {
          // Check that we're converging towards (as opposed to diverging from) a solution
          const difference = Math.abs(distSquared - ringDistSquared)
          if ((lastDifference !== -1) && (difference > lastDifference)) {
            converging = false
          }
          else {
            lastDifference = difference
          }
        }
        if (gotStuckCheck(this.clock, timeNow, t, 'the downrange distance calculation')) break
      }
      if (!converging) {
        console.log('Warning: The downrange distance calculation did not converge')
      }
      //console.log('done')
      this.timeWithinEvacuatedTube = t

      const evacuatedTubeDownrangeAngle = Math.atan2(RV.R.y, RV.R.x)  // This is the angle subtending the end of the ramp, center of the earth, and the end of the evacuated tube

      // ***************************************************************
      // Next we need to place the end of the ramp and the end of the evacuated tube at locations that are directly under the ring, 
      // so that the lightweight evacuated tube that the launched vehicles will inititially coast through can be suspended from the ring.

      // Convert the angle relative to the center of the Earth to an angle relative to the center of the ring 
      const straightLineHalfDistance = Math.sin(evacuatedTubeDownrangeAngle/2) * (radiusOfPlanet + crv.currentMainRingAltitude)
      const evacuatedTubeRingAngle = Math.asin(straightLineHalfDistance / crv.mainRingRadius) * 2

      const evacuatedTubeExitPositionAroundRing = (1 + evacuatedTubeEntrancePositionAroundRing - evacuatedTubeRingAngle / (2*Math.PI)) % 1
      const evacuatedTubeExitPositionInRingRefCoordSys = mainRingCurve.getPoint(evacuatedTubeExitPositionAroundRing)
      // Adjust the altitude of the positions to place it the correct distance above the earth's surface
      evacuatedTubeExitPositionInRingRefCoordSys.multiplyScalar((radiusOfPlanet + launcherEvacuatedTubeExitAltitude) / (radiusOfPlanet + crv.currentMainRingAltitude))
      // Convert thes positions into the planet's coordinate system 
      const evacuatedTubeExitPosition = planetCoordSys.worldToLocal(tetheredRingRefCoordSys.localToWorld(evacuatedTubeExitPositionInRingRefCoordSys.clone()))

      // Generate an axis of rotation for define the curvatures of the mass driver and the ramp
      this.axisOfRotation = new THREE.Vector3().crossVectors(evacuatedTubeEntrancePosition, evacuatedTubeExitPosition.clone().sub(evacuatedTubeEntrancePosition)).normalize()

      // Calculate a vector that points to the exit of teh mass drive (and the entrance to the ramp)
      const massDriverExitPosition = evacuatedTubeEntrancePosition.clone().applyAxisAngle(this.axisOfRotation, -rampBaseLength / (radiusOfPlanet + launcherMassDriverAltitude))
      massDriverExitPosition.multiplyScalar((radiusOfPlanet + launcherMassDriverAltitude) / (radiusOfPlanet + launcherRampExitAltitude))

      // Position markers at the end of the mass driver and at entrance and exit positions of the evacuated tube
      this.LaunchTrajectoryMarker1.position.copy(massDriverExitPosition)
      this.LaunchTrajectoryMarker2.position.copy(evacuatedTubeEntrancePosition)
      this.LaunchTrajectoryMarker3.position.copy(evacuatedTubeExitPosition)

      // ***************************************************************
      // Next we need to capture some curves and data sets for plotting
      // ***************************************************************

      const launchTrajectoryCurveControlPoints = []
      const massDriverCurveControlPoints = []
      const evacuatedTubeCurveControlPoints = []

      const altitudeVesusTimeData = []
      const speedVersusTimeData = []
      const downrangeDistanceVersusTimeData = []
      const forwardAccelerationVersusTimeData = []
      const lateralAccelerationVersusTimeData = []
      const aerodynamicDragVersusTimeData = []
      const totalMassVerusTimeData = []

      const t1 = this.timeWithinMassDriver
      const t2 = t1 + this.curveUpTime
      const t3 = t2 + this.timeWithinEvacuatedTube
      const t4 = t3 + dParamWithUnits['launcherCoastTime'].value

      let vehiclePosition
      let vehicleAirSpeed
      let distanceTravelled
      let altitude

      // Prep the vehicle's initial conditions
      const mVehicle = dParamWithUnits['launchVehicleEmptyMass'].value
      const mPayload = dParamWithUnits['launchVehiclePayloadMass'].value
      let mPropellant = dParamWithUnits['launchVehiclePropellantMass'].value
      let m0 = mVehicle + mPayload + mPropellant // mass of vehicle, payload, and propellant

      t = 0
      tStep = .1 // second

      // ***************************************************************
      // Create the part of the trajectory where the vehicle is within mass driver near the planet's surface
      // ***************************************************************
      this.massDriverSuperCurve = new CircleSuperCurve3(new THREE.Vector3(0, 0, 0), this.axisOfRotation, massDriverExitPosition, -launcherMassDriverLength)
      function tTos(t, launcherMassDriverInitialVelocity, forwardAcceleration) {
        return launcherMassDriverInitialVelocity + forwardAcceleration * t  // 1/2 at^2
      }
      function tTod(t, launcherMassDriverInitialVelocity, forwardAcceleration) {
        return launcherMassDriverInitialVelocity * t + 0.5 * forwardAcceleration * t * t  // 1/2 at^2
      }
      this.massDriverSuperCurve.addtTodConvertor(tTod)

      // Start the launch trajectory curve at the beginning of the mass driver.
      //console.log('Creating mass driver part of trajectory.')
      upwardAcceleration = 0   // This does not include the acceleration of gravity from the planet
      altitude = launcherMassDriverAltitude

      for (t = 0; t < this.timeWithinMassDriver; t += tStep) {
        vehicleAirSpeed = tTos(t, launcherMassDriverInitialVelocity, forwardAcceleration)
        distanceTravelled = tTod(t, launcherMassDriverInitialVelocity, forwardAcceleration)
        // Rotate the massDriverExitPosition around the axisOfRotation using the angle derived from the distance travelled
        vehiclePosition = massDriverExitPosition.clone().applyAxisAngle(this.axisOfRotation, (distanceTravelled - launcherMassDriverLength) / (radiusOfPlanet + launcherMassDriverAltitude))
        //console.log('old angle', (distanceTravelled - launcherMassDriverLength) / (radiusOfPlanet + launcherMassDriverAltitude))
        const vp2 = this.massDriverSuperCurve.getPointAt(distanceTravelled/launcherMassDriverLength)
        if (t==0) {
          this.startOfMassDriverPosition = vehiclePosition.clone()
        }
        launchTrajectoryCurveControlPoints.push(vehiclePosition)
        altitudeVesusTimeData.push(new THREE.Vector3(t, altitude, 0))
        downrangeDistanceVersusTimeData.push(new THREE.Vector3(t, distanceTravelled, 0))
        speedVersusTimeData.push(new THREE.Vector3(t, vehicleAirSpeed, 0))
        forwardAccelerationVersusTimeData.push(new THREE.Vector3(t, forwardAcceleration, 0))
        lateralAccelerationVersusTimeData.push(new THREE.Vector3(t, 0, 0))
        aerodynamicDragVersusTimeData.push(new THREE.Vector3(t, 0, 0)) // ToDo: Should make this a function of the level of vacuum and type of gas inside the mass drivers evacuated tube
        totalMassVerusTimeData.push(new THREE.Vector3(t, m0, 0))
      }
      //console.log('done')

      // ***************************************************************
      // Create the part of the trajectory where the vehicle is travelling along the upward curving ramp
      // ***************************************************************
      const l1 = massDriverExitPosition.length()   // Distance from the center of the planet to the end of the mass driver
      const v1 = massDriverExitPosition.clone().multiplyScalar((allowableUpwardTurningRadius + l1) / l1)  // Points to the center of the circle that defines the ramp's curve
      const v2 = massDriverExitPosition.clone().multiplyScalar(-allowableUpwardTurningRadius / l1)     // A vector from the center of the circle that defines the ramp back to the mass driver's exit position.
      //const pivotPoint = massDriverExitPosition.clone().multiplyScalar((l1+allowableUpwardTurningRadius)/l1)
      this.LaunchTrajectoryMarker4.position.copy(v1)

      forwardAcceleration = 0
      upwardAcceleration = launcherMassDriverUpwardAcceleration

      //console.log('Creating ramp part of trajectory.')
      for (; t<Math.min(t2, 10000); t+=tStep) {   // Hack - Min function added to prevent endless loop in case of bug
        // Rotate the vehicle position vector around center of the circle that defines the shape of the ramp
        const distanceTravelledAlongRamp = (t - this.timeWithinMassDriver) * launcherMassDriverExitVelocity   // ToDo: This assumes that somehow we maintain speed on the ramp, but really need a better formula here.
        vehiclePosition = v1.clone().add(v2.clone().applyAxisAngle(this.axisOfRotation, -distanceTravelledAlongRamp / allowableUpwardTurningRadius))
        vehicleAirSpeed = launcherMassDriverExitVelocity  // ToDo: This assumes that somehow we maintain speed on the ramp, but really need a better formula here.
        altitude = vehiclePosition.length() - radiusOfPlanet
        const downrangeAngle = massDriverExitPosition.angleTo(vehiclePosition)
        const downrangeDistance = launcherMassDriverLength + downrangeAngle * (radiusOfPlanet + launcherMassDriverAltitude)
        launchTrajectoryCurveControlPoints.push(vehiclePosition)
        altitudeVesusTimeData.push(new THREE.Vector3(t, altitude, 0))
        downrangeDistanceVersusTimeData.push(new THREE.Vector3(t, downrangeDistance, 0))
        speedVersusTimeData.push(new THREE.Vector3(t, vehicleAirSpeed, 0))
        forwardAccelerationVersusTimeData.push(new THREE.Vector3(t, forwardAcceleration, 0))
        lateralAccelerationVersusTimeData.push(new THREE.Vector3(t, upwardAcceleration, 0))
        aerodynamicDragVersusTimeData.push(new THREE.Vector3(t, 0, 0)) // ToDo: Should make this a function of the level of vacuum and type of gas inside the mass drivers evacuated tube
        totalMassVerusTimeData.push(new THREE.Vector3(t, m0, 0))

      }
      //console.log('done')

      vehiclePosition = v1.clone().add(v2.clone().applyAxisAngle(this.axisOfRotation, -angleACB))
      //this.LaunchTrajectoryMarker2.position.copy(vehiclePosition)
      const downrangeAngle = massDriverExitPosition.angleTo(vehiclePosition)
      const downrangeDistanceTravelledOnRamp = downrangeAngle * radiusOfPlanet
      distanceTravelled += angleACB * allowableUpwardTurningRadius

      // ***************************************************************
      // Create the part of the trajectory where the vehicle coasts on an eliptical or hyperbolic trajectory both within the evacuated tube and beyond
      // ***************************************************************
      // We'll need to generate some parameters to help us calculate the aerodynamic drage on the vehicle while it's travvelling through the raqrified uppoer atmosphere 
      const launchVehicleRadius = dParamWithUnits['launchVehicleRadius'].value
      const launchVehicleBodyLength = dParamWithUnits['launchVehicleBodyLength'].value
      const launchVehicleNoseConeLength = dParamWithUnits['launchVehicleNoseConeLength'].value
      const noseConeAngle = Math.atan2(launchVehicleRadius, launchVehicleNoseConeLength)
      
      let aerodynamicDrag
      let tStepState = 0
      let lastR = R0
      let distanceTravelledWithinEvacuatedTube = 0
      let distanceTravelledOutsideLaunchSystem = 0
      let warningAlreadyGiven = false
      const partialStep = 0  // Will be calcualte in the loop
      const tStep2 = [tStep, partialStep, partialStep, tStep]
      const l2 = evacuatedTubeEntrancePosition.length()
      //console.log('Creating hyprebolic part of trajectory.')
      for (; t < t4; t += tStep2[tStepState]) {
        const t5 = t - t2
        const RV = this.RV_from_R0V0andt(R0.x, R0.y, V0.x, V0.y, t5)
        const downrangeAngle = Math.atan2(RV.R.y, RV.R.x)
        // Calculate the vehicle's position relative to where R0 and V0 were when the vehicle was at R0.
        vehiclePosition = evacuatedTubeEntrancePosition.clone().applyAxisAngle(this.axisOfRotation, downrangeAngle).multiplyScalar(RV.R.length() / l2)
        vehicleAirSpeed = Math.sqrt(RV.V.y**2 + RV.V.x**2) // ToDo: The speed due to the planet's rotation needs to be calculated and factored in
        altitude = Math.sqrt(RV.R.y**2 + RV.R.x**2) - radiusOfPlanet
        const deltaDistanceTravelled = Math.sqrt((RV.R.x-lastR.x)**2 + (RV.R.y-lastR.y)**2) // ToDo: Would be better to find the equation for distance traveled along a hyperbolic path versus time.
        const downrangeDistance = launcherMassDriverLength + rampBaseLength + downrangeAngle * (radiusOfPlanet + launcherMassDriverAltitude)
        if (t<t3) {
          aerodynamicDrag = 0
          distanceTravelledWithinEvacuatedTube += deltaDistanceTravelled
        }
        else {
          distanceTravelledOutsideLaunchSystem += deltaDistanceTravelled
          aerodynamicDrag = this.GetAerodynamicDrag_ChatGPT(altitude, vehicleAirSpeed, noseConeAngle, launchVehicleRadius, launchVehicleBodyLength)
        }
        const fuelFlowRate = aerodynamicDrag / launchVehicleRocketExhaustVelocity
        mPropellant = Math.max(0, mPropellant - fuelFlowRate * tStep2[tStepState])
        if ((mPropellant == 0) && !warningAlreadyGiven) {
          console.log("Out of propellant!")
          warningAlreadyGiven = true
        }
        m0 = mVehicle + mPayload + mPropellant

        if (tStepState!=1) launchTrajectoryCurveControlPoints.push(vehiclePosition)
        altitudeVesusTimeData.push(new THREE.Vector3(t, altitude, 0))
        downrangeDistanceVersusTimeData.push(new THREE.Vector3(t, downrangeDistance, 0))
        speedVersusTimeData.push(new THREE.Vector3(t, vehicleAirSpeed, 0))
        forwardAccelerationVersusTimeData.push(new THREE.Vector3(t, 0, 0))
        lateralAccelerationVersusTimeData.push(new THREE.Vector3(t, 0, 0))
        aerodynamicDragVersusTimeData.push(new THREE.Vector3(t, aerodynamicDrag, 0)) // ToDo: Should make this a function of the level of vacuum and type of gas inside the suspended evacuated tube
        totalMassVerusTimeData.push(new THREE.Vector3(t, m0, 0))
        // Cause the value of t to make some extra stops when t ~= t3
        let nextTStepState = tStepState
        if ((tStepState==0) && (t<t3) && (t+tStep2[0]>=t3)) {
          if (t+tStep2[0]==t3) {
            nextTStepState = 4
          }
          else {
            nextTStepState = 1
            tStep2[1] = t3 - t    // Step needed to make a stop at t3
            tStep2[2] = t + tStep2[0] - t3 // Step needed to resume the previous cadence afetr t3
          }
        }
        else if ((tStepState>0) && (tStepState<3)) {
          nextTStepState = tStepState + 1
        }
        tStepState = nextTStepState
        lastR = RV.R
      }
      //console.log('done')
			this.durationOfLaunchTrajectory = t
      this.launcherEvacuatedTubeLength = distanceTravelledWithinEvacuatedTube
      distanceTravelled += distanceTravelledWithinEvacuatedTube
      const totalLengthOfLaunchSystem = distanceTravelled
      distanceTravelled += distanceTravelledOutsideLaunchSystem

      // Now create a curve consisting of equally spaced points to be the backbone of the mass driver object
      const numMassDriverCurveSegments = 128
      for (let i = 0; i <= numMassDriverCurveSegments; i++) {
        const d = i / numMassDriverCurveSegments * launcherMassDriverLength
        // Rotate the massDriverExitPosition around the axisOfRotation using the angle derived from the distance travelled
        vehiclePosition = massDriverExitPosition.clone().applyAxisAngle(this.axisOfRotation, (d - launcherMassDriverLength)  / l1)
        massDriverCurveControlPoints.push(vehiclePosition)
      }

      // Create a curve along the part of the trajectory where the vehicle coasts on a hyperbolic trajectory within the evacuated tube
      const numEvacuatedTubeCurveSegments = 128
      for (let i = 0; i <= numEvacuatedTubeCurveSegments; i++) {
        const t5 = i / numEvacuatedTubeCurveSegments * this.timeWithinEvacuatedTube
        const RV = this.RV_from_R0V0andt(R0.x, R0.y, V0.x, V0.y, t5)
        const downrangeAngle = downrangeDistanceTravelledOnRamp/radiusOfPlanet + Math.atan2(RV.R.y, RV.R.x)
        vehiclePosition = massDriverExitPosition.clone().applyAxisAngle(this.axisOfRotation, downrangeAngle).multiplyScalar(RV.R.length() / l1)
        evacuatedTubeCurveControlPoints.push(vehiclePosition)
      }
      //this.LaunchTrajectoryMarker3.position.copy(vehiclePosition)

      // Make a curve for the launch trajectory
      this.launchTrajectoryCurve = new CatmullRomSuperCurve3(launchTrajectoryCurveControlPoints)
      this.launchTrajectoryCurve.curveType = 'centripetal'
      this.launchTrajectoryCurve.closed = false
      this.launchTrajectoryCurve.tension = 0

      // Make a curve for the suspended evacuated tube
      this.evacuatedTubeCurve = new CatmullRomSuperCurve3(evacuatedTubeCurveControlPoints)
      this.evacuatedTubeCurve.curveType = 'centripetal'
      this.evacuatedTubeCurve.closed = false
      this.evacuatedTubeCurve.tension = 0

      // ToDo: Probably update should be calling this function, not the other way around.
      this.update(dParamWithUnits)

      this.xyChart.drawAxes()
      this.xyChart.labelAxes()
      this.xyChart.addCurve("Altitude", "m", altitudeVesusTimeData, 0xff0000, "Red")  // Red Curve
      this.xyChart.addCurve("Downrange Distance", "m", downrangeDistanceVersusTimeData, 0xff00ff, "Purple")  // Purple Curve
      this.xyChart.addCurve("Speed", "m/s", speedVersusTimeData, 0x00ffff, "Cyan")  // Cyan Curve
      this.xyChart.addCurve("Aerodynmic Drag", "N", aerodynamicDragVersusTimeData, 0x80ff80, "Bright Green") // Bright Green Curve
      this.xyChart.addCurve("Vehicle Mass", "kg", totalMassVerusTimeData, 0x0000ff, "Blue") // Blue Curve
      this.xyChart.addCurve("Forward Accelleration", "m/s2", forwardAccelerationVersusTimeData, 0xffff00, "Yellow") // Yellow Curve
      this.xyChart.addCurve("Lateral Accelleration", "m/s2", lateralAccelerationVersusTimeData, 0xff8000, "Orange") // Orange Curve

      console.print('========================================')
      let peakAerodynamicDrag = 0
      this.xyChart.curveInfo.forEach(curve =>{
        console.print(curve.name, '(', curve.colorName, ')', curve.maxY)
        if (curve.name == 'Aerodynmic Drag') {
          peakAerodynamicDrag = curve.maxY
        }
      })
      console.print("Vehicle Peak Aerodynamic Drag", Math.round(peakAerodynamicDrag/1000), 'kN')
      console.print("RS-25 Engine Thrust 2279 kN")
      console.print("Vehicle Initial Mass", Math.round(m0), 'kg')
      console.print("MassDriver Time", Math.round(launcherMassDriverAccelerationTime*100/60)/100, 'min')
      console.print("Ramp Time", Math.round(this.curveUpTime*10)/10, 'sec')
      console.print("Evacuate Tube Time", Math.round(this.timeWithinEvacuatedTube*10)/10, 'sec')
      console.print("MassDriver Length", Math.round(this.launcherMassDriverLength/1000), 'km')
      console.print("Ramp Base Length", Math.round(rampBaseLength/1000), 'km')
      console.print("Evacuate Tube Length", Math.round(distanceTravelledWithinEvacuatedTube/1000), 'km')
      console.print("Total Length Of Launch System", Math.round(totalLengthOfLaunchSystem/1000), 'km')
      console.print('========================================')

      if (genLauncherKMLFile) {
        kmlFile = kmlFile.concat(kmlutils.kmlMainRingPlacemarkHeader)
        launchTrajectoryCurveControlPoints.forEach(point => {
          const xyzPlanet = planetCoordSys.worldToLocal(point.clone())
          const lla = tram.xyz2lla(xyzPlanet.x, xyzPlanet.y, xyzPlanet.z)
          const coordString = '          ' + Math.round(lla.lon*10000000)/10000000 + ',' + Math.round(lla.lat*10000000)/10000000 + ',' + Math.round(Math.abs(lla.alt)*1000)/1000 + '\n'
          kmlFile = kmlFile.concat(coordString)
        })
        kmlFile = kmlFile.concat(kmlutils.kmlPlacemarkFooter)
      }
    }

    drawLaunchTrajectoryLine(dParamWithUnits, planetCoordSys) {
      let tStep = 1 // second
      let t = 0
      let prevVehiclePosition, currVehiclePosition
      
      prevVehiclePosition = this.launchTrajectoryCurve.getPoint(t / this.durationOfLaunchTrajectory)
      t += tStep

      const color = new THREE.Color()
      const launchTrajectoryPoints = []
      const launchTrajectoryColors = []
      

      for (; t < this.timeWithinMassDriver + dParamWithUnits['launcherCoastTime'].value; t+=tStep) {
        currVehiclePosition = this.launchTrajectoryCurve.getPoint(t / this.durationOfLaunchTrajectory)
        launchTrajectoryPoints.push(prevVehiclePosition)
        launchTrajectoryPoints.push(currVehiclePosition)
        prevVehiclePosition = currVehiclePosition.clone()
        // This code adds major thick hash marks to the line every 60 seconds, and thin hash marks every 10 seconds.
				if ((t%10==9) || (t%60==58)) {
	        color.setHSL(0.0 , 0.8, 0.7 )
				}
				else {
					color.setHSL(0.35 , 0.8, 0.3 )
				}
				launchTrajectoryColors.push(color.r, color.g, color.b)
        launchTrajectoryColors.push(color.r, color.g, color.b)
      }

      const launchTrajectoryGeometry = new THREE.BufferGeometry().setFromPoints(launchTrajectoryPoints)
      launchTrajectoryGeometry.setAttribute( 'color', new THREE.Float32BufferAttribute( launchTrajectoryColors, 3 ) )
    
      var launchTrajectoryMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: dParamWithUnits['launchTrajectoryVisibility'].value
      })

      if (this.launchTrajectoryMesh) {
        planetCoordSys.remove( this.launchTrajectoryMesh )
      }
      this.launchTrajectoryMesh = new THREE.LineSegments(launchTrajectoryGeometry, launchTrajectoryMaterial)
      this.launchTrajectoryMesh.visible = dParamWithUnits['showLaunchTrajectory'].value
      planetCoordSys.add( this.launchTrajectoryMesh )
    }

    animate(timeSinceStart) {
      // Move the virtual models of the launched vehicles along the launch trajectory
      let wedgeIndex
      const assignModelList = []
      const removeModelList = []
      const updateModelList = []
  
      this.unallocatedLaunchVehicleModels = []
      this.unallocatedLaunchSledModels = []

      this.refFrames.forEach((refFrame, index) => {
        // ToDo: Why check the flags for this?
        if (this.animateLaunchVehicles || this.animateLaunchSleds) {
          refFrame.timeSinceStart = timeSinceStart
        }
        const clearFlagsList = []
        //if (cameraAltitude<this.crv.currentMainRingAltitude+cameraRange) {
        
        // Hack - We'll just scan all of the wedges for now
        refFrame.startWedgeIndex = 0
        refFrame.finishWedgeIndex = this.numWedges - 1
    
        // Set bit0 of actionFlags if wedge is currently visible
        if (refFrame.startWedgeIndex!=-1) {
          for (wedgeIndex = refFrame.startWedgeIndex; ; wedgeIndex = (wedgeIndex + 1) % this.numWedges) {
            this.actionFlags[wedgeIndex] |= 1
            clearFlagsList.push(wedgeIndex)
            if (wedgeIndex == refFrame.finishWedgeIndex) break
          }
        }
        // Set bit1 of actionFlags if wedge was previously visible
        if (refFrame.prevStartWedgeIndex!=-1) {
          for (wedgeIndex = refFrame.prevStartWedgeIndex; ; wedgeIndex = (wedgeIndex + 1) % this.numWedges) {
            this.actionFlags[wedgeIndex] |= 2
            clearFlagsList.push(wedgeIndex)
            if (wedgeIndex == refFrame.prevFinishWedgeIndex) break
          }
        }
  
        if (refFrame.startWedgeIndex!=-1) {
          for (wedgeIndex = refFrame.startWedgeIndex; ; wedgeIndex = (wedgeIndex + 1) % this.numWedges) {
            if (this.actionFlags[wedgeIndex]==1) {
                // Wedge wasn't visible before and it became visible, assign it the assignModel list
                assignModelList.push({'refFrame': refFrame, 'wedgeIndex': wedgeIndex})
            }
            if (this.actionFlags[wedgeIndex] & 1 == 1) {
              // Wedge is currently visible, assign it the updateModel list
              updateModelList.push({'refFrame': refFrame, 'wedgeIndex': wedgeIndex})
            }
            if (wedgeIndex == refFrame.finishWedgeIndex) break
          }
        }
        if (refFrame.prevStartWedgeIndex!=-1) {
          for (wedgeIndex = refFrame.prevStartWedgeIndex; ; wedgeIndex = (wedgeIndex + 1) % this.numWedges) {
            if (this.actionFlags[wedgeIndex]==2) {
              // Wedge was visible before and it became invisible, add it to the removeModel list
              removeModelList.push({'refFrame': refFrame, 'wedgeIndex': wedgeIndex})
            }
            if (wedgeIndex == refFrame.prevFinishWedgeIndex) break
          }
        }
        
        // Debug - ToDo clean this up when it's no longer needed
        // let different = false
        // for (let j=0; j<this.actionFlags.length; j++) {
        //   if (this.actionFlags[j]!=refFrame.prevActionFlags[j]) {
        //     different = true
        //     break
        //   }
        // }
        // if (different) {
        //   let prstr = ''
        //   for (let j = 0; j<this.actionFlags.length; j++) {
        //     prstr += String(this.actionFlags[j])
        //   }
        //   console.log(prstr)
        // }
        // for (let j=0; j<this.actionFlags.length; j++) {
        //   refFrame.prevActionFlags[j] = this.actionFlags[j]
        // }
  
        refFrame.prevStartWedgeIndex = refFrame.startWedgeIndex
        refFrame.prevFinishWedgeIndex = refFrame.finishWedgeIndex
  
        clearFlagsList.forEach(wedgeIndex => {
          this.actionFlags[wedgeIndex] = 0  // Clear the action flags to ready them for future reuse
        })
      })


      // Reassign models to/from virtual models based on which objects are in range of the camera
      // Place and orient all of the active models
      if (removeModelList.length > 0) {
        // console.log(
        //   this.unallocatedMassDriverModels.length,
        //   this.unallocatedLaunchVehicleModels.length,
        // )
        //console.log('Removing ' + removeModelList.length)
      }
      if (assignModelList.length > 0) {
        // console.log(
        //   this.unallocatedMassDriverModels.length,
        //   this.unallocatedLaunchVehicleModels.length,
        // )
        //console.log('Adding ' + assignModelList.length)
      }
  
      // Free models that are in wedges that are no longer near the camera
      removeModelList.forEach(entry => {
        Object.entries(entry['refFrame'].wedges[entry['wedgeIndex']]).forEach(([objectKey, objectValue]) => {
          objectValue.forEach(object => {
            if (object.model) {
              object.model.visible = false
              if (object.hasElement('unallocatedModels')) {
                object.unallocatedModels.push(object.model)
                object.model = null
              }
            }
          })
        })
      })
  
      // Assign models to virtual objects that have just entered the region near the camera
      assignModelList.forEach(entry => {
        const ranOutOfModelsInfo = {}
        Object.entries(entry['refFrame'].wedges[entry['wedgeIndex']]).forEach(([objectKey, objectValue]) => {
          if (objectValue.length>0) {
            objectValue.forEach(object => {
              if (!object.model) {
                if (object.unallocatedModels.length==1) {
                  // This is the last model. Duplicate it so that we don't run out.
                  const tempModel = object.unallocatedModels[0].clone()
                  object.unallocatedModels.push(tempModel)
                  this.scene.add(tempModel)
                  //console.log('Duplicating model for ' + objectKey)
                }
                if (object.unallocatedModels.length>0) {
                  object.model = object.unallocatedModels.pop()
                  object.model.visible = object.isVisible
                }
                else {
                  if (objectKey in ranOutOfModelsInfo) {
                    ranOutOfModelsInfo[objectKey]++
                  }
                  else {
                    ranOutOfModelsInfo[objectKey] = 1
                  }
                }
              }
              else {
                object.model.visible = object.isVisible
              }
            })
            const classIsDynamic = objectValue[0].constructor.isDynamic
            const classHasChanged = objectValue[0].constructor.hasChanged
            if (!classIsDynamic && !classHasChanged) {
              // Static object so we will place the model (just once) at the same time we assign it to a virtual object
              objectValue.forEach(object => {
                if (object.model) {
                  object.placeAndOrientModel(object.model, entry['refFrame'])
                }
              })
            }
          }
        })
        let allGood = true
        Object.entries(ranOutOfModelsInfo).forEach(([k, v]) => {
          if (v>0) {
            console.log('Ran out of ' + k + ' models (needed ' + v + ' more)')
            allGood = false
          }
        })
        if (!allGood) {
          console.log('Problem Assigning Models')
        }
        else {
          // Success!! We can remove this entry from the list now
          //assignModelList.splice(index, 1)
        }
      })
      // Now adjust the models position and rotation in all of the active wedges
  
      updateModelList.forEach(entry => {
        Object.entries(entry['refFrame'].wedges[entry['wedgeIndex']]).forEach(([objectKey, objectValue]) => {
          if (objectValue.length>0) {
            const classIsDynamic = objectValue[0].constructor.isDynamic
            const classHasChanged = objectValue[0].constructor.hasChanged
            if (true || classIsDynamic || classHasChanged) {
              // Call the placement method for each active instance (unless the model class is static and unchanged)
              objectValue.forEach(object => {
                if (object.model) {
                  object.placeAndOrientModel(object.model, entry['refFrame'])
                }
              })
            }
          }
        })
      })
  
      if (removeModelList.length > 0) {
        // console.log(
        //   this.unallocatedMassDriverModels.length,
        //   this.unallocatedLaunchVehicleModels.length,
        // )
      }
      if (assignModelList.length > 0) {
        // console.log(
        //   this.unallocatedMassDriverModels.length,
        //   this.unallocatedLaunchVehicleModels.length,
        // )
      }
  
      // Clear all of the "hasChanged" flags
      virtualMassDriverTube.hasChanged = false
      virtualMassDriverRail.hasChanged = false
      virtualMassDriverBracket.hasChanged = false
      virtualMassDriverScrew.hasChanged = false
      virtualLaunchVehicle.hasChanged = false
      virtualLaunchSled.hasChanged = false
  
      // Debug stuff...
      // console.log(ringTerminusModels)
      // if (transitVehicleShortageCount>0) {
      //   console.log('transitVehicleShortageCount was ' + transitVehicleShortageCount)
      // }
      // // console.log("vehicles unallocated: " + this.unallocatedTransitVehicleModels.length)
      // if (removeModelList.length) {
      //   console.log("removing " + removeModelList.length + " wedge")
      // }
      // if (assignModelList.length) {
      //   console.log("assigning " + assignModelList.length + " wedge")
      // }
      
    }


    Update() {
        // TBD these parameters should come from "the universe"
        console.log('Executing unused code!')
        this.R_LEO = this.R_Earth + this.Alt_LEO;

        this.PotentialEnergy_Joules = -this.const_G * this.const_M * this.MPayload / this.R_Earth;
        this.PotentialEnergy_kWh = this.PotentialEnergy_Joules / 3600000;
        this.CostOfPotentialEnergyToEscape = -this.PotentialEnergy_kWh * this.WholesaleElectricityCost;
        this.CostPerkgToEscape = this.CostOfPotentialEnergyToEscape / this.MPayload;
        this.LEOOrbitVelocity = Math.sqrt(this.const_G*this.const_M / (this.R_Earth + this.Alt_LEO));
        this.Alt_Apogee = this.Alt_LEO;
        this.EllipseMajorAxisLength = this.Alt_Perigee + this.R_Earth * 2 + this.Alt_Apogee;
        this.EllipseSemiMajorAxisLength = this.EllipseMajorAxisLength / 2;
        this.Eccentricity = 1.0 - (this.R_Earth + this.Alt_Perigee) / this.EllipseSemiMajorAxisLength;
        this.EllipseSemiMinorAxisLength = this.EllipseSemiMajorAxisLength * Math.sqrt(1 - this.Eccentricity**2);

        this.EllipticalOrbitPerigeeVelocity = Math.sqrt(this.const_G*this.const_M*(2 / (this.R_Earth + this.Alt_Perigee) - 2 / this.EllipseMajorAxisLength));
        this.EllipticalOrbitApogeeVelocity = Math.sqrt(this.const_G*this.const_M*(2 / (this.R_Earth + this.Alt_Apogee) - 2 / this.EllipseMajorAxisLength));
        this.EllipticalOrbitVelocityAtLauncherExit = Math.sqrt(this.const_G * this.const_M * (2 / (this.R_Earth + this.Alt_EvacuatedTube) - (1 / this.EllipseSemiMajorAxisLength)));
        this.EllipticalOrbitPeriod = 2 * Math.PI * Math.sqrt(Math.pow(this.EllipseSemiMajorAxisLength, 3) / (this.const_G * this.const_M));
        this.EarthsRimSpeed = 2 * Math.PI*(this.R_Earth + this.Alt_Perigee) / 24 / 3600;  // ToDo: This needs to be a function of where edge of ring is
        this.DeltaVeeToCircularizeOrbit = this.LEOOrbitVelocity - this.EllipticalOrbitApogeeVelocity;
        this.DeltaVeeToDeCircularizeOrbit = this.DeltaVeeToCircularizeOrbit; // Need this much DeltaV to return to Earth
        this.TotalDeltaV = this.DeltaVeeToCircularizeOrbit + this.DeltaVeeToDeCircularizeOrbit;
        this.M0OverMf = Math.exp(this.TotalDeltaV / (this.RocketsSpecificImpulse*this.const_g));
        this.FueledVehicleMassAtApogee = (this.MPayload + this.RocketEnginesMass)*this.M0OverMf;
        this.FueledVehiclesKineticEnergyAtPerigee_Joules = 0.5*this.FueledVehicleMassAtApogee*(this.EllipticalOrbitPerigeeVelocity - this.EarthsRimSpeed)**2;
        this.FueledVehiclesKineticEnergyAtPerigee_kWh = this.FueledVehiclesKineticEnergyAtPerigee_Joules / 3600000;
        this.CostToLaunchFueledVehicle = this.FueledVehiclesKineticEnergyAtPerigee_kWh * this.LauncherEfficiency * this.WholesaleElectricityCost;
        this.CostPerkgOfPayload = this.CostToLaunchFueledVehicle / this.MPayload;

        // Next, we will work out the length of the launcher's track and the launch time...
        this.LauncherTrackLength = 0.5*(this.EllipticalOrbitPerigeeVelocity - this.EarthsRimSpeed)**2 / (this.MaxGees*this.const_g);
        this.AccelerationTime = Math.sqrt(2 * this.LauncherTrackLength / (this.MaxGees*this.const_g));
        // A rough approximation here - assuming that the S curve is close to flat so we can just subtract or add one Gee to account for Earth's Gravity 
        this.AllowableUpwardTurningRadius = this.EllipticalOrbitPerigeeVelocity**2 / ((this.MaxGees - 1)*this.const_g);
        this.AllowableDownwardTurningRadius = this.EllipticalOrbitPerigeeVelocity**2 / ((this.MaxGees + 1)*this.const_g);
        if (this.Alt_Perigee > this.LauncherAltitude) {
            // In this case we know that the optimal release point is at the orbit's perigee.
            const TriangleSideA = this.R_Earth + this.Alt_Perigee - this.AllowableDownwardTurningRadius;
            const TriangleSideB = this.R_Earth + this.LauncherAltitude + this.AllowableUpwardTurningRadius;
            const TriangleSideC = this.AllowableUpwardTurningRadius + this.AllowableDownwardTurningRadius;
            const AngleA = Math.acos((TriangleSideA**2 - TriangleSideB**2 - TriangleSideC**2) / (-2 * TriangleSideB*TriangleSideC));
            const AngleB = Math.acos((TriangleSideB**2 - TriangleSideA**2 - TriangleSideC**2) / (-2 * TriangleSideA*TriangleSideC));
            const AngleD = Math.PI - AngleB;
            this.CurveUpDistance = AngleA * this.AllowableUpwardTurningRadius;
            this.CurveDownDistance = AngleD * this.AllowableDownwardTurningRadius;
        }
        else {
            // In this case the optimal release point is not the eliptical orbit's perigee, but rather the point where the eliptical orbit 
            // intercects with Alt_EvacuatedTubeHeight, or the highest altitude at which it is feasible to use the launch system to alter
            // the tragectory of the vehicle. We need to figure out the location of this point and the velocity vector at that point.

            this.CurveUpDistance = 0;
            this.CurveDownDistance = 0;
        }
        this.TotalSCurveDistance = this.CurveUpDistance + this.CurveDownDistance;
        this.CurveUpTime = this.CurveUpDistance / this.EllipticalOrbitPerigeeVelocity;
        this.CurveDownTime = this.CurveDownDistance / this.EllipticalOrbitPerigeeVelocity;
        this.TotalTimeInLaunchSystem = this.AccelerationTime + this.CurveUpTime + this.CurveDownTime;
        this.VehicleCrossSectionalAreaForDrag = Math.PI * this.VehicleRadius ** 2
    }

    // The following functions were ported from 	// Equation 3.66c, http://www.nssc.ac.cn/wxzygx/weixin/201607/P020160718380095698873.pdf

    stumpC(z) {
        let c

        if (z > 0) {
            c = (1 - Math.cos(Math.sqrt(z))) / z
        }
        else if (z < 0) {
            c = (Math.cosh(Math.sqrt(-z)) - 1) / (-z)
        }
        else {
            c = 1 / 2
        }
        return c
    }

    stumpS(z) {

        let s

        if (z > 0) {
            const sqrtz = Math.sqrt(z)
            s = (sqrtz - Math.sin(sqrtz)) / Math.pow(sqrtz, 3)
        }
        else if (z < 0) {
            const sqrtmz = Math.sqrt(-z)
            s = (Math.sinh(sqrtmz) - sqrtmz) / Math.pow(sqrtmz, 3)
        }
        else {
            s = 1 / 6
        }
        return s
    }

    f_and_g(x, t, ro, a)
    {
        const fg = new THREE.Vector2()

        const z = a * x**2
        //Equation 3.66a:
        fg.x = 1 - x**2 / ro * this.stumpC(z)
        //Equation 3.66b:
        fg.y = t - 1 / Math.sqrt(this.mu) * x*x*x * this.stumpS(z)
        return fg
    }

    fDot_and_gDot(x, r, ro, a)
    {
        const fdotgdot = new THREE.Vector2()

        const z = a * x**2
        // Equation 3.66c:
        fdotgdot.x = Math.sqrt(this.mu) / r / ro * (z*this.stumpS(z) - 1)*x
        // Equation 3.66d:
        fdotgdot.y = 1 - x**2 / r * this.stumpC(z)
        return fdotgdot
    }

    kepler_U(dt, ro, vro, a) {
        let C, S, F
        let dFdx

        // Set an error tolerance and a limit on the number of iterations
        const error = 1e-8
        const nMax = 1000
        // Starting value for x
        let x = Math.sqrt(this.mu)*Math.abs(a)*dt
        // Iterate on Equation 3.62 until convergence occurs within the error tolerance
        let n = 0
        let ratio = 1

        while ((Math.abs(ratio) > error) && (n <= nMax)) {
            n = n + 1
            C = this.stumpC(a * x**2)
            S = this.stumpS(a * x**2)
            F = ro * vro / Math.sqrt(this.mu) * x**2 * C + (1 - a * ro) * x*x*x * S + ro * x - Math.sqrt(this.mu)*dt
            dFdx = ro * vro / Math.sqrt(this.mu) * x * (1 - a * x**2 * S) + (1 - a * ro) * x**2 * C + ro
            ratio = F / dFdx
            x = x - ratio
        }
        return x
    }

    RV_from_R0V0andt(R0_x, R0_y, V0_x, V0_y, t) {

        const R0 = new THREE.Vector2(R0_x, R0_y)
        const V0 = new THREE.Vector2(V0_x, V0_y)
        const RV = {
            R: new THREE.Vector2(0, 0),
            V: new THREE.Vector2(0, 0)
        }
        // mu - gravitational parameter(kmˆ3 / sˆ2)
        // R0 - initial position vector(km)
        // V0 - initial velocity vector(km / s)
        // t - elapsed time(s)
        // R - final position vector(km)
        // V - final velocity vector(km / s)
        // User M - functions required : kepler_U, f_and_g, fDot_and_gDot

        //Magnitudes of R0 and V0
        const r0 = R0.length()
        const v0 = V0.length()
        //Initial radial velocity
        const vr0 = R0.dot(V0) / r0

        // Reciprocal of the semimajor axis(from the energy equation)
        const alpha = 2 / r0 - v0**2 / this.mu
        // Compute the universal anomaly
        const x = this.kepler_U(t, r0, vr0, alpha)
        // Compute the f and g functions
        const fg = this.f_and_g(x, t, r0, alpha)

        // Compute the final position vector
        RV.R.x = fg.x * R0.x + fg.y * V0.x
        RV.R.y = fg.x * R0.y + fg.y * V0.y

        // Compute the magnitude of R
        const r = RV.R.length()
        
        // Compute the derivatives of f and g
        const fdotgdot = this.fDot_and_gDot(x, r, r0, alpha)

        // Compute the final velocity
        RV.V.x = fdotgdot.x * R0.x + fdotgdot.y * V0.x
        RV.V.y = fdotgdot.x * R0.y + fdotgdot.y * V0.y

        return RV
    }

    orbitalElementsFromStateVector(R, V) {
      // This function computes the classical orbital elements (coe)
      // from the state vector (R,V) using Algorithm 4.1.

      // mu - gravitational parameter (kmˆ3/sˆ2)
      // R - position vector in the geocentric equatorial frame
      // (km)
      // V - velocity vector in the geocentric equatorial frame
      // (km)
      // r, v - the magnitudes of R and V
      // vr - radial velocity component (km/s)
      // H - the angular momentum vector (kmˆ2/s)
      // h - the magnitude of H (kmˆ2/s)
      // incl - inclination of the orbit (rad)
      // N - the node line vector (kmˆ2/s)
      // n - the magnitude of N
      // cp - cross product of N and R
      // RA - right ascension of the ascending node (rad)
      // E - eccentricity vector
      // e - eccentricity (magnitude of E)
      // eps - a small number below which the eccentricity is
      // considered to be zero
      // w - argument of perigee (rad)
      // TA - true anomaly (rad)
      // a - semimajor axis (km)
      // pi - 3.1415926...
      // coe - vector of orbital elements [h e RA incl w TA a]

      // User M-functions required: None
      const eps = 1.e-10
      const r = R.length()
      const v = V.length()
      const vr = R.clone().dot(V) / r
      const H = R.clone().cross(V)
      const h = H.length()

      // Equation 4.7:
      const incl = Math.acos(H.z/h);

      // Equation 4.8:
      const N = new THREE.Vector3(0, 0, 1).cross(H)
      const n = N.length()

      // Equation 4.9:
      let RA
      if (n != 0) {
        RA = Math.acos(N.x/n)
        if (N.z < 0) {
          RA = 2*Math.PI - RA
        }
      }
      else {
        RA = 0
      }

      // Equation 4.10:
      const E = R.clone().multiplyScalar((v**2 - this.mu/r)).sub(V.clone().multiplyScalar(r*vr)).multiplyScalar(1/this.mu)
      const e = E.length()

      // Equation 4.12 (incorporating the case e = 0):
      let w
      if (n != 0) {
        if (e > eps) {
          w = Math.acos(N.clone().dot(E)/n/e)
          if (E.z < 0) {
            w = 2*Math.PI - w
          }
        }
        else {
          w = 0
        }
      }
      else {
        w = 0
      }

      // Equation 4.13a (incorporating the case e = 0):
      let TA
      if (e > eps) {
        TA = Math.acos(E.clone().dot(R)/e/r)
        if (vr < 0) {
          TA = 2*Math.PI - TA
        }
      }
      else {
        const cp = N.clone().cross(R)
        if (cp.z >= 0) {
          TA = Math.acos(N.clone().dot(R)/n/r)
        }
        else {
          TA = 2*Math.PI - Math.acos(N.clone().dot(R)/n/r)
        }
      }

      // Equation 2.61 (a < 0 for a hyperbola):
      const a = h**2/this.mu/(1 - e**2)

      return {
        'angularMomentumVector': h,
        'eccentricity': e,
        'rightAscensionOfTheAscendingNode': RA,
        'inclination': incl,
        'argumentOfPerigee': w,
        'trueAnomaly': TA,
        'semimajorAxis': a
      }
    }

    GetAltitudeDistanceAndVelocity(CurrentTime)
    {
        let ADAndV = {
            Altitude: 0,
            Distance: 0,
            Velocity: 0
        }

        if (CurrentTime <= this.AccelerationTime) {
            ADAndV.Altitude = this.LauncherAltitude
            ADAndV.Distance = 0.5 * this.MaxGees * this.const_g * CurrentTime**2
            ADAndV.Velocity = this.MaxGees * this.const_g * CurrentTime
        }
        else if (CurrentTime <= this.AccelerationTime + this.CurveUpTime) {
            ADAndV.Altitude = Math.sqrt((this.R_Earth + this.LauncherAltitude + this.AllowableUpwardTurningRadius)**2 + this.AllowableUpwardTurningRadius**2 - 2 * (this.R_Earth + this.LauncherAltitude + this.AllowableUpwardTurningRadius)*this.AllowableUpwardTurningRadius*Math.cos(Math.max(0, CurrentTime - this.AccelerationTime)*this.EllipticalOrbitPerigeeVelocity / this.AllowableUpwardTurningRadius)) - this.R_Earth;
            // ToDo: This is too rough and approximation
            ADAndV.Distance = this.LauncherTrackLength + (CurrentTime - this.AccelerationTime) * this.EllipticalOrbitPerigeeVelocity
            ADAndV.Velocity = this.EllipticalOrbitPerigeeVelocity
        }
        else if (CurrentTime <= this.TotalTimeInLaunchSystem) {
            ADAndV.Altitude = Math.sqrt((this.R_Earth + this.Alt_Perigee - this.AllowableDownwardTurningRadius)**2 + this.AllowableDownwardTurningRadius**2 - 2 * (this.R_Earth + this.Alt_Perigee - this.AllowableDownwardTurningRadius)*this.AllowableDownwardTurningRadius*Math.cos(Math.PI + Math.min(0, CurrentTime - this.TotalTimeInLaunchSystem)*this.EllipticalOrbitPerigeeVelocity / this.AllowableDownwardTurningRadius)) - this.R_Earth
            // ToDo: This is too rough and approximation
            ADAndV.Distance = this.LauncherTrackLength + (CurrentTime - this.AccelerationTime) * this.EllipticalOrbitPerigeeVelocity
            ADAndV.Velocity = this.EllipticalOrbitPerigeeVelocity
        }
        else {
            const Time = CurrentTime - this.TotalTimeInLaunchSystem
            const R0 = new THREE.Vector2(0, (this.R_Earth + this.Alt_Perigee) / 1000)
            const V0 = new THREE.Vector2(this.EllipticalOrbitPerigeeVelocity / 1000, 0)
            // TBD - need to figure out the altitude while on the eliptical orbit's path

            // Note: The distance units in the RV_from_R0V0andt function and its sub functions are km, not meters.
            const RV = this.RV_from_R0V0andt(R0.x, R0.y, V0.x, V0.y, Time)

            ADAndV.Altitude = RV.R.length() * 1000 - this.R_Earth
            ADAndV.Distance = Math.atan2(RV.R.x, RV.R.y) * RV.R.length() * 1000
            ADAndV.Velocity = RV.V.length() * 1000
        }
        return ADAndV
    }

    GetAirDensity(Altitude)
    {
        let T, P
        if (Altitude < 11000.0) {
            T = 15.04 - 0.00649*Altitude
            P = 101.29 * Math.pow((T + 273.1) / 288.08, 5.256)
        }
        else if (Altitude < 25000.0) {
            T = -56.46
            P = 22.65*Math.exp(1.73 - 0.000157*Altitude)
        }
        else {
            T = -131.21 + 0.00299*Altitude
            P = 2.488*Math.pow((T + 273.1) / 216.6, -11.388)
        }
        const Density = P / (0.2869*(T + 273.1))

        return Density

        // Reference https://www.grc.nasa.gov/WWW/k-12/airplane/atmosmet.html
    }

    GetAerodynamicDrag(CurrentAirDensity, Speed)
    {
        const DragForce = CoefficientOfDrag * VehicleCrossSectionalAreaForDrag * (Speed - EarthsRimSpeed)**2 / 2 * CurrentAirDensity
        return DragForce;
    }

    // ChatGPT version
    GetAerodynamicDrag_ChatGPT(altitude, speed, noseConeAngle, radius, length) {
      // Calculate the atmospheric density at the given altitude using the barometric formula
      const density = this.GetAirDensity(altitude)
    
      // Calculate the drag coefficient based on the nose cone angle and length
      // const dragCoefficient = 0.5 * Math.pow(Math.cos(noseConeAngle), 2) + (length / (Math.PI * radius * radius)) // Suspect this formula is BS
      const dragCoefficient = 0.035  // From page 23 of https://upcommons.upc.edu/bitstream/handle/2117/328318/REPORT_556.pdf?sequence=1&isAllowed=y
    
      // Calculate the cross-sectional area of the object
      const crossSectionalArea = Math.PI * radius * radius
    
      // Calculate the drag force using the drag equation
      const dragForce = 0.5 * dragCoefficient * density * speed * speed * crossSectionalArea
    
      return dragForce;
    }
}