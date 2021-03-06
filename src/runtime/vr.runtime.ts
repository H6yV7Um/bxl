import ResourceLoader from '../pano/loaders/resource.loader';
import Log from '../core/log';
import VPano from '../vr/pano.vr';
import Divider from '../vr/divider.vr';
import Timeline from '../pano/animations/timeline.animation';

/**
 * @file wev vr runtime
 */

const myLoader = new ResourceLoader();

abstract class EnvQueue {
    static list = [];

    static add(fn, context) {
        this.list.push({
            context: context,
            fn: fn.bind(context)
        });
    }

    static excute() {
        this.list.forEach(item => item.fn());
    }

    static remove(context) {
        const list = this.list;
        const index = list.find(item => item.context == context);
        list.splice(index, 1);
    }

    static len() {
        return this.list.length;
    }
};

export default abstract class Runtime {
    static timeid: any;    
    static uid = 0;
    static instanceMap = {};

    static async start(url, el, events?) {
        const source = typeof url === 'string' ? await myLoader.fetchUrl(url) : url;
        el = (typeof el == 'string') ? document.querySelector(el) : el;

        if (!el || !el.parentNode) {
            el = document.body;
        }

        if (!(source && source['sceneGroup'])) {
            return Log.output('load source error');
        }

        try {
            const ref = el.getAttribute('ref') || `vpano_${this.uid++}`;
            const vpano = this.instanceMap[ref] = new VPano(el, source);
            el.setAttribute('ref', ref);            
            
            // 用户订阅事件
            if (events) {
                for (let name in events) {
                    vpano.subscribe(name, events[name]);
                }
            }
            // 开场动画
            if (source['animation']) {
                Timeline.install(source['animation'], vpano);
            } else {
                vpano.noTimeline();
            }
            // webvr ui divider
            if (source['vr']) {
                vpano.addPlugin(Divider, source['vr']);
            }
            // business plugins
            if (source['plugins']) {
                source['plugins'].forEach(plugin => vpano.addPlugin(plugin.class, plugin.opts));
            }

            EnvQueue.add(vpano.onResize, vpano);
            vpano.run();
        } catch (e) {
            events && events.nosupport && events.nosupport();
            throw new Error(e);
        }
    }

    static getInstance(ref) {
        return this.instanceMap[ref];
    }

    static releaseInstance(ref) {
        const pano = this.instanceMap[ref];

        if (pano) {
            pano.dispose();
            EnvQueue.remove(pano);
        }

        if (!EnvQueue.len()) {
            window.removeEventListener(eventType, onEnvResize);
        }
    }
}

const pastLoad = window.onload;
window.onload = function() {
    pastLoad && pastLoad.call(this);

    const nodeList = document.querySelectorAll('vrpano');

    for (let i = 0; i < nodeList.length; i++) {
        const node = nodeList[i];
        const auto = node.getAttribute('auto');

        if (auto) {
            Runtime.start(node.getAttribute('source'), node);
        }
    }  
};

const eventType = /Android|webOS|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent)
    ? 'orientationchange' : 'resize';
const onEnvResize = event => {
    clearTimeout(Runtime.timeid);
    Runtime.timeid = setTimeout(function () {
        EnvQueue.excute();
    }, 200);
};

window.addEventListener(eventType, onEnvResize);