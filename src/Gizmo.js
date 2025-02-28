import {
  ArcType,
  BlendingState,
  BoundingSphere,
  BoxGeometry,
  Cartesian2,
  Cartesian3,
  Color,
  CylinderGeometry,
  defined,
  destroyObject,
  GeometryInstance,
  Matrix4,
  Material,
  MaterialAppearance,
  Math as CesiumMath,
  Matrix3,
  Primitive,
  PolylineGeometry,
  PolylineMaterialAppearance,
  ScreenSpaceEventType,
  ScreenSpaceEventHandler,
  SceneTransforms,
  Transforms,
} from "cesium";
import { getScaleForMinimumSize } from "./GizmoUtil";

const GizmoPart = {
  xAxis: "xAxis",
  yAxis: "yAxis",
  zAxis: "zAxis",
};

const GizmoMode = {
  translate: "translate",
  rotate: "rotate",
  scale: "scale",
};

class GizmoComponentPrimitive {
  constructor(gizmo, mode) {
    this._gizmo = gizmo;
    this._part = []; // [x, y, z]
    this._show = true;
    this._scale = 1;
    this._scaleMatrix = new Matrix4();
    this._mode = mode;
  }
  update(frameState) {
    if (!this._show) {
      return;
    }

    // fix gizmo's screen size
    this._scale = getScaleForMinimumSize(this._gizmo, frameState);

    if (this._mode === GizmoMode.translate) {
      const NEUMatrix = Transforms.eastNorthUpToFixedFrame(
        Matrix4.getTranslation(this._gizmo.modelMatrix, new Cartesian3()),
      );
      this._scaleMatrix = Matrix4.multiplyByUniformScale(
        NEUMatrix,
        this._scale,
        NEUMatrix,
      );
    } else {
      this._scaleMatrix = Matrix4.multiplyByUniformScale(
        this._gizmo.modelMatrix,
        this._scale,
        new Matrix4(),
      );
    }

    for (const p of this._part) {
      p.modelMatrix = this._scaleMatrix;
      p.update(frameState);
    }
  }

  isDestroyed() {
    return false;
  }

  destroy() {
    for (const p of this._part) {
      p.destroy();
    }
    this._part = [];
    return destroyObject(this);
  }
}

/**
 * A Simple Cesium Gizmo using Cesuim's Public API
 * Thanks to the amzing job from https://www.github.com/zhwy/cesium-gizmo and three.js TransformControls
 */
export default class Gizmo {
  constructor() {
    this.mode = null;
    this.applyTransformationToMountedPrimitive = true;
    this.modelMatrix = Matrix4.IDENTITY;
    this.length = 200 + 50; // gizmo pixel length;

    this._viewer = null;
    this._mountedPrimitive = null;

    this._transPrimitives = null;
    this._rotatePrimitives = null;
    this._scalePrimitives = null;

    // 0.99 for translucent PASS
    this._xMaterial = Material.fromType("Color", {
      color: new Color(1.0, 0.0, 0.0, 0.99),
    });
    this._yMaterial = Material.fromType("Color", {
      color: new Color(0.0, 1.0, 0.0, 0.99),
    });
    this._zMaterial = Material.fromType("Color", {
      color: new Color(0.0, 0.0, 1.0, 0.99),
    });
    this._highlightMaterial = Material.fromType("Color", {
      color: new Color(1.0, 1.0, 0.0, 0.99),
    });

    this.createGizmoPrimitive();
  }

