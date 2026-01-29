/* js/index.js */

document.addEventListener("DOMContentLoaded", () => {
  const tabContainer = document.getElementById("tab-container");
  // サブタブ用のコンテナを追加
  let subTabContainer = document.getElementById("sub-tab-container");
  if (!subTabContainer) {
    subTabContainer = document.createElement("div");
    subTabContainer.id = "sub-tab-container";
    subTabContainer.className = "material-tabs";
    subTabContainer.style.cssText =
      "display:none; margin-top:-20px; margin-bottom:30px; transform: scale(0.95);";
    tabContainer.after(subTabContainer);
  }
  const contentArea = document.getElementById("content-area");

  let manifest = [];
  // 入試カテゴリの定義
  const EXAM_TYPES = ["exam_year", "exam_univ"];

  fetch("data/manifest.json")
    .then((res) => res.json())
    .then((data) => {
      manifest = data;
      initTabs();
      if (manifest.length > 0) loadMaterial(0);
    })
    .catch((err) => console.error(err));

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
    btn.textContent = name;
    btn.onclick = () => {
      resetTabs();
      btn.classList.add("active");
      subTabContainer.style.display = "none"; // サブタブ隠す
      loadMaterial(index);
    };
    tabContainer.appendChild(btn);
  }

  function showExamTabs(parentBtn) {
    resetTabs();
    parentBtn.classList.add("active");

    // サブタブの生成
    subTabContainer.innerHTML = "";
    subTabContainer.style.display = "flex";

    let firstExamIndex = -1;

    manifest.forEach((mat, index) => {
      if (!EXAM_TYPES.includes(mat.type)) return;
      if (firstExamIndex === -1) firstExamIndex = index;

      const subBtn = document.createElement("button");
      subBtn.className = "tab-btn";
      subBtn.style.fontSize = "0.95rem"; // 少し小さく
      subBtn.textContent = mat.name;
      subBtn.onclick = () => {
        // サブタブのアクティブ切り替え
        Array.from(subTabContainer.children).forEach((b) =>
          b.classList.remove("active"),
        );
        subBtn.classList.add("active");
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
    tabs.forEach((t) => t.classList.remove("active"));
  }

  // loadMaterial, renderContent は既存のまま
  function loadMaterial(index) {
    // (既存のコードと同じ)
    const item = manifest[index];
    const jsonPath = item.path;
    contentArea.innerHTML =
      '<div style="text-align:center; padding:40px; color:#666;">読み込み中...</div>';

    fetch(jsonPath)
      .then((res) => res.json())
      .then((materialData) => renderContent(materialData))
      .catch((err) => {
        console.error(err);
        contentArea.innerHTML = `<p style="text-align:center; color:red;">読み込み失敗</p>`;
      });
  }

  function renderContent(material) {
    let html = `<div class="subject-grid">`;
    if (material.subjects) {
      material.subjects.forEach((subject) => {
        // 科目(Subject)ごとにカードを作成
        // Subject内に問題があるかチェック
        const hasProblems =
          subject.fields &&
          subject.fields.some((f) => f.problems && f.problems.length > 0);

        if (hasProblems) {
          html += `<div class="subject-card">`;
          // Subject名を表示 (例: "2025年度" や "東京大学")
          html += `<h3 class="subject-name">${subject.subjectName}</h3>`;
          html += `<ul class="field-list">`;

          subject.fields.forEach((field) => {
            if (field.problems && field.problems.length > 0) {
              html += `<li class="field-item">`;
              // Field名を表示 (例: "本試験" や "2024年度")
              html += `<span class="field-name">${field.fieldName}</span>`;
              html += `<div class="prob-grid">`;
              field.problems.forEach((p) => {
                const targetUrl = `viewer.html?path=${encodeURIComponent(p.explanationPath)}`;
                html += `<a href="${targetUrl}" class="prob-link" target="_blank"><span>${p.title}</span></a>`;
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
});