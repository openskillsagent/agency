#!/usr/bin/env python3
"""
OpenSkills Agency - GitHub Skills Scraper
Scrapes SKILL.md files from multiple GitHub repositories and generates a JSON data file.
"""

import os
import re
import json
from pathlib import Path
from typing import List, Dict, Optional
from collections import Counter
from dotenv import load_dotenv
from github import Github, GithubException
import time

# Load environment variables
load_dotenv(Path(__file__).parent.parent / '.env')
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')

if not GITHUB_TOKEN:
    raise ValueError("GITHUB_TOKEN not found in .env file")

# Initialize GitHub client
g = Github(GITHUB_TOKEN)

# Load repository configurations from repos.json
def load_repos() -> List[Dict]:
    """Load repository configurations from repos.json file."""
    repos_file = Path(__file__).parent / 'repos.json'
    with open(repos_file, 'r', encoding='utf-8') as f:
        return json.load(f)

REPOS = load_repos()

# Common license patterns
LICENSE_PATTERNS = {
    r'\bMIT\b': 'MIT',
    r'\bApache[- ]2\.0\b': 'Apache-2.0',
    r'\bGPL[- ]?3\b': 'GPL-3.0',
    r'\bGPL[- ]?2\b': 'GPL-2.0',
    r'\bBSD[- ]3\b': 'BSD-3-Clause',
    r'\bBSD[- ]2\b': 'BSD-2-Clause',
    r'\bISC\b': 'ISC',
    r'\bMPL[- ]2\.0\b': 'MPL-2.0',
    r'\bCC0\b': 'CC0-1.0',
    r'\bunlicense': 'Unlicense',
}

# Keywords for categorization
CATEGORY_KEYWORDS = {
    'automation': ['automate', 'automation', 'workflow', 'task', 'schedule'],
    'development': ['develop', 'code', 'programming', 'build', 'compile'],
    'testing': ['test', 'testing', 'qa', 'quality', 'validation', 'verify'],
    'deployment': ['deploy', 'deployment', 'release', 'publish', 'production'],
    'documentation': ['document', 'documentation', 'docs', 'readme', 'guide'],
    'analysis': ['analyze', 'analysis', 'inspect', 'review', 'audit'],
    'data-processing': ['data', 'process', 'transform', 'parse', 'extract'],
    'web-development': ['web', 'html', 'css', 'javascript', 'frontend', 'backend'],
    'security': ['security', 'secure', 'auth', 'authentication', 'encryption'],
    'monitoring': ['monitor', 'monitoring', 'observe', 'track', 'alert'],
    'ai': ['ai', 'artificial intelligence', 'machine learning', 'ml', 'llm', 'agent'],
    'database': ['database', 'sql', 'query', 'db', 'postgres', 'mysql'],
    'api': ['api', 'rest', 'graphql', 'endpoint', 'service'],
    'git': ['git', 'github', 'version control', 'commit', 'branch'],
    'cloud': ['cloud', 'aws', 'azure', 'gcp', 'kubernetes', 'docker'],
}


def extract_license_from_frontmatter(content: str) -> Optional[str]:
    """Extract license from YAML frontmatter."""
    frontmatter_match = re.match(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL)
    if frontmatter_match:
        frontmatter = frontmatter_match.group(1)
        # Look for license field in YAML frontmatter
        license_match = re.search(r'^license:\s*(.+?)$', frontmatter, re.MULTILINE)
        if license_match:
            license_info = license_match.group(1).strip()
            # Remove quotes if present
            license_info = license_info.strip('"\'')
            if license_info:
                return license_info
    return None


