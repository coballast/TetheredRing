import * as THREE from 'three'
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { FacesGeometry } from './FacesGeometry.js'
import * as tram from './tram.js'

export class launchVehicleModel {
  constructor(dParamWithUnits, myScene, unallocatedModelsList, perfOptimizedThreeJS) {
    const radius = dParamWithUnits['launchVehicleRadius'].value
    const bodyLength = dParamWithUnits['launchVehicleBodyLength'].value
    const flameLength = dParamWithUnits['launchVehicleFlameLength'].value
    const lengthSegments = 2
    const radialSegments = 32
    const noseconeLength = dParamWithUnits['launchVehicleNoseconeLength'].value
    const shockwaveConeLength = dParamWithUnits['launchVehicleShockwaveConeLength'].value
    const objName = 'launchVehicle'
    const launchVehicleNumModels = dParamWithUnits['launchVehicleNumModels'].value

    // Proceedurally generate the Launch Vehicle body, flame, and point light meshes

    // Create the vehicle's body
    const launchVehicleBodyGeometry = new THREE.CylinderGeometry(radius, radius, bodyLength, radialSegments, lengthSegments, false)
    launchVehicleBodyGeometry.name = "body"
    launchVehicleBodyGeometry.translate(0, bodyLength/2, 0)
    // Create the nose cone
    const launchVehicleNoseconeGeometry = new THREE.ConeGeometry(radius, noseconeLength, radialSegments, lengthSegments, true)
    launchVehicleNoseconeGeometry.name = "nosecone"
    launchVehicleNoseconeGeometry.translate(0, (bodyLength+noseconeLength)/2 + bodyLength/2, 0)
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
    // Merge the nosecone into the body
    const launchVehicleGeometry = BufferGeometryUtils.mergeBufferGeometries([launchVehicleBodyGeometry, launchVehicleNoseconeGeometry, launchVehicleFin0Geometry, launchVehicleFin1Geometry, launchVehicleFin2Geometry], false)
    const launchVehicleMaterial = new THREE.MeshPhongMaterial( {color: 0x7f3f00})
    let launchVehicleBodyMesh = new THREE.Mesh(launchVehicleGeometry, launchVehicleMaterial)
    launchVehicleBodyMesh.name = 'body'

    const launchVehicleFlameMesh = makeFlame()
    const launchVehiclePointLightMesh = makePointLight()
    const launchVehicleShockwaveConeMesh = makeShockwaveCone()
    const launchVehicleMesh = assemble(launchVehicleBodyMesh, launchVehicleFlameMesh, launchVehiclePointLightMesh, launchVehicleShockwaveConeMesh)
    const scaleFactor = dParamWithUnits['launchVehicleScaleFactor'].value
    decorateAndSave(launchVehicleMesh, myScene, unallocatedModelsList, objName, scaleFactor, launchVehicleNumModels, perfOptimizedThreeJS)
    console.log("Created " + launchVehicleNumModels + " launch vehicle models")

    // Load the launch vehicle body mesh from a model, and replace the proceedurally generated body with the body from the model
    function prepareACallbackFunctionForFBXLoader (myScene, unallocatedModelsList, objName, scaleFactor, n, perfOptimizedThreeJS) {

      // This is the additional work we want to do later, after the loader gets around to loading our model...
      return function(object) {
        object.scale.set(scaleFactor, scaleFactor, scaleFactor)
        object.name = 'launchVehicle_bodyFromModel'
        object.children[0].material.color.setHex(0xcfd4d9)
        myScene.traverse(child=> {
          if (child.name==='launchVehicle_body') {
            const parent = child.parent
            parent.remove(child)
            parent.add(object.clone())
          }
        })
        unallocatedModelsList.forEach(element => {
          element.traverse(child => {
            if (child.name==='launchVehicle_body') {
              const parent = child.parent
              parent.remove(child)
              parent.add(object.clone())
            }
          })
        })
      }

    }

    //const loader = new FBXLoader();
    const loader = new OBJLoader();

    const modelScaleFactor = 0.001 // Because Alastair's launch vehicle model used mm instead of meters
    const addLaunchVehicles = prepareACallbackFunctionForFBXLoader (myScene, unallocatedModelsList, objName, modelScaleFactor, launchVehicleNumModels, perfOptimizedThreeJS)
        
    loader.loadAsync('models/launchVehicle.obj').then(addLaunchVehicles)

    function makeFlame() {

      // Create the vehicle's flame
      const launchVehicleFlameGeometry = new THREE.CylinderGeometry(radius*.9, radius*0.4, flameLength, radialSegments, lengthSegments, false)
      launchVehicleFlameGeometry.name = "rocketEngine"
      const launchVehicleFlameMaterial = new THREE.MeshPhongMaterial( {color: 0x000000, emissive: 0xdfa0df, emissiveIntensity: 1.25, transparent: true, opacity: 0.5})
      const launchVehicleFlameMesh = new THREE.Mesh(launchVehicleFlameGeometry, launchVehicleFlameMaterial)
      launchVehicleFlameMesh.position.set(0, -flameLength/2, 0)
      launchVehicleFlameMesh.name = 'flame'
      return launchVehicleFlameMesh
    
    }

    function makePointLight() {

      const launchVehiclePointLightMesh = new THREE.Points(
        new THREE.BufferGeometry().setAttribute( 'position', new THREE.Float32BufferAttribute( [0, 0, 0], 3) ),
        new THREE.PointsMaterial( { color: 0xFFFFFF } ) )
      launchVehiclePointLightMesh.name = 'pointLight'
      return launchVehiclePointLightMesh
    
    }

    function makeShockwaveCone() {
        
        // ToDo: *4 factor below should be a parameter or calculated from the launchVehicle's airspeed
        const launchVehicleShockwaveConeGeometry = new THREE.ConeGeometry(radius*4, shockwaveConeLength, radialSegments, lengthSegments, true)
        launchVehicleShockwaveConeGeometry.name = "shockwaveCone"
        const launchVehicleShockwaveConeMaterial = new THREE.MeshPhongMaterial( {color: 0x000000, side: THREE.DoubleSide, emissive: 0x7f7f7f, emissiveIntensity: 1.25, transparent: true, opacity: 0.15})
        const launchVehicleShockwaveConeMesh = new THREE.Mesh(launchVehicleShockwaveConeGeometry, launchVehicleShockwaveConeMaterial)
        launchVehicleShockwaveConeMesh.position.set(0, bodyLength + noseconeLength - shockwaveConeLength/2, 0)
        launchVehicleShockwaveConeMesh.name = 'shockwaveCone'
        return launchVehicleShockwaveConeMesh

      }

    function assemble(launchVehicleBodyMesh, launchVehicleFlameMesh, launchVehiclePointLightMesh, launchVehicleShockwaveConeMesh) {

      const launchVehicleMesh = new THREE.Group().add(launchVehicleBodyMesh).add(launchVehicleFlameMesh).add(launchVehicleShockwaveConeMesh)
      launchVehicleMesh.name = 'launchVehicle'
      launchVehiclePointLightMesh.visible = dParamWithUnits['showLaunchVehiclePointLight'].value
      launchVehicleMesh.add(launchVehiclePointLightMesh)
      return launchVehicleMesh

    }

    function decorateAndSave(object, myScene, unallocatedModelsList, objName, scaleFactor, n, perfOptimizedThreeJS) {
      
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
  }
}
  

export class virtualLaunchVehicle {

