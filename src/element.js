export class BrushElement {
  constructor(props = {}) {
    const that = this;
    this.elMap = {};

    // 标识组件是否过期
    this.isNew = false;

    this.renderChain = [this];
    this.hasInit = false;
    this.isAnsysingDependence = false;
    this.dependence = {};
    
    /**
     * 基本属性，当未传参时将使用默认值
     * - 优先级最低
     */
    this.baseProps = {
      w: 10,
      h: 10,
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
        } else if (that.defaultProps.hasOwnProperty(key)) {
          res = that.defaultProps[key];
        } else if (that.baseProps.hasOwnProperty(key)) {
          res = that.baseProps[key];
        }
        
        if (that.isAnsysingDependence) {
          that.dependence[key] = res;
        }

        return res;
      },
      set(props, key, value) {

        if (key in ['x', 'y']) {
          if (value !== this.props[key]) {
            that.father.update();
          }
        } else if (key in ['w', 'h']) {
          this.update();
        }

        props[key] = value;

        return true;
      }
    });
    
    // init offscreen canvas
    let [w, h] = [this.props.w, this.props.w];
    if (OffscreenCanvas) {
      this.canvas = new OffscreenCanvas(w, h);
    } else {
      this.canvas = document.createElement('canvas');
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.ctx = this.canvas.getContext('2d');

    /**
     * el.name暴露了一个操作elMap.name组件的函数
     * 1. 给组件实例传参
     * 2. 组件实例重绘
     * 3. 获取组件内容
     * 4. 将组件内容绘制在canvas上
     */
    this.el = new Proxy({}, {
      get(_, key) {
        let el = that.elMap[key];
        el.bind(that);
        return (props) => {
          if (props === undefined) {
            props = {};
          }

          let canvas = el.renderWithProps(props);          
          let x = el.props.x;
          let y = el.props.y;
    
          that.ctx.drawImage(canvas, x, y);
        };
      }
    })
  }


  bindFromLayer(layer) {
    this.father = layer;
    this.layer = layer;

    this.renderChain = [this];

    this.defaultCreated();
    this.created();
    this.created = function() {};
  }


  bind(father) {
    this.father = father;
    this.layer = father.layer;

    this.renderChain = father.renderChain.slice();
    this.renderChain.push(this);

    this.defaultCreated();
    this.created();
    this.created = function() {};
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
    if (!this.isChildsOverdue() && !this.isWorthToUpdate(props)) {
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
  }


  setState(state) {
    if (!this.state) this.state = {};

    this.state = Object.assign(this.state, state);
    this.update();
  }


  update() {
    this.layer.receiveUpdate(this);
  }


  render() {
    this.defaultBeforePaint();
    this.beforePaint();
    this.paint();

    this.afterPaint();
    this.defaultAfterPaint();

    return this.canvas;
  }


  defaultCreated() {
  }


  defaultBeforePaint() {
    this.isAnsysingDependence = true;
    this.dependence = {};
  }


  defaultAfterPaint() {
    if (!this.hasInit) {
      this.hasInit = true;
      this.updated();
    }
    this.isAnsysingDependence = false;
    // 绘制完毕之后将自己标识为最新
    this.isNew = true;
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