def extract_license_from_file(repo, skill_dir_path: str) -> Optional[str]:
    """Extract license from LICENSE file in skill directory."""
    try:
        # Get contents of the skill directory
        dir_contents = repo.get_contents(skill_dir_path)
        
        # Look for LICENSE files
        for item in dir_contents:
            if item.type == "file" and item.name.upper().startswith("LICENSE"):
                # Read the LICENSE file
                license_content = item.decoded_content.decode('utf-8')
                
                # Get first line or first meaningful content
                first_line = license_content.strip().split('\n')[0].strip()
                
                # If it's a short file (< 200 chars), use the whole content
                if len(license_content.strip()) < 200:
                    return license_content.strip()
                
                # Otherwise, return a summary with the first line
                return first_line
                
    except Exception:
        pass
    
    return None


def extract_license(content: str, repo, skill_dir_path: str, repo_license: Optional[str] = None) -> str:
    """Extract license information from multiple sources."""
    # 1. Check YAML frontmatter first
    frontmatter_license = extract_license_from_frontmatter(content)
    if frontmatter_license:
        return frontmatter_license
    
    # 2. Check for LICENSE file in skill directory
    file_license = extract_license_from_file(repo, skill_dir_path)
    if file_license:
        return file_license
    
    # 3. Check content for license patterns
    for pattern, license_name in LICENSE_PATTERNS.items():
        if re.search(pattern, content, re.IGNORECASE):
            return license_name
    
    # 4. Fall back to repository license
    if repo_license:
        return repo_license
    
    return "Unknown"


def generate_summary(content: str, max_length: int = 150) -> str:
    """Generate a summary from SKILL.md content."""
    # Check for YAML frontmatter with description field
    frontmatter_match = re.match(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL)
    if frontmatter_match:
        frontmatter = frontmatter_match.group(1)
        # Look for description field in YAML frontmatter
        desc_match = re.search(r'^description:\s*(.+?)$', frontmatter, re.MULTILINE)
        if desc_match:
            description = desc_match.group(1).strip()
            # Remove quotes if present
            description = description.strip('"\'')
            if description and len(description) > 10:
                return description
    
    # Remove markdown headers and code blocks
    content = re.sub(r'^#+\s+', '', content, flags=re.MULTILINE)
    content = re.sub(r'```[\s\S]*?```', '', content)
    
    # Get first meaningful paragraph
    paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
    
    for para in paragraphs:
        # Skip very short paragraphs or those that look like metadata
        if len(para) > 30 and not para.startswith(('---', '<!--', '{')):
            # Clean up and truncate
            summary = ' '.join(para.split())
            if len(summary) > max_length:
                summary = summary[:max_length].rsplit(' ', 1)[0] + '...'
            return summary
    
    # Fallback
    return "No description available"


def categorize_skill(name: str, content: str, max_tags: int = 5) -> List[str]:
    """Auto-generate tags based on skill name and content."""
    text = (name + ' ' + content).lower()
    
    # Count keyword matches
    tag_scores = Counter()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                tag_scores[category] += text.count(keyword)
    
    # Get top tags
    tags = [tag for tag, _ in tag_scores.most_common(max_tags)]
    
    # Ensure at least 2 tags
    if len(tags) < 2:
        tags.extend(['general', 'utility'])
    
    return tags[:max_tags]


def find_skill_files(repo, base_path: str, is_wildcard: bool = False) -> List[Dict]:
    """Find all SKILL.md files in a repository path."""
    skills = []
    
    try:
        if is_wildcard:
            # Handle wildcard paths like plugins/*/skills
            parts = base_path.split('/*/')
            if len(parts) == 2:
                parent_path, child_path = parts
                try:
                    contents = repo.get_contents(parent_path)
                    for item in contents:
                        if item.type == "dir":
                            skill_path = f"{parent_path}/{item.name}/{child_path}"
                            skills.extend(find_skill_files(repo, skill_path, False))
                except GithubException:
                    pass
            return skills
        
        # Regular path handling
        try:
            contents = repo.get_contents(base_path)
        except GithubException:
            print(f"  ⚠️  Path not found: {base_path}")
            return skills
        
        # Process contents
        if not isinstance(contents, list):
            contents = [contents]
        
        for content in contents:
            if content.type == "dir":
                # Check if this directory contains SKILL.md
                try:
                    dir_contents = repo.get_contents(content.path)
                    for file in dir_contents:
                        if file.name.upper() == "SKILL.MD":
                            skills.append({
                                'name': content.name,
                                'path': file.path,
                                'file': file
                            })
                            break
                except GithubException:
                    pass
    
    except Exception as e:
        print(f"  ❌ Error processing path {base_path}: {e}")
    
    return skills