    constructor(timeLaunched, unallocatedModelsArray) {
        // The virtual vehicle has a position along the launch trajectory curve.
        this.timeLaunched = timeLaunched
        this.unallocatedModels = unallocatedModelsArray
        this.model = null
    }
    
    // The following properties are common to all virtual vehicles...
    static currentEquivalentLatitude
    static isVisible
    static isDynamic
    static hasChanged
    
    static update(
        dParamWithUnits,
        timeWithinMassDriver,
        curveUpTime,
        timeWithinEvacuatedTube,
        planetRadius) {

        virtualLaunchVehicle.timeWithinMassDriver = timeWithinMassDriver
        virtualLaunchVehicle.curveUpTime = curveUpTime
        virtualLaunchVehicle.timeWithinEvacuatedTube = timeWithinEvacuatedTube
        virtualLaunchVehicle.planetRadius = planetRadius
    
        virtualLaunchVehicle.sidewaysOffset = dParamWithUnits['launchVehicleSidewaysOffset'].value
        virtualLaunchVehicle.upwardsOffset = dParamWithUnits['launchVehicleUpwardsOffset'].value
        virtualLaunchVehicle.forwardsOffset = dParamWithUnits['launchVehicleForwardsOffset'].value
        virtualLaunchVehicle.bodyLength = dParamWithUnits['launchVehicleBodyLength'].value
        virtualLaunchVehicle.noseconeLength = dParamWithUnits['launchVehicleNoseconeLength'].value
        virtualLaunchVehicle.flameLength = dParamWithUnits['launchVehicleFlameLength'].value
        virtualLaunchVehicle.shockwaveConeLength = dParamWithUnits['launchVehicleShockwaveConeLength'].value
        virtualLaunchVehicle.isVisible = dParamWithUnits['showLaunchVehicles'].value
        virtualLaunchVehicle.showLaunchVehiclePointLight = dParamWithUnits['showLaunchVehiclePointLight'].value
        virtualLaunchVehicle.slowDownPassageOfTime = dParamWithUnits['launcherSlowDownPassageOfTime'].value
        virtualLaunchVehicle.launcherMassDriverForwardAcceleration = dParamWithUnits['launcherMassDriverForwardAcceleration'].value
        virtualLaunchVehicle.launcherMassDriverInitialVelocity = dParamWithUnits['launcherMassDriverInitialVelocity'].value
        virtualLaunchVehicle.launcherMassDriverExitVelocity = dParamWithUnits['launcherMassDriverExitVelocity'].value
        virtualLaunchVehicle.timeAtEvacuatedTubeExit = virtualLaunchVehicle.timeWithinMassDriver + virtualLaunchVehicle.curveUpTime + virtualLaunchVehicle.timeWithinEvacuatedTube

        virtualLaunchVehicle.isDynamic =  true
        virtualLaunchVehicle.hasChanged = true
    }

