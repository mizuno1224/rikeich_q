/* Path: js/problems/physics_basic/03_waves/prob_wave_graph_trans.js */

window.setup_prob_wave_graph_trans = function(simTargetId, textTargetId) {
  // 解説文の注入処理は削除しました（管理画面の解説エディタに入力してください）

  // --- 1. メインシミュレーション (左側: y-x 波動) ---
  const sketchMain = (p) => {
    let t = 0; // 時間
    let isRunning = false;

    // 定数
    const A = 2.5;     // 振幅
    const V = 1.5;     // 速さ
    const LAMBDA = 6.0; // 波長
    const T_PERIOD = LAMBDA / V; // 周期 4.0s
    
    // 表示用スケール
    const X_MAX = 9.0;
    const Y_MAX = 4.0;
    
    p.setup = () => {
      const parent = document.getElementById(simTargetId);
      // 親要素がない場合は処理しない安全策
      if (!parent) return;
      
      p.createCanvas(parent.clientWidth, parent.clientHeight).parent(parent);

      // コントローラー生成 (SimUtilsが必要)
      if (window.SimUtils) {
        SimUtils.createControls(parent, {
          onPlay: () => { isRunning = true; },
          onPause: () => { isRunning = false; },
          onReset: () => { 
            t = 0; 
            isRunning = false; 
          }
        });
      }
    };

    p.draw = () => {
      p.background(255);
      
      // 座標変換ヘルパー
      const mapX = (x) => p.map(x, -1, X_MAX, 0, p.width);
      const mapY = (y) => p.map(y, Y_MAX, -Y_MAX, 0, p.height);

      // 時間更新
      if (isRunning) {
        t += 1/60;
      }

      // --- 軸の描画 ---
      p.stroke(0);
      p.strokeWeight(1);
      // X軸
      p.line(mapX(-1), mapY(0), mapX(X_MAX), mapY(0));
      // Y軸
      p.line(mapX(0), mapY(-Y_MAX), mapX(0), mapY(Y_MAX));

      // 目盛り
      p.textAlign(p.CENTER, p.TOP);
      p.textSize(12);
      p.noStroke();
      p.fill(0);
      [3.0, 6.0].forEach(val => {
        p.text(val.toFixed(1), mapX(val), mapY(0) + 5);
        p.stroke(0);
        p.line(mapX(val), mapY(0)-3, mapX(val), mapY(0)+3);
        p.noStroke();
      });
      p.text("x [m]", mapX(X_MAX)-20, mapY(0) + 5);
      p.textAlign(p.RIGHT, p.CENTER);
      p.text("y [m]", mapX(0)-5, mapY(Y_MAX)+10);

      // --- 波の描画 (y-x) ---
      const k = p.TWO_PI / LAMBDA;
      const omega = p.TWO_PI / T_PERIOD;
      
      p.noFill();
      p.stroke(0, 0, 200);
      p.strokeWeight(2);
      p.beginShape();
      for (let x = 0; x <= X_MAX; x += 0.1) {
        let phase = k * x - omega * t;
        let y = -A * p.sin(phase);
        p.vertex(mapX(x), mapY(y));
      }
      p.endShape();

      // --- x=3.0 の点の描画 ---
      const targetX = 3.0;
      const targetPhase = k * targetX - omega * t;
      const targetY = -A * p.sin(targetPhase);

      p.fill(255, 0, 0);
      p.noStroke();
      p.circle(mapX(targetX), mapY(targetY), 12);
      
      // 速度ベクトルの描画
      p.stroke(100);
      p.strokeWeight(2);
      const vY = mapY(2.8);
      p.line(mapX(2.0), vY, mapX(4.0), vY);
      p.triangle(mapX(4.0), vY, mapX(3.8), vY-3, mapX(3.8), vY+3);
      p.noStroke();
      p.fill(100);
      p.text("v = 1.5 m/s", mapX(3.0), vY - 15);

      // 情報表示
      p.fill(0);
      p.textAlign(p.LEFT, p.TOP);
      p.text(`t = ${t.toFixed(2)} s`, 10, 10);
      
      if(t === 0 && !isRunning) {
         p.fill(200, 0, 0);
         p.text("再生ボタンで波を進行", 10, 30);
      }
    };

    p.windowResized = () => {
      const parent = document.getElementById(simTargetId);
      if(parent) p.resizeCanvas(parent.clientWidth, parent.clientHeight);
    };
  };
  const mainP5 = new p5(sketchMain);

  // --- 2. サブシミュレーション (右側: y-t グラフ) ---
  // 解説文の中に <div id="sub-sim-yt-graph"></div> がある場合に描画されます
  const sketchSub = (p) => {
    const A = 2.5;
    const T_PERIOD = 4.0; 
    const T_MAX = 6.0;

    p.setup = () => {
      const parent = document.getElementById('sub-sim-yt-graph');
      // 解説文にターゲット要素が含まれている場合のみキャンバス作成
      if(parent) {
        p.createCanvas(parent.clientWidth, parent.clientHeight).parent(parent);
      }
    };

    p.draw = () => {
      p.background(250);
      
      const mapT = (t) => p.map(t, 0, T_MAX, 40, p.width - 20);
      const mapY = (y) => p.map(y, 3.0, -3.0, 20, p.height - 20);

      // 軸
      p.stroke(0);
      p.strokeWeight(1);
      p.line(mapT(0), mapY(0), mapT(T_MAX), mapY(0));
      p.line(mapT(0), mapY(-3), mapT(0), mapY(3));

      // 目盛り
      p.noStroke();
      p.fill(0);
      p.textSize(10);
      p.textAlign(p.CENTER, p.TOP);
      p.text("4.0", mapT(4.0), mapY(0)+5);
      p.text("t [s]", mapT(T_MAX), mapY(0)+5);
      
      p.textAlign(p.RIGHT, p.CENTER);
      p.text("2.5", mapT(0)-5, mapY(2.5));
      p.text("-2.5", mapT(0)-5, mapY(-2.5));
      p.text("y [m]", mapT(0)+20, mapY(3));

      // グラフ描画
      const omega = p.TWO_PI / T_PERIOD;

      p.noFill();
      p.stroke(200, 0, 0);
      p.strokeWeight(2);
      p.beginShape();
      for(let t = 0; t <= T_MAX; t+=0.05) {
        let y = -A * p.sin(omega * t);
        p.vertex(mapT(t), mapY(y));
      }
      p.endShape();
    };

    p.windowResized = () => {
      const parent = document.getElementById('sub-sim-yt-graph');
      if(parent) p.resizeCanvas(parent.clientWidth, parent.clientHeight);
    }
  };
  const subP5 = new p5(sketchSub);

  // インスタンス管理 (画面外停止機能用)
  if(!window.p5Instances) window.p5Instances = [];
  window.p5Instances.push(mainP5, subP5);
};