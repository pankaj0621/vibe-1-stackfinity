function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. Add it to .env.local (see .env.example).`
    );
  }
  return value;
}

/** Lazy getter: import time pe throw nahi karta, sirf tab jab DB actually use ho. */
export function getEnv() {
  return {
    MONGODB_URI: required("MONGODB_URI"),
    MONGODB_DB: process.env.MONGODB_DB ?? "mobility",
  };
}