def scrape_repository(repo_config: Dict) -> List[Dict]:
    """Scrape skills from a single repository."""
    owner = repo_config['owner']
    repo_name = repo_config['repo']
    path = repo_config['path']
    
    print(f"\n📦 Processing {owner}/{repo_name}")
    
    try:
        repo = g.get_repo(f"{owner}/{repo_name}")
        
        # Get repository metadata
        stars = repo.stargazers_count
        repo_license = repo.license.spdx_id if repo.license else None
        
        print(f"  ⭐ Stars: {stars}")
        print(f"  📄 License: {repo_license or 'Unknown'}")
        
        # Find skill files
        is_wildcard = '/*/' in path
        skill_files = find_skill_files(repo, path, is_wildcard)
        
        print(f"  📝 Found {len(skill_files)} skills")
        
        skills_data = []
        
        for skill_info in skill_files:
            try:
                skill_name = skill_info['name']
                skill_file = skill_info['file']
                
                # Get file content
                content = skill_file.decoded_content.decode('utf-8')
                
                # Get latest commit for this file
                commits = repo.get_commits(path=skill_file.path)
                latest_commit = commits[0].sha[:7] if commits.totalCount > 0 else "unknown"
                
                # Get skill directory path (parent directory of SKILL.md)
                skill_dir_path = '/'.join(skill_file.path.split('/')[:-1])
                
                # Extract metadata
                license_info = extract_license(content, repo, skill_dir_path, repo_license)
                summary = generate_summary(content)
                tags = categorize_skill(skill_name, content)
                
                # Build skill data
                skill_data = {
                    'name': skill_name,
                    'creator': owner,
                    'category': tags,
                    'summary': summary,
                    'url': skill_file.html_url,
                    'license': license_info,
                    'trust': stars,
                    'version': latest_commit,
                    'repo': f"{owner}/{repo_name}"
                }
                
                skills_data.append(skill_data)
                print(f"    ✓ {skill_name}")
                
                # Rate limiting protection
                time.sleep(0.1)
                
            except Exception as e:
                print(f"    ✗ Error processing {skill_info['name']}: {e}")
        
        return skills_data
        
    except GithubException as e:
        print(f"  ❌ Repository error: {e}")
        return []
    except Exception as e:
        print(f"  ❌ Unexpected error: {e}")
        return []


def main():
    """Main scraper function."""
    print("=" * 60)
    print("OpenSkills Agency - GitHub Skills Scraper")
    print("=" * 60)
    
    all_skills = []
    
    for repo_config in REPOS:
        skills = scrape_repository(repo_config)
        all_skills.extend(skills)
        time.sleep(0.5)  # Be nice to GitHub API
    
    print("\n" + "=" * 60)
    print(f"✅ Total skills collected: {len(all_skills)}")
    print("=" * 60)
    
    # Save to JSON
    output_path = Path(__file__).parent.parent / 'public' / 'skills-data.json'
    output_path.parent.mkdir(exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_skills, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Data saved to: {output_path}")
    print(f"📊 File size: {output_path.stat().st_size / 1024:.2f} KB")
    
    # Print statistics
    print("\n📈 Statistics:")
    print(f"  - Unique creators: {len(set(s['creator'] for s in all_skills))}")
    print(f"  - Unique licenses: {len(set(s['license'] for s in all_skills))}")
    
    # Top categories
    all_tags = []
    for skill in all_skills:
        all_tags.extend(skill['category'])
    tag_counts = Counter(all_tags)
    print(f"  - Top categories: {', '.join(f'{tag}({count})' for tag, count in tag_counts.most_common(5))}")


if __name__ == '__main__':
    main()
