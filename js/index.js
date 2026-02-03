/* js/index.js */

document.addEventListener("DOMContentLoaded", () => {
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

  let manifest = [];
  const EXAM_TYPES = ["exam_year", "exam_univ"];

  const loader = showLoading("教材リストを読み込み中...");
  fetchWithRetry("data/manifest.json")
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
    })
    .catch((err) => {
      ErrorHandler.handle(err, "manifest");
      contentArea.innerHTML = '<p class="empty-msg">教材リストの読み込みに失敗しました。</p>';
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
        contentArea.innerHTML = '<p class="empty-msg">教材の読み込みに失敗しました。</p>';
      })
      .finally(() => hideLoading(loadingEl));
  }

  function renderContent(material) {
    const esc = (s) => (s == null ? "" : escapeHtml(String(s)));
    let html = `<div class="subject-grid">`;
    if (material.subjects) {
      material.subjects.forEach((subject) => {
        const hasProblems =
          subject.fields &&
          subject.fields.some((f) => f.problems && f.problems.length > 0);

        if (hasProblems) {
          html += `<div class="subject-card">`;
          html += `<h3 class="subject-name">${esc(subject.subjectName)}</h3>`;
          html += `<ul class="field-list">`;

          subject.fields.forEach((field) => {
            if (field.problems && field.problems.length > 0) {
              html += `<li class="field-item">`;
              html += `<span class="field-name">${esc(field.fieldName)}</span>`;
              html += `<div class="prob-grid">`;
              field.problems.forEach((p) => {
                const targetUrl = `viewer.html?path=${encodeURIComponent(p.explanationPath)}`;
                const title = esc(p.title);
                const path = p.explanationPath || "";
                html += `<a href="${targetUrl}" class="prob-link" target="_blank" data-search-text="${esc(path + " " + p.title)}"><span>${title}</span></a>`;
              });
              html += `</div></li>`;
            }
          });
          html += `</ul></div>`;
        }
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
    const lower = query.toLowerCase();

    links.forEach((link) => {
      const searchText = (link.getAttribute("data-search-text") || link.textContent || "").toLowerCase();
      const match = !lower || searchText.includes(lower);
      link.style.display = match ? "" : "none";
      link.classList.toggle("prob-link-hidden", !match);
    });

    document.querySelectorAll("#content-area .field-item").forEach((field) => {
      const visible = field.querySelectorAll(".prob-link:not([style*='display: none'])").length > 0;
      field.style.display = visible ? "" : "none";
    });
    document.querySelectorAll("#content-area .subject-card").forEach((card) => {
      const visible = card.querySelectorAll(".field-item:not([style*='display: none'])").length > 0;
      card.style.display = visible ? "" : "none";
    });
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
      list.innerHTML = bookmarks
        .map(
          (b) =>
            `<a href="viewer.html?path=${encodeURIComponent(b.path)}" class="prob-link" target="_blank">${escapeHtml(b.title)}</a>`
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
});

function getBookmarksList() {
  const raw = localStorage.getItem("rikeich_bookmarks");
  let list = [];
  try {
    if (raw) list = JSON.parse(raw);
  } catch (e) {}
  return Array.isArray(list) ? list : [];
}