    placeAndOrientModel(om, refFrame) {

        const adjustedTimeSinceStart = tram.adjustedTimeSinceStart(virtualLaunchVehicle.slowDownPassageOfTime, refFrame.timeSinceStart)
        const deltaT = adjustedTimeSinceStart - this.timeLaunched
        const res = refFrame.curve.findRelevantCurve(deltaT)
        const relevantCurve = res.relevantCurve
        const d = Math.max(0, Math.min(1, relevantCurve.tTod(deltaT - res.relevantCurveStartTime) / res.relevantCurveLength))

        const modelForward = new THREE.Vector3(0, 1, 0) // The direction that the model considers "forward"
        const modelUpward = new THREE.Vector3(0, 0, 1)  // The direction that the model considers "upward"

        // Debug code for tracking first vehicle
        // if (this.timeLaunched==0.1) {
        //     console.log(d)
        // }
        // try {
            const pointOnRelevantCurve = relevantCurve.getPointAt(d)
            const forward = relevantCurve.getTangentAt(d)
            const upward = relevantCurve.getNormalAt(d)
            const rightward = relevantCurve.getBinormalAt(d)
            const orientation = relevantCurve.getQuaternionAt(d, modelForward, modelUpward)
    
            om.position.copy(pointOnRelevantCurve)
                .add(rightward.clone().multiplyScalar(virtualLaunchVehicle.sidewaysOffset))
                .add(upward.clone().multiplyScalar(virtualLaunchVehicle.upwardsOffset))
                .add(forward.clone().multiplyScalar(virtualLaunchVehicle.forwardsOffset))
            om.setRotationFromQuaternion(orientation)
        // } catch (e) {
        //     console.log(e)
        // }
    
        om.visible = virtualLaunchVehicle.isVisible
    
        const altitdute = pointOnRelevantCurve.length() - virtualLaunchVehicle.planetRadius
        const airDensity = tram.airDensityAtAltitude(altitdute)
        const airDensityFactor = Math.min(1, airDensity/0.0184)     // 0.0184 kg/m^3 is rougly the air density at 30000m

        // Turn on the flame at the exit of the launch tube
        // ToDo: Some of this code does not need to be executed for every virtual vehicle.  We could improve performance it we can find a way to
        // execute it just once per animated frame.
        const flame_model = om.getObjectByName('launchVehicle_flame')
        const pointlight_model = om.getObjectByName('launchVehicle_pointLight')
        const shockwaveCone_model = om.getObjectByName('launchVehicle_shockwaveCone')
        flame_model.visible = (deltaT > virtualLaunchVehicle.timeAtEvacuatedTubeExit) && (airDensityFactor>0.1)
        shockwaveCone_model.visible = (deltaT > virtualLaunchVehicle.timeAtEvacuatedTubeExit) && (airDensityFactor>0.01)

        if (flame_model.visible) {
          flame_model.position.set(0, -virtualLaunchVehicle.flameLength*airDensityFactor/2, 0)
          flame_model.scale.set(1, airDensityFactor, 1)
        }

        if (shockwaveCone_model.visible) {
          const shockwaveConeLengthFactor = airDensityFactor * (0.9 + Math.random() * 0.2)   
          const yPos = virtualLaunchVehicle.bodyLength + virtualLaunchVehicle.noseconeLength - virtualLaunchVehicle.shockwaveConeLength*shockwaveConeLengthFactor/2
          shockwaveCone_model.position.set(0, yPos, 0)
          shockwaveCone_model.scale.set(shockwaveConeLengthFactor, shockwaveConeLengthFactor, shockwaveConeLengthFactor)
          shockwaveCone_model.updateMatrixWorld()
        }

        pointlight_model.visible = virtualLaunchVehicle.showLaunchVehiclePointLight
        om.matrixValid = false

    }

    getFuturePosition(refFrame, timeDeltaInSeconds) {

        const adjustedTimeSinceStart = tram.adjustedTimeSinceStart(virtualLaunchVehicle.slowDownPassageOfTime, refFrame.timeSinceStart + timeDeltaInSeconds)
        const deltaT = adjustedTimeSinceStart - this.timeLaunched
        const res = refFrame.curve.findRelevantCurve(deltaT)
        const relevantCurve = res.relevantCurve
        const d = relevantCurve.tTod(deltaT - res.relevantCurveStartTime) / res.relevantCurveLength
        const pointOnRelevantCurve = relevantCurve.getPointAt(Math.max(0, Math.min(1, d)))
        return pointOnRelevantCurve

    }
      
}
