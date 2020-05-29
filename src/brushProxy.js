export class BrushProxy {
  constructor(el) {
    this.target = el;
    this.father = el.father;
    this.transX = 0;
    this.transY = 0;
    this.originX = 0;
    this.originY = 0;
  }


  addChild(childElements) {
    this.target.addChild(childElements);
    return this;
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
      let vwRate = '*' + this.target.layer.style.w / 100;
      let vhRate = '*' + this.target.layer.style.h / 100;

      num = num.replace('%', percentRate);
      num = num.replace('vw', vwRate);
      num = num.replace('vh', vhRate);

      return eval(num);
    } else {
      return num;
    }
  }


  transReferW(w) {
    let rate = this.target.w / 100;
    return this.transPercent(w, rate);
  }


  transReferH(h) {
    let rate = this.target.h / 100;
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


  paint(props) {
    if (props === undefined) {
      props = {};
    }
  
    if (this.target.isInFatherCanvas) {
      this.target.renderWithProps(props);
    }

    this.father.ctx.save();
    this.father.ctx.translate(this.target.x, this.target.y);
    return this;
  }


  rotate(angle, x = 0, y = 0) {
    x = this.transReferW(x);
    y = this.transReferH(y);

    angle = Math.PI * (angle % 360) / 180;
    this.translate(x, y);
    this.originX = -x;
    this.originY = -y;
    this.father.ctx.rotate(angle);
    return this;
  };


  translateX(x) {
    x = this.transReferW(x);
    this.transX = x;
    return this;
  }


  translateY(y) {
    y = this.transReferH(y);
    this.transY = y;
    return this;
  }


  translate(x, y) {
    this.translateX(x);
    this.translateY(y);
    this.father.ctx.translate(this.transX, this.transY);
    return this;
  }


  scale(x, y) {
    this.father.ctx.scale(x, y);
    return this;
  }


  transform(a, b, c, d, e, f) {
    this.father.ctx.transform(a, b, c, d, e, f);
    return this;
  }


  done() {
    this.father.ctx.drawImage(this.target.canvas, this.originX, this.originY);
    this.father.ctx.restore();
  }
}