  createGizmoPrimitive() {
    // * create Translate Primitive
    const arrowLength = 0.2;
    const arrowRadius = 0.06;
    const lineLength = 0.8;
    const lineRadius = 0.01;

    // reuseable geometry。可以使用polyline Arrow，或者 polyline Volumn！！！
    const arrowGeometry = new CylinderGeometry({
      length: arrowLength,
      topRadius: 0,
      bottomRadius: arrowRadius,
    });
    const lineGeometry = new CylinderGeometry({
      length: lineLength,
      topRadius: lineRadius,
      bottomRadius: lineRadius,
    });

    const xArrowModelMatrix = calTransModelMatrix(
      Cartesian3.UNIT_X,
      arrowLength / 2 + lineLength,
    );
    const xLineModelMatrix = calTransModelMatrix(
      Cartesian3.UNIT_X,
      lineLength / 2,
    );
    const yArrowModelMatrix = calTransModelMatrix(
      Cartesian3.UNIT_Y,
      arrowLength / 2 + lineLength,
    );
    const yLineModelMatrix = calTransModelMatrix(
      Cartesian3.UNIT_Y,
      lineLength / 2,
    );
    const zArrowModelMatrix = calTransModelMatrix(
      Cartesian3.UNIT_Z,
      arrowLength / 2 + lineLength,
    );
    const zLineModelMatrix = calTransModelMatrix(
      Cartesian3.UNIT_Z,
      lineLength / 2,
    );

    const xArrowInstance = new GeometryInstance({
      id: GizmoPart.xAxis,
      geometry: arrowGeometry,
      modelMatrix: xArrowModelMatrix,
    });
    const xLineInstance = new GeometryInstance({
      id: GizmoPart.xAxis,
      geometry: lineGeometry,
      modelMatrix: xLineModelMatrix,
    });
    const yArrowInstance = new GeometryInstance({
      id: GizmoPart.yAxis,
      geometry: arrowGeometry,
      modelMatrix: yArrowModelMatrix,
    });
    const yLineInstance = new GeometryInstance({
      id: GizmoPart.yAxis,
      geometry: lineGeometry,
      modelMatrix: yLineModelMatrix,
    });
    const zArrowInstance = new GeometryInstance({
      id: GizmoPart.zAxis,
      geometry: arrowGeometry,
      modelMatrix: zArrowModelMatrix,
    });
    const zLineInstance = new GeometryInstance({
      id: GizmoPart.zAxis,
      geometry: lineGeometry,
      modelMatrix: zLineModelMatrix,
    });

    const gizmoRenderState = {
      depthTest: {
        enabled: false,
      },
      depthMask: false,
      blending: BlendingState.ALPHA_BLEND,
    };

    const gizmoModelMatrix = Matrix4.IDENTITY;
    const xTransPrimitive = new Primitive({
      geometryInstances: [xArrowInstance, xLineInstance],
      appearance: new MaterialAppearance({
        material: this._xMaterial,
        renderState: gizmoRenderState,
      }),
      modelMatrix: gizmoModelMatrix,
      asynchronous: false,
    });
    const yTransPrimitive = new Primitive({
      geometryInstances: [yArrowInstance, yLineInstance],
      appearance: new MaterialAppearance({
        material: this._yMaterial,
        renderState: gizmoRenderState,
      }),
      modelMatrix: gizmoModelMatrix,
      asynchronous: false,
    });
    const zTransPrimitive = new Primitive({
      geometryInstances: [zArrowInstance, zLineInstance],
      appearance: new MaterialAppearance({
        material: this._zMaterial,
        renderState: gizmoRenderState,
      }),
      modelMatrix: gizmoModelMatrix,
      asynchronous: false,
    });

    const transPrimitive = new GizmoComponentPrimitive(
      this,
      GizmoMode.translate,
    );
    transPrimitive._part.push(
      xTransPrimitive,
      yTransPrimitive,
      zTransPrimitive,
    );
    this._transPrimitives = transPrimitive;

    // * create Rotate Primitive
    const points = computeCircle(1);
    const circleGeometry = new PolylineGeometry({
      positions: points,
      width: 5,
      arcType: ArcType.NONE,
      vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
    });
    const xModelMatrix = calTransModelMatrix(Cartesian3.UNIT_X, 0);
    const yModelMatrix = calTransModelMatrix(Cartesian3.UNIT_Y, 0);
    const zModelMatrix = calTransModelMatrix(Cartesian3.UNIT_Z, 0);

    const xCircleInstance = new GeometryInstance({
      id: GizmoPart.xAxis,
      geometry: circleGeometry,
      modelMatrix: xModelMatrix,
    });
    const yCircleInstance = new GeometryInstance({
      id: GizmoPart.yAxis,
      geometry: circleGeometry,
      modelMatrix: yModelMatrix,
    });
    const zCircleInstance = new GeometryInstance({
      id: GizmoPart.zAxis,
      geometry: circleGeometry,
      modelMatrix: zModelMatrix,
    });

    const xRotatePrimitive = new Primitive({
      geometryInstances: xCircleInstance,
      appearance: new PolylineMaterialAppearance({
        material: this._xMaterial,
        renderState: gizmoRenderState,
      }),
      modelMatrix: gizmoModelMatrix,
      asynchronous: false,
    });
    const yRotatePrimitive = new Primitive({
      geometryInstances: yCircleInstance,
      appearance: new PolylineMaterialAppearance({
        material: this._yMaterial,
        renderState: gizmoRenderState,
      }),
      modelMatrix: gizmoModelMatrix,
      asynchronous: false,
    });
    const zRotatePrimitive = new Primitive({
      geometryInstances: zCircleInstance,
      appearance: new PolylineMaterialAppearance({
        material: this._zMaterial,
        renderState: gizmoRenderState,
      }),
      modelMatrix: gizmoModelMatrix,
      asynchronous: false,
    });
    const rotatePrimitive = new GizmoComponentPrimitive(this, GizmoMode.rotate);
    rotatePrimitive._part.push(
      xRotatePrimitive,
      yRotatePrimitive,
      zRotatePrimitive,
    );
    this._rotatePrimitives = rotatePrimitive;

    // * create Scale Primitive
    const boxGeometry = BoxGeometry.fromDimensions({
      dimensions: new Cartesian3(
        arrowLength / 2,
        arrowLength / 2,
        arrowLength / 2,
      ),
    });
    const xBoxModelMatrix = calTransModelMatrix(Cartesian3.UNIT_X, lineLength);
    const yBoxModelMatrix = calTransModelMatrix(Cartesian3.UNIT_Y, lineLength);
    const zBoxModelMatrix = calTransModelMatrix(Cartesian3.UNIT_Z, lineLength);
    const xBoxInstance = new GeometryInstance({
      id: GizmoPart.xAxis,
      geometry: boxGeometry,
      modelMatrix: xBoxModelMatrix,
    });
    const yBoxInstance = new GeometryInstance({
      id: GizmoPart.yAxis,
      geometry: boxGeometry,
      modelMatrix: yBoxModelMatrix,
    });
    const zBoxInstance = new GeometryInstance({
      id: GizmoPart.zAxis,
      geometry: boxGeometry,
      modelMatrix: zBoxModelMatrix,
    });
    const xScalePrimitive = new Primitive({
      geometryInstances: [xBoxInstance, xLineInstance],
      appearance: new MaterialAppearance({
        material: this._xMaterial,
        renderState: gizmoRenderState,
      }),
      modelMatrix: gizmoModelMatrix,
      asynchronous: false,
    });
    const yScalePrimitive = new Primitive({
      geometryInstances: [yBoxInstance, yLineInstance],
      appearance: new MaterialAppearance({
        material: this._yMaterial,
        renderState: gizmoRenderState,
      }),
      modelMatrix: gizmoModelMatrix,
      asynchronous: false,
    });
    const zScalePrimitive = new Primitive({
      geometryInstances: [zBoxInstance, zLineInstance],
      appearance: new MaterialAppearance({
        material: this._zMaterial,
        renderState: gizmoRenderState,
      }),
      modelMatrix: gizmoModelMatrix,
      asynchronous: false,
    });
    const scalePrimitive = new GizmoComponentPrimitive(this, GizmoMode.scale);
    scalePrimitive._part.push(
      xScalePrimitive,
      yScalePrimitive,
      zScalePrimitive,
    );
    this._scalePrimitives = scalePrimitive;

    // TODO: create PlaneGizmo
  }

