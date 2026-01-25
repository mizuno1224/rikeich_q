// js/admin-ui.js

// --- UI Rendering Functions ---

function renderApp() {
  renderTabs();
  renderTree();
}

function renderTabs() {
  ui.tabsArea.innerHTML = "";
  manifestData.forEach((mat, idx) => {
    const btn = document.createElement("button");
    btn.className = `tab-btn ${idx === activeMaterialIndex ? "active" : ""}`;
    btn.textContent = mat.name;
    btn.onclick = () => {
      saveOpenStates();
      loadMaterial(idx);
    };
    ui.tabsArea.appendChild(btn);
  });

  const btnAdd = document.createElement("button");
  btnAdd.id = "btn-add-material";
  btnAdd.className = "tab-btn";
  btnAdd.textContent = "＋";
  btnAdd.onclick = createNewMaterial;
  ui.tabsArea.appendChild(btnAdd);
}

function renderTree() {
  // 1. 再描画前の状態を保存
  const lastScrollTop = ui.treeRoot.scrollTop;
  saveOpenStates();

  ui.treeRoot.innerHTML = "";
  if (!currentMaterialData) return;

  let labelSubj = "科目";
  let labelField = "分野";
  if (currentMaterialType === "exam_year") {
    labelSubj = "年度";
    labelField = "区分";
  } else if (currentMaterialType === "exam_univ") {
    labelSubj = "大学";
    labelField = "年度";
  }

  currentMaterialData.subjects.forEach((sub, sIdx) => {
    const stableSubId = sub.folderName || sub.subjectName || sIdx;
    const subPath = `s-${stableSubId}`;

    // Part (編) グルーピング用変数
    let currentPartName = null;
    let currentPartContainer = null;

    sub.fields.forEach((fld, fIdx) => {
      const nameParts = fld.fieldName.split(" / ");
      const isGrouped = nameParts.length > 1;
      const partName = isGrouped ? nameParts[0] : null;
      const chapName = isGrouped ? nameParts[1] : fld.fieldName;

      let targetContainer = ui.treeRoot;

      if (isGrouped) {
        if (partName !== currentPartName) {
          currentPartName = partName;
          const partDetails = document.createElement("details");
          partDetails.open = true;
          partDetails.dataset.path = `${subPath}-part-${partName}`;
          partDetails.style.marginBottom = "5px";
          partDetails.style.border = "none";

          const partSummary = document.createElement("summary");
          partSummary.innerHTML = `<span style="font-weight:bold; color:#475569;">📂 ${partName}</span>`;
          partSummary.style.background = "#f1f5f9";
          partSummary.style.borderRadius = "6px";

          partDetails.appendChild(partSummary);

          const partInner = document.createElement("div");
          partInner.style.paddingLeft = "10px";
          partDetails.appendChild(partInner);

          ui.treeRoot.appendChild(partDetails);
          currentPartContainer = partInner;
        }
        targetContainer = currentPartContainer;
      } else {
        currentPartName = null;
        currentPartContainer = null;
      }

      const stableFldId = fld.folderId || fld.fieldName || fIdx;
      const fldPath = `${subPath}-f-${stableFldId}`;
      const fldDetails = createTreeItem(labelField, chapName, fldPath);

      addActions(
        fldDetails.querySelector("summary"),
        () => handleRenameField(sub, fld, labelField),
        () => handleDeleteField(sub, fld, fIdx),
        null,
      );

      const fldContent = document.createElement("div");
      fldContent.className = "tree-content";

      // Drag & Drop Handlers for Field
      fldContent.addEventListener("dragover", (e) => {
        e.preventDefault();
        fldContent.classList.add("drag-over");
      });
      fldContent.addEventListener("dragleave", () =>
        fldContent.classList.remove("drag-over"),
      );
      fldContent.addEventListener("drop", (e) =>
        handleDropProblem(e, sub, fld),
      );

      fld.problems.forEach((prob, pIdx) => {
        const pDiv = document.createElement("div");
        const isActive =
          currentProblem &&
          currentProblem.id === prob.id &&
          currentProblem.explanationPath === prob.explanationPath;
        pDiv.className = `prob-item ${isActive ? "active" : ""}`;

        pDiv.innerHTML = `<span>${prob.title || "(無題)"}</span><span style="font-size:0.8em;color:#999;">${prob.id}</span>`;
        pDiv.draggable = true;

        // Drag Events for Problem
        pDiv.addEventListener("dragstart", (e) => {
          dragSrcProb = prob;
          dragSrcField = fld;
          pDiv.classList.add("dragging");
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", pIdx);
        });

        pDiv.addEventListener("dragover", (e) => {
          e.preventDefault();
          if (dragSrcField === fld) {
            pDiv.style.borderTop = "2px solid #3b82f6";
          }
        });

        pDiv.addEventListener(
          "dragleave",
          () => (pDiv.style.borderTop = "transparent"),
        );

        pDiv.addEventListener("drop", (e) => {
          e.preventDefault();
          e.stopPropagation();
          pDiv.style.borderTop = "transparent";

          // 同じフィールド内での並び替え
          if (dragSrcField === fld && dragSrcProb) {
            const oldIdx = fld.problems.indexOf(dragSrcProb);
            const newIdx = pIdx;
            if (oldIdx !== -1 && oldIdx !== newIdx) {
              fld.problems.splice(oldIdx, 1);
              fld.problems.splice(newIdx, 0, dragSrcProb);
              renderTree();
              saveAll();
            }
            return;
          }

          pDiv.classList.remove("dragging");
          document
            .querySelectorAll(".drag-over")
            .forEach((el) => el.classList.remove("drag-over"));

          // 別フィールドからの移動
          if (dragSrcField !== fld) {
            handleDropProblem(e, sub, fld);
          }
        });

        pDiv.addEventListener("dragend", () => {
          pDiv.classList.remove("dragging");
          pDiv.style.borderTop = "transparent";
          document
            .querySelectorAll(".drag-over")
            .forEach((el) => el.classList.remove("drag-over"));
        });

        pDiv.onclick = (e) => {
          if (e.ctrlKey) {
            if (confirm(`問題「${prob.title}」を削除しますか？`)) {
              handleDeleteProblem(sub, fld, prob, pIdx);
            }
            return;
          }
          openEditor(prob);
          document
            .querySelectorAll(".prob-item")
            .forEach((el) => el.classList.remove("active"));
          pDiv.classList.add("active");
        };
        fldContent.appendChild(pDiv);
      });

      // 問題追加ボタン
      const btnAdd = document.createElement("div");
      btnAdd.className = "prob-item";
      btnAdd.style.color = "#10b981";
      btnAdd.textContent = "＋ 問題追加";
      btnAdd.onclick = () => createNewProblem(sub, fld);
      fldContent.appendChild(btnAdd);

      fldDetails.appendChild(fldContent);
      targetContainer.appendChild(fldDetails);
    });
  });

  // 2. 状態の復元
  restoreOpenStates();
  ui.treeRoot.scrollTop = lastScrollTop;
}

