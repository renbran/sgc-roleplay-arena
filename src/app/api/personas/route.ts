import { NextResponse } from "next/server";
import { PERSONAS, type Persona } from "@/lib/personas";

// Strip the large systemPrompt for list views
interface PersonaSummary {
  id: string;
  name: string;
  title: string;
  company: string;
  location: string;
  age: number;
  nationality: string;
  voiceId: string;
  language: string;
  difficulty: "easy" | "medium" | "hard";
  industry: string;
  avatar: string;
  tags: string[];
  openingLine: string;
  objections: string[];
  winConditions: string[];
  loseConditions: string[];
  personality: string;
  currentSituation: string;
}

function toSummary(p: Persona): PersonaSummary {
  const { systemPrompt, ...rest } = p;
  return rest;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const difficulty = searchParams.get("difficulty");

  if (id) {
    const persona = PERSONAS.find(p => p.id === id);
    if (!persona) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }
    return NextResponse.json(persona);
  }

  let filtered = [...PERSONAS];

  if (difficulty && ["easy", "medium", "hard"].includes(difficulty)) {
    filtered = filtered.filter(p => p.difficulty === difficulty);
  }

  return NextResponse.json(filtered.map(toSummary));
}
