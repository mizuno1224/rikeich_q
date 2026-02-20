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
  // ツリーの編集機能は削除（一括編集画面に集約）
  ui.treeRoot.innerHTML = "";
  if (!currentMaterialData) return;
  
  // ツリーは表示のみ（編集機能なし）
  const info = document.createElement("div");
  info.style.cssText = "padding:20px; color:#64748b; text-align:center;";
  info.innerHTML = "<p>📊 一括編集画面で編集できます</p>";
  ui.treeRoot.appendChild(info);
  return;
  
  // 以下は使用しない（コメントアウト）
  /*
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
  */
}

// --- Editor Functions ---

async function openEditor(problem) {
  // 未保存の変更がある場合は確認
  if (hasUnsavedChanges && ui.viewSpreadsheet && ui.viewSpreadsheet.classList.contains("active")) {
    if (!confirm("変更を破棄しますか？\n（一括保存ボタンで保存できます）")) {
      return;
    }
    hasUnsavedChanges = false;
  }
  
  currentProblem = problem;
  ui.editorMainWrapper.style.display = "flex";
  ui.emptyState.style.display = "none";
  
  // 問題を選択した場合は編集タブを表示（一括編集から個別編集に切り替え）
  if (ui.tabEdit && ui.viewEditor) {
    // 他のタブを非アクティブ
    if (ui.tabSpreadsheet) ui.tabSpreadsheet.classList.remove("active");
    if (ui.tabPreview) ui.tabPreview.classList.remove("active");
    if (ui.tabAnalyze) ui.tabAnalyze.classList.remove("active");
    if (ui.viewSpreadsheet) ui.viewSpreadsheet.classList.remove("active");
    if (ui.viewPreview) ui.viewPreview.classList.remove("active");
    if (ui.viewAnalyze) ui.viewAnalyze.classList.remove("active");
    
    // 編集タブをアクティブ
    ui.tabEdit.classList.add("active");
    ui.viewEditor.classList.add("active");
    
    // 個別編集画面では個々の問題タイトルID情報を表示
    if (ui.editingTitle) ui.editingTitle.style.display = "";
    if (ui.editingId) ui.editingId.style.display = "";
    const editorHeader = document.querySelector(".editor-header");
    if (editorHeader) editorHeader.style.display = "";
  }

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
    problem.explanationPath || "",
    (val) => {
      problem.explanationPath = val;
      updateJson();
    },
  );
  pathGroup.style.width = "100%";

  const youtubeGroup = createInput(
    "YouTube URL (youtubeUrl)",
    problem.youtubeUrl || "",
    (val) => {
      problem.youtubeUrl = val;
      updateJson();
    },
  );
  youtubeGroup.style.width = "100%";

  // 公開/非公開設定
  const publicGroup = document.createElement("div");
  publicGroup.className = "form-group";
  publicGroup.style.width = "100%";
  publicGroup.innerHTML = `<label>公開設定</label>`;
  
  const publicToggle = document.createElement("div");
  publicToggle.style.cssText = "display:flex; align-items:center; gap:10px; margin-top:5px;";
  
  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  const isPublic = problem.isPublic !== false; // デフォルトは公開
  toggleBtn.textContent = isPublic ? "🔓 公開中" : "🔒 非公開";
  toggleBtn.style.cssText = isPublic 
    ? "padding:8px 16px; background:#10b981; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;"
    : "padding:8px 16px; background:#ef4444; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;";
  
  toggleBtn.onclick = () => {
    problem.isPublic = !problem.isPublic;
    const newIsPublic = problem.isPublic !== false;
    toggleBtn.textContent = newIsPublic ? "🔓 公開中" : "🔒 非公開";
    toggleBtn.style.cssText = newIsPublic
      ? "padding:8px 16px; background:#10b981; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;"
      : "padding:8px 16px; background:#ef4444; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;";
    updateJson();
    saveAll();
    showToast(newIsPublic ? "公開に設定しました" : "非公開に設定しました");
  };
  
  const publicDesc = document.createElement("span");
  publicDesc.style.cssText = "font-size:0.85rem; color:#64748b;";
  publicDesc.textContent = isPublic 
    ? "生徒ページに表示されます" 
    : "生徒ページには表示されません（教員ページのみ）";
  
  publicToggle.appendChild(toggleBtn);
  publicToggle.appendChild(publicDesc);
  publicGroup.appendChild(publicToggle);

  infoSec.appendChild(row1);
  infoSec.appendChild(titleGroup);
  infoSec.appendChild(descGroup);
  infoSec.appendChild(row2);
  infoSec.appendChild(pathGroup);
  infoSec.appendChild(publicGroup);

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

/**
 * スプレッドシート風の一括編集画面をレンダリング
 */
