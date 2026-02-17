#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
物理基礎教科書の問題番号JSONを生成するスクリプト
スプレッドシートのデータと既存の解説ファイルを参照して、完全な問題リストを作成
"""

import json
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# 物理基礎の単元・章のマッピング（textbook_basic.jsonから）
FIELD_MAPPING = {
    "01/01": "第1編 運動とエネルギー / 第1章 運動の表し方",
    "01/02": "第1編 運動とエネルギー / 第2章 運動の法則",
    "01/03": "第1編 運動とエネルギー / 第3章 仕事と力学的エネルギー",
    "02/01": "第2編 熱 / 第1章 熱とエネルギー",
    "03/01": "第3編 波 / 第1章 波の性質",
    "03/02": "第3編 波 / 第2章 音",
}

# スプレッドシートのデータ構造（物理基礎のデータを想定）
# 実際のデータはスプレッドシートから取得する必要があるが、
# ここでは既存の解説ファイルから推測する

def extract_problem_info_from_html(file_path: Path) -> Optional[Dict]:
    """HTMLファイルから問題情報を抽出"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # タイトルを抽出
        title_match = re.search(r'<h2[^>]*class=["\']prob-title-sub["\'][^>]*>(.*?)</h2>', content, re.DOTALL)
        if not title_match:
            title_match = re.search(r'<h3[^>]*>(.*?)</h3>', content, re.DOTALL)
        
        if title_match:
            title = re.sub(r'<[^>]+>', '', title_match.group(1)).strip()
            return {"title": title}
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
    return None

def find_existing_explanations() -> Dict[str, Dict]:
    """既存の解説ファイルを検索してマッピング"""
    explanations = {}
    base_path = Path("data/explanations/textbook_basic")
    
    if not base_path.exists():
        return explanations
    
    for html_file in base_path.rglob("*.html"):
        # パスからfolderIdを抽出 (例: 03/01/11.html -> 03/01)
        parts = html_file.parts
        if len(parts) >= 3:
            folder_id = f"{parts[-3]}/{parts[-2]}"
            file_name = parts[-1]
            
            # ファイル名から問題番号を推測
            # 例: 11.html -> 例題1, 12.html -> 類題1, 001_p12_ex1.html -> 例題1
            problem_info = extract_problem_info_from_html(html_file)
            if problem_info:
                rel_path = str(html_file).replace("\\", "/")
                key = f"{folder_id}/{file_name}"
                explanations[key] = {
                    "path": rel_path,
                    "title": problem_info.get("title", ""),
                }
    
    return explanations

def parse_problem_number(problem_num: str) -> Tuple[str, Optional[int]]:
    """問題番号を解析（例題1 -> ('例題', 1), 問3 -> ('問', 3)）"""
    if problem_num.startswith("例題"):
        num = re.search(r'\d+', problem_num)
        return ("例題", int(num.group()) if num else None)
    elif problem_num.startswith("類題"):
        num = re.search(r'\d+', problem_num)
        return ("類題", int(num.group()) if num else None)
    elif problem_num.startswith("問"):
        num = re.search(r'\d+', problem_num)
        return ("問", int(num.group()) if num else None)
    elif problem_num.startswith("演習問題"):
        num = re.search(r'\d+', problem_num)
        return ("演習問題", int(num.group()) if num else None)
    elif problem_num.startswith("思考学習"):
        return ("思考学習", None)
    else:
        # 問a, 問b, 問abc などの場合
        return ("問", problem_num.replace("問", "").strip())

