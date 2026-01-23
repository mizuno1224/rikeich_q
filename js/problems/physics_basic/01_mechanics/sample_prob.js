/* sample_prob.js */
window.setup_sample_prob = function(simTargetId, textTargetId) {
  const parent = document.getElementById(simTargetId);
  if (!parent) return;

  // p5.js Sketch
  const sketch = (p) => {
    let x = 0;
    
    p.setup = () => {
      p.createCanvas(parent.clientWidth, parent.clientHeight).parent(parent);
    };

    p.draw = () => {
      p.background(240);
      p.fill(59, 130, 246);
      p.noStroke();
      p.circle(x, p.height / 2, 30);
      x = (x + 2) % p.width;
      
      p.fill(0);
      p.textSize(16);
      p.textAlign(p.CENTER);
      p.text("Simulation Running...", p.width/2, 30);
    };
    
    p.windowResized = () => {
      p.resizeCanvas(parent.clientWidth, parent.clientHeight);
    };
  };
  
  new p5(sketch);
};