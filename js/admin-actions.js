// js/admin-actions.js

// --- Actions & Business Logic ---

async function loadMaterial(index) {
  if (index < 0 || index >= manifestData.length) return;

  // ★修正: 開いたタブのインデックスを保存
  activeMaterialIndex = index;
  localStorage.setItem("admin_last_material_index", index);

  const item = manifestData[index];
  currentMaterialPath = item.path;
  currentMaterialType = item.type || "standard";

  if (currentMaterialType === "exam_year")
    ui.btnAddSubject.textContent = "＋年度を追加";
  else if (currentMaterialType === "exam_univ")
    ui.btnAddSubject.textContent = "＋大学を追加";
  else ui.btnAddSubject.textContent = "＋分野を追加";

  try {
    const parts = item.path.split("/");
    let dir = rootDirHandle;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i]);
    }
    const fh = await dir.getFileHandle(parts[parts.length - 1]);
    const file = await fh.getFile();
    currentMaterialData = JSON.parse(await file.text());
  } catch (e) {
    console.error(e);
    showToast(`教材読込失敗: ${item.name}`, true);
    currentMaterialData = { materialName: item.name, subjects: [] };
  }
  renderApp();
}

async function saveAll() {
  if (!rootDirHandle) return;
  saveOpenStates();

  try {
    const dataDir = await rootDirHandle.getDirectoryHandle("data");
    const matDir = await dataDir.getDirectoryHandle("materials", {
      create: true,
    });
    if (currentMaterialData && currentMaterialPath) {
      const filename = currentMaterialPath.split("/").pop();
      const fh = await matDir.getFileHandle(filename, { create: true });
      const w = await fh.createWritable();
      await w.write(JSON.stringify(currentMaterialData, null, 2));
      await w.close();

      const time = new Date().toLocaleTimeString();
      showToast(`保存完了 (${time})`);
    }
  } catch (e) {
    showToast("保存失敗: " + e, true);
  }

  renderTree();

  // 編集中の問題をアクティブに維持
  if (currentProblem) {
    const items = ui.treeRoot.querySelectorAll(".prob-item");
    items.forEach((el) => {
      const idSpan = el.querySelector("span:last-child");
      if (idSpan && idSpan.textContent === currentProblem.id) {
        el.classList.add("active");
      }
    });
  }
}

// --- Subject / Field Handlers ---

function handleAddSubject() {
  if (
    currentMaterialType === "standard" ||
    currentMaterialType === "lead_alpha" ||
    currentMaterialType === "lead_light" ||
    currentMaterialType === "textbook"
  ) {
    if (currentMaterialData.subjects.length === 0) {
      currentMaterialData.subjects.push({
        subjectName: "main",
        folderName: "",
        fields: [],
      });
    }
    handleAddField(currentMaterialData.subjects[0], "分野");
    return;
  }

  let promptMsg = "新しい科目名:";
  if (currentMaterialType === "exam_year") promptMsg = "新しい年度 (例: 2025):";
  else if (currentMaterialType === "exam_univ")
    promptMsg = "新しい大学ID (例: waseda):";
  const name = prompt(promptMsg);
  if (!name) return;
  const folderName = prompt("フォルダ名 (英数字推奨):", name);
  currentMaterialData.subjects.push({
    subjectName: name,
    folderName: folderName || name,
    fields: [],
  });

  // フォルダ即時作成
  if (folderName && explanationsDirHandle) {
    getMaterialDirHandle()
      .then((d) => d.getDirectoryHandle(folderName, { create: true }))
      .catch(console.warn);
  }
  renderTree();
  saveAll();
}

