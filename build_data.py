"""
매년 평가 엑셀이 갱신되면 이 스크립트를 실행해 data.js를 재생성합니다.

사용법:
    python build_data.py 종합평가_결과정리.xlsm 관계사_종합평가_비교_대시보드.xlsm

두 인자 모두 필수는 아니며, 첫 번째 인자(List 시트 포함 파일)만 있어도 동작합니다.
결과물: 이 스크립트와 같은 폴더에 data.js 가 생성됩니다.
"""
import sys
import json
import openpyxl
import pandas as pd


def build_list_data(result_xlsm_path):
    df = pd.read_excel(result_xlsm_path, sheet_name='List', engine='openpyxl')
    df['평가연도'] = df['평가연도'].ffill()
    df['사업부'] = df['사업부'].ffill()
    df = df.rename(columns={
        '평가연도': 'year', '사업부': 'division', '파트너사명': 'partner',
        '밴더코드': 'vendorCode', '주거래품목': 'item', '최종등급': 'finalGrade',
        '상세등급': 'subGrade', '성과평가등급': 'perfGrade', '평가점수': 'score',
        'SRS등급': 'srsGrade'
    })
    df['year'] = df['year'].astype(str).str.replace('년', '').astype(int)
    return df.to_dict(orient='records')


def build_criteria_data(compare_xlsm_path):
    wb = openpyxl.load_workbook(compare_xlsm_path, data_only=True)
    ws = wb['모판']
    rows = list(ws.iter_rows(values_only=True))
    header = rows[0]
    data = {}
    for r in rows[1:]:
        company = r[0]
        if not company:
            continue
        for i, cat in enumerate(header[1:], start=1):
            val = r[i]
            if val:
                data.setdefault(company, {}).setdefault(cat, []).append(val)
    return data


def main():
    if len(sys.argv) < 2:
        print("사용법: python build_data.py <종합평가_결과정리.xlsm> [관계사_종합평가_비교_대시보드.xlsm]")
        sys.exit(1)

    list_data = build_list_data(sys.argv[1])
    criteria_data = build_criteria_data(sys.argv[2]) if len(sys.argv) > 2 else {}

    js = "const LIST_DATA = " + json.dumps(list_data, ensure_ascii=False) + ";\n"
    js += "const CRITERIA_DATA = " + json.dumps(criteria_data, ensure_ascii=False) + ";\n"

    with open("data.js", "w", encoding="utf-8") as f:
        f.write(js)

    print(f"data.js 생성 완료: 파트너사 레코드 {len(list_data)}건, 관계사 {len(criteria_data)}개")


if __name__ == "__main__":
    main()