def generate_problem_id(folder_id: str, chapter: int, section: int, page: int, problem_num: str) -> str:
    """問題IDを生成"""
    # 既存のID形式に合わせる: basic_03_01_11
    folder_parts = folder_id.split("/")
    problem_type, problem_index = parse_problem_number(problem_num)
    
    if problem_index is not None:
        # 例題1 -> 11, 類題1 -> 12, 問3 -> 03 など
        if problem_type == "例題":
            id_suffix = f"{problem_index:02d}"
        elif problem_type == "類題":
            id_suffix = f"{problem_index + 10:02d}"  # 類題1 -> 11, 類題2 -> 12
        elif problem_type == "問":
            id_suffix = f"{problem_index:02d}"
        elif problem_type == "演習問題":
            id_suffix = f"{problem_index + 20:02d}"  # 演習問題1 -> 21
        else:
            id_suffix = f"{problem_index:02d}"
    else:
        # 問a, 問b などの場合
        id_suffix = problem_num.replace("問", "").replace(" ", "_")
    
    return f"basic_{folder_parts[0]}_{folder_parts[1]}_{id_suffix}"

def create_problem_entry(
    folder_id: str,
    chapter: int,
    section: Optional[int],
    page: int,
    problem_num: str,
    title: str,
    existing_explanations: Dict[str, Dict]
) -> Dict:
    """問題エントリを作成"""
    problem_id = generate_problem_id(folder_id, chapter, section or 0, page, problem_num)
    
    # 既存の解説ファイルを検索
    explanation_path = None
    for key, exp_info in existing_explanations.items():
        if folder_id in key:
            # タイトルや問題番号でマッチングを試みる
            exp_title = exp_info.get("title", "").lower()
            if problem_num.lower() in exp_title or title.lower() in exp_title:
                explanation_path = exp_info["path"]
                break
    
    # 見つからない場合は、ファイル名パターンで検索
    if not explanation_path:
        folder_parts = folder_id.split("/")
        base_path = Path(f"data/explanations/textbook_basic/{folder_parts[0]}/{folder_parts[1]}")
        if base_path.exists():
            # ファイル名パターンで検索
            problem_type, problem_index = parse_problem_number(problem_num)
            if problem_index is not None:
                if problem_type == "例題":
                    file_pattern = f"{problem_index:02d}.html"
                elif problem_type == "類題":
                    file_pattern = f"{problem_index + 10:02d}.html"
                elif problem_type == "演習問題":
                    file_pattern = f"{problem_index + 20:02d}.html"
                else:
                    file_pattern = f"{problem_index:02d}.html"
                
                potential_file = base_path / file_pattern
                if potential_file.exists():
                    explanation_path = str(potential_file).replace("\\", "/")
    
    entry = {
        "id": problem_id,
        "title": f"{problem_num}：{title}" if title else problem_num,
    }
    
    if explanation_path:
        entry["explanationPath"] = explanation_path
    
    return entry

def ensure_example_before_related(problems: List[Dict], current_index: int) -> bool:
    """類題の前に例題があるか確認し、なければ追加"""
    if current_index == 0:
        return False
    
    current = problems[current_index]
    current_title = current.get("title", "")
    
    # 類題の場合は、直前が対応する例題か確認
    if "類題" in current_title:
        # 類題の番号を抽出
        match = re.search(r'類題(\d+)', current_title)
        if match:
            example_num = int(match.group(1))
            # 直前の問題を確認
            prev = problems[current_index - 1]
            prev_title = prev.get("title", "")
            if f"例題{example_num}" not in prev_title:
                # 例題が抜けているので追加
                example_entry = {
                    "id": prev["id"].replace("類題", "例題").replace("rui", "rei"),
                    "title": f"例題{example_num}：{current_title.split('：')[1] if '：' in current_title else ''}",
                }
                problems.insert(current_index, example_entry)
                return True
    return False

