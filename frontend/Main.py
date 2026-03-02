import requests
import streamlit as st
from backend.config.config import Config

PDF_ENDPOINT = "http://localhost:8001/pdf_converter"
RAG_CHAT_ENDPOINT = "http://localhost:8001/rag/query"

config = Config()

st.set_page_config(layout="wide", page_title="Custom PDF Uploader")

# -----------------------------
# Session State
# -----------------------------
if "file_inventory" not in st.session_state:
    st.session_state.file_inventory = []  # list of dicts: {name, content}
if "selected_file_name" not in st.session_state:
    st.session_state.selected_file_name = None
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []

uploaded_file = st.file_uploader(
    f"Upload your PDF file",
    type="pdf",
    key="pdf_uploader"
)

# call the backend api by the router entrypoint /pdf_converter
if uploaded_file:
    with st.spinner("Processing document..."):
        res = requests.post(
            PDF_ENDPOINT,
            files={"file": (uploaded_file.name, uploaded_file, "application/pdf")}
        )
        data = res.json()

        if data["errors"]:
            st.error("Errors occurred:\n" + "\n".join(data["errors"]))

        if data["chunks"]:
            st.success("PDF processed successfully!")

            # --- store uploaded file in memory ---
            st.session_state.file_inventory.append({
                "name": uploaded_file.name,
                "file": uploaded_file
            })

            # --- automatically set as current file for chat ---
            st.session_state.selected_file_name = uploaded_file.name

## -----------------------------
# LEFT — Chat Assistant
# -----------------------------
st.markdown("### 💬 Chat Assistant")

if not st.session_state.selected_file_name:
    st.info("Upload a document to start chatting.")
else:
    # Get user input and store in session_state
    if "current_input" not in st.session_state:
        st.session_state.current_input = ""

    user_input = st.chat_input("Ask something about the document...", key="chat_input")

    if user_input:
        st.session_state.chat_history.append(("user", user_input))
        st.session_state.current_input = ""  # clear input after submission

        try:
            response = requests.post(
                RAG_CHAT_ENDPOINT,
                json={"question": user_input}
            )
            if response.status_code == 200:
                data = response.json()
                response_text = data["answer"]
                st.session_state.chat_history.append(("assistant", response_text))
            else:
                st.session_state.chat_history.append(("assistant", "Backend error occurred."))

        except Exception:
            response_text = "Could not connect to backend."
            st.session_state.chat_history.append(("assistant", response_text))

    # Display chat history
    for role, message in st.session_state.chat_history:
        with st.chat_message(role):
            st.markdown(message)