// --- Editor Functions ---

async function openEditor(problem) {
  currentProblem = problem;
  ui.editorMainWrapper.style.display = "flex";
  ui.emptyState.style.display = "none";
  if (ui.tabEdit) ui.tabEdit.click();

  ui.editingTitle.textContent = problem.title;
  ui.editingId.textContent = problem.id;
  ui.formContainer.innerHTML = "";

  // === 1. 基本情報エリア ===
  const infoSec = document.createElement("div");
  infoSec.className = "form-section";
  infoSec.innerHTML = "<h3>📝 基本情報編集</h3>";

  const gridStyle = "display:grid; grid-template-columns: 1fr 1fr; gap:15px;";
  const row1 = document.createElement("div");
  row1.style.cssText = gridStyle;
  const row2 = document.createElement("div");
  row2.style.cssText = gridStyle;

  const updateJson = () => {
    if (document.getElementById("json-editor-area"))
      document.getElementById("json-editor-area").value = JSON.stringify(
        problem,
        null,
        2,
      );
  };

  row1.appendChild(
    createInput("ID", problem.id, (val) => {
      problem.id = val;
      ui.editingId.textContent = val;
      updateJson();
    }),
  );

  const titleGroup = createInput("タイトル", problem.title, (val) => {
    problem.title = val;
    ui.editingTitle.textContent = val;
    const activeItem = ui.treeRoot.querySelector(
      ".prob-item.active span:first-child",
    );
    if (activeItem) activeItem.textContent = val;
    updateJson();
  });
  titleGroup.style.width = "100%";

  const descGroup = createInput("説明文", problem.desc || "", (val) => {
    problem.desc = val;
    updateJson();
  });
  descGroup.style.width = "100%";

  const pathGroup = createInput(
    "解説パス (explanationPath)",
    problem.explanationPath,
    (val) => {
      problem.explanationPath = val;
      updateJson();
    },
  );
  pathGroup.style.width = "100%";

  infoSec.appendChild(row1);
  infoSec.appendChild(titleGroup);
  infoSec.appendChild(descGroup);
  infoSec.appendChild(row2);
  infoSec.appendChild(pathGroup);

  // === 2. JSONソース編集エリア ===
  const jsonSec = document.createElement("div");
  jsonSec.style.marginTop = "15px";
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "🔧 ソースコード(JSON)を直接編集";
  summary.style.fontSize = "0.9rem";
  summary.style.color = "#64748b";
  details.appendChild(summary);

  const jsonEditor = document.createElement("textarea");
  jsonEditor.id = "json-editor-area";
  jsonEditor.style.cssText =
    "width:100%; height:150px; font-family:monospace; font-size:12px; background:#1e1e1e; color:#d4d4d4; padding:10px; border-radius:4px; margin-top:5px;";
  jsonEditor.spellcheck = false;
  jsonEditor.value = JSON.stringify(problem, null, 2);

  jsonEditor.addEventListener("change", () => {
    try {
      const newObj = JSON.parse(jsonEditor.value);
      Object.keys(currentProblem).forEach((k) => delete currentProblem[k]);
      Object.assign(currentProblem, newObj);
      openEditor(currentProblem);
      showToast("JSONを適用しました");
    } catch (e) {
      alert("JSON形式エラー: " + e);
    }
  });

  details.appendChild(jsonEditor);
  jsonSec.appendChild(details);
  infoSec.appendChild(jsonSec);
  ui.formContainer.appendChild(infoSec);

  // === 3. 解説HTMLエディタ ===
  const explSec = document.createElement("div");
  explSec.className = "form-section";
  explSec.style.display = "flex";
  explSec.style.flexDirection = "column";
  explSec.style.flex = "1";
  explSec.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <h3 style="margin:0;">📖 解説HTML編集</h3>
      <button id="btn-save-expl" class="btn-save">💾 解説を保存</button>
    </div>
  `;

  const editorArea = document.createElement("textarea");
  editorArea.className = "visual-editor";
  editorArea.style.cssText =
    "flex:1; width:100%; min-height:400px; font-family:monospace; font-size:14px; background:#1e1e1e; color:#d4d4d4; padding:15px; border-radius:6px; resize:none;";
  editorArea.spellcheck = false;

  if (problem.explanationPath && rootDirHandle) {
    try {
      const parts = problem.explanationPath.split("/");
      let d = rootDirHandle;
      for (let i = 0; i < parts.length - 1; i++)
        d = await d.getDirectoryHandle(parts[i]);
      const f = await d.getFileHandle(parts[parts.length - 1]);
      editorArea.value = await (await f.getFile()).text();
    } catch (e) {
      editorArea.value = "\n";
    }
  }
  currentVisualEditor = editorArea;
  explSec.appendChild(editorArea);
  ui.formContainer.appendChild(explSec);

  explSec.querySelector("#btn-save-expl").onclick = async () => {
    try {
      const parts = problem.explanationPath.split("/");
      let d = rootDirHandle;
      for (let i = 0; i < parts.length - 1; i++)
        d = await d.getDirectoryHandle(parts[i], { create: true });
      const f = await d.getFileHandle(parts[parts.length - 1], {
        create: true,
      });
      const w = await f.createWritable();
      await w.write(editorArea.value);
      await w.close();
      showToast("解説HTMLを保存しました");
    } catch (e) {
      alert("保存エラー: " + e);
    }
  };
}

// --- UI Helper Functions ---

function createInput(label, val, onChange) {
  const g = document.createElement("div");
  g.className = "form-group";
  g.innerHTML = `<label>${label}</label>`;
  const i = document.createElement("input");
  i.className = "form-control";
  i.value = val || "";
  if (onChange) i.oninput = (e) => onChange(e.target.value);
  g.appendChild(i);
  return g;
}

function createTreeItem(label, text, path) {
  const det = document.createElement("details");
  det.dataset.path = path;
  const sum = document.createElement("summary");
  sum.innerHTML = `<span><span style="font-size:0.8em;color:#888;">[${label}]</span> ${text}</span>`;
  det.appendChild(sum);
  return det;
}

function addActions(summaryEl, onRename, onDelete, onAdd) {
  const div = document.createElement("div");
  div.className = "tree-actions";
  if (onRename)
    div.innerHTML += `<button class="tree-btn" title="名前変更">✎</button>`;
  if (onDelete)
    div.innerHTML += `<button class="tree-btn del" title="削除">🗑</button>`;
  if (onAdd)
    div.innerHTML += `<button class="tree-btn add" title="追加">＋</button>`;

  const btns = div.querySelectorAll("button");
  let idx = 0;
  if (onRename)
    btns[idx++].onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      onRename();
    };
  if (onDelete)
    btns[idx++].onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      onDelete();
    };
  if (onAdd)
    btns[idx++].onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      onAdd();
    };
  summaryEl.appendChild(div);
}

function saveOpenStates() {
  openPaths.clear();
  document
    .querySelectorAll("details[open]")
    .forEach((e) => openPaths.add(e.dataset.path));
}

function restoreOpenStates() {
  document.querySelectorAll("details").forEach((e) => {
    if (openPaths.has(e.dataset.path)) e.open = true;
  });
}

function setupTabSwitching() {
  if (ui.tabEdit && ui.tabPreview) {
    ui.tabEdit.onclick = () => {
      ui.tabEdit.classList.add("active");
      ui.tabPreview.classList.remove("active");
      ui.viewEditor.classList.add("active");
      ui.viewPreview.classList.remove("active");
    };

    ui.tabPreview.onclick = () => {
      ui.tabEdit.classList.remove("active");
      ui.tabPreview.classList.add("active");
      ui.viewEditor.classList.remove("active");
      ui.viewPreview.classList.add("active");

      ui.previewContainer.innerHTML = "";
      const iframe = document.createElement("iframe");
      iframe.style.cssText =
        "width:100%; height:100%; border:none; background:#fff;";
      ui.previewContainer.appendChild(iframe);

      const editorContent = currentVisualEditor
        ? currentVisualEditor.value
        : "";

      const doc = iframe.contentWindow.document;
      doc.open();
      // プレビュー用HTML生成（簡略化）
      doc.write(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <link rel="stylesheet" href="css/base.css">
          <link rel="stylesheet" href="css/components.css">
          <link rel="stylesheet" href="css/viewer.css">
          <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraph.css" />
          <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.2/p5.min.js"><\/script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
          <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"><\/script>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js"><\/script>
          <script type="text/javascript" charset="UTF-8" src="https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraphcore.js"><\/script>
          <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"><\/script>
          <style>.prob-header-top { display:none; }</style>
        </head>
        <body>
          <div class="viewer-container">
            <div class="viewer-split-content">
               <div id="sim-target" class="simulation-area"></div>
               <div id="text-target" class="explanation-area">
                 ${editorContent}
               </div>
            </div>
          </div>
          <script src="js/sim-utils.js"><\/script>
        </body>
        </html>
      `);
      doc.close();
    };
  }
}

