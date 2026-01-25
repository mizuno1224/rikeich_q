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
  const tabPreview = document.getElementById('tab-preview');
  const container = document.getElementById('form-container');
  
  const viewEditor = document.getElementById('view-editor');
  const viewPreview = document.getElementById('view-preview');
  const previewContainer = document.getElementById('preview-container');

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

  // 3. フォルダ展開/縮小ボタン (科目以外のDetailsを一括操作)
  const btnCollapse = document.createElement('button');
  btnCollapse.className = 'btn-tool';
  btnCollapse.textContent = '📂 展開/縮小';
  btnCollapse.title = '分野フォルダのみを閉じます（科目は開いたまま）';
  btnCollapse.onclick = () => {
    const allDetails = document.querySelectorAll('#tree-root details');
    allDetails.forEach(det => {
      // 親がtree-root(＝科目)以外のdetails(＝分野)の開閉をトグル
      if (det.parentElement.id !== 'tree-root') {
        det.open = !det.open;
      }
    });
  };

  if(sidebarTools) {
      sidebarTools.insertBefore(btnCollapse, sidebarTools.firstChild);
      sidebarTools.appendChild(btnSyncFolders);
      sidebarTools.appendChild(btnSmartImport);
  }

  // --- タブ切り替えロジック (プレビュー機能) ---
  if (tabEdit && tabPreview) {
    tabEdit.onclick = () => {
      tabEdit.classList.add('active');
      tabPreview.classList.remove('active');
      viewEditor.classList.add('active');
      viewPreview.classList.remove('active');
    };

    tabPreview.onclick = () => {
      tabEdit.classList.remove('active');
      tabPreview.classList.add('active');
      viewEditor.classList.remove('active');
      viewPreview.classList.add('active');

      // Iframeを使ってViewer環境を完全再現
      previewContainer.innerHTML = '';
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'width:100%; height:100%; border:none; background:#fff;';
      previewContainer.appendChild(iframe);

      const editorContent = currentVisualEditor ? currentVisualEditor.value : '';
      
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
    else btnAddSubject.textContent = '＋分野を追加'; // 科目ではなく分野(章)を追加するボタンに変更

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
      // await saveManifest(); // 不要なリロードを防ぐため削除

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

    // ★修正: 編集中の問題があれば、ツリー上で再度アクティブ(青色)にする
    if (currentProblem) {
       const items = treeRoot.querySelectorAll('.prob-item');
       items.forEach(el => {
           // IDが表示されているspanを探して照合
           const idSpan = el.querySelector('span:last-child');
           if (idSpan && idSpan.textContent === currentProblem.id) {
               el.classList.add('active');
           }
       });
    }
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
    // 1. 再描画前の状態を保存 (スクロール位置 ＆ 開閉状態)
    const lastScrollTop = treeRoot.scrollTop;
    saveOpenStates(); 

    treeRoot.innerHTML = '';
    if (!currentMaterialData) return;

    let labelSubj = "科目"; let labelField = "分野";
    if (currentMaterialType === 'exam_year') { labelSubj = "年度"; labelField = "区分"; }
    else if (currentMaterialType === 'exam_univ') { labelSubj = "大学"; labelField = "年度"; }

    currentMaterialData.subjects.forEach((sub, sIdx) => {
      // フォルダ名や科目名をIDとして使用し、並び替え時にツリーが閉じないようにする
      const stableSubId = sub.folderName || sub.subjectName || sIdx;
      const subPath = `s-${stableSubId}`;
      
      // 科目（Subject）のDetailsは作成せず、直接ツリーのルートに追加する（フラット化）
      // グループ化（Part）の状態管理は科目ごとにリセット
      let currentPartName = null;
      let currentPartContainer = null;

      sub.fields.forEach((fld, fIdx) => {
        const nameParts = fld.fieldName.split(' / ');
        const isGrouped = nameParts.length > 1;
        const partName = isGrouped ? nameParts[0] : null;
        const chapName = isGrouped ? nameParts[1] : fld.fieldName;

        // グループ化要素またはルート（科目Detailsなし）に追加
        let targetContainer = treeRoot;

        if (isGrouped) {
          if (partName !== currentPartName) {
            currentPartName = partName;
            const partDetails = document.createElement('details');
            partDetails.open = true;
            partDetails.dataset.path = `${subPath}-part-${partName}`; // パスに科目IDを含めて一意性を保つ
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
            
            treeRoot.appendChild(partDetails);
            currentPartContainer = partInner;
          }
          targetContainer = currentPartContainer;
        } else {
          currentPartName = null;
          currentPartContainer = null;
        }

        // 分野IDをキーにして閉じるのを防止
        const stableFldId = fld.folderId || fld.fieldName || fIdx;
        const fldPath = `${subPath}-f-${stableFldId}`;
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
              e.dataTransfer.setData('text/plain', pIdx);
          });
          
          pDiv.addEventListener('dragover', e => {
             e.preventDefault();
             if (dragSrcField === fld) {
               pDiv.style.borderTop = '2px solid #3b82f6';
             }
          });
          
          pDiv.addEventListener('dragleave', () => {
             pDiv.style.borderTop = 'transparent';
          });

          pDiv.addEventListener('drop', e => {
             e.preventDefault();
             e.stopPropagation();
             pDiv.style.borderTop = 'transparent';

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
             
             pDiv.classList.remove('dragging');
             document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
             
             if (dragSrcField !== fld) {
                handleDropProblem(e, sub, fld);
             }
          });

          pDiv.addEventListener('dragend', () => {
             pDiv.classList.remove('dragging');
             pDiv.style.borderTop = 'transparent';
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
    });
    
    // 2. 状態の復元 (開閉状態 ＆ スクロール位置)
    restoreOpenStates();
    treeRoot.scrollTop = lastScrollTop;
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

  // 取り込み実行ロジック
  async function executeSmartImport(htmlRaw, jsonRaw) {
    // 1. クリーニング処理
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
    if (expIndex === -1) {
      throw new Error("無効なパス形式です。パスに 'data/explanations' が含まれていません。");
    }
    
    const matId = pathParts[expIndex + 1];
    if (!matId) throw new Error("パスから教材IDを特定できませんでした。");

    const fileName = pathParts[pathParts.length - 1];
    const innerSegments = pathParts.slice(expIndex + 2, pathParts.length - 1);
    
    if (innerSegments.length === 0) {
        throw new Error("パスの階層が不足しています。科目フォルダが含まれているか確認してください。");
    }

    // 3. 教材データの特定
    const targetMatIndex = manifestData.findIndex(m => m.id === matId);
    if (targetMatIndex === -1) throw new Error(`教材ID "${matId}" が manifest.json に見つかりません`);
    
    if (activeMaterialIndex !== targetMatIndex) {
      await loadMaterial(targetMatIndex);
    }

    // 4. 科目・分野の特定
    const firstSegment = innerSegments[0];
    let targetSubject = currentMaterialData.subjects.find(s => s.folderName === firstSegment);
    let folderIds = "";

    // 科目フォルダが見つからない場合、"フォルダなし科目(folderName==='')" の可能性をチェック
    if (!targetSubject) {
        const emptySubject = currentMaterialData.subjects.find(s => s.folderName === "");
        if (emptySubject) {
            // 空フォルダ科目が存在する場合、パスの第一要素は「分野ID」とみなす
            targetSubject = emptySubject;
            folderIds = innerSegments.join('/'); // 全てを分野パスとする
        }
    }

    // それでも見つからない場合は、通常の科目として新規作成フローへ
    if (!targetSubject) {
      if(!confirm(`科目フォルダ "${firstSegment}" が見つかりません。新規作成しますか？`)) return;
      targetSubject = { subjectName: firstSegment, folderName: firstSegment, fields: [] };
      currentMaterialData.subjects.push(targetSubject);
      const matDir = await getMaterialDirHandle();
      await matDir.getDirectoryHandle(firstSegment, {create: true});
      
      // 新規作成時は標準通り「1つ目が科目、残りが分野」
      folderIds = innerSegments.slice(1).join('/');
    } else if (targetSubject.folderName !== "") {
        // 通常の科目が見つかった場合も「1つ目が科目、残りが分野」
        folderIds = innerSegments.slice(1).join('/');
    }

    let targetField = targetSubject.fields.find(f => f.folderId === folderIds);

    // folderIdsがあるのに見つからない場合は作成
    if (folderIds && !targetField) {
      const confirmMsg = `分野ID "${folderIds}" が見つかりません。\n新規作成しますか？\n(表示名はIDと同じになります)`;
      if(!confirm(confirmMsg)) return;
      
      targetField = {
        fieldName: `新規分野 ${folderIds}`,
        folderId: folderIds,
        problems: []
      };
      targetSubject.fields.push(targetField);
      
      const matDir = await getMaterialDirHandle();
      const subDir = await matDir.getDirectoryHandle(subFolder, {create:true});
      await getDeepDirectoryHandle(subDir, folderIds, true);
    } else if (!folderIds && !targetField) {
       // folderIdsが空の場合は科目直下だが、通常fieldsは必須。
       // ここでは簡易的にエラーとせず進めるが、必要に応じて処理追加
    }

    // 5. 問題データの追加/更新
    if (!targetField) throw new Error("分野(Field)を特定・作成できませんでした。");

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

    // 6. 先にデータを保存 (HTML書き込みでリロードが発生しても登録が消えないようにする)
    await saveAll();

    // 7. HTMLファイルの書き込み
    if (htmlClean) {
      try {
        const matDir = await getMaterialDirHandle();
        const subDir = await matDir.getDirectoryHandle(subFolder);
        const fieldDir = await getDeepDirectoryHandle(subDir, folderIds, true);
        const fileHandle = await fieldDir.getFileHandle(fileName, {create: true});
        const w = await fileHandle.createWritable();
        await w.write(htmlClean);
        await w.close();
      } catch(e) {
        console.warn("HTML書き込みエラー: ", e);
        alert("HTMLファイルの保存に失敗しましたが、メタデータは更新されました。");
      }
    } else {
      console.log("HTML input was empty, skipping file write.");
    }

    // 8. UI更新
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
                // パスセグメントごとの完全一致置換を行う
                const parts = p.explanationPath.split('/');
                const newParts = parts.map(part => part === oldFolder ? newName : part);
                p.explanationPath = newParts.join('/');
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
    // 既存の「編」名を取得して、入力のヒントにする
    const existingParts = [...new Set(sub.fields
      .map(f => f.fieldName.split(' / '))
      .filter(parts => parts.length > 1)
      .map(parts => parts[0])
    )];
    
    let defaultName = `新規${label}`;
    let hintId = '01';

    // 教科書型かつ既に編がある場合は、最後の編をデフォルトにする
    if(manifestData[activeMaterialIndex].id === 'textbook') {
      if (existingParts.length > 0) {
        defaultName = `${existingParts[existingParts.length-1]} / 新規章`;
        hintId = '01/02'; 
      } else {
        defaultName = "第1編 力と運動 / 第1章 剛体";
        hintId = '01/01';
      }
    } else if(currentMaterialType === 'exam_year') {
      hintId = 'main';
    }

    const nameInput = prompt(`新しい${label}名 (表示名):\n※「第1編 ... / 第1章 ...」のようにスラッシュ区切りで階層化できます`, defaultName);
    if(!nameInput) return;

    // フォルダIDの自動提案（ユーザー入力用）
    const folderId = prompt(`フォルダID (ディレクトリ名):\n※実際のフォルダ名になります。「01/01」のように階層化可能`, hintId);
    if(!folderId) return;

    try {
        const matDir = await getMaterialDirHandle();
        let subDir = matDir;
        // 科目フォルダ確保
        if (sub.folderName && sub.folderName.length > 0) {
            subDir = await matDir.getDirectoryHandle(sub.folderName, {create:true});
        }
        // 分野フォルダ確保
        if(currentMaterialType !== 'exam_year') {
            await getDeepDirectoryHandle(subDir, folderId, true);
        }
    } catch(e) { 
        console.warn("FS Create Warn:", e); 
        alert("フォルダの作成に失敗した可能性がありますが、登録を続行します。\n" + e);
    }

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
    if (tabEdit) tabEdit.click();

    // ヘッダー更新
    document.getElementById('editing-title').textContent = problem.title;
    document.getElementById('editing-id').textContent = problem.id;
    container.innerHTML = '';

    // === 1. 詳細編集エリア (ID, Title, Desc, Path, Layout) ===
    const infoSec = document.createElement('div');
    infoSec.className = 'form-section';
    infoSec.innerHTML = '<h3>📝 基本情報編集</h3>';

    // 2カラムレイアウト
    const gridStyle = 'display:grid; grid-template-columns: 1fr 1fr; gap:15px;';
    const row1 = document.createElement('div'); row1.style.cssText = gridStyle;
    const row2 = document.createElement('div'); row2.style.cssText = gridStyle;

    // ヘルパー: JSONビューを更新
    const updateJson = () => { if(document.getElementById('json-editor-area')) document.getElementById('json-editor-area').value = JSON.stringify(problem, null, 2); };

    // 各入力フィールド
    row1.appendChild(createInput('ID', problem.id, val => { problem.id = val; document.getElementById('editing-id').textContent = val; updateJson(); }));

    const titleGroup = createInput('タイトル', problem.title, val => { 
        problem.title = val; 
        document.getElementById('editing-title').textContent = val;
        // ツリー上の表示も更新
        const activeItem = treeRoot.querySelector('.prob-item.active span:first-child');
        if(activeItem) activeItem.textContent = val;
        updateJson();
    });
    titleGroup.style.width = '100%';

    const descGroup = createInput('説明文', problem.desc || '', val => { problem.desc = val; updateJson(); });
    descGroup.style.width = '100%';

    const pathGroup = createInput('解説パス (explanationPath)', problem.explanationPath, val => { problem.explanationPath = val; updateJson(); });
    pathGroup.style.width = '100%';

    infoSec.appendChild(row1);
    infoSec.appendChild(titleGroup);
    infoSec.appendChild(descGroup);
    infoSec.appendChild(row2);
    infoSec.appendChild(pathGroup);

    // === 2. JSONソース直接編集エリア ===
    const jsonSec = document.createElement('div');
    jsonSec.style.marginTop = '15px';
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = '🔧 ソースコード(JSON)を直接編集';
    summary.style.fontSize = '0.9rem';
    summary.style.color = '#64748b';
    details.appendChild(summary);

    const jsonEditor = document.createElement('textarea');
    jsonEditor.id = 'json-editor-area';
    jsonEditor.style.cssText = 'width:100%; height:150px; font-family:monospace; font-size:12px; background:#1e1e1e; color:#d4d4d4; padding:10px; border-radius:4px; margin-top:5px;';
    jsonEditor.spellcheck = false;
    jsonEditor.value = JSON.stringify(problem, null, 2);
    
    // JSON手動変更時の反映
    jsonEditor.addEventListener('change', () => {
        try {
            const newObj = JSON.parse(jsonEditor.value);
            Object.keys(currentProblem).forEach(k => delete currentProblem[k]);
            Object.assign(currentProblem, newObj);
            openEditor(currentProblem); // フォームを再描画
            showToast('JSONを適用しました');
        } catch(e) { alert('JSON形式エラー: ' + e); }
    });

    details.appendChild(jsonEditor);
    jsonSec.appendChild(details);
    infoSec.appendChild(jsonSec);
    container.appendChild(infoSec);

    // === 3. 解説HTMLエディタ ===
    const explSec = document.createElement('div');
    explSec.className = 'form-section';
    explSec.style.display = 'flex';
    explSec.style.flexDirection = 'column';
    explSec.style.flex = '1'; 
    explSec.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3 style="margin:0;">📖 解説HTML編集</h3>
        <button id="btn-save-expl" class="btn-save">💾 解説を保存</button>
      </div>
    `;
    
    const editorArea = document.createElement('textarea');
    editorArea.className = 'visual-editor'; 
    editorArea.style.cssText = 'flex:1; width:100%; min-height:400px; font-family:monospace; font-size:14px; background:#1e1e1e; color:#d4d4d4; padding:15px; border-radius:6px; resize:none;';
    editorArea.spellcheck = false;

    if (problem.explanationPath && rootDirHandle) {
      try {
        const parts = problem.explanationPath.split('/');
        let d = rootDirHandle;
        for(let i=0; i<parts.length-1; i++) d = await d.getDirectoryHandle(parts[i]);
        const f = await d.getFileHandle(parts[parts.length-1]);
        editorArea.value = await (await f.getFile()).text();
      } catch(e) { editorArea.value = "\n"; }
    }
    currentVisualEditor = editorArea;
    explSec.appendChild(editorArea);
    container.appendChild(explSec);
    
    explSec.querySelector('#btn-save-expl').onclick = async () => {
      try {
        const parts = problem.explanationPath.split('/');
        let d = rootDirHandle;
        for(let i=0; i<parts.length-1; i++) d = await d.getDirectoryHandle(parts[i], {create:true});
        const f = await d.getFileHandle(parts[parts.length-1], {create:true});
        const w = await f.createWritable();
        await w.write(editorArea.value);
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
      // 科目分類が非表示になったため、標準タイプでは「分野(章)を追加」として動作させる
      if (currentMaterialType === 'standard' || currentMaterialType === 'lead_alpha' || currentMaterialType === 'lead_light' || currentMaterialType === 'textbook') {
          // 科目が一つもない場合はデフォルト科目を作成してそこに追加
          if (currentMaterialData.subjects.length === 0) {
              currentMaterialData.subjects.push({ subjectName: 'main', folderName: '', fields: [] });
          }
          // 最初の科目に分野を追加
          handleAddField(currentMaterialData.subjects[0], '分野');
          return;
      }

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