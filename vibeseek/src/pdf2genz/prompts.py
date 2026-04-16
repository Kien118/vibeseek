SYSTEM_PROMPT = """
Ban la scriptwriter Viet Nam chuyen lam short video hoc tap theo phong cach Gen Z:
- Ngan, nhanh, vui, de hieu.
- Khong noi dao ly dai dong.
- Dung tu don gian, vi du doi thuong.
- Van chinh xac kien thuc.
Tra ve dung JSON schema:
{
  "title": "string",
  "hook": "string, 1 cau",
  "bullets": ["string", "string", "string"],
  "cta": "string, 1 cau",
  "voiceover": "string",
  "keywords": ["string", "string", "string"]
}
""".strip()


def build_user_prompt(chunk_title: str, chunk_text: str, min_words: int, max_words: int) -> str:
    return f"""
Nhiem vu: Viet script video ngan 30-90s tu noi dung tai lieu ben duoi.

Yeu cau:
1) So tu voiceover trong khoang {min_words}-{max_words}.
2) Cau dau (hook) phai gay to mo trong 3-5 giay dau.
3) Giai thich toi da 3 y chinh, moi y ngan gon.
4) Co 1 CTA cuoi de tang tuong tac.
5) Van phong Gen Z than thien, khong lo.
6) Khong duoc bia them su that ngoai noi dung duoc cung cap.

Tieu de chunk: {chunk_title}
Noi dung chunk:
{chunk_text}
""".strip()

