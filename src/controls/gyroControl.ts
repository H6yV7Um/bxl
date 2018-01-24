import {PerspectiveCamera, Vector3, Euler, Quaternion, Spherical, Math as TMath, Camera} from 'three';

/**
 * @file 陀螺仪控制器
 */

export default class GyroControl {
    control: any;
    onDeviceOrientationChangeEvent: any;
    onScreenOrientationChangeEvent: any;
    camera: any;
    lastSpherical: any;
    enabled = false;
    deviceOrien: any = {};
    screenOrien = 0;
    alphaOffset = 0;
    zee = new Vector3(0, 0, 1);
    euler = new Euler();
    q0 = new Quaternion();
    // - PI/2 around the x-axis
    q1 = new Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    spherical = new Spherical();
    diffSpherical = new Spherical();

    constructor(camera, control) {
        camera.rotation.reorder('YXZ');
        control.update();

        this.camera = camera.clone();
        this.control = control;
        this.onDeviceOrientationChangeEvent = event => {
            this.deviceOrien = event;
        };

        this.onScreenOrientationChangeEvent = event => {
            this.screenOrien = Number(window.orientation) || 0;
        };
    }

    /** 
     * The angles alpha, beta and gamma form a set of intrinsic Tait-Bryan angles of type Z-X'-Y''
     */
    calcQuaternion(quaternion, alpha, beta, gamma, orient) {
        // 'ZXY' for the device, but 'YXZ' for us
        this.euler.set(beta, alpha, -gamma, 'YXZ');
        // orient the device
        quaternion.setFromEuler(this.euler);
        // camera looks out the back of the device, not the top
        quaternion.multiply(this.q1);
        // adjust for screen orientation
        quaternion.multiply(this.q0.setFromAxisAngle(this.zee, -orient));
        // 相机初始观看方向向量
        this.spherical.setFromVector3(this.camera.getWorldDirection());

        const spherical = this.spherical;
        const diffSpherical = this.diffSpherical;
        let lastSpherical = this.lastSpherical;

        // 计算设备方向的增量
        if (lastSpherical) {
            diffSpherical.theta = spherical.theta - lastSpherical.theta;
            diffSpherical.phi = -spherical.phi + lastSpherical.phi;
            // 将偏移角度传给 orbitControl 计算 camera
            this.control.update(diffSpherical);
        } else {
            lastSpherical = this.lastSpherical = new Spherical();
        }

        lastSpherical.theta = spherical.theta;
        lastSpherical.phi = spherical.phi;
    }

    connect() {
        window.addEventListener('orientationchange', this.onScreenOrientationChangeEvent, false);
        window.addEventListener('deviceorientation', this.onDeviceOrientationChangeEvent, false);
        // run once on load
        this.onScreenOrientationChangeEvent();
        this.enabled = true;
    }

    disconnect() {
        window.removeEventListener('orientationchange', this.onScreenOrientationChangeEvent, false);
        window.removeEventListener('deviceorientation', this.onDeviceOrientationChangeEvent, false);

        this.enabled = false;
        this.lastSpherical = null;
        this.deviceOrien = {};
        this.screenOrien = 0;
    }

    update() {
        // z axis
        const alpha = this.deviceOrien.alpha ? TMath.degToRad(this.deviceOrien.alpha) : 0;
        // x axis
        const beta = this.deviceOrien.beta ? TMath.degToRad(this.deviceOrien.beta) : 0;
        // y axis
        const gamma = this.deviceOrien.gamma ? TMath.degToRad(this.deviceOrien.gamma) : 0;
        // landscape or vertical
        const orient = this.screenOrien ? TMath.degToRad(this.screenOrien) : 0;

        if (alpha === 0 && beta === 0 && gamma === 0 && orient === 0) {
            return;
        }

        this.calcQuaternion(this.camera.quaternion, alpha, beta, gamma, orient);
    }

    /**
     * 初始 z 轴旋转角度
     * @param {number} angle 
     */
    updateAlphaOffset(angle) {
        this.alphaOffset = angle;
        this.update();
    }
}