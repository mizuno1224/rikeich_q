/* js/sim-utils.js */

// --- 名前空間の初期化 ---
window.PhysicsLab = window.PhysicsLab || {};
window.PhysicsLab.problems = window.PhysicsLab.problems || {};

window.SimUtils = {
  /**
   * シミュレーションの基本コントローラー（再生/停止、リセット）を作成
   * @param {HTMLElement} parent - 親要素 (simTargetIdの要素)
   * @param {Object} actions - コールバック { onPlay, onPause, onReset }
   * @returns {Object} { container, btnPlay, btnReset }
   */
  createControls: (parent, actions) => {
    // 既存のコントローラーがあれば削除（二重追加防止）
    const existing = parent.querySelector(".sim-controls-panel");
    if (existing) existing.remove();

    const container = document.createElement("div");
    container.className = "sim-controls-panel";

    // 再生/一時停止ボタン
    const btnPlay = document.createElement("button");
    btnPlay.className = "sim-btn";
    btnPlay.innerHTML = "⏸"; // 初期は再生中アイコン
    let isPlaying = true;

    btnPlay.onclick = () => {
      isPlaying = !isPlaying;
      btnPlay.innerHTML = isPlaying ? "⏸" : "▶";
      if (isPlaying && actions.onPlay) actions.onPlay();
      if (!isPlaying && actions.onPause) actions.onPause();
    };

    // リセットボタン
    const btnReset = document.createElement("button");
    btnReset.className = "sim-btn";
    btnReset.innerHTML = "↺";
    btnReset.onclick = () => {
      // リセット時は再生状態に戻す
      isPlaying = true;
      btnPlay.innerHTML = "⏸";
      if (actions.onReset) actions.onReset();
    };

    container.appendChild(btnPlay);
    container.appendChild(btnReset);
    parent.appendChild(container);

    return { container, btnPlay, btnReset };
  },

  /**
   * コントローラーにスライダーを追加
   */
  addSlider: (container, label, min, max, initial, step, onChange) => {
    const wrap = document.createElement("div");
    wrap.className = "sim-slider-wrap";

    const lbl = document.createElement("span");
    lbl.textContent = label;

    const input = document.createElement("input");
    input.type = "range";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = initial;

    const valDisp = document.createElement("span");
    valDisp.style.minWidth = "24px";
    valDisp.textContent = initial;

    input.oninput = (e) => {
      const v = parseFloat(e.target.value);
      valDisp.textContent = v;
      onChange(v);
    };

    wrap.appendChild(lbl);
    wrap.appendChild(input);
    wrap.appendChild(valDisp);
    container.appendChild(wrap);

    return input;
  },
};
