import aiohttp
import json
import logging
from typing import AsyncGenerator, List, Dict, Any
from abc import ABC, abstractmethod
from app.core.config import settings

logger = logging.getLogger("uvicorn.error")

class LLMService(ABC):
    @abstractmethod
    async def generate_response(self, messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
        pass

from app.prompt import SYSTEM_PROMPT_TEMPLATE

class OpenAILLMService(LLMService):
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.model = settings.OPENAI_MODEL
        
    async def generate_response(self, messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
        if not self.api_key:
             yield f"data: {{\"error\": \"OpenAI API Key missing.\"}}\n\n"
             return

        url = "https://api.openai.com/v1/chat/completions"
        
        # Parse context and question from the last message
        last_message_content = messages[-1]["content"] if messages else ""
        context = "No context provided."
        question = last_message_content

        if "[SYSTEM CONTEXT:" in last_message_content:
            try:
                # Expecting format: [SYSTEM CONTEXT: ...]\n\nUser Question: ...
                parts = last_message_content.split("]\n\nUser Question: ")
                if len(parts) >= 2:
                    context = parts[0].replace("[SYSTEM CONTEXT: ", "")
                    question = parts[1]
            except Exception as e:
                logger.error(f"Error parsing context: {e}")
        
        # Format the system prompt
        formatted_prompt = SYSTEM_PROMPT_TEMPLATE.format(context=context, question=question)

        # Construct payload with single system message containing everything
        api_messages = [{"role": "system", "content": formatted_prompt}]

        payload = {
            "model": self.model,
            "messages": api_messages,
            "stream": True
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        full_response_text = ""
        logger.info(f"LLM Request [OpenAI]: {question} (Context length: {len(context)})")

        async with aiohttp.ClientSession() as session:
             async with session.post(url, json=payload, headers=headers) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"LLM Error: {response.status} - {error_text}")
                    yield f"data: {{\"error\": \"Upstream error: {response.status} - {error_text}\"}}\n\n"
                    return

                async for line in response.content:
                    if line:
                        decoded_line = line.decode('utf-8').strip()
                        if decoded_line.startswith("data: ") and decoded_line != "data: [DONE]":
                             try:
                                 json_str = decoded_line[6:]
                                 data = json.loads(json_str)
                                 content = data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                 if content:
                                     full_response_text += content
                             except:
                                 pass
                        yield line
        
        logger.info(f"LLM Response: {full_response_text}")

def get_llm_service() -> LLMService:
    return OpenAILLMService()
