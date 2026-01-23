/* js/app.js */

/* =========================================
   [Physics Lab] Performance Control
   画面外シミュレーションの自動停止
   ========================================= */

function initPerformanceObserver() {
  // p5.jsのキャンバスが表示領域に入っているか監視する
  const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const target = entry.target;
        
        if (window.p5Instances) {
          window.p5Instances.forEach((p) => {
            // p5インスタンスの親要素が、今回の監視対象の中にあるかチェック
            if (p._parentNode && target.contains(p._parentNode)) {
              if (entry.isIntersecting) {
                p.loop(); // 画面内なら再生
              } else {
                p.noLoop(); // 画面外なら描画停止（CPU節約）
              }
            }
          });
        }
      });
    }, { 
      root: null, // ビューポートを基準
      threshold: 0.1 // 10%見えたら有効
    }
  );

  // 監視対象を更新する関数（問題ロード後などに呼ぶ）
  window.updateObserver = () => {
    // 解説エリア内の主要なブロックを監視対象にする
    // .card, .sub-sim-area, .simulation-area など
    const targets = document.querySelectorAll(".simulation-area, .explanation-area .card, .explanation-area div");
    targets.forEach((el) => observer.observe(el));
  };
  
  // 初期実行
  window.updateObserver();
}

document.addEventListener("DOMContentLoaded", initPerformanceObserver);