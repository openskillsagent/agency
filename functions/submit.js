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

  // Check if GITHUB_TOKEN is available
  if (!GITHUB_TOKEN) {
    console.error("GITHUB_TOKEN not configured");
    return new Response("Server configuration error", { status: 500 });
  }

  try {
    // Step 1: Get the SHA of the base branch (main)
    const refRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/git/ref/heads/main`,
      { headers: githubHeaders(GITHUB_TOKEN) }
    );
    
    if (!refRes.ok) {
      const error = await refRes.text();
      console.error("Failed to get main branch ref:", error);
      return new Response("Failed to access repository", { status: 500 });
    }
    
    const refData = await refRes.json();
    const baseSha = refData.object.sha;

    // Step 2: Create a new branch
    const branchName = `submission-${Date.now()}`;
    const branchRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/refs`, {
      method: "POST",
      headers: githubHeaders(GITHUB_TOKEN),
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      }),
    });
    
    if (!branchRes.ok) {
      const error = await branchRes.text();
      console.error("Failed to create branch:", error);
      return new Response("Failed to create submission branch", { status: 500 });
    }

    // Step 3: Create a file on that branch
    const fileName = `repo_addition_${Date.now()}.md`;
    const fileRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/scraper/submissions/${fileName}`,
      {
        method: "PUT",
        headers: githubHeaders(GITHUB_TOKEN),
        body: JSON.stringify({
          message: `New submission: ${sanitizedUser}/${sanitizedRepo}`,
          content: btoa(content), // base64 encode
          branch: branchName,
        }),
      }
    );
    
    if (!fileRes.ok) {
      const error = await fileRes.text();
      console.error("Failed to create file:", error);
      return new Response("Failed to create submission file", { status: 500 });
    }

    // Step 4: Open the pull request
    const prRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/pulls`,
      {
        method: "POST",
        headers: githubHeaders(GITHUB_TOKEN),
        body: JSON.stringify({
          title: `Submission: ${sanitizedUser}/${sanitizedRepo}`,
          head: branchName,
          base: "main",
          body: `New repository submission\n\n**GitHub User:** ${sanitizedUser}\n**Repository:** ${sanitizedRepo}\n**Path:** ${sanitizedPath || '(root)'}\n\nSubmitted via the website form.`,
        }),
      }
    );

    if (!prRes.ok) {
      const error = await prRes.text();
      console.error("Failed to create PR:", error);
      return new Response("Failed to create pull request", { status: 500 });
    }

    const pr = await prRes.json();
    console.log("PR created successfully:", pr.html_url);

    return Response.redirect("/thank-you.html", 303);
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response("An unexpected error occurred", { status: 500 });
  }
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