async function handleRenameSubject(sub, label) {
  const newName = prompt(`${label}名を変更:`, sub.subjectName);
  if (!newName || newName === sub.subjectName) return;

  if (
    sub.folderName &&
    sub.folderName.length > 0 &&
    !sub.folderName.includes("/")
  ) {
    try {
      const matDir = await getMaterialDirHandle();
      await fsRenameFolder(matDir, sub.folderName, newName);
    } catch (e) {
      alert("フォルダリネーム失敗: " + e);
    }
  }

  const oldFolder = sub.folderName;
  sub.subjectName = newName;
  sub.folderName = newName;

  if (oldFolder && oldFolder.length > 0) {
    sub.fields.forEach((f) => {
      f.problems.forEach((p) => {
        const parts = p.explanationPath.split("/");
        const newParts = parts.map((part) =>
          part === oldFolder ? newName : part,
        );
        p.explanationPath = newParts.join("/");
      });
    });
  }
  renderTree();
  saveAll();
}

async function handleDeleteSubject(sub, idx) {
  if (!confirm(`【警告】${sub.subjectName} を削除しますか？`)) return;
  if (sub.folderName && sub.folderName.length > 0) {
    try {
      const matDir = await getMaterialDirHandle();
      await fsDelete(matDir, sub.folderName);
    } catch (e) {
      console.warn("FS Delete Warn:", e);
    }
  }
  currentMaterialData.subjects.splice(idx, 1);
  renderTree();
  saveAll();
}

async function handleAddField(sub, label) {
  const existingParts = [
    ...new Set(
      sub.fields
        .map((f) => f.fieldName.split(" / "))
        .filter((parts) => parts.length > 1)
        .map((parts) => parts[0]),
    ),
  ];

  let defaultName = `新規${label}`;
  let hintId = "01";

  if (manifestData[activeMaterialIndex].id === "textbook") {
    if (existingParts.length > 0) {
      defaultName = `${existingParts[existingParts.length - 1]} / 新規章`;
      hintId = "01/02";
    } else {
      defaultName = "第1編 力と運動 / 第1章 剛体";
      hintId = "01/01";
    }
  } else if (currentMaterialType === "exam_year") {
    hintId = "main";
  }

  const nameInput = prompt(
    `新しい${label}名 (表示名):\n※「第1編 ... / 第1章 ...」のようにスラッシュ区切りで階層化できます`,
    defaultName,
  );
  if (!nameInput) return;

  const folderId = prompt(
    `フォルダID (ディレクトリ名):\n※実際のフォルダ名になります。「01/01」のように階層化可能`,
    hintId,
  );
  if (!folderId) return;

  try {
    const matDir = await getMaterialDirHandle();
    let subDir = matDir;
    if (sub.folderName && sub.folderName.length > 0) {
      subDir = await matDir.getDirectoryHandle(sub.folderName, {
        create: true,
      });
    }
    if (currentMaterialType !== "exam_year") {
      await getDeepDirectoryHandle(subDir, folderId, true);
    }
  } catch (e) {
    console.warn("FS Create Warn:", e);
    alert(
      "フォルダの作成に失敗した可能性がありますが、登録を続行します。\n" + e,
    );
  }

  sub.fields.push({
    fieldName: nameInput,
    folderId: folderId,
    problems: [],
  });
  renderTree();
  saveAll();
}

async function handleRenameField(sub, fld, label) {
  const newName = prompt(
    `${label}名(表示名)を変更:\n※「編 / 章」形式も可能`,
    fld.fieldName,
  );
  if (!newName || newName === fld.fieldName) return;
  fld.fieldName = newName;
  renderTree();
  saveAll();
}

async function handleDeleteField(sub, fld, idx) {
  if (!confirm(`分野「${fld.fieldName}」とファイルを削除しますか？`)) return;

  if (currentMaterialType !== "exam_year") {
    try {
      const matDir = await getMaterialDirHandle();
      let subDir = matDir;
      if (sub.folderName)
        subDir = await matDir.getDirectoryHandle(sub.folderName);

      if (fld.folderId && fld.folderId.length > 0) {
        await fsDelete(subDir, fld.folderId);
      }
    } catch (e) {
      console.warn(e);
    }
  }

  sub.fields.splice(idx, 1);
  renderTree();
  saveAll();
}