function renderSpreadsheet() {
  if (!ui.spreadsheetContainer || !currentMaterialData) {
    if (ui.spreadsheetContainer) {
      ui.spreadsheetContainer.innerHTML = "<p>教材データが読み込まれていません</p>";
    }
    return;
  }

  // すべての問題を収集
  const allProblems = [];
  currentMaterialData.subjects.forEach((sub) => {
    sub.fields.forEach((fld) => {
      fld.problems.forEach((prob) => {
        allProblems.push({
          problem: prob,
          subject: sub.subjectName,
          field: fld.fieldName,
        });
      });
    });
  });

  if (allProblems.length === 0) {
    ui.spreadsheetContainer.innerHTML = "<p>問題が登録されていません</p>";
    return;
  }

  // ツールバーを作成（行追加ボタンなど）
  const toolbar = document.createElement("div");
  toolbar.style.cssText = "padding:10px 20px; background:#fff; border-bottom:1px solid #e2e8f0; display:flex; gap:10px; align-items:center; flex-wrap:wrap; flex-shrink:0;";
  
  // 左側のボタン群
  const leftButtons = document.createElement("div");
  leftButtons.style.cssText = "display:flex; gap:10px; align-items:center; flex:1;";
  
  const addRowBtn = document.createElement("button");
  addRowBtn.textContent = "＋ 行を追加";
  addRowBtn.style.cssText = "padding:6px 12px; background:#10b981; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.9rem;";
  addRowBtn.onclick = () => {
    addNewRowToSpreadsheet();
  };
  leftButtons.appendChild(addRowBtn);
  
  const insertRowBtn = document.createElement("button");
  insertRowBtn.textContent = "＋ 選択行の上に行を挿入";
  insertRowBtn.style.cssText = "padding:6px 12px; background:#3b82f6; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.9rem;";
  insertRowBtn.onclick = () => {
    insertRowAboveSelection();
  };
  leftButtons.appendChild(insertRowBtn);
  
  const deleteRowBtn = document.createElement("button");
  deleteRowBtn.textContent = "🗑️ 選択行を削除";
  deleteRowBtn.style.cssText = "padding:6px 12px; background:#ef4444; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.9rem;";
  deleteRowBtn.onclick = () => {
    deleteSelectedRows();
  };
  leftButtons.appendChild(deleteRowBtn);
  
  toolbar.appendChild(leftButtons);
  
  // 右側のボタン群（フォルダ操作）
  const rightButtons = document.createElement("div");
  rightButtons.style.cssText = "display:flex; gap:10px; align-items:center;";
  
  const addSubjectBtn = document.createElement("button");
  addSubjectBtn.textContent = "＋ 科目を追加";
  addSubjectBtn.style.cssText = "padding:6px 12px; background:#8b5cf6; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.9rem;";
  addSubjectBtn.onclick = () => {
    handleAddSubjectFromSpreadsheet();
  };
  rightButtons.appendChild(addSubjectBtn);
  
  const addFieldBtn = document.createElement("button");
  addFieldBtn.textContent = "＋ 分野を追加";
  addFieldBtn.style.cssText = "padding:6px 12px; background:#8b5cf6; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.9rem;";
  addFieldBtn.onclick = () => {
    handleAddFieldFromSpreadsheet();
  };
  rightButtons.appendChild(addFieldBtn);
  
  const deleteSubjectBtn = document.createElement("button");
  deleteSubjectBtn.textContent = "🗑️ 科目を削除";
  deleteSubjectBtn.style.cssText = "padding:6px 12px; background:#dc2626; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.9rem;";
  deleteSubjectBtn.onclick = () => {
    handleDeleteSubjectFromSpreadsheet();
  };
  rightButtons.appendChild(deleteSubjectBtn);
  
  const deleteFieldBtn = document.createElement("button");
  deleteFieldBtn.textContent = "🗑️ 分野を削除";
  deleteFieldBtn.style.cssText = "padding:6px 12px; background:#dc2626; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.9rem;";
  deleteFieldBtn.onclick = () => {
    handleDeleteFieldFromSpreadsheet();
  };
  rightButtons.appendChild(deleteFieldBtn);
  
  const renameSubjectBtn = document.createElement("button");
  renameSubjectBtn.textContent = "✎ 科目リネーム";
  renameSubjectBtn.style.cssText = "padding:6px 12px; background:#6366f1; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.9rem;";
  renameSubjectBtn.onclick = () => { handleRenameSubjectFromSpreadsheet(); };
  rightButtons.appendChild(renameSubjectBtn);
  
  const renameFieldBtn = document.createElement("button");
  renameFieldBtn.textContent = "✎ 分野リネーム";
  renameFieldBtn.style.cssText = "padding:6px 12px; background:#6366f1; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.9rem;";
  renameFieldBtn.onclick = () => { handleRenameFieldFromSpreadsheet(); };
  rightButtons.appendChild(renameFieldBtn);
  
  toolbar.appendChild(rightButtons);
  
  // 一括保存ボタン（右端）
  const saveAllBtn = document.createElement("button");
  saveAllBtn.textContent = "💾 一括保存";
  saveAllBtn.style.cssText = "padding:6px 16px; background:#f59e0b; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.9rem; margin-left:auto;";
  saveAllBtn.onclick = () => {
    saveAll();
    showToast("一括保存しました");
  };
  toolbar.appendChild(saveAllBtn);
  
  // テーブルを囲むコンテナを作成（スクロール可能にする）
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "flex:1; overflow:auto; position:relative;";
  wrapper.id = "spreadsheet-wrapper";

  // テーブルを作成
  const table = document.createElement("table");
  table.style.cssText = "width:100%; border-collapse:collapse; background:#fff;";
  table.id = "spreadsheet-table";
  
  // 列幅の定義（スプレッドシート風に統一）
  const columnWidths = {
    subject: "120px",
    field: "200px",
    id: "150px",
    title: "250px",
    desc: "300px",
    path: "300px",
    youtube: "300px",
    public: "100px",
    actions: "120px"
  };
  
  // ヘッダー行（固定表示）
  const thead = document.createElement("thead");
  thead.style.cssText = "background:#f1f5f9; position:sticky; top:0; z-index:10;";
  const headerRow = document.createElement("tr");
  const headers = [
    { text: "操作", width: columnWidths.actions },
    { text: "科目", width: columnWidths.subject },
    { text: "分野", width: columnWidths.field },
    { text: "ID", width: columnWidths.id },
    { text: "タイトル", width: columnWidths.title },
    { text: "説明文", width: columnWidths.desc },
    { text: "解説パス", width: columnWidths.path },
    { text: "YouTube URL", width: columnWidths.youtube },
    { text: "公開設定", width: columnWidths.public }
  ];
  
  headers.forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header.text;
    th.style.cssText = `padding:12px; text-align:left; font-weight:700; border-bottom:2px solid #e2e8f0; width:${header.width}; min-width:${header.width}; max-width:${header.width}; box-sizing:border-box; background:#f1f5f9; position:sticky; top:0;`;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // データ行
  const tbody = document.createElement("tbody");
  tbody.id = "spreadsheet-tbody";
  
  // グローバルに問題データのマッピングを保存（行追加・削除時に使用）
  window.spreadsheetProblemMap = [];
  
  allProblems.forEach((item, idx) => {
    const row = document.createElement("tr");
    row.dataset.rowIndex = idx;
    row.style.cssText = idx % 2 === 0 ? "background:#fff;" : "background:#f8fafc;";
    row.style.cssText += "transition:background 0.2s;";
    
    row.onmouseenter = () => {
      row.style.background = "#eff6ff";
    };
    row.onmouseleave = () => {
      row.style.background = idx % 2 === 0 ? "#fff" : "#f8fafc";
    };

    const prob = item.problem;
    
    // 問題データのマッピングを保存
    window.spreadsheetProblemMap[idx] = {
      problem: prob,
      subject: item.subject,
      field: item.field,
      subjectIndex: currentMaterialData.subjects.findIndex(s => s.subjectName === item.subject),
      fieldIndex: currentMaterialData.subjects.find(s => s.subjectName === item.subject)
        ?.fields.findIndex(f => f.fieldName === item.field)
    };
    
    // 操作列（詳細設定ボタン）- 左端に配置
    const cell0 = document.createElement("td");
    cell0.style.cssText = `padding:8px; border-bottom:1px solid #e2e8f0; width:${columnWidths.actions}; min-width:${columnWidths.actions}; max-width:${columnWidths.actions}; box-sizing:border-box;`;
    cell0.dataset.colIndex = "0";
    const detailBtn = document.createElement("button");
    detailBtn.textContent = "詳細";
    detailBtn.style.cssText = "padding:6px 12px; background:#3b82f6; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.85rem; width:100%;";
    detailBtn.onclick = () => {
      openEditor(prob);
    };
    cell0.appendChild(detailBtn);
    row.appendChild(cell0);
    
  // 科目（編集可能なドロップダウン）
  const cell1 = createSpreadsheetSubjectCell(item.subject, idx, columnWidths.subject);
  cell1.dataset.colIndex = "1";
  cell1.dataset.rowIndex = idx;
  row.appendChild(cell1);
  
  // 分野（編集可能なドロップダウン）
  const cell2 = createSpreadsheetFieldCell(item.field, item.subject, idx, columnWidths.field);
  cell2.dataset.colIndex = "2";
  cell2.dataset.rowIndex = idx;
  row.appendChild(cell2);
    
    // ID（編集可能）- 一括保存まで保存しない
    const cell3 = createSpreadsheetEditableCell(prob.id || "", (val) => {
      prob.id = val;
      markAsChanged();
    }, columnWidths.id, idx, 3);
    row.appendChild(cell3);
    
    // タイトル（編集可能）
    const cell4 = createSpreadsheetEditableCell(prob.title || "", (val) => {
      prob.title = val;
      markAsChanged();
    }, columnWidths.title, idx, 4);
    row.appendChild(cell4);
    
    // 説明文（編集可能）
    const cell5 = createSpreadsheetEditableCell(prob.desc || "", (val) => {
      prob.desc = val;
      markAsChanged();
    }, columnWidths.desc, idx, 5);
    row.appendChild(cell5);
    
    // 解説パス（編集可能）
    const cell6 = createSpreadsheetEditableCell(prob.explanationPath || "", (val) => {
      prob.explanationPath = val;
      markAsChanged();
    }, columnWidths.path, idx, 6);
    row.appendChild(cell6);
    
    // YouTube URL（編集可能）
    const cell7 = createSpreadsheetEditableCell(prob.youtubeUrl || "", (val) => {
      prob.youtubeUrl = val;
      markAsChanged();
    }, columnWidths.youtube, idx, 7);
    row.appendChild(cell7);
    
    // 公開設定（トグルボタン）
    const cell8 = document.createElement("td");
    cell8.style.cssText = `padding:12px; border-bottom:1px solid #e2e8f0; width:${columnWidths.public}; min-width:${columnWidths.public}; max-width:${columnWidths.public}; box-sizing:border-box;`;
    cell8.dataset.colIndex = "8";
    const toggleBtn = document.createElement("button");
    const isPublic = prob.isPublic !== false;
    toggleBtn.textContent = isPublic ? "🔓 公開" : "🔒 非公開";
    toggleBtn.style.cssText = isPublic
      ? "padding:6px 12px; background:#10b981; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.85rem; width:100%;"
      : "padding:6px 12px; background:#ef4444; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.85rem; width:100%;";
    toggleBtn.onclick = () => {
      prob.isPublic = !prob.isPublic;
      const newIsPublic = prob.isPublic !== false;
      toggleBtn.textContent = newIsPublic ? "🔓 公開" : "🔒 非公開";
      toggleBtn.style.cssText = newIsPublic
        ? "padding:6px 12px; background:#10b981; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.85rem; width:100%;"
        : "padding:6px 12px; background:#ef4444; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.85rem; width:100%;";
      // saveAll()は呼ばない（一括保存ボタンで保存）
    };
    cell8.appendChild(toggleBtn);
    row.appendChild(cell8);
    
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  // フォルダ構成パネル
  const folderPanel = document.createElement("details");
  folderPanel.style.cssText = "padding:8px 20px; background:#f8fafc; border-bottom:1px solid #e2e8f0; flex-shrink:0;";
  const folderSummary = document.createElement("summary");
  folderSummary.textContent = "📁 フォルダ構成を表示 / 編集";
  folderSummary.style.cssText = "cursor:pointer; font-weight:bold; font-size:0.9rem; color:#475569; padding:4px 0;";
  folderPanel.appendChild(folderSummary);
  
  const folderContent = document.createElement("div");
  folderContent.style.cssText = "padding:8px 0; display:flex; flex-wrap:wrap; gap:12px;";
  
  if (currentMaterialData.subjects) {
    currentMaterialData.subjects.forEach((sub, sIdx) => {
      const subCard = document.createElement("div");
      subCard.style.cssText = "background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:10px; min-width:220px; flex:1; max-width:400px;";
      
      const subHeader = document.createElement("div");
      subHeader.style.cssText = "display:flex; align-items:center; gap:6px; margin-bottom:6px;";
      subHeader.innerHTML = `<strong style="flex:1;">📂 ${sub.subjectName}</strong>`;
      
      const subFolderInput = document.createElement("input");
      subFolderInput.type = "text";
      subFolderInput.value = sub.folderName || "";
      subFolderInput.placeholder = "folderName";
      subFolderInput.style.cssText = "width:100px; padding:3px 6px; border:1px solid #e2e8f0; border-radius:4px; font-size:0.8rem;";
      subFolderInput.onchange = () => {
        sub.folderName = subFolderInput.value;
        markAsChanged();
      };
      subHeader.appendChild(subFolderInput);
      subCard.appendChild(subHeader);
      
      if (sub.fields) {
        sub.fields.forEach((fld, fIdx) => {
          const fldRow = document.createElement("div");
          fldRow.style.cssText = "display:flex; align-items:center; gap:4px; padding:3px 0 3px 12px; font-size:0.85rem;";
          fldRow.innerHTML = `<span style="color:#64748b;">📄</span><span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${fld.fieldName}">${fld.fieldName}</span>`;
          
          const fldIdInput = document.createElement("input");
          fldIdInput.type = "text";
          fldIdInput.value = fld.folderId || "";
          fldIdInput.placeholder = "folderId";
          fldIdInput.style.cssText = "width:80px; padding:2px 4px; border:1px solid #e2e8f0; border-radius:3px; font-size:0.75rem;";
          fldIdInput.onchange = () => {
            fld.folderId = fldIdInput.value;
            markAsChanged();
          };
          fldRow.appendChild(fldIdInput);
          subCard.appendChild(fldRow);
        });
      }
      folderContent.appendChild(subCard);
    });
  }
  folderPanel.appendChild(folderContent);
  
  ui.spreadsheetContainer.innerHTML = "";
  ui.spreadsheetContainer.appendChild(toolbar);
  ui.spreadsheetContainer.appendChild(folderPanel);
  ui.spreadsheetContainer.appendChild(wrapper);
  wrapper.appendChild(table);
  
  // コピー&ペースト機能を設定
  setupSpreadsheetCopyPaste();
  
  // 行の並び替え（ドラッグ&ドロップ）
  setupSpreadsheetDragDrop();
}

/**
 * 編集不可のセルを作成
 */
function createSpreadsheetCell(text, isEditable, width) {
  const cell = document.createElement("td");
  cell.textContent = text;
  cell.style.cssText = `padding:12px; border-bottom:1px solid #e2e8f0; width:${width}; min-width:${width}; max-width:${width}; box-sizing:border-box;`;
  cell.style.cursor = "default";
  return cell;
}

/**
 * 科目セルを作成（ドロップダウンで編集可能）
 */
function createSpreadsheetSubjectCell(currentSubject, rowIndex, width) {
  const cell = document.createElement("td");
  cell.style.cssText = `padding:8px; border-bottom:1px solid #e2e8f0; width:${width}; min-width:${width}; max-width:${width}; box-sizing:border-box;`;
  cell.dataset.colIndex = "1";
  cell.dataset.rowIndex = rowIndex;
  
  const select = document.createElement("select");
  select.style.cssText = "width:100%; padding:6px 8px; border:1px solid #e2e8f0; border-radius:4px; font-size:0.9rem; box-sizing:border-box;";
  select.dataset.rowIndex = rowIndex;
  
  // 既存の科目を追加
  if (currentMaterialData && currentMaterialData.subjects) {
    currentMaterialData.subjects.forEach((sub, idx) => {
      const option = document.createElement("option");
      option.value = sub.subjectName;
      option.textContent = sub.subjectName;
      if (sub.subjectName === currentSubject) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }
  
  select.onchange = () => {
    const newSubjectName = select.value;
    const item = window.spreadsheetProblemMap[rowIndex];
    if (item) {
      // 科目を変更
      const newSubject = currentMaterialData.subjects.find(s => s.subjectName === newSubjectName);
      if (newSubject && newSubject.fields.length > 0) {
        // 新しい科目の最初の分野に移動
        const newField = newSubject.fields[0];
        if (!newField.problems) newField.problems = [];
        
        // 古い分野から問題を削除
        const oldSubject = currentMaterialData.subjects[item.subjectIndex];
        const oldField = oldSubject.fields[item.fieldIndex];
        const probIndex = oldField.problems.findIndex(p => p === item.problem);
        if (probIndex >= 0) {
          oldField.problems.splice(probIndex, 1);
        }
        
        // 新しい分野に問題を追加
        newField.problems.push(item.problem);
        
        // マッピングを更新
        item.subject = newSubjectName;
        item.field = newField.fieldName;
        item.subjectIndex = currentMaterialData.subjects.findIndex(s => s.subjectName === newSubjectName);
        item.fieldIndex = 0;
        
        // 同じ行の分野ドロップダウンを更新
        const fieldCell = document.querySelector(`tr[data-row-index="${rowIndex}"] td[data-col-index="2"]`);
        if (fieldCell) {
          const fieldSelect = fieldCell.querySelector("select");
          if (fieldSelect) {
            fieldSelect.innerHTML = "";
            newSubject.fields.forEach((fld) => {
              const option = document.createElement("option");
              option.value = fld.fieldName;
              option.textContent = fld.fieldName;
              if (fld.fieldName === newField.fieldName) {
                option.selected = true;
              }
              fieldSelect.appendChild(option);
            });
          }
        }
        
        // スプレッドシートを再描画（マッピングを更新するため）
        renderSpreadsheet();
      }
    }
  };
  
  cell.appendChild(select);
  return cell;
}

/**
 * 分野セルを作成（ドロップダウンで編集可能）
 */
function createSpreadsheetFieldCell(currentField, currentSubject, rowIndex, width) {
  const cell = document.createElement("td");
  cell.style.cssText = `padding:8px; border-bottom:1px solid #e2e8f0; width:${width}; min-width:${width}; max-width:${width}; box-sizing:border-box;`;
  cell.dataset.colIndex = "2";
  cell.dataset.rowIndex = rowIndex;
  
  const select = document.createElement("select");
  select.style.cssText = "width:100%; padding:6px 8px; border:1px solid #e2e8f0; border-radius:4px; font-size:0.9rem; box-sizing:border-box;";
  select.dataset.rowIndex = rowIndex;
  
  // 現在の科目の分野を追加
  const subject = currentMaterialData.subjects.find(s => s.subjectName === currentSubject);
  if (subject && subject.fields) {
    subject.fields.forEach((fld, idx) => {
      const option = document.createElement("option");
      option.value = fld.fieldName;
      option.textContent = fld.fieldName;
      if (fld.fieldName === currentField) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }
  
  select.onchange = () => {
    const newFieldName = select.value;
    const item = window.spreadsheetProblemMap[rowIndex];
    if (item) {
      // 分野を変更
      const subject = currentMaterialData.subjects[item.subjectIndex];
      const newField = subject.fields.find(f => f.fieldName === newFieldName);
      if (newField) {
        // 古い分野から問題を削除
        const oldField = subject.fields[item.fieldIndex];
        const probIndex = oldField.problems.findIndex(p => p === item.problem);
        if (probIndex >= 0) {
          oldField.problems.splice(probIndex, 1);
        }
        
        // 新しい分野に問題を追加
        if (!newField.problems) newField.problems = [];
        newField.problems.push(item.problem);
        
        // マッピングを更新
        item.field = newFieldName;
        item.fieldIndex = subject.fields.findIndex(f => f.fieldName === newFieldName);
        
        // スプレッドシートを再描画
        renderSpreadsheet();
        markAsChanged();
      }
    }
  };
  
  cell.appendChild(select);
  return cell;
}

/**
 * 編集可能なセルを作成
 */
function createSpreadsheetEditableCell(value, onChange, width, rowIndex, colIndex) {
  const cell = document.createElement("td");
  cell.style.cssText = `padding:8px; border-bottom:1px solid #e2e8f0; width:${width}; min-width:${width}; max-width:${width}; box-sizing:border-box;`;
  cell.dataset.rowIndex = rowIndex;
  cell.dataset.colIndex = colIndex;
  
  const input = document.createElement("input");
  input.type = "text";
  input.value = value || "";
  input.style.cssText = "width:100%; padding:6px 8px; border:1px solid #e2e8f0; border-radius:4px; font-size:0.9rem; box-sizing:border-box;";
  input.dataset.rowIndex = rowIndex;
  input.dataset.colIndex = colIndex;
  
  input.onblur = () => {
    onChange(input.value);
  };
  
  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      input.blur();
      // 次の行の同じ列に移動
      const nextRow = document.querySelector(`tr[data-row-index="${parseInt(rowIndex) + 1}"]`);
      if (nextRow) {
        const nextCell = nextRow.querySelector(`td[data-col-index="${colIndex}"]`);
        if (nextCell) {
          const nextInput = nextCell.querySelector("input");
          if (nextInput) nextInput.focus();
        }
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      // 次のセルに移動
      const currentRow = input.closest("tr");
      const currentColIndex = parseInt(colIndex);
      let nextCell = null;
      
      if (e.shiftKey) {
        // Shift+Tab: 前のセル
        if (currentColIndex > 2) { // 編集可能な最初の列は2（ID）
          nextCell = currentRow.querySelector(`td[data-col-index="${currentColIndex - 1}"]`);
        }
      } else {
        // Tab: 次のセル
        if (currentColIndex < 6) { // 編集可能な最後の列は6（YouTube URL）
          nextCell = currentRow.querySelector(`td[data-col-index="${currentColIndex + 1}"]`);
        } else {
          // 次の行の最初の編集可能セルに移動
          const nextRow = document.querySelector(`tr[data-row-index="${parseInt(rowIndex) + 1}"]`);
          if (nextRow) {
            nextCell = nextRow.querySelector(`td[data-col-index="3"]`); // ID列
          }
        }
      }
      
      if (nextCell) {
        const nextInput = nextCell.querySelector("input");
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
    }
  };
  
  // コピー&ペースト用のイベント
  input.oncopy = (e) => {
    e.clipboardData.setData("text/plain", input.value);
  };
  
  input.onpaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text/plain");
    // 選択範囲がある場合はその範囲に、ない場合は現在のセルから
    const selected = document.querySelectorAll("#spreadsheet-table td.selected");
    if (selected.length > 0) {
      handlePaste(pastedText, rowIndex, colIndex);
    } else {
      handlePaste(pastedText, rowIndex, colIndex);
    }
  };
  
  // セルをクリックしたときに選択状態にする
  input.onfocus = () => {
    clearSelection();
    cell.classList.add("selected");
  };
  
  cell.appendChild(input);
  return cell;
}

/**
 * スプレッドシートのコピー&ペースト機能を設定
 */
function setupSpreadsheetCopyPaste() {
  const table = document.getElementById("spreadsheet-table");
  if (!table) return;
  
  // グローバル変数として選択状態を管理
  if (!window.spreadsheetSelection) {
    window.spreadsheetSelection = {
      cells: [],
      isSelecting: false,
      startCell: null
    };
  }
  
  const selection = window.spreadsheetSelection;
  
  // セル選択機能（クリックで単一セル、ドラッグで範囲選択）
  table.addEventListener("mousedown", (e) => {
    const cell = e.target.closest("td[data-col-index]");
    const input = e.target.closest("input");
    
    // ボタン列やボタン自体は除外
    if (cell && cell.querySelector("button") && !input) return;
    if (!cell || cell.dataset.colIndex === "8") return; // 操作列は除外
    
    // Shiftキーを押している場合は範囲選択を拡張
    if (e.shiftKey && selection.cells.length > 0) {
      const firstCell = selection.cells[0];
      clearSelection();
      selection.cells = getCellsInRange(firstCell, cell);
      selection.cells.forEach(c => c.classList.add("selected"));
      return;
    }
    
    selection.isSelecting = true;
    selection.startCell = cell;
    selection.cells = [cell];
    clearSelection();
    cell.classList.add("selected");
    
    // 入力フィールドの場合は選択を維持
    if (!input) {
      e.preventDefault();
    }
  });
  
  table.addEventListener("mousemove", (e) => {
    if (!selection.isSelecting || !selection.startCell) return;
    
    const cell = e.target.closest("td[data-col-index]");
    if (!cell || cell.querySelector("button") || cell.dataset.colIndex === "8") return;
    
    clearSelection();
    selection.cells = getCellsInRange(selection.startCell, cell);
    selection.cells.forEach(c => c.classList.add("selected"));
  });
  
  table.addEventListener("mouseup", () => {
    selection.isSelecting = false;
  });
  
  // キーボードショートカット
  const handleKeyDown = (e) => {
    const wrapper = document.getElementById("spreadsheet-wrapper");
    if (!wrapper || wrapper.offsetParent === null) return;
    
    // Ctrl+C でコピー
    if ((e.ctrlKey || e.metaKey) && e.key === "c") {
      const activeInput = document.activeElement;
      if (activeInput && activeInput.tagName === "INPUT" && activeInput.closest("#spreadsheet-table")) {
        // 選択セルがある場合は選択範囲をコピー、ない場合は現在のセルのみ
        const selected = document.querySelectorAll("#spreadsheet-table td.selected");
        if (selected.length > 0) {
          e.preventDefault();
          copySelectedCells();
        }
      }
    }
    
    // Ctrl+V でペースト
    if ((e.ctrlKey || e.metaKey) && e.key === "v") {
      const activeInput = document.activeElement;
      if (activeInput && activeInput.tagName === "INPUT" && activeInput.closest("#spreadsheet-table")) {
        // ペーストはinputのonpasteで処理（選択範囲がある場合はhandlePasteで処理）
        return;
      }
    }
    
    // Delete キーで選択セルをクリア
    const selected = document.querySelectorAll("#spreadsheet-table td.selected");
    if (e.key === "Delete" && selected.length > 0) {
      e.preventDefault();
      selected.forEach(cell => {
        const input = cell.querySelector("input");
        if (input) {
          input.value = "";
          input.dispatchEvent(new Event("blur", { bubbles: true }));
        }
      });
      saveAll();
    }
  };
  
  // 既存のイベントリスナーを削除してから追加
  document.removeEventListener("keydown", handleKeyDown);
  document.addEventListener("keydown", handleKeyDown);
  
  // 選択スタイル
  const style = document.createElement("style");
  style.textContent = `
    #spreadsheet-table td.selected {
      background: #bfdbfe !important;
      outline: 2px solid #3b82f6;
      outline-offset: -2px;
      position: relative;
    }
    #spreadsheet-table td.selected::after {
      content: '';
      position: absolute;
      inset: 0;
      border: 2px solid #3b82f6;
      pointer-events: none;
    }
    #spreadsheet-table td.selected input {
      background: #bfdbfe;
    }
    #spreadsheet-table tr:has(td.selected) {
      background: #eff6ff !important;
    }
  `;
  if (!document.getElementById("spreadsheet-style")) {
    style.id = "spreadsheet-style";
    document.head.appendChild(style);
  }
}

/**
 * セル範囲を取得
 */
function getCellsInRange(startCell, endCell) {
  const cells = [];
  const startRow = parseInt(startCell.dataset.rowIndex || startCell.closest("tr").dataset.rowIndex);
  const endRow = parseInt(endCell.dataset.rowIndex || endCell.closest("tr").dataset.rowIndex);
  const startCol = parseInt(startCell.dataset.colIndex);
  const endCol = parseInt(endCell.dataset.colIndex);
  
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);
  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);
  
  for (let r = minRow; r <= maxRow; r++) {
    const row = document.querySelector(`tr[data-row-index="${r}"]`);
    if (!row) continue;
    
    for (let c = minCol; c <= maxCol; c++) {
      const cell = row.querySelector(`td[data-col-index="${c}"]`);
      if (cell && !cell.querySelector("button")) { // ボタン列は除外
        cells.push(cell);
      }
    }
  }
  
  return cells;
}

/**
 * 選択をクリア
 */
function clearSelection() {
  document.querySelectorAll("#spreadsheet-table td.selected").forEach(cell => {
    cell.classList.remove("selected");
  });
}

/**
 * 選択されたセルをコピー
 */
function copySelectedCells() {
  const selected = document.querySelectorAll("#spreadsheet-table td.selected");
  if (selected.length === 0) return;
  
  // セルを行列に整理（範囲を保持）
  const rows = {};
  let minRow = Infinity, maxRow = -Infinity;
  let minCol = Infinity, maxCol = -Infinity;
  
  selected.forEach(cell => {
    const rowIndex = parseInt(cell.dataset.rowIndex || cell.closest("tr").dataset.rowIndex);
    const colIndex = parseInt(cell.dataset.colIndex);
    
    if (!rows[rowIndex]) rows[rowIndex] = {};
    const input = cell.querySelector("input");
    rows[rowIndex][colIndex] = input ? input.value : cell.textContent.trim();
    
    minRow = Math.min(minRow, rowIndex);
    maxRow = Math.max(maxRow, rowIndex);
    minCol = Math.min(minCol, colIndex);
    maxCol = Math.max(maxCol, colIndex);
  });
  
  // 矩形範囲としてタブ区切りでコピー（空セルも含める）
  const lines = [];
  for (let r = minRow; r <= maxRow; r++) {
    const line = [];
    for (let c = minCol; c <= maxCol; c++) {
      if (rows[r] && rows[r][c] !== undefined) {
        line.push(rows[r][c]);
      } else {
        line.push(""); // 空セル
      }
    }
    lines.push(line.join("\t"));
  }
  
  const text = lines.join("\n");
  navigator.clipboard.writeText(text).then(() => {
    showToast(`${selected.length}個のセルをコピーしました`);
  }).catch(() => {
    // フォールバック
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    showToast(`${selected.length}個のセルをコピーしました`);
  });
}

/**
 * ペースト処理
 */
function handlePaste(pastedText, startRowIndex, startColIndex) {
  const lines = pastedText.split("\n").filter(line => line.trim() || line.includes("\t"));
  if (lines.length === 0) return;
  
  const tbody = document.getElementById("spreadsheet-tbody");
  if (!tbody) return;
  
  // 選択されたセルがある場合は、その範囲に貼り付け
  const selected = document.querySelectorAll("#spreadsheet-table td.selected");
  if (selected.length > 0) {
    // 選択範囲の最初のセルを取得
    let minRow = Infinity, minCol = Infinity;
    selected.forEach(cell => {
      const rowIndex = parseInt(cell.dataset.rowIndex || cell.closest("tr").dataset.rowIndex);
      const colIndex = parseInt(cell.dataset.colIndex);
      minRow = Math.min(minRow, rowIndex);
      minCol = Math.min(minCol, colIndex);
    });
    
    const firstRowIndex = minRow;
    const firstColIndex = minCol;
    
    lines.forEach((line, lineIdx) => {
      const values = line.split("\t");
      const rowIndex = firstRowIndex + lineIdx;
      let row = document.querySelector(`tr[data-row-index="${rowIndex}"]`);
      
      // 行が存在しない場合は作成
      if (!row && rowIndex >= 0) {
        // 問題データも作成
        const firstSubject = currentMaterialData.subjects[0];
        const firstField = firstSubject?.fields[0];
        if (!firstField.problems) firstField.problems = [];
        
        const newProblem = {
          id: "",
          title: "",
          desc: "",
          explanationPath: "",
          youtubeUrl: "",
          isPublic: true
        };
        firstField.problems.push(newProblem);
        
        row = createSpreadsheetRow(rowIndex, newProblem, firstSubject.subjectName, firstField.fieldName);
        tbody.appendChild(row);
        
        // 行インデックスを更新
        updateRowIndices();
      }
      
      if (!row) return;
      
      values.forEach((value, colIdx) => {
        const colIndex = firstColIndex + colIdx;
        if (colIndex < 2 || colIndex > 6) return; // 編集可能な列のみ（2-6）
        
        const cell = row.querySelector(`td[data-col-index="${colIndex}"]`);
        if (!cell) return;
        
        const input = cell.querySelector("input");
        if (input) {
          input.value = value.trim();
          input.dispatchEvent(new Event("blur", { bubbles: true }));
        }
      });
    });
  } else {
    // 選択がない場合は従来通り（現在のセルから）
    lines.forEach((line, lineIdx) => {
      const values = line.split("\t");
      const rowIndex = parseInt(startRowIndex) + lineIdx;
      let row = document.querySelector(`tr[data-row-index="${rowIndex}"]`);
      
      // 行が存在しない場合は作成
      if (!row && rowIndex >= 0) {
        const firstSubject = currentMaterialData.subjects[0];
        const firstField = firstSubject?.fields[0];
        if (!firstField.problems) firstField.problems = [];
        
        const newProblem = {
          id: "",
          title: "",
          desc: "",
          explanationPath: "",
          youtubeUrl: "",
          isPublic: true
        };
        firstField.problems.push(newProblem);
        
        row = createSpreadsheetRow(rowIndex, newProblem, firstSubject.subjectName, firstField.fieldName);
        tbody.appendChild(row);
        updateRowIndices();
      }
      
      if (!row) return;
      
      values.forEach((value, colIdx) => {
        const colIndex = parseInt(startColIndex) + colIdx;
        if (colIndex < 2 || colIndex > 6) return; // 編集可能な列のみ（2-6）
        
        const cell = row.querySelector(`td[data-col-index="${colIndex}"]`);
        if (!cell) return;
        
        const input = cell.querySelector("input");
        if (input) {
          input.value = value.trim();
          input.dispatchEvent(new Event("blur", { bubbles: true }));
        }
      });
    });
  }
  
  clearSelection();
  // saveAll()は呼ばない（一括保存ボタンで保存）
  showToast(`${lines.length}行を貼り付けました（一括保存ボタンで保存してください）`);
}

/**
 * 行インデックスを更新（行削除後に呼び出す）
 */
function updateRowIndices() {
  const rows = document.querySelectorAll("#spreadsheet-tbody tr");
  rows.forEach((row, index) => {
    row.dataset.rowIndex = index;
    const inputs = row.querySelectorAll("input");
    inputs.forEach(input => {
      input.dataset.rowIndex = index;
    });
    const cells = row.querySelectorAll("td[data-col-index]");
    cells.forEach(cell => {
      cell.dataset.rowIndex = index;
    });
  });
}

/**
 * 一括編集画面から科目を追加
 */
function handleAddSubjectFromSpreadsheet() {
  if (isCloudMode) {
    showToast("閲覧専用モードのため編集できません", true);
    return;
  }
  
  const subjectName = prompt("科目名を入力してください:");
  if (!subjectName || !subjectName.trim()) return;
  
  const folderName = prompt("フォルダ名（英数字推奨）:", subjectName.trim());
  if (folderName === null) return;
  
  if (!currentMaterialData.subjects) {
    currentMaterialData.subjects = [];
  }
  
  const newSubject = {
    subjectName: subjectName.trim(),
    folderName: folderName || "",
    fields: []
  };
  
  currentMaterialData.subjects.push(newSubject);
  
  // フォルダ即時作成
  if (folderName && explanationsDirHandle) {
    getMaterialDirHandle()
      .then((d) => d.getDirectoryHandle(folderName, { create: true }))
      .catch(console.warn);
  }
  
  renderSpreadsheet();
  markAsChanged();
  showToast("科目を追加しました（一括保存ボタンで保存してください）");
}

/**
 * 一括編集画面から分野を追加（admin-actionsのhandleAddFieldと同等）
 */
function handleAddFieldFromSpreadsheet() {
  if (isCloudMode) {
    showToast("閲覧専用モードのため編集できません", true);
    return;
  }
  
  if (!currentMaterialData.subjects || currentMaterialData.subjects.length === 0) {
    showToast("まず科目を追加してください", true);
    return;
  }
  
  const subjectNames = currentMaterialData.subjects.map(s => s.subjectName);
  let subjectIndex = 0;
  if (subjectNames.length > 1) {
    const sel = prompt(`科目を選択:\n${subjectNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\n番号:`);
    if (!sel) return;
    subjectIndex = parseInt(sel) - 1;
    if (subjectIndex < 0 || subjectIndex >= currentMaterialData.subjects.length) {
      showToast("無効な番号です", true);
      return;
    }
  }
  
  const subject = currentMaterialData.subjects[subjectIndex];
  
  let defaultName = "新規分野";
  let hintId = "01";
  if (manifestData[activeMaterialIndex]?.id === "textbook") {
    const existingParts = [...new Set(
      subject.fields.map(f => f.fieldName.split(" / ")).filter(p => p.length > 1).map(p => p[0])
    )];
    if (existingParts.length > 0) {
      defaultName = `${existingParts[existingParts.length - 1]} / 新規章`;
      hintId = "01/02";
    } else {
      defaultName = "第1編 力と運動 / 第1章 剛体";
      hintId = "01/01";
    }
  }
  
  const fieldName = prompt(`分野名（表示名）:\n※「編 / 章」形式で階層化可能`, defaultName);
  if (!fieldName || !fieldName.trim()) return;
  
  const folderId = prompt(`フォルダID（ディレクトリ名）:\n※「01/01」のように階層化可能`, hintId);
  if (folderId === null) return;
  
  // フォルダ即時作成
  if (folderId && !isCloudMode) {
    getMaterialDirHandle().then(async (matDir) => {
      try {
        let subDir = matDir;
        if (subject.folderName) {
          subDir = await matDir.getDirectoryHandle(subject.folderName, { create: true });
        }
        await getDeepDirectoryHandle(subDir, folderId, true);
      } catch (e) { console.warn("FS Create Warn:", e); }
    });
  }
  
  if (!subject.fields) subject.fields = [];
  subject.fields.push({
    fieldName: fieldName.trim(),
    folderId: folderId || "",
    problems: []
  });
  
  renderSpreadsheet();
  markAsChanged();
  showToast("分野を追加しました（一括保存ボタンで保存してください）");
}

/**
 * 一括編集画面から科目をリネーム（ツリーのhandleRenameSubjectと同等）
 */
function handleRenameSubjectFromSpreadsheet() {
  if (isCloudMode) { showToast("閲覧専用モードのため編集できません", true); return; }
  if (!currentMaterialData.subjects || currentMaterialData.subjects.length === 0) {
    showToast("科目がありません", true); return;
  }
  const subjectNames = currentMaterialData.subjects.map(s => s.subjectName);
  let subjectIndex = 0;
  if (subjectNames.length > 1) {
    const sel = prompt(`リネームする科目を選択:\n${subjectNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\n番号:`);
    if (!sel) return;
    subjectIndex = parseInt(sel) - 1;
    if (subjectIndex < 0 || subjectIndex >= currentMaterialData.subjects.length) {
      showToast("無効な番号です", true); return;
    }
  }
  const sub = currentMaterialData.subjects[subjectIndex];
  const newName = prompt("科目名を変更:", sub.subjectName);
  if (!newName || newName === sub.subjectName) return;
  
  const oldFolder = sub.folderName;
  sub.subjectName = newName;
  
  // フォルダ名も変更するか
  if (oldFolder && confirm(`フォルダ名も "${oldFolder}" → "${newName}" に変更しますか？`)) {
    sub.folderName = newName;
    if (oldFolder.length > 0 && !isCloudMode) {
      getMaterialDirHandle().then(matDir => {
        fsRenameFolder(matDir, oldFolder, newName).catch(e => console.warn("Rename warn:", e));
      });
    }
    if (oldFolder.length > 0) {
      sub.fields.forEach(f => {
        f.problems.forEach(p => {
          if (p.explanationPath) {
            p.explanationPath = p.explanationPath.split("/").map(part => part === oldFolder ? newName : part).join("/");
          }
        });
      });
    }
  }
  
  renderSpreadsheet();
  markAsChanged();
  showToast("科目名を変更しました（一括保存ボタンで保存してください）");
}

/**
 * 一括編集画面から分野をリネーム（ツリーのhandleRenameFieldと同等）
 */
function handleRenameFieldFromSpreadsheet() {
  if (isCloudMode) { showToast("閲覧専用モードのため編集できません", true); return; }
  if (!currentMaterialData.subjects || currentMaterialData.subjects.length === 0) {
    showToast("科目がありません", true); return;
  }
  const subjectNames = currentMaterialData.subjects.map(s => s.subjectName);
  let subjectIndex = 0;
  if (subjectNames.length > 1) {
    const sel = prompt(`科目を選択:\n${subjectNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\n番号:`);
    if (!sel) return;
    subjectIndex = parseInt(sel) - 1;
    if (subjectIndex < 0 || subjectIndex >= currentMaterialData.subjects.length) {
      showToast("無効な番号です", true); return;
    }
  }
  const subject = currentMaterialData.subjects[subjectIndex];
  if (!subject.fields || subject.fields.length === 0) {
    showToast("分野がありません", true); return;
  }
  const fieldNames = subject.fields.map(f => f.fieldName);
  const sel2 = prompt(`分野を選択:\n${fieldNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\n番号:`);
  if (!sel2) return;
  const fieldIndex = parseInt(sel2) - 1;
  if (fieldIndex < 0 || fieldIndex >= subject.fields.length) {
    showToast("無効な番号です", true); return;
  }
  const fld = subject.fields[fieldIndex];
  const newName = prompt(`分野名を変更:\n※「編 / 章」形式も可能`, fld.fieldName);
  if (!newName || newName === fld.fieldName) return;
  fld.fieldName = newName;
  
  renderSpreadsheet();
  markAsChanged();
  showToast("分野名を変更しました（一括保存ボタンで保存してください）");
}

/**
 * 行のドラッグ&ドロップ並び替えを設定
 */
function setupSpreadsheetDragDrop() {
  const tbody = document.getElementById("spreadsheet-tbody");
  if (!tbody) return;
  
  let dragRow = null;
  
  tbody.querySelectorAll("tr").forEach(row => {
    row.draggable = true;
    
    row.addEventListener("dragstart", (e) => {
      dragRow = row;
      row.style.opacity = "0.4";
      e.dataTransfer.effectAllowed = "move";
    });
    
    row.addEventListener("dragend", () => {
      row.style.opacity = "";
      tbody.querySelectorAll("tr").forEach(r => {
        r.style.borderTop = "";
        r.style.borderBottom = "";
      });
      dragRow = null;
    });
    
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (dragRow === row) return;
      row.style.borderTop = "3px solid #3b82f6";
    });
    
    row.addEventListener("dragleave", () => {
      row.style.borderTop = "";
    });
    
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      row.style.borderTop = "";
      if (!dragRow || dragRow === row) return;
      
      const fromIdx = parseInt(dragRow.dataset.rowIndex);
      const toIdx = parseInt(row.dataset.rowIndex);
      
      const fromItem = window.spreadsheetProblemMap[fromIdx];
      const toItem = window.spreadsheetProblemMap[toIdx];
      
      if (!fromItem || !toItem) return;
      
      const fromSubject = currentMaterialData.subjects[fromItem.subjectIndex];
      const fromField = fromSubject.fields[fromItem.fieldIndex];
      const toSubject = currentMaterialData.subjects[toItem.subjectIndex];
      const toField = toSubject.fields[toItem.fieldIndex];
      
      // 元のフィールドから削除
      const probIdx = fromField.problems.indexOf(fromItem.problem);
      if (probIdx >= 0) fromField.problems.splice(probIdx, 1);
      
      // 先のフィールドに挿入
      const targetIdx = toField.problems.indexOf(toItem.problem);
      if (targetIdx >= 0) {
        toField.problems.splice(targetIdx, 0, fromItem.problem);
      } else {
        toField.problems.push(fromItem.problem);
      }
      
      renderSpreadsheet();
      markAsChanged();
    });
  });
}

