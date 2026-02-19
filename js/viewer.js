/* js/viewer.js */

// ポインターインスタンスを保持する変数
let pointerInstance = null;

// 現在の表示中の問題IDまたはパスを保持
let currentProbId = null;
let currentPath = null;

// 音声プレーヤーインスタンス
let audioPlayer = null;

document.addEventListener("DOMContentLoaded", () => {
  // 戻るボタン: 直前の位置に戻る
  const backLink = document.querySelector("a.btn-back-circle");
  if (backLink) {
    backLink.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // sessionStorageに保存された前のページのURLを確認
      var previousUrl = sessionStorage.getItem('previousPageUrl');
      
      // 履歴がある場合は戻る
      if (window.history.length > 1 && document.referrer && document.referrer !== window.location.href) {
        // 前のページのURLをsessionStorageに保存（次回の戻るボタン用）
        sessionStorage.setItem('previousPageUrl', document.referrer);
        window.history.back();
      } else if (previousUrl && previousUrl !== window.location.href) {
        // sessionStorageに保存されたURLがある場合はそこに戻る
        window.location.href = previousUrl;
      } else {
        // フォールバック: index.htmlへ
        const path = window.location.pathname || "";
        const indexPath = path.replace(/[^/]*$/, "index.html");
        window.location.href = indexPath || "index.html";
      }
    });
  }
  
  // ページ読み込み時に現在のURLをsessionStorageに保存（次回の戻るボタン用）
  if (document.referrer && document.referrer !== window.location.href) {
    sessionStorage.setItem('previousPageUrl', document.referrer);
  }
  
  // スクロール時にタイトル行を隠す（滑らかなアニメーション）
  var headerTop = document.querySelector('.prob-header-top');
  var headerTopRow = headerTop ? headerTop.querySelector('.header-top-row') : null;
  var scrollThreshold = 100; // 100pxスクロールしたらタイトルを隠す
  var isScrolled = false;
  var rafId = null;
  
  function handleScroll() {
    if (!headerTop || !headerTopRow) return;
    
    // 既にリクエスト中の場合はキャンセル
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    
    rafId = requestAnimationFrame(function() {
      var scrollY = window.scrollY || window.pageYOffset;
      var newIsScrolled = scrollY > scrollThreshold;
      
      // 状態が変わった場合のみクラスを更新
      if (newIsScrolled !== isScrolled) {
        isScrolled = newIsScrolled;
        if (isScrolled) {
          headerTop.classList.add('header-scrolled');
        } else {
          headerTop.classList.remove('header-scrolled');
        }
      }
      rafId = null;
    });
  }
  
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // 初期状態をチェック

  const params = new URLSearchParams(window.location.search);

  // 管理者画面: URL に admin=1 があるときのみ操作モードを表示（生徒画面では非表示）
  // 例: viewer.html?path=...&admin=1 で教員用・投影用で開く
  const isAdminMode = params.get("admin") === "1";
  if (!isAdminMode) {
    document.body.classList.add("viewer-student");
  }
  if (isAdminMode) {
    var footerInner = document.querySelector(".site-footer .site-footer-inner");
    if (footerInner && footerInner.firstChild) {
      var hubLink = document.createElement("a");
      hubLink.href = "hub.html";
      hubLink.textContent = "ハブ";
      var hubSep = document.createElement("span");
      hubSep.className = "site-footer-sep";
      hubSep.textContent = "|";
      footerInner.insertBefore(hubLink, footerInner.firstChild);
      footerInner.insertBefore(hubSep, hubLink.nextSibling);
    }
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

  // 操作モードで画面拡大時もタブバー・タブ切り替えボタンを常に同じサイズで表示するためズーム率をCSS変数へ
  function updateZoomScale() {
    var scale = window.visualViewport ? window.visualViewport.scale : 1;
    document.documentElement.style.setProperty("--zoom-scale", String(scale));
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", updateZoomScale);
    window.visualViewport.addEventListener("scroll", updateZoomScale);
  }
  updateZoomScale();

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
 * パスから問題データを検索する
 */
async function findProblemByPath(path) {
  try {
    // manifest.jsonを読み込む
    const manifestRes = await fetchWithRetry("data/manifest.json");
    const manifest = await manifestRes.json();
    
    // 各教材のJSONを読み込んで検索
    for (const material of manifest) {
      try {
        const materialRes = await fetchWithRetry(material.path);
        const materialData = await materialRes.json();
        
        if (!materialData.subjects) continue;
        
        for (const subject of materialData.subjects) {
          if (!subject.fields) continue;
          
          for (const field of subject.fields) {
            if (!field.problems) continue;
            
            const problem = field.problems.find(p => p.explanationPath === path);
            if (problem) {
              return problem;
            }
          }
        }
      } catch (e) {
        // 教材の読み込みに失敗した場合はスキップ
        console.warn("Failed to load material:", material.path, e);
      }
    }
    
    return null;
  } catch (e) {
    console.warn("Failed to search problem:", e);
    return null;
  }
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
  
  // 教員モードかどうかを確認
  const params = new URLSearchParams(window.location.search);
  const isAdminMode = params.get("admin") === "1";

  // 問題データを検索して公開設定を確認
  findProblemByPath(path)
    .then((problem) => {
      // 問題が見つかり、非公開で、かつ教員モードでない場合はアクセス拒否
      if (problem && problem.isPublic === false && !isAdminMode) {
        hideLoading(loader);
        showError(
          "この解説は非公開に設定されています。<br><span style=\"font-size:0.8em\">教員ページからアクセスしてください。</span>",
        );
        return;
      }
      
      // YouTube URLを保存
      if (problem && problem.youtubeUrl) {
        currentProblem = currentProblem || {};
        currentProblem.youtubeUrl = problem.youtubeUrl;
      }
      
      // 解説ページがない場合は動画のみ表示
      if (!path || path.trim() === '') {
        if (problem && problem.youtubeUrl) {
          hideLoading(loader);
          renderExplanation(textTarget, '', problem);
          if (problem.title) updateTitle(problem.title);
          return;
        } else {
          hideLoading(loader);
          showError("解説または動画が見つかりませんでした。");
          return;
        }
      }
      
      // 通常の読み込み処理
      return fetchWithRetry(path)
        .then((res) => {
          if (!res.ok) throw new Error("Explanation file not found: " + path);
          return res.text();
        })
        .then((html) => {
          return new Promise((resolve) => {
            whenReadyToRender(html, () => {
              renderExplanation(textTarget, html, problem);
              const heading = textTarget.querySelector("h2, h3");
              if (heading) updateTitle(heading.textContent);
              updateBookmarkButton(path);
              resolve();
            });
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

function renderExplanation(container, html, problem) {
  // 1. HTML挿入（直接innerHTMLで高速化、DocumentFragmentは不要）
  // 完全なHTMLドキュメントの場合は<div class="explanation-area">の中身だけを抽出
  var htmlContent = html.trim();
  if (htmlContent.match(/^\s*<!DOCTYPE\s+html/i) || htmlContent.match(/^\s*<html/i)) {
    // 完全なHTMLドキュメントの場合、<div class="explanation-area">の中身を抽出
    var explanationAreaMatch = htmlContent.match(/<div\s+class=["']explanation-area["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/body>/i);
    if (explanationAreaMatch && explanationAreaMatch[1]) {
      htmlContent = explanationAreaMatch[1].trim();
    } else {
      // <div class="explanation-area">が見つからない場合、<body>タグの中身を抽出
      var bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch && bodyMatch[1]) {
        htmlContent = bodyMatch[1].trim();
        // <div class="viewer-container">と<div class="explanation-area">のラッパーを除去
        htmlContent = htmlContent.replace(/^\s*<div\s+class=["']viewer-container["'][^>]*>\s*/i, '');
        htmlContent = htmlContent.replace(/^\s*<div\s+class=["']explanation-area["'][^>]*>\s*/i, '');
        htmlContent = htmlContent.replace(/\s*<\/div>\s*<\/div>\s*$/i, '');
        htmlContent = htmlContent.trim();
      } else {
        // <body>タグが見つからない場合、<html>タグの中身を抽出
        var htmlMatch = htmlContent.match(/<html[^>]*>([\s\S]*)<\/html>/i);
        if (htmlMatch && htmlMatch[1]) {
          // <head>タグを除去
          htmlContent = htmlMatch[1].replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '').trim();
        }
      }
    }
  }
  container.innerHTML = htmlContent;
  
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

  // 7. タブ機能の追加（カードごとにタブで切り替え、YouTube動画タブを追加、Pointタブは削除）
  setupCardTabs(container, problem);
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

/**
 * カードごとにタブで切り替えられるようにする
 * YouTube動画タブを最後に追加（動画URLがある場合）
 * Pointタブは削除（各設問内にPointを移動）
 *
 * 重要: DOM要素を移動しない。元のカード/Pointをそのまま残し、
 * display で表示/非表示を切り替える。
 * 非表示カード内のスクリプトは data-tab-deferred でマークし、
 * タブを開いた時に初めて実行する。これによりシミュレーションが
 * 正しいコンテナ幅で描画される。
 */
function setupCardTabs(container, problem) {
  var cards = Array.from(container.querySelectorAll('.card'));
  
  // .card の外にある直属の .box-alert は削除（Pointタブを廃止）
  var allAlerts = Array.from(container.querySelectorAll('.box-alert'));
  for (var i = 0; i < allAlerts.length; i++) {
    if (!allAlerts[i].closest('.card')) {
      // カード外のPointは削除
      allAlerts[i].remove();
    }
  }

  // YouTube動画タブを作成（動画URLがある場合）
  var youtubeTab = null;
  if (problem && problem.youtubeUrl && problem.youtubeUrl.trim()) {
    youtubeTab = createYouTubeTab(problem.youtubeUrl);
    container.appendChild(youtubeTab);
  }

  // タブが1つ以下の場合はタブ機能を有効化しない
  if (cards.length < 2 && !youtubeTab) return;

  // タブの対象要素一覧（カード + YouTube動画タブ）
  var items = cards.slice();
  if (youtubeTab) items.push(youtubeTab);

  // --- 遅延スクリプトの実行関数（先に定義） ---
  function executeDeferredScripts(item) {
    var scripts = item.querySelectorAll('script[data-tab-deferred]');
    if (scripts.length === 0) return;
    for (var i = 0; i < scripts.length; i++) {
      var oldScript = scripts[i];
      oldScript.removeAttribute('data-tab-deferred');
      var newScript = document.createElement('script');
      var attrs = oldScript.attributes;
      for (var j = 0; j < attrs.length; j++) {
        if (attrs[j].name !== 'data-executed' && attrs[j].name !== 'data-tab-deferred') {
          newScript.setAttribute(attrs[j].name, attrs[j].value);
        }
      }
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    }
  }

  // --- MathJax を処理（先に定義） ---
  function processMathInItem(item) {
    if (!item) return;
    
    // アイテムが表示されていることを確認
    var computedStyle = window.getComputedStyle(item);
    var isVisible = computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden' && item.offsetParent !== null;
    if (!isVisible) {
      // 非表示の場合は表示されるまで待機（最大5秒）
      var retryCount = 0;
      var maxRetries = 50;
      var checkVisible = function() {
        retryCount++;
        var style = window.getComputedStyle(item);
        var visible = style.display !== 'none' && style.visibility !== 'hidden' && item.offsetParent !== null;
        if (visible) {
          processMathInItem(item);
        } else if (retryCount < maxRetries) {
          setTimeout(checkVisible, 100);
        }
      };
      setTimeout(checkVisible, 100);
      return;
    }
    
    // MathJaxが読み込まれるまで待機（最大20回、2秒まで）
    var maxRetries = 20;
    var retryCount = 0;
    var checkAndProcess = function() {
      retryCount++;
      if (window.MathJax) {
        if (MathJax.typesetPromise) {
          // MathJax 3.x
          MathJax.typesetPromise([item]).then(function() {
            // 処理完了
          }).catch(function(err) {
            console.log('MathJax typeset error:', err);
            // エラーが発生しても再試行（最大3回）
            if (retryCount < maxRetries + 3) {
              setTimeout(function() {
                if (window.MathJax && MathJax.typesetPromise) {
                  MathJax.typesetPromise([item]).catch(function() {});
                }
              }, 500);
            }
          });
        } else if (MathJax.Hub) {
          // MathJax 2.x
          MathJax.Hub.Queue(['Typeset', MathJax.Hub, item]);
        }
      } else {
        // MathJaxがまだ読み込まれていない場合は待機（最大20回）
        if (retryCount < maxRetries) {
          setTimeout(checkAndProcess, 100);
        } else {
          // 最大試行回数に達した場合は、MathJaxの読み込みを強制的に試みる
          // viewer.htmlで定義されたloadMathJax関数を呼び出す
          if (typeof window.loadMathJax === 'function') {
            window.loadMathJax();
            setTimeout(checkAndProcess, 500);
          } else {
            // loadMathJaxが定義されていない場合は、直接スクリプトを読み込む
            var script = document.createElement('script');
            script.id = 'MathJax-script';
            script.async = true;
            script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
            script.onload = function() {
              setTimeout(checkAndProcess, 200);
            };
            document.head.appendChild(script);
          }
        }
      }
    };
    
    // レイアウト確定を待ってから処理
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        checkAndProcess();
      });
    });
  }

  // --- 非表示カードのスクリプトを遅延マーク ---
  // setupCardTabs は renderExplanation の最後に同期的に呼ばれ、
  // スクリプトの実行は requestIdleCallback で遅延されるため、
  // この時点ではまだスクリプトは実行されていない。
  items.forEach(function(item, index) {
    if (index > 0) {
      item.style.display = 'none';
      var scripts = item.querySelectorAll('script:not([data-executed])');
      for (var i = 0; i < scripts.length; i++) {
        scripts[i].setAttribute('data-tab-deferred', 'true');
        scripts[i].setAttribute('data-executed', 'true');
      }
    }
  });
  
  // 最初のタブのMathJaxを処理（表示されているので）
  // レイアウト確定を待ってから処理
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      setTimeout(function() {
        if (items.length > 0) {
          processMathInItem(items[0]);
        }
      }, 200);
    });
  });

  // --- タブバーを作成 ---
  var tabBar = document.createElement('div');
  tabBar.className = 'card-tabs-bar';
  tabBar.setAttribute('role', 'tablist');
  tabBar.setAttribute('aria-label', '解説セクション');

  // 戻るボタンを最初からタブの一番左に表示
  var tabBackBtn = document.createElement('button');
  tabBackBtn.className = 'compact-back-btn';
  tabBackBtn.innerHTML = '←';
  tabBackBtn.setAttribute('aria-label', '一覧に戻る');
  tabBackBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    var previousUrl = sessionStorage.getItem('previousPageUrl');
    if (window.history.length > 1 && document.referrer && document.referrer !== window.location.href) {
      sessionStorage.setItem('previousPageUrl', document.referrer);
      window.history.back();
    } else if (previousUrl && previousUrl !== window.location.href) {
      window.location.href = previousUrl;
    } else {
      var path = window.location.pathname || '';
      var indexPath = path.replace(/[^/]*$/, 'index.html');
      window.location.href = indexPath || 'index.html';
    }
  });
  tabBar.appendChild(tabBackBtn);

  var tabButtons = [];

  // MathJaxマークアップを除去または簡略化する関数
  function cleanMathForTabTitle(text) {
    if (!text) return text;
    
    // 数式内容を簡略化する内部関数（先に定義）
    function cleanMathContent(content) {
      if (!content) return '';
      // よく使われる記号を変換（長いコマンドを先に処理）
      content = content.replace(/\\leq\b/g, '≤').replace(/\\geq\b/g, '≥');
      content = content.replace(/\\ldots\b/g, '...').replace(/\\cdots\b/g, '...');
      content = content.replace(/\\times\b/g, '×').replace(/\\div\b/g, '÷');
      content = content.replace(/\\pm\b/g, '±').replace(/\\mp\b/g, '∓');
      content = content.replace(/\\neq\b/g, '≠');
      content = content.replace(/\\approx\b/g, '≈');
      content = content.replace(/\\sim\b/g, '∼');
      content = content.replace(/\\le\b/g, '≤').replace(/\\ge\b/g, '≥');
      content = content.replace(/\\lt\b/g, '<').replace(/\\gt\b/g, '>');
      content = content.replace(/\\cdot\b/g, '・');
      // 残りのバックスラッシュコマンドを除去
      content = content.replace(/\\[a-zA-Z]+\b/g, '');
      // 余分な空白を除去
      content = content.replace(/\s+/g, ' ').trim();
      return content;
    }
    
    // まず、不完全なMathJaxマークアップ（閉じていない$など）を処理
    // $で始まって閉じていない場合
    text = text.replace(/\$([^$]*)$/g, function(match, content) {
      var cleaned = cleanMathContent(content);
      return cleaned || '';
    });
    // $で終わっているが開始がない場合（通常はないが念のため）
    text = text.replace(/^([^$]*)\$/g, function(match, content) {
      var cleaned = cleanMathContent(content);
      return cleaned || '';
    });
    
    // MathJaxのインライン数式マークアップを除去（括弧は追加しない）
    text = text.replace(/\$([^$]*)\$/g, function(match, content) {
      var cleaned = cleanMathContent(content);
      return cleaned || '';
    });
    
    // \(...\)形式も処理（括弧は追加しない）
    text = text.replace(/\\\(([^\)]*)\\\)/g, function(match, content) {
      var cleaned = cleanMathContent(content);
      return cleaned || '';
    });
    // 閉じていない\(...\)も処理
    text = text.replace(/\\\(([^\)]*)$/g, function(match, content) {
      var cleaned = cleanMathContent(content);
      return cleaned || '';
    });
    
    // \[...\]形式も処理（ブロック数式は除去）
    text = text.replace(/\\\[[\s\S]*?\\\]/g, '');
    text = text.replace(/\\\[[\s\S]*$/g, '');
    
    // 残りのバックスラッシュコマンドを除去（不完全なものも含む）
    text = text.replace(/\\[a-zA-Z]+\b/g, '');
    text = text.replace(/\\[^a-zA-Z]/g, ''); // 不完全なバックスラッシュも除去
    
    // 余分な空白を整理（連続する空白や、括弧の前後の空白を整理）
    text = text.replace(/\s+/g, ' ');
    // 全角括弧の前後の空白を除去
    text = text.replace(/\s*（\s*/g, '（').replace(/\s*）\s*/g, '）');
    // 半角括弧の前後の空白を除去
    text = text.replace(/\s*\(\s*/g, '(').replace(/\s*\)\s*/g, ')');
    text = text.trim();
    
    return text;
  }

  items.forEach(function(item, index) {
    var isYouTube = item === youtubeTab;
    var btn = document.createElement('button');
    btn.className = 'card-tab-btn' + (isYouTube ? ' card-tab-btn-youtube' : '');
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', index === 0 ? 'true' : 'false');

    var heading = item.querySelector('h3');
    var label = isYouTube ? '📹 動画' : (heading ? heading.textContent.trim() : 'セクション ' + (index + 1));
    // MathJaxマークアップを除去
    label = cleanMathForTabTitle(label);
    if (label.length > 20) label = label.substring(0, 17) + '...';
    btn.textContent = label;

    if (index === 0) btn.classList.add('active');

    btn.addEventListener('click', function() { switchTab(index); });
    tabButtons.push(btn);
    tabBar.appendChild(btn);
  });

  // 固定バー（prob-header-top）内にタブバーを挿入
  var headerTop = document.querySelector('.prob-header-top');
  if (headerTop) {
    // header-top-rowの後にタブバーを挿入
    var headerTopRow = headerTop.querySelector('.header-top-row');
    if (headerTopRow && headerTopRow.nextSibling) {
      headerTop.insertBefore(tabBar, headerTopRow.nextSibling);
    } else {
      headerTop.appendChild(tabBar);
    }
    
  } else {
    // フォールバック：タイトルの直後にタブバーを挿入
    var title = container.querySelector('.prob-title-sub');
    if (title && title.nextSibling) {
      container.insertBefore(tabBar, title.nextSibling);
    } else if (title) {
      container.insertBefore(tabBar, items[0]);
    } else {
      container.insertBefore(tabBar, container.firstChild);
    }
  }
  
  // ページ上部のタイトル（prob-title-sub）を非表示にする
  var title = container.querySelector('.prob-title-sub');
  if (title) {
    title.style.display = 'none';
  }

  // --- タブ切り替え ---
  var currentTabIndex = 0;
  var tabNavPrevBtn = null;
  var tabNavNextBtn = null;

  function switchTab(index) {
    // すべて非表示
    tabButtons.forEach(function(btn) {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
    });
    items.forEach(function(item) {
      item.style.display = 'none';
    });

    // 選択タブを表示
    tabButtons[index].classList.add('active');
    tabButtons[index].setAttribute('aria-selected', 'true');
    items[index].style.display = '';
    currentTabIndex = index;

    // 固定タブ移動ボタンの有効/無効を更新
    if (tabNavPrevBtn) tabNavPrevBtn.disabled = index <= 0;
    if (tabNavNextBtn) tabNavNextBtn.disabled = index >= tabButtons.length - 1;

    // 遅延スクリプトの実行（初回のみ）+ MathJax
    // 表示状態を確実にするため、少し待ってから処理
    setTimeout(function() {
      executeDeferredScripts(items[index]);
      
      // アイテムが表示されたことを確認してからMathJaxを処理
      // レイアウト確定を待つ
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          // DOMの更新とレイアウト確定を確実に待つ
          setTimeout(function() {
            // 再度表示状態を確認
            if (items[index].style.display !== 'none' && items[index].offsetParent !== null) {
              processMathInItem(items[index]);
            } else {
              // まだ表示されていない場合は再試行
              setTimeout(function() {
                processMathInItem(items[index]);
              }, 200);
            }
          }, 150);
        });
      });
      
      // シミュレーションが window.resize を監視してリサイズする場合用
      setTimeout(function() {
        window.dispatchEvent(new Event('resize'));
      }, 300);
    }, 100);

    // タブバーが固定バー内にある場合はスクロール位置調整不要
  }

  // 解説画面下・左右に固定のタブ移動ボタン（複数タブ時のみ表示）
  var existingTabNav = document.querySelector('.explanation-tab-nav');
  if (existingTabNav) existingTabNav.remove();
  if (tabButtons.length > 1) {
    var tabNav = document.createElement('div');
    tabNav.className = 'explanation-tab-nav is-visible';
    tabNav.setAttribute('aria-label', 'タブ移動');
    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'tab-nav-btn';
    prevBtn.setAttribute('aria-label', '前のタブ');
    prevBtn.innerHTML = '‹';
    prevBtn.disabled = true;
    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'tab-nav-btn';
    nextBtn.setAttribute('aria-label', '次のタブ');
    nextBtn.innerHTML = '›';
    nextBtn.disabled = false;
    prevBtn.addEventListener('click', function() { switchTab(currentTabIndex - 1); });
    nextBtn.addEventListener('click', function() { switchTab(currentTabIndex + 1); });
    tabNav.appendChild(prevBtn);
    tabNav.appendChild(nextBtn);
    document.body.appendChild(tabNav);
    tabNavPrevBtn = prevBtn;
    tabNavNextBtn = nextBtn;
  }
}

