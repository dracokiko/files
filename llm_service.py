"""
llm_service.py
--------------
Camada de BACKEND. Tudo o que envolve a API do Gemini vive aqui:
  - carregar a chave do .env
  - ler os resumos do disco
  - inicializar o modelo com a System Instruction
  - enviar perguntas em modo streaming

A interface (app.py) não sabe — nem precisa de saber — como nada disto funciona.
Só chama init_model() e ask_stream().
"""

import os
from collections.abc import Generator

import google.generativeai as genai
from dotenv import load_dotenv

from config_prompts import build_system_instruction

MODEL_NAME = "gemini-flash-lite-latest"
MATERIAL_PATH = "resumos.txt"


def load_material(path: str = MATERIAL_PATH) -> str:
    """Lê o ficheiro de resumos do disco."""
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Não encontrei o ficheiro '{path}'. "
            "Certifica-te de que ele está na mesma pasta da aplicação."
        )
    with open(path, encoding="utf-8") as f:
        return f.read()


def init_model(material: str | None = None) -> genai.GenerativeModel:
    """
    Carrega a chave, configura o SDK e devolve um modelo já preparado
    com a System Instruction baseada nos resumos.

    Args:
        material: texto dos apontamentos. Se None, lê de MATERIAL_PATH.
    """
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError(
            "A variável GEMINI_API_KEY não está definida. "
            "Cria um ficheiro .env (vê o .env.example) com a tua chave."
        )

    genai.configure(api_key=api_key)

    if material is None:
        material = load_material()
    system_instruction = build_system_instruction(material)

    return genai.GenerativeModel(
        model_name=MODEL_NAME,
        system_instruction=system_instruction,
    )


def _to_gemini_history(messages: list[dict]) -> list[dict]:
    """
    Converte o histórico no formato do Streamlit para o formato do Gemini.

    Streamlit usa:  {"role": "user"|"assistant", "content": "..."}
    Gemini usa:     {"role": "user"|"model",     "parts":   ["..."]}
    """
    return [
        {"role": "user" if msg["role"] == "user" else "model", "parts": [msg["content"]]}
        for msg in messages
    ]


def ask_stream(
    model: genai.GenerativeModel, history: list[dict], question: str
) -> Generator[str, None, None]:
    """
    Envia uma pergunta ao modelo em modo streaming.

    Yields:
        Fragmentos de texto à medida que o modelo os gera.
    """
    chat = model.start_chat(history=_to_gemini_history(history))
    response = chat.send_message(question, stream=True)
    for chunk in response:
        if chunk.text:
            yield chunk.text
