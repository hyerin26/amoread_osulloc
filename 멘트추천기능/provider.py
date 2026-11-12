"""기존 planner.claude_agent와 같은 SDK. 파일/셸/MCP 도구는 사용하지 않는다."""
import json
from .domain import SYSTEM, output_schema


class ClaudeCopyProvider:
    def __init__(self, model):
        self.model = model

    @property
    def available(self):
        try:
            import claude_agent_sdk  # noqa
            return True
        except ImportError:
            return False

    async def generate(self, context, correction=None):
        from claude_agent_sdk import ClaudeAgentOptions, ResultMessage, query
        prompt = '다음 문맥으로 카피를 제안해 주세요.\n' + json.dumps(context, ensure_ascii=False)
        if correction:
            prompt += '\n이전 응답은 다음 검증을 통과하지 못했다. 해당 문제를 고쳐 새 3세트를 반환하라: '+correction
        opts = ClaudeAgentOptions(tools=[], allowed_tools=[], mcp_servers={}, setting_sources=[],
            system_prompt=SYSTEM, model=self.model, max_turns=3,
            output_format={'type':'json_schema','schema':output_schema(context)})
        async for message in query(prompt=prompt, options=opts):
            if isinstance(message, ResultMessage):
                if message.is_error or not message.structured_output:
                    raise RuntimeError('structured_output_unavailable')
                return message.structured_output
        raise RuntimeError('no_result')
