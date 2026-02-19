#!/usr/bin/env node
/**
 * スプレッドシートから物理基礎教科書問題のJSONを更新するスクリプト
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
    const { type, number } = parseProblemNumber(problemNumberStr);
    
    if (type === null) {
        return null;
    }
    
    for (const problem of problems) {
        const title = problem.title || '';
        const normalizedTitle = normalizeTitle(title);
        
        if (type === '演習問題') {
            if (normalizedTitle === `演習問題${number}` || normalizedTitle.startsWith(`演習問題${number}：`)) {
                return problem;
            }
        } else if (type === '例題') {
            if (normalizedTitle === `例題${number}` || normalizedTitle.startsWith(`例題${number}：`)) {
                return problem;
            }
        } else if (type === '類題') {
            if (normalizedTitle === `類題${number}` || normalizedTitle.startsWith(`類題${number}：`)) {
                return problem;
            }
        } else if (type === '問') {
            if (typeof number === 'number') {
                // 数字の場合は完全一致または「：」で始まる場合のみ
                if (normalizedTitle === `問${number}` || normalizedTitle.startsWith(`問${number}：`)) {
                    return problem;
                }
            } else {
                // abcなどの場合は完全一致を優先
                if (normalizedTitle === `問${number}` || normalizedTitle.startsWith(`問${number}：`)) {
                    return problem;
                }
            }
        } else if (type === '思考学習') {
            if (normalizedTitle.includes('思考学習')) {
                return problem;
            }
        }
    }
    
    return null;
}

function updateJsonFromSpreadsheetData(jsonData, spreadsheetData) {
    let updatedCount = 0;
    let youtubeAddedCount = 0;
    
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
            
            for (const [chapterNumSp, problemNumber, youtubeUrl] of chapterData) {
                const problem = findMatchingProblem(problems, chapterNumSp, problemNumber);
                
                if (problem) {
                    // すでにexplanationPathが存在する場合はスキップ
                    if (problem.explanationPath && problem.explanationPath.trim() !== '') {
                        continue;
                    }
                    
                    // YouTube URLがある場合は追加
                    if (youtubeUrl && youtubeUrl.trim() !== '') {
                        problem.youtubeUrl = youtubeUrl.trim();
                        youtubeAddedCount++;
                        updatedCount++;
                        console.log(`更新: ${field.fieldName || ''} - ${problem.title || ''} - YouTube URL追加`);
                    }
                }
            }
        }
    }
    
    return { updatedCount, youtubeAddedCount };
}

function main() {
    // スプレッドシートのデータ（外部リンクから取得したデータをパース）
    // 形式: [章番号, 問題番号, YouTube URL]
    // 注意: これは「物理」シートのデータです。「物理基礎」シートのデータを取得する必要があります
    const spreadsheetData = [
        // 第1章（章番号1）
        [1, '問1', 'https://youtu.be/sC5li_LEcxM'],
        [1, '問2', 'https://youtu.be/I9JNMF_YuXo'],
        [1, '例題1', 'https://youtu.be/2OtwN26MA2M'],
        [1, '類題1', 'https://youtu.be/nP0Gd-FDrNE'],
        [1, '問abc', 'https://youtu.be/k1TNTW4EkPo'],
        [1, '問a', 'https://youtu.be/coGvlyA9E98'],
        [1, '問3', 'https://youtu.be/BIE_4psLN-8'],
        [1, '例題2', 'https://youtu.be/RB9LdYZ1Eys'],
        [1, '類題2', 'https://youtu.be/z3LUnGS8CPg'],
        [1, '例題3', 'https://youtu.be/UEO2SDUOQEU'],
        [1, '類題3', 'https://youtu.be/R5raAFoJX6c'],
        [1, '問a', 'https://youtu.be/coGvlyA9E98'],
        [1, '問b', 'https://youtu.be/CxOtCGL_1NM'],
        [1, '問c', 'https://youtu.be/pZeQFyAcJ8M'],
        [1, '演習問題1', 'https://youtu.be/EK9tWnXNW2w'],
        [1, '演習問題2', 'https://youtu.be/m3dT3KMbm30'],
        [1, '演習問題3', 'https://youtu.be/vCgarDovoN8'],
        [1, '演習問題4', 'https://youtu.be/GPxG-uqTdN4'],
        [1, '演習問題5', 'https://youtu.be/pEDfjbJKnCQ'],
        // 第2章（章番号2）
        [2, '問4', 'https://youtu.be/S6oPL7MYe4I'],
        [2, '問5', 'https://youtu.be/P0XNwjErJnY'],
        [2, '例題4', 'https://youtu.be/1g7kBf3GR_w'],
        [2, '類題4', 'https://youtu.be/fRYknHrrHp8'],
        [2, '問6', 'https://youtu.be/ZcF22W83Kbw'],
        [2, '問7', 'https://youtu.be/bbnLoZYwDjc'],
        [2, '問8', 'https://youtu.be/C8bEzjJQz6Q'],
        [2, '問9', 'https://youtu.be/Y_3Y3qlAqjY'],
        [2, '問10', 'https://youtu.be/Cs3KXR3lbZc'],
        [2, '問11', 'https://youtu.be/SrIBSW0M1cw'],
        [2, '例題5', 'https://youtu.be/HJgZXbZ0GJw'],
        [2, '類題5', 'https://youtu.be/NaHwNxef7j4'],
        [2, '思考学習', 'https://youtu.be/cfrXjJA2waI'],
        [2, '演習問題1', 'https://youtu.be/rd6lrQ4ToY8'],
        [2, '演習問題2', 'https://youtu.be/o0Qz9Lv-GN4'],
        [2, '演習問題3', 'https://youtu.be/k78UcD-Oe4I'],
        [2, '演習問題4', 'https://youtu.be/6i41BckCIZM'],
        // 第3章（章番号3）
        [3, '問13', 'https://youtu.be/0jd4rfHUlno'],
        [3, '問14', 'https://youtu.be/JaImpWW_S9A'],
        [3, '例題6', 'https://youtu.be/B5qHXDqly_A'],
        [3, '類題6', 'https://youtu.be/7Lgb3lN4-PQ'],
        [3, '例題7', 'https://youtu.be/HL5v4ti7HTA'],
        [3, '類題7', 'https://youtu.be/sEOS78A72r0'],
        [3, '例題8', 'https://youtu.be/heVDy2xSZPA'],
        [3, '類題8', 'https://youtu.be/WHhDQTqk1uA'],
        [3, '例題9', 'https://youtu.be/qPbDHGxX7eg'],
        [3, '類題9', 'https://youtu.be/YOmYBUBSd6k'],
        [3, '問16', 'https://youtu.be/-hrJtcsf_NE'],
        [3, '問17', 'https://youtu.be/y80Oru5DH9Y'],
        [3, '例題10', 'https://youtu.be/0zV0RaXWaGE'],
        [3, '類題10', 'https://youtu.be/vlnuw9pDqxk'],
        [3, '例題11', 'https://youtu.be/A6bdSvoAxyE'],
        [3, '類題11', 'https://youtu.be/mGIpKSJ_PMI'],
        [3, '問18', 'https://youtu.be/1PWUjjg-JHI'],
        [3, '演習問題1', 'https://youtu.be/_gOZdFZpCG8'],
        [3, '演習問題2', 'https://youtu.be/3u_0Vpa36F4'],
        [3, '演習問題3', 'https://youtu.be/nxV3hntL-Ic'],
        [3, '演習問題4', 'https://youtu.be/c0c7Sq_ibUo'],
        [3, '演習問題5', 'https://youtu.be/Ji6mGBbynpI'],
        [3, '演習問題6', 'https://youtu.be/rrVTCh-vVRs'],
        [3, '演習問題7', 'https://youtu.be/p1faQ94uHmA'],
        // 第4章（章番号4）- 物理基礎には第4章がないので、このデータは使用されません
        [4, '問22', 'https://youtu.be/4DQlE2YIgi0'],
        [4, '例題12', 'https://youtu.be/YmZYYgo4Toc'],
        [4, '類題12', 'https://youtu.be/eBjfVD7UOnc'],
        [4, '例題13', 'https://youtu.be/QQEhEBNMFhM'],
        [4, '類題13', 'https://youtu.be/-fXY7F9FhRM'],
        [4, '例題14', 'https://youtu.be/e9e8l2GIcxo'],
        [4, '類題14', 'https://youtu.be/jj-mhM8D8h0'],
        [4, '例題15', 'https://youtu.be/gR2mTRvYbuM'],
        [4, '類題15', 'https://youtu.be/u0M0g-yMwPE'],
        [4, '例題16', 'https://youtu.be/A1ENGNfqJtg'],
        [4, '類題16', 'https://youtu.be/l9JdImmnU_4'],
        [4, '問24', 'https://youtu.be/BbRpp4GKgYw'],
        [4, '問25', 'https://youtu.be/Fur02gUT0Kw'],
        [4, '問26', 'https://youtu.be/MN2t5sORWys'],
        [4, '問27', 'https://youtu.be/BMpA7zjgxuE'],
        [4, '問28', 'https://youtu.be/Tx2AOY3GanM'],
        [4, '例題17', 'https://youtu.be/qHtTkIe2LZc'],
        [4, '問31', 'https://youtu.be/hcw-DfkgAS0'],
        [4, '問32', 'https://youtu.be/E-E02BRiiM8'],
        [4, '問34', 'https://youtu.be/fzGsoloGOd4'],
        [4, '例題18', 'https://youtu.be/b_RGUkshXSs'],
        [4, '類題18', 'https://youtu.be/_kIlZBYb6Zw'],
        [4, '問35', 'https://youtu.be/gPTa4gId1TM'],
        [4, '例題19', 'https://youtu.be/AGarIiC4CzI'],
        [4, '類題19', 'https://youtu.be/tY4pq0P1JLY'],
    ];
    
    // JSONファイルを読み込み
    const jsonContent = fs.readFileSync(JSON_FILE, 'utf-8');
    const jsonData = JSON.parse(jsonContent);
    
    // JSONを更新
    const { updatedCount, youtubeAddedCount } = updateJsonFromSpreadsheetData(jsonData, spreadsheetData);
    
    // JSONファイルを保存
    fs.writeFileSync(JSON_FILE, JSON.stringify(jsonData, null, 2), 'utf-8');
    
    console.log(`\n更新完了:`);
    console.log(`  更新された問題数: ${updatedCount}`);
    console.log(`  YouTube URL追加数: ${youtubeAddedCount}`);
}

main();