  // The Gizmo should be attached when the other primitives are added to the scene, for depth test
  attach(viewer) {
    this._viewer = viewer;
    this._viewer.scene.primitives.add(this._transPrimitives);
    this._viewer.scene.primitives.add(this._rotatePrimitives);
    this._viewer.scene.primitives.add(this._scalePrimitives);
    this.setMode(GizmoMode.translate);
    addPointerEventHandler(this._viewer, this);
  }

  detach() {
    this._viewer.scene.primitives.remove(this._transPrimitives);
    this._viewer.scene.primitives.remove(this._rotatePrimitives);
    this._viewer.scene.primitives.remove(this._scalePrimitives);
    this._viewer = null;
    removePointerEventHandler();
  }

  isGizmoPrimitve(primitive) {
    return (
      this._transPrimitives._part.indexOf(primitive) !== -1 ||
      this._rotatePrimitives._part.indexOf(primitive) !== -1 ||
      this._scalePrimitives._part.indexOf(primitive) !== -1
    );
  }

  setMode(mode) {
    if (mode === GizmoMode.translate) {
      this.mode = GizmoMode.translate;
      this._transPrimitives._show = true;
      this._rotatePrimitives._show = false;
      this._scalePrimitives._show = false;
    } else if (mode === GizmoMode.rotate) {
      this.mode = GizmoMode.rotate;
      this._transPrimitives._show = false;
      this._rotatePrimitives._show = true;
      this._scalePrimitives._show = false;
    } else if (mode === GizmoMode.scale) {
      this.mode = GizmoMode.scale;
      this._transPrimitives._show = false;
      this._rotatePrimitives._show = false;
      this._scalePrimitives._show = true;
    }
  }
}

