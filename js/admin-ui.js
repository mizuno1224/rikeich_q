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

    // Subject (科目/年度/大学) のツリーアイテムを作成
    const subDetails = createTreeItem(labelSubj, sub.subjectName, subPath);
    subDetails.open = true;

    // Subjectに対するアクション (追加/リネーム/削除)
    addActions(
      subDetails.querySelector("summary"),
      () => handleRenameSubject(sub, labelSubj),
      () => handleDeleteSubject(sub, sIdx),
      () => handleAddField(sub, labelField),
    );

    const subContent = document.createElement("div");
    subContent.className = "tree-content";
    // インデントと左線で見やすくする
    subContent.style.paddingLeft = "15px";
    subContent.style.borderLeft = "1px solid #e2e8f0";

    // Part (編) グルーピング用変数
    let currentPartName = null;
    let currentPartContainer = null;

    sub.fields.forEach((fld, fIdx) => {
      const nameParts = fld.fieldName.split(" / ");
      const isGrouped = nameParts.length > 1;
      const partName = isGrouped ? nameParts[0] : null;
      const chapName = isGrouped ? nameParts[1] : fld.fieldName;

      // デフォルトはSubject直下に追加
      let targetContainer = subContent;

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

          subContent.appendChild(partDetails);
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

    subDetails.appendChild(subContent);
    ui.treeRoot.appendChild(subDetails);
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

  // HTMLファイルの読み込み
  if (problem.explanationPath) {
    try {
      if (isCloudMode) {
        fetch(problem.explanationPath)
          .then(res => {
             if(res.ok) return res.text();
             throw new Error("Failed to fetch");
          })
          .then(text => {
             editorArea.value = text;
          })
          .catch(() => {
             editorArea.value = "(HTMLファイルの読み込みに失敗しました)";
          });
          
        editorArea.readOnly = true; 
        editorArea.style.background = "#e2e8f0";
        editorArea.style.color = "#64748b";
      } else {
        if (rootDirHandle) {
          (async () => {
            try {
              const parts = problem.explanationPath.split("/");
              let d = rootDirHandle;
              for (let i = 0; i < parts.length - 1; i++)
                d = await d.getDirectoryHandle(parts[i]);
              const f = await d.getFileHandle(parts[parts.length - 1]);
              editorArea.value = await (await f.getFile()).text();
            } catch(e) {
              editorArea.value = "\n";
            }
          })();
        }
        editorArea.readOnly = false;
        editorArea.style.background = "#1e1e1e";
        editorArea.style.color = "#d4d4d4";
      }
    } catch (e) {
      editorArea.value = "\n";
    }
  }
  currentVisualEditor = editorArea;
  explSec.appendChild(editorArea);
  ui.formContainer.appendChild(explSec);

  const btnSaveExpl = explSec.querySelector("#btn-save-expl");
  if(isCloudMode) {
    btnSaveExpl.disabled = true;
    btnSaveExpl.textContent = "🔒 編集不可(Cloud)";
    btnSaveExpl.style.background = "#cbd5e1";
    btnSaveExpl.onclick = null;
  } else {
    btnSaveExpl.disabled = false;
    btnSaveExpl.textContent = "💾 解説を保存";
    btnSaveExpl.style.background = "#3b82f6";
    btnSaveExpl.onclick = async () => {
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

  // 最後にプレビュータブをアクティブにする
  if (ui.tabPreview) ui.tabPreview.click();
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
      e.preventDefault(); e.stopPropagation(); onRename();
    };
  if (onDelete)
    btns[idx++].onclick = (e) => {
      e.preventDefault(); e.stopPropagation(); onDelete();
    };
  if (onAdd)
    btns[idx++].onclick = (e) => {
      e.preventDefault(); e.stopPropagation(); onAdd();
    };
  summaryEl.appendChild(div);
}

function saveOpenStates() {
  openPaths.clear();
  document.querySelectorAll("details[open]").forEach((e) => openPaths.add(e.dataset.path));
}

function restoreOpenStates() {
  document.querySelectorAll("details").forEach((e) => {
    if (openPaths.has(e.dataset.path)) e.open = true;
  });
}

function setupTabSwitching() {
  let previewIframe = null;

  const updatePreview = () => {
    if (!previewIframe) {
      // 初回作成
      ui.previewContainer.innerHTML = "";
      previewIframe = document.createElement("iframe");
      previewIframe.style.cssText =
        "width:100%; height:100%; border:none; background:#fff;";
      ui.previewContainer.appendChild(previewIframe);

      const doc = previewIframe.contentWindow.document;
      doc.open();
      // ★修正: Adminプレビュー用のCSSを追加してIframeを作成
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
          <script>
            window.MathJax = {
              tex: { 
                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']], 
                displayMath: [['$$', '$$']],
                macros: {
                  strong: ["\\\\textcolor{\\\\#3b82f6}{\\\\boldsymbol{#1}}", 1]
                }
              },
              svg: { fontCache: 'global' },
              startup: {
                pageReady: () => {
                  return MathJax.startup.defaultPageReady().then(() => {});
                }
              }
            };
          </script>
          <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"><\/script>
          <style>
            .prob-header-top { display:none; }
            body { padding-top: 20px; }
            #text-target[contenteditable]:focus { outline: 2px solid #3b82f6; outline-offset: 4px; }
            mjx-container { cursor: pointer; transition: opacity 0.2s; }
            mjx-container:hover { opacity: 0.7; }

            /* --- Admin Preview Overlay Styles --- */
            .admin-preview-footer {
              margin-top: 10px; padding: 6px 10px; background: #f8fafc; border-top: 1px dashed #cbd5e1;
              display: flex; justify-content: space-between; align-items: center;
              font-family: "M PLUS Rounded 1c", sans-serif; font-size: 0.85rem; color: #475569;
            }
            .admin-stats { display: flex; gap: 12px; font-weight: bold; }
            .admin-stat-item { display: flex; align-items: center; gap: 4px; }
            .admin-btn-comments {
              background: #fff; border: 1px solid #cbd5e1; color: #3b82f6; cursor: pointer;
              padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;
              transition: all 0.2s;
            }
            .admin-btn-comments:hover { background: #eff6ff; border-color: #3b82f6; }
            .admin-comment-box {
              display: none; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px;
              padding: 10px; margin-top: 8px; max-height: 200px; overflow-y: auto;
              box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            }
            .admin-comment-row {
              border-bottom: 1px dashed #f1f5f9; padding: 6px 0; font-size: 0.85rem; line-height: 1.4;
            }
            .admin-comment-row:last-child { border-bottom: none; }
            .admin-comment-user { font-size: 0.75rem; color: #94a3b8; display: block; margin-bottom: 2px; }
          </style>
        </head>
        <body>
          <div class="viewer-container">
            <div class="viewer-split-content">
               <div id="sim-target" class="simulation-area"></div>
               <div id="text-target" class="explanation-area"></div>
            </div>
          </div>
          <script src="js/sim-utils.js"><\/script>
        </body>
        </html>
      `);
      doc.close();
      previewIframe.onload = () => injectContent();
    } else {
      injectContent();
    }
  };

  const injectContent = async () => {
    if (!previewIframe) return;
    const win = previewIframe.contentWindow;
    if (!win || !win.document) return;

    const target = win.document.getElementById("text-target");
    if (!target) return;

    // 現在のエディタの内容を適用
    const editorContent = currentVisualEditor ? currentVisualEditor.value : "";
    target.innerHTML = editorContent;

    target.contentEditable = "true";
    target.spellcheck = false;

    // MathJaxレンダリング
    if (win.MathJax && win.MathJax.typesetPromise) {
      await win.MathJax.typesetPromise([target]);
      // 数式クリックロジック等は省略(必要なら復活可)
    }

    // ★追加: プレビュー画面へのリアクション集計オーバーレイ表示
    if (currentProblem) {
      const logs = await fetchAnalysisData(currentProblem.id);
      renderPreviewOverlays(win.document, logs);
    }
  };

  // プレビューのオーバーレイ描画処理
  function renderPreviewOverlays(doc, logs) {
    const cards = doc.querySelectorAll(".card");
    if (cards.length === 0) return;

    const cardsMap = {};
    logs.forEach(log => {
      const idx = log.cardIndex;
      if (!cardsMap[idx]) cardsMap[idx] = { good: 0, hmm: 0, memos: [] };
      if (log.reaction === 'good') cardsMap[idx].good++;
      if (log.reaction === 'hmm') cardsMap[idx].hmm++;
      if (log.memo && log.memo.trim() !== "") {
        cardsMap[idx].memos.push({ user: log.userId, text: log.memo });
      }
    });

    cards.forEach((card, idx) => {
      // 既存削除
      const existing = card.querySelector(".admin-preview-footer");
      if(existing) existing.remove();
      const existingBox = card.querySelector(".admin-comment-box");
      if(existingBox) existingBox.remove();

      const data = cardsMap[idx] || { good: 0, hmm: 0, memos: [] };

      // フッター作成
      const footer = doc.createElement("div");
      footer.className = "admin-preview-footer";
      
      const leftDiv = doc.createElement("div");
      if (data.memos.length > 0) {
        const btnComment = doc.createElement("button");
        btnComment.className = "admin-btn-comments";
        btnComment.textContent = `💬 コメント (${data.memos.length})`;
        btnComment.onclick = (e) => {
           e.stopPropagation(); // 編集モード誤爆防止
           // boxはfooterの兄弟要素として追加予定
           const box = footer.nextElementSibling;
           if(box && box.classList.contains("admin-comment-box")) {
              box.style.display = box.style.display === "none" ? "block" : "none";
           }
        };
        leftDiv.appendChild(btnComment);
      } else {
        leftDiv.innerHTML = `<span style="color:#cbd5e1; font-size:0.8rem;">(コメントなし)</span>`;
      }

      const rightDiv = doc.createElement("div");
      rightDiv.className = "admin-stats";
      rightDiv.innerHTML = `
        <span class="admin-stat-item" style="color:#3b82f6;">👍 ${data.good}</span>
        <span class="admin-stat-item" style="color:#f43f5e;">🤔 ${data.hmm}</span>
      `;

      footer.appendChild(leftDiv);
      footer.appendChild(rightDiv);

      // コメントボックス
      const commentBox = doc.createElement("div");
      commentBox.className = "admin-comment-box";
      commentBox.style.display = "none";
      
      if (data.memos.length > 0) {
        data.memos.forEach(m => {
          const row = doc.createElement("div");
          row.className = "admin-comment-row";
          row.innerHTML = `<span class="admin-comment-user">${m.user}</span>${m.text}`;
          commentBox.appendChild(row);
        });
      }

      // カードに追加
      card.appendChild(footer);
      card.appendChild(commentBox);
    });
  }

  // --- タブ切り替え処理 ---

  const resetActive = () => {
    if(ui.tabEdit) ui.tabEdit.classList.remove("active");
    if(ui.tabPreview) ui.tabPreview.classList.remove("active");
    if(ui.tabAnalyze) ui.tabAnalyze.classList.remove("active");
    
    if(ui.viewEditor) ui.viewEditor.classList.remove("active");
    if(ui.viewPreview) ui.viewPreview.classList.remove("active");
    if(ui.viewAnalyze) ui.viewAnalyze.classList.remove("active");
  };

  if(ui.tabEdit) {
    ui.tabEdit.onclick = () => {
      resetActive();
      ui.tabEdit.classList.add("active");
      ui.viewEditor.classList.add("active");
    };
  }

  if(ui.tabPreview) {
    ui.tabPreview.onclick = () => {
      resetActive();
      ui.tabPreview.classList.add("active");
      ui.viewPreview.classList.add("active");
      updatePreview();
    };
  }
  
  if(ui.tabAnalyze) {
    ui.tabAnalyze.onclick = async () => {
      resetActive();
      ui.tabAnalyze.classList.add("active");
      ui.viewAnalyze.classList.add("active");
      await renderAnalysis();
    };
  }

  if (ui.formContainer) {
    ui.formContainer.addEventListener('input', (e) => {
      if (e.target.classList.contains('visual-editor')) {
        if (ui.viewPreview && ui.viewPreview.classList.contains('active')) {
          injectContent();
        }
      }
    });
  }
}

/**
 * HTML文字列から各カードのタイトル(h3)を抽出するヘルパー
 */
function extractCardTitles(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  const cards = div.querySelectorAll(".card");
  const titles = [];
  cards.forEach((card, i) => {
    const h3 = card.querySelector("h3");
    titles[i] = h3 ? h3.textContent : `Card #${i + 1}`;
  });
  return titles;
}

// 分析データのレンダリング
async function renderAnalysis() {
  if (!ui.analyzeContainer || !currentProblem) return;
  
  ui.analyzeContainer.innerHTML = '<p>データを読み込み中...</p>';
  
  // admin-core.js で定義した fetchAnalysisData を呼び出す
  const logs = await fetchAnalysisData(currentProblem.id);
  
  if (!logs || logs.length === 0) {
    let msg = "データがありません。";
    let subMsg = "";

    if (window.db) {
       subMsg = "Firestoreへの接続は成功していますが、まだ生徒の回答データが1件もありません。<br>生徒画面 (viewer.html) を開き、リアクションボタンやメモを入力してデータを送信してください。";
    } else {
       subMsg = "Firestore未接続、かつダミーデータの読み込みにも失敗しました。";
    }

    ui.analyzeContainer.innerHTML = `
      <div style="text-align:center; padding:40px; color:#64748b;">
        <p style="font-weight:bold; font-size:1.1rem; color:#334155;">${msg}</p>
        <p style="font-size:0.9rem; margin-top:10px; line-height:1.6;">${subMsg}</p>
      </div>`;
    return;
  }
  
  // ★修正: HTMLからカードタイトルを取得
  let htmlContent = "";
  if (currentVisualEditor) {
    htmlContent = currentVisualEditor.value;
  } else if (currentProblem.explanationPath) {
    try {
       const res = await fetch(currentProblem.explanationPath);
       if (res.ok) htmlContent = await res.text();
    } catch(e) {}
  }
  const cardTitles = extractCardTitles(htmlContent);
  
  ui.analyzeContainer.innerHTML = "";
  
  if(!window.db) {
    const notice = document.createElement('div');
    notice.style.cssText = "background:#fff7ed; padding:10px; border-left:4px solid #f97316; margin-bottom:20px; color:#c2410c;";
    notice.textContent = "⚠ 現在はFirestoreに接続されていないため、ダミーデータを表示しています。";
    ui.analyzeContainer.appendChild(notice);
  }

  // カードごとに集計
  const cardsMap = {};
  logs.forEach(log => {
    const idx = log.cardIndex;
    if (!cardsMap[idx]) {
      cardsMap[idx] = { good: 0, hmm: 0, memos: [] };
    }
    
    if (log.reaction === 'good') cardsMap[idx].good++;
    if (log.reaction === 'hmm') cardsMap[idx].hmm++;
    
    if (log.memo && log.memo.trim() !== "") {
      cardsMap[idx].memos.push({
        user: log.userId,
        text: log.memo,
        time: log.timestamp
      });
    }
  });
  
  // カード順に表示
  Object.keys(cardsMap).sort().forEach(idx => {
    const data = cardsMap[idx];
    const cardDiv = document.createElement("div");
    cardDiv.className = "analyze-card";
    
    // タイトル適用
    const titleText = cardTitles[idx] || `Card #${parseInt(idx) + 1}`;
    
    const header = document.createElement("div");
    header.className = "analyze-card-header";
    header.innerHTML = `<div class="analyze-card-title">${titleText}</div>`;
    cardDiv.appendChild(header);
    
    const statsRow = document.createElement("div");
    statsRow.className = "analyze-stats-row";
    statsRow.innerHTML = `
      <div class="analyze-stat-item analyze-stat-good">
        👍 ${data.good} <span style="font-size:0.8rem; color:#64748b; font-weight:normal;">(理解)</span>
      </div>
      <div class="analyze-stat-item analyze-stat-hmm">
        🤔 ${data.hmm} <span style="font-size:0.8rem; color:#64748b; font-weight:normal;">(疑問)</span>
      </div>
    `;
    cardDiv.appendChild(statsRow);
    
    if (data.memos.length > 0) {
      const memoList = document.createElement("div");
      memoList.className = "analyze-memo-list";
      data.memos.forEach(m => {
        const item = document.createElement("div");
        item.className = "analyze-memo-item";
        item.innerHTML = `
          <div class="analyze-memo-user">${m.user}</div>
          <div>${m.text}</div>
        `;
        memoList.appendChild(item);
      });
      cardDiv.appendChild(memoList);
    } else {
      const emptyMemo = document.createElement("div");
      emptyMemo.style.color = "#94a3b8";
      emptyMemo.style.fontSize = "0.9rem";
      emptyMemo.textContent = "コメントはありません";
      cardDiv.appendChild(emptyMemo);
    }
    
    ui.analyzeContainer.appendChild(cardDiv);
  });
}

function setupSidebarTools() {
  if (!ui.sidebarTools) return;

  const btnSyncFolders = document.createElement("button");
  btnSyncFolders.className = "btn-tool";
  btnSyncFolders.title = "JSON定義に基づいてフォルダを一括生成";
  btnSyncFolders.textContent = "📂同期";
  btnSyncFolders.onclick = handleSyncFolders;

  const btnSmartImport = document.createElement("button");
  btnSmartImport.className = "btn-tool";
  btnSmartImport.title = "AIの出力(HTMLとJSON)を取り込み";
  btnSmartImport.textContent = "🤖AI取込";
  btnSmartImport.style.backgroundColor = "#8b5cf6";
  btnSmartImport.onclick = openSmartImportModal;

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

  if (ui.btnImportAi) {
    ui.btnImportAi.style.display = "inline-block";
    ui.btnImportAi.onclick = openSmartImportModal;
  }
}