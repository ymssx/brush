class behindCanvas {
  constructor(w, h) {
    this.init(w, h);
  }

  init(w, h) {
    if (!this.canvas) {
      this.canvas = new OffscreenCanvas(w, h);
      this.ctx = this.canvas.getContext('2d');
    } else {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  begin() {    
    this.canvas.width = this.canvas.width;
  }

  add(canvas, x, y) {
    this.ctx.drawImage(canvas, x, y);
  }

  getData() {
    let data = this.canvas.transferToImageBitmap();
    return data;
  }
}

let layerCanvas;

this.addEventListener('message', (e) => {
  if (e.data.type === 'init') {
    layerCanvas = new behindCanvas(e.data.w, e.data.h);
  } else if (e.data.type === 'begin') {
    layerCanvas.begin();
  } else if (e.data.type === 'commit') {
    layerCanvas.add(e.data.data, e.data.x, e.data.y);
  } else if (e.data.type === 'end') {
    let data = layerCanvas.getData()
    this.postMessage(data);
  }
})