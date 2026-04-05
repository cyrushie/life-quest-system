function requireEnv(name: keyof NodeJS.ProcessEnv) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required. Add it to your environment before starting the app.`);
  }

  return value;
}

export function getAuthSecret() {
  const secret = requireEnv("AUTH_SECRET");

  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters long in production.");
  }

  return secret;
}
