import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { sendDailyAppointmentReminders } from "@/lib/push/reminders";
import { getVapidConfig } from "@/lib/push/vapid";

export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return false;
  }
  const token = header.slice("Bearer ".length).trim();
  const expected = Buffer.from(secret);
  const provided = Buffer.from(token);
  if (expected.length === 0 || expected.length !== provided.length) {
    return false;
  }
  return timingSafeEqual(expected, provided);
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (!getVapidConfig()) {
    return NextResponse.json({ error: "VAPID lipsește." }, { status: 503 });
  }

  const result = await sendDailyAppointmentReminders();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
