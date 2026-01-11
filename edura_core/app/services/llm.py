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

class AzureOpenAILLMService(LLMService):
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.endpoint = settings.OPENAI_ENDPOINT
        self.deployment = settings.OPENAI_DEPLOYMENT
        
    async def generate_response(self, messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
        if not self.api_key or not self.endpoint or not self.deployment:
             yield f"data: {{\"error\": \"Azure OpenAI configuration missing.\"}}\n\n"
             return

        url = f"{self.endpoint}/openai/deployments/{self.deployment}/chat/completions?api-version=2023-06-01-preview"
        
        # Check for OYD (On Your Data) / Search configuration
        # For simplicity, if search is configured, we use the extensions endpoint.
        # This matches previous chat.py logic.
        use_extensions = False
        if settings.SEARCH_ENDPOINT and settings.SEARCH_KEY and settings.SEARCH_INDEX:
            use_extensions = True
            url = f"{self.endpoint}/openai/deployments/{self.deployment}/extensions/chat/completions?api-version=2023-06-01-preview"
        
        payload = {
            "messages": messages,
            "stream": True,
            "temperature": 0.7
        }

        if use_extensions:
             payload["dataSources"] = [
                {
                    "type": "AzureCognitiveSearch",
                    "parameters": {
                        "endpoint": settings.SEARCH_ENDPOINT,
                        "key": settings.SEARCH_KEY,
                        "indexName": settings.SEARCH_INDEX,
                        "semanticConfiguration": "",
                        "queryType": "simple",
                        "fieldsMapping": {
                            "contentFieldsSeparator": "\n",
                            "contentFields": ["content"],
                            "filepathField": None,
                            "titleField": "title",
                            "urlField": None
                        },
                        "inScope": True,
                        "roleInformation": messages[0]['content'] if messages and messages[0]['role'] == 'system' else "You represent an AI Agent."
                    }
                }
            ]

        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json"
        }

        async for chunk in self._stream_request(url, payload, headers):
            yield chunk

    async def _stream_request(self, url: str, payload: dict, headers: dict) -> AsyncGenerator[str, None]:
        full_response_text = ""
        user_question = payload["messages"][-1]["content"] if payload["messages"] else "Unknown"
        logger.info(f"LLM Request [Azure]: {user_question}")

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
                                 # Accumulate content for logging
                                 # Structure varies slightly between standard and azure extensions
                                 delta = data.get("choices", [{}])[0].get("delta", {})
                                 if "content" in delta:
                                     full_response_text += delta["content"]
                                 elif "messages" in data.get("choices", [{}])[0]: # Azure Extensions format
                                      msg = data["choices"][0]["messages"][0]["delta"]
                                      if "content" in msg:
                                          full_response_text += msg["content"]
                             except:
                                 pass
                        yield line
        
        logger.info(f"LLM Response: {full_response_text}")


class OpenAILLMService(LLMService):
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.model = settings.OPENAI_MODEL
        
    async def generate_response(self, messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
        if not self.api_key:
             yield f"data: {{\"error\": \"OpenAI API Key missing.\"}}\n\n"
             return

        url = "https://api.openai.com/v1/chat/completions"
        
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        full_response_text = ""
        user_question = messages[-1]["content"] if messages else "Unknown"
        logger.info(f"LLM Request [OpenAI]: {user_question}")

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
    provider = settings.LLM_PROVIDER.lower()
    if provider == "openai":
        return OpenAILLMService()
    else:
        return AzureOpenAILLMService()
