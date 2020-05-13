// import Worker from 'worker-loader!./worker.js';

const USE_WORK = false;

export class Layer {
  constructor({ style = {}, el = [] }, brush, index) {
    this.style = style;
    this.brush = brush;
    this.index = index;

    this.updateMap = new Set();

    this.createCanvas();

    this.el = this.toArray(el);
    this.el.forEach(el => {
      el.bindFromLayer(this);
    })
  }
  

  createCanvas() {    
    this.canvas = document.createElement('canvas');
    let w, h, x, y;

    if (this.style.hasOwnProperty('w')) {
      w = this.style.w;
    } else {
      w = this.brush.style.w;
    }
    
    if (this.style.hasOwnProperty('h')) {
      h = this.style.h;
    } else {
      h = this.brush.style.h;
    }
    
    if (this.style.hasOwnProperty('x')) {
      x = this.style.x;
    } else {
      x = 0;
    }

    if (this.style.hasOwnProperty('y')) {
      y = this.style.y;
    } else {
      y = 0;
    }

    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = x + 'px';
    this.canvas.style.top = y + 'px';
    if (this.style.backgroundColor) {
      this.canvas.style.background = this.style.backgroundColor;
    }
    this.brush.root.appendChild(this.canvas);
 
    this.ctx = this.canvas.getContext((USE_WORK ? 'bitmaprenderer' : '2d'), {
      alpha: true
    });

    if (USE_WORK && OffscreenCanvas) {
      this.worker = new Worker('./src/worker.js');
      this.worker.postMessage({ type: 'init', w, h });
      this.worker.onmessage = e => {
        let canvas = e.data;
        this.ctx.transferFromImageBitmap(canvas);
      };
    }
  }


  addElement(el) {
    el.bind(this);
    this.el.push(el);

    return el;
  }


  isCanvasHasAlpha() {    
    if (this.style.alpha === true) {
      return true;
    } else if (this.style.alpha === false) {
      return false;
    }

    let bg = this.style.backgroundColor;
    if (bg) {
      if (bg.length >= 13) {
        if (bg.substr(0, 4) === 'rgba' && bg.substr(bg.substr(bg.length - 2, 1) === '1')) {
          return true;
        }
      }
      return false;
    }
    return false;
  }


  get layerVisibility() {
    return this.brush.checkLayerVisibility(this.index);
  }


  render() {
    if (!this.layerVisibility) return false;

    this.clear();
    this.el.forEach(el => {
      /**
       * 如果子组件被标记为过期，那么向子组件发送更新请求
       * 否则直接使用其canvas
       */
      if (!el.isNew) {
        el.render();
      }
    })

    this.collectChildsCanvas();

    return true;
  }


  clear() {
    this.canvas.width = this.canvas.width;
  }


  collectChildsCanvas() {
    /**
     * 如果浏览器支持，将使用worker多线程渲染
     * 逐个收集子组件的canvas，用于自身绘制
     */
    if (USE_WORK && OffscreenCanvas && Worker) {
      this.offscreenCollect();
    } else {
      this.normalCollect();
    }
  }


  normalCollect() {
    this.el.forEach(el => {
      let canvas = el.canvas;
      let x = el.props.x;
      let y = el.props.y;
      this.ctx.drawImage(canvas, x, y);
    })
  }


  offscreenCollect() {
    this.worker.postMessage({ type: 'begin' });

    this.el.forEach(el => {
      let canvas = el.canvas;
      let x = el.props.x;
      let y = el.props.y;

      this.worker.postMessage({ type: 'commit', data: canvas.transferToImageBitmap(), x, y });
    })

    this.worker.postMessage({ type: 'end' });
  }


  receiveUpdate(el) {
    if (!this.layerVisibility) return;

    this.updateMap.add(el);
    this.handleUpdate();
  }


  handleUpdate() {
    if (this.updater) {
      window.cancelAnimationFrame(this.updater);
    }
    this.updater = window.requestAnimationFrame(() => {
      this.signRenderChain();
      let res = this.render();
      this.defaultAfterRender();
    })
  }


  signRenderChain() {
    /**
     * updateMap记录了所有请求更新的renderChain
     * 将收集的renderChain的所有元素都标记为过期
     */
    for (let leafEl of this.updateMap.values()) {
      let chain = leafEl.renderChain;
      for (let el of chain) {
        el.isNew = false;
      }
    }
  }


  defaultAfterRender() {
    this.updateMap = new Set();
  }


  toArray(likeArray) {
    if (Array.isArray(likeArray)) {
      return likeArray;
    }
    if (likeArray instanceof Object) {
      if (likeArray.hasOwnProperty(0) || likeArray.hasOwnProperty('0')) {
        return Array.from(likeArray);
      }
    }
    return [likeArray];
  }
}