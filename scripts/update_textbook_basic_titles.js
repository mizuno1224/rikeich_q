#!/usr/bin/env node
/**
 * スプレッドシートから物理基礎教科書問題のJSONを更新するスクリプト
 * タイトルをスプレッドシートに合わせて修正（explanationPathがある問題は除外）
 * I列（章番号）とL列（問題番号）を読み取り、R列（YouTube URL）を追加
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = __dirname + '/..';
const JSON_FILE = path.join(PROJECT_ROOT, 'data', 'materials', 'textbook_basic.json');

function parseProblemNumber(problemStr) {
    if (!problemStr || problemStr.trim() === '') {
        return { type: null, number: null };
    }
    
    problemStr = problemStr.trim();
    
    // 演習問題
    let match = problemStr.match(/^演習問題(\d+)/);
    if (match) {
        return { type: '演習問題', number: parseInt(match[1]) };
    }
    
    // 例題
    match = problemStr.match(/^例題(\d+)/);
    if (match) {
        return { type: '例題', number: parseInt(match[1]) };
    }
    
    // 類題
    match = problemStr.match(/^類題(\d+)/);
    if (match) {
        return { type: '類題', number: parseInt(match[1]) };
    }
    
    // 問（数字付き）
    match = problemStr.match(/^問(\d+)/);
    if (match) {
        return { type: '問', number: parseInt(match[1]) };
    }
    
    // 問（abcなど）
    match = problemStr.match(/^問([a-z]+)/);
    if (match) {
        return { type: '問', number: match[1] };
    }
    
    // 問（A, Bなど大文字）
    match = problemStr.match(/^問([A-Z])/);
    if (match) {
        return { type: '問', number: match[1] };
    }
    
    // 問（a~c, a~eなど）
    match = problemStr.match(/^問([a-z])~([a-z])/);
    if (match) {
        return { type: '問範囲', start: match[1], end: match[2] };
    }
    
    // 思考学習
    if (problemStr.includes('思考学習')) {
        return { type: '思考学習', number: null };
    }
    
    return { type: null, number: null };
}

function normalizeTitle(title) {
    if (!title) return null;
    const match = title.match(/^([^：]+)/);
    if (match) {
        return match[1].trim();
    }
    return title.trim();
}

function findMatchingProblem(problems, chapterNum, problemNumberStr) {
    const parsed = parseProblemNumber(problemNumberStr);
    
    if (parsed.type === null) {
        return null;
    }
    
    for (const problem of problems) {
        const title = problem.title || '';
        const normalizedTitle = normalizeTitle(title);
        
        if (parsed.type === '演習問題') {
            if (normalizedTitle.includes(`演習問題${parsed.number}`)) {
                return problem;
            }
        } else if (parsed.type === '例題') {
            if (normalizedTitle.includes(`例題${parsed.number}`)) {
                return problem;
            }
        } else if (parsed.type === '類題') {
            if (normalizedTitle.includes(`類題${parsed.number}`)) {
                return problem;
            }
        } else if (parsed.type === '問') {
            if (typeof parsed.number === 'number') {
                const regex = new RegExp(`問${parsed.number}(：|$|[^0-9])`);
                if (regex.test(normalizedTitle)) {
                    return problem;
                }
            } else if (typeof parsed.number === 'string') {
                const regex = new RegExp(`問${parsed.number}(：|$|[^a-zA-Z])`, 'i');
                if (regex.test(normalizedTitle)) {
                    return problem;
                }
            }
        } else if (parsed.type === '問範囲') {
            const startChar = parsed.start.charCodeAt(0);
            const endChar = parsed.end.charCodeAt(0);
            for (let i = startChar; i <= endChar; i++) {
                const char = String.fromCharCode(i);
                const regex = new RegExp(`問${char}(：|$|[^a-zA-Z])`, 'i');
                if (regex.test(normalizedTitle)) {
                    return problem;
                }
            }
        } else if (parsed.type === '思考学習') {
            if (normalizedTitle.includes('思考学習')) {
                return problem;
            }
        }
    }
    
    return null;
}

function updateJsonFromSpreadsheetData(jsonData, spreadsheetData) {
    let updatedCount = 0;
    let titleUpdatedCount = 0;
    let youtubeAddedCount = 0;
    const skippedCount = { explanationPathExists: 0, noMatch: 0 };
    
    for (const subject of jsonData.subjects || []) {
        for (const field of subject.fields || []) {
            const folderId = field.folderId || '';
            const problems = field.problems || [];
            
            // folderIdから章番号を抽出（例: "01/01" -> 1, "01/02" -> 2）
            const parts = folderId.split('/');
            if (parts.length < 2) continue;
            
            const chapterNum = parseInt(parts[1]);
            if (isNaN(chapterNum)) continue;
            
            // この章に該当するスプレッドシートのデータをフィルタ
            const chapterData = spreadsheetData.filter(([ch]) => ch === chapterNum);
            
            for (const [chapterNumSp, problemNumber, title, youtubeUrl] of chapterData) {
                const problem = findMatchingProblem(problems, chapterNumSp, problemNumber);
                
                if (problem) {
                    // すでにexplanationPathが存在する場合はタイトルを変更しない
                    const hasExplanationPath = problem.explanationPath && problem.explanationPath.trim() !== '';
                    
                    if (hasExplanationPath) {
                        skippedCount.explanationPathExists++;
                        // explanationPathがある場合でも、YouTube URLは追加/更新する
                        if (youtubeUrl && youtubeUrl.trim() !== '') {
                            problem.youtubeUrl = youtubeUrl.trim();
                            youtubeAddedCount++;
                            updatedCount++;
                            console.log(`更新（explanationPathあり）: ${field.fieldName || ''} - ${problem.title || ''} - YouTube URL追加`);
                        }
                    } else {
                        // explanationPathがない場合は、タイトルとYouTube URLを更新
                        let changed = false;
                        
                        // タイトルに問題番号を含める
                        let newTitle = '';
                        const currentTitle = problem.title || '';
                        const normalizedCurrentTitle = normalizeTitle(currentTitle);
                        
                        // 現在のタイトルに問題番号が含まれているか確認
                        const hasProblemNumber = normalizedCurrentTitle.startsWith(problemNumber);
                        
                        if (title && title.trim() !== '') {
                            if (hasProblemNumber) {
                                // 既に問題番号が含まれている場合は、タイトル部分のみ更新
                                newTitle = `${problemNumber}：${title.trim()}`;
                            } else {
                                // 問題番号が含まれていない場合は追加
                                newTitle = `${problemNumber}：${title.trim()}`;
                            }
                        } else {
                            // タイトルが空の場合は、問題番号のみを設定
                            newTitle = problemNumber;
                        }
                        
                        // タイトルが異なる場合は更新
                        if (problem.title !== newTitle) {
                            problem.title = newTitle;
                            titleUpdatedCount++;
                            changed = true;
                        }
                        
                        // YouTube URLを更新
                        if (youtubeUrl && youtubeUrl.trim() !== '') {
                            const currentUrl = problem.youtubeUrl || '';
                            if (currentUrl !== youtubeUrl.trim()) {
                                problem.youtubeUrl = youtubeUrl.trim();
                                youtubeAddedCount++;
                                changed = true;
                            }
                        }
                        
                        if (changed) {
                            updatedCount++;
                            console.log(`更新: ${field.fieldName || ''} - ${problem.title || ''} - タイトル/YouTube URL更新`);
                        }
                    }
                } else {
                    skippedCount.noMatch++;
                }
            }
        }
    }
    
    return { updatedCount, titleUpdatedCount, youtubeAddedCount, skippedCount };
}

function main() {
    // スプレッドシートのデータ（物理基礎シートから取得したデータ）
    // 形式: [章番号, 問題番号, タイトル, YouTube URL]
    const spreadsheetData = [
        // 第1章（章番号1）
        [1, '問1', '', ''],
        [1, '問2', '速さの単位の変換', 'https://youtu.be/iMJOjnoiTlo'],
        [1, '問3', '', ''],
        [1, '問4', '等速直線運動のグラフ', 'https://youtu.be/pYaSeKV0w0c'],
        [1, '問5', '速度', 'https://youtu.be/zZehezR61E4'],
        [1, '問6', '変位', 'https://youtu.be/Og19yv54LRk'],
        [1, '問7', '平均の速度', 'https://youtu.be/DaUae4ZC1VE'],
        [1, '問8', '瞬間の速度', 'https://youtu.be/u3dui9PU33I'],
        [1, '問9', '瞬間の速度', 'https://youtu.be/rqHlSO6vImQ'],
        [1, '問10', '速度の合成', 'https://youtu.be/6v304lr4bjA'],
        [1, '問11', '', ''],
        [1, '問12', '', ''],
        [1, '問a~c', '', ''],
        [1, '問13', '相対速度', 'https://youtu.be/0yOuGNI8mGw'],
        [1, '問a~e', '', ''],
        [1, '例題1', '', ''],
        [1, '類題1', '', ''],
        [1, '問14', '', ''],
        [1, '問15', '直線運動の加速度', 'https://youtu.be/D5Q_gtuI99o'],
        [1, '問16', '平均の加速度', 'https://youtu.be/TVEdTTR9bB8'],
        [1, '問a', '加速度', 'https://youtu.be/eDs4wMAr66E'],
        [1, '問17', '等加速度直線運動', 'https://youtu.be/5T_8aLkdePo'],
        [1, '問18', '等加速度直線運動', 'https://youtu.be/Kh8HOnM1vRE'],
        [1, '例題2', '等加速度直線運動の式', 'https://youtu.be/fVGSxyCvqfk'],
        [1, '類題2', '等加速度直線運動の式', 'https://youtu.be/mD80xtCh9L4'],
        [1, '例題3', '等加速度直線運動のグラフ', 'https://youtu.be/Z2atHIiWVGw'],
        [1, '類題3', '等加速度直線運動のグラフ', 'https://youtu.be/EVLCktOrcGI'],
        [1, '思考学習', '電車の走行距離の推定', 'https://youtu.be/NT-QEuas7UE'],
        [1, '問a~e', '等加速度直線運動の式', 'https://youtu.be/wfJJqYPnITk'],
        [1, '問19', '自由落下', 'https://youtu.be/1Hze4nZ1M-U'],
        [1, '問20', '鉛直投射', 'https://youtu.be/yloQQkPSZlw'],
        [1, '問21', '鉛直投射', 'https://youtu.be/fwSEzEZgmdY'],
        [1, '問22', '鉛直投射', 'https://youtu.be/kU3lpK-c-HI'],
        [1, '問23', '鉛直投射', 'https://youtu.be/ZFXbGc8YkQM'],
        [1, '例題4', '鉛直投射', 'https://youtu.be/zDUf7brTt_k'],
        [1, '類題4', '鉛直投射', 'https://youtu.be/mopVihTqa2g'],
        [1, '問a~g', '自由落下と鉛直投射', 'https://youtu.be/duS1K65qaE8'],
        [1, '問24', '', ''],
        [1, '類題5', '', ''],
        [1, '類題6', '', ''],
        [1, '演習問題1', '平均の速さ', 'https://youtu.be/kI2PnftMOGU'],
        [1, '演習問題2', '等速直線運動', 'https://youtu.be/MxnOTJnBKpw'],
        [1, '演習問題3', '相対速度', 'https://youtu.be/KwU_mwxvKxs'],
        [1, '演習問題4', '加速度', 'https://youtu.be/2kDyfjZREPU'],
        [1, '演習問題5', '等加速度直線運動', 'https://youtu.be/W7EHYLBKDYs'],
        [1, '演習問題6', '等加速度直線運動', 'https://youtu.be/Ba7B0Vlrkbw'],
        [1, '演習問題7', '鉛直投射', 'https://youtu.be/LUX3qxhPPV8'],
        [1, '演習問題8', '自由落下・鉛直投射', 'https://youtu.be/N-lm5HsSEBc'],
        [1, '演習問題9', '', ''],
        // 第2章（章番号2）
        [2, '問25', '', ''],
        [2, '問26', '', ''],
        [2, '問27', '', ''],
        [2, '問28', '', ''],
        [2, '問29', '', ''],
        [2, '問30', '力の成分', 'https://youtu.be/293TDjGbshI'],
        [2, '問31', '力の成分', 'https://youtu.be/dp8uzw1BAoA'],
        [2, '問A', '三角比', 'https://youtu.be/yhbhrEM8fjQ'],
        [2, '問B', '力の分解', 'https://youtu.be/yRXQ-KKXRo8'],
        [2, '例題7', '力のつりあい①', 'https://youtu.be/P8uuKE9zTj8'],
        [2, '類題7', '力のつりあい①', 'https://youtu.be/-n-SCGvQXWc'],
        [2, '例題8', '力のつりあい②', 'https://youtu.be/ZJI8tX6i-pI'],
        [2, '類題8', '力のつりあい②', ''],
        [2, '問a', '定滑車と動滑車', 'https://youtu.be/NS93sUseOA4'],
        [2, '問32', '', ''],
        [2, '問33', '', ''],
        [2, '問A', '受ける力と及ぼす力', 'https://youtu.be/7BlPxFfwyoU'],
        [2, '問a', '物体が受ける力', 'https://youtu.be/e3IjP-96UB8'],
        [2, '問34', '慣性の法則', 'https://youtu.be/RIGc4dg7C7c'],
        [2, '問35', '運動方程式', 'https://youtu.be/0EpknRan9mc'],
        [2, '問36', '運動方程式', 'https://youtu.be/uEq5ujG8Ipo'],
        [2, '問37', '月面上での物体の重さ', 'https://youtu.be/eZId339sdMs'],
        [2, '問38', '無重力空間での物体の質量', 'https://youtu.be/5XzmjkVdSUg'],
        [2, '例題9', '1物体の運動方程式', 'https://youtu.be/bYcpi6_rwWk'],
        [2, '類題9', '1物体の運動方程式', 'https://youtu.be/rc6hWNoP2lI'],
        [2, '例題10', '1物体の運動方程式', 'https://youtu.be/tIHxjFi7I0A'],
        [2, '類題10', '1物体の運動方程式', 'https://youtu.be/erWhDVdui7A'],
        [2, '例題11', '1物体の運動方程式', 'https://youtu.be/0mRw8kIZp5w'],
        [2, '類題11', '1物体の運動方程式', 'https://youtu.be/L822V__U1qA'],
        [2, '例題12', '2物体の運動方程式', 'https://youtu.be/cup0QpVMQsk'],
        [2, '類題12', '2物体の運動方程式', 'https://youtu.be/qR3zINjW25A'],
        [2, '例題13', '2物体の運動方程式', 'https://youtu.be/r1qqjANRwPY'],
        [2, '類題13', '2物体の運動方程式', 'https://youtu.be/rsThYJtpR7w'],
        [2, '例題14', '2物体の運動方程式', 'https://youtu.be/aDAULxtMe6o'],
        [2, '類題14', '2物体の運動方程式', 'https://youtu.be/_lyT05BRRw8'],
        [2, '問39', '静止摩擦力', 'https://youtu.be/bthTJwX3wuc'],
        [2, '問40', '静止摩擦力', 'https://youtu.be/EYkDl1UnE0A'],
        [2, '問41', '動摩擦力', 'https://youtu.be/Z9jhJxrtW20'],
        [2, '例題15', '動摩擦力', 'https://youtu.be/OmFawTK7j0Q'],
        [2, '類題15', '動摩擦力', 'https://youtu.be/brWKPelKyGM'],
        [2, '思考学習', '記録タイマーで生じる抵抗力', ''],
        [2, '問42', '', ''],
        [2, '問43', '水圧', 'https://youtu.be/JVZDWA3Dp1Y'],
        [2, '問44', '水圧', 'https://youtu.be/HqVXQyd5GcY'],
        [2, '問45', '', ''],
        [2, '問46', '浮力', 'https://youtu.be/KmTU8BdSLHw'],
        [2, '例題16', '浮力', 'https://youtu.be/sS-xU8KJ_ts'],
        [2, '類題16', '浮力', 'https://youtu.be/8coFD9Cyer4'],
        [2, '演習問題1', '', ''],
        [2, '演習問題2', '運動の法則', 'https://youtu.be/GN5r3pGQ3P4'],
    ];
    
    // JSONファイルを読み込み
    const jsonContent = fs.readFileSync(JSON_FILE, 'utf-8');
    const jsonData = JSON.parse(jsonContent);
    
    // JSONを更新
    const { updatedCount, titleUpdatedCount, youtubeAddedCount, skippedCount } = updateJsonFromSpreadsheetData(jsonData, spreadsheetData);
    
    // JSONファイルを保存
    fs.writeFileSync(JSON_FILE, JSON.stringify(jsonData, null, 2), 'utf-8');
    
    console.log(`\n更新完了:`);
    console.log(`  更新された問題数: ${updatedCount}`);
    console.log(`  タイトル更新数: ${titleUpdatedCount}`);
    console.log(`  YouTube URL追加/更新数: ${youtubeAddedCount}`);
    console.log(`  スキップ（explanationPath存在）: ${skippedCount.explanationPathExists}`);
    console.log(`  スキップ（マッチなし）: ${skippedCount.noMatch}`);
}

main();
