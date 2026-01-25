/* js/viewer.js */

// ポインターインスタンスを保持する変数
let pointerInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  
  // ★追加: index.html から渡されるパスパラメータを取得
  const directPath = params.get('path');
  
  // 従来のパラメータ
  const probId = params.get('id');
  const srcPath = params.get('src');

  // --- ポインター制御の初期化 (共通) ---
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

  // --- メイン読み込み処理 ---
  if (directPath) {
    // パターンA: パス直接指定 (index.htmlからの遷移など)
    loadExplanationByPath(directPath);
  } else if (probId) {
    // パターンB: ID指定 (従来のJSON検索)
    loadProblemById(probId, srcPath);
  } else {
    showError("問題が指定されていません。");
  }
});

/**
 * パスから直接HTMLを読み込む (New)
 */
function loadExplanationByPath(path) {
  const textTarget = document.getElementById('text-target');
  if (!textTarget) return;

  // デフォルトで記事型レイアウトを適用
  document.body.classList.add('layout-article');

  // 仮のタイトルを表示（ファイル名）
  const fileName = path.split('/').pop();
  updateTitle(fileName);

  fetch(path)
    .then(res => {
      if(!res.ok) throw new Error("Explanation file not found: " + path);
      return res.text();
    })
    .then(html => {
      renderExplanation(textTarget, html);
      
      // HTML内の見出しタグからタイトルを抽出してヘッダーに反映
      const heading = textTarget.querySelector('h2, h3');
      if(heading) {
        // "第1問：..." のような部分のみ抽出するか、テキスト全体を使う
        updateTitle(heading.textContent);
      }
    })
    .catch(err => {
      console.error(err);
      showError(`解説ファイルの読み込みに失敗しました。<br><span style="font-size:0.8em">${path}</span>`);
    });
}

/**
 * IDからJSONを検索して読み込む (Legacy)
 */
function loadProblemById(id, srcPath) {
  // srcパラメータがなければ旧来の problems.json をフォールバックとして使用
  const fetchTarget = srcPath ? srcPath : 'problems.json';

  fetch(fetchTarget)
    .then(res => {
      if (!res.ok) throw new Error("JSON load failed");
      return res.json();
    })
    .then(data => {
      let problemsList = Array.isArray(data) ? data : [data];
      
      // 階層検索
      let target = null;
      for (const mat of problemsList) {
        if (!mat.subjects) continue;
        for (const sub of mat.subjects) {
          if (!sub.fields) continue;
          for (const fld of sub.fields) {
            if (!fld.problems) continue;
            const found = fld.problems.find(p => p.id === id);
            if (found) { target = found; break; }
          }
          if (target) break;
        }
        if (target) break;
      }

      if (target) {
        applyProblemData(target);
      } else {
        showError(`問題ID "${id}" が見つかりません。`);
      }
    })
    .catch(err => {
      console.error(err);
      showError("問題データの検索に失敗しました。");
    });
}

/**
 * JSONデータが見つかった場合の適用処理
 */
function applyProblemData(target) {
  const textTarget = document.getElementById('text-target');
  if (!textTarget) return;

  updateTitle(target.title);

  // レイアウト切り替え
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
        renderExplanation(textTarget, html);
      })
      .catch(err => {
        console.warn(err);
        showError("解説ファイルの読み込みに失敗しました。");
      });
  } else {
    showError("解説が登録されていません。");
  }
}

// --- 共通ヘルパー関数 ---

function updateTitle(title) {
  document.title = title;
  const titleEl = document.getElementById('prob-title-header');
  if(titleEl) titleEl.textContent = title;
}

function renderExplanation(container, html) {
  // 1. HTML挿入
  container.innerHTML = html;
  
  // 2. MathJaxのレンダリング
  if(window.MathJax) {
    if (MathJax.typesetPromise) {
      MathJax.typesetPromise([container]).catch(e => console.log(e));
    } else if (MathJax.Hub) {
      MathJax.Hub.Queue(["Typeset", MathJax.Hub, container]);
    }
  }
  
  // 3. 埋め込みスクリプトの実行
  executeInlineScripts(container);

  // 4. Observer更新 (目次等の追従用)
  if(window.updateObserver) setTimeout(window.updateObserver, 100);
}

function showError(msg) {
  const target = document.getElementById('text-target');
  if(target) target.innerHTML = `<p style="padding:20px; color:#ef4444;">${msg}</p>`;
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