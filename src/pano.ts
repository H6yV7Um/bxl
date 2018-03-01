import {WebGLRenderer, Scene, PerspectiveCamera, Vector3, BackSide, MeshBasicMaterial, SphereGeometry, Mesh, CubeRefractionMapping, Math as TMath} from 'three';
import OrbitControl from './controls/orbitControl';
import GyroControl from './controls/gyroControl';
import EventEmitter from './event';
import Log from './log';
import Util from './util';
import ResourceLoader from './loaders/resource.loader';
import Tween from './animations/tween.animation';
import Overlays from './overlays/overlays.overlay';

/**
 * @file 全景渲染
 */

const defaultOpts = {
    el: undefined,
    fov: 80,
    gyro: false,
    width: null,
    height: null
};
const myLoader = new ResourceLoader();
export default class Pano {
    overlays: Overlays;
    opts = null;
    root = null;
    webgl = null;
    scene = null;
    camera = null;
    skyBox = null;
    orbitControl = null;
    gyroControl = null;
    currentData = null;
    event = new EventEmitter();
    group = [];
    pluginList = [];

    constructor(opts) {
        this.opts = Object.assign({}, defaultOpts, opts);
    
        this.initEnv();
        this.dispatch('render-init', this);
    }

    initEnv() {
        const opts = this.opts;
        const container = opts.el;
        const size = Util.calcRenderSize(opts, container);
        const root = this.root = Util.createElement('<div class="pano-root" style="width:'
            + size.width + 'px;height:' + size.height + 'px;"></div>');
        // 渲染器
        const webgl = this.webgl = new WebGLRenderer({alpha: true, antialias: true});
        webgl.autoClear = true;
        webgl.setPixelRatio(window.devicePixelRatio);
        webgl.setSize(size.width, size.height);
        // 容器
        root.appendChild(webgl.domElement);
        container.appendChild(root);
        // 场景, 相机
        this.scene = new Scene();
        this.camera = new PerspectiveCamera(opts.fov, size.aspect, 0.1, 10000);
        // 场景控制器
        const control = this.orbitControl = new OrbitControl(this.camera, webgl.domElement);
        // 陀螺仪控制器
        if (opts.gyro) {
            this.gyroControl = new GyroControl(this.camera, control);
        }
        // bind overlays events
        this.overlays = new Overlays(this);        
    }

    resetEnv(data) {
        const camera = this.camera;
        // scene fov
        camera.fov = data.fov || this.opts.fov;
        camera.updateProjectionMatrix()
        // look at angle
        this.setLook(data.lng || 180, data.lat || 90);
    }

    /**
     * 渲染预览图纹理
     * @param {Object} texture 纹理贴图 
     */
    initPreview(texture) {
        const material = new MeshBasicMaterial({
            envMap: texture,
            side: BackSide,
            refractionRatio: 0,
            reflectivity: 1
        });
        const geometry = new SphereGeometry(2000, 32, 16);
        const skyBox = this.skyBox = new Mesh(geometry, material);

        this.scene.add(skyBox);
        this.dispatch('scene-init', this);
        this.render();
    }

    /**
     * 在渲染帧中更新控制器
     */
    updateControl() {
        if (this.gyroControl && this.gyroControl.enabled) {
            this.gyroControl.update();
        } else {
            this.orbitControl.update();
        }
    }

    /**
     * 设置相机角度, 相机方向 (0, 0, -1), 相对初始 z 轴正方向 (180, 90)
     * @param {number} lng 横向角度
     * @param {number} lat 纵向角度
     */
    setLook(lng?, lat?) {
        const control = this.orbitControl;

        if (lng !== undefined && lat !== undefined) {
            const theta = (180 - lng) * (Math.PI / 180);
            const phi = (90 - lat) * (Math.PI / 180);

            control.reset();
            control.rotateLeft(theta);
            control.rotateUp(phi);
        }
    }
    
    /**
     * 获取相机角度
     */
    getLook() {
        const control = this.orbitControl;
        const theta = control.getAzimuthalAngle();
        const phi = control.getPolarAngle();

        return {
            lng: theta * 180 / Math.PI,
            lat: phi * 180 / Math.PI
        };
    }

    /**
     * 设置视角
     * @param {number} fov 视角
     * @param {number} duration 时长
     */
    setFov(fov, duration) {
        const camera = this.getCamera();        
        new Tween(camera).to({fov}).effect('quadEaseOut', duration || 1000)
            .start(['fov'], this).process(() => camera.updateProjectionMatrix());
    }

    /**
     * 获取视角
     */
    getFov() {
        return this.getCamera().fov;
    }