def main():
    # 既存の解説ファイルを検索
    existing_explanations = find_existing_explanations()
    
    # 既存のJSONを読み込み
    json_path = Path("data/materials/textbook_basic.json")
    if json_path.exists():
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        data = {
            "materialName": "物理基礎",
            "subjects": [
                {
                    "subjectName": "物理基礎",
                    "folderName": "",
                    "fields": []
                }
            ]
        }
    
    # 各フィールドに対して問題を追加
    # スプレッドシートのデータは直接取得できないため、
    # 既存の解説ファイルとフォルダ構造から推測
    
    # 既存のフィールドを確認
    subject = data["subjects"][0]
    fields_dict = {field["folderId"]: field for field in subject["fields"]}
    
    # 各フォルダの解説ファイルをスキャン
    base_path = Path("data/explanations/textbook_basic")
    if base_path.exists():
        for folder_dir in base_path.iterdir():
            if not folder_dir.is_dir():
                continue
            
            for section_dir in folder_dir.iterdir():
                if not section_dir.is_dir():
                    continue
                
                folder_id = f"{folder_dir.name}/{section_dir.name}"
                
                if folder_id not in fields_dict:
                    # フィールドが存在しない場合は追加
                    field_name = FIELD_MAPPING.get(folder_id, f"第{folder_dir.name}編 / 第{section_dir.name}章")
                    fields_dict[folder_id] = {
                        "fieldName": field_name,
                        "folderId": folder_id,
                        "problems": []
                    }
                    subject["fields"].append(fields_dict[folder_id])
                
                # このフォルダの既存の問題を取得
                problems = fields_dict[folder_id]["problems"]
                existing_ids = {p["id"] for p in problems}
                
                # HTMLファイルをスキャンして問題を追加
                for html_file in sorted(section_dir.glob("*.html")):
                    file_name = html_file.stem
                    rel_path = str(html_file).replace("\\", "/")
                    
                    # ファイル名から問題情報を推測
                    # 例: 11.html -> 例題1, 12.html -> 類題1
                    if file_name.isdigit():
                        file_num = int(file_name)
                        if 1 <= file_num <= 10:
                            problem_num = f"例題{file_num}"
                        elif 11 <= file_num <= 20:
                            problem_num = f"類題{file_num - 10}"
                        elif 21 <= file_num <= 30:
                            problem_num = f"演習問題{file_num - 20}"
                        else:
                            problem_num = f"問{file_num}"
                    elif file_name.startswith("001_"):
                        # 001_p12_ex1.html 形式
                        match = re.search(r'ex(\d+)', file_name)
                        if match:
                            problem_num = f"例題{match.group(1)}"
                        else:
                            problem_num = "例題1"
                    else:
                        problem_num = file_name
                    
                    # 問題情報を抽出
                    problem_info = extract_problem_info_from_html(html_file)
                    title = problem_info.get("title", "") if problem_info else ""
                    
                    # 問題IDを生成
                    problem_id = f"basic_{folder_dir.name}_{section_dir.name}_{file_name}"
                    
                    # 既に存在する場合はスキップ
                    if problem_id in existing_ids:
                        continue
                    
                    # 問題エントリを作成
                    entry = {
                        "id": problem_id,
                        "title": title or f"{problem_num}",
                        "explanationPath": rel_path
                    }
                    
                    problems.append(entry)
                
                # 問題をソート（例題 -> 類題 -> 問 -> 演習問題の順）
                def sort_key(p):
                    title = p.get("title", "")
                    if "例題" in title:
                        match = re.search(r'例題(\d+)', title)
                        return (0, int(match.group(1)) if match else 999)
                    elif "類題" in title:
                        match = re.search(r'類題(\d+)', title)
                        return (1, int(match.group(1)) if match else 999)
                    elif "問" in title:
                        match = re.search(r'問(\d+)', title)
                        return (2, int(match.group(1)) if match else 999)
                    elif "演習問題" in title:
                        match = re.search(r'演習問題(\d+)', title)
                        return (3, int(match.group(1)) if match else 999)
                    return (4, 0)
                
                problems.sort(key=sort_key)
                
                # 類題の前に例題があるか確認
                i = 0
                while i < len(problems):
                    if ensure_example_before_related(problems, i):
                        i += 1  # 追加されたので次へ
                    i += 1
    
    # JSONを保存
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"JSONファイルを更新しました: {json_path}")
    print(f"総フィールド数: {len(subject['fields'])}")
    total_problems = sum(len(f["problems"]) for f in subject["fields"])
    print(f"総問題数: {total_problems}")

if __name__ == "__main__":
    main()
