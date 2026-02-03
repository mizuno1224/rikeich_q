/* js/viewer.js */

// ポインターインスタンスを保持する変数
let pointerInstance = null;

// 現在の表示中の問題IDまたはパスを保持
let currentProbId = null;
let currentPath = null;

// 音声プレーヤーインスタンス
let audioPlayer = null;

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
    // ポインターは解説に張り付くため、スクロールではクリアしない
  }

  if (btnPointer) {
    btnPointer.addEventListener("click", () => {
      const isActive = document.body.classList.toggle("pointer-active");
      btnPointer.classList.toggle("active", isActive);
      btnPointer.innerHTML = isActive ? "🖊️ ポインターON" : "👆 操作モード";
      if (pointerInstance) pointerInstance.clear();
      toggleRecordingFloatBar(isActive);
      if (isActive) {
        history.pushState({ viewer: true }, "", location.href);
      }
    });
  }

  // 解説ページではスワイプ「戻る」を完全廃止（常に同じページに留める）
  history.pushState({ viewer: true }, "", location.href);
  window.addEventListener("popstate", () => {
    history.pushState({ viewer: true }, "", location.href);
  });

  // 録画用フロートバー：終了・全画面
  const floatBar = document.getElementById("recording-float-bar");
  const btnExit = document.getElementById("recording-btn-exit");
  const btnFullscreen = document.getElementById("recording-btn-fullscreen");
  if (btnExit) {
    btnExit.addEventListener("click", () => exitPointerAndRecordingMode());
  }
  if (btnFullscreen) {
    btnFullscreen.addEventListener("click", () => toggleRecordingFullscreen());
  }
  const btnClear = document.getElementById("recording-btn-clear");
  if (btnClear) {
    btnClear.addEventListener("click", () => {
      if (pointerInstance) pointerInstance.clear();
    });
  }
  const scrollContainer = document.getElementById("main-content");
  const scrollStep = 120;
  const btnScrollUp = document.getElementById("recording-btn-scroll-up");
  const btnScrollDown = document.getElementById("recording-btn-scroll-down");
  if (btnScrollUp && scrollContainer) {
    btnScrollUp.addEventListener("click", () => {
      scrollContainer.scrollTop = Math.max(0, scrollContainer.scrollTop - scrollStep);
    });
  }
  if (btnScrollDown && scrollContainer) {
    btnScrollDown.addEventListener("click", () => {
      scrollContainer.scrollTop = Math.min(
        scrollContainer.scrollHeight - scrollContainer.clientHeight,
        scrollContainer.scrollTop + scrollStep
      );
    });
  }
  const recordingTrigger = document.getElementById("recording-float-trigger");
  const recordingBar = document.getElementById("recording-float-bar");
  if (recordingTrigger && recordingBar) {
    recordingTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const expanded = recordingBar.classList.toggle("recording-float-bar--expanded");
      recordingBar.classList.toggle("recording-float-bar--collapsed", !expanded);
      recordingTrigger.textContent = expanded ? "×" : "⋯";
      recordingTrigger.setAttribute("aria-label", expanded ? "メニューを閉じる" : "メニューを表示");
      recordingTrigger.setAttribute("title", expanded ? "閉じる" : "メニュー");
    });
  }
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("pointer-active")) {
      exitPointerAndRecordingMode();
    }
  });

  // --- ブックマークボタン ---
  const btnBookmark = document.getElementById("btn-bookmark");
  if (btnBookmark) {
    btnBookmark.addEventListener("click", () => {
      if (currentPath) {
        const title = document.getElementById("prob-title-header")
          ? document.getElementById("prob-title-header").textContent || ""
          : currentPath.split("/").pop() || "";
        toggleBookmark(currentPath, title);
      }
    });
  }

  // --- メイン読み込み処理 ---
  if (directPath) {
    loadExplanationByPath(directPath);
  } else if (probId) {
    loadProblemById(probId, srcPath);
  } else {
    showError("問題が指定されていません。");
  }

  // --- 音声機能の初期化（一時的に無効化） ---
  // initAudioControls();
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

  const fileName = path.split("/").pop();
  updateTitle(fileName);
  updateBookmarkButton(path);

  const loader = showLoading("解説を読み込み中...");

  fetchWithRetry(path)
    .then((res) => {
      if (!res.ok) throw new Error("Explanation file not found: " + path);
      return res.text();
    })
    .then((html) => {
      renderExplanation(textTarget, html);

      const heading = textTarget.querySelector("h2, h3");
      if (heading) updateTitle(heading.textContent);
      updateBookmarkButton(path);
    })
    .catch((err) => {
      ErrorHandler.handle(err, "loadExplanationByPath");
      showError(
        "解説ファイルの読み込みに失敗しました。<br><span style=\"font-size:0.8em\">" +
          escapeHtml(path) +
          "</span>",
      );
    })
    .finally(() => hideLoading(loader));
}