    /**
     * 恢复视角
     */
    resetFov() {
        const camera = this.camera;
        camera.fov = this.opts.fov;
        camera.updateProjectionMatrix();
    }

    /**
     * 安装插件并注入属性
     * @param {Object} Plugin 插件 class
     * @param {Object} data 插件数据
     */
    addPlugin(Plugin, data) {
        const plugin = new Plugin(this, data);
        this.pluginList.push(plugin);
    }

    subscribe(type, fn, context?) {
        this.event.on(type, fn, context);
    }

    unsubscribe(type, fn, context?) {
        this.event.off(type, fn, context);
    }

    dispatch(type, arg1?, arg2?) {
        this.event.emit(type, arg1, arg2);
    }

    /**
     * 渲染场景贴图
     * @param {Object} texture 场景原图纹理
     * @param {boolean} slient 安静模式
     */
    replaceTexture(texture) {
        texture.mapping = CubeRefractionMapping;
        texture.needsUpdate = true;

        const tempTex = this.skyBox.material.envMap;
        this.skyBox.material.envMap = texture;
        tempTex.dispose();
        // 触发场景切换事件
        this.dispatch('scene-attach', this.currentData, this);
    }

    /**
     * 帧渲染
     */
    animate() {
        this.updateControl(); 
        this.dispatch('render-process', this.currentData, this);
        this.render();

        requestAnimationFrame(this.animate.bind(this));
    }

    render() {
        this.webgl.render(this.scene, this.camera);
    }

    /**
     * 窗口变化响应事件
     */
    onResize() {
        const camera = this.getCamera();
        const root = this.getRoot();
        const size =  Util.calcRenderSize(this.opts, root);

        camera.aspect = size.aspect;
        camera.updateProjectionMatrix();
        this.webgl.setSize(size.width, size.height);
        // set root element's size
        Util.styleElement(root, {
            width: size.width,
            height: size.height
        });
    }

    /**
     * 获取相机
     */
    getCamera() {
        return this.camera;
    }

    /**
     * 获取画布元素
     */
    getCanvas() {
        return this.webgl.domElement;
    }

    /**
     * 获取容器元素
     */
    getRoot() {
        return this.root;
    }

    /**
     * 获取场景对象
     */
    getScene() {
        return this.scene;
    }

    /**
     * 获取控制器
     */
    getControl() {
        return this.orbitControl;
    }

    /**
     * 获取 camera lookat 目标的 vector3 obj
     */
    getLookAtTarget() {
        return this.orbitControl.target;
    }

    /**
     * 添加 object3d 对象
     */
    addSceneObject(obj) {
        this.scene.add(obj);
    }

    /**
     * 删除 object3d 对象
     */
    removeSceneObject(obj) {
        this.scene.remove(obj);
    }

    /**
     * 添加 dom 对象
     */
    addDomObject(obj) {
        this.root.appendChild(obj);
    }

    /**
     * 删除 dom 对象
     */
    removeDomObject(obj) {
        this.root.removeChild(obj);
    }

    /**
     * 添加热点覆盖物, 目前支持 mesh
     */
    addOverlay(location, text) {
        const data = {
            'overlays': [{
                type: 'dom',
                actionType: 'custom',
                content: '<strong>动态热点</strong>',
                location: {
                    lng: location.lng,
                    lat: location.lat
                }
            }]
        };

        this.overlays.create(data);
    }

    /**
     * enter next scene
     * @param {Object} data scene data or id
     * @param {boolean} slient without set camera
     */
    enterNext(data, slient?) {
        if (typeof data === 'string') {
            data = this.group && this.group.find(item => item.id == data);
        }

        if (!data) {
            return Log.output('no scene data provided');
        }

        return myLoader.loadTexture(data.bxlPath || data.texPath)
            .then(texture => {
                this.currentData = data;
                !slient && this.resetEnv(data);
                this.replaceTexture(texture);
            }).catch(e => Log.output('load source texture fail'));
    }

    startGyroControl() {
        if (this.gyroControl && !this.gyroControl.enabled) {
            this.gyroControl.connect();
        }
    }

    stopGyroControl() {
        if (this.gyroControl) {
            this.gyroControl.disconnect();
            delete this.gyroControl;
        }
    }

    /** 
     * 开场动画结束
     */
    noTimeline() {
       this.startGyroControl();
    }

    dispose() {
        Util.cleanup(null, this.scene);

        this.stopGyroControl();
        this.dispatch('render-dispose', this);
        this.event.removeAllListeners();
        this.webgl.dispose();
        this.root.innerHTML = '';
    }
}