export class Test extends BrushElement {
  constructor(props) {
    super(props);
    this.state = {
      i: 1
    }
  }

  created() {
    this.setState({
      i: 2
    })
  }

  paint() {
    this.ctx.fillStyle = this.bg;

    this.ctx.fillRect(0, 0, this.w, this.h);
  }
}

export class Box extends BrushElement {
  elMap = {
    test: new Test({
      w: 10,
      h: 10,
      backgroundColor: 'red'
    })
  };

  constructor(props) {
    super(props);
  }

  created() {
  }

  paint() {
    this.ctx.fillStyle = this.bg;

    let border = this.props.border;
    this.ctx.fillRect(border, border, this.w - 2 * border, this.h - 2 * border);

    this.el.test();
  }
}