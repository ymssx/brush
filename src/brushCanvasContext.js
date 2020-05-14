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


  transPercent(num, rate) {
    if (typeof num === 'string') {
      let percentRate = '*' + rate;
      let vwRate = '*' + this.el.layer.style.w / 100;
      let vhRate = '*' + this.el.layer.style.h / 100;

      num = num.replace('%', percentRate);
      num = num.replace('vw', vwRate);
      num = num.replace('vh', vhRate);

      return eval(num);
    } else {
      return num;
    }
  }


  transReferW(w) {
    let rate = this.el.w / 100;
    return this.transPercent(w, rate);
  }


  transReferH(h) {
    let rate = this.el.h / 100;
    return this.transPercent(h, rate);
  }


  transData(x, y, w, h) {
    return [
      this.transReferW(x),
      this.transReferH(y),
      this.transReferW(w),
      this.transReferH(h)
    ]
  }


  rect({x, y, w, h, border, color = 'black', backgroundColor}) {
    [x, y, w, h] = this.transData(x, y, w, h);
    this.oct.save();
    this.oct.rect(x, y, w, h);
    if (border) {
      border = this.transReferW(border);
      this.oct.strokeStyle = color;
      this.oct.lineWidth = border;
    }
    if (backgroundColor) {
      this.oct.fillStyle = backgroundColor;
    }
    this.oct.stroke();
    this.oct.fill();
    this.oct.restore();
  }


  poly(X, Y, border, color = 'black') {
    this.oct.strokeStyle = color;
    this.oct.lineWidth = border;
    this.oct.beginPath();
    let x_0 = X[0],
    y_0 = Y[0];
    this.oct.moveTo(x_0, y_0);
    for (let i = 1; i < X.length; i++) {
      if (i < Y.length) {
        let x = X[i];
        let y = Y[i];
        this.oct.lineTo(x, y);
        this.oct.moveTo(x, y);
      }
    }
    this.oct.lineTo(x_0, y_0);
    this.oct.moveTo(x_0, y_0);
    this.oct.closePath();
    this.oct.stroke();
  }
}