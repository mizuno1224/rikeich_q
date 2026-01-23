/* js/viewer.js */

// ポインターインスタンスを保持する変数
let pointerInstance = null;

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
    });

  // 2. ポインター制御の初期化
  const btnPointer = document.getElementById('btn-toggle-pointer');
  if(document.getElementById('pointer-canvas') && typeof LaserPointer !== 'undefined'){
    pointerInstance = new LaserPointer('pointer-canvas');
    
    // スクロールでクリア (PC/スマホ/記事モード両対応)
    window.addEventListener('scroll', () => pointerInstance.clear(), { passive: true });
    const expl = document.querySelector('.explanation-area');
    if(expl) expl.addEventListener('scroll', () => pointerInstance.clear(), { passive: true });
  }

  if(btnPointer) {
    btnPointer.addEventListener('click', () => {
      const isActive = document.body.classList.toggle('pointer-active');
      btnPointer.classList.toggle('active', isActive);
      btnPointer.innerHTML = isActive ? '🖊️ ポインターON' : '👆 操作モード';
      if(pointerInstance) pointerInstance.clear();
    });
  }
});

function loadProblem(id, dataset) {
  // --- クリーンアップ処理 ---
  // 前のシミュレーションが残っている場合は削除
  if (window.p5Instances) {
    window.p5Instances.forEach(p => p.remove());
    window.p5Instances = [];
  }
  // 必要に応じて他のライブラリのクリーンアップもここに追加
  
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

    // --- レイアウト切り替え処理 ---
    if (target.layout === 'article') {
      document.body.classList.add('layout-article');
    } else {
      document.body.classList.remove('layout-article');
    }

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
            // HTMLを挿入
            textTarget.innerHTML = html;
            
            // 1. MathJaxのレンダリング
            if(window.MathJax) MathJax.typesetPromise([textTarget]);
            
            // 2. 埋め込みスクリプトの実行 (HTML内の <script> を動かす)
            executeInlineScripts(textTarget);

            // 3. Observer更新
            if(window.updateObserver) setTimeout(window.updateObserver, 100);
          })
          .catch(err => {
            console.warn(err);
            textTarget.innerHTML = "<p>解説ファイルの読み込みに失敗しました。</p>";
          });

      } else {
        textTarget.innerHTML = "<p>解説が登録されていません。</p>";
      }
    }

    // (互換性維持) 外部JSファイルがある場合のみロード
    if (target.jsPath) {
      const oldScript = document.querySelector(`script[src="${target.jsPath}"]`);
      if(oldScript) oldScript.remove();

      const script = document.createElement('script');
      script.src = target.jsPath;
      script.onload = () => {
        const simTargetId = "sim-target";
        const textTargetId = "text-target";
        if (window.PhysicsLab && window.PhysicsLab.problems && typeof window.PhysicsLab.problems[target.id] === 'function') {
          window.PhysicsLab.problems[target.id](simTargetId, textTargetId);
        } else {
           const funcName = "setup_" + target.id.replace(/-/g, "_");
           if (typeof window[funcName] === "function") window[funcName](simTargetId, textTargetId); 
        }
      };
      document.body.appendChild(script);
    }
  } else {
    if(id) alert("問題IDが見つかりません: " + id);
  }
}

// HTML文字列として挿入された <script> タグは自動実行されないため、
// 手動で作り直して実行させるヘルパー関数
function executeInlineScripts(element) {
  const scripts = element.querySelectorAll('script');
  scripts.forEach(oldScript => {
    const newScript = document.createElement('script');
    // 属性のコピー (src, typeなど)
    Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
    // 中身のコピー
    newScript.textContent = oldScript.textContent;
    // 置換して実行
    oldScript.parentNode.replaceChild(newScript, oldScript);
  });
}