import {Vector3, Raycaster, Group} from 'three';
import DomOverlay from './dom.overlay';
import MeshOverlay from './mesh.overlay';
import SpriteOverlay from './sprite.overlay';
import FrameOverlay from './frame.overlay';
import VideoOverlay from './video.overlay';
import Pano from '../pano';
import Util from '../../core/util';
import Log from '../../core/log';

/**
 * @file 管理所有场景下的覆盖物
 * list 保存点击覆盖物时进入场景数据
 * overlays 由 pano scene-attach 事件管理
 * @TODO: cid 缓存当前场景 overlays, 但是切换场景时还是 remove - create 机制
 */

const AnimationOpts = {
    rain: {
        type: 2,
        size: 15,
        spriteCount: 1000,
        speed: 9,
        colorR: 0.25,
        colorG: 0.25,
        colorB: 0.25
    },
    snow: {
        type: 1,
        spriteCount: 500,
        colorR: 1,
        colorG: 1,
        colorB: 1
    }
};

export default class Overlays {
    cid: number;
    pano: Pano;
    list: any;
    maps = {};
    raycaster = new Raycaster();

    constructor(pano: Pano, list) {
        this.pano = pano;
        this.list = list;

        pano.subscribe('scene-ready', this.init, this);
        pano.subscribe('scene-attachstart', this.removeOverlays, this);
        // per scene change
        pano.subscribe('scene-attach', this.init, this);
        pano.subscribe('render-process', this.updateOverlays, this);

        pano.getCanvas().addEventListener('click', this.onCanvasHandle.bind(this));
    }

    init(scene) {
        if (!scene.overlays) {
            return;
        }

        if (!scene.id) {
            scene.id = 'pano' + Date.now();
        }

        this.cid = scene.id;
        this.create(scene.overlays);
    }

    create(list) {
        const cache = this.getCurrent(this.cid);

        list.forEach(data => {
            switch (data.type) {
                case 'dom':
                    this.createDomOverlay(data, cache);
                    break;
                case 'mesh':
                    this.createMeshOverlay(data, cache);
                    break;
                case 'animation':
                    this.createAnimationOverlay(data, cache);
                    break;
                case 'video':
                    this.createVideoOverlay(data, cache);
                    break;
            }
        });

        return cache;
    }

    findScene(id) {
        return this.list.find(item => item.id == id);
    }

    /**
     * 增加场景数据, 用于图集切换
     * @param {Array} scenes 场景数据
     */
    addScenes(scenes) {
        this.list = scenes.concat(this.list);
    }

    /** 
     * 获取场景列表
     */
    getScenes() {
        return this.list;
    }

    /**
     * 创建 dom 覆盖物并添加进 maps
     */
    createDomOverlay(prop, cache) {
        Util.parseLocation(prop, this.pano.getCamera());

        const item = new DomOverlay(prop);
        cache.domGroup.push(item);
        item.elem.onclick = e => {
            e.stopPropagation();
            e.preventDefault();
            this.onOverlayHandle(item)
        };

        this.pano.addDomObject(item.elem);
        this.updateDomOverlay(item);
    }

    /**
     * 不断更新 dom overlay 的屏幕坐标
     */
    updateDomOverlay(item) {
        const pano = this.pano;
        const size = pano.getSize();
        const width = size.width / 2;
        const height = size.height / 2;
        const position = Util.calcWorldToScreen(item.data.location, pano.getCamera());

        // z > 1 is backside
        if (position.z > 1) {
            item.hide();
        } else {
            const x = Math.floor(position.x * width + width);
            const y = Math.floor(-position.y * height + height);
            item.update(x, y);
        }
    }

    /**
     * 创建 mesh 覆盖物
     */
    createMeshOverlay(prop, cache) {
        const camera = this.pano.getCamera();

        Util.parseLocation(prop, camera);
        const item = new MeshOverlay(prop, camera.position);
        const particle = item.particle;

        // 加入可检测分组
        cache.detects.add(particle);
        cache.meshGroup.push(item);
    }

    /**
     * 创建动画覆盖物
     */
    createAnimationOverlay(prop, cache) {
        const pano = this.pano;
        const camera = pano.getCamera();
        let item;
    
        Util.parseLocation(prop, camera);
        if (prop.category == 'frame') {
            prop.lookat = camera.position;
            item = new FrameOverlay(prop);
        } else {
            item = new SpriteOverlay(AnimationOpts[prop.category]);
        }

        pano.addSceneObject(item.particle);
        cache.meshGroup.push(item);
    }

