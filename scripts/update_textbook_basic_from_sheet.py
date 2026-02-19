#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
スプレッドシートから物理基礎教科書問題のJSONを更新するスクリプト
I列（章番号）とL列（問題番号）を読み取り、R列（YouTube URL）を追加
"""

import json
import re
import sys
from pathlib import Path

# プロジェクトルートのパス
PROJECT_ROOT = Path(__file__).parent.parent
JSON_FILE = PROJECT_ROOT / "data" / "materials" / "textbook_basic.json"

def parse_problem_number(problem_str):
    """
    問題番号文字列をパースして、タイプと番号を返す
    例: "問1" -> ("問", 1), "例題1" -> ("例題", 1), "演習問題1" -> ("演習問題", 1)
    """
    if not problem_str or problem_str.strip() == "":
        return None, None
    
    problem_str = problem_str.strip()
    
    # 演習問題
    match = re.match(r'演習問題(\d+)', problem_str)
    if match:
        return "演習問題", int(match.group(1))
    
    # 例題
    match = re.match(r'例題(\d+)', problem_str)
    if match:
        return "例題", int(match.group(1))
    
    # 類題
    match = re.match(r'類題(\d+)', problem_str)
    if match:
        return "類題", int(match.group(1))
    
    # 問（数字付き）
    match = re.match(r'問(\d+)', problem_str)
    if match:
        return "問", int(match.group(1))
    
    # 問（abcなど）
    match = re.match(r'問([a-z]+)', problem_str)
    if match:
        return "問", match.group(1)
    
    # 思考学習
    if "思考学習" in problem_str:
        return "思考学習", None
    
    return None, None

def normalize_title(title):
    """
    タイトルを正規化して、問題番号部分を抽出
    """
    if not title:
        return None
    
    # タイトルから問題番号部分を抽出
    # 例: "問1：変位" -> "問1"
    match = re.match(r'^([^：]+)', title)
    if match:
        return match.group(1).strip()
    return title.strip()

def find_matching_problem(problems, chapter_num, problem_number_str):
    """
    JSONの問題リストから、章番号と問題番号に一致する問題を探す
    """
    problem_type, problem_num = parse_problem_number(problem_number_str)
    
    if problem_type is None:
        return None
    
    for problem in problems:
        title = problem.get("title", "")
        normalized_title = normalize_title(title)
        
        # 問題タイプと番号でマッチング
        if problem_type == "演習問題":
            if f"演習問題{problem_num}" in normalized_title:
                return problem
        elif problem_type == "例題":
            if f"例題{problem_num}" in normalized_title:
                return problem
        elif problem_type == "類題":
            if f"類題{problem_num}" in normalized_title:
                return problem
        elif problem_type == "問":
            if isinstance(problem_num, int):
                if f"問{problem_num}" in normalized_title or f"問{problem_num}：" in normalized_title:
                    return problem
            else:  # abcなど
                if f"問{problem_num}" in normalized_title or f"問{problem_num}：" in normalized_title:
                    return problem
        elif problem_type == "思考学習":
            if "思考学習" in normalized_title:
                return problem
    
    return None

def update_json_from_spreadsheet_data(json_data, spreadsheet_data):
    """
    スプレッドシートのデータを使ってJSONを更新
    spreadsheet_data: [(chapter, problem_number, youtube_url), ...]
    """
    updated_count = 0
    youtube_added_count = 0
    
    # 章番号からfolderIdへのマッピング（第1編=01, 第2編=02, 第3編=03）
    # 外部リンクのデータを見ると、章番号は1-4の範囲のようです
    # JSONの構造を見ると、第1編は01, 第2編は02, 第3編は03となっています
    
    for subject in json_data.get("subjects", []):
        for field in subject.get("fields", []):
            folder_id = field.get("folderId", "")
            problems = field.get("problems", [])
            
            # folderIdから章番号を抽出（例: "01/01" -> 1, "01/02" -> 2）
            # 第1編の第1章=1, 第1編の第2章=2, 第1編の第3章=3, 第4編の第4章=4
            # ただし、外部リンクのデータは「物理」シートのデータで、章番号が1-4の範囲
            # 「物理基礎」の場合は、第1編の第1章=1, 第1編の第2章=2, 第1編の第3章=3となる
            
            # folderIdの最初の部分（編）と2番目の部分（章）を取得
            parts = folder_id.split("/")
            if len(parts) >= 2:
                try:
                    chapter_num = int(parts[1])  # 章番号
                except ValueError:
                    continue
            else:
                continue
            
            # この章に該当するスプレッドシートのデータをフィルタ
            chapter_data = [(ch, pn, url) for ch, pn, url in spreadsheet_data if ch == chapter_num]
            
            for chapter_num_sp, problem_number, youtube_url in chapter_data:
                problem = find_matching_problem(problems, chapter_num_sp, problem_number)
                
                if problem:
                    # すでにexplanationPathが存在する場合はスキップ
                    if "explanationPath" in problem and problem["explanationPath"]:
                        continue
                    
                    # YouTube URLがある場合は追加
                    if youtube_url and youtube_url.strip():
                        problem["youtubeUrl"] = youtube_url.strip()
                        youtube_added_count += 1
                        updated_count += 1
                        print(f"更新: {field.get('fieldName', '')} - {problem.get('title', '')} - YouTube URL追加")
    
    return updated_count, youtube_added_count

def main():
    # スプレッドシートのデータ（外部リンクから取得したデータをパース）
    # 形式: [(章番号, 問題番号, YouTube URL), ...]
    # 外部リンクのデータから手動で抽出したデータを使用
    spreadsheet_data = [
        # 第1章（章番号1）
        (1, "問1", "https://youtu.be/sC5li_LEcxM"),
        (1, "問2", "https://youtu.be/I9JNMF_YuXo"),
        (1, "例題1", "https://youtu.be/2OtwN26MA2M"),
        (1, "類題1", "https://youtu.be/nP0Gd-FDrNE"),
        (1, "問abc", "https://youtu.be/k1TNTW4EkPo"),
        (1, "問3", "https://youtu.be/BIE_4psLN-8"),
        (1, "例題2", "https://youtu.be/RB9LdYZ1Eys"),
        (1, "類題2", "https://youtu.be/z3LUnGS8CPg"),
        (1, "例題3", "https://youtu.be/UEO2SDUOQEU"),
        (1, "類題3", "https://youtu.be/R5raAFoJX6c"),
        (1, "問a", "https://youtu.be/coGvlyA9E98"),
        (1, "問b", "https://youtu.be/CxOtCGL_1NM"),
        (1, "問c", "https://youtu.be/pZeQFyAcJ8M"),
        (1, "演習問題1", "https://youtu.be/EK9tWnXNW2w"),
        (1, "演習問題2", "https://youtu.be/m3dT3KMbm30"),
        (1, "演習問題3", "https://youtu.be/vCgarDovoN8"),
        (1, "演習問題4", "https://youtu.be/GPxG-uqTdN4"),
        (1, "演習問題5", "https://youtu.be/pEDfjbJKnCQ"),
        # 第2章（章番号2）
        (2, "問4", "https://youtu.be/S6oPL7MYe4I"),
        (2, "問5", "https://youtu.be/P0XNwjErJnY"),
        (2, "例題4", "https://youtu.be/1g7kBf3GR_w"),
        (2, "類題4", "https://youtu.be/fRYknHrrHp8"),
        (2, "問6", "https://youtu.be/ZcF22W83Kbw"),
        (2, "問7", "https://youtu.be/bbnLoZYwDjc"),
        (2, "問8", "https://youtu.be/C8bEzjJQz6Q"),
        (2, "問9", "https://youtu.be/Y_3Y3qlAqjY"),
        (2, "問10", "https://youtu.be/Cs3KXR3lbZc"),
        (2, "問11", "https://youtu.be/SrIBSW0M1cw"),
        (2, "例題5", "https://youtu.be/HJgZXbZ0GJw"),
        (2, "類題5", "https://youtu.be/NaHwNxef7j4"),
        (2, "思考学習", "https://youtu.be/cfrXjJA2waI"),
        (2, "演習問題1", "https://youtu.be/rd6lrQ4ToY8"),
        (2, "演習問題2", "https://youtu.be/o0Qz9Lv-GN4"),
        (2, "演習問題3", "https://youtu.be/k78UcD-Oe4I"),
        (2, "演習問題4", "https://youtu.be/6i41BckCIZM"),
        # 第3章（章番号3）
        (3, "問13", "https://youtu.be/0jd4rfHUlno"),
        (3, "問14", "https://youtu.be/JaImpWW_S9A"),
        (3, "例題6", "https://youtu.be/B5qHXDqly_A"),
        (3, "類題6", "https://youtu.be/7Lgb3lN4-PQ"),
        (3, "例題7", "https://youtu.be/HL5v4ti7HTA"),
        (3, "類題7", "https://youtu.be/sEOS78A72r0"),
        (3, "例題8", "https://youtu.be/heVDy2xSZPA"),
        (3, "類題8", "https://youtu.be/WHhDQTqk1uA"),
        (3, "例題9", "https://youtu.be/qPbDHGxX7eg"),
        (3, "類題9", "https://youtu.be/YOmYBUBSd6k"),
        (3, "問16", "https://youtu.be/-hrJtcsf_NE"),
        (3, "問17", "https://youtu.be/y80Oru5DH9Y"),
        (3, "例題10", "https://youtu.be/0zV0RaXWaGE"),
        (3, "類題10", "https://youtu.be/vlnuw9pDqxk"),
        (3, "例題11", "https://youtu.be/A6bdSvoAxyE"),
        (3, "類題11", "https://youtu.be/mGIpKSJ_PMI"),
        (3, "問18", "https://youtu.be/1PWUjjg-JHI"),
        (3, "演習問題1", "https://youtu.be/_gOZdFZpCG8"),
        (3, "演習問題2", "https://youtu.be/3u_0Vpa36F4"),
        (3, "演習問題3", "https://youtu.be/nxV3hntL-Ic"),
        (3, "演習問題4", "https://youtu.be/c0c7Sq_ibUo"),
        (3, "演習問題5", "https://youtu.be/Ji6mGBbynpI"),
        (3, "演習問題6", "https://youtu.be/rrVTCh-vVRs"),
        (3, "演習問題7", "https://youtu.be/p1faQ94uHmA"),
        # 第4章（章番号4）
        (4, "問22", "https://youtu.be/4DQlE2YIgi0"),
        (4, "例題12", "https://youtu.be/YmZYYgo4Toc"),
        (4, "類題12", "https://youtu.be/eBjfVD7UOnc"),
        (4, "例題13", "https://youtu.be/QQEhEBNMFhM"),
        (4, "類題13", "https://youtu.be/-fXY7F9FhRM"),
        (4, "例題14", "https://youtu.be/e9e8l2GIcxo"),
        (4, "類題14", "https://youtu.be/jj-mhM8D8h0"),
        (4, "例題15", "https://youtu.be/gR2mTRvYbuM"),
        (4, "類題15", "https://youtu.be/u0M0g-yMwPE"),
        (4, "例題16", "https://youtu.be/A1ENGNfqJtg"),
        (4, "類題16", "https://youtu.be/l9JdImmnU_4"),
        (4, "問24", "https://youtu.be/BbRpp4GKgYw"),
        (4, "問25", "https://youtu.be/Fur02gUT0Kw"),
        (4, "問26", "https://youtu.be/MN2t5sORWys"),
        (4, "問27", "https://youtu.be/BMpA7zjgxuE"),
        (4, "問28", "https://youtu.be/Tx2AOY3GanM"),
        (4, "例題17", "https://youtu.be/qHtTkIe2LZc"),
        (4, "問31", "https://youtu.be/hcw-DfkgAS0"),
        (4, "問32", "https://youtu.be/E-E02BRiiM8"),
        (4, "問34", "https://youtu.be/fzGsoloGOd4"),
        (4, "例題18", "https://youtu.be/b_RGUkshXSs"),
        (4, "類題18", "https://youtu.be/_kIlZBYb6Zw"),
        (4, "問35", "https://youtu.be/gPTa4gId1TM"),
        (4, "例題19", "https://youtu.be/AGarIiC4CzI"),
        (4, "類題19", "https://youtu.be/tY4pq0P1JLY"),
    ]
    
    # JSONファイルを読み込み
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        json_data = json.load(f)
    
    # JSONを更新
    updated_count, youtube_added_count = update_json_from_spreadsheet_data(json_data, spreadsheet_data)
    
    # JSONファイルを保存
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n更新完了:")
    print(f"  更新された問題数: {updated_count}")
    print(f"  YouTube URL追加数: {youtube_added_count}")

if __name__ == "__main__":
    main()