function setupSidebarTools() {
  if (!ui.sidebarTools) return;

  // 1. 同期
  const btnSyncFolders = document.createElement("button");
  btnSyncFolders.className = "btn-tool";
  btnSyncFolders.title = "JSON定義に基づいてフォルダを一括生成";
  btnSyncFolders.textContent = "📂同期";
  btnSyncFolders.onclick = handleSyncFolders;

  // 2. AI取込
  const btnSmartImport = document.createElement("button");
  btnSmartImport.className = "btn-tool";
  btnSmartImport.title = "AIの出力(HTMLとJSON)を取り込み";
  btnSmartImport.textContent = "🤖AI取込";
  btnSmartImport.style.backgroundColor = "#8b5cf6";
  btnSmartImport.onclick = openSmartImportModal;

  // 3. 展開/縮小
  const btnCollapse = document.createElement("button");
  btnCollapse.className = "btn-tool";
  btnCollapse.textContent = "📂 展開/縮小";
  btnCollapse.onclick = () => {
    const allDetails = document.querySelectorAll("#tree-root details");
    allDetails.forEach((det) => {
      if (det.parentElement.id !== "tree-root") {
        det.open = !det.open;
      }
    });
  };

  ui.sidebarTools.insertBefore(btnCollapse, ui.sidebarTools.firstChild);
  ui.sidebarTools.appendChild(btnSyncFolders);
  ui.sidebarTools.appendChild(btnSmartImport);

  // ヘッダーのAI取込ボタン
  if (ui.btnImportAi) {
    ui.btnImportAi.style.display = "inline-block";
    ui.btnImportAi.onclick = openSmartImportModal;
  }
}
