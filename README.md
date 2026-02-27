# OpenSkills Agency

A minimalistic web application that aggregates agent skills from multiple GitHub repositories into a filterable, sortable table with export feature.

## 🎯 Features

- **Skills Aggregation**: Scrapes SKILL.md files from configured GitHub repositories
- **Filterable Table**: Dropdown filters for creator, category, and license
- **Sortable Columns**: Click headers to sort by any column with visual indicators
- **Auto-Categorization**: AI-powered tagging system (2-5 tags per skill)
- **Trust Metrics**: GitHub stars as trust indicators
- **Responsive Design**: Works on desktop and mobile devices

## 📋 Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

## 🚀 Installation

### Prerequisites

- Python 3.7+
- GitHub Personal Access Token (fine-grained)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/openskillsagent/htdocs.git
   cd agency
   ```

2. **Create a `.env` file**
   ```bash
   echo "GITHUB_TOKEN=your_github_token_here" > .env
   ```

3. **Install Python dependencies**
   ```bash
   cd scraper
   pip install -r requirements.txt
   ```

### GitHub Token Permissions

Create a fine-grained personal access token with these permissions:

**Repository permissions (read-only):**
- ✅ Contents: Read-only
- ✅ Metadata: Read-only
- ✅ Commit statuses: Read-only

**Repository access:**
- Public Repositories (read-only)

## 📖 Usage

### 1. Scrape Skills Data

Run the Python scraper to collect skills from GitHub repositories:

```bash
cd scraper
python scrape_skills.py
```

This will:
- Fetch all SKILL.md files from configured repositories
- Extract metadata (license, commit ID, summary)
- Auto-generate 2-5 tags per skill
- Fetch GitHub stars for trust metrics
- Generate `public/skills-data.json`

### 2. View the Website Locally

```bash
cd public
python -m http.server 8000
```

Then open http://localhost:8000 in your browser.


## 📁 Project Structure

```
agency/
├── .env                       # GitHub token (gitignored)
├── .gitignore                 # Git ignore rules
├── README.md                  # This file
├── scraper/
│   ├── scrape_skills.py       # Main scraper script
│   └── requirements.txt       # Python dependencies
└── public/                    # Deployable frontend
    ├── index.html             # Main page
    ├── styles.css             # Styling
    ├── app.js                 # Table functionality
    ├── skills-data.json       # Generated data (after scraping)
    └── assets/
        └── doghub.png         # Logo

```

## 🎨 Features in Detail

### Filtering

- **Creator Filter**: Filter by GitHub username/organization
- **Category Filter**: Filter by auto-generated tags
- **License Filter**: Filter by license type

### Sorting

Click any column header to sort:
- ↑ Ascending order
- ↓ Descending order

### Data Sources

Skills are collected from: repos.json

## 🔧 Configuration

### Adding New Repositories

Edit `scraper/scrape_skills.py` and `scraper/repos.json` list:

### Customizing Categories

Edit the `CATEGORY_KEYWORDS` dictionary in `scraper/scrape_skills.py`:

```python
CATEGORY_KEYWORDS = {
    'your-category': ['keyword1', 'keyword2', 'keyword3'],
    # Add more categories
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
Especially interested in PRs for repos.json and categories.json

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- All the amazing developers and organizations sharing their agent skills
- The open source community for making this possible

## 📞 Support

For issues and questions, please open an issue on GitHub.

---

**Made with ❤️ by steftux**
