/* js/admin.js */

let currentData = [];
let rootDirHandle = null;
let jsonFileHandle = null;
let explanationsDirHandle = null;
let jsProblemsDirHandle = null;

let activeMaterialIndex = 0;
let openPaths = new Set();
let currentJsHandle = null;
let currentProblem = null;
let currentProblemContext = null;

document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const btnOpen = document.getElementById('btn-open');
  const btnSave = document.getElementById('btn-save');
  const btnImportAI = document.getElementById('btn-import-ai');
  
  const mainUi = document.getElementById('main-ui');
  const initialMsg = document.getElementById('initial-msg');
  const tabsArea = document.getElementById('material-tabs');
  const treeRoot = document.getElementById('tree-root');
  const editorPanel = document.getElementById('editor-content');
  const emptyState = document.querySelector('.empty-state');
  
  // Code Modal
  const modal = document.getElementById('code-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnSaveCode = document.getElementById('btn-save-code');
  const codeEditor = document.getElementById('code-editor');

  // Import Modal Elements
  const importModal = document.getElementById('import-modal');
  const btnCloseImport = document.getElementById('btn-close-import');
  const btnExecImport = document.getElementById('btn-exec-import');
  const impSelect = document.getElementById('import-target-material');
  const impHtml = document.getElementById('imp-html');
  const impJs = document.getElementById('imp-js');
  const impJson = document.getElementById('imp-json');

  // --- 1. フォルダを開く ---
  btnOpen.addEventListener('click', async () => {
    try {
      rootDirHandle = await window.showDirectoryPicker();
      
      try {
        jsonFileHandle = await rootDirHandle.getFileHandle('problems.json');
        const file = await jsonFileHandle.getFile();
        currentData = JSON.parse(await file.text());
      } catch (e) {
        alert('problems.json が見つかりません。');
        return;
      }

      try {
        const dataDir = await rootDirHandle.getDirectoryHandle('data', { create: true });
        explanationsDirHandle = await dataDir.getDirectoryHandle('explanations', { create: true });
        
        const jsDir = await rootDirHandle.getDirectoryHandle('js', { create: true });
        jsProblemsDirHandle = await jsDir.getDirectoryHandle('problems', { create: true });
      } catch (e) {
        showToast("フォルダ構成エラー: " + e, true);
        return;
      }

      initialMsg.style.display = 'none';
      mainUi.style.display = 'flex';
      btnSave.disabled = false;
      btnImportAI.style.display = 'inline-block';
      btnOpen.textContent = "✅ " + rootDirHandle.name;
      
      activeMaterialIndex = 0;
      renderApp();
    } catch (err) { console.error(err); }
  });

  // --- 全体保存 ---
  btnSave.addEventListener('click', async () => {
    if (!jsonFileHandle) return;
    saveOpenStates();
    try {
      const writable = await jsonFileHandle.createWritable();
      await writable.write(JSON.stringify(currentData, null, 2));
      await writable.close();
      showToast('全体構成(JSON)を保存しました！');
    } catch (e) { showToast('保存失敗: ' + e, true); }
  });

  // --- AI取込モーダル表示 ---
  btnImportAI.addEventListener('click', () => {
    // 入力欄クリア
    impHtml.value = '';
    impJs.value = '';
    impJson.value = '';
    
    // 教材プルダウン更新
    impSelect.innerHTML = '';
    currentData.forEach((mat, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = mat.materialName;
      if (idx === activeMaterialIndex) opt.selected = true;
      impSelect.appendChild(opt);
    });

    importModal.style.display = 'flex';
  });
  btnCloseImport.onclick = () => importModal.style.display = 'none';

  // --- AI取込実行 ---
  btnExecImport.addEventListener('click', async () => {
    const targetMatIdx = parseInt(impSelect.value);
    const htmlContent = impHtml.value.trim();
    const jsContent = impJs.value.trim();
    const jsonStr = impJson.value.trim();

    if (isNaN(targetMatIdx) || !jsonStr) {
      alert("必須項目（教材選択、JSON）が不足しています。");
      return;
    }

    try {
      // JSONパース
      let meta;
      try { meta = JSON.parse(jsonStr); } catch(e) { throw new Error("JSONの形式が不正です"); }

      // 必須チェック修正: jsPath は任意とする
      if (!meta.id || !meta.explanationPath) {
        throw new Error("JSONに必要なキー(id, explanationPath)がありません");
      }

      // パス解析
      // jsPathが無い場合は explanationPath から科目・分野ディレクトリを推定する
      // explanationPath: data/explanations/科目/分野/ID.html
      // pathParts: [data, explanations, 科目, 分野, ID.html]
      // インデックス: 2=科目, 3=分野
      let subjectDir, fieldDir, fileNameHTML, fileNameJS;

      const explParts = meta.explanationPath.split('/');
      if (explParts.length < 5) throw new Error("explanationPathの形式が不正です(data/explanations/科目/分野/ファイル.html である必要があります)");
      
      subjectDir = explParts[2];
      fieldDir = explParts[3];
      fileNameHTML = explParts[4];

      // JSがある場合のみ解析
      if (meta.jsPath) {
        const jsParts = meta.jsPath.split('/');
        if (jsParts.length >= 5) {
            fileNameJS = jsParts[4];
        }
      }

      // ファイル保存
      // 1. HTML
      if (htmlContent) {
        let dir = explanationsDirHandle;
        dir = await dir.getDirectoryHandle(subjectDir, { create: true });
        dir = await dir.getDirectoryHandle(fieldDir, { create: true });
        const file = await dir.getFileHandle(fileNameHTML, { create: true });
        const writable = await file.createWritable();
        await writable.write(htmlContent);
        await writable.close();
      }

      // 2. JS (中身があり、パスも指定されている場合のみ)
      if (jsContent && fileNameJS) {
        let dir = jsProblemsDirHandle;
        dir = await dir.getDirectoryHandle(subjectDir, { create: true });
        dir = await dir.getDirectoryHandle(fieldDir, { create: true });
        const file = await dir.getFileHandle(fileNameJS, { create: true });
        const writable = await file.createWritable();
        await writable.write(jsContent);
        await writable.close();
      }

      // 3. データ登録
      const materialObj = currentData[targetMatIdx];
      
      // 科目検索or作成
      let subjectObj = materialObj.subjects.find(s => s.folderName === subjectDir);
      if (!subjectObj) {
        subjectObj = { subjectName: subjectDir, folderName: subjectDir, fields: [] };
        materialObj.subjects.push(subjectObj);
      }

      // 分野検索or作成
      let fieldObj = subjectObj.fields.find(f => f.folderId === fieldDir);
      if (!fieldObj) {
        fieldObj = { fieldName: fieldDir, folderId: fieldDir, problems: [] };
        subjectObj.fields.push(fieldObj);
      }

      // 重複チェック
      const existingIdx = fieldObj.problems.findIndex(p => p.id === meta.id);
      
      // jsPathは無ければ登録しない (undefined)
      const newProb = {
        id: meta.id,
        title: meta.title || "無題",
        desc: meta.desc || "",
        explanationPath: meta.explanationPath,
        layout: meta.layout // 記事型レイアウト設定を保持
      };
      if (meta.jsPath) newProb.jsPath = meta.jsPath;

      if (existingIdx >= 0) {
        // 既存のプロパティを維持しつつ更新
        fieldObj.problems[existingIdx] = { ...fieldObj.problems[existingIdx], ...newProb };
      } else {
        fieldObj.problems.push(newProb);
      }

      // 完了処理
      importModal.style.display = 'none';
      showToast(`${materialObj.materialName} に追加しました！`);
      btnSave.disabled = false; // 全体保存ボタン有効化
      
      // タブを切り替えて表示
      activeMaterialIndex = targetMatIdx;
      renderApp();

    } catch (e) {
      alert("取り込みエラー:\n" + e.message);
    }
  });


  // --- 描画関数群 ---
  function renderApp() {
    renderTabs();
    renderTree();
  }

  function renderTabs() {
    tabsArea.innerHTML = '';
    currentData.forEach((mat, idx) => {
      const btn = document.createElement('button');
      btn.className = `tab-btn ${idx === activeMaterialIndex ? 'active' : ''}`;
      btn.textContent = mat.materialName;
      btn.onclick = () => { saveOpenStates(); activeMaterialIndex = idx; renderApp(); };
      tabsArea.appendChild(btn);
    });
  }

  function renderTree() {
    treeRoot.innerHTML = '';
    const mat = currentData[activeMaterialIndex];
    if(!mat) return;

    mat.subjects.forEach((sub, sIdx) => {
      const subPath = `s-${sIdx}`;
      const subDetails = createDetails('科目', sub.subjectName, subPath, sIdx, mat.subjects);
      const subContent = document.createElement('div');
      subContent.className = 'tree-content';

      sub.fields.forEach((fld, fIdx) => {
        const fldPath = `s-${sIdx}-f-${fIdx}`;
        const fldDetails = createDetails('分野', fld.fieldName, fldPath, fIdx, sub.fields);
        const fldContent = document.createElement('div');
        fldContent.className = 'tree-content';

        fld.problems.forEach((prob, pIdx) => {
          const pDiv = document.createElement('div');
          pDiv.className = `prob-item ${currentProblem === prob ? 'active' : ''}`;
          pDiv.innerHTML = `<span>${prob.title || '(無題)'}</span>`;
          pDiv.onclick = () => openEditor(prob, sub.folderName, fld.folderId);
          fldContent.appendChild(pDiv);
        });
        fldDetails.appendChild(fldContent);
        subContent.appendChild(fldDetails);
      });
      subDetails.appendChild(subContent);
      treeRoot.appendChild(subDetails);
    });
    restoreOpenStates();
  }

  // --- エディタ機能 ---
  async function openEditor(problem, subjectDir, fieldDir) {
    currentProblem = problem;
    currentProblemContext = { subjectDir, fieldDir };

    emptyState.style.display = 'none';
    editorPanel.style.display = 'block';
    
    document.getElementById('editing-title').textContent = problem.title;
    document.getElementById('editing-id').textContent = `ID: ${problem.id}`;
    
    const container = document.getElementById('form-container');
    container.innerHTML = '';

    // A. 基本情報
    const basicSec = document.createElement('div');
    basicSec.className = 'form-section';
    basicSec.innerHTML = `<h3>📝 基本情報</h3>`;
    basicSec.appendChild(createInput('タイトル', problem.title, v => { problem.title = v; renderApp(); }));
    basicSec.appendChild(createInput('説明', problem.desc, v => problem.desc = v));
    
    // レイアウト設定 (記事型かどうか)
    const layoutDiv = document.createElement('div');
    layoutDiv.className = 'form-group';
    layoutDiv.innerHTML = `<label>レイアウト</label>`;
    const select = document.createElement('select');
    select.className = 'form-control';
    select.innerHTML = `
      <option value="">左右分割 (旧式)</option>
      <option value="article">記事型 (1カラム)</option>
    `;
    select.value = problem.layout || "";
    select.onchange = (e) => problem.layout = e.target.value;
    layoutDiv.appendChild(select);
    basicSec.appendChild(layoutDiv);

    container.appendChild(basicSec);

    // B. 解説エディタ
    const explSec = document.createElement('div');
    explSec.className = 'form-section';
    
    const headerDiv = document.createElement('div');
    headerDiv.style.display = 'flex'; headerDiv.style.justifyContent = 'space-between'; headerDiv.style.marginBottom = '10px';
    headerDiv.innerHTML = `<h3 style="margin:0; border:none;">📖 解説文エディタ</h3>`;
    
    const saveExplBtn = document.createElement('button');
    saveExplBtn.className = 'btn-save';
    saveExplBtn.style.padding = '5px 15px';
    saveExplBtn.style.fontSize = '0.9rem';
    saveExplBtn.innerHTML = '💾 解説を保存';
    headerDiv.appendChild(saveExplBtn);
    explSec.appendChild(headerDiv);

    // ファイルロード
    let initialExpl = "<p>読み込み中...</p>";
    if (problem.explanationPath && explanationsDirHandle) {
      try {
        const relativePath = problem.explanationPath.replace("data/explanations/", "");
        const pathParts = relativePath.split('/');
        let targetHandle = explanationsDirHandle;
        for(let i=0; i<pathParts.length-1; i++) {
           targetHandle = await targetHandle.getDirectoryHandle(pathParts[i]);
        }
        const fileHandle = await targetHandle.getFileHandle(pathParts[pathParts.length-1]);
        const file = await fileHandle.getFile();
        initialExpl = await file.text();
      } catch (e) {
        initialExpl = `<p>新規作成、または読み込み失敗</p>`;
      }
    }

    // ツールバー
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    const exec = (cmd, val = null) => { document.execCommand(cmd, false, val); editorDiv.focus(); };

    const tools = [
      { label: '↩', cmd: 'undo' },
      { label: '↪', cmd: 'redo' },
      { sep: true },
      { label: '<b>B</b>', cmd: 'bold' },
      { label: '<u>U</u>', cmd: 'underline' },
      { label: '<i>I</i>', cmd: 'italic' },
      { sep: true },
      { label: 'H3', cmd: 'formatBlock', val: '<h3>' },
      { label: 'P', cmd: 'formatBlock', val: '<p>' },
      { sep: true },
      { label: 'Point枠', custom: 'insertPointBox' },
    ];

    tools.forEach(t => {
      if (t.sep) {
        const sep = document.createElement('div'); sep.className = 'tb-sep';
        toolbar.appendChild(sep); return;
      }
      const btn = document.createElement('button');
      btn.className = 'tb-btn';
      btn.innerHTML = t.label;
      if (t.custom === 'insertPointBox') {
        btn.innerHTML = '✨Point';
        btn.onclick = () => {
          const html = `<div class="box-alert"><span class="box-alert-label">Point</span><p>ここに着眼点を入力</p></div><p></p>`;
          document.execCommand('insertHTML', false, html);
        };
      } else {
        btn.onclick = () => exec(t.cmd, t.val);
      }
      toolbar.appendChild(btn);
    });

    const editorWrap = document.createElement('div');
    editorWrap.className = 'editor-wrapper';

    const editorDiv = document.createElement('div');
    editorDiv.className = 'visual-editor';
    editorDiv.contentEditable = true;
    editorDiv.innerHTML = initialExpl;

    editorWrap.appendChild(toolbar);
    editorWrap.appendChild(editorDiv);
    explSec.appendChild(editorWrap);
    container.appendChild(explSec);

    saveExplBtn.onclick = async () => {
      const content = editorDiv.innerHTML;
      try {
        const subHandle = await explanationsDirHandle.getDirectoryHandle(currentProblemContext.subjectDir, { create: true });
        const fieldHandle = await subHandle.getDirectoryHandle(currentProblemContext.fieldDir, { create: true });
        const fileName = `${problem.id}.html`;
        
        const fileHandle = await fieldHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        
        showToast('解説を保存しました！');
      } catch (e) { showToast("保存エラー: " + e, true); }
    };
    
    // C. JSコード編集 (JSパスがある場合のみ表示)
    if (problem.jsPath) {
      const simSec = document.createElement('div');
      simSec.className = 'form-section';
      simSec.innerHTML = `<h3>⚙️ JSコード（旧式）</h3>`;
      const btnEditJs = document.createElement('button');
      btnEditJs.className = 'btn-code-edit';
      btnEditJs.textContent = 'JSファイルを編集';
      btnEditJs.onclick = () => window.openJsEditor(problem.jsPath);
      simSec.appendChild(btnEditJs);
      container.appendChild(simSec);
    } else {
      const simSec = document.createElement('div');
      simSec.className = 'form-section';
      simSec.style.opacity = '0.7';
      simSec.innerHTML = `<h3>⚙️ シミュレーション</h3><p style="font-size:0.9rem; color:#666;">※ 記事型レイアウトのため、JSは解説HTML内に直接記述されています。編集は上の「解説文エディタ」で行ってください。</p>`;
      container.appendChild(simSec);
    }
  }

  // --- ヘルパー関数 ---
  function createInput(label, val, onChange) {
    const g = document.createElement('div'); g.className='form-group';
    g.innerHTML = `<label>${label}</label>`;
    const i = document.createElement('input'); i.className='form-control'; i.value=val||'';
    i.oninput = (e) => onChange(e.target.value);
    g.appendChild(i);
    return g;
  }
  
  function createDetails(label, title, path, index, parentArray) {
    const det = document.createElement('details');
    det.dataset.path = path;
    const sum = document.createElement('summary');
    sum.textContent = `[${label}] ${title}`;
    sum.addEventListener('click', () => {
      setTimeout(() => { if(det.open) openPaths.add(path); else openPaths.delete(path); }, 50);
    });
    det.appendChild(sum);
    return det;
  }
  
  function saveOpenStates() {
    openPaths.clear();
    document.querySelectorAll('details[open]').forEach(el => { if (el.dataset.path) openPaths.add(el.dataset.path); });
  }
  function restoreOpenStates() {
    document.querySelectorAll('details').forEach(el => { if (el.dataset.path && openPaths.has(el.dataset.path)) el.open = true; });
  }
  
  function showToast(msg, err=false) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div'); t.className='toast';
    if(err) t.style.background='#ef4444';
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(()=>t.remove(), 3000);
  }

  // JSモーダル系
  window.openJsEditor = async (jsPath) => {
    if(!rootDirHandle) return;
    try {
      const parts = jsPath.split('/'); 
      let dir = jsProblemsDirHandle;
      dir = await dir.getDirectoryHandle(parts[2]);
      dir = await dir.getDirectoryHandle(parts[3]);
      currentJsHandle = await dir.getFileHandle(parts[4]);
      
      const f = await currentJsHandle.getFile();
      codeEditor.value = await f.text();
      modal.style.display = 'flex';
    } catch(e) { alert("JSファイルが開けません: " + e); }
  };
  btnCloseModal.onclick = () => modal.style.display='none';
  btnSaveCode.onclick = async () => {
    if(!currentJsHandle) return;
    const w = await currentJsHandle.createWritable();
    await w.write(codeEditor.value);
    await w.close();
    showToast("JS保存完了");
    modal.style.display='none';
  };
});