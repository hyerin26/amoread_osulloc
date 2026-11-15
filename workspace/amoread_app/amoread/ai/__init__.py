# -*- coding: utf-8 -*-
"""AI 추천(구좌 구성·레퍼런스) 모듈. 화면은 바꾸지 않고 서버(/api/am/ai/*)로만 붙는다. 자세한 설명은 README.md."""


def references_dir():
    """레퍼런스 라이브러리 저장 폴더 (amoread.references.DIR)."""
    from .. import references
    return references.DIR