/**
 *
 * @param {Cartesian3} axis
 * @param {number} translate
 * @param {Material} NEUModelMatrix
 * @returns
 */
function calTransModelMatrix(axis, translate) {
  const modelMatrix = Matrix4.IDENTITY.clone();
  if (Cartesian3.equals(axis, Cartesian3.UNIT_Y)) {
    const rotation = Matrix3.fromRotationX(CesiumMath.toRadians(-90));
    const translation = Cartesian3.fromElements(0, translate, 0);
    Matrix4.setTranslation(modelMatrix, translation, modelMatrix);
    Matrix4.setRotation(modelMatrix, rotation, modelMatrix);
  } else if (Cartesian3.equals(axis, Cartesian3.UNIT_X)) {
    const rotation = Matrix3.fromRotationY(CesiumMath.toRadians(90));
    const translation = Cartesian3.fromElements(translate, 0, 0);
    Matrix4.setTranslation(modelMatrix, translation, modelMatrix);
    Matrix4.setRotation(modelMatrix, rotation, modelMatrix);
  } else if (Cartesian3.equals(axis, Cartesian3.UNIT_Z)) {
    const rotation = Matrix3.IDENTITY;
    const translation = Cartesian3.fromElements(0, 0, translate);
    Matrix4.setTranslation(modelMatrix, translation, modelMatrix);
    Matrix4.setRotation(modelMatrix, rotation, modelMatrix);
  }
  return modelMatrix;
}

function computeCircle(r) {
  const points = [];
  for (let i = 0; i <= 360; i++) {
    const radians = CesiumMath.toRadians(i);
    const x = Math.cos(radians) * r;
    const y = Math.sin(radians) * r;
    points.push(new Cartesian3(x, y, 0.0));
  }

  return points;
}

let startPos = new Cartesian2(); // For Trans and Rotate
let gizmoStartPos = new Cartesian3();
let gizmoStartModelMatrix = new Matrix4();
let mountedPrimitiveStartModelMatrix = new Matrix4(); // For Scale
let pickedGizmoId = null;
let handler;

/**
 *
 * @param {Viewer} viewer
 * @param {Gizmo} gizmo
 */
