import { CanvasContext } from './brushCanvasContext.js';
import { BrushProxy } from './brushProxy.js';

export class BrushElement {
  constructor(props = {}) {
    const that = this;
    this.childElements = [];
    this.allChildElements = [];
    this.tempChildStack = [];
    this.tempChildSet = new Set();
    this.elMap = {};

    // 标识组件是否过期
    this.isNew = false;

    this.renderChain = [this];
    this.hasInit = false;
    // 依赖记录表
    this.isAnsysingDependence = false;
    this.isCollectingChilds = false;
    this.dependence = {};
    this.stateDependence = {};

    // 事件记录表
    this.eventsMap = {};
    
    /**
     * 基本属性，当未传参时将使用默认值
     * - 优先级最低
     */
    this.baseProps = {
      w: 100,
      h: 100,
      x: 0,
      y: 0
    };

    /**
     * 组件默认属性，供自定义默认值
     * - 优先级较低
     */
    this.defaultProps = {};

    /**
     * 对props的代理
     * 1. 根据优先级返回值
     * 2. 监听属性的获取（分析依赖）
     * 3. 监听属性的变动，判断是否需要重绘
     */
    this.props = new Proxy(props, {
      get(props, key) {
        let res;

        if (props.hasOwnProperty(key)) {
          res = props[key];
        } else {
          if (that.defaultProps.hasOwnProperty(key)) {
            res = that.defaultProps[key];
          } else {
            if (that.baseProps.hasOwnProperty(key)) {
              res = that.baseProps[key];
            }
          }
        }
        
        if (that.isAnsysingDependence) {
          that.dependence[key] = res;
        }

        return res;
      },
      set(props, key, value) {

        if (key in ['x', 'y']) {
          if (value !== this.props[key]) {
            that.positionChanged();
          }
        } else if (key in ['w', 'h']) {
          that.sizeChanged();
        }

        props[key] = value;

        return true;
      }
    });

    /**
     * el.name暴露了一个操作elMap.name组件的函数
     * 1. 给组件实例传参
     * 2. 组件实例重绘
     * 3. 获取组件内容
     * 4. 将组件内容绘制在canvas上
     */
    const elPainterMap = {};
    this.el = new Proxy({}, {
      get(_, key) {
        if (!elPainterMap.hasOwnProperty(key)) {
          let el = that.elMap[key];
          el.bindFromElement(that);
          let bp = new BrushProxy(el);
          elPainterMap[key] = bp.paint.bind(bp);
        }

        if (that.isCollectingChilds) {
          let el = that.elMap[key];
          that.tempChildStack.push(el);
        }

        return elPainterMap[key];
      }
    })

    /**
     * 返回整个对象实例的代理
     * 用于监控属性的获取与设置
     * 判断是否需要更新
     */
    this.data = new Proxy({}, {
      get(_, key) {
        if (that.state.hasOwnProperty(key)) {
          let res = that.state[key];
          if (that.isAnsysingDependence) {
            that.stateDependence[key] = res;
          }
          return res;
        } else {
          if (that.props.hasOwnProperty(key)) {
            return that.props[key];
          }
        }
      },
      set(_, key, value) {
        that.ansysStateChange(key, value);
        that.state[key] = value;
      }
    })
  }


