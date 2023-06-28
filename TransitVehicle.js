import * as tram from './tram.js'

export class virtualTransitVehicle {
    constructor(positionInFrameOfReference, unallocatedModelsArray) {
        // The virtual vehicle has a position around the ring, a transitTubeLevel, and an innerOuterTrackFactor
        // A 0 indicates the lower level, and a 1 indicates the upper level
        // A 0 indicates the inner track and a 1 indicates the outer track. Values between 0 and 1 indicate that the vehicle is changing tracks.
        // Distance around the track is a value from 0 to 2*PI
        this.p = positionInFrameOfReference
        this.unallocatedModels = unallocatedModelsArray
        // level
        // innerOuterTrackFactor
        // distanceAroundTrack
        // speed
        // accelleration
        // position
        // modelIndex
    }

    // The following properties are common to all virtual vehicles...
    static transitVehicleRelativePosition_r = []
    static transitVehicleRelativePosition_y = []
    static currentEquivalentLatitude
    static isVisible
    static isDynamic
    static hasChanged

    static update(dParamWithUnits, trackOffsetsList, crv) {
        for (let trackIndex = 0; trackIndex<trackOffsetsList.length; trackIndex++) {
            const outwardOffset = dParamWithUnits['transitTubeOutwardOffset'].value + trackOffsetsList[trackIndex][0]
            const upwardOffset = dParamWithUnits['transitTubeUpwardOffset'].value + dParamWithUnits['ringTerminusUpwardOffset'].value + trackOffsetsList[trackIndex][1] + dParamWithUnits['transitVehicleUpwardOffset'].value  // Last is half of the track height
            virtualTransitVehicle.transitVehicleRelativePosition_r[trackIndex] = tram.offset_r(outwardOffset, upwardOffset, crv.currentEquivalentLatitude)
            virtualTransitVehicle.transitVehicleRelativePosition_y[trackIndex]  = tram.offset_y(outwardOffset, upwardOffset, crv.currentEquivalentLatitude)
        }
        virtualTransitVehicle.currentEquivalentLatitude = crv.currentEquivalentLatitude
        virtualTransitVehicle.isVisible = dParamWithUnits['showTransitVehicles'].value
        virtualTransitVehicle.isDynamic =  true
        virtualTransitVehicle.hasChanged = true
    }

    placeAndOrientModel(om, refFrame, wedgeToCameraDistance) {
        const modelsTrackPosition = (this.p + refFrame.p) % 1
        if (modelsTrackPosition==='undefined' || (modelsTrackPosition<0) || (modelsTrackPosition>1)) {
            console.log("error!!!")
        }
        else {
            const trackIndex = refFrame.trackIndex
            const r1 = virtualTransitVehicle.transitVehicleRelativePosition_r[trackIndex]
            const y1 = virtualTransitVehicle.transitVehicleRelativePosition_y[trackIndex]
            const pointOnRingCurve = refFrame.curve.getPoint(modelsTrackPosition)
            const angle = 2 * Math.PI * modelsTrackPosition
            om.position.set(
                pointOnRingCurve.x + r1 * Math.cos(angle),
                pointOnRingCurve.y + y1,
                pointOnRingCurve.z + r1 * Math.sin(angle) )
            om.rotation.set(0, -angle, virtualTransitVehicle.currentEquivalentLatitude)
            if (refFrame.direction===-1) {
                om.rotateX(Math.PI)
            }
            om.visible = virtualTransitVehicle.isVisible
            om.matrixValid = false
        }
    }
}