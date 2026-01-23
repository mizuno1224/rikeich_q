window.setup_prob_wave_yx_to_yt = function(simTargetId, textTargetId) {
  const parent = document.getElementById(simTargetId);
  if (!parent) return;

  // --- 共通定数 ---
  const LAMBDA = 6.0; // 波長 [m]
  const V = 1.5;      // 速さ [m/s]
  const T_PERIOD = LAMBDA / V; // 周期 [s] (4.0s)
  const AMP = 2.5;    // 振幅 [m]
  
  // --- メインシミュレーション (p5.js) ---
  // y-x図のアニメーションと、x=3.0mでの媒質の動きを可視化
  const sketch = (p) => {
    let t_phys = 0; // 物理時間
    let isRunning = false;
    
    // 描画設定
    const xRange = 9.0; // x軸の表示範囲 [m]
    const yRange = 4.0; // y軸の表示範囲 [m] (片側)
    
    p.setup = () => {
      p.createCanvas(parent.clientWidth, parent.clientHeight).parent(parent);
      
      if (window.SimUtils) {
        SimUtils.createControls(parent, {
          onPlay: () => { isRunning = true; },
          onPause: () => { isRunning = false; },
          onReset: () => { t_phys = 0; isRunning = false; }
        });
      }
    };

    const worldToScreen = (wx, wy) => {
      const sx = p.map(wx, -1, xRange, 0, p.width);
      const sy = p.map(wy, yRange, -yRange, 0, p.height);
      return { x: sx, y: sy };
    };

    p.draw = () => {
      p.background(255);
      
      if (isRunning) {
        t_phys += 1/60 * 2; // 少し早回し (1秒間に2秒分進むなど)
      }

      // 軸の描画
      p.stroke(0);
      p.strokeWeight(1);
      const origin = worldToScreen(0, 0);
      const xAxisEnd = worldToScreen(xRange, 0);
      const yAxisStart = worldToScreen(0, yRange);
      const yAxisEnd = worldToScreen(0, -yRange);
      
      // X軸
      p.line(0, origin.y, p.width, origin.y);
      p.fill(0);
      p.noStroke();
      p.textAlign(p.RIGHT, p.CENTER);
      p.text("x [m]", p.width - 10, origin.y - 15);
      
      // Y軸
      p.stroke(0);
      p.line(origin.x, yAxisStart.y, origin.x, yAxisEnd.y);
      p.noStroke();
      p.textAlign(p.CENTER, p.TOP);
      p.text("y [m]", origin.x + 20, 10);

      // 目盛り
      p.textAlign(p.CENTER, p.TOP);
      [3.0, 6.0].forEach(val => {
        const s = worldToScreen(val, 0);
        p.stroke(0);
        p.line(s.x, s.y - 5, s.x, s.y + 5);
        p.noStroke();
        p.text(val.toFixed(1), s.x, s.y + 10);
      });

      // 波の描画
      // 式: y = -A * sin(2*PI * (x/lambda - t/T)) 
      // 初期位相: t=0で原点から下がるため -sin(kx)
      p.noFill();
      p.stroke(0, 100, 200);
      p.strokeWeight(3);
      p.beginShape();
      for (let x = 0; x <= xRange; x += 0.1) {
        // x-vt の形 (右に進む)
        // 位相 theta = 2π(x - vt)/λ = 2π(x/λ - t/T)
        // 元の波形が -sin(kx) なので、全体にマイナスをつける
        const phase = 2 * Math.PI * (x / LAMBDA - t_phys / T_PERIOD);
        const y = -AMP * Math.sin(phase);
        const s = worldToScreen(x, y);
        p.vertex(s.x, s.y);
      }
      p.endShape();

      // x = 3.0m のポイント
      const targetX = 3.0;
      const targetPhase = 2 * Math.PI * (targetX / LAMBDA - t_phys / T_PERIOD);
      const targetY = -AMP * Math.sin(targetPhase);
      const targetS = worldToScreen(targetX, targetY);

      // ターゲットの縦線
      p.stroke(200, 0, 0, 100);
      p.strokeWeight(1);
      p.line(targetS.x, origin.y - 100, targetS.x, origin.y + 100);

      // ターゲットの点
      p.fill(255, 50, 50);
      p.stroke(0);
      p.strokeWeight(1);
      p.circle(targetS.x, targetS.y, 12);
      
      // 説明テキスト
      p.fill(0);
      p.noStroke();
      p.textAlign(p.LEFT, p.TOP);
      p.text(`Time: ${t_phys.toFixed(2)} s`, 10, 10);
      p.fill(255, 50, 50);
      p.text("x=3.0mの媒質", targetS.x + 10, targetS.y);
    };

    p.windowResized = () => {
      p.resizeCanvas(parent.clientWidth, parent.clientHeight);
    };
  };

  const mainP5 = new p5(sketch);
  if(!window.p5Instances) window.p5Instances = [];
  window.p5Instances.push(mainP5);


  // --- サブシミュレーション (正解のy-t図) ---
  // Chart.jsではなくp5.jsでシンプルに描画（静止画＋現在地点のプロット）
  const subParent = document.getElementById(`sub-sim-prob_wave_yx_to_yt`);
  if (subParent) {
    const subSketch = (p) => {
      p.setup = () => {
        p.createCanvas(subParent.clientWidth, subParent.clientHeight).parent(subParent);
        p.noLoop(); // 基本は静止画、updateで再描画したいが今回はシンプルに解説用図示
      };

      p.draw = () => {
        p.background(250);
        
        // 座標変換
        const tRange = 6.0; // t軸表示範囲
        const yRange = 4.0;
        const w2s = (wt, wy) => ({
          x: p.map(wt, 0, tRange, 40, p.width - 20),
          y: p.map(wy, yRange, -yRange, 20, p.height - 20)
        });

        const origin = w2s(0, 0);

        // 軸
        p.stroke(0);
        p.strokeWeight(1);
        p.line(40, origin.y, p.width, origin.y); // t軸
        p.line(origin.x, 20, origin.x, p.height - 20); // y軸
        
        p.fill(0);
        p.noStroke();
        p.textAlign(p.RIGHT, p.TOP);
        p.text("t [s]", p.width - 5, origin.y + 5);
        p.textAlign(p.RIGHT, p.TOP);
        p.text("y [m]", origin.x - 5, 20);

        // 目盛り
        [2.0, 4.0].forEach(val => {
          const s = w2s(val, 0);
          p.stroke(0);
          p.line(s.x, s.y - 3, s.x, s.y + 3);
          p.noStroke();
          p.textAlign(p.CENTER, p.TOP);
          p.text(val.toFixed(1), s.x, s.y + 5);
        });

        // 正解のグラフ: y(3.0, t) = -A sin(omega * t)
        // x=3.0 (半波長) なので、初期位相は pi。 sin(pi - wt) = sin(wt)。
        // 待てよ、y(x,t) = -A sin(kx - wt)。
        // y(3.0, t) = -A sin(pi - wt) = -A sin(wt)。
        // つまり、t=0から負の方向に進む正弦波。
        
        p.noFill();
        p.stroke(255, 50, 50);
        p.strokeWeight(2);
        p.beginShape();
        for (let t = 0; t <= tRange; t += 0.05) {
          const y = -AMP * Math.sin(2 * Math.PI * t / T_PERIOD);
          const s = w2s(t, y);
          p.vertex(s.x, s.y);
        }
        p.endShape();
      };
    };
    new p5(subSketch);
  }
};