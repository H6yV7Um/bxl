<div id="test"></div>
<script src="../../dist/lib.js"></script>
<script>
    const json = {
        title: 'test bxl transfer',
        cretPath: '../assets/cret.txt',
        thru: {
            lazy: 3000
        },
        sceneGroup: [{
            info: {
                author: '视频播放 - 点击播放'
            },
            id: 'scene5',
            name: '罗浮宫',
            bxlPath: '../assets/scene6/scene6.bxl',
            imgPath: '../assets/scene6/scene6.jpg',
            thumbPath: '../assets/scene6/thumb6.jpg',
            overlays: [{
                id: 'sintel',
                type: 'video',
                actionType: 'video',
                src: '../assets/video/sintel.mp4',
                img: '../assets/video/sign.png',
                location: {
                    lng: 0,
                    lat: 0
                }
            }]
        }]
    };

    bxl.startPano(json, '#test', {
        'overlay-click': function (data) {
            console.log(data);
        }
    });
</script>