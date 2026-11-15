# 색인·평가 도구

수집 데이터(`reference/data`, 팀원이 올린 레퍼런스 파서 결과)에서 AI 색인을 만들고 평가하는 스크립트. 서버에는 쓰이지 않는다.

```bash
# 새 수집 데이터가 오면 한 번에: 역할 합치기 → 색인 → 분류 → 평가 → 지난번과 비교
python amoread/ai/tools/refresh.py <reference/data 폴더> [--no-vectors]
```

| 파일 | 하는 일 |
|---|---|
| `build_unified.py` | 수집 JSON → 역할이 `role` 하나로 합쳐진 섹션 파일 (`unified/`, 기록에 안 올림) |
| `reclassify_roles.py` | 수집 원본이 `content`로 뭉친 구좌를 규칙으로 세분화 |
| `eval_product.py` | 서버가 쓰는 검색을 그대로 평가 (nDCG·Hit@5). `queries.json`(질의 30개), `labels_by_id.json`(AI가 붙인 라벨 625건, 사람 검수 전) |
| `refresh.py` | 위를 한 번에 돌리고 점수를 `eval_history.jsonl`에 쌓음 |

색인·분류 라벨 만들기와 사람 검수(CSV)는 `amoread/ai/README.md` 참고.