/**
 * IDからJSONを検索して読み込む (Legacy)
 */
function loadProblemById(id, srcPath) {
  const fetchTarget = srcPath ? srcPath : "problems.json";
  const loader = showLoading("問題を検索しています...");

  fetchWithRetry(fetchTarget)
    .then((res) => {
      if (!res.ok) throw new Error("JSON load failed");
      return res.json();
    })
    .then((data) => {
      const problemsList = Array.isArray(data) ? data : [data];
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
        showError("問題ID \"" + escapeHtml(id) + "\" が見つかりません。");
      }
    })
    .catch((err) => {
      ErrorHandler.handle(err, "loadProblemById");
      showError("問題データの検索に失敗しました。");
    })
    .finally(() => hideLoading(loader));
}

/**
 * JSONデータが見つかった場合の適用処理
 */
function applyProblemData(target) {
  const textTarget = document.getElementById("text-target");
  if (!textTarget) return;

  updateTitle(target.title);
  if (target.explanationPath) updateBookmarkButton(target.explanationPath);

  if (target.explanationPath) {
    const loader = showLoading("解説を読み込み中...");
    fetchWithRetry(target.explanationPath)
      .then((res) => {
        if (!res.ok) throw new Error("Explanation file not found");
        return res.text();
      })
      .then((html) => {
        renderExplanation(textTarget, html);
        updateBookmarkButton(target.explanationPath);
      })
      .catch((err) => {
        ErrorHandler.handle(err, "applyProblemData");
        showError("解説ファイルの読み込みに失敗しました。");
      })
      .finally(() => hideLoading(loader));
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

/**
 * 録画モード用フロートバーの表示／非表示
 * @param {boolean} show
 */
function toggleRecordingFloatBar(show) {
  const bar = document.getElementById("recording-float-bar");
  const btnFullscreen = document.getElementById("recording-btn-fullscreen");
  const trigger = document.getElementById("recording-float-trigger");
  if (!bar) return;
  bar.setAttribute("aria-hidden", !show);
  if (show) {
    bar.classList.add("recording-float-bar--collapsed");
    bar.classList.remove("recording-float-bar--expanded");
    if (trigger) {
      trigger.textContent = "⋯";
      trigger.setAttribute("aria-label", "メニューを表示");
      trigger.setAttribute("title", "メニュー");
    }
  }
  if (btnFullscreen) {
    btnFullscreen.textContent = isRecordingFullscreen() ? "⛶ 全画面解除" : "⛶ 全画面";
    btnFullscreen.setAttribute("aria-label", isRecordingFullscreen() ? "全画面解除" : "全画面切替");
  }
}

/**
 * ポインターモード＋録画モードを終了（全画面も解除）
 */
function exitPointerAndRecordingMode() {
  document.body.classList.remove("pointer-active", "recording-fullscreen");
  const btnPointer = document.getElementById("btn-toggle-pointer");
  if (btnPointer) {
    btnPointer.classList.remove("active");
    btnPointer.innerHTML = "👆 操作モード";
  }
  if (pointerInstance) pointerInstance.clear();
  toggleRecordingFloatBar(false);
  exitFullscreen();
}

function isRecordingFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function exitFullscreen() {
  if (document.exitFullscreen) document.exitFullscreen();
  else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
}

function toggleRecordingFullscreen() {
  if (isRecordingFullscreen()) {
    document.body.classList.remove("recording-fullscreen");
    exitFullscreen();
    const btn = document.getElementById("recording-btn-fullscreen");
    if (btn) { btn.textContent = "⛶ 全画面"; btn.setAttribute("aria-label", "全画面切替"); }
  } else {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) {
      req.call(el).then(() => {
        document.body.classList.add("recording-fullscreen");
        const btn = document.getElementById("recording-btn-fullscreen");
        if (btn) { btn.textContent = "⛶ 全画面解除"; btn.setAttribute("aria-label", "全画面解除"); }
      }).catch(() => {});
    }
  }
}

function onFullscreenChange() {
  if (!isRecordingFullscreen()) {
    document.body.classList.remove("recording-fullscreen");
    const btn = document.getElementById("recording-btn-fullscreen");
    if (btn) { btn.textContent = "⛶ 全画面"; btn.setAttribute("aria-label", "全画面切替"); }
    return;
  }
  // ボタン以外で全画面が解除された場合、再度全画面にする（スクロール等で解除されないように）
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    if (document.body.classList.contains("recording-fullscreen")) {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        setTimeout(() => {
          req.call(el).catch(() => {});
        }, 50);
      }
    }
  }
}

