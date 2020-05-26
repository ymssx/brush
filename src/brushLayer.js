// import Worker from 'worker-loader!./worker.js';

const USE_WORK = false;

export class Layer {
  constructor({ style = {}, el = [] }, brush, index) {
    this.style = style;
    this.brush = brush;
    this.index = index;

    this.eventSet = new Set();
    this.mouseInSet = new Set();  
    this.mouseOutSet = new Set();    

    this.updateSet = new Set();
    this.beforeUpdateCallbackSet = new Set();
    this.afterUpdateCallbackSet = new Set();

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

    this.registEvent();

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

    this.updateSet.add(el);
    this.handleUpdate();
  }


  receiveBeforeUpdateCallback(callback) {
    if (callback instanceof Function) {
      this.beforeUpdateCallbackSet.add(callback);
    }
  }


  receiveAfterUpdateCallback(callback) {
    if (callback instanceof Function) {
      this.afterUpdateCallbackSet.add(callback);
    }
  }


  receiveNextFrameCallback(callback) {
    if (callback instanceof Function) {
      this.nextFrameCallbackSet.add(callback);
    }
  }


  handleUpdate() {
    if (this.updater) {
      window.cancelAnimationFrame(this.updater);
    }
    this.updater = window.requestAnimationFrame(() => {
      this.signRenderChain();
      this.defaultBeforeRender();
      this.render();
      this.defaultAfterRender();
    })
  }


  quickUpdate() {
    this.signRenderChain();
    this.defaultBeforeRender();
    this.render();
    this.defaultAfterRender();
  }


  signRenderChain() {
    /**
     * updateSet记录了所有请求更新的renderChain
     * 将收集的renderChain的所有元素都标记为过期
     */
    for (let leafEl of this.updateSet.values()) {
      let chain = leafEl.renderChain;
      for (let el of chain) {
        el.isNew = false;
      }
    }
  }


  defaultBeforeRender() {
    let callbacks = Array.from(this.beforeUpdateCallbackSet.values());
    for (let callback of callbacks) {
      if (callback instanceof Function) {
        callback();
      }
    }
  }


  defaultAfterRender() {
    this.updateSet.clear();
    let callbacks = Array.from(this.afterUpdateCallbackSet.values());
    this.beforeUpdateCallbackSet.clear();
    this.afterUpdateCallbackSet.clear();
    for (let callback of callbacks) {
      if (callback instanceof Function) {
        callback();
      }
    }
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


  eventDispatch(eventName, x, y) {
    let els = this.toArray(this.el);
    for (let i = els.length - 1; i >= 0; i--) {
      let el = els[i];
      let isElIncludePoint = el.eventDispatch(eventName, x, y);
      if (isElIncludePoint) return;
    }
  }


  getMousePosition(e) {
    let x, y;
    if (e.pageX || e.pageY) {
      x = e.pageX;
      y = e.pageY;
    } else {
      x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
      y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
    }

    x -= this.canvas.offsetLeft;
    y -= this.canvas.offsetTop;
    x |= 0;
    y |= 0;

    return [x, y];
  }


  reportInEvent(el) {
    this.mouseInSet.add(el);
  }


  reportOutEvent(el) {
    this.mouseOutSet.add(el);
  }


  ansysMouseoverEventSet() {
    /**
     * 每次mouseover事件都收集所有触发over事件的子组件为一个set
     * 并且保存上次的set
     * 新旧set对比，找出离开set的和新进入set的
     */
    for (let el of this.mouseInSet.values()) {
      if (!this.mouseInSetOld.has(el)) {
        el.trigerEventFromSelf('in');
      }
    }

    for (let el of this.mouseOutSetOld.values()) {
      if (!this.mouseOutSet.has(el)) {
        el.trigerEventFromSelf('out');
      }
    }
  }


  registEvent() {
    if (this.eventSet.has('click')) {
      this.registClickEvent();
    }
    if (this.eventSet.has('over')) {
      this.registOverEvent();
    }
  }


  registClickEvent() {
    this.canvas.addEventListener('click', (e) => {
      let [x, y] = this.getMousePosition(e);
      this.eventDispatch('click', x, y);
    }, false);
  }


  registOverEvent() {
    this.canvas.addEventListener('mousemove', (e) => {
      this.mouseInSetOld = this.mouseInSet;
      this.mouseOutSetOld = this.mouseOutSet;
      this.mouseInSet = new Set();
      this.mouseOutSet = new Set();

      let [x, y] = this.getMousePosition(e);
      this.eventDispatch('over', x, y);
      this.ansysMouseoverEventSet();
    }, false);
  }


  registEventFromElement(eventName) {
    if (!this.eventSet.has(eventName)) {
      this.eventSet.add(eventName);
      if (eventName === 'click') {
        this.registClickEvent();
      } else if (eventName === 'over') {
        this.registOverEvent();
      }
    }
  }


  changeCursor(cursor) {
    this.canvas.style.cursor = cursor;
  }
}