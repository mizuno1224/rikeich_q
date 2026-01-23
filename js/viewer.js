/* js/viewer.js */

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const probId = params.get('id');
  
  // 1. データロード
  fetch('problems.json')
    .then(res => {
      if (!res.ok) throw new Error("JSON load failed");
      return res.json();
    })
    .then(data => loadProblem(probId, data))
    .catch(err => {
      console.error(err);
      // alert("データ読み込みエラー"); // 開発中はうるさいのでコンソールのみ
    });

  // ポインター制御
  const btnPointer = document.getElementById('btn-toggle-pointer');
  if(document.getElementById('pointer-canvas')){
    // js/pointer.js が読み込まれていれば有効化
    if(typeof LaserPointer !== 'undefined') new LaserPointer('pointer-canvas');
  }
  if(btnPointer) {
    btnPointer.addEventListener('click', () => {
      const isActive = document.body.classList.toggle('pointer-active');
      btnPointer.classList.toggle('active', isActive);
      btnPointer.innerHTML = isActive ? '🖊️ ポインターON' : '👆 操作モード';
    });
  }
});

function loadProblem(id, dataset) {
  let target = null;
  
  // 4階層検索
  for (const mat of dataset) {
    for (const sub of mat.subjects) {
      for (const fld of sub.fields) {
        const found = fld.problems.find(p => p.id === id);
        if (found) { target = found; break; }
      }
      if (target) break;
    }
    if (target) break;
  }

  if (target) {
    document.title = target.title;
    const titleEl = document.getElementById('prob-title-header');
    if(titleEl) titleEl.textContent = target.title;

    const textTarget = document.getElementById('text-target');
    if (textTarget) {
      // 解説ファイルのロード
      if (target.explanationPath) {
        fetch(target.explanationPath)
          .then(res => {
            if(!res.ok) throw new Error("Explanation file not found");
            return res.text();
          })
          .then(html => {
            textTarget.innerHTML = html;
            if(window.MathJax) MathJax.typesetPromise([textTarget]);
            if(window.updateObserver) window.updateObserver();
          })
          .catch(err => {
            console.warn(err);
            textTarget.innerHTML = "<p>解説ファイルの読み込みに失敗しました。</p>";
          });

      } else {
        textTarget.innerHTML = "<p>解説が登録されていません。</p>";
      }
    }

    // シミュレーションJSのロードと実行
    if (target.jsPath) {
      // 既存のスクリプトタグがあれば削除（リロード用）
      const oldScript = document.querySelector(`script[src="${target.jsPath}"]`);
      if(oldScript) oldScript.remove();

      const script = document.createElement('script');
      script.src = target.jsPath;
      script.onload = () => {
        const simTargetId = "sim-target";
        const textTargetId = "text-target";

        // 新方式: PhysicsLab.problems['id']
        if (window.PhysicsLab && window.PhysicsLab.problems && typeof window.PhysicsLab.problems[target.id] === 'function') {
          window.PhysicsLab.problems[target.id](simTargetId, textTargetId);
        }
        // 旧方式: window.setup_{id} (互換性維持)
        else {
           const funcName = "setup_" + target.id.replace(/-/g, "_");
           if (typeof window[funcName] === "function") {
             window[funcName](simTargetId, textTargetId); 
           }
        }
      };
      document.body.appendChild(script);
    }
  } else {
    // IDがない場合はトップページ的な表示にするか、アラート
    if(id) alert("問題IDが見つかりません: " + id);
  }
}