function addPointerEventHandler(viewer, gizmo) {
  handler = new ScreenSpaceEventHandler(viewer.canvas);

  handler.setInputAction((movement) => {
    const picked = viewer.scene.pick(movement.position);
    // console.log(picked);
    if (defined(picked)) {
      if (!gizmo.isGizmoPrimitve(picked.primitive)) {
        if (picked.primitive.modelMatrix instanceof Matrix4) {
          gizmo._mountedPrimitive = picked.primitive;
          gizmo.modelMatrix = picked.primitive.modelMatrix.clone();
        }
      }
    }
  }, ScreenSpaceEventType.LEFT_CLICK);

  handler.setInputAction((movement) => {
    const picked = viewer.scene.pick(movement.position);
    if (defined(picked)) {
      if (
        picked.id === GizmoPart.xAxis ||
        picked.id === GizmoPart.yAxis ||
        picked.id === GizmoPart.zAxis
      ) {
        console.log(picked.id);
        // picked gizmo
        pickedGizmoId = picked.id;
        viewer.scene.screenSpaceCameraController.enableRotate = false;
        viewer.scene.screenSpaceCameraController.enableTranslate = false;

        startPos = movement.position;
        gizmoStartPos = new Cartesian3(
          gizmo.modelMatrix[12],
          gizmo.modelMatrix[13],
          gizmo.modelMatrix[14],
        );
        gizmoStartModelMatrix = gizmo.modelMatrix.clone();
        mountedPrimitiveStartModelMatrix =
          gizmo._mountedPrimitive.modelMatrix.clone();
      } else {
        pickedGizmoId = null;
        viewer.scene.screenSpaceCameraController.enableRotate = true;
        viewer.scene.screenSpaceCameraController.enableTranslate = true;
      }
    }
  }, ScreenSpaceEventType.LEFT_DOWN);

  handler.setInputAction((_movement) => {
    if (pickedGizmoId) {
      pickedGizmoId = null;
      startPos = new Cartesian2();
      gizmoStartPos = new Cartesian3();
      gizmoStartModelMatrix = new Matrix4();
      mountedPrimitiveStartModelMatrix = new Matrix4();
    }
    viewer.scene.screenSpaceCameraController.enableRotate = true;
    viewer.scene.screenSpaceCameraController.enableTranslate = true;
  }, ScreenSpaceEventType.LEFT_UP);

  handler.setInputAction((movement) => {
    if (!pickedGizmoId) {
      const hovered = viewer.scene.pick(movement.endPosition);
      const xMaterial =
        defined(hovered) && hovered.id === GizmoPart.xAxis
          ? gizmo._highlightMaterial
          : gizmo._xMaterial;
      const yMaterial =
        defined(hovered) && hovered.id === GizmoPart.yAxis
          ? gizmo._highlightMaterial
          : gizmo._yMaterial;
      const zMaterial =
        defined(hovered) && hovered.id === GizmoPart.zAxis
          ? gizmo._highlightMaterial
          : gizmo._zMaterial;

      gizmo._transPrimitives._part[0].appearance.material = xMaterial;
      gizmo._transPrimitives._part[1].appearance.material = yMaterial;
      gizmo._transPrimitives._part[2].appearance.material = zMaterial;
      // ----
      gizmo._rotatePrimitives._part[0].appearance.material = xMaterial;
      gizmo._rotatePrimitives._part[1].appearance.material = yMaterial;
      gizmo._rotatePrimitives._part[2].appearance.material = zMaterial;
      // ----
      gizmo._scalePrimitives._part[0].appearance.material = xMaterial;
      gizmo._scalePrimitives._part[1].appearance.material = yMaterial;
      gizmo._scalePrimitives._part[2].appearance.material = zMaterial;

      return;
    }

    const mouseDirOnWindowCoordinates = new Cartesian2(
      movement.endPosition.x - startPos.x,
      movement.endPosition.y - startPos.y,
    );
    if (
      mouseDirOnWindowCoordinates.x === 0 &&
      mouseDirOnWindowCoordinates.y === 0
    ) {
      return;
    }

    // modelMatrix = transfrom * rotation * scale
    if (gizmo.mode === GizmoMode.translate) {
      const trans = getTrans(
        pickedGizmoId,
        viewer,
        mouseDirOnWindowCoordinates,
      );

      const transMatrix = Matrix4.fromTranslation(trans, new Matrix4());
      const resultMatrix = Matrix4.multiply(
        transMatrix,
        gizmoStartModelMatrix,
        transMatrix,
      );

      if (
        isNaN(resultMatrix[12]) ||
        isNaN(resultMatrix[13]) ||
        isNaN(resultMatrix[14])
      ) {
        return;
      }

      // apply translation to gizmo
      gizmo.modelMatrix[12] = resultMatrix[12];
      gizmo.modelMatrix[13] = resultMatrix[13];
      gizmo.modelMatrix[14] = resultMatrix[14];

      if (gizmo.applyTransformationToMountedPrimitive) {
        const mountedPrimitive = gizmo._mountedPrimitive;
        mountedPrimitive.modelMatrix[12] = resultMatrix[12];
        mountedPrimitive.modelMatrix[13] = resultMatrix[13];
        mountedPrimitive.modelMatrix[14] = resultMatrix[14];
      }
    } else if (gizmo.mode === GizmoMode.rotate) {
      const rotate = getRotate(
        pickedGizmoId,
        viewer,
        gizmoStartPos,
        gizmoStartModelMatrix,
        movement.startPosition,
        movement.endPosition,
      );

      const resultMatrix = Matrix4.multiplyByMatrix3(
        gizmoStartModelMatrix,
        rotate,
        gizmoStartModelMatrix,
      );

      // apply rotation to gizmo
      gizmo.modelMatrix = resultMatrix;

      if (gizmo.applyTransformationToMountedPrimitive) {
        const mountedPrimitive = gizmo._mountedPrimitive;

        const transfrom = Transforms.eastNorthUpToFixedFrame(gizmoStartPos);

        const transformInverse = Matrix4.inverseTransformation(
          transfrom,
          new Matrix4(),
        );

        const before = Matrix4.multiply(
          transformInverse,
          mountedPrimitive.modelMatrix,
          new Matrix4(),
        );

        const result = new Matrix3();
        Matrix3.multiply(
          Matrix4.getRotation(before, new Matrix3()),
          rotate,
          result,
        );
        Matrix3.multiplyByScale(
          result,
          Matrix4.getScale(before, new Cartesian3()),
          result,
        );

        const resultMatrix2 = Matrix4.multiplyByMatrix3(
          transfrom,
          result,
          transfrom,
        );

        mountedPrimitive.modelMatrix = resultMatrix2;
      }
    } else if (gizmo.mode === GizmoMode.scale) {
      const scale = getScale(
        pickedGizmoId,
        viewer,
        gizmoStartPos,
        gizmoStartModelMatrix,
        mouseDirOnWindowCoordinates,
      );

      // don't apply scale to gizmo
      // ---
      if (gizmo.applyTransformationToMountedPrimitive) {
        const mountedPrimitive = gizmo._mountedPrimitive;

        const resultMatrix = Matrix4.multiplyByScale(
          mountedPrimitiveStartModelMatrix,
          scale,
          new Matrix4(),
        );

        mountedPrimitive.modelMatrix = resultMatrix;
      }
    }
  }, ScreenSpaceEventType.MOUSE_MOVE);
}