  initOffscreenCanvas() {    
    let [w, h] = [this.props.w, this.props.w];
    if (OffscreenCanvas) {
      this.canvas = new OffscreenCanvas(w, h);
    } else {
      this.canvas = document.createElement('canvas');
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.originContext = this.canvas.getContext('2d');
    this.initContext();
  }


  initContext() {
    let originContext = this.canvas.getContext('2d');
    this.ctx = new CanvasContext(originContext, this);
  }


  bindFromLayer(layer) {
    this.father = layer;
    this.layer = layer;

    this.renderChain = [this];

    this.defaultCreated();
    this.created();
    this.created = function() {};
  }


  bindFromElement(father) {
    this.father = father;
    this.layer = father.layer;

    this.renderChain = father.renderChain.slice();
    this.renderChain.push(this);

    this.defaultCreated();
    this.created();
    this.created = function() {};
  }


  get isInFatherCanvas() {
    return this.x < this.father.w && this.y < this.father.h;
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

  
  addChild(childElements) {
    let els = this.toArray(childElements);

    this.childElements = els.map(el => {
      return (props) => {
        el.bindFromElement(this);
        if (props === undefined) {
          props = {};
        }

        let canvas = el.renderWithProps(props);          
        let x = el.props.x;
        let y = el.props.y;
  
        that.ctx.drawImage(canvas, x, y);

        return el;
      }
    })
  }


  isChildsOverdue() {
    for (let elName in this.elMap) {
      let el = this.elMap[elName];
      if (!el.isNew) {
        return true;
      }
    }
    return false;
  }


  isWorthToUpdate(props) {
    if (!this.hasInit) return true;

    for (let key in props) {
      if (this.dependence.hasOwnProperty(key)) {
        let res = this.hasChangeProps(props[key], this.dependence[key]);
        if (res) return true;
      }
    }
    return false;
  }


  hasChangeProps(obj, old) {
    const compare = function(obj, old) {
      if (obj === old) return false;

      if (typeof obj === 'object' && typeof old === 'object') {
        for (let key in obj) {
          if (!old.hasOwnProperty(key)) return true;
          // 双方都有key属性
          if (typeof obj[key] === 'object') {
            let res = compare(obj[key], old[key]);
            if (res) return true;
          } else {
            if (obj[key] !== old[key]) {
              return true;
            }
          }
        }
        return false;
      } else {
        return true;
      }
    }

    return compare(obj, old);
  }
  

  renderWithProps(props) {
    Object.assign(this.props, props);

    /**
     * 如果所有子组件都未过期 且 新参数不值得更新
     * 那么就不更新，直接使用当前的canvas
     */
    if (this.isNew && !this.isChildsOverdue() && !this.isWorthToUpdate(props)) {
      return this.canvas;
    } else {
      return this.render();
    }
  }


  setProps(props) {
    Object.assign(this.props, props);
  }


  clear() {
    this.canvas.width = this.canvas.width;
    this.paintCanvasBackground();
  }


  ansysStateChange(key, value) {

  }


  setState(state) {
    if (!this.state) this.state = {};

    this.state = Object.assign(this.state, state);
    this.update();
  }


  __getStateChangeList(state) {
    let changeList = [];
    const walkObj = (obj, keyList) => {
      for (let key in obj) {
        let copyKeyList = keyList.slice();
        copyKeyList.push(key);
        let type = typeof obj[key];
        if (type === 'object') {
          walkObj(obj[key], copyKeyList);
        } else if (type === 'number') {
          let target = obj[key];
          let origin = this.findValueByKeys(copyKeyList);
          if (target != origin) {
            changeList.push({
              target,
              origin,
              diff: target - origin,
              keyList: copyKeyList
            });
          }
        }
      }
    };
    walkObj(state, []);
    return changeList;
  }


  smoothState(state, delay) {
    if (!this.state) this.state = {};

    let changeList = this.__getStateChangeList(state);
    let startTime = new Date().getTime();
    const animationLoop = () => {
      let isFinished = false;
      let now = new Date().getTime();
      let timePercent = Math.min(1, (now - startTime) / delay);
      for (let item of changeList) {
        if (item.target !== this.findValueByKeys(item.keyList)) {
          let currentTarget = item.origin + item.diff * timePercent;
          state = this.changeValueByKeys(state, item.keyList, currentTarget);
        } else {
          isFinished = true;
        }
      }
      if (!this.state) this.state = {};      
      this.state = Object.assign(this.state, state);
      
      if (!isFinished) {
        this.afterUpdate(animationLoop.bind(this));
      }
      this.update();
    };
    if (changeList.length > 0) animationLoop();
  }


  infiniteState(state) {
    let switcher = true;
    let changeList = this.__getStateChangeList(state);
    let startTime = new Date().getTime();
    let pauseTime;
    const animationLoop = () => {
      let now = new Date().getTime();
      let timeProgress = now - startTime;
      for (let item of changeList) {
        let speed = item.target / 1000;
        let currentTarget = item.origin + speed * timeProgress;
        state = this.changeValueByKeys(state, item.keyList, currentTarget);
      }
      if (!this.state) this.state = {};      
      this.state = Object.assign(this.state, state);
      
      if (switcher) {
        this.afterUpdate(animationLoop.bind(this));
      }
      this.update();
    };
    if (changeList.length > 0) animationLoop();
    return {
      stop() {
        switcher = false;
        pauseTime = new Date().getTime();
      },
      start() {
        let now = new Date().getTime();
        startTime += now - pauseTime;
        switcher = true;
        if (changeList.length > 0) animationLoop();
      },
      del() {
        switcher = null;
        changeList = null;
        startTime = null;
        pauseTime = null;
      }
    }
  }


  findValueByKeys(keys) {
    let res = this.state;
    for (let key of keys) {
      res = res[key];
    }
    return res;
  }


  changeValueByKeys(target, keys, value) {
    let res = target;
    for (let key of keys) {
      if (typeof res[key] === 'object') {
        res = res[key];
      } else {
        res[key] = value;
      }
    }
    return target;
  }


  update() {
    if (!this.isInFatherCanvas) return;

    this.layer.receiveUpdate(this);
  }


  beforeUpdate(callback) {
    this.layer.receiveBeforeUpdateCallback(callback);
  }


  afterUpdate(callback) {
    this.layer.receiveAfterUpdateCallback(callback);
  }


  render() {
    this.defaultBeforePaint();
    this.beforePaint();

    this.paintCanvasBackground();
    this.paint();

    this.afterPaint();
    this.defaultAfterPaint();

    return this.canvas;
  }


  paintCanvasBackground() {
    if (this.bg) {
      this.ctx.save();
      this.ctx.fillStyle = this.bg;
      this.ctx.fillRect(0, 0, this.w, this.h);
      this.ctx.restore();
    }
  }


  defaultCreated() {
    this.initOffscreenCanvas();
  }


  defaultBeforePaint() {
    this.isAnsysingDependence = true;
    this.isCollectingChilds = true;
    this.allChildElements = this.toArray(this.childElements).slice();
    this.tempChildStack = [];
    this.tempChildSet.clear();
    this.dependence = {};
    this.stateDependence = {};
  }


  defaultAfterPaint() {
    if (!this.hasInit) {
      this.hasInit = true;
      this.updated();
    }
    this.processChildsElement();
    this.isAnsysingDependence = false;
    // 绘制完毕之后将自己标识为最新
    this.isNew = true;
  }


  processChildsElement() {
    if (!this.isCollectingChilds) return;

    while(this.tempChildStack.length > 0) {
      let el = this.tempChildStack.pop();
      if (!el.isInFatherCanvas) return;
      if (!this.tempChildSet.has(el)) {
        this.tempChildSet.add(el);
        this.allChildElements.unshift(el);
      }
    }
    this.tempChildStack = [];
    this.tempChildSet.clear();
    this.isCollectingChilds = false;
  }


  reqFrame(callback) {
    callback();
    this.father.update();
  }


  positionChanged() {
    this.father.update();
  }


  sizeChanged() {
    this.canvas.w = this.w;
    this.canvas.h = this.h;
    this.update();
  }


  eventDispatchControl(eventName, x, y, el) {
    let isXInEl = el.x <= x && x <= (el.x + el.w);
    let isYInEl = el.y <= y && y <= (el.y + el.h);
    if (isXInEl && isYInEl) {
      el.eventDispatch(eventName, x - el.x, y - el.y);
    }
  }


  eventDispatch(eventName, x, y) {
    for (let i = this.allChildElements.length - 1; i >= 0; i--) {
      let el = this.allChildElements[i];
      let isLastChildIncludePoint = this.eventDispatchControl(eventName, x, y, el);
      if (isLastChildIncludePoint) return;
    }

    if (this.ctx.isPointInPath(x, y)) {
      this.trigerEventFromSelf(eventName);
      return true;
    }
    return false;
  }


  trigerEvent(eventName) {    
    if (this.eventsMap.hasOwnProperty(eventName)) {
      let eventList = this.eventsMap[eventName];
      eventList.forEach(callback => {
        callback();
      })
    }
  }


  trigerEventFromSelf(eventName) {
    this.trigerEvent(eventName);
    this.eventBubbling(eventName);
  }


  trigerEventFromBubbling(eventName, originElement) {
    this.trigerEvent(eventName);
    this.eventBubbling(eventName);
  }


  eventBubbling(eventName) {
    if (this.father instanceof BrushElement) {
      this.father.trigerEventFromBubbling(eventName, this);
    }
  }


  addEvent(eventName, callback) {
    if (!this.eventsMap.hasOwnProperty(eventName)) {
      this.eventsMap[eventName] = [];
    }

    this.eventsMap[eventName].push(callback);
    if (eventName === 'in') {
      this.addEvent('over', () => {
        this.layer.reportInEvent(this);
      })
    } else if (eventName === 'out') {
      this.addEvent('over', () => {
        this.layer.reportOutEvent(this);
      })
    }

    this.layer.registEventFromElement(eventName);
  }


  changeCursor(cursor) {
    this.layer.changeCursor(cursor);
  }


  get w() {
    return this.props.w;
  }


  get h() {
    return this.props.h;
  }


  get x() {
    return this.props.x;
  }


  get y() {
    return this.props.y;
  }

  
  get bg() {
    return this.props.backgroundColor;
  }


  // life circle
  created() {}


  beforePaint() {}


  afterPaint() {}
  

  updated() {}
}