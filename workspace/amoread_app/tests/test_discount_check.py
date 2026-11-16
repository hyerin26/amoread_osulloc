"""03 구좌 편집의 할인 판정 API (/api/am/discount/check): 상품·할인 화면(deals.js judge·maxRate)과 같은 셈, 원가는 응답에 없음."""
from fastapi.testclient import TestClient

from amoread.api import discount_verdict
from planner import engine, server

P = {"seq": "1", "name": "시험 상품", "price": 24000.0, "cost": 5130.0,
     "last_promo": "26블프", "last_promo_type": "상시", "last_promo_start": "2026-11-02", "last_promo_rate": 0.15}


def test_verdict_matches_deals_rule():
    # 25%: 할인가 18,000 → 원가율 5130/(18000/1.1)=0.313 → 괜찮음
    v = discount_verdict(P, 0.25, 0.45)
    assert (v["sale"], v["verdict"], v["label"]) == (18000, "ok", "괜찮음")
    assert v["last"] == {"promo": "26블프", "type": "상시", "start": "2026-11-02", "rate": 0.15}
    # 기준 안 최대: r% 할인가로 원가율 0.45 이하인 가장 큰 r
    m = v["max_rate"]
    assert 5130 / (round(24000 * (1 - m / 100) / 10) * 10 / 1.1) <= 0.45 < 5130 / (round(24000 * (1 - (m + 1) / 100) / 10) * 10 / 1.1)
    assert discount_verdict(P, (m + 1) / 100, 0.45)["verdict"] == "warn"
    assert discount_verdict(P, 0, 0.45)["verdict"] == "none"
    assert discount_verdict(P, 0.85, 0.45)["verdict"] == "err"
    assert discount_verdict({**P, "cost": 0}, 0.3, 0.45)["label"] == "원가 없음"


def test_api_hides_cost_and_validates():
    engine.DATA.ensure()
    seq = next(s for s, p in engine.DATA.products.items() if p.get("price") and p.get("cost"))
    with TestClient(server.app, base_url=f'http://127.0.0.1:{server.config.SERVER_PORT}') as c:
        h = {"x-planner-token": server.TOKEN}
        r = c.post("/api/am/discount/check", json={"items": [{"seq": seq, "rate": 0.25}, {"seq": "999999999", "rate": 0.1}]}, headers=h)
        assert r.status_code == 200
        items = r.json()["items"]
        assert [x["seq"] for x in items] == [seq]                      # 없는 SEQ는 빠짐
        assert "cost" not in items[0] and "cost_ratio" not in items[0]  # 원가는 보내지 않는다
        assert c.post("/api/am/discount/check", json={"items": [{"seq": "abc", "rate": 0.1}]}, headers=h).status_code in (400, 422)
        assert c.post("/api/am/discount/check", json={"items": [{"seq": seq, "rate": 0.95}]}, headers=h).status_code in (400, 422)
        assert c.post("/api/am/discount/check", json={"items": [{"seq": seq, "rate": 0.1}]}).status_code in (401, 403)   # 토큰 없으면 거절
