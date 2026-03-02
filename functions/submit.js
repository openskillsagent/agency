// functions/submit.js
export async function onRequestPost(context) {
  const { GITHUB_TOKEN } = context.env;
  const OWNER = "openskillsagent";
  const REPO = "agency";

  const formData = await context.request.formData();
  
  // reject if the hidden "website" field is filled
  const honeypot = formData.get("website");
  if (honeypot) {
    return new Response("Bad Request", { status: 400 });
  }
  
  // Get and validate form fields
  const user = formData.get("user");
  const repo = formData.get("repo");
  const path = formData.get("path") || "";
  
  // Validate required fields
  if (!user || !repo) {
    return new Response("Missing required fields", { status: 400 });
  }
  
  // Sanitize and validate GitHub username (alphanumeric, hyphens, max 39 chars)
  const sanitizedUser = user.toString().trim();
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(sanitizedUser)) {
    return new Response("Invalid GitHub username format", { status: 400 });
  }
  
  // Sanitize and validate repository name (alphanumeric, hyphens, underscores, dots, max 100 chars)
  const sanitizedRepo = repo.toString().trim();
  if (!/^[a-zA-Z0-9._-]{1,100}$/.test(sanitizedRepo)) {
    return new Response("Invalid repository name format", { status: 400 });
  }
  
  // Sanitize path (allow alphanumeric, slashes, hyphens, underscores, dots)
  const sanitizedPath = path.toString().trim().replace(/[^a-zA-Z0-9/_.-]/g, '');
  
  // Create content for the submission file
  const content = `Repository Submission

GitHub User: ${sanitizedUser}
Repository: ${sanitizedRepo}
Path: ${sanitizedPath}
Submitted: ${new Date().toISOString()}`;

  // Step 1: Get the SHA of the base branch (main)
  const refRes = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/git/ref/heads/main`,
    { headers: githubHeaders(GITHUB_TOKEN) }
  );
  const { object: { sha: baseSha } } = await refRes.json();

  // Step 2: Create a new branch
  const branchName = `submission-${Date.now()}`;
  await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/refs`, {
    method: "POST",
    headers: githubHeaders(GITHUB_TOKEN),
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    }),
  });

  // Step 3: Create or update a file on that branch
  await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/submissions/repo_addition_${Date.now()}.md`,
    {
      method: "PUT",
      headers: githubHeaders(GITHUB_TOKEN),
      body: JSON.stringify({
        message: "New submission",
        content: btoa(content), // base64 encode
        branch: branchName,
      }),
    }
  );

  // Step 4: Open the pull request
  const prRes = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/pulls`,
    {
      method: "POST",
      headers: githubHeaders(GITHUB_TOKEN),
      body: JSON.stringify({
        title: "New form submission",
        head: branchName,
        base: "main",
        body: "Submitted via the site.",
      }),
    }
  );

  const pr = await prRes.json();

  if (!prRes.ok) {
    return new Response("Failed to create PR", { status: 500 });
  }

  return Response.redirect("/thank-you.html", 303);
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "cloudflare-pages-function",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}