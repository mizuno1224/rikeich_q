/* js/admin.js */

// --- Global State ---
let manifestData = [];      
let currentMaterialData = null; 
let currentMaterialPath = null;
let currentMaterialType = 'standard'; 

let rootDirHandle = null;
let explanationsDirHandle = null;

let activeMaterialIndex = 0;
let openPaths = new Set();
let currentProblem = null; // 現在編集中の問題オブジェクト
let currentVisualEditor = null;

// Drag & Drop State
let dragSrcProb = null;
let dragSrcField = null;

document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const btnOpen = document.getElementById('btn-open');
  const btnSave = document.getElementById('btn-save');
  const btnAddSubject = document.getElementById('btn-add-subject'); 
  const sidebarTools = document.querySelector('.sidebar-tools');
  
  const mainUi = document.getElementById('main-ui');
  const initialMsg = document.getElementById('initial-msg');
  const tabsArea = document.getElementById('material-tabs');
  const treeRoot = document.getElementById('tree-root');
  
  const editorMainWrapper = document.getElementById('editor-main-wrapper');
  const tabEdit = document.getElementById('tab-edit');
  const container = document.getElementById('form-container');

  // --- ツールバーボタン生成 ---
  
  // 1. フォルダ同期ボタン
  const btnSyncFolders = document.createElement('button');
  btnSyncFolders.className = 'btn-tool';
  btnSyncFolders.title = 'JSON定義に基づいてフォルダを一括生成';
  btnSyncFolders.textContent = '📂同期';
  btnSyncFolders.onclick = handleSyncFolders;

  // 2. AI取込ボタン
  const btnSmartImport = document.createElement('button');
  btnSmartImport.className = 'btn-tool';
  btnSmartImport.title = 'AIの出力(HTMLとJSON)を取り込み';
  btnSmartImport.textContent = '🤖AI取込';
  btnSmartImport.style.backgroundColor = '#8b5cf6'; // 紫色
  btnSmartImport.onclick = openSmartImportModal;

  if(sidebarTools) {
      sidebarTools.appendChild(btnSyncFolders);
      sidebarTools.appendChild(btnSmartImport);
  }

  // --- 1. Initialize & Open Project ---
  btnOpen.addEventListener('click', async () => {
    try {
      rootDirHandle = await window.showDirectoryPicker();
      
      try {
        const dataDir = await rootDirHandle.getDirectoryHandle('data');
        explanationsDirHandle = await dataDir.getDirectoryHandle('explanations');
      } catch (e) {
        showToast("エラー: data/explanations フォルダが見つかりません", true);
        return;
      }

      try {
        const dataDir = await rootDirHandle.getDirectoryHandle('data');
        const manifestHandle = await dataDir.getFileHandle('manifest.json');
        const file = await manifestHandle.getFile();
        manifestData = JSON.parse(await file.text());
        showToast("プロジェクトを読み込みました");
      } catch (e) {
         if(confirm("manifest.jsonが見つかりません。新規作成しますか？")) {
           manifestData = [];
           await saveManifest();
         } else { return; }
      }

      initialMsg.style.display = 'none';
      mainUi.style.display = 'flex';
      btnSave.disabled = false;
      btnOpen.textContent = "📂 " + rootDirHandle.name;

      renderTabs();
      if (manifestData.length > 0) {
        await loadMaterial(0);
      } else {
        treeRoot.innerHTML = '<div style="padding:20px; color:#666;">教材がありません。「＋」ボタンで追加してください。</div>';
      }

    } catch (err) { console.error(err); }
  });

  // --- 2. Material Loading ---
  async function loadMaterial(index) {
    if(index < 0 || index >= manifestData.length) return;
    activeMaterialIndex = index;
    const item = manifestData[index];
    currentMaterialPath = item.path;
    currentMaterialType = item.type || 'standard';

    if(currentMaterialType === 'exam_year') btnAddSubject.textContent = '＋年度を追加';
    else if(currentMaterialType === 'exam_univ') btnAddSubject.textContent = '＋大学を追加';
    else btnAddSubject.textContent = '＋科目を追加';

    try {
      const parts = item.path.split('/');
      let dir = rootDirHandle;
      for(let i=0; i<parts.length-1; i++) {
          dir = await dir.getDirectoryHandle(parts[i]);
      }
      const fh = await dir.getFileHandle(parts[parts.length-1]);
      const file = await fh.getFile();
      currentMaterialData = JSON.parse(await file.text());
    } catch (e) {
      console.error(e);
      showToast(`教材読込失敗: ${item.name}`, true);
      currentMaterialData = { materialName: item.name, subjects: [] };
    }
    renderApp();
  }

  // --- 3. Save Logic ---
  async function saveAll() {
    if (!rootDirHandle) return;
    saveOpenStates();

    try {
      await saveManifest();

      const dataDir = await rootDirHandle.getDirectoryHandle('data');
      const matDir = await dataDir.getDirectoryHandle('materials', { create: true });
      if (currentMaterialData && currentMaterialPath) {
        const filename = currentMaterialPath.split('/').pop();
        const fh = await matDir.getFileHandle(filename, { create: true });
        const w = await fh.createWritable();
        await w.write(JSON.stringify(currentMaterialData, null, 2));
        await w.close();
        showToast(`「${currentMaterialData.materialName}」を保存しました`);
      }
    } catch (e) { showToast('保存失敗: ' + e, true); }
    renderTree(); 
  }
  
  async function saveManifest() {
    const dataDir = await rootDirHandle.getDirectoryHandle('data', { create: true });
    const fh = await dataDir.getFileHandle('manifest.json', { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify(manifestData, null, 2));
    await w.close();
  }

  btnSave.addEventListener('click', saveAll);

  // --- 4. Rendering ---
  function renderApp() {
    renderTabs();
    renderTree();
  }

  function renderTabs() {
    tabsArea.innerHTML = '';
    manifestData.forEach((mat, idx) => {
      const btn = document.createElement('button');
      btn.className = `tab-btn ${idx === activeMaterialIndex ? 'active' : ''}`;
      btn.textContent = mat.name;
      btn.onclick = () => { saveOpenStates(); loadMaterial(idx); };
      tabsArea.appendChild(btn);
    });

    const btnAdd = document.createElement('button');
    btnAdd.id = 'btn-add-material';
    btnAdd.className = 'tab-btn';
    btnAdd.textContent = '＋';
    btnAdd.onclick = createNewMaterial;
    tabsArea.appendChild(btnAdd);
  }

  function renderTree() {
    treeRoot.innerHTML = '';
    if (!currentMaterialData) return;

    let labelSubj = "科目"; let labelField = "分野";
    if (currentMaterialType === 'exam_year') { labelSubj = "年度"; labelField = "区分"; }
    else if (currentMaterialType === 'exam_univ') { labelSubj = "大学"; labelField = "年度"; }

    currentMaterialData.subjects.forEach((sub, sIdx) => {
      const subPath = `s-${sIdx}`;
      const subDetails = createTreeItem(labelSubj, sub.subjectName, subPath);
      
      addActions(subDetails.querySelector('summary'), 
        () => handleRenameSubject(sub, labelSubj),
        () => handleDeleteSubject(sub, sIdx),
        () => handleAddField(sub, labelField)
      );

      const subContent = document.createElement('div');
      subContent.className = 'tree-content';

      let currentPartName = null;
      let currentPartContainer = null;

      sub.fields.forEach((fld, fIdx) => {
        const nameParts = fld.fieldName.split(' / ');
        const isGrouped = nameParts.length > 1;
        const partName = isGrouped ? nameParts[0] : null;
        const chapName = isGrouped ? nameParts[1] : fld.fieldName;

        let targetContainer = subContent;

        if (isGrouped) {
          if (partName !== currentPartName) {
            currentPartName = partName;
            const partDetails = document.createElement('details');
            partDetails.open = true;
            partDetails.dataset.path = `${subPath}-part-${partName}`;
            partDetails.style.marginBottom = '5px';
            partDetails.style.border = 'none';
            
            const partSummary = document.createElement('summary');
            partSummary.innerHTML = `<span style="font-weight:bold; color:#475569;">📂 ${partName}</span>`;
            partSummary.style.background = '#f1f5f9';
            partSummary.style.borderRadius = '6px';
            
            partDetails.appendChild(partSummary);
            
            const partInner = document.createElement('div');
            partInner.style.paddingLeft = '10px';
            partDetails.appendChild(partInner);
            
            subContent.appendChild(partDetails);
            currentPartContainer = partInner;
          }
          targetContainer = currentPartContainer;
        } else {
          currentPartName = null;
          currentPartContainer = null;
        }

        const fldPath = `${subPath}-f-${fIdx}`;
        const fldDetails = createTreeItem(labelField, chapName, fldPath);
        
        addActions(fldDetails.querySelector('summary'),
          () => handleRenameField(sub, fld, labelField),
          () => handleDeleteField(sub, fld, fIdx),
          null 
        );

        const fldContent = document.createElement('div');
        fldContent.className = 'tree-content';
        
        fldContent.addEventListener('dragover', e => {
            e.preventDefault();
            fldContent.classList.add('drag-over');
        });
        fldContent.addEventListener('dragleave', () => fldContent.classList.remove('drag-over'));
        fldContent.addEventListener('drop', e => handleDropProblem(e, sub, fld));

        fld.problems.forEach((prob, pIdx) => {
          const pDiv = document.createElement('div');
          const isActive = (currentProblem && currentProblem.id === prob.id && currentProblem.explanationPath === prob.explanationPath);
          pDiv.className = `prob-item ${isActive ? 'active' : ''}`;
          
          pDiv.innerHTML = `<span>${prob.title || '(無題)'}</span><span style="font-size:0.8em;color:#999;">${prob.id}</span>`;
          pDiv.draggable = true;
          
          pDiv.addEventListener('dragstart', e => {
              dragSrcProb = prob;
              dragSrcField = fld;
              pDiv.classList.add('dragging');
              e.dataTransfer.effectAllowed = 'move';
          });
          pDiv.addEventListener('dragend', () => {
             pDiv.classList.remove('dragging');
             document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
          });
          
          pDiv.onclick = (e) => {
              if(e.ctrlKey) {
                  if(confirm(`問題「${prob.title}」を削除しますか？`)) {
                      handleDeleteProblem(sub, fld, prob, pIdx);
                  }
                  return;
              }
              openEditor(prob);
              document.querySelectorAll('.prob-item').forEach(el => el.classList.remove('active'));
              pDiv.classList.add('active');
          };
          fldContent.appendChild(pDiv);
        });

        const btnAdd = document.createElement('div');
        btnAdd.className = 'prob-item';
        btnAdd.style.color = '#10b981';
        btnAdd.textContent = '＋ 問題追加';
        btnAdd.onclick = () => createNewProblem(sub, fld);
        fldContent.appendChild(btnAdd);

        fldDetails.appendChild(fldContent);
        targetContainer.appendChild(fldDetails);
      });

      subDetails.appendChild(subContent);
      treeRoot.appendChild(subDetails);
    });
    restoreOpenStates();
  }

  // ============================================================
  // --- AI Smart Import Functionality ---
  // ============================================================

  function openSmartImportModal() {
    const modalOverlay = document.createElement('div');
    modalOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;justify-content:center;align-items:center;';
    
    // モーダルのコンテンツ (2カラムレイアウト)
    const modalContent = document.createElement('div');
    modalContent.style.cssText = 'background:white;padding:20px;width:95%;height:90%;border-radius:8px;display:flex;flex-direction:column;gap:10px;';
    
    modalContent.innerHTML = `
      <h3>🤖 AI生成コンテンツ取り込み</h3>
      <p style="font-size:0.9em;color:#666;margin:0;">AIが出力した「解説HTML」と「登録用JSON」をそれぞれの欄に貼り付けてください。コードブロック記号 (\`\`\`html 等) は自動的に削除されます。</p>
      
      <div style="display:flex; gap:20px; flex:1; min-height:0;">
        <div style="flex:1; display:flex; flex-direction:column;">
          <label style="font-weight:bold;margin-bottom:5px;color:#334155;">1. 解説HTML ( &lt;div&gt;... )</label>
          <textarea id="ai-import-html" style="flex:1;padding:10px;font-family:monospace;font-size:12px;resize:none;border:1px solid #cbd5e1;border-radius:4px;" placeholder="ここにHTMLブロックを貼り付け..."></textarea>
        </div>
        
        <div style="flex:1; display:flex; flex-direction:column;">
          <label style="font-weight:bold;margin-bottom:5px;color:#334155;">2. 登録用JSON ( { "id": ... } )</label>
          <textarea id="ai-import-json" style="flex:1;padding:10px;font-family:monospace;font-size:12px;resize:none;border:1px solid #cbd5e1;border-radius:4px;" placeholder="ここにJSONブロックを貼り付け..."></textarea>
        </div>
      </div>
      
      <div style="text-align:right; margin-top:10px;">
        <button id="btn-cancel-import" style="padding:10px 20px;margin-right:10px;border:1px solid #cbd5e1;border-radius:4px;background:white;cursor:pointer;">キャンセル</button>
        <button id="btn-exec-import" style="padding:10px 20px;background:#8b5cf6;color:white;border:none;border-radius:4px;font-weight:bold;cursor:pointer;">取り込み実行</button>
      </div>
    `;
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    modalContent.querySelector('#btn-cancel-import').onclick = () => document.body.removeChild(modalOverlay);
    
    modalContent.querySelector('#btn-exec-import').onclick = async () => {
      const htmlText = modalContent.querySelector('#ai-import-html').value;
      const jsonText = modalContent.querySelector('#ai-import-json').value;
      
      if(!jsonText.trim()) { 
        alert("エラー: 「登録用JSON」は必須です。"); 
        return; 
      }
      
      try {
        await executeSmartImport(htmlText, jsonText);
        document.body.removeChild(modalOverlay);
      } catch(e) {
        alert("取り込みエラー:\n" + e.message);
      }
    };
  }

  // 取り込み実行ロジック (引数でHTMLとJSONを受け取る)
  async function executeSmartImport(htmlRaw, jsonRaw) {
    // 1. クリーニング処理 (Markdown記法の除去)
    // ```json ... ``` や ```html ... ``` を削除する
    const jsonClean = jsonRaw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const htmlClean = htmlRaw.replace(/```html/gi, '').replace(/```/g, '').trim();

    let metaData;
    try {
      metaData = JSON.parse(jsonClean);
    } catch(e) { throw new Error("JSONのパースに失敗しました。\n形式が正しいか確認してください。"); }

    if (!metaData.explanationPath) throw new Error("JSONに explanationPath が含まれていません");

    // 2. パス解析
    const pathParts = metaData.explanationPath.split('/');
    const expIndex = pathParts.indexOf('explanations');
    if (expIndex === -1 || pathParts.length < expIndex + 4) {
      throw new Error("無効なパス形式です。data/explanations/... である必要があります");
    }
    
    const relevantPath = pathParts.slice(expIndex + 1); 
    const matId = relevantPath[0];
    const subFolder = relevantPath[1];
    const fileName = relevantPath[relevantPath.length - 1];
    const folderIds = relevantPath.slice(2, relevantPath.length - 1); // 中間のフォルダ群
    
    // 3. 教材データの特定
    const targetMatIndex = manifestData.findIndex(m => m.id === matId);
    if (targetMatIndex === -1) throw new Error(`教材ID "${matId}" が manifest.json に見つかりません`);
    
    // ターゲット教材に切り替え
    if (activeMaterialIndex !== targetMatIndex) {
      await loadMaterial(targetMatIndex);
    }

    // 4. 科目・分野の特定
    let targetSubject = currentMaterialData.subjects.find(s => s.folderName === subFolder);
    
    if (!targetSubject) {
      if(!confirm(`科目フォルダ "${subFolder}" が見つかりません。新規作成しますか？`)) return;
      targetSubject = { subjectName: subFolder, folderName: subFolder, fields: [] };
      currentMaterialData.subjects.push(targetSubject);
      const matDir = await getMaterialDirHandle();
      await matDir.getDirectoryHandle(subFolder, {create: true});
    }

    // 分野IDの結合
    const targetFolderId = folderIds.join('/');
    let targetField = targetSubject.fields.find(f => f.folderId === targetFolderId);

    if (!targetField) {
      const confirmMsg = `分野ID "${targetFolderId}" が見つかりません。\n新規作成しますか？\n(表示名はIDと同じになります)`;
      if(!confirm(confirmMsg)) return;
      
      targetField = {
        fieldName: `新規分野 ${targetFolderId}`,
        folderId: targetFolderId,
        problems: []
      };
      targetSubject.fields.push(targetField);
      
      const matDir = await getMaterialDirHandle();
      const subDir = await matDir.getDirectoryHandle(subFolder, {create:true});
      await getDeepDirectoryHandle(subDir, targetFolderId, true);
    }

    // 5. 問題データの追加/更新
    const existingProbIndex = targetField.problems.findIndex(p => p.id === metaData.id);
    const newProbData = {
      id: metaData.id,
      title: metaData.title,
      desc: metaData.desc || "",
      explanationPath: metaData.explanationPath,
      layout: metaData.layout || "article"
    };

    if (existingProbIndex !== -1) {
      if(!confirm(`問題ID "${metaData.id}" は既に存在します。上書きしますか？`)) return;
      targetField.problems[existingProbIndex] = newProbData;
    } else {
      targetField.problems.push(newProbData);
    }

    // 6. HTMLファイルの書き込み
    if (htmlClean) {
      try {
        const matDir = await getMaterialDirHandle();
        const subDir = await matDir.getDirectoryHandle(subFolder);
        const fieldDir = await getDeepDirectoryHandle(subDir, targetFolderId, true);
        const fileHandle = await fieldDir.getFileHandle(fileName, {create: true});
        const w = await fileHandle.createWritable();
        await w.write(htmlClean);
        await w.close();
      } catch(e) {
        console.warn("HTML書き込みエラー: ", e);
        alert("HTMLファイルの保存に失敗しましたが、メタデータは更新します。");
      }
    } else {
      // HTMLが空でもメタデータだけ更新したい場合があるので警告のみ
      console.log("HTML input was empty, skipping file write.");
    }

    // 7. 保存と反映
    await saveAll(); 
    currentProblem = newProbData; 
    renderTree(); 
    openEditor(newProbData);
    
    showToast(`取り込み完了: ${metaData.title}`);
  }


  // ============================================================
  // --- File System Operations ---
  // ============================================================

  async function getMaterialDirHandle() {
    const matId = manifestData[activeMaterialIndex].id;
    return await explanationsDirHandle.getDirectoryHandle(matId, {create: true});
  }

  async function getDeepDirectoryHandle(root, pathStr, create=false) {
    if(!pathStr) return root;
    let dir = root;
    const parts = pathStr.split('/').filter(p => p.length > 0);
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, {create: create});
    }
    return dir;
  }

  async function fsRenameFolder(parentHandle, oldName, newName) {
    if(!oldName || !newName || oldName === newName) return;
    try {
      if (oldName.includes('/') || newName.includes('/')) {
          console.warn("パスを含むリネームは現在サポートしていません");
          return;
      }
      const oldDir = await parentHandle.getDirectoryHandle(oldName);
      const newDir = await parentHandle.getDirectoryHandle(newName, {create: true});
      
      for await (const [name, handle] of oldDir.entries()) {
        if (handle.kind === 'file') {
          const file = await handle.getFile();
          const newFileHandle = await newDir.getFileHandle(name, {create: true});
          const writable = await newFileHandle.createWritable();
          await writable.write(file);
          await writable.close();
        }
      }
      await parentHandle.removeEntry(oldName, {recursive: true});
    } catch(e) { console.error("FS Rename Error:", e); }
  }

  async function fsMoveFile(currentPath, targetFolderHandle, newFileName) {
    try {
        const parts = currentPath.split('/');
        const fileName = parts.pop();
        let dir = rootDirHandle;
        for(const p of parts) dir = await dir.getDirectoryHandle(p);
        const fileHandle = await dir.getFileHandle(fileName);

        const file = await fileHandle.getFile();
        const content = await file.text();

        const newHandle = await targetFolderHandle.getFileHandle(newFileName || fileName, {create: true});
        const w = await newHandle.createWritable();
        await w.write(content);
        await w.close();

        await dir.removeEntry(fileName);
        return true;
    } catch(e) {
        console.error("Move File Error:", e);
        return false;
    }
  }

  async function fsDelete(parentHandle, name) {
      if (name.includes('/')) {
          const parts = name.split('/');
          const targetName = parts.pop();
          const dir = await getDeepDirectoryHandle(parentHandle, parts.join('/'));
          await dir.removeEntry(targetName, {recursive: true});
      } else {
          await parentHandle.removeEntry(name, {recursive: true});
      }
  }

  // フォルダ構成の一括同期
  async function handleSyncFolders() {
    if (!currentMaterialData) return;
    const matName = currentMaterialData.materialName;
    if (!confirm(`「${matName}」のJSON定義に基づいて、未作成のフォルダを一括生成しますか？`)) return;

    try {
      const matDir = await getMaterialDirHandle(); 

      for (const sub of currentMaterialData.subjects) {
        if (!sub.folderName) continue;
        const subDir = await matDir.getDirectoryHandle(sub.folderName, { create: true });
        
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

  // ============================================================
  // --- Action Handlers ---
  // ============================================================

  async function handleRenameSubject(sub, label) {
    const newName = prompt(`${label}名を変更:`, sub.subjectName);
    if (!newName || newName === sub.subjectName) return;

    if (sub.folderName && sub.folderName.length > 0 && !sub.folderName.includes('/')) {
      try {
        const matDir = await getMaterialDirHandle();
        await fsRenameFolder(matDir, sub.folderName, newName);
      } catch(e) { alert("フォルダリネーム失敗: " + e); }
    }
    
    const oldFolder = sub.folderName;
    sub.subjectName = newName;
    sub.folderName = newName;

    if (oldFolder && oldFolder.length > 0) {
        sub.fields.forEach(f => {
            f.problems.forEach(p => {
                p.explanationPath = p.explanationPath.replace(`/${oldFolder}/`, `/${newName}/`);
            });
        });
    }
    renderTree();
    saveAll();
  }

  async function handleDeleteSubject(sub, idx) {
    if(!confirm(`【警告】${sub.subjectName} を削除しますか？`)) return;
    if (sub.folderName && sub.folderName.length > 0) {
        try {
            const matDir = await getMaterialDirHandle();
            await fsDelete(matDir, sub.folderName);
        } catch(e) { console.warn("FS Delete Warn:", e); }
    }
    currentMaterialData.subjects.splice(idx, 1);
    renderTree();
    saveAll();
  }

  async function handleAddField(sub, label) {
    let defaultName = `新規${label}`;
    if(manifestData[activeMaterialIndex].id === 'textbook') {
      defaultName = "第〇編 編名 / 第〇章 章名";
    }
    const nameInput = prompt(`新しい${label}名:\n※「第1編 / 第1章」のように入力すると階層化されます`, defaultName);
    if(!nameInput) return;

    let hint = '01';
    if(manifestData[activeMaterialIndex].id === 'textbook') hint = '01/01'; 
    else if(currentMaterialType === 'exam_year') hint = 'main';
    
    const folderId = prompt(`フォルダID (パス):\n※「01/01」のようにスラッシュで階層化可能`, hint);
    if(!folderId) return;

    try {
        const matDir = await getMaterialDirHandle();
        let subDir = matDir;
        if (sub.folderName && sub.folderName.length > 0) {
            subDir = await matDir.getDirectoryHandle(sub.folderName, {create:true});
        }
        
        if(currentMaterialType !== 'exam_year') {
            await getDeepDirectoryHandle(subDir, folderId, true);
        }
    } catch(e) { console.warn("FS Create Warn:", e); }

    const displayName = nameInput;
    sub.fields.push({
        fieldName: displayName,
        folderId: folderId,
        problems: []
    });
    renderTree();
    saveAll();
  }

  async function handleRenameField(sub, fld, label) {
    const newName = prompt(`${label}名(表示名)を変更:\n※「編 / 章」形式も可能`, fld.fieldName);
    if (!newName || newName === fld.fieldName) return;
    
    fld.fieldName = newName;
    renderTree();
    saveAll();
  }

  async function handleDeleteField(sub, fld, idx) {
    if(!confirm(`分野「${fld.fieldName}」とファイルを削除しますか？`)) return;
    
    if (currentMaterialType !== 'exam_year') {
        try {
            const matDir = await getMaterialDirHandle();
            let subDir = matDir;
            if (sub.folderName) subDir = await matDir.getDirectoryHandle(sub.folderName);
            await fsDelete(subDir, fld.folderId);
        } catch(e) { console.warn(e); }
    }
    
    sub.fields.splice(idx, 1);
    renderTree();
    saveAll();
  }

  async function createNewProblem(subject, field) {
    const id = prompt("問題ID/ファイル名 (例: 001_motion):");
    if (!id) return;
    if (field.problems.find(p => p.id === id)) { alert("ID重複"); return; }
    
    const matId = manifestData[activeMaterialIndex].id;
    let pathParts = [];
    if (currentMaterialType === 'exam_year') {
        pathParts = ['data/explanations', matId, subject.folderName, `${id}.html`];
    } else {
        pathParts = ['data/explanations', matId, subject.folderName, field.folderId, `${id}.html`];
    }
    const path = pathParts.filter(p => p && p.length > 0).join('/').replace(/\/\//g, '/');
    
    const newProb = {
      id: id,
      title: "新規問題",
      desc: "",
      explanationPath: path,
      layout: "article"
    };
    field.problems.push(newProb);

    try {
      const matDir = await getMaterialDirHandle();
      let targetDir = matDir;
      if(subject.folderName && subject.folderName.length > 0) {
          targetDir = await targetDir.getDirectoryHandle(subject.folderName, {create:true});
      }
      if(currentMaterialType !== 'exam_year' && field.folderId && field.folderId.length > 0) {
          targetDir = await getDeepDirectoryHandle(targetDir, field.folderId, true);
      }
      const fh = await targetDir.getFileHandle(`${id}.html`, {create:true});
      const w = await fh.createWritable();
      await w.write(`<h3>${id}</h3><p>解説...</p>`);
      await w.close();
    } catch(e) { console.warn("File Create Warn:", e); }

    currentProblem = newProb; 
    renderTree();
    openEditor(newProb);
    saveAll();
  }

  async function handleDeleteProblem(sub, fld, prob, idx) {
      if(!confirm(`問題「${prob.title}」を削除しますか？`)) return;
      fld.problems.splice(idx, 1);
      try {
          const parts = prob.explanationPath.split('/');
          const fileName = parts.pop();
          let dir = rootDirHandle;
          for(const p of parts) dir = await dir.getDirectoryHandle(p);
          await dir.removeEntry(fileName);
      } catch(e) { console.warn("File delete error:", e); }
      
      if(currentProblem === prob) {
          editorMainWrapper.style.display = 'none';
          currentProblem = null;
      }
      renderTree();
      saveAll();
  }

  async function handleDropProblem(e, targetSub, targetFld) {
    e.preventDefault();
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    
    if (!dragSrcProb || !dragSrcField) return;
    if (dragSrcField === targetFld) return;

    if (!confirm(`「${dragSrcProb.title}」を「${targetFld.fieldName}」へ移動しますか？`)) return;

    const matId = manifestData[activeMaterialIndex].id;
    try {
        const matDir = await getMaterialDirHandle();
        let targetDir = matDir;
        if(targetSub.folderName && targetSub.folderName.length > 0) {
            targetDir = await targetDir.getDirectoryHandle(targetSub.folderName);
        }
        if(currentMaterialType !== 'exam_year' && targetFld.folderId && targetFld.folderId.length > 0) {
            targetDir = await getDeepDirectoryHandle(targetDir, targetFld.folderId, true);
        }
        const success = await fsMoveFile(dragSrcProb.explanationPath, targetDir);
        if(!success) throw new Error("File move failed");
    } catch(e) { alert("移動失敗: " + e); return; }

    const fileName = dragSrcProb.explanationPath.split('/').pop();
    let newPathParts = [];
    if(currentMaterialType === 'exam_year') {
        newPathParts = ['data/explanations', matId, targetSub.folderName, fileName];
    } else {
        newPathParts = ['data/explanations', matId, targetSub.folderName, targetFld.folderId, fileName];
    }
    dragSrcProb.explanationPath = newPathParts.filter(p => p && p.length > 0).join('/').replace(/\/\//g, '/');

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
      if(!name) return;
      const id = prompt("教材ID:", "chemistry");
      if(!id) return;
      const type = prompt("タイプ (standard / exam_year / exam_univ):", "standard");
      
      const newMat = { id: id, name: name, path: `data/materials/${id}.json`, type: type || 'standard' };
      manifestData.push(newMat);
      
      const newJson = { materialName: name, subjects: [] };
      try {
          const dataDir = await rootDirHandle.getDirectoryHandle('data');
          const matDir = await dataDir.getDirectoryHandle('materials');
          const fh = await matDir.getFileHandle(`${id}.json`, {create: true});
          const w = await fh.createWritable();
          await w.write(JSON.stringify(newJson, null, 2));
          await w.close();
          const expDir = await dataDir.getDirectoryHandle('explanations');
          await expDir.getDirectoryHandle(id, {create: true});
      } catch(e) { alert("作成エラー: " + e); return; }

      await saveManifest();
      loadMaterial(manifestData.length - 1);
  }

  async function openEditor(problem) {
    currentProblem = problem;
    editorMainWrapper.style.display = 'flex';
    document.querySelector('.empty-state').style.display = 'none';
    
    tabEdit.click();
    document.getElementById('editing-title').textContent = problem.title;
    document.getElementById('editing-id').textContent = problem.id;
    container.innerHTML = '';

    const basicSec = document.createElement('div');
    basicSec.className = 'form-section';
    basicSec.innerHTML = '<h3>📝 基本情報</h3>';
    
    basicSec.appendChild(createInput('タイトル', problem.title, v=>{ 
        problem.title=v; 
        document.getElementById('editing-title').textContent=v; 
        const activeItem = treeRoot.querySelector('.prob-item.active span:first-child');
        if(activeItem) activeItem.textContent = v;
    }));
    
    const layoutDiv = document.createElement('div'); layoutDiv.className = 'form-group';
    layoutDiv.innerHTML = '<label>レイアウト</label><select class="form-control"><option value="article">記事型</option></select>';
    basicSec.appendChild(layoutDiv);
    container.appendChild(basicSec);

    const explSec = document.createElement('div');
    explSec.className = 'form-section';
    explSec.innerHTML = `<div style="display:flex;justify-content:space-between;"><h3>📖 解説HTML <span style="font-size:0.8em;color:#999;">(${problem.explanationPath})</span></h3><button id="btn-save-expl" class="btn-save">💾 解説保存</button></div>`;
    
    const editorDiv = document.createElement('div');
    editorDiv.className = 'visual-editor';
    editorDiv.contentEditable = true;
    editorDiv.style.minHeight = '300px';
    editorDiv.style.border = '1px solid #ccc';
    editorDiv.style.padding = '10px';
    
    if (problem.explanationPath && rootDirHandle) {
      try {
        const parts = problem.explanationPath.split('/');
        let d = rootDirHandle;
        for(let i=0; i<parts.length-1; i++) d = await d.getDirectoryHandle(parts[i]);
        const f = await d.getFileHandle(parts[parts.length-1]);
        editorDiv.innerHTML = await (await f.getFile()).text();
      } catch(e) { editorDiv.innerText = "読込エラーまたは新規: " + e.message; }
    }
    currentVisualEditor = editorDiv;
    explSec.appendChild(editorDiv);
    container.appendChild(explSec);

    explSec.querySelector('#btn-save-expl').onclick = async () => {
      try {
        const parts = problem.explanationPath.split('/');
        let d = rootDirHandle;
        for(let i=0; i<parts.length-1; i++) d = await d.getDirectoryHandle(parts[i], {create:true});
        const f = await d.getFileHandle(parts[parts.length-1], {create:true});
        const w = await f.createWritable();
        await w.write(editorDiv.innerHTML);
        await w.close();
        showToast("解説HTMLを保存しました");
      } catch(e) { alert("保存エラー: " + e); }
    };
  }

  function createInput(label, val, onChange) {
    const g = document.createElement('div'); g.className='form-group';
    g.innerHTML = `<label>${label}</label>`;
    const i = document.createElement('input'); i.className='form-control'; 
    i.value=val||'';
    if(onChange) i.oninput = (e) => onChange(e.target.value);
    g.appendChild(i);
    return g;
  }
  function createTreeItem(label, text, path) {
    const det = document.createElement('details'); det.dataset.path = path;
    const sum = document.createElement('summary');
    sum.innerHTML = `<span><span style="font-size:0.8em;color:#888;">[${label}]</span> ${text}</span>`;
    det.appendChild(sum);
    return det;
  }
  function addActions(summaryEl, onRename, onDelete, onAdd) {
    const div = document.createElement('div'); div.className = 'tree-actions';
    if(onRename) div.innerHTML += `<button class="tree-btn" title="名前変更">✎</button>`;
    if(onDelete) div.innerHTML += `<button class="tree-btn del" title="削除">🗑</button>`;
    if(onAdd)    div.innerHTML += `<button class="tree-btn add" title="追加">＋</button>`;
    
    const btns = div.querySelectorAll('button');
    let idx=0;
    if(onRename) btns[idx++].onclick = (e) => { e.preventDefault(); e.stopPropagation(); onRename(); };
    if(onDelete) btns[idx++].onclick = (e) => { e.preventDefault(); e.stopPropagation(); onDelete(); };
    if(onAdd)    btns[idx++].onclick = (e) => { e.preventDefault(); e.stopPropagation(); onAdd(); };
    summaryEl.appendChild(div);
  }
  function saveOpenStates() {
    openPaths.clear(); document.querySelectorAll('details[open]').forEach(e => openPaths.add(e.dataset.path));
  }
  function restoreOpenStates() {
    document.querySelectorAll('details').forEach(e => { if(openPaths.has(e.dataset.path)) e.open=true; });
  }
  function showToast(msg, err) {
    const t = document.createElement('div'); t.className='toast';
    t.textContent = msg; if(err) t.style.background='#ef4444';
    document.getElementById('toast-container').appendChild(t);
    setTimeout(()=>t.remove(), 3000);
  }
  
  btnAddSubject.addEventListener('click', () => {
      let promptMsg = "新しい科目名:";
      if(currentMaterialType === 'exam_year') promptMsg = "新しい年度 (例: 2025):";
      else if(currentMaterialType === 'exam_univ') promptMsg = "新しい大学ID (例: waseda):";
      const name = prompt(promptMsg);
      if(!name) return;
      const folderName = prompt("フォルダ名 (英数字推奨):", name);
      currentMaterialData.subjects.push({ subjectName: name, folderName: folderName || name, fields: [] });
      if(folderName && explanationsDirHandle) {
          getMaterialDirHandle().then(d => d.getDirectoryHandle(folderName, {create:true}));
      }
      renderTree();
      saveAll();
  });
});