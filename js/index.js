/* js/index.js */

document.addEventListener("DOMContentLoaded", () => {
  // viewer.htmlから戻ってきた場合、スクロール位置を復元
  var savedScrollPosition = sessionStorage.getItem('indexScrollPosition');
  if (savedScrollPosition) {
    sessionStorage.removeItem('indexScrollPosition');
    setTimeout(function() {
      window.scrollTo(0, parseInt(savedScrollPosition, 10));
    }, 100);
  }
  
  const params = new URLSearchParams(window.location.search);
  const isTeacherMode = params.get("mode") === "teacher";

  const tabContainer = document.getElementById("tab-container");
  let subTabContainer = document.getElementById("sub-tab-container");
  if (!subTabContainer) {
    subTabContainer = document.createElement("nav");
    subTabContainer.id = "sub-tab-container";
    subTabContainer.className = "material-tabs";
    subTabContainer.setAttribute("aria-label", "サブメニュー");
    subTabContainer.style.cssText =
      "display:none; margin-top:-20px; margin-bottom:30px; transform: scale(0.95);";
    tabContainer.after(subTabContainer);
  }
  const contentArea = document.getElementById("content-area");

  if (isTeacherMode) {
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

  initQRCode();

  let manifest = [];
  const EXAM_TYPES = ["exam_year", "exam_univ"];

  function loadManifestAndInit() {
    return fetchWithRetry("data/manifest.json")
      .then((res) => res.json())
      .then((data) => {
        manifest = data;
        initTabs();
        if (manifest.length > 0) {
          const firstTab = tabContainer.querySelector(".tab-btn:not([data-is-exam])");
          if (firstTab) {
            firstTab.classList.add("active");
            firstTab.setAttribute("aria-current", "page");
          }
          loadMaterial(0);
        }
        // initSearch(); // 問題検索機能は一時無効
        initBookmarksSection();
      });
  }

  function showManifestErrorAndBindRetry() {
    contentArea.innerHTML =
      '<p class="empty-msg">教材リストの読み込みに失敗しました。</p>' +
      '<button type="button" class="btn-retry" id="retry-manifest">再試行</button>';
    const retryBtn = document.getElementById("retry-manifest");
    if (retryBtn) {
      retryBtn.onclick = function () {
        const l = showLoading("教材リストを読み込み中...");
        loadManifestAndInit()
          .catch((e) => {
            ErrorHandler.handle(e, "manifest");
            showManifestErrorAndBindRetry();
          })
          .finally(() => hideLoading(l));
      };
    }
  }

  const loader = showLoading("教材リストを読み込み中...");
  loadManifestAndInit()
    .catch((err) => {
      ErrorHandler.handle(err, "manifest");
      showManifestErrorAndBindRetry();
    })
    .finally(() => hideLoading(loader));

  function initTabs() {
    tabContainer.innerHTML = "";
    subTabContainer.innerHTML = "";

    // 1. 通常教材のタブ生成（その他を除く）
    manifest.forEach((mat, index) => {
      if (EXAM_TYPES.includes(mat.type)) return; // 入試系はスキップ
      if (mat.id === "other") return; // その他は後で入試過去問の右に配置
      createMainTab(mat.name, index);
    });

    // 2. 入試過去問タブの生成（入試系がある場合のみ）
    const hasExam = manifest.some((m) => EXAM_TYPES.includes(m.type));
    if (hasExam) {
      const btn = document.createElement("button");
      btn.className = "tab-btn";
      btn.textContent = "入試過去問";
      btn.dataset.isExam = "true";
      btn.onclick = () => showExamTabs(btn);
      tabContainer.appendChild(btn);
    }

    // 3. その他を入試過去問の右に配置
    const otherIndex = manifest.findIndex((m) => m.id === "other");
    if (otherIndex >= 0) {
      createMainTab(manifest[otherIndex].name, otherIndex);
    }
  }

  function createMainTab(name, index) {
    const btn = document.createElement("button");
    btn.className = "tab-btn";
    btn.type = "button";
    btn.textContent = name;
    btn.setAttribute("aria-label", name + "を選択");
    btn.onclick = () => {
      resetTabs();
      btn.classList.add("active");
      btn.setAttribute("aria-current", "page");
      subTabContainer.style.display = "none";
      loadMaterial(index);
    };
    tabContainer.appendChild(btn);
  }

  function showExamTabs(parentBtn) {
    resetTabs();
    parentBtn.classList.add("active");
    parentBtn.setAttribute("aria-current", "page");

    // サブタブの生成
    subTabContainer.innerHTML = "";
    subTabContainer.style.display = "flex";

    let firstExamIndex = -1;

    manifest.forEach((mat, index) => {
      if (!EXAM_TYPES.includes(mat.type)) return;
      if (firstExamIndex === -1) firstExamIndex = index;

      const subBtn = document.createElement("button");
      subBtn.className = "tab-btn";
      subBtn.type = "button";
      subBtn.style.fontSize = "0.95rem";
      subBtn.textContent = mat.name;
      subBtn.setAttribute("aria-label", mat.name + "を選択");
      subBtn.onclick = () => {
        Array.from(subTabContainer.children).forEach((b) => {
          b.classList.remove("active");
          b.removeAttribute("aria-current");
        });
        subBtn.classList.add("active");
        subBtn.setAttribute("aria-current", "page");
        loadMaterial(index);
      };
      subTabContainer.appendChild(subBtn);
    });

    // 最初の入試教材を自動ロード
    if (firstExamIndex !== -1 && subTabContainer.firstChild) {
      subTabContainer.firstChild.click();
    }
  }

  function resetTabs() {
    const tabs = document.querySelectorAll(".tab-btn");
    tabs.forEach((t) => {
      t.classList.remove("active");
      t.removeAttribute("aria-current");
    });
  }

  function loadMaterial(index) {
    const item = manifest[index];
    const jsonPath = item.path;
    const loadingEl = showLoading("教材を読み込み中...");
    contentArea.innerHTML = "";

    fetchWithRetry(jsonPath)
      .then((res) => res.json())
      .then((materialData) => {
        renderContent(materialData);
        // 問題検索は一時無効
        // if (document.getElementById("problem-search") && document.getElementById("problem-search").value.trim()) {
        //   filterProblems(document.getElementById("problem-search").value.trim());
        // }
      })
      .catch((err) => {
        ErrorHandler.handle(err, "loadMaterial");
        contentArea.innerHTML =
          '<p class="empty-msg">教材の読み込みに失敗しました。</p>' +
          '<button type="button" class="btn-retry" id="retry-material" data-index="' +
          index +
          '">再試行</button>';
        const retryBtn = document.getElementById("retry-material");
        if (retryBtn) {
          retryBtn.onclick = function () {
            loadMaterial(parseInt(retryBtn.getAttribute("data-index"), 10));
          };
        }
      })
      .finally(() => hideLoading(loadingEl));
  }

  function renderContent(material) {
    const esc = (s) => (s == null ? "" : escapeHtml(String(s)));
    const isTextbook = material.materialName === "物理基礎" || material.materialName === "物理" || material.materialName === "リードLight" || material.materialName === "リードα";
    let html = '<div class="subject-grid">';
    if (material.subjects) {
      material.subjects.forEach((subject) => {
        const hasFields = subject.fields && subject.fields.length > 0;
        if (!hasFields) return;

        html += '<div class="subject-card">';
        html += '<h3 class="subject-name">' + esc(subject.subjectName) + '</h3>';

        if (isTextbook) {
          // 編ごとにグループ化し、ボタン（summary）には章のみ表示
          var partGroups = {};
          var partOrder = [];
          subject.fields.forEach(function (field) {
            var name = field.fieldName || "";
            var slashIdx = name.indexOf(" / ");
            var partName = slashIdx >= 0 ? name.substring(0, slashIdx) : "";
            var chapterName = slashIdx >= 0 ? name.substring(slashIdx + 3) : name;
            if (!partGroups[partName]) {
              partGroups[partName] = [];
              if (partName) partOrder.push(partName);
            }
            partGroups[partName].push({ field: field, chapterName: chapterName });
          });
          if (partGroups[""] && partGroups[""].length) partOrder.push("");
          partOrder.forEach(function (partName) {
            var items = partGroups[partName];
            if (partName) html += '<h4 class="part-name">' + esc(partName) + '</h4>';
            html += '<ul class="field-list">';
            items.forEach(function (item) {
              var field = item.field;
              var problems = field.problems || [];
              var isEmpty = problems.length === 0;
              html += '<li class="field-item" data-empty="' + isEmpty + '">';
              html += '<details class="field-details">';
              html += '<summary class="field-summary"><span class="field-name">' + esc(item.chapterName) + '</span><span class="field-count">' + problems.length + '件</span></summary>';
              html += '<div class="field-body">';
              if (isEmpty) {
                html += '<p class="prob-empty">問題はまだ登録されていません</p>';
              } else {
                html += '<div class="prob-grid">';
                problems.forEach(function (p) {
                  // 非公開の問題は教員モード以外では表示しない
                  if (!isTeacherMode && p.isPublic === false) {
                    return;
                  }
                  var path = p.explanationPath || "";
                  var isPDF = /\.pdf$/i.test(path) || path.includes('pdfs/') || path.includes('\\pdfs\\');
                  var hasExplanation = path && !isPDF;
                  var hasYouTube = p.youtubeUrl && p.youtubeUrl.trim();
                  var title = esc(p.title);
                  
                  // 動画ありマーク
                  var videoMark = hasYouTube ? '<span class="prob-video-mark" title="動画解説あり">📹</span>' : '';
                  
                  if (isPDF || (!hasExplanation && !hasYouTube)) {
                    // PDFからの解説ページ、または解説も動画もない問題はグレーアウトして無効化
                    html += '<a href="#" class="prob-link prob-link-disabled" data-search-text="' + esc(path + " " + p.title) + '" onclick="return false;"><span>' + title + '</span>' + videoMark + '</a>';
                  } else if (!hasExplanation && hasYouTube) {
                    // 解説なし・動画ありの場合は動画のみ見られるようにボタンを有効化
                    var targetUrl = "viewer.html?path=" + encodeURIComponent(path || '') + (isTeacherMode ? "&admin=1" : "");
                    html += '<a href="' + targetUrl + '" class="prob-link prob-link-video-only" data-search-text="' + esc(path + " " + p.title) + '" data-youtube-url="' + esc(p.youtubeUrl) + '"><span>' + title + '</span>' + videoMark + '</a>';
                  } else {
                    // 通常の解説ページ
                    var targetUrl = "viewer.html?path=" + encodeURIComponent(p.explanationPath) + (isTeacherMode ? "&admin=1" : "");
                    html += '<a href="' + targetUrl + '" class="prob-link" data-search-text="' + esc(path + " " + p.title) + '"><span>' + title + '</span>' + videoMark + '</a>';
                  }
                });
                html += '</div>';
              }
              html += '</div></details></li>';
            });
            html += '</ul>';
          });
        } else {
          html += '<ul class="field-list">';
          subject.fields.forEach(function (field) {
            var problems = field.problems || [];
            var isEmpty = problems.length === 0;
            html += '<li class="field-item" data-empty="' + isEmpty + '">';
            html += '<details class="field-details">';
            html += '<summary class="field-summary"><span class="field-name">' + esc(field.fieldName) + '</span><span class="field-count">' + problems.length + '件</span></summary>';
            html += '<div class="field-body">';
            if (isEmpty) {
              html += '<p class="prob-empty">問題はまだ登録されていません</p>';
            } else {
              html += '<div class="prob-grid">';
              problems.forEach(function (p) {
                // 非公開の問題は教員モード以外では表示しない
                if (!isTeacherMode && p.isPublic === false) {
                  return;
                }
                var path = p.explanationPath || "";
                var isPDF = /\.pdf$/i.test(path) || path.includes('pdfs/') || path.includes('\\pdfs\\');
                var hasExplanation = path && !isPDF;
                var hasYouTube = p.youtubeUrl && p.youtubeUrl.trim();
                var title = esc(p.title);
                
                // 動画ありマーク
                var videoMark = hasYouTube ? '<span class="prob-video-mark" title="動画解説あり">📹</span>' : '';
                
                if (isPDF || (!hasExplanation && !hasYouTube)) {
                  // PDFからの解説ページ、または解説も動画もない問題はグレーアウトして無効化
                  html += '<a href="#" class="prob-link prob-link-disabled" data-search-text="' + esc(path + " " + p.title) + '" onclick="return false;"><span>' + title + '</span>' + videoMark + '</a>';
                } else if (!hasExplanation && hasYouTube) {
                  // 解説なし・動画ありの場合は動画のみ見られるようにボタンを有効化
                  var targetUrl = "viewer.html?path=" + encodeURIComponent(path || '') + (isTeacherMode ? "&admin=1" : "");
                  html += '<a href="' + targetUrl + '" class="prob-link prob-link-video-only" data-search-text="' + esc(path + " " + p.title) + '" data-youtube-url="' + esc(p.youtubeUrl) + '"><span>' + title + '</span>' + videoMark + '</a>';
                } else {
                  // 通常の解説ページ
                  var targetUrl = "viewer.html?path=" + encodeURIComponent(p.explanationPath) + (isTeacherMode ? "&admin=1" : "");
                  html += '<a href="' + targetUrl + '" class="prob-link" data-search-text="' + esc(path + " " + p.title) + '"><span>' + title + '</span>' + videoMark + '</a>';
                }
              });
              html += '</div>';
            }
            html += '</div></details></li>';
          });
          html += '</ul>';
        }
        html += '</div>';
      });
    }
    html += '</div>';
    contentArea.innerHTML = html;
  }

  // 問題検索機能は一時無効
  // function initSearch() {
  //   const searchInput = document.getElementById("problem-search");
  //   const clearBtn = document.getElementById("clear-search");
  //   if (!searchInput) return;
  //   searchInput.addEventListener("input", (e) => {
  //     const query = e.target.value.trim().toLowerCase();
  //     filterProblems(query);
  //     if (clearBtn) clearBtn.style.visibility = query ? "visible" : "hidden";
  //   });
  //   if (clearBtn) {
  //     clearBtn.style.visibility = searchInput.value.trim() ? "visible" : "hidden";
  //     clearBtn.addEventListener("click", () => {
  //       searchInput.value = "";
  //       searchInput.focus();
  //       filterProblems("");
  //       clearBtn.style.visibility = "hidden";
  //     });
  //   }
  // }

  // function filterProblems(query) {
  function _filterProblemsUnused(query) {
    const links = document.querySelectorAll("#content-area .prob-link");
    const lower = query.trim().toLowerCase();

    links.forEach((link) => {
      const searchText = (link.getAttribute("data-search-text") || link.textContent || "").toLowerCase();
      const match = !lower || searchText.includes(lower);
      link.style.display = match ? "" : "none";
      link.classList.toggle("prob-link-hidden", !match);
    });

    document.querySelectorAll("#content-area .field-item").forEach((field) => {
      const probLinks = field.querySelectorAll(".prob-link");
      const hasVisibleLink = probLinks.length > 0 && Array.from(probLinks).some((a) => a.style.display !== "none");
      const visible = !lower || hasVisibleLink;
      field.style.display = visible ? "" : "none";
      const details = field.querySelector(".field-details");
      if (details && lower && hasVisibleLink) details.setAttribute("open", "");
    });
    document.querySelectorAll("#content-area .subject-card").forEach((card) => {
      const visible = card.querySelectorAll(".field-item:not([style*='display: none'])").length > 0;
      card.style.display = visible ? "" : "none";
    });

    // 検索件数表示は一時無効
    // var countEl = document.getElementById("search-result-count");
    // if (countEl) {
    //   var visibleCount = 0;
    //   links.forEach(function (link) { if (link.style.display !== "none") visibleCount++; });
    //   countEl.textContent = lower ? visibleCount + " 件" : "";
    // }
  }

  function initBookmarksSection() {
    const section = document.getElementById("bookmarks");
    const list = document.getElementById("bookmarks-list");
    const linkToBookmarks = document.getElementById("link-to-bookmarks");
    if (!section || !list) return;

    function renderBookmarks() {
      const bookmarks = getBookmarksList();
      if (bookmarks.length === 0) {
        section.hidden = true;
        if (linkToBookmarks) linkToBookmarks.style.display = "none";
        return;
      }
      if (linkToBookmarks) linkToBookmarks.style.display = "";
      section.hidden = false;
      const adminSuffix = isTeacherMode ? "&admin=1" : "";
      list.innerHTML = bookmarks
        .map(
          (b) => {
            var isPDF = /\.pdf$/i.test(b.path) || b.path.includes('pdfs/') || b.path.includes('\\pdfs\\');
            if (isPDF) {
              return `<a href="#" class="prob-link prob-link-disabled" onclick="return false;">${escapeHtml(b.title)}</a>`;
            } else {
              return `<a href="viewer.html?path=${encodeURIComponent(b.path)}${adminSuffix}" class="prob-link">${escapeHtml(b.title)}</a>`;
            }
          }
        )
        .join("");
    }

    if (linkToBookmarks) {
      linkToBookmarks.addEventListener("click", (e) => {
        if (window.location.hash !== "#bookmarks") return;
        renderBookmarks();
      });
    }
    if (window.location.hash === "#bookmarks") {
      renderBookmarks();
      document.getElementById("bookmarks")?.scrollIntoView({ behavior: "smooth" });
    }
    window.addEventListener("hashchange", () => {
      if (window.location.hash === "#bookmarks") {
        renderBookmarks();
        document.getElementById("bookmarks")?.scrollIntoView({ behavior: "smooth" });
      }
    });
    renderBookmarks();
  }

  function initQRCode() {
    const qrTrigger = document.getElementById("qr-trigger");
    const qrModal = document.getElementById("qr-modal");
    if (!qrModal) return;
    
    const qrModalBackdrop = qrModal.querySelector(".qr-modal-backdrop");
    const qrModalClose = qrModal.querySelector(".qr-modal-close");
    const qrModalWrap = document.getElementById("qr-modal-canvas-wrap");
    const qrModalUrl = document.getElementById("qr-modal-url");

    function openQRModal() {
      if (!qrModalWrap) return;
      // ハッシュ（#bookmarksなど）を除いたURLを使用する
      const url = window.location.href.split('#')[0];
      
      qrModalWrap.innerHTML = "";
      let shown = false;
      
      // QRCodeライブラリが使える場合のフォールバック
      if (typeof QRCode !== "undefined") {
        try {
          new QRCode(qrModalWrap, {
            text: url,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
          });
          shown = !!(qrModalWrap.querySelector("canvas") || qrModalWrap.querySelector("table"));
        } catch (e) {}
      }
      
      if (!shown) {
        const img = document.createElement("img");
        img.alt = "QRコード";
        // APIを使用してQRコードを生成
        img.src = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(url);
        img.width = 200;
        img.height = 200;
        qrModalWrap.appendChild(img);
      }
      
      if (qrModalUrl) qrModalUrl.textContent = url;
      qrModal.classList.add("is-open");
      qrModal.setAttribute("aria-hidden", "false");
    }

    function closeQRModal() {
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
      if (e.key === "Escape" && qrModal.classList.contains("is-open")) {
        closeQRModal();
      }
    });
  }
  
  // viewer.htmlへのリンククリック時にスクロール位置を保存
  contentArea.addEventListener("click", function(e) {
    var link = e.target.closest("a.prob-link");
    if (link && link.href && link.href.indexOf("viewer.html") !== -1 && !link.classList.contains("prob-link-disabled")) {
      sessionStorage.setItem("indexScrollPosition", window.scrollY.toString());
      // viewer.htmlに遷移する前に現在のURLを保存
      sessionStorage.setItem("previousPageUrl", window.location.href);
    }
  });
});

function getBookmarksList() {
  const raw = localStorage.getItem("rikeich_bookmarks");
  let list = [];
  try {
    if (raw) list = JSON.parse(raw);
  } catch (e) {}
  return Array.isArray(list) ? list : [];
}