/**
 * 一括編集画面から科目を削除
 */
function handleDeleteSubjectFromSpreadsheet() {
  if (isCloudMode) {
    showToast("閲覧専用モードのため編集できません", true);
    return;
  }
  
  if (!currentMaterialData.subjects || currentMaterialData.subjects.length === 0) {
    showToast("削除する科目がありません", true);
    return;
  }
  
  // 科目を選択
  const subjectNames = currentMaterialData.subjects.map(s => s.subjectName);
  const selectedSubjectName = prompt(`削除する科目を選択してください:\n${subjectNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\n番号を入力:`);
  if (!selectedSubjectName) return;
  
  const subjectIndex = parseInt(selectedSubjectName) - 1;
  if (subjectIndex < 0 || subjectIndex >= currentMaterialData.subjects.length) {
    showToast("無効な番号です", true);
    return;
  }
  
  const subject = currentMaterialData.subjects[subjectIndex];
  
  // 確認
  const problemCount = subject.fields.reduce((sum, f) => sum + (f.problems ? f.problems.length : 0), 0);
  if (!confirm(`【警告】「${subject.subjectName}」を削除しますか？\nこの科目に含まれる${problemCount}個の問題も削除されます。`)) {
    return;
  }
  
  // 科目を削除
  currentMaterialData.subjects.splice(subjectIndex, 1);
  
  // スプレッドシートを再描画
  renderSpreadsheet();
  markAsChanged();
  showToast("科目を削除しました（一括保存ボタンで保存してください）");
}