function removePointerEventHandler() {
  handler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
  handler.removeInputAction(ScreenSpaceEventType.LEFT_DOWN);
  handler.removeInputAction(ScreenSpaceEventType.LEFT_UP);
  handler.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
  handler = handler && handler.destroy();
}

/**
 * Get translation on gizmo axis
 * @param {GizmoPart.xAxis | GizmoPart.yAxis | GizmoPart.zAxis} gizmoPartId
 * @param {Viewer} viewer
 * @param {Cartesian2} mouseDirOnWindowCoordinates
 * @returns {Cartesian3}
 */
function getTrans(gizmoPartId, viewer, mouseDirOnWindowCoordinates) {
  let axisDir;
  switch (gizmoPartId) {
    case GizmoPart.xAxis:
      axisDir = Cartesian3.UNIT_X;
      break;
    case GizmoPart.yAxis:
      axisDir = Cartesian3.UNIT_Y;
      break;
    case GizmoPart.zAxis:
      axisDir = Cartesian3.UNIT_Z;
      break;
  }
  // calc xAis 在screen的方向
  const transfrom = Transforms.eastNorthUpToFixedFrame(gizmoStartPos);
  const axisDirOnWorldCoordinates = Matrix4.multiplyByPointAsVector(
    transfrom,
    axisDir,
    new Cartesian3(),
  );

  const originPosOnWindowCoordinates = SceneTransforms.worldToWindowCoordinates(
    viewer.scene,
    gizmoStartPos,
  );

  const endPos = Cartesian3.add(
    gizmoStartPos,
    axisDirOnWorldCoordinates,
    new Cartesian3(),
  );
  const endPosOnWindowCoordinates = SceneTransforms.worldToWindowCoordinates(
    viewer.scene,
    endPos,
  );

  const axisDirOnWindowCoordinates = Cartesian2.subtract(
    endPosOnWindowCoordinates,
    originPosOnWindowCoordinates,
    new Cartesian2(),
  );

  // 然后与mouseDir做点积, 得到沿轴移动的像素数
  const deltaPixelsAlongAxis =
    Cartesian2.dot(axisDirOnWindowCoordinates, mouseDirOnWindowCoordinates) /
    Cartesian2.magnitude(axisDirOnWindowCoordinates);

  const metersPerPixel = viewer.camera.getPixelSize(
    new BoundingSphere(
      gizmoStartPos,
      Cartesian3.magnitude(axisDirOnWorldCoordinates),
    ),
    viewer.canvas.width,
    viewer.canvas.height,
  );
  // 根据meter/pixel计算移动距离
  return Cartesian3.multiplyByScalar(
    axisDirOnWorldCoordinates,
    deltaPixelsAlongAxis * metersPerPixel,
    new Cartesian3(),
  );
}