function renderExplanation(container, html) {
  // 1. HTML挿入
  container.innerHTML = html;
  container.querySelectorAll("img").forEach((img) => {
    if (!img.hasAttribute("loading")) img.setAttribute("loading", "lazy");
  });

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

  // 6. ポインターキャンバスを解説の高さに合わせてリサイズ（スクロール連動用）
  if (pointerInstance && typeof pointerInstance.resize === "function") {
    requestAnimationFrame(() => pointerInstance.resize());
  }
}

function showError(msg) {
  const target = document.getElementById("text-target");
  if (target) {
    const safe = typeof msg === "string" ? escapeHtml(msg).replace(/\n/g, "<br>") : escapeHtml(String(msg));
    target.innerHTML = `<p style="padding:20px; color:#ef4444;">${safe}</p>`;
  }
}

/** ブックマーク: LocalStorage に { path, title }[] で保存 */
function getBookmarks() {
  try {
    const raw = localStorage.getItem("rikeich_bookmarks");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function toggleBookmark(path, title) {
  const list = getBookmarks();
  const idx = list.findIndex((b) => b.path === path);
  if (idx > -1) {
    list.splice(idx, 1);
    if (typeof showToast === "function") showToast("ブックマークを解除しました");
  } else {
    list.push({ path: path || currentPath, title: title || document.getElementById("prob-title-header")?.textContent || "" });
    if (typeof showToast === "function") showToast("ブックマークに追加しました");
  }
  localStorage.setItem("rikeich_bookmarks", JSON.stringify(list));
  updateBookmarkButton(path || currentPath);
}

function updateBookmarkButton(path) {
  const btn = document.getElementById("btn-bookmark");
  if (!btn) return;
  const list = getBookmarks();
  const isBookmarked = list.some((b) => b.path === path);
  btn.classList.toggle("bookmarked", isBookmarked);
  btn.textContent = isBookmarked ? "★ ブックマーク済み" : "☆ ブックマーク";
  btn.setAttribute("aria-label", isBookmarked ? "ブックマークを解除" : "ブックマークに追加");
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

/**
 * 音声コントロールの初期化
 */
function initAudioControls() {
  var generateBtn = document.getElementById('audio-generate-btn');
  var playBtn = document.getElementById('audio-play-btn');
  var pauseBtn = document.getElementById('audio-pause-btn');
  var stopBtn = document.getElementById('audio-stop-btn');
  var closeBtn = document.getElementById('audio-close-btn');
  var controlsPanel = document.getElementById('audio-controls-panel');
  var textTarget = document.getElementById('text-target');
  
  if (!textTarget) return;
  
  // 解説が読み込まれたら音声ボタンを表示
  var observer = new MutationObserver(function(mutations) {
    var hasCards = textTarget.querySelectorAll('.card').length > 0;
    if (generateBtn) {
      generateBtn.style.display = hasCards ? 'inline-block' : 'none';
    }
  });
  
  observer.observe(textTarget, { childList: true, subtree: true });
  
  // 初期状態を確認
  var hasCards = textTarget.querySelectorAll('.card').length > 0;
  if (generateBtn) {
    generateBtn.style.display = hasCards ? 'inline-block' : 'none';
  }
  
  // 音声生成ボタン
  if (generateBtn) {
    generateBtn.addEventListener('click', function() {
      // 強化されたテキストを取得（補足説明付き）
      var sections = enhanceExplanationForAudio(textTarget);
      if (sections.length === 0) {
        // フォールバック: 通常の抽出を試す
        sections = extractExplanationText(textTarget);
        if (sections.length === 0) {
          alert('読み上げる内容が見つかりませんでした');
          return;
        }
      }
      
      // コントロールパネルを表示
      if (controlsPanel) {
        controlsPanel.style.display = 'block';
      }
      
      // 音声プレーヤーを初期化
      audioPlayer = new ExplanationAudioPlayer(textTarget);
      audioPlayer.play(sections);
    });
  }
  
  // 再生ボタン
  if (playBtn) {
    playBtn.addEventListener('click', function() {
      if (audioPlayer) {
        audioPlayer.resume();
      }
    });
  }
  
  // 一時停止ボタン
  if (pauseBtn) {
    pauseBtn.addEventListener('click', function() {
      if (audioPlayer) {
        audioPlayer.pause();
      }
    });
  }
  
  // 停止ボタン
  if (stopBtn) {
    stopBtn.addEventListener('click', function() {
      if (audioPlayer) {
        audioPlayer.stop();
      }
    });
  }
  
  // 閉じるボタン
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      if (audioPlayer) {
        audioPlayer.stop();
      }
      if (controlsPanel) {
        controlsPanel.style.display = 'none';
      }
    });
  }
}