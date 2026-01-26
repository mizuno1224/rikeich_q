/* js/sim-utils.js */

// --- 名前空間の初期化 ---
window.PhysicsLab = window.PhysicsLab || {};
window.PhysicsLab.problems = window.PhysicsLab.problems || {};

window.SimUtils = {
  /**
   * シミュレーションの基本コントローラー（再生/停止、リセット）を作成
   * @param {HTMLElement} parent - 親要素 (simTargetIdの要素)
   * @param {Object} actions - コールバック { onPlay, onPause, onReset }
   * @param {Object} options - オプション { initialPlaying: boolean }
   * @returns {Object} { container, btnPlay, btnReset }
   */
  createControls: (parent, actions, options = {}) => {
    // 既存のコントローラーがあれば削除（二重追加防止）
    const existing = parent.querySelector(".sim-controls-panel");
    if (existing) existing.remove();

    const container = document.createElement("div");
    container.className = "sim-controls-panel";

    // オプションから初期状態を取得（デフォルトはtrue）
    const initialPlaying = options.initialPlaying !== undefined ? options.initialPlaying : true;
    let isPlaying = initialPlaying;

    // 再生/一時停止ボタン
    const btnPlay = document.createElement("button");
    btnPlay.className = "sim-btn";
    // 再生中なら「一時停止」ボタン、停止中なら「再生」ボタンを表示
    btnPlay.innerHTML = isPlaying ? "⏸" : "▶";

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
      // リセット時の挙動：初期状態設定に従うか、強制的に停止/再生するか
      // 一般的にはリセットしたら停止して頭出し、または再生継続
      // ここでは「停止」してリセットコールバックを呼ぶ形にする
      isPlaying = false;
      btnPlay.innerHTML = "▶";
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
    valDisp.textContent = Number(initial).toFixed(step < 0.1 ? 2 : 1);

    // ユーザー操作時
    input.oninput = (e) => {
      const v = parseFloat(e.target.value);
      valDisp.textContent = v.toFixed(step < 0.1 ? 2 : 1);
      onChange(v);
    };

    // プログラムからの更新用メソッド（イベントを発火させずにUIだけ更新）
    input.updateUI = (val) => {
      input.value = val;
      valDisp.textContent = Number(val).toFixed(step < 0.1 ? 2 : 1);
    };

    wrap.appendChild(lbl);
    wrap.appendChild(input);
    wrap.appendChild(valDisp);
    container.appendChild(wrap);

    return input;
  },
};