/**
 * get rotate around gizmo axis
 * @param {GizmoPart.xAxis | GizmoPart.yAxis | GizmoPart.zAxis} gizmoPartId
 * @param {Viewer} viewer
 * @param {Cartesian2} mouseStartPosOnWindowCoordinates
 * @param {Cartesian2} mouseEndPosOnWindowCoordinates
 * @returns {Matrix3}
 */
function getRotate(
  gizmoPartId,
  viewer,
  gizmoStartPos,
  gizmoStartModelMatrix,
  mouseStartPosOnWindowCoordinates,
  mouseEndPosOnWindowCoordinates,
) {
  // cal delta angle between start and end around origin
  const originPosOnWindowCoordinates = SceneTransforms.worldToWindowCoordinates(
    viewer.scene,
    gizmoStartPos,
  );

  const startDirOnWindowCoordinates = Cartesian2.subtract(
    mouseStartPosOnWindowCoordinates,
    originPosOnWindowCoordinates,
    new Cartesian2(),
  );

  const endDirOnWindowCoordinates = Cartesian2.subtract(
    mouseEndPosOnWindowCoordinates,
    originPosOnWindowCoordinates,
    new Cartesian2(),
  );

  const cross = CesiumMath.signNotZero(
    Cartesian2.cross(startDirOnWindowCoordinates, endDirOnWindowCoordinates),
  );

  const angle = Cartesian2.angleBetween(
    startDirOnWindowCoordinates,
    endDirOnWindowCoordinates,
  );

  const isClockwise = -cross;

  const rayFromCameraToGizmoPos = Cartesian3.subtract(
    viewer.scene.camera.positionWC,
    gizmoStartPos,
    new Cartesian3(),
  );

  let isCameraOnPositiveSide;
  const rotation = new Matrix3();
  const axisDir = new Cartesian3();
  switch (gizmoPartId) {
    case GizmoPart.xAxis:
      Matrix4.multiplyByPointAsVector(
        gizmoStartModelMatrix,
        Cartesian3.UNIT_X,
        axisDir,
      );
      isCameraOnPositiveSide = CesiumMath.signNotZero(
        Cartesian3.dot(axisDir, rayFromCameraToGizmoPos),
      );
      Matrix3.fromRotationX(
        angle * isClockwise * isCameraOnPositiveSide,
        rotation,
      );
      break;
    case GizmoPart.yAxis:
      Matrix4.multiplyByPointAsVector(
        gizmoStartModelMatrix,
        Cartesian3.UNIT_Y,
        axisDir,
      );
      isCameraOnPositiveSide = CesiumMath.signNotZero(
        Cartesian3.dot(axisDir, rayFromCameraToGizmoPos),
      );
      Matrix3.fromRotationY(
        angle * isClockwise * isCameraOnPositiveSide,
        rotation,
      );
      break;
    case GizmoPart.zAxis:
      Matrix4.multiplyByPointAsVector(
        gizmoStartModelMatrix,
        Cartesian3.UNIT_Z,
        axisDir,
      );
      isCameraOnPositiveSide = CesiumMath.signNotZero(
        Cartesian3.dot(axisDir, rayFromCameraToGizmoPos),
      );
      Matrix3.fromRotationZ(
        angle * isClockwise * isCameraOnPositiveSide,
        rotation,
      );
      break;
  }

  return rotation;
}

