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
    return Response.redirect("/thank-you.html?error=config", 303);
  }

  try {
    // Create a file directly in the submissions directory on main branch
    const fileName = `submission_${sanitizedUser}_${sanitizedRepo}_${Date.now()}.md`;
    const fileRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/submissions/${fileName}`,
      {
        method: "PUT",
        headers: githubHeaders(GITHUB_TOKEN),
        body: JSON.stringify({
          message: `Add submission: ${sanitizedUser}/${sanitizedRepo}`,
          content: btoa(content), // base64 encode
        }),
      }
    );
    
    if (!fileRes.ok) {
      const error = await fileRes.text();
      console.error("Failed to create submission file:", error);
      return Response.redirect("/thank-you.html?error=file", 303);
    }

    const fileData = await fileRes.json();
    console.log("Submission file created successfully:", fileData.content.html_url);

    return Response.redirect("/thank-you.html", 303);
  } catch (error) {
    console.error("Unexpected error:", error);
    return Response.redirect("/thank-you.html?error=unexpected", 303);
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