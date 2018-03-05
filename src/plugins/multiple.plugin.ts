import Util from '../util';
import {IPluggableUI} from '../interface/ui.interface';

/**
 * 多场景切换插件
 */

export default class Multiple implements IPluggableUI{
    pano: any;
    data: any;
    root: any;
    outer: any;
    inner: any;
    activeItem: any;
    container: HTMLElement;

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
            </div>`;
        }).join('');

        outer.appendChild(inner);
        root.appendChild(outer);
        this.setActive(inner.childNodes[0]);
        // add to pano root
        this.setContainer(this.pano.getRoot());
    }

    getElement() {
        return this.root;
    }

    setContainer(container) {
        this.container = container;
        container.appendChild(this.root);
    }

    bindEvent() {
        const inner = this.inner;

        this.onClickHandle = this.onClickHandle.bind(this);
        this.onWheelHandle = this.onWheelHandle.bind(this);

        inner.addEventListener('click', this.onClickHandle);
        inner.addEventListener('mousewheel', this.onWheelHandle);
        // 管理 actionType 为 multiple 的 overlay 
        this.pano.subscribe('multiple-active', this.onMultipleActive, this);
    }

    onClickHandle(e) {
        const node = this.findParent(e.target, 'pano-multiplescene-item');
      
        if (node) {
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
        this.inner.removeEventListener('click', this.onClickHandle);
        this.inner.removeEventListener('mousewheel', this.onWheelHandle);
        this.pano.unSubscribe('multiple-active', this.onMultipleActive, this);

        this.root.innerHTML = '';
        this.container.removeChild(this.root);
    }
}