/**
 * Get scale on gizmo axis
 * @param {GizmoPart.xAxis | GizmoPart.yAxis | GizmoPart.zAxis} gizmoPartId
 * @param {Viewer} viewer
 * @param {Cartesian3} gizmoStartPos
 * @param {Matrix4} gizmoStartModelMatrix
 * @param {Cartesian2} mouseDirOnWindowCoordinates
 * @returns {Cartesian3}
 */
function getScale(
  gizmoPartId,
  viewer,
  gizmoStartPos,
  gizmoStartModelMatrix,
  mouseDirOnWindowCoordinates,
) {
  const axisDirOnWorldCoordinates = new Cartesian3();
  switch (gizmoPartId) {
    case GizmoPart.xAxis:
      Matrix4.multiplyByPointAsVector(
        gizmoStartModelMatrix,
        Cartesian3.UNIT_X,
        axisDirOnWorldCoordinates,
      );
      break;
    case GizmoPart.yAxis:
      Matrix4.multiplyByPointAsVector(
        gizmoStartModelMatrix,
        Cartesian3.UNIT_Y,
        axisDirOnWorldCoordinates,
      );
      break;
    case GizmoPart.zAxis:
      Matrix4.multiplyByPointAsVector(
        gizmoStartModelMatrix,
        Cartesian3.UNIT_Z,
        axisDirOnWorldCoordinates,
      );
      break;
  }

  const originPosOnWindowCoordinates = SceneTransforms.worldToWindowCoordinates(
    viewer.scene,
    gizmoStartPos,
  );

  const endPos = Cartesian3.add(
    gizmoStartPos,
    axisDirOnWorldCoordinates,
    new Cartesian3(),
  );

  const endPosOnWindowCoordinates = SceneTransforms.worldToWindowCoordinates(
    viewer.scene,
    endPos,
  );

  const axisDirOnWindowCoordinates = Cartesian2.subtract(
    endPosOnWindowCoordinates,
    originPosOnWindowCoordinates,
    new Cartesian2(),
  );

  // 然后与mouseDir做点积, 得到沿轴移动的像素数
  const deltaPixelsAlongAxis =
    Cartesian2.dot(axisDirOnWindowCoordinates, mouseDirOnWindowCoordinates) /
    Cartesian2.magnitude(axisDirOnWindowCoordinates);
  const factor = deltaPixelsAlongAxis / 10 + 1;

  let scale;
  switch (gizmoPartId) {
    case GizmoPart.xAxis:
      scale = new Cartesian3(factor, 1, 1);
      break;
    case GizmoPart.yAxis:
      scale = new Cartesian3(1, factor, 1);
      break;
    case GizmoPart.zAxis:
      scale = new Cartesian3(1, 1, factor);
      break;
  }

  return scale;
}

export { Gizmo };
