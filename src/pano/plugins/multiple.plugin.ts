import {IPluggableUI} from '../interface/ui.interface';
import Util from '../../core/util';

/**
 * @file 多场景切换插件
 */

export default class Multiple implements IPluggableUI {
    pano: any;
    data: any;
    root: any;
    outer: any;
    inner: any;
    activeItem: any;
    container: HTMLElement;
    isActive = true;

    constructor(pano, data) {
        this.pano = pano;
        this.data = data;
        this.create();
        this.bindEvent();
    }

    create() {
        const root = this.root = Util.createElement('<div class="pano-multiplescene"></div>');
        const outer = this.outer = Util.createElement('<div class="pano-multiplescene-outer"></div>');
        const inner = this.inner = Util.createElement('<div class="pano-multiplescene-inner"></div>');
        
        inner.innerHTML = this.data.map((item, i) => {
            return `<div class="pano-multiplescene-item" data-id="${i}">
                <img src="${item.thumbPath}" class="pano-multiplescene-img">
                <span class="pano-multiplescene-name">${item.name}</span>
            </div>`;
        }).join('');

        outer.appendChild(inner);
        root.appendChild(outer);
        this.setActive(inner.childNodes[0]);
        // add to pano root
        this.setContainer(this.pano.getRoot());
    }

    bindEvent() {
        const pano = this.pano;
        const inner = this.inner;

        this.onClickHandle = this.onClickHandle.bind(this);
        this.onWheelHandle = this.onWheelHandle.bind(this);

        inner.addEventListener('click', this.onClickHandle);
        inner.addEventListener('mousewheel', this.onWheelHandle);
        // 管理 actionType 为 multiple 的 overlay 
        pano.subscribe('multiple-active', this.onMultipleActive, this);
        // 管理激活状态
        pano.subscribe('scene-attachstart', this.onDisable, this);
        pano.subscribe('scene-attach', this.onEnable, this);
    }

    getElement() {
        return this.root;
    }

    setContainer(container) {
        this.container = container;
        container.appendChild(this.root);
    }

    onClickHandle(e) {
        e.preventDefault();
        const node = this.findParent(e.target, 'pano-multiplescene-item');

        if (node && this.isActive) {
            const id = node.getAttribute('data-id');
            const scene = this.data[id];

            if (scene) {
                this.pano.enterNext(scene);
                this.setActive(node);
            }
        }
    }

    onWheelHandle(e) {
        const dis = e.deltaY;
        this.inner.scrollLeft += dis;
    }

    onMultipleActive(data) {
        const scene = this.data.find(item => item.id == data.sceneId);
        const index = this.data.indexOf(scene);
        const node = this.inner.querySelector(`div[data-id="${index}"]`);

        if (scene && node) {
            this.pano.enterNext(scene);
            this.setActive(node);
        }
    }

    onDisable() {
        this.isActive = false;
    }

    onEnable() {
        this.isActive = true;
    }

    findParent(node, cls) {
        while (node != null) {
            if (node.className == cls) {
                return node;
            }

            node = node.parentNode;
        }
    }

    setActive(node) {
        if (this.activeItem) {
            const cls = this.activeItem.className;
            this.activeItem.className = cls.replace(' active', '');
        }

        node.className += ' active';
        this.activeItem = node;
    }

    show() {
        this.root.style.display = 'block';
    }

    hide() {
        this.root.style.display = 'none';
    }

    dispose() {
        const pano = this.pano;
        const inner = this.inner;

        inner.removeEventListener('click', this.onClickHandle);
        inner.removeEventListener('mousewheel', this.onWheelHandle);
        pano.unSubscribe('multiple-active', this.onMultipleActive, this);
        pano.unSubscribe('scene-attachStart', this.onDisable, this);
        pano.unSubscribe('scene-attach', this.onEnable, this);

        this.root.innerHTML = '';
        this.container.removeChild(this.root);
    }
}