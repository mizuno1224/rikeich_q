/* js/viewer.js */

// ポインターインスタンスを保持する変数
let pointerInstance = null;

// 現在の表示中の問題IDまたはパスを保持
let currentProbId = null;
let currentPath = null;

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);

  // ★追加: index.html から渡されるパスパラメータを取得
  const directPath = params.get("path");

  // 従来のパラメータ
  const probId = params.get("id");
  const srcPath = params.get("src");

  // ID保存
  if (probId) currentProbId = probId;
  if (directPath) currentPath = directPath;

  // ユーザー識別子の初期化（なければ生成して保存）
  initUserId();

  // --- ポインター制御の初期化 (共通) ---
  const btnPointer = document.getElementById("btn-toggle-pointer");
  if (
    document.getElementById("pointer-canvas") &&
    typeof LaserPointer !== "undefined"
  ) {
    pointerInstance = new LaserPointer("pointer-canvas");

    // スクロールでクリア
    window.addEventListener("scroll", () => pointerInstance.clear(), {
      passive: true,
    });
    const expl = document.querySelector(".explanation-area");
    if (expl)
      expl.addEventListener("scroll", () => pointerInstance.clear(), {
        passive: true,
      });
  }

  if (btnPointer) {
    btnPointer.addEventListener("click", () => {
      const isActive = document.body.classList.toggle("pointer-active");
      btnPointer.classList.toggle("active", isActive);
      btnPointer.innerHTML = isActive ? "🖊️ ポインターON" : "👆 操作モード";
      if (pointerInstance) pointerInstance.clear();
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
 * ユーザーID管理 (LocalStorage)
 * 教員画面で個別の生徒を識別するために使用
 */
function initUserId() {
  let uid = localStorage.getItem("rikeich_uid");
  if (!uid) {
    uid = "user_" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("rikeich_uid", uid);
  }
  return uid;
}

function getUserId() {
  return localStorage.getItem("rikeich_uid") || "unknown";
}

/**
 * パスから直接HTMLを読み込む (New)
 */
function loadExplanationByPath(path) {
  const textTarget = document.getElementById("text-target");
  if (!textTarget) return;

  // 仮のタイトルを表示（ファイル名）
  const fileName = path.split("/").pop();
  updateTitle(fileName);

  fetch(path)
    .then((res) => {
      if (!res.ok) throw new Error("Explanation file not found: " + path);
      return res.text();
    })
    .then((html) => {
      renderExplanation(textTarget, html);

      // HTML内の見出しタグからタイトルを抽出してヘッダーに反映
      const heading = textTarget.querySelector("h2, h3");
      if (heading) {
        updateTitle(heading.textContent);
      }
    })
    .catch((err) => {
      console.error(err);
      showError(
        `解説ファイルの読み込みに失敗しました。<br><span style="font-size:0.8em">${path}</span>`,
      );
    });
}

/**
 * IDからJSONを検索して読み込む (Legacy)
 */
function loadProblemById(id, srcPath) {
  const fetchTarget = srcPath ? srcPath : "problems.json";

  fetch(fetchTarget)
    .then((res) => {
      if (!res.ok) throw new Error("JSON load failed");
      return res.json();
    })
    .then((data) => {
      let problemsList = Array.isArray(data) ? data : [data];

      // 階層検索
      let target = null;
      for (const mat of problemsList) {
        if (!mat.subjects) continue;
        for (const sub of mat.subjects) {
          if (!sub.fields) continue;
          for (const fld of sub.fields) {
            if (!fld.problems) continue;
            const found = fld.problems.find((p) => p.id === id);
            if (found) {
              target = found;
              break;
            }
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
    .catch((err) => {
      console.error(err);
      showError("問題データの検索に失敗しました。");
    });
}

/**
 * JSONデータが見つかった場合の適用処理
 */
function applyProblemData(target) {
  const textTarget = document.getElementById("text-target");
  if (!textTarget) return;

  updateTitle(target.title);

  // 解説ファイルのロード
  if (target.explanationPath) {
    fetch(target.explanationPath)
      .then((res) => {
        if (!res.ok) throw new Error("Explanation file not found");
        return res.text();
      })
      .then((html) => {
        renderExplanation(textTarget, html);
      })
      .catch((err) => {
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
  const titleEl = document.getElementById("prob-title-header");
  if (titleEl) titleEl.textContent = title;
}

function renderExplanation(container, html) {
  // 1. HTML挿入
  container.innerHTML = html;

  // 2. MathJaxのレンダリング
  if (window.MathJax) {
    if (MathJax.typesetPromise) {
      MathJax.typesetPromise([container]).catch((e) => console.log(e));
    } else if (MathJax.Hub) {
      MathJax.Hub.Queue(["Typeset", MathJax.Hub, container]);
    }
  }

  // 3. 埋め込みスクリプトの実行
  executeInlineScripts(container);

  // 4. リアクション機能の注入（★追加）
  setupCardReactions(container);

  // 5. Observer更新 (目次等の追従用)
  if (window.updateObserver) setTimeout(window.updateObserver, 100);
}

function showError(msg) {
  const target = document.getElementById("text-target");
  if (target)
    target.innerHTML = `<p style="padding:20px; color:#ef4444;">${msg}</p>`;
}

function executeInlineScripts(element) {
  const scripts = element.querySelectorAll("script");
  scripts.forEach((oldScript) => {
    const newScript = document.createElement("script");
    Array.from(oldScript.attributes).forEach((attr) =>
      newScript.setAttribute(attr.name, attr.value),
    );
    newScript.textContent = oldScript.textContent;
    oldScript.parentNode.replaceChild(newScript, oldScript);
  });
}

/**
 * 各カード(.card)にリアクションボタンとメモ欄を追加し、
 * LocalStorageおよびクラウド保存のロジックを紐付ける
 */
function setupCardReactions(container) {
  const cards = container.querySelectorAll(".card");
  if (cards.length === 0) return;

  // ★修正: コンテンツIDの生成ロジック
  // IDパラメータがない場合(path指定の場合)は、ファイル名(拡張子なし)をIDとして扱う
  // これにより admin.html 側の集計(ID一致)と整合させる
  let contentId = currentProbId;
  if (!contentId && currentPath) {
     const basename = currentPath.split('/').pop(); // "q_001.html"
     contentId = basename.replace(/\.[^/.]+$/, ""); // "q_001"
  }
  if (!contentId) contentId = 'unknown_content';

  cards.forEach((card, index) => {
    // 1. UIの生成
    const footer = document.createElement("div");
    footer.className = "card-reaction-footer";

    // メモ欄
    const memoArea = document.createElement("div");
    memoArea.className = "card-memo-area";
    const textarea = document.createElement("textarea");
    textarea.className = "card-memo-input";
    textarea.placeholder = "疑問点メモ";
    memoArea.appendChild(textarea);

    // ボタンエリア
    const btnArea = document.createElement("div");
    btnArea.className = "card-reaction-buttons";

    const reactionTypes = [
      { id: "good", icon: "👍", label: "理解" },
      { id: "hmm",  icon: "🤔", label: "疑問" },
    ];

    const buttons = {};

    reactionTypes.forEach(type => {
      const btn = document.createElement("button");
      btn.className = "btn-reaction";
      btn.innerHTML = `${type.icon}`; 
      btn.title = type.label;
      
      btn.addEventListener("click", () => {
        const isActive = btn.classList.contains("active");
        Object.values(buttons).forEach(b => b.classList.remove("active"));
        
        const newValue = isActive ? null : type.id;
        if (!isActive) {
          btn.classList.add("active");
        }

        saveReactionData(contentId, index, "reaction", newValue);
      });

      buttons[type.id] = btn;
      btnArea.appendChild(btn);
    });

    footer.appendChild(memoArea);
    footer.appendChild(btnArea);
    card.appendChild(footer);

    // 2. データの復元 (LocalStorage)
    const savedData = loadReactionData(contentId, index);
    if (savedData) {
      if (savedData.memo) textarea.value = savedData.memo;
      if (savedData.reaction && buttons[savedData.reaction]) {
        buttons[savedData.reaction].classList.add("active");
      }
    }

    // 3. メモの保存イベント
    textarea.addEventListener("change", (e) => {
      saveReactionData(contentId, index, "memo", e.target.value);
    });
  });
}

/**
 * データの保存処理
 */
function saveReactionData(contentId, cardIndex, key, value) {
  const userId = getUserId();
  const storageKey = `rikeich_data_${contentId}_${cardIndex}`;

  // 1. ローカルデータの読み出しと更新
  let data = {};
  try {
    const json = localStorage.getItem(storageKey);
    if (json) data = JSON.parse(json);
  } catch(e) {}

  data[key] = value;
  data.updatedAt = new Date().toISOString();

  // 2. LocalStorageへ保存
  localStorage.setItem(storageKey, JSON.stringify(data));

  // 3. クラウド送信 (教員画面用)
  if (window.db && window.collection && window.doc && window.setDoc) {
     const docId = `${userId}_${contentId}_${cardIndex}`;
     // コレクション名: student_logs
     const docRef = window.doc(window.db, "student_logs", docId);
     
     window.setDoc(docRef, {
       userId: userId,
       contentId: contentId,
       cardIndex: cardIndex,
       reaction: data.reaction || null,
       memo: data.memo || "",
       timestamp: new Date()
     }, { merge: true }).catch(err => console.error("Cloud save failed:", err));
  } else {
    // 接続未完了時のシミュレーションログ
    console.log(`[TeacherView Sync] User:${userId} Content:${contentId} Card:${cardIndex} ${key}=${value}`);
  }
}

/**
 * データの読み込み (LocalStorageのみ)
 */
function loadReactionData(contentId, cardIndex) {
  const storageKey = `rikeich_data_${contentId}_${cardIndex}`;
  try {
    return JSON.parse(localStorage.getItem(storageKey));
  } catch(e) {
    return null;
  }
}