/**
 * 一括編集画面から分野を削除
 */
function handleDeleteFieldFromSpreadsheet() {
  if (isCloudMode) {
    showToast("閲覧専用モードのため編集できません", true);
    return;
  }
  
  if (!currentMaterialData.subjects || currentMaterialData.subjects.length === 0) {
    showToast("削除する分野がありません", true);
    return;
  }
  
  // 科目を選択
  const subjectNames = currentMaterialData.subjects.map(s => s.subjectName);
  const selectedSubjectName = prompt(`分野が属する科目を選択してください:\n${subjectNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\n番号を入力:`);
  if (!selectedSubjectName) return;
  
  const subjectIndex = parseInt(selectedSubjectName) - 1;
  if (subjectIndex < 0 || subjectIndex >= currentMaterialData.subjects.length) {
    showToast("無効な番号です", true);
    return;
  }
  
  const subject = currentMaterialData.subjects[subjectIndex];
  
  if (!subject.fields || subject.fields.length === 0) {
    showToast("この科目に分野がありません", true);
    return;
  }
  
  // 分野を選択
  const fieldNames = subject.fields.map(f => f.fieldName);
  const selectedFieldName = prompt(`削除する分野を選択してください:\n${fieldNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\n番号を入力:`);
  if (!selectedFieldName) return;
  
  const fieldIndex = parseInt(selectedFieldName) - 1;
  if (fieldIndex < 0 || fieldIndex >= subject.fields.length) {
    showToast("無効な番号です", true);
    return;
  }
  
  const field = subject.fields[fieldIndex];
  
  // 確認
  const problemCount = field.problems ? field.problems.length : 0;
  if (!confirm(`【警告】「${field.fieldName}」を削除しますか？\nこの分野に含まれる${problemCount}個の問題も削除されます。`)) {
    return;
  }
  
  // 分野を削除
  subject.fields.splice(fieldIndex, 1);
  
  // スプレッドシートを再描画
  renderSpreadsheet();
  markAsChanged();
  showToast("分野を削除しました（一括保存ボタンで保存してください）");
}

