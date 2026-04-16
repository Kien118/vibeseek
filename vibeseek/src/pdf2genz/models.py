from pydantic import BaseModel, Field


class ScriptCandidate(BaseModel):
    title: str
    hook: str
    bullets: list[str] = Field(default_factory=list)
    cta: str
    voiceover: str
    keywords: list[str] = Field(default_factory=list)


class LessonChunk(BaseModel):
    index: int
    title: str
    text: str