    /**
     * 创建视频覆盖物
     */
    createVideoOverlay(prop, cache) {
        const pano = this.pano;

        Util.parseLocation(prop, pano.getCamera());
        const item = new VideoOverlay(prop, pano);

        cache.detects.add(item.particle);
        cache.meshGroup.push(item);
    }

    /**
     * 获取当前的缓存对象
     * @param {string} id 场景id
     */
    getCurrent(id) {
        const data = this.maps[id];

        if (data) {
            return data;
        } else {
            const group = new Group();
            this.pano.addSceneObject(group);

            return this.maps[id] = {
                detects: group,
                domGroup: [],
                meshGroup: []
            };
        }
    }

    /**
     * 点击 canvas
     */
    onCanvasHandle(evt) {
        const pano = this.pano;
        const camera = pano.getCamera();
        const raycaster = this.raycaster;
        const size = pano.getSize();
        const pos = {
            x: (evt.clientX / size.width) * 2 - 1,
            y: -(evt.clientY / size.height) * 2 + 1
        };
        const vector = Util.calcScreenToSphere(pos, camera);
        
        try {
            const group = this.getCurrent(this.cid).detects;

            if (group.children) {
                raycaster.setFromCamera(pos, camera);
                const intersects = raycaster.intersectObjects(group.children, false);
                // disbale dom event
                if (intersects.length) {
                    evt.stopPropagation();
                    evt.preventDefault();

                    this.onOverlayHandle(intersects[0].object['instance']);
                } else {
                    pano.dispatch('pano-click', vector, pano);
                }
            } else {
                pano.dispatch('pano-click', vector, pano);
            }
        } catch(e) {
            Log.output(e);
        }
    }

    /**
     * 点击覆盖物
     */
    onOverlayHandle(instance) {
        const pano = this.pano;
        const data = instance.data;
        const size = pano.getSize();

        // for log & statistics & user behavior
        pano.dispatch('overlay-click', instance, pano);
        switch (data.actionType) {
            case 'scene':
                pano.enterNext(this.findScene(data.sceneId));
                break;
            case 'link':
                window.open(data.linkUrl, '_blank');
                break;
            // let Multiple plugin control
            case 'multiple':
                pano.dispatch('multiple-active', data);
                break;
            case 'video':
                instance.play();
                break;
        }
    }

    /**
     * 删除特定的 dom overlay
     * @param {Object} data 
     */
    delete(data) {
        const pano = this.pano;
        const cache = this.getCurrent(this.cid);

        cache.domGroup.forEach((item, i) => {
            if (item == data) {
                cache.domGroup.splice(i, 1);
                pano.removeDomObject(item.elem);
                item.dispose();
            }
        });
    }

    updateOverlays(scene) {
        const cache = this.getCurrent(scene.id);
        cache.domGroup.forEach(item => this.updateDomOverlay(item));
        cache.meshGroup.forEach(item => item.update());
    }

    /**
     * 删除当前场景下的所有 overlays
     */
    removeOverlays() {
        const cache = this.getCurrent(this.cid);
        delete this.maps[this.cid];
        this.cid = null;

        cache && this.hideOverlays(cache, true);
    }

    /**
     * 隐藏当前场景下的 overlays
     * @param {Object} data 缓存数据 
     * @param {boolean} isclean 是否清除
     */
    hideOverlays(data, isclean) {
        const pano = this.pano;

        if (data) {
            data.domGroup.forEach(item => {
                item.hide();
                if (isclean) {
                    item.dispose();
                    pano.removeDomObject(item.elem);
                }
            });

            data.meshGroup.forEach(item => {
                item.hide();
                if (isclean) {
                    item.dispose();
                    pano.removeSceneObject(item.particle);
                }
            });

            if (isclean && data.detects.children) {
                data.detects.remove(...data.detects.children);
                pano.removeSceneObject(data.detects);
            }

        }
    }

    /**
     * 展示 overlays
     */
    showOverlays(data) {
        if (data) {
            data.domGroup.forEach(item => item.show());
            data.meshGroup.forEach(item => item.show());
        }
    }

    dispose() {
        const pano = this.pano;

        pano.unsubscribe('scene-ready', this.init, this);
        pano.unsubscribe('scene-attachstart', this.removeOverlays, this);
        pano.unsubscribe('scene-attach', this.init, this);
        pano.unsubscribe('render-process', this.updateOverlays, this);
    }
}