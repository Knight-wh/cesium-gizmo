import * as Cesium from "cesium";

function getScaleInPixels(positionWC, radius, frameState) {
  const scratchBoundingSphere = new Cesium.BoundingSphere();
  scratchBoundingSphere.center = positionWC;
  scratchBoundingSphere.radius = radius;
  return frameState.camera.getPixelSize(
    scratchBoundingSphere,
    frameState.context.drawingBufferWidth,
    frameState.context.drawingBufferHeight,
  );
}

function getScaleForMinimumSize(model, frameState) {
  const scratchPosition = new Cesium.Cartesian3();
  const scratchCartographic = new Cesium.Cartographic();

  // Compute size of bounding sphere in pixels
  const context = frameState.context;
  const maxPixelSize = Math.max(
    context.drawingBufferWidth,
    context.drawingBufferHeight,
  );
  const m = model.modelMatrix;
  scratchPosition.x = m[12];
  scratchPosition.y = m[13];
  scratchPosition.z = m[14];

  if (frameState.camera._scene.mode !== Cesium.SceneMode.SCENE3D) {
    const projection = frameState.mapProjection;
    const cartographic = projection.ellipsoid.cartesianToCartographic(
      scratchPosition,
      scratchCartographic,
    );
    projection.project(cartographic, scratchPosition);
    Cesium.Cartesian3.fromElements(
      scratchPosition.z,
      scratchPosition.x,
      scratchPosition.y,
      scratchPosition,
    );
  }

  const radius = 1;

  const metersPerPixel = getScaleInPixels(scratchPosition, radius, frameState);

  // metersPerPixel is always > 0.0
  const pixelsPerMeter = 1.0 / metersPerPixel;
  const diameterInPixels = Math.min(
    pixelsPerMeter * 2.0 * radius,
    maxPixelSize,
  );

  let scale = 1;
  // Maintain model's minimum pixel size
  if (diameterInPixels < model.length) {
    scale = (model.length * metersPerPixel) / (2.0 * radius);
  }

  //   console.log(scale, "m/Pixel", metersPerPixel, maxPixelSize, diameterInPixels);

  return scale;
}
export { getScaleForMinimumSize };
