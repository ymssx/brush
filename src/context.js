export class CanvasContext {
  constructor(originContext, element) {
    this.el = element;
    this.oct = originContext;
    const that = this;

    return new Proxy(originContext, {
      get(originContext, key) {
        if (that[key]) {
          return that[key];
        } else {
          let res = originContext[key];
          if (res instanceof Function) {
            return res.bind(originContext);
          }
          return res;
        }
      },
      set(originContext, key, value) {        
        if (that[key]) {
          that[key] = value;
        } else {
          originContext[key] = value;
        }
        return true;
      }
    })
  }


  isPercent(num) {
    if (typeof num === 'string' && num.substr(num.length - 1) === '%') {
      return true;
    }
    return false;
  }


  rounded(num) {    
    let rounded = (0.5 + num) | 0;
    rounded = ~~ (0.5 + num);
    rounded = (0.5 + num) << 0;
    return rounded;
  }


  transData(x, y, w, h) {
    if (this.isPercent(x)) {
      x = this.rounded(this.el.x * parseFloat(x) / 100);
    }
    if (this.isPercent(y)) {
      y = this.rounded(this.el.y * parseFloat(y) / 100);
    }
    if (this.isPercent(w)) {
      w = this.rounded(this.el.w * parseFloat(w) / 100);
    }
    if (this.isPercent(h)) {
      h = this.rounded(this.el.h * parseFloat(h) / 100);
    }
    return [x, y, w, h];
  }


  rect(x, y, w, h) {
    [x, y, w, h] = this.transData(x, y, w, h);
    this.oct.fillRect(x, y, w, h);
  }


  circle() {}
}