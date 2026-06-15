"""
app.py
------
Camada de FRONTEND (Streamlit). Não contém lógica de API — apenas importa
init_model() e ask_stream() do llm_service e trata da interface e do estado da conversa.

Para correr:
    streamlit run app.py
"""

import streamlit as st

from llm_service import init_model, ask_stream, load_material, MATERIAL_PATH

# ----------------------------- Configuração da página -----------------------
st.set_page_config(page_title="Tutor de Estudo", page_icon="📚")
st.title("📚 Tutor de Estudo")
st.caption("Faço perguntas? Não — respondo-as, mas só sobre a tua matéria.")


# --------------------- Inicialização do modelo (com cache) ------------------
# O material é passado como argumento para que ficheiros diferentes gerem
# entradas de cache distintas — sem necessidade de limpar a cache manualmente.
@st.cache_resource
def carregar_modelo(material: str) -> object:
    return init_model(material=material)


# ------------------------------ Estado da sessão ----------------------------
if "messages" not in st.session_state:
    st.session_state.messages = []

if "material" not in st.session_state:
    try:
        st.session_state.material = load_material()
    except FileNotFoundError:
        st.session_state.material = None

# ------------------------------ Barra lateral -------------------------------
with st.sidebar:
    st.header("Apontamentos")
    ficheiro = st.file_uploader("Substituir apontamentos (.txt)", type=["txt"])
    if ficheiro is not None:
        novo = ficheiro.read().decode("utf-8")
        if novo != st.session_state.material:
            st.session_state.material = novo
            st.session_state.messages = []
            st.rerun()

    st.divider()
    st.header("Sobre")
    st.write(
        "Este tutor responde apenas com base nos apontamentos carregados. "
        "Se a resposta não estiver lá, ele recusa-se a inventar."
    )
    if st.button("🗑️ Limpar conversa"):
        st.session_state.messages = []
        st.rerun()

# ------------------------------ Verificar material --------------------------
if not st.session_state.material:
    st.warning(
        f"Não encontrei o ficheiro `{MATERIAL_PATH}`. "
        "Carrega um ficheiro .txt na barra lateral para começar."
    )
    st.stop()

# ------------------------------ Carregar modelo -----------------------------
try:
    model = carregar_modelo(st.session_state.material)
except (ValueError, FileNotFoundError) as e:
    st.error(str(e))
    st.stop()

# ------------------------------ Histórico -----------------------------------
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# ------------------------------ Entrada do utilizador -----------------------
if pergunta := st.chat_input("Escreve a tua pergunta sobre a matéria..."):
    st.session_state.messages.append({"role": "user", "content": pergunta})
    with st.chat_message("user"):
        st.markdown(pergunta)

    with st.chat_message("assistant"):
        historico = st.session_state.messages[:-1]
        try:
            resposta = st.write_stream(ask_stream(model, historico, pergunta))
        except Exception as e:
            resposta = f"Ocorreu um erro ao contactar o modelo: {e}"
            st.markdown(resposta)

    st.session_state.messages.append({"role": "assistant", "content": resposta})
