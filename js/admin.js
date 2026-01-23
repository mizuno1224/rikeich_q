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

      if (!meta.id || !meta.jsPath || !meta.explanationPath) {
        throw new Error("JSONに必要なキー(id, jsPath, explanationPath)がありません");
      }

      // パス解析 (js/problems/科目/分野/ID.js)
      const pathParts = meta.jsPath.split('/');
      if (pathParts.length < 5) throw new Error("jsPathの形式が不正です");
      
      const subjectDir = pathParts[2];
      const fieldDir = pathParts[3];
      const fileNameJS = pathParts[4];
      const fileNameHTML = meta.explanationPath.split('/').pop();

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

      // 2. JS
      if (jsContent) {
        let dir = jsProblemsDirHandle;
        dir = await dir.getDirectoryHandle(subjectDir, { create: true });
        dir = await dir.getDirectoryHandle(fieldDir, { create: true });
        const file = await dir.getFileHandle(fileNameJS, { create: true });
        const writable = await file.createWritable();
        await writable.write(jsContent);
        await writable.close();
      }

      // 3. データ登録
      // 選択された教材データを使用
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
      const newProb = {
        id: meta.id,
        title: meta.title,
        desc: meta.desc,
        jsPath: meta.jsPath,
        explanationPath: meta.explanationPath
      };

      if (existingIdx >= 0) {
        fieldObj.problems[existingIdx] = newProb;
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
    // 追加ボタン略
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
          // 削除ボタン等は略
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

  // --- エディタ機能 (Wordライク & MathJaxプレビュー) ---
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
    container.appendChild(basicSec);

    // B. 解説エディタ (WYSIWYG強化版)
    const explSec = document.createElement('div');
    explSec.className = 'form-section';
    
    // ヘッダー + 保存ボタン
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

    // --- 拡張ツールバー ---
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';

    // コマンド実行ヘルパー
    const exec = (cmd, val = null) => {
      document.execCommand(cmd, false, val);
      editorDiv.focus();
    };

    // ボタン定義
    const tools = [
      { label: '↩', cmd: 'undo', title: '元に戻す' },
      { label: '↪', cmd: 'redo', title: 'やり直す' },
      { sep: true },
      { label: '<b>B</b>', cmd: 'bold', title: '太字' },
      { label: '<u>U</u>', cmd: 'underline', title: '下線' },
      { label: '<i>I</i>', cmd: 'italic', title: '斜体' },
      { sep: true },
      { label: '文字色', cmd: 'foreColor', val: '#f43f5e', type: 'color' }, // 赤
      { label: '蛍光ペン', cmd: 'hiliteColor', val: '#fef08a', type: 'color' }, // 黄色
      { sep: true },
      { label: '左寄', cmd: 'justifyLeft' },
      { label: '中央', cmd: 'justifyCenter' },
      { label: '右寄', cmd: 'justifyRight' },
      { sep: true },
      { label: 'H3', cmd: 'formatBlock', val: '<h3>' },
      { label: 'P', cmd: 'formatBlock', val: '<p>' },
      { sep: true },
      { label: 'Point枠', custom: 'insertPointBox' },
    ];

    tools.forEach(t => {
      if (t.sep) {
        const sep = document.createElement('div'); sep.className = 'tb-sep';
        toolbar.appendChild(sep);
        return;
      }
      
      const btn = document.createElement('button');
      btn.className = 'tb-btn';
      btn.innerHTML = t.label;
      if(t.title) btn.title = t.title;
      
      if (t.type === 'color') {
        // カラーピッカー実装は簡易的に固定色クリック
        btn.onclick = () => exec(t.cmd, t.val);
        // ※必要なら <input type="color"> を埋め込むことも可能
      } else if (t.custom === 'insertPointBox') {
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

    // プレビュー切り替えボタン
    const togglePreviewBtn = document.createElement('button');
    togglePreviewBtn.className = 'tb-btn';
    togglePreviewBtn.style.marginLeft = 'auto';
    togglePreviewBtn.style.background = '#e0f2fe';
    togglePreviewBtn.style.color = '#0369a1';
    togglePreviewBtn.innerHTML = '👁️ プレビュー';
    
    let isPreview = false;
    togglePreviewBtn.onclick = () => {
      isPreview = !isPreview;
      if (isPreview) {
        // プレビューモードへ: MathJaxレンダリング
        const content = editorDiv.innerHTML;
        previewDiv.innerHTML = content;
        editorDiv.style.display = 'none';
        previewDiv.style.display = 'block';
        togglePreviewBtn.innerHTML = '✏️ 編集に戻る';
        togglePreviewBtn.style.background = '#fef3c7';
        
        // MathJax適用
        if(window.MathJax) {
           MathJax.typesetPromise([previewDiv]).catch(err => console.error(err));
        }
      } else {
        // 編集モードへ
        editorDiv.style.display = 'block';
        previewDiv.style.display = 'none';
        togglePreviewBtn.innerHTML = '👁️ プレビュー';
        togglePreviewBtn.style.background = '#e0f2fe';
      }
    };
    toolbar.appendChild(togglePreviewBtn);
    
    // エディタ領域
    const editorWrap = document.createElement('div');
    editorWrap.className = 'editor-wrapper';

    // 編集用DIV (contentEditable)
    const editorDiv = document.createElement('div');
    editorDiv.className = 'visual-editor';
    editorDiv.contentEditable = true;
    editorDiv.innerHTML = initialExpl; // 初期ロード

    // プレビュー用DIV
    const previewDiv = document.createElement('div');
    previewDiv.className = 'visual-editor preview-mode';
    previewDiv.style.display = 'none';

    editorWrap.appendChild(toolbar);
    editorWrap.appendChild(editorDiv);
    editorWrap.appendChild(previewDiv);
    explSec.appendChild(editorWrap);
    container.appendChild(explSec);

    // 解説保存処理
    saveExplBtn.onclick = async () => {
      // プレビュー中ならプレビューの中身ではなく、エディタ(ソース)の中身を保存したい
      // ただしMathJax変換後のDOMはぐちゃぐちゃなので、必ずeditorDivから取る
      // もしプレビュー中なら一旦戻してもいいが、editorDivは裏で保持されているのでそのまま取得
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
      } catch (e) {
        showToast("保存エラー: " + e, true);
      }
    };
    
    // JS編集ボタン（既存）もここに追加
    const simSec = document.createElement('div');
    simSec.className = 'form-section';
    simSec.innerHTML = `<h3>⚙️ JSコード</h3>`;
    const btnEditJs = document.createElement('button');
    btnEditJs.className = 'btn-code-edit';
    btnEditJs.textContent = 'JSファイルを編集';
    btnEditJs.onclick = () => window.openJsEditor(problem.jsPath);
    simSec.appendChild(btnEditJs);
    container.appendChild(simSec);
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

  // JSモーダル系 (既存のまま利用)
  window.openJsEditor = async (jsPath) => {
    if(!rootDirHandle) return;
    try {
      // 簡易パス解析
      const parts = jsPath.split('/'); 
      // js/problems/sub/field/file.js -> parts[4] is file
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