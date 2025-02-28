# cesium-gizmo

A Simple Cesium Gizmo using Cesuim's Public API.

一个使用Cesium公共API的简易Gizmo

Thanks to the amzing job from [cesium-gizmo](https://www.github.com/zhwy/cesium-gizmo) and [three.js](https://github.com/mrdoob/three.js) TransformControls

> Under development.

## Usage

```sh
npm install cesium-gizmo
```

```javascript
import { Gizmo } from "cesium-gizmo";
const gizmo = new Gizmo();

gizmo.attach(viewer);
```

## Development

This repository contains an example.

```sh
npm install
npm run dev
```

For the built, production version

```sh
npm run build
```

## Available scripts

- `npm run eslint` - Lint this project
- `npm run prettier` - Format all the code to a consistant style
- `npm run prettier-check` - Check the format of code but do not change it
- `npm run dev` - Starts the Vite development server server at `localhost:5173`
- `npm run build` - Runs the Vite production build

## Thanks

[cesium-vite-example](https://github.com/CesiumGS/cesium-vite-example)

[cesium-gizmo](https://www.github.com/zhwy/cesium-gizmo)

[教程 - 在 Vue3+Ts 中引入 CesiumJS 的最佳实践@2023](https://juejin.cn/post/7219674355491340348)
