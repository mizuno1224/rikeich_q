/* js/viewer.js */

// ポインターインスタンスを保持する変数
let pointerInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const probId = params.get('id');
  const srcPath = params.get('src'); // 分割JSONのパスを受け取る

  // データロード
  // srcパラメータがなければ旧来の problems.json をフォールバックとして使用
  const fetchTarget = srcPath ? srcPath : 'problems.json';

  fetch(fetchTarget)
    .then(res => {
      if (!res.ok) throw new Error("JSON load failed");
      return res.json();
    })
    .then(data => {
      // Split JSONの場合は data が直接 Material Object ( {subjects: ...} )
      // problems.json (Legacy) の場合は Array ( [{subjects:...}, ...] )
      let problemsList = [];
      
      if (Array.isArray(data)) {
        // Legacy: 全配列から探す
        problemsList = data;
      } else {
        // Split: 1つのMaterialオブジェクトなので、配列に入れて検索ロジックを共通化
        problemsList = [data];
      }
      
      loadProblem(probId, problemsList);
    })
    .catch(err => {
      console.error(err);
      const target = document.getElementById('text-target');
      if(target) target.innerHTML = "<p>問題データの読み込みに失敗しました。</p>";
    });

  // ポインター制御の初期化
  const btnPointer = document.getElementById('btn-toggle-pointer');
  if(document.getElementById('pointer-canvas') && typeof LaserPointer !== 'undefined'){
    pointerInstance = new LaserPointer('pointer-canvas');
    
    // スクロールでクリア
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
  if (window.p5Instances) {
    window.p5Instances.forEach(p => p.remove());
    window.p5Instances = [];
  }
  
  let target = null;
  
  // 階層検索
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

  const textTarget = document.getElementById('text-target');
  if (!textTarget) return;

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
          
          // 2. 埋め込みスクリプトの実行
          executeInlineScripts(textTarget);

          // 3. Observer更新 (目次等の追従用)
          if(window.updateObserver) setTimeout(window.updateObserver, 100);
        })
        .catch(err => {
          console.warn(err);
          textTarget.innerHTML = "<p>解説ファイルの読み込みに失敗しました。</p>";
        });

    } else {
      textTarget.innerHTML = "<p>解説が登録されていません。</p>";
    }
  } else {
    if(id) textTarget.innerHTML = `<p>問題ID "${id}" が見つかりません。</p>`;
  }
}

// HTML文字列として挿入された script タグを実行可能にするヘルパー
function executeInlineScripts(element) {
  const scripts = element.querySelectorAll('script');
  scripts.forEach(oldScript => {
    const newScript = document.createElement('script');
    Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
    newScript.textContent = oldScript.textContent;
    oldScript.parentNode.replaceChild(newScript, oldScript);
  });
}