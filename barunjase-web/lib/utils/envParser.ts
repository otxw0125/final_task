export function parseJsonEnvVariable<T>(envVar: string | undefined, defaultValue: T): T {
  // console.log(`[parseJsonEnvVariable] Parsing env var: ${envVar}`); // 필요한 경우 로그 활성화
  if (envVar) {
    try {
      return JSON.parse(envVar) as T;
    } catch (error) {
      console.warn(`[parseJsonEnvVariable] Failed to parse JSON for env var. Using default. Error: ${error}, EnvVar: ${envVar}`);
      return defaultValue;
    }
  }
  return defaultValue;
} 