/**
 * YouTube動画タブを作成
 */
function createYouTubeTab(youtubeUrl) {
  var card = document.createElement('div');
  card.className = 'card youtube-tab';
  
  var heading = document.createElement('h3');
  heading.textContent = 'YouTube解説動画';
  card.appendChild(heading);
  
  var embedContainer = document.createElement('div');
  embedContainer.className = 'youtube-embed-container';
  embedContainer.style.cssText = 'position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 20px 0;';
  
  // YouTube URLから動画IDを抽出
  var videoId = extractYouTubeVideoId(youtubeUrl);
  if (videoId) {
    var iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube.com/embed/' + videoId;
    iframe.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;';
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('loading', 'lazy');
    embedContainer.appendChild(iframe);
  } else {
    // URLが無効な場合はリンクを表示
    var link = document.createElement('a');
    link.href = youtubeUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'YouTube動画を開く';
    link.style.cssText = 'display: inline-block; padding: 12px 24px; background: #ff0000; color: #fff; border-radius: 8px; text-decoration: none; margin: 20px 0;';
    embedContainer.appendChild(link);
  }
  
  card.appendChild(embedContainer);
  return card;
}

/**
 * YouTube URLから動画IDを抽出
 */
function extractYouTubeVideoId(url) {
  if (!url) return null;
  
  // 様々なYouTube URL形式に対応
  var patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];
  
  for (var i = 0; i < patterns.length; i++) {
    var match = url.match(patterns[i]);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}