/**
 * 新しい行を追加（最後に追加）
 */
function addNewRowToSpreadsheet() {
  if (!currentMaterialData || !currentMaterialData.subjects || currentMaterialData.subjects.length === 0) {
    showToast("教材データが読み込まれていません", true);
    return;
  }
  
  // 最初の科目・分野に追加
  const firstSubject = currentMaterialData.subjects[0];
  if (!firstSubject || !firstSubject.fields || firstSubject.fields.length === 0) {
    showToast("科目または分野がありません", true);
    return;
  }
  
  const firstField = firstSubject.fields[0];
  if (!firstField.problems) {
    firstField.problems = [];
  }
  
  // 新しい問題を作成
  const newProblem = {
    id: `new_${Date.now()}`,
    title: "新規問題",
    desc: "",
    explanationPath: "",
    youtubeUrl: "",
    isPublic: true
  };
  
  firstField.problems.push(newProblem);
  
  // スプレッドシートを再描画
  renderSpreadsheet();
  markAsChanged();
  showToast("新しい行を追加しました（一括保存ボタンで保存してください）");
  
  // 追加した行の最初の入力欄にフォーカス
  setTimeout(() => {
    const tbody = document.getElementById("spreadsheet-tbody");
    if (tbody) {
      const lastRow = tbody.lastElementChild;
      if (lastRow) {
        const firstInput = lastRow.querySelector("td[data-col-index='3'] input");
        if (firstInput) {
          firstInput.focus();
          firstInput.select();
        }
      }
    }
  }, 100);
}

