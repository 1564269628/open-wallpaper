export function getRepositoryParts() {
  const value = process.env.GITHUB_REPOSITORY || "";
  const [owner, repo] = value.split("/");
  if (!owner || !repo) {
    throw new Error("GITHUB_REPOSITORY must be in owner/repo format");
  }
  return { owner, repo };
}

export function getToken() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required");
  return token;
}

export async function graphql(query, variables = {}) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      "User-Agent": "open-wallpaper-actions"
    },
    body: JSON.stringify({ query, variables })
  });

  const payload = await response.json();
  if (!response.ok || payload.errors) {
    throw new Error(`GitHub GraphQL error: ${JSON.stringify(payload.errors || payload)}`);
  }
  return payload.data;
}

export async function rest(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "open-wallpaper-actions",
      ...(options.headers || {})
    }
  });

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`GitHub REST ${response.status}: ${JSON.stringify(payload)}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}
