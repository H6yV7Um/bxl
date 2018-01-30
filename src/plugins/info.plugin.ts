/**
 * @file 版权遮罩层
 */

export default class Info {
    data: any;
    panoram: any;
    
    constructor(panoram, data) {
        this.panoram = panoram;
        this.data = data;
    
        this.createDom();
    }

    createDom() {
        const root = document.createElement('div');
        root.className = "panrom-info";

        if (this.data.logo) {
            root.innerHTML +=  `<img src="${this.data.logo}" width="70">`;
        }
        root.innerHTML += `<div class="panrom-info-name">${this.data.author}</div>`;

        this.panoram.getRoot().appendChild(root);
    }
}