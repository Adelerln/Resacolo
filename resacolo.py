import os
import sys
import argparse
import textwrap
from typing import List

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from openai import OpenAI


def load_api_key() -> str | None:
    load_dotenv()
    api_key = os.getenv("OPENAI_API_KEY")
    return api_key


def fetch_page_text(url: str, timeout: int = 20) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    }
    resp = requests.get(url, headers=headers, timeout=timeout)
    resp.raise_for_status()
    # Ensure reasonable encoding
    if not resp.encoding:
        resp.encoding = resp.apparent_encoding or "utf-8"
    html = resp.text
    soup = BeautifulSoup(html, "html.parser")
    # Remove non-content tags
    for tag in soup(["script", "style", "noscript", "template", "svg", "header", "footer", "nav"]):
        tag.decompose()
    # Get visible text
    text = soup.get_text(separator="\n")
    # Normalize whitespace
    lines = [line.strip() for line in text.splitlines()]
    chunks = [ln for ln in lines if ln]
    cleaned = "\n".join(chunks)
    # Collapse extra newlines
    return "\n".join([ln for ln in cleaned.splitlines() if ln])


def fetch_many_texts(urls: list[str]) -> tuple[str, list[tuple[str, int]]]:
    """Fetch multiple pages and return merged text and index of chunk boundaries.
    Returns (merged_text, [(url, char_len)]) for optional referencing.
    """
    merged: list[str] = []
    index: list[tuple[str, int]] = []
    for u in urls:
        try:
            t = fetch_page_text(u)
            merged.append(t)
            index.append((u, len(t)))
        except Exception as e:
            merged.append(f"[Erreur lors du chargement de {u}: {e}]")
            index.append((u, 0))
    return ("\n\n".join(merged), index)


def chunk_text(text: str, max_chars: int = 3500) -> List[str]:
    # Split by paragraphs, then accumulate up to max_chars
    paras = [p.strip() for p in text.split("\n") if p.strip()]
    chunks: List[str] = []
    current: List[str] = []
    size = 0
    for p in paras:
        # +1 for newline
        add = len(p) + 1
        if size + add > max_chars and current:
            chunks.append("\n".join(current))
            current = [p]
            size = add
        else:
            current.append(p)
            size += add
    if current:
        chunks.append("\n".join(current))
    return chunks[:4]  # keep it small to control token usage


def answer_about_site(client: OpenAI, urls: list[str], site_text: str, question: str) -> str:
    chunks = chunk_text(site_text)
    # Build a compact prompt that cites the source URL
    messages = [
        {"role": "system", "content": "You are a helpful assistant. Answer based ONLY on the provided site excerpts."},
        {"role": "user", "content": f"Sources:\n" + "\n".join(urls) + f"\nQuestion: {question}"},
    ]
    # Attach chunks as context
    for i, ch in enumerate(chunks, start=1):
        messages.append({"role": "user", "content": f"[EXCERPT {i}]\n{ch}"})

    resp = client.responses.create(
        model="gpt-4.1-mini",
        input=messages,
    )
    return resp.output_text


def summarize_offline(urls: list[str], site_text: str, question: str) -> str:
    """Naive offline summary/QA without any external API.
    - If the question contains keywords, show matching lines.
    - Otherwise, show a brief summary with salient lines.
    """
    lines = [ln.strip() for ln in site_text.splitlines() if ln.strip()]
    # Try to find lines relevant to the question
    tokens = [t.lower() for t in question.split() if len(t) > 2]
    matches: List[str] = []
    if tokens:
        for ln in lines:
            low = ln.lower()
            if any(tok in low for tok in tokens):
                matches.append(ln)
            if len(matches) >= 12:
                break
    # Fallback: take first meaningful lines as a rough summary
    if not matches:
        # Prefer lines that look like headings or contain strong words
        prefer = [
            ln for ln in lines
            if any(k in ln.lower() for k in [
                "séjour", "colonie", "artist", "enfant", "adolescent",
                "téléphone", "politique", "présentation", "conditions",
                "contact", "informat", "catalogue", "thème", "âge",
            ])
        ]
        matches = (prefer[:12] or lines[:12])
    body = "\n".join(matches)
    sources_str = "- " + "\n- ".join(urls)
    return textwrap.dedent(
        f"""
        [OFFLINE] Réponse basée sur le texte extrait de:
        {sources_str}

        {body}
        """
    ).strip()


def main():
    parser = argparse.ArgumentParser(description="Q/R sur https://www.thalie.eu/ avec mode offline")
    parser.add_argument("question", nargs="*", help="Question à poser")
    parser.add_argument("--offline", action="store_true", help="Forcer le mode offline (sans OpenAI)")
    args = parser.parse_args()

    base_url = "https://www.thalie.eu/"
    extra_urls = [
        "https://www.thalie.eu/colonies-sejours-artistiques-stages-toussaint-automne-c102x1452226",
        "https://www.thalie.eu/colonies-stages-danseclassique-ados-automne-enfants-2024-c2x42158543",
        "https://www.thalie.eu/colonie-sejour-stage-theatre-enfants-automne-2024-c2x42158263",
    ]
    urls = [base_url] + extra_urls
    question = " ".join(args.question).strip()
    if not question:
        try:
            question = input("Entrez votre question sur le site (laisser vide pour un résumé): ").strip()
        except EOFError:
            question = ""
        if not question:
            question = "Donne un résumé des informations clés du site."

    try:
        site_text, _ = fetch_many_texts(urls)
    except Exception as e:
        print(f"Erreur de récupération du site: {e}")
        sys.exit(1)

    api_key = load_api_key()
    if args.offline:
        print(summarize_offline(urls, site_text, question))
        return

    if not api_key:
        raise RuntimeError("OPENAI_API_KEY manquante. Ajoutez-la dans .env ou utilisez --offline.")

    client = OpenAI(api_key=api_key)
    answer = answer_about_site(client, urls, site_text, question)
    sources_str = "- " + "\n- ".join(urls)
    print(
        textwrap.dedent(
            f"""
            Réponse (sources):
            {sources_str}

            {answer}
            """
        ).strip()
    )


if __name__ == "__main__":
    main()


