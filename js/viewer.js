/* js/viewer.js */

// ポインターインスタンスを保持する変数
let pointerInstance = null;

// 現在の表示中の問題IDまたはパスを保持
let currentProbId = null;
let currentPath = null;

// 音声プレーヤーインスタンス
let audioPlayer = null;

document.addEventListener("DOMContentLoaded", () => {
  // 戻るボタン: 常に index.html へ正しく遷移するよう href を現在のパスから算出
  const backLink = document.querySelector("a.btn-back-circle");
  if (backLink) {
    const path = window.location.pathname || "";
    const indexPath = path.replace(/[^/]*$/, "index.html");
    backLink.setAttribute("href", indexPath || "index.html");
  }

  const params = new URLSearchParams(window.location.search);

  // 管理者画面: URL に admin=1 があるときのみ操作モードを表示（生徒画面では非表示）
  // 例: viewer.html?path=...&admin=1 で教員用・投影用で開く
  const isAdminMode = params.get("admin") === "1";
  if (!isAdminMode) {
    document.body.classList.add("viewer-student");
  }

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

  if (btnPointer && isAdminMode) {
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

  // 操作モード用フロートバー：終了ボタンのみ
  const btnExit = document.getElementById("recording-btn-exit");
  if (btnExit) {
    btnExit.addEventListener("click", () => exitPointerAndRecordingMode());
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

  // --- QRコード表示（ブックマークの左・押すと拡大表示） ---
  const qrTrigger = document.getElementById("qr-trigger");
  const qrModal = document.getElementById("qr-modal");
  const qrModalBackdrop = qrModal && qrModal.querySelector(".qr-modal-backdrop");
  const qrModalClose = qrModal && qrModal.querySelector(".qr-modal-close");
  const qrModalWrap = document.getElementById("qr-modal-canvas-wrap");
  const qrModalUrl = document.getElementById("qr-modal-url");

  function loadQrcodeLib() {
    if (typeof QRCode !== "undefined") return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function openQRModal() {
    if (!qrModal || !qrModalWrap) return;
    const url = window.location.href;
    qrModalWrap.innerHTML = "";
    loadQrcodeLib().then(function () {
      var shown = false;
      try {
        if (typeof QRCode !== "undefined") {
          new QRCode(qrModalWrap, {
            text: url,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
          });
          shown = qrModalWrap.querySelector("canvas") || qrModalWrap.querySelector("table");
        }
      } catch (e) {}
      if (!shown) {
        var img = document.createElement("img");
        img.alt = "QRコード";
        img.src = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(url);
        img.width = 200;
        img.height = 200;
        qrModalWrap.appendChild(img);
      }
      if (qrModalUrl) qrModalUrl.textContent = url;
      qrModal.classList.add("is-open");
      qrModal.setAttribute("aria-hidden", "false");
    }).catch(function () {
      var img = document.createElement("img");
      img.alt = "QRコード";
      img.src = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(url);
      img.width = 200;
      img.height = 200;
      qrModalWrap.appendChild(img);
      if (qrModalUrl) qrModalUrl.textContent = url;
      qrModal.classList.add("is-open");
      qrModal.setAttribute("aria-hidden", "false");
    });
  }

  function closeQRModal() {
    if (!qrModal) return;
    qrModal.classList.remove("is-open");
    qrModal.setAttribute("aria-hidden", "true");
  }

  if (qrTrigger) {
    qrTrigger.addEventListener("click", openQRModal);
  }
  if (qrModalBackdrop) {
    qrModalBackdrop.addEventListener("click", closeQRModal);
  }
  if (qrModalClose) {
    qrModalClose.addEventListener("click", closeQRModal);
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && qrModal && qrModal.classList.contains("is-open")) {
      closeQRModal();
    }
  });

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

/** シミュレーション用ライブラリを必要時のみ遅延読み込み */
var simLibsLoaded = false;
function loadSimLibs() {
  if (simLibsLoaded) return Promise.resolve();
  var base = "https://cdn.jsdelivr.net/npm";
  var baseCjs = "https://cdnjs.cloudflare.com/ajax/libs";
  var loads = [];

  function loadCss(href) {
    return new Promise(function (resolve) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = resolve;
      link.onerror = resolve;
      document.head.appendChild(link);
    });
  }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) {
        resolve();
        return;
      }
      var script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  loads.push(loadCss(base + "/jsxgraph/distrib/jsxgraph.css"));
  loads.push(loadScript(baseCjs + "/p5.js/1.4.2/p5.min.js"));
  loads.push(loadScript(baseCjs + "/three.js/r128/three.min.js"));
  loads.push(loadScript(base + "/three@0.128.0/examples/js/controls/OrbitControls.js"));
  loads.push(loadScript(base + "/chart.js"));
  loads.push(loadScript(baseCjs + "/matter-js/0.19.0/matter.min.js"));
  loads.push(loadScript(base + "/jsxgraph/distrib/jsxgraphcore.js"));
  return Promise.all(loads).then(function () {
    return loadScript("js/sim-utils.js");
  }).then(function () {
    simLibsLoaded = true;
  });
}

/** 解説HTMLに sim-embed が含まれるときのみシミュレーション用ライブラリを読み込んでから描画 */
function whenReadyToRender(html, done) {
  if (/sim-embed|SimUtils|createCanvas|THREE\.|Chart\.|Matter\.|JXG\./.test(html)) {
    loadSimLibs().then(done).catch(done);
  } else {
    done();
  }
}

/** Firebase はリアクションUI設置時に遅延読み込み・初期化 */
var firebaseReady = null;
function ensureFirebase() {
  if (window.db) return Promise.resolve();
  if (firebaseReady) return firebaseReady;
  var c = window.firebaseConfig;
  if (!c || !c.apiKey || c.apiKey === "YOUR_API_KEY") {
    firebaseReady = Promise.resolve();
    return firebaseReady;
  }
  firebaseReady = new Promise(function (resolve, reject) {
    function loadScript(src) {
      return new Promise(function (res, rej) {
        var s = document.createElement("script");
        s.src = src;
        s.onload = res;
        s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    loadScript("https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js")
      .then(function () {
        return loadScript("https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js");
      })
      .then(function () {
        firebase.initializeApp(c);
        window.db = firebase.firestore();
        window.collection = function (db, name) { return db.collection(name); };
        window.doc = function (db, col, id) { return db.collection(col).doc(id); };
        window.setDoc = function (docRef, data, opt) { return docRef.set(data, opt); };
        resolve();
      })
      .catch(reject);
  });
  return firebaseReady;
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
      return new Promise((resolve) => {
        whenReadyToRender(html, () => {
          renderExplanation(textTarget, html);
          const heading = textTarget.querySelector("h2, h3");
          if (heading) updateTitle(heading.textContent);
          updateBookmarkButton(path);
          resolve();
        });
      });
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
        return new Promise((resolve) => {
          whenReadyToRender(html, () => {
            renderExplanation(textTarget, html);
            updateBookmarkButton(target.explanationPath);
            resolve();
          });
        });
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
  if (!bar) return;
  bar.setAttribute("aria-hidden", !show);
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
  // 1. HTML挿入（直接innerHTMLで高速化、DocumentFragmentは不要）
  container.innerHTML = html;
  
  // 画像の遅延読み込み（requestIdleCallbackで遅延）
  var scheduleImg = window.requestIdleCallback || function(cb) {
    return setTimeout(cb, 50);
  };
  scheduleImg(function() {
    var images = container.querySelectorAll("img");
    for (var i = 0; i < images.length; i++) {
      if (!images[i].hasAttribute("loading")) {
        images[i].setAttribute("loading", "lazy");
      }
    }
  }, { timeout: 200 });

  // 2. MathJaxのチャンク処理（MathJax読み込み完了後に処理）
  var mathChunks = [];
  var cards = container.querySelectorAll('.card');
  for (var i = 0; i < cards.length; i++) {
    mathChunks.push(cards[i]);
  }
  
  var processMath = function(card) {
    if (!window.MathJax) return;
    if (MathJax.typesetPromise) {
      MathJax.typesetPromise([card]).catch(function(e) {
        console.log(e);
      });
    } else if (MathJax.Hub) {
      MathJax.Hub.Queue(["Typeset", MathJax.Hub, card]);
    }
  };
  
  var mathObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var card = entry.target;
        mathObserver.unobserve(card);
        
        // MathJaxが読み込まれるまで待機
        var checkAndProcess = function() {
          if (window.MathJax && (MathJax.typesetPromise || MathJax.Hub)) {
            var schedule = window.requestIdleCallback || function(cb) {
              return setTimeout(cb, 200);
            };
            schedule(function() {
              processMath(card);
            }, { timeout: 500 });
          } else {
            setTimeout(checkAndProcess, 100);
          }
        };
        checkAndProcess();
      }
    });
  }, { rootMargin: "100px" });
  
  // MathJax読み込み完了時のコールバック
  window.onMathJaxLoaded = function() {
    // 最初に見える範囲のみ処理（大幅に遅延）
    var schedule = window.requestIdleCallback || function(cb) {
      return setTimeout(cb, 500);
    };
    schedule(function() {
      if (mathChunks[0]) {
        processMath(mathChunks[0]);
      }
    }, { timeout: 1000 });
  };
  
  // 残りはObserverで監視
  for (var i = 1; i < mathChunks.length; i++) {
    mathObserver.observe(mathChunks[i]);
  }
  
  // MathJaxが既に読み込まれている場合
  if (window.MathJax && (MathJax.typesetPromise || MathJax.Hub)) {
    window.onMathJaxLoaded();
  }

  // 3. 埋め込みスクリプトの実行（大幅に遅延、見える範囲のみ）
  var scriptObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var scripts = entry.target.querySelectorAll("script:not([data-executed])");
        var schedule = window.requestIdleCallback || function(cb) {
          return setTimeout(cb, 200);
        };
        schedule(function() {
          for (var i = 0; i < scripts.length; i++) {
            var oldScript = scripts[i];
            oldScript.setAttribute("data-executed", "true");
            var newScript = document.createElement("script");
            var attrs = oldScript.attributes;
            for (var j = 0; j < attrs.length; j++) {
              if (attrs[j].name !== "data-executed") {
                newScript.setAttribute(attrs[j].name, attrs[j].value);
              }
            }
            newScript.textContent = oldScript.textContent;
            oldScript.parentNode.replaceChild(newScript, oldScript);
          }
        }, { timeout: 500 });
        scriptObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: "200px" });
  
  // 最初に見える範囲のスクリプトも遅延実行
  var scheduleFirst = window.requestIdleCallback || function(cb) {
    return setTimeout(cb, 300);
  };
  scheduleFirst(function() {
    var visibleScripts = container.querySelectorAll("script:not([data-lazy-init]):not([data-executed])");
    for (var i = 0; i < visibleScripts.length; i++) {
      var oldScript = visibleScripts[i];
      oldScript.setAttribute("data-executed", "true");
      var newScript = document.createElement("script");
      var attrs = oldScript.attributes;
      for (var j = 0; j < attrs.length; j++) {
        if (attrs[j].name !== "data-executed") {
          newScript.setAttribute(attrs[j].name, attrs[j].value);
        }
      }
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    }
  }, { timeout: 500 });
  
  // 遅延初期化が必要なスクリプトはObserverで監視
  var lazyScripts = container.querySelectorAll("[data-lazy-init]");
  for (var i = 0; i < lazyScripts.length; i++) {
    scriptObserver.observe(lazyScripts[i]);
  }

  // 4. リアクション機能の注入（大幅に遅延実行、スクロール時のみ）
  var reactionsScheduled = false;
  var scheduleReactions = function() {
    if (reactionsScheduled) return;
    reactionsScheduled = true;
    var schedule = window.requestIdleCallback || function(cb) {
      return setTimeout(cb, 1000);
    };
    schedule(function() {
      setupCardReactions(container);
    }, { timeout: 2000 });
  };
  
  // スクロール時または一定時間後に実行
  var scrollHandler = function() {
    scheduleReactions();
    window.removeEventListener('scroll', scrollHandler);
  };
  window.addEventListener('scroll', scrollHandler, { once: true, passive: true });
  setTimeout(scheduleReactions, 3000);

  // 5. Observer更新 (目次等の追従用)
  if (window.updateObserver) {
    setTimeout(window.updateObserver, 100);
  }

  // 6. ポインターキャンバスを解説の高さに合わせてリサイズ（スクロール連動用）
  if (pointerInstance && typeof pointerInstance.resize === "function") {
    requestAnimationFrame(function() {
      pointerInstance.resize();
    });
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

// executeInlineScriptsはrenderExplanation内で直接処理するため削除

/**
 * 各カード(.card)にリアクションボタンとメモ欄を追加し、
 * LocalStorageおよびクラウド保存のロジックを紐付ける
 */
function setupCardReactions(container) {
  const cards = container.querySelectorAll(".card");
  if (cards.length === 0) return;
  ensureFirebase().then(function () {
    setupCardReactionsInner(container, cards);
  });
}

function setupCardReactionsInner(container, cards) {
  let contentId = currentProbId;
  if (!contentId && currentPath) {
     const basename = currentPath.split('/').pop();
     contentId = basename.replace(/\.[^/.]+$/, "");
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