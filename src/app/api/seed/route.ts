import { apiHttpErrorResponse } from "@/lib/api/errors";

export async function POST() {
  return apiHttpErrorResponse(
    "Database reset through the application is disabled. Use the isolated development seed command instead.",
    410,
    { operation: "reset database" }
  );
}