// --- Problem Handlers ---

async function createNewProblem(subject, field) {
  const id = prompt("問題ID/ファイル名 (例: 001_motion):");
  if (!id) return;
  if (field.problems.find((p) => p.id === id)) {
    alert("ID重複");
    return;
  }

  const matId = manifestData[activeMaterialIndex].id;
  let pathParts = [];
  if (currentMaterialType === "exam_year") {
    pathParts = ["data/explanations", matId, subject.folderName, `${id}.html`];
  } else {
    pathParts = [
      "data/explanations",
      matId,
      subject.folderName,
      field.folderId,
      `${id}.html`,
    ];
  }
  const path = pathParts
    .filter((p) => p && p.length > 0)
    .join("/")
    .replace(/\/\//g, "/");

  const newProb = {
    id: id,
    title: "新規問題",
    desc: "",
    explanationPath: path,
  };
  field.problems.push(newProb);

  try {
    const matDir = await getMaterialDirHandle();
    let targetDir = matDir;
    if (subject.folderName && subject.folderName.length > 0) {
      targetDir = await targetDir.getDirectoryHandle(subject.folderName, {
        create: true,
      });
    }
    if (
      currentMaterialType !== "exam_year" &&
      field.folderId &&
      field.folderId.length > 0
    ) {
      targetDir = await getDeepDirectoryHandle(targetDir, field.folderId, true);
    }
    const fh = await targetDir.getFileHandle(`${id}.html`, { create: true });
    const w = await fh.createWritable();
    await w.write(`<h3>${id}</h3><p>解説...</p>`);
    await w.close();
  } catch (e) {
    console.warn("File Create Warn:", e);
  }

  currentProblem = newProb;
  renderTree();
  openEditor(newProb);
  saveAll();
}

async function handleDeleteProblem(sub, fld, prob, idx) {
  if (!confirm(`問題「${prob.title}」を削除しますか？`)) return;
  fld.problems.splice(idx, 1);
  try {
    const parts = prob.explanationPath.split("/");
    const fileName = parts.pop();
    let dir = rootDirHandle;
    for (const p of parts) dir = await dir.getDirectoryHandle(p);
    await dir.removeEntry(fileName);
  } catch (e) {
    console.warn("File delete error:", e);
  }

  if (currentProblem === prob) {
    ui.editorMainWrapper.style.display = "none";
    currentProblem = null;
  }
  renderTree();
  saveAll();
}

async function handleDropProblem(e, targetSub, targetFld) {
  e.preventDefault();
  document
    .querySelectorAll(".drag-over")
    .forEach((el) => el.classList.remove("drag-over"));

  if (!dragSrcProb || !dragSrcField) return;
  if (dragSrcField === targetFld) return;

  if (
    !confirm(
      `「${dragSrcProb.title}」を「${targetFld.fieldName}」へ移動しますか？`,
    )
  )
    return;

  const matId = manifestData[activeMaterialIndex].id;
  try {
    const matDir = await getMaterialDirHandle();
    let targetDir = matDir;
    if (targetSub.folderName && targetSub.folderName.length > 0) {
      targetDir = await targetDir.getDirectoryHandle(targetSub.folderName);
    }
    if (
      currentMaterialType !== "exam_year" &&
      targetFld.folderId &&
      targetFld.folderId.length > 0
    ) {
      targetDir = await getDeepDirectoryHandle(
        targetDir,
        targetFld.folderId,
        true,
      );
    }
    const success = await fsMoveFile(dragSrcProb.explanationPath, targetDir);
    if (!success) throw new Error("File move failed");
  } catch (e) {
    alert("移動失敗: " + e);
    return;
  }

  const fileName = dragSrcProb.explanationPath.split("/").pop();
  let newPathParts = [];
  if (currentMaterialType === "exam_year") {
    newPathParts = ["data/explanations", matId, targetSub.folderName, fileName];
  } else {
    newPathParts = [
      "data/explanations",
      matId,
      targetSub.folderName,
      targetFld.folderId,
      fileName,
    ];
  }
  dragSrcProb.explanationPath = newPathParts
    .filter((p) => p && p.length > 0)
    .join("/")
    .replace(/\/\//g, "/");

  const srcIdx = dragSrcField.problems.indexOf(dragSrcProb);
  if (srcIdx > -1) dragSrcField.problems.splice(srcIdx, 1);
  targetFld.problems.push(dragSrcProb);

  currentProblem = dragSrcProb;
  dragSrcProb = null;
  dragSrcField = null;
  renderTree();
  openEditor(currentProblem);
  saveAll();
}

async function createNewMaterial() {
  const name = prompt("新しい教材名:");
  if (!name) return;
  const id = prompt("教材ID:", "chemistry");
  if (!id) return;
  const type = prompt("タイプ (standard / exam_year / exam_univ):", "standard");

  const newMat = {
    id: id,
    name: name,
    path: `data/materials/${id}.json`,
    type: type || "standard",
  };
  manifestData.push(newMat);

  const newJson = { materialName: name, subjects: [] };
  try {
    const dataDir = await rootDirHandle.getDirectoryHandle("data");
    const matDir = await dataDir.getDirectoryHandle("materials");
    const fh = await matDir.getFileHandle(`${id}.json`, { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify(newJson, null, 2));
    await w.close();
    const expDir = await dataDir.getDirectoryHandle("explanations");
    await expDir.getDirectoryHandle(id, { create: true });
  } catch (e) {
    alert("作成エラー: " + e);
    return;
  }

  await saveManifest();
  loadMaterial(manifestData.length - 1);
}

// --- Import & Sync ---

async function handleSyncFolders() {
  if (!currentMaterialData) return;
  const matName = currentMaterialData.materialName;
  if (
    !confirm(
      `「${matName}」のJSON定義に基づいて、未作成のフォルダを一括生成しますか？`,
    )
  )
    return;

  try {
    const matDir = await getMaterialDirHandle();

    for (const sub of currentMaterialData.subjects) {
      if (!sub.folderName) continue;
      const subDir = await matDir.getDirectoryHandle(sub.folderName, {
        create: true,
      });

      for (const fld of sub.fields) {
        if (!fld.folderId) continue;
        await getDeepDirectoryHandle(subDir, fld.folderId, true);
      }
    }
    showToast("✅ フォルダ構成の同期が完了しました");
  } catch (e) {
    alert("フォルダ生成エラー: " + e);
    console.error(e);
  }
}

function setupImportModalEvents() {
  if (ui.btnCloseImport)
    ui.btnCloseImport.onclick = () => (ui.importModal.style.display = "none");

  if (ui.btnExecImport) {
    ui.btnExecImport.onclick = async () => {
      const htmlVal = ui.impHtml.value;
      const jsonVal = ui.impJson.value;

      if (!jsonVal.trim()) {
        alert("JSONは必須です");
        return;
      }

      try {
        await executeSmartImport(htmlVal, jsonVal);
        // 修正: 入力欄のリセットとモーダル非表示を行わない (連続実行可能にする)
        showToast("続けて登録できます");
      } catch (e) {
        alert("登録エラー: " + e.message);
      }
    };
  }
}

function openSmartImportModal() {
  // 既存のモーダル要素を使用
  const modal = ui.importModal;
  if (modal) {
    const sel = ui.importTargetMaterial;
    sel.innerHTML = '<option value="">(自動判定/選択不要)</option>';
    manifestData.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      sel.appendChild(opt);
    });
    modal.style.display = "flex";
    return;
  }

  // Fallback: 動的生成 (admin.htmlにモーダルがない場合)
  createDynamicImportModal();
}

function createDynamicImportModal() {
  const modalOverlay = document.createElement("div");
  modalOverlay.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;justify-content:center;align-items:center;";

  const modalContent = document.createElement("div");
  modalContent.style.cssText =
    "background:white;padding:20px;width:95%;height:90%;border-radius:8px;display:flex;flex-direction:column;gap:10px;";

  modalContent.innerHTML = `
      <h3>🤖 AI生成コンテンツ取り込み</h3>
      <p style="font-size:0.9em;color:#666;margin:0;">AIが出力した「解説HTML」と「登録用JSON」をそれぞれの欄に貼り付けてください。</p>
      <div style="display:flex; gap:20px; flex:1; min-height:0;">
        <div style="flex:1; display:flex; flex-direction:column;">
          <label style="font-weight:bold;">1. 解説HTML</label>
          <textarea id="ai-import-html" style="flex:1;padding:10px;font-family:monospace;font-size:12px;resize:none;border:1px solid #cbd5e1;"></textarea>
        </div>
        <div style="flex:1; display:flex; flex-direction:column;">
          <label style="font-weight:bold;">2. 登録用JSON</label>
          <textarea id="ai-import-json" style="flex:1;padding:10px;font-family:monospace;font-size:12px;resize:none;border:1px solid #cbd5e1;"></textarea>
        </div>
      </div>
      <div style="text-align:right; margin-top:10px;">
        <button id="btn-cancel-import-dyn" style="padding:10px 20px;margin-right:10px;">キャンセル</button>
        <button id="btn-exec-smart-import-dyn" style="padding:10px 20px;background:#8b5cf6;color:white;border:none;">取り込み実行</button>
      </div>
    `;
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);

  modalContent.querySelector("#btn-cancel-import-dyn").onclick = () =>
    document.body.removeChild(modalOverlay);
  modalContent.querySelector("#btn-exec-smart-import-dyn").onclick =
    async () => {
      const htmlText = modalContent.querySelector("#ai-import-html").value;
      const jsonText = modalContent.querySelector("#ai-import-json").value;
      try {
        await executeSmartImport(htmlText, jsonText);
        // 修正: モーダルを閉じない
        showToast("続けて登録できます");
      } catch (e) {
        alert("エラー:\n" + e.message);
      }
    };
}