/**
 * 選択行の上に行を挿入
 */
function insertRowAboveSelection() {
  const selectedCells = document.querySelectorAll("#spreadsheet-table td.selected");
  if (selectedCells.length === 0) {
    showToast("挿入位置を選択してください", true);
    return;
  }
  
  // 最初に選択されたセルの行を取得
  const firstCell = selectedCells[0];
  const targetRow = firstCell.closest("tr");
  const targetRowIndex = parseInt(targetRow.dataset.rowIndex);
  
  if (targetRowIndex < 0 || !window.spreadsheetProblemMap[targetRowIndex]) {
    showToast("挿入位置が無効です", true);
    return;
  }
  
  const targetItem = window.spreadsheetProblemMap[targetRowIndex];
  const subject = currentMaterialData.subjects[targetItem.subjectIndex];
  const field = subject.fields[targetItem.fieldIndex];
  
  if (!field.problems) {
    field.problems = [];
  }
  
  // 新しい問題を作成
  const newProblem = {
    id: `new_${Date.now()}`,
    title: "新規問題",
    desc: "",
    explanationPath: "",
    youtubeUrl: "",
    isPublic: true
  };
  
  // 対象行のインデックスを取得
  const probIndex = field.problems.findIndex(p => p === targetItem.problem);
  if (probIndex >= 0) {
    field.problems.splice(probIndex, 0, newProblem);
  } else {
    field.problems.push(newProblem);
  }
  
  // スプレッドシートを再描画
  renderSpreadsheet();
  markAsChanged();
  showToast("行を挿入しました（一括保存ボタンで保存してください）");
  
  // 挿入した行の最初の入力欄にフォーカス
  setTimeout(() => {
    const tbody = document.getElementById("spreadsheet-tbody");
    if (tbody) {
      const insertedRow = tbody.querySelector(`tr[data-row-index="${targetRowIndex}"]`);
      if (insertedRow) {
        const firstInput = insertedRow.querySelector("td[data-col-index='3'] input");
        if (firstInput) {
          firstInput.focus();
          firstInput.select();
        }
      }
    }
  }, 100);
}

/**
 * 選択された行を削除
 */
function deleteSelectedRows() {
  const selectedRows = [];
  const selectedCells = document.querySelectorAll("#spreadsheet-table td.selected");
  
  // 選択されたセルから行を取得
  selectedCells.forEach(cell => {
    const row = cell.closest("tr");
    if (row && !selectedRows.includes(row)) {
      selectedRows.push(row);
    }
  });
  
  if (selectedRows.length === 0) {
    showToast("削除する行を選択してください", true);
    return;
  }
  
  if (!confirm(`${selectedRows.length}行を削除しますか？`)) {
    return;
  }
  
  const rowsToDelete = [];
  selectedRows.forEach(row => {
    const rowIndex = parseInt(row.dataset.rowIndex);
    if (rowIndex >= 0 && window.spreadsheetProblemMap[rowIndex]) {
      rowsToDelete.push(rowIndex);
    }
  });
  
  // 逆順にソートして削除（インデックスがずれないように）
  rowsToDelete.sort((a, b) => b - a).forEach(rowIndex => {
    const item = window.spreadsheetProblemMap[rowIndex];
    if (item && item.problem) {
      const subject = currentMaterialData.subjects[item.subjectIndex];
      const field = subject?.fields[item.fieldIndex];
      if (field && field.problems) {
        const probIndex = field.problems.findIndex(p => p === item.problem);
        if (probIndex >= 0) {
          field.problems.splice(probIndex, 1);
        }
      }
    }
  });
  
  // スプレッドシートを再描画
  renderSpreadsheet();
  markAsChanged();
  showToast(`${rowsToDelete.length}行を削除しました（一括保存ボタンで保存してください）`);
}

/**
 * スプレッドシートの行を作成（新規追加用）
 */
function createSpreadsheetRow(rowIndex, prob, subject, field) {
  const row = document.createElement("tr");
  row.dataset.rowIndex = rowIndex;
  row.style.cssText = rowIndex % 2 === 0 ? "background:#fff;" : "background:#f8fafc;";
  row.style.cssText += "transition:background 0.2s;";
  
  row.onmouseenter = () => {
    row.style.background = "#eff6ff";
  };
  row.onmouseleave = () => {
    row.style.background = rowIndex % 2 === 0 ? "#fff" : "#f8fafc";
  };
  
  const columnWidths = {
    subject: "120px",
    field: "200px",
    id: "150px",
    title: "250px",
    desc: "300px",
    path: "300px",
    youtube: "300px",
    public: "100px",
    actions: "120px"
  };
  
  if (!prob) {
    prob = {
      id: "",
      title: "",
      desc: "",
      explanationPath: "",
      youtubeUrl: "",
      isPublic: true
    };
  }
  
  if (!subject) subject = currentMaterialData.subjects[0]?.subjectName || "";
  if (!field) field = currentMaterialData.subjects[0]?.fields[0]?.fieldName || "";
  
  // 問題データのマッピングを保存
  if (!window.spreadsheetProblemMap) window.spreadsheetProblemMap = [];
  window.spreadsheetProblemMap[rowIndex] = {
    problem: prob,
    subject: subject,
    field: field,
    subjectIndex: currentMaterialData.subjects.findIndex(s => s.subjectName === subject),
    fieldIndex: currentMaterialData.subjects.find(s => s.subjectName === subject)
      ?.fields.findIndex(f => f.fieldName === field)
  };
  
  // 科目（編集可能なドロップダウン）
  const cell1 = createSpreadsheetSubjectCell(subject, rowIndex, columnWidths.subject);
  cell1.dataset.colIndex = "0";
  row.appendChild(cell1);
  
  // 分野（編集可能なドロップダウン）
  const cell2 = createSpreadsheetFieldCell(field, subject, rowIndex, columnWidths.field);
  cell2.dataset.colIndex = "1";
  row.appendChild(cell2);
  
  // ID（編集可能）- 一括保存まで保存しない
  const cell3 = createSpreadsheetEditableCell(prob.id || "", (val) => {
    prob.id = val;
  }, columnWidths.id, rowIndex, 2);
  row.appendChild(cell3);
  
  // タイトル（編集可能）
  const cell4 = createSpreadsheetEditableCell(prob.title || "", (val) => {
    prob.title = val;
  }, columnWidths.title, rowIndex, 3);
  row.appendChild(cell4);
  
  // 説明文（編集可能）
  const cell5 = createSpreadsheetEditableCell(prob.desc || "", (val) => {
    prob.desc = val;
  }, columnWidths.desc, rowIndex, 4);
  row.appendChild(cell5);
  
  // 解説パス（編集可能）
  const cell6 = createSpreadsheetEditableCell(prob.explanationPath || "", (val) => {
    prob.explanationPath = val;
  }, columnWidths.path, rowIndex, 5);
  row.appendChild(cell6);
  
  // YouTube URL（編集可能）
  const cell7 = createSpreadsheetEditableCell(prob.youtubeUrl || "", (val) => {
    prob.youtubeUrl = val;
  }, columnWidths.youtube, rowIndex, 6);
  row.appendChild(cell7);
  
  // 公開設定（トグルボタン）
  const cell8 = document.createElement("td");
  cell8.style.cssText = `padding:12px; border-bottom:1px solid #e2e8f0; width:${columnWidths.public}; min-width:${columnWidths.public}; max-width:${columnWidths.public}; box-sizing:border-box;`;
  cell8.dataset.colIndex = "7";
  const toggleBtn = document.createElement("button");
  const isPublic = prob.isPublic !== false;
  toggleBtn.textContent = isPublic ? "🔓 公開" : "🔒 非公開";
  toggleBtn.style.cssText = isPublic
    ? "padding:6px 12px; background:#10b981; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.85rem; width:100%;"
        : "padding:6px 12px; background:#ef4444; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.85rem; width:100%;";
    toggleBtn.onclick = () => {
      prob.isPublic = !prob.isPublic;
      const newIsPublic = prob.isPublic !== false;
      toggleBtn.textContent = newIsPublic ? "🔓 公開" : "🔒 非公開";
      toggleBtn.style.cssText = newIsPublic
        ? "padding:6px 12px; background:#10b981; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.85rem; width:100%;"
        : "padding:6px 12px; background:#ef4444; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.85rem; width:100%;";
      // saveAll()は呼ばない（一括保存ボタンで保存）
    };
  cell8.appendChild(toggleBtn);
  row.appendChild(cell8);
  
  // 操作列（詳細設定ボタン）
  const cell9 = document.createElement("td");
  cell9.style.cssText = `padding:8px; border-bottom:1px solid #e2e8f0; width:${columnWidths.actions}; min-width:${columnWidths.actions}; max-width:${columnWidths.actions}; box-sizing:border-box;`;
  cell9.dataset.colIndex = "8";
  const detailBtn = document.createElement("button");
  detailBtn.textContent = "詳細";
  detailBtn.style.cssText = "padding:6px 12px; background:#3b82f6; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.85rem; width:100%;";
  detailBtn.onclick = () => {
    openEditor(prob);
  };
  cell9.appendChild(detailBtn);
  row.appendChild(cell9);
  
  return row;
}

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
    if(ui.tabSpreadsheet) ui.tabSpreadsheet.classList.remove("active");
    if(ui.tabPreview) ui.tabPreview.classList.remove("active");
    if(ui.tabAnalyze) ui.tabAnalyze.classList.remove("active");
    if(ui.tabRequests) ui.tabRequests.classList.remove("active");
    
    if(ui.viewEditor) ui.viewEditor.classList.remove("active");
    if(ui.viewSpreadsheet) ui.viewSpreadsheet.classList.remove("active");
    if(ui.viewPreview) ui.viewPreview.classList.remove("active");
    if(ui.viewAnalyze) ui.viewAnalyze.classList.remove("active");
    if(ui.viewRequests) ui.viewRequests.classList.remove("active");
  };

  if(ui.tabEdit) {
    ui.tabEdit.onclick = () => {
      // 未保存の変更がある場合は確認
      if (hasUnsavedChanges && ui.viewSpreadsheet && ui.viewSpreadsheet.classList.contains("active")) {
        if (!confirm("変更を破棄しますか？\n（一括保存ボタンで保存できます）")) {
          return;
        }
        hasUnsavedChanges = false;
      }
      resetActive();
      ui.tabEdit.classList.add("active");
      ui.viewEditor.classList.add("active");
      
      // 個別編集画面では個々の問題タイトルID情報を表示
      if (ui.editingTitle) ui.editingTitle.style.display = "";
      if (ui.editingId) ui.editingId.style.display = "";
      const editorHeader = document.querySelector(".editor-header");
      if (editorHeader) editorHeader.style.display = "";
    };
  }

  if(ui.tabSpreadsheet) {
    ui.tabSpreadsheet.onclick = () => {
      resetActive();
      ui.tabSpreadsheet.classList.add("active");
      ui.viewSpreadsheet.classList.add("active");
      
      // 一括編集画面では個々の問題タイトルID情報を非表示
      if (ui.editingTitle) ui.editingTitle.style.display = "none";
      if (ui.editingId) ui.editingId.style.display = "none";
      const editorHeader = document.querySelector(".editor-header");
      if (editorHeader) editorHeader.style.display = "none";
      
      renderSpreadsheet();
    };
  }

  if(ui.tabPreview) {
    ui.tabPreview.onclick = () => {
      // 未保存の変更がある場合は確認
      if (hasUnsavedChanges && ui.viewSpreadsheet && ui.viewSpreadsheet.classList.contains("active")) {
        if (!confirm("変更を破棄しますか？\n（一括保存ボタンで保存できます）")) {
          return;
        }
        hasUnsavedChanges = false;
      }
      resetActive();
      ui.tabPreview.classList.add("active");
      ui.viewPreview.classList.add("active");
      updatePreview();
    };
  }
  
  if(ui.tabAnalyze) {
    ui.tabAnalyze.onclick = async () => {
      // 未保存の変更がある場合は確認
      if (hasUnsavedChanges && ui.viewSpreadsheet && ui.viewSpreadsheet.classList.contains("active")) {
        if (!confirm("変更を破棄しますか？\n（一括保存ボタンで保存できます）")) {
          return;
        }
        hasUnsavedChanges = false;
      }
      resetActive();
      ui.tabAnalyze.classList.add("active");
      ui.viewAnalyze.classList.add("active");
      await renderAnalysis();
    };
  }

  if (ui.tabRequests && ui.viewRequests) {
    ui.tabRequests.onclick = () => {
      resetActive();
      ui.tabRequests.classList.add("active");
      ui.viewRequests.classList.add("active");
      if (ui.editingTitle) ui.editingTitle.style.display = "none";
      if (ui.editingId) ui.editingId.style.display = "none";
      const editorHeader = document.querySelector(".editor-header");
      if (editorHeader) editorHeader.style.display = "none";
      renderAdminContentRequests();
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
 * 管理画面: コンテンツ作成リクエスト一覧を Firestore から取得して表示
 */
function renderAdminContentRequests() {
  const listEl = ui.adminRequestsList;
  if (!listEl) return;
  listEl.innerHTML = "読み込み中...";
  if (!window.db) {
    listEl.innerHTML = "<p>Firebase未設定のためリクエスト一覧を表示できません。</p>";
    return;
  }
  const esc = (s) => {
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };
  window.db.collection("content_requests").orderBy("timestamp", "desc").limit(100).get()
    .then((snap) => {
      if (snap.empty) {
        listEl.innerHTML = "<p>リクエストはまだありません。</p>";
        return;
      }
      let html = '<ul style="list-style:none;padding:0;margin:0">';
      snap.forEach((d) => {
        const t = d.data();
        const typeLabel = t.type === "html" ? "HTML解説" : "動画";
        const ts = t.timestamp && (t.timestamp.toDate ? t.timestamp.toDate() : t.timestamp);
        const timeStr = ts ? (ts.getFullYear() + "/" + (ts.getMonth() + 1) + "/" + ts.getDate() + " " + ts.getHours() + ":" + String(ts.getMinutes()).padStart(2, "0")) : "";
        html += '<li style="padding:8px 0;border-bottom:1px solid #e2e8f0">';
        html += '<span style="padding:2px 8px;border-radius:6px;font-size:0.75rem;font-weight:600;margin-right:8px;' + (t.type === "html" ? "background:#dbeafe;color:#1d4ed8" : "background:#fef3c7;color:#b45309") + '">' + esc(typeLabel) + "</span> ";
        html += "<strong>" + esc(t.problemTitle || "") + "</strong> ";
        html += "<span style=\"color:#64748b;font-size:0.85rem\">" + esc(t.materialName || "") + " / " + esc(t.fieldName || "") + "</span>";
        html += " <span style=\"color:#94a3b8;font-size:0.8rem\">" + esc(timeStr) + "</span>";
        html += "</li>";
      });
      html += "</ul>";
      listEl.innerHTML = html;
    })
    .catch((err) => {
      console.warn("content_requests get failed", err);
      listEl.innerHTML = "<p>リクエスト一覧の取得に失敗しました。</p>";
    });
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