import { Box, Test } from './box.js';


export default class Field extends BrushElement {
  elMap = {
    box: new Box({
      w: 50,
      h: 50,
      backgroundColor: '#000',
      border: 5
    }),
    box2: new Box({
      w: 60,
      h: 60,
      backgroundColor: '#777',
      border: 10
    }),
    test: new Test({
      w: 10,
      h: 10,
      backgroundColor: 'red'
    })
  };

  constructor(props) {
    super(props);

    this.state = {
      i: 0
    }
  }

  created() {
    // this.smoothSetState({
    //   i: 30
    // }, 100)
  }

  onHello(e) {
    console.log(e);
  }

  paint() {
    // this.props.y = 10 * this.state.i;

    this.ctx.fillStyle = this.bg;
    this.ctx.fillRect(this.x, this.y, this.w, this.h);

    this.el.box({
      x: 0,
      y: 0,
      w: 50,
      h: 50,
      backgroundColor: 'yellow',
      hello: (e) => {
        this.onHello(e);
      }
    });
    
    this.el.box({
      x: 50,
      y: 0,
      backgroundColor: '#444'
    });

    this.el.box2({
      x: 100,
      y: 100,
      w: 200,
      h: 200
    });

    this.el.test();
  }
}