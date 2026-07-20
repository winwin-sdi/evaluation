# 파트너사 종합평가 대시보드

정적 HTML 대시보드입니다. 서버 없이 GitHub Pages로 바로 배포됩니다.

## 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 화면 구조 (탭 2개: 종합평가 결과 / 3사 평가기준 비교) |
| `style.css` | 스타일 |
| `script.js` | 필터/정렬/차트/상세보기 로직 |
| `data.js` | 엑셀에서 추출한 데이터 (JS 상수로 내장) |
| `build_data.py` | 엑셀 → data.js 재생성 스크립트 |

## 배포 방법 (GitHub Pages, 공개 저장소)

1. 새 GitHub repo 생성 (public)
2. 이 폴더의 파일 5개를 repo 루트에 push
3. repo → Settings → Pages → Source를 `main` 브랜치 `/ (root)`로 지정
4. 몇 분 뒤 `https://<계정명>.github.io/<repo명>/` 접속

**주의**: public repo이므로 `data.js`에 포함된 파트너사명·밴더코드·평가점수가 인터넷에 그대로 공개됩니다. (사용자가 확인하고 진행하기로 한 사항입니다.)

## 데이터 갱신 (매년)

평가 엑셀이 갱신되면:

```bash
pip install openpyxl pandas
python build_data.py 종합평가_결과정리.xlsm 관계사_종합평가_비교_대시보드.xlsm
```

새로 생성된 `data.js`를 커밋 후 push하면 Pages가 자동 재배포합니다.

## 데이터 범위 / 알려진 제약

- **2023년 데이터는 포함하지 않음.** `등급정의`/`List` 시트의 등급 체계(1~3등급, SRS 6단계 영문)와 `23년 전자재료·전지 평가결과` 시트의 등급 체계(A/B/C, SRS S/C)가 서로 달라 그대로 합치면 의미가 왜곡됩니다. 필요 시 별도 매핑표를 정의해 `build_data.py`에 변환 로직을 추가해야 합니다.
- 3사(삼성전자/삼성전기/삼성SDI) 평가기준 비교 탭은 `관계사_종합평가_비교_대시보드.xlsm`의 `모판` 시트 원본 그대로이며, 실제 점수가 아니라 "어떤 지표를 쓰는지"에 대한 정성적 비교표입니다.
