/* js/app.js */

/* =========================================
   [Physics Lab] Performance Control
   画面外シミュレーションの自動停止
   ========================================= */

function initPerformanceObserver() {
  // p5.jsのキャンバスなどが表示領域に入っているか監視する
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const target = entry.target;

        // p5.js インスタンスの制御
        if (window.p5Instances) {
          window.p5Instances.forEach((p) => {
            // p5インスタンスの親要素(キャンバスのコンテナ)が、今回の監視対象の中にあるかチェック
            // _parentNode は p5.js の内部プロパティ、またはユーザー側で設定した親
            const parent = p.canvas ? p.canvas.parentElement : p._parentNode;

            if (parent && (target === parent || target.contains(parent))) {
              if (entry.isIntersecting) {
                p.loop(); // 画面内なら再生
              } else {
                p.noLoop(); // 画面外なら描画停止（CPU節約）
              }
            }
          });
        }

        // Three.js 等、その他のアニメーション制御が必要な場合はここに追記可能
      });
    },
    {
      root: null, // ビューポートを基準
      threshold: 0.1, // 10%見えたら有効
    },
  );

  // 監視対象を更新する関数（問題ロード後などに呼ぶ）
  window.updateObserver = () => {
    // 監視対象: 固定エリア、解説カード、解説内のdiv、そして埋め込みシミュレーション(.sim-embed)
    const targets = document.querySelectorAll(
      ".simulation-area, .explanation-area .card, .explanation-area div, .sim-embed",
    );
    targets.forEach((el) => observer.observe(el));
  };

  // 初期実行
  window.updateObserver();
}

document.addEventListener("DOMContentLoaded", initPerformanceObserver);
