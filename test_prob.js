/* Path: js/problems/physics_basic/03_wave/prob_wave_graph_trans.js */

window.setup_prob_wave_graph_trans = function(simTargetId, textTargetId) {
  // --- 1. 解説HTMLの注入 ---
  const textContainer = document.getElementById(textTargetId);
  textContainer.innerHTML = `
    <h2 class="prob-title-sub">解説とポイント</h2>

    <div class="box-alert">
      <span class="box-alert-label">Point</span>
      <p><strong>$y-x$ 図（ある瞬間の写真）</strong>と <strong>$y-t$ 図（ある点のビデオ）</strong>の違いを明確にしましょう。<br>特に「グラフの初動（上に行くか下に行くか）」の判定が鍵です。</p>
    </div>

    <div class="prob-step">
      <h3>STEP 1: グラフから情報を読み取る</h3>
      <p>与えられた図（$y-x$ 図）より、以下の情報が読み取れます。</p>
      <ul>
        <li><strong>振幅 $A$</strong>：グラフの山の高さより、$2.5\,\text{m}$</li>
        <li><strong>波長 $\\lambda$</strong>：図の $x=0$ から $x=3.0$ までは「谷1つ分（半波長）」に相当します。よって、$\\frac{\\lambda}{2} = 3.0\,\text{m}$ より、$\\lambda = 6.0\,\text{m}$</li>
      </ul>
    </div>

    <div class="prob-step">
      <h3>STEP 2: 周期を計算する</h3>
      <p>波の速さは $v = 1.5\,\text{m/s}$ と与えられています。波の基本式 $v = \\frac{\\lambda}{T}$ より、周期 $T$ を求めます。</p>
      <p>
        $$ T = \\frac{\\lambda}{v} = \\frac{6.0}{1.5} = 4.0\,\text{s} $$
      </p>
    </div>

    <div class="prob-step">
      <h3>STEP 3: $x=3.0$での動き出しを判定する</h3>
      <p>時刻 $t=0$ で、位置 $x=3.0\,\text{m}$ の変位は $y=0$ です。<br>波は<strong>正の向き（右側）</strong>に進んでいるため、少し時間が経つと、現在の「左側の波形」が $x=3.0$ にやってきます。</p>
      <p>図を見ると、$x=3.0$ のすぐ左側（$x=2.9$ 付近）ではグラフは<strong>負（マイナス）</strong>になっています。つまり、次の瞬間、媒質は<strong>下向き</strong>に動きます。</p>
    </div>

    <div class="card">
      <h3>結論：$y-t$ 図を描く</h3>
      <p>以上の情報まとめます。</p>
      <ul>
        <li>原点 $O$ からスタート</li>
        <li>最初に<strong>下（負の方向）</strong>へ動く</li>
        <li>周期 $T=4.0\,\text{s}$、振幅 $2.5\,\text{m}$ の正弦波</li>
      </ul>
      <p>これをグラフにすると以下のようになります。</p>
      <div id="sub-sim-yt-graph" class="sub-sim-area" style="height: 200px;"></div>
    </div>
  `;

  // --- 2. メインシミュレーション (左側: y-x 波動) ---
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
      p.createCanvas(parent.clientWidth, parent.clientHeight).parent(parent);

      // コントローラー生成
      SimUtils.createControls(parent, {
        onPlay: () => { isRunning = true; },
        onPause: () => { isRunning = false; },
        onReset: () => { 
          t = 0; 
          isRunning = false; 
        }
      });
    };

    p.draw = () => {
      p.background(255);
      
      // 座標変換ヘルパー
      const mapX = (x) => p.map(x, -1, X_MAX, 0, p.width);
      const mapY = (y) => p.map(y, Y_MAX, -Y_MAX, 0, p.height);
      const scaleX = p.width / (X_MAX + 1);

      // 時間更新
      if (isRunning) {
        t += 1/60; // 実際の時間経過に合わせるなら dt
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
      // t=0 の波形は -sin(kx) の形 (原点0, x=1.5で谷, x=3.0で0)
      // 進行波の式: y = -A * sin(k(x - vt)) だと位相が合うか確認
      // t=0, x=small -> y = -A*sin(kx) -> 負になる。OK。
      // x-vt なので右へ進む。
      
      const k = p.TWO_PI / LAMBDA;
      const omega = p.TWO_PI / T_PERIOD;
      
      p.noFill();
      p.stroke(0, 0, 200);
      p.strokeWeight(2);
      p.beginShape();
      for (let x = 0; x <= X_MAX; x += 0.1) {
        // 問題のグラフは t=0 で x=0->0, x=1.5->-2.5 (谷)。
        // 通常の sin(kx) は x=1.5(pi/2)で山。なので -sin(kx) スタート。
        // 右へ進む => (kx - wt)
        // y = -A * sin(kx - wt)
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
      
      // 速度ベクトルの描画 (波の進行方向)
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

  // --- 3. サブシミュレーション (右側: y-t グラフ) ---
  const sketchSub = (p) => {
    // 定数再定義
    const A = 2.5;
    const T_PERIOD = 4.0; 
    const T_MAX = 6.0; // 横軸の最大時間

    p.setup = () => {
      const parent = document.getElementById('sub-sim-yt-graph');
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
      // t軸
      p.line(mapT(0), mapY(0), mapT(T_MAX), mapY(0));
      // y軸
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

      // グラフ描画 (静的)
      // x=3.0 における y-t グラフ
      // y = -A sin(omega * t)  (t=0で0, t少し増えると負)
      const omega = p.TWO_PI / T_PERIOD;

      p.noFill();
      p.stroke(200, 0, 0);
      p.strokeWeight(2);
      p.beginShape();
      for(let t = 0; t <= T_MAX; t+=0.05) {
        // x=3.0 での位相: k*3 - w*t
        // k*3 = (2pi/6)*3 = pi
        // y = -A sin(pi - wt) = -A sin(wt)
        // または解説通り: 初動が下なので -sin(wt)
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

  // インスタンス管理
  if(!window.p5Instances) window.p5Instances = [];
  window.p5Instances.push(mainP5, subP5);
  
  // 数式レンダリング更新
  if(window.MathJax) {
      window.MathJax.typesetPromise ? window.MathJax.typesetPromise([textContainer]) : window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, textContainer]);
  }
};