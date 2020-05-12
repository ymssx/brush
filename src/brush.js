import { Layer } from './layer.js';
export { BrushElement } from './element.js';

export class Brush {
  constructor({ w, h, root, state = {} }) {
    this.style = { w, h };
    this.root = root;

    this.subscriberMap = {};
    this.state = new Proxy(state, {
      get(state, key) {
        return state[key];
      },
      set(state, key, value) {
        state[key] = value;

        this.dispatch(key, value);
      }
    });

    this.eventBus = {};

    this.root.style.width = w + 'px';
    this.root.style.height = h + 'px';
    // this.root.style.overflow = 'hidden';

    this.layers = [];
  }


  createLayer({ style, el }) {
    const layer = new Layer({ style, el }, this);
    this.layers.push(layer);
    return layer;
  }


  dispatch(key, value) {
    if (this.subscriberMap.hasOwnProperty(key)) {
      if (!Array.isArray(this.subscriberMap[key])) {
        this.subscriberMap[key].forEach(callback => {
          callback(key, value);
        })
      }
    }
  }


  subscribe(key, callback) {
    if (!this.subscriberMap.hasOwnProperty(key)) {
    } else {      
      if (!Array.isArray(this.subscriberMap[key])) {
        this.subscriberMap[key] = [];
      }
    }
    this.subscriberMap[key].push(callback);
  }


  emitEvent() {}


  listenEvent() {}


  render() {
    this.layers.forEach(layer => {
      layer.render();
    });
  }
}