async function executeSmartImport(htmlRaw, jsonRaw) {
  const jsonClean = jsonRaw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const htmlClean = htmlRaw
    .replace(/```html/gi, "")
    .replace(/```/g, "")
    .trim();

  let metaData;
  try {
    metaData = JSON.parse(jsonClean);
  } catch (e) {
    throw new Error("JSONパース失敗");
  }

  if (!metaData.explanationPath) throw new Error("explanationPathがありません");

  const pathParts = metaData.explanationPath.split("/");
  const expIndex = pathParts.indexOf("explanations");
  if (expIndex === -1) throw new Error("無効なパス形式(explanationsなし)");

  const matId = pathParts[expIndex + 1];
  const fileName = pathParts[pathParts.length - 1];

  // explanations/{matId}/... の後ろの部分を取得
  // 例: ["03", "01"] または ["physics_basic", "01", "01"]
  const innerSegments = pathParts.slice(expIndex + 2, pathParts.length - 1);

  const targetMatIndex = manifestData.findIndex((m) => m.id === matId);
  if (targetMatIndex === -1)
    throw new Error(`教材ID ${matId} が見つかりません`);

  // 必要に応じて教材を切り替え
  if (activeMaterialIndex !== targetMatIndex)
    await loadMaterial(targetMatIndex);

  let firstSegment = innerSegments[0];
  let targetSubject = currentMaterialData.subjects.find(
    (s) => s.folderName === firstSegment,
  );
  let folderIds = "";

  // 1. 最初のセグメントが既存の科目フォルダと一致する場合
  if (targetSubject) {
    if (targetSubject.folderName !== "") {
      folderIds = innerSegments.slice(1).join("/");
    } else {
      // folderNameが空の科目にたまたまヒットした場合（通常ここには来ない）
      folderIds = innerSegments.join("/");
    }
  }
  // 2. 一致しない場合、まずは「フォルダなし科目(folderName=="")」を探す
  else {
    const emptySubject = currentMaterialData.subjects.find(
      (s) => s.folderName === "",
    );
    if (emptySubject) {
      targetSubject = emptySubject;
      // 科目フォルダが無いので、innerSegments全体が分野IDになる
      folderIds = innerSegments.join("/");
    }
  }

  // 3. それでも見つからない場合のみ、新規科目を作成
  if (!targetSubject) {
    if (
      !confirm(
        `科目フォルダ "${firstSegment}" を新規作成しますか？\n(意図しない場合はキャンセルしてJSON設定を確認してください)`,
      )
    )
      return;
    targetSubject = {
      subjectName: firstSegment,
      folderName: firstSegment,
      fields: [],
    };
    currentMaterialData.subjects.push(targetSubject);
    const matDir = await getMaterialDirHandle();
    await matDir.getDirectoryHandle(firstSegment, { create: true });
    folderIds = innerSegments.slice(1).join("/");
  }

  // --- 以降、分野(Field)の特定と問題追加 ---

  let targetField = targetSubject.fields.find((f) => f.folderId === folderIds);

  if (folderIds && !targetField) {
    // フォルダIDはあるが分野が見つからない -> 新規分野作成
    if (!confirm(`分野ID "${folderIds}" を新規作成しますか？`)) return;
    targetField = {
      fieldName: `新規分野 ${folderIds}`,
      folderId: folderIds,
      problems: [],
    };
    targetSubject.fields.push(targetField);

    // フォルダ作成
    const matDir = await getMaterialDirHandle();
    let subDir = matDir;
    if (targetSubject.folderName) {
      subDir = await matDir.getDirectoryHandle(targetSubject.folderName, {
        create: true,
      });
    }
    await getDeepDirectoryHandle(subDir, folderIds, true);
  } else if (!folderIds && !targetField) {
    // フォルダIDも空の場合 (ルート直下)
    targetField = targetSubject.fields.find((f) => f.folderId === "");
    if (!targetField) {
      targetField = { fieldName: "標準", folderId: "", problems: [] };
      targetSubject.fields.push(targetField);
    }
  }

  // ID比較を文字列型に統一
  const existingProbIndex = targetField.problems.findIndex(
    (p) => String(p.id) === String(metaData.id),
  );

  const newProbData = {
    id: metaData.id,
    title: metaData.title,
    desc: metaData.desc || "",
    explanationPath: metaData.explanationPath,
  };

  if (existingProbIndex !== -1) {
    if (
      !confirm(
        `問題ID "${metaData.id}" (タイトル: ${targetField.problems[existingProbIndex].title}) を上書きしますか？`,
      )
    )
      return;
    targetField.problems[existingProbIndex] = newProbData;
  } else {
    targetField.problems.push(newProbData);
  }

  await saveAll();

  // HTMLファイルの保存
  if (htmlClean) {
    try {
      const matDir = await getMaterialDirHandle();
      let targetDir = matDir;

      // 科目フォルダがある場合
      if (targetSubject.folderName) {
        targetDir = await targetDir.getDirectoryHandle(
          targetSubject.folderName,
          { create: true },
        );
      }

      // 分野フォルダがある場合
      if (folderIds) {
        targetDir = await getDeepDirectoryHandle(targetDir, folderIds, true);
      }

      const fileHandle = await targetDir.getFileHandle(fileName, {
        create: true,
      });
      const w = await fileHandle.createWritable();
      await w.write(htmlClean);
      await w.close();
    } catch (e) {
      console.warn("HTML書き込みエラー", e);
    }
  }

  currentProblem = newProbData;
  renderTree();
  openEditor(newProbData);
  showToast(`取り込み完了: ${metaData.title}`);
}
