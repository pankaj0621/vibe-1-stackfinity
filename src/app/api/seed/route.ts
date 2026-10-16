import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Database reset through the application is disabled. Use the isolated development seed command instead.",
    },
    { status: 410 }
  );
}
