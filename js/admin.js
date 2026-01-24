/* js/admin.js */

// Global State
let manifestData = [];      
let currentMaterialData = null; 
let currentMaterialPath = null;
let currentMaterialType = 'standard'; // 'standard' | 'exam_year' | 'exam_univ'

let isLegacyMode = false;
let rootDirHandle = null;
let explanationsDirHandle = null;
let jsProblemsDirHandle = null;

let activeMaterialIndex = 0;
let openPaths = new Set();
let currentProblem = null;
let currentVisualEditor = null;

document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const btnOpen = document.getElementById('btn-open');
  const btnSave = document.getElementById('btn-save');
  const btnImportAI = document.getElementById('btn-import-ai');
  const btnAddSubject = document.getElementById('btn-add-subject'); // 科目/大学/年度 追加ボタン
  
  const mainUi = document.getElementById('main-ui');
  const initialMsg = document.getElementById('initial-msg');
  const tabsArea = document.getElementById('material-tabs');
  const treeRoot = document.getElementById('tree-root');
  
  const editorMainWrapper = document.getElementById('editor-main-wrapper');
  const tabEdit = document.getElementById('tab-edit');
  const tabPreview = document.getElementById('tab-preview');
  const viewEditor = document.getElementById('view-editor');
  const viewPreview = document.getElementById('view-preview');
  const previewContainer = document.getElementById('preview-container');

  // Modals
  const codeModal = document.getElementById('code-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnSaveCode = document.getElementById('btn-save-code');
  const codeEditor = document.getElementById('code-editor');

  const importModal = document.getElementById('import-modal');
  const btnCloseImport = document.getElementById('btn-close-import');
  const btnExecImport = document.getElementById('btn-exec-import');
  const impSelect = document.getElementById('import-target-material');
  const impHtml = document.getElementById('imp-html');
  const impJs = document.getElementById('imp-js');
  const impJson = document.getElementById('imp-json');

  // --- 1. プロジェクトを開く ---
  btnOpen.addEventListener('click', async () => {
    try {
      rootDirHandle = await window.showDirectoryPicker();
      
      // フォルダハンドル取得チェック
      try {
        const dataDir = await rootDirHandle.getDirectoryHandle('data', { create: true });
        explanationsDirHandle = await dataDir.getDirectoryHandle('explanations', { create: true });
        // jsフォルダは任意（旧互換）
        try {
          const jsDir = await rootDirHandle.getDirectoryHandle('js');
          jsProblemsDirHandle = await jsDir.getDirectoryHandle('problems');
        } catch(e) {}
      } catch (e) {
        showToast("フォルダ構成エラー: data/explanations が必要です", true);
        return;
      }

      // マニフェスト読み込み
      try {
        const dataDir = await rootDirHandle.getDirectoryHandle('data');
        const manifestHandle = await dataDir.getFileHandle('manifest.json');
        const file = await manifestHandle.getFile();
        manifestData = JSON.parse(await file.text());
        isLegacyMode = false;
        showToast("manifest.json を読み込みました");
      } catch (e) {
        // マニフェストがない場合、旧 problems.json を探す（移行モード）
        try {
          const legacyHandle = await rootDirHandle.getFileHandle('problems.json');
          const file = await legacyHandle.getFile();
          const legacyData = JSON.parse(await file.text());
          
          isLegacyMode = true;
          // 旧データをメモリ上で新形式にマップ
          manifestData = legacyData.map(mat => {
            // 簡易的なタイプ判定
            let type = 'standard';
            if(mat.materialName.includes('共通')) type = 'exam_year';
            else if(mat.materialName.includes('入試') || mat.materialName.includes('大学')) type = 'exam_univ';

            return {
              id: mat.materialFolder || `mat_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
              name: mat.materialName,
              path: `data/materials/${mat.materialFolder || 'common'}.json`,
              type: type,
              _tempData: mat
            };
          });
          
          alert("旧形式(problems.json)を検出しました。\n「全体保存」を押すと、推奨構成（data/manifest.json + 教材別ファイル）へ変換保存されます。");
        } catch (err2) {
           if(confirm("データファイルが見つかりません。新規プロジェクトとして初期化しますか？")) {
             manifestData = []; isLegacyMode = false;
           } else { return; }
        }
      }

      initialMsg.style.display = 'none';
      mainUi.style.display = 'flex';
      btnSave.disabled = false;
      btnImportAI.style.display = 'inline-block';
      btnOpen.textContent = "✅ " + rootDirHandle.name;

      if (manifestData.length > 0) {
        await loadMaterial(0);
      } else {
        renderTabs();
        treeRoot.innerHTML = '<div style="padding:20px; color:#666;">教材がありません。data/manifest.jsonを作成してください。</div>';
      }

    } catch (err) { console.error(err); }
  });

  // --- 教材データのロード ---
  async function loadMaterial(index) {
    activeMaterialIndex = index;
    const item = manifestData[index];
    currentMaterialPath = item.path;
    currentMaterialType = item.type || 'standard';

    // UI調整: 追加ボタンのラベル変更
    if(currentMaterialType === 'exam_year') btnAddSubject.textContent = '＋年度を追加';
    else if(currentMaterialType === 'exam_univ') btnAddSubject.textContent = '＋大学を追加';
    else btnAddSubject.textContent = '＋科目を追加';

    if (item._tempData) {
      currentMaterialData = item._tempData;
    } else {
      try {
        // path: "data/materials/textbook.json" -> 分割してロード
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
    }
    renderApp();
  }

  // --- 保存処理 (各教材1ファイル) ---
  btnSave.addEventListener('click', async () => {
    if (!rootDirHandle) return;
    saveOpenStates();

    try {
      const dataDir = await rootDirHandle.getDirectoryHandle('data', { create: true });
      
      // 1. マニフェスト保存
      const cleanManifest = manifestData.map(m => ({
        id: m.id, name: m.name, path: m.path, type: m.type
      }));
      const manifestHandle = await dataDir.getFileHandle('manifest.json', { create: true });
      const mw = await manifestHandle.createWritable();
      await mw.write(JSON.stringify(cleanManifest, null, 2));
      await mw.close();

      // 2. 教材ファイル保存
      const matDir = await dataDir.getDirectoryHandle('materials', { create: true });

      if (isLegacyMode) {
        // 移行モード: 全データを個別ファイルに書き出し
        for (let i = 0; i < manifestData.length; i++) {
           const m = manifestData[i];
           const data = m._tempData || currentMaterialData; 
           const filename = m.path.split('/').pop();
           const fh = await matDir.getFileHandle(filename, { create: true });
           const w = await fh.createWritable();
           await w.write(JSON.stringify(data, null, 2));
           await w.close();
           delete m._tempData;
        }
        isLegacyMode = false;
        showToast("データ移行完了: manifest + 分割JSON形式で保存しました");
      } else {
        // 通常モード: 現在の教材のみ保存（効率化）
        if (currentMaterialData && currentMaterialPath) {
          const filename = currentMaterialPath.split('/').pop();
          const fh = await matDir.getFileHandle(filename, { create: true });
          const w = await fh.createWritable();
          await w.write(JSON.stringify(currentMaterialData, null, 2));
          await w.close();
          showToast(`「${currentMaterialData.materialName}」を保存しました`);
        }
      }
    } catch (e) { showToast('保存失敗: ' + e, true); }
  });

  // --- UI Render ---
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
  }

  function renderTree() {
    treeRoot.innerHTML = '';
    if (!currentMaterialData) return;

    // タイプに応じたラベル定義
    let labelSubj = "科目"; // Subject階層
    let labelField = "分野"; // Field階層
    
    if (currentMaterialType === 'exam_year') {
      labelSubj = "年度"; labelField = "試験区分";
    } else if (currentMaterialType === 'exam_univ') {
      labelSubj = "大学"; labelField = "年度";
    }

    // Subjects Loop
    currentMaterialData.subjects.forEach((sub, sIdx) => {
      const subPath = `s-${sIdx}`;
      const subDetails = createTreeItem(labelSubj, sub.subjectName, subPath);
      
      // Actions
      addActions(subDetails.querySelector('summary'), 
        () => { // Rename
           const n = prompt(`${labelSubj}名を変更:`, sub.subjectName);
           if(n) { sub.subjectName = n; renderTree(); }
        },
        () => { // Delete
           if(confirm("削除しますか？")) { currentMaterialData.subjects.splice(sIdx, 1); renderTree(); }
        },
        () => { // Add Child (Field)
           const ex = currentMaterialType==='standard' ? '01_mechanics' : (currentMaterialType==='exam_univ'?'2025':'main');
           const f = prompt(`新しい${labelField}のフォルダIDを入力:\n(例: ${ex})`);
           if(f) {
             // 表示名もとりあえずIDと同じにする
             sub.fields.push({ fieldName: f, folderId: f, problems: [] });
             // フォルダ実体作成
             createFolder(sub.folderName, f);
             renderTree();
             setTimeout(() => { subDetails.open = true; }, 50);
           }
        }
      );

      const subContent = document.createElement('div');
      subContent.className = 'tree-content';

      // Fields Loop
      sub.fields.forEach((fld, fIdx) => {
        const fldDetails = createTreeItem(labelField, fld.fieldName, `${subPath}-f-${fIdx}`);
        
        addActions(fldDetails.querySelector('summary'),
          () => { const n = prompt(`${labelField}名を変更:`, fld.fieldName); if(n) { fld.fieldName=n; renderTree(); } },
          () => { if(confirm("削除しますか？")) { sub.fields.splice(fIdx, 1); renderTree(); } },
          null 
        );

        const fldContent = document.createElement('div');
        fldContent.className = 'tree-content';

        fld.problems.forEach((prob) => {
          const pDiv = document.createElement('div');
          pDiv.className = `prob-item ${currentProblem === prob ? 'active' : ''}`;
          pDiv.innerHTML = `<span>${prob.title || '(無題)'}</span><span style="font-size:0.8em;color:#999;">${prob.id}</span>`;
          pDiv.onclick = () => openEditor(prob, sub.folderName, fld.folderId);
          fldContent.appendChild(pDiv);
        });

        // Add Problem Button
        const btnAdd = document.createElement('div');
        btnAdd.className = 'prob-item';
        btnAdd.style.color = '#10b981';
        btnAdd.textContent = '＋ 問題追加';
        btnAdd.onclick = () => createNewProblem(sub, fld);
        fldContent.appendChild(btnAdd);

        fldDetails.appendChild(fldContent);
        subContent.appendChild(fldDetails);
      });

      subDetails.appendChild(subContent);
      treeRoot.appendChild(subDetails);
    });
    restoreOpenStates();
  }
  
  // --- Folder Creation Helper ---
  async function createFolder(subFolder, fieldFolder) {
    if(!explanationsDirHandle) return;
    try {
      const matId = manifestData[activeMaterialIndex].id; // id = フォルダ名
      let d = explanationsDirHandle;
      d = await d.getDirectoryHandle(matId, {create:true});
      d = await d.getDirectoryHandle(subFolder, {create:true});
      await d.getDirectoryHandle(fieldFolder, {create:true});
    } catch(e) { console.warn("Folder create warn:", e); }
  }

  // --- Create New Problem Logic ---
  async function createNewProblem(subject, field) {
    const id = prompt("問題IDを入力 (例: q1, 001_motion):");
    if (!id) return;
    if (field.problems.find(p => p.id === id)) { alert("ID重複"); return; }
    
    // パス構築: data/explanations/{material_id}/{subject}/{field}/{id}.html
    const matId = manifestData[activeMaterialIndex].id;
    const path = `data/explanations/${matId}/${subject.folderName}/${field.folderId}/${id}.html`;
    
    const newProb = {
      id: id,
      title: "新規問題",
      desc: "",
      explanationPath: path,
      layout: "article"
    };
    field.problems.push(newProb);

    // ファイル作成
    try {
      let dir = explanationsDirHandle;
      dir = await dir.getDirectoryHandle(matId, {create:true});
      dir = await dir.getDirectoryHandle(subject.folderName, {create:true});
      dir = await dir.getDirectoryHandle(field.folderId, {create:true});
      const fh = await dir.getFileHandle(`${id}.html`, {create:true});
      const w = await fh.createWritable();
      await w.write(`<h3>${id}</h3><p>ここに解説を記述...</p>`);
      await w.close();
    } catch(e) { console.warn("File create warn:", e); }

    renderTree();
    openEditor(newProb, subject.folderName, field.folderId);
  }

  // --- Editor & Preview Logic ---
  async function openEditor(problem, subjectDir, fieldDir) {
    currentProblem = problem;
    editorMainWrapper.style.display = 'flex';
    document.querySelector('.empty-state').style.display = 'none';
    
    tabEdit.click();
    document.getElementById('editing-title').textContent = problem.title;
    document.getElementById('editing-id').textContent = problem.id;
    const container = document.getElementById('form-container');
    container.innerHTML = '';

    // Basic Info
    const basicSec = document.createElement('div');
    basicSec.className = 'form-section';
    basicSec.innerHTML = '<h3>📝 基本情報</h3>';
    basicSec.appendChild(createInput('タイトル', problem.title, v=>{ problem.title=v; document.getElementById('editing-title').textContent=v; }));
    basicSec.appendChild(createInput('ID (参照のみ)', problem.id, null, true));
    
    // Layout Select
    const layoutDiv = document.createElement('div'); layoutDiv.className = 'form-group';
    layoutDiv.innerHTML = '<label>レイアウト</label><select class="form-control"><option value="article">記事型</option></select>';
    basicSec.appendChild(layoutDiv);
    container.appendChild(basicSec);

    // HTML Editor
    const explSec = document.createElement('div');
    explSec.className = 'form-section';
    explSec.innerHTML = '<div style="display:flex;justify-content:space-between;"><h3>📖 解説HTML</h3><button id="btn-save-expl" class="btn-save" style="padding:4px 10px;font-size:0.9rem;">💾 解説保存</button></div>';
    
    const editorDiv = document.createElement('div');
    editorDiv.className = 'visual-editor';
    editorDiv.contentEditable = true;
    editorDiv.style.border = '1px solid #ccc';
    editorDiv.style.marginTop = '10px';
    
    // Load Content
    if (problem.explanationPath && rootDirHandle) {
      try {
        // "data/explanations/..." -> parts
        const parts = problem.explanationPath.split('/');
        let d = rootDirHandle;
        // pathの先頭から順にディレクトリを辿る
        for(let i=0; i<parts.length-1; i++) {
          // dataなどのフォルダ名が変わっている可能性への対処は省略(マニフェスト正前提)
          d = await d.getDirectoryHandle(parts[i]);
        }
        const f = await d.getFileHandle(parts[parts.length-1]);
        editorDiv.innerHTML = await (await f.getFile()).text();
      } catch(e) { editorDiv.innerText = "読込エラーまたは新規: " + e.message; }
    }
    
    currentVisualEditor = editorDiv;
    explSec.appendChild(editorDiv);
    container.appendChild(explSec);

    // Save HTML
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

  // --- Tab Switching ---
  tabEdit.onclick = () => {
    tabEdit.classList.add('active'); tabPreview.classList.remove('active');
    viewEditor.style.display='block'; viewPreview.style.display='none';
  };
  tabPreview.onclick = () => {
    tabEdit.classList.remove('active'); tabPreview.classList.add('active');
    viewEditor.style.display='none'; viewPreview.style.display='block';
    if(currentVisualEditor) {
      previewContainer.innerHTML = currentVisualEditor.innerHTML;
      if(window.MathJax) MathJax.typesetPromise([previewContainer]);
      executeInlineScripts(previewContainer);
    }
  };
  
  function executeInlineScripts(el) {
    Array.from(el.querySelectorAll('script')).forEach(s => {
      const ns = document.createElement('script');
      Array.from(s.attributes).forEach(a => ns.setAttribute(a.name, a.value));
      ns.textContent = s.textContent;
      try{ s.parentNode.replaceChild(ns, s); }catch(e){}
    });
  }

  // --- Helpers ---
  function createInput(label, val, onChange, disabled=false) {
    const g = document.createElement('div'); g.className='form-group';
    g.innerHTML = `<label>${label}</label>`;
    const i = document.createElement('input'); i.className='form-control'; 
    i.value=val||''; i.disabled=disabled;
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
    if(onRename) div.innerHTML += `<button class="tree-btn">✎</button>`;
    if(onDelete) div.innerHTML += `<button class="tree-btn del">🗑</button>`;
    if(onAdd)    div.innerHTML += `<button class="tree-btn add">＋</button>`;
    
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

  // Header Button (Add Subject/Univ/Year)
  btnAddSubject.addEventListener('click', () => {
    let promptMsg = "新しい科目名:";
    if(currentMaterialType === 'exam_year') promptMsg = "新しい年度 (例: 2025):";
    if(currentMaterialType === 'exam_univ') promptMsg = "新しい大学ID (例: waseda):";
    
    const name = prompt(promptMsg);
    if(!name) return;
    
    // 追加
    currentMaterialData.subjects.push({
      subjectName: name, 
      folderName: name, // フォルダ名も同一にする
      fields: []
    });
    
    // フォルダ作成
    const matId = manifestData[activeMaterialIndex].id;
    if(explanationsDirHandle) {
      explanationsDirHandle.getDirectoryHandle(matId, {create:true})
        .then(d => d.getDirectoryHandle(name, {create:true}));
    }
    renderTree();
  });
});