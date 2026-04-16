const owner = process.env.GITHUB_REPO_OWNER!
const repo = process.env.GITHUB_REPO_NAME!
const token = process.env.GITHUB_DISPATCH_TOKEN!

/**
 * Trigger the render-video workflow via repository_dispatch.
 * Throws if GitHub API returns non-204.
 */
export async function triggerRenderVideo(jobId: string): Promise<void> {
  if (!owner || !repo || !token) {
    throw new Error('Missing GITHUB_REPO_OWNER / GITHUB_REPO_NAME / GITHUB_DISPATCH_TOKEN')
  }

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: 'render-video',
      client_payload: { jobId },
    }),
  })

  if (res.status !== 204) {
    const body = await res.text()
    throw new Error(`GitHub dispatch failed: ${res.status} ${body}`)
  }
}
