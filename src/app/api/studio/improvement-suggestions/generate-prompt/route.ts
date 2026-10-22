import { studioMutation } from "@/lib/studio/mutation";
import { NextResponse } from "next/server";
import { generatePromptSuggestion } from "@/lib/studio/engine";
import { getAnnotations, getEvaluationResults, getServiceRatings } from "@/lib/studio/store";

export const runtime = "nodejs";

async function postHandler(req: Request) {
  try {
    const payload = await req.json().catch(() => ({}));
    const [annotations, results, ratings] = await Promise.all([getAnnotations(), getEvaluationResults(), getServiceRatings()]);
    const lowQuality = annotations.filter(item => Object.values(item.qualityDimensions || {}).some(value => value.score <= 2)).slice(0, 20);
    const badResults = results.filter(item => !item.passed).slice(0, 20);
    const lowRatings = ratings.filter(item => item.score <= 2).slice(0, 20);
    return NextResponse.json({ suggestion: await generatePromptSuggestion({ focus: payload.focus || "", lowQuality, badResults, lowRatings }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) { return studioMutation(req, () => postHandler(req)); }
