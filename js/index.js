/* js/index.js */

document.addEventListener("DOMContentLoaded", () => {
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
        initSearch();
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

    // 1. 通常教材のタブ生成
    manifest.forEach((mat, index) => {
      if (EXAM_TYPES.includes(mat.type)) return; // 入試系はスキップ
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
        const searchInput = document.getElementById("problem-search");
        if (searchInput && searchInput.value.trim()) {
          filterProblems(searchInput.value.trim());
        }
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
    let html = `<div class="subject-grid">`;
    if (material.subjects) {
      material.subjects.forEach((subject) => {
        const hasFields = subject.fields && subject.fields.length > 0;
        if (!hasFields) return;

        html += `<div class="subject-card">`;
        html += `<h3 class="subject-name">${esc(subject.subjectName)}</h3>`;
        html += `<ul class="field-list">`;

        subject.fields.forEach((field) => {
          const problems = field.problems || [];
          const isEmpty = problems.length === 0;
          html += `<li class="field-item" data-empty="${isEmpty}">`;
          html += `<details class="field-details">`;
          html += `<summary class="field-summary"><span class="field-name">${esc(field.fieldName)}</span><span class="field-count">${problems.length}件</span></summary>`;
          html += `<div class="field-body">`;
          if (isEmpty) {
            html += `<p class="prob-empty">問題はまだ登録されていません</p>`;
          } else {
            html += `<div class="prob-grid">`;
            problems.forEach((p) => {
              const targetUrl = `viewer.html?path=${encodeURIComponent(p.explanationPath)}${isTeacherMode ? "&admin=1" : ""}`;
              const title = esc(p.title);
              const path = p.explanationPath || "";
              html += `<a href="${targetUrl}" class="prob-link" target="_blank" data-search-text="${esc(path + " " + p.title)}"><span>${title}</span></a>`;
            });
            html += `</div>`;
          }
          html += `</div></details></li>`;
        });
        html += `</ul></div>`;
      });
    }
    html += `</div>`;
    contentArea.innerHTML = html;
  }

  function initSearch() {
    const searchInput = document.getElementById("problem-search");
    const clearBtn = document.getElementById("clear-search");
    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.trim().toLowerCase();
      filterProblems(query);
      if (clearBtn) clearBtn.style.visibility = query ? "visible" : "hidden";
    });

    if (clearBtn) {
      clearBtn.style.visibility = searchInput.value.trim() ? "visible" : "hidden";
      clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        searchInput.focus();
        filterProblems("");
        clearBtn.style.visibility = "hidden";
      });
    }
  }

  function filterProblems(query) {
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

    var countEl = document.getElementById("search-result-count");
    if (countEl) {
      var visibleCount = 0;
      links.forEach(function (link) {
        if (link.style.display !== "none") visibleCount++;
      });
      countEl.textContent = lower ? visibleCount + " 件" : "";
    }
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
          (b) =>
            `<a href="viewer.html?path=${encodeURIComponent(b.path)}${adminSuffix}" class="prob-link" target="_blank">${escapeHtml(b.title)}</a>`
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
});

function getBookmarksList() {
  const raw = localStorage.getItem("rikeich_bookmarks");
  let list = [];
  try {
    if (raw) list = JSON.parse(raw);
  } catch (e) {}
  return Array.isArray(list) ? list : [];
}