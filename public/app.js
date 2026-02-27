/**
 * OpenSkills Agency - Frontend Application
 * Handles data loading, filtering, and sorting of skills table
 */

class SkillsTable {
    constructor() {
        this.allSkills = [];
        this.filteredSkills = [];
        this.selectedSkills = new Set();
        this.currentSort = { column: null, direction: 'asc' };
        this.filters = {
            creator: '',
            category: '',
            license: ''
        };
        
        this.init();
    }
    
    async init() {
        try {
            await this.loadData();
            this.loadFiltersFromURL();
            this.setupEventListeners();
            this.populateFilters();
            this.setSelectValues();
            this.applyFiltersAndSort();
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to load skills data. Please try again later.');
        }
    }
    
    async loadData() {
        try {
            const response = await fetch('skills-data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.allSkills = await response.json();
            this.filteredSkills = [...this.allSkills];
            
            document.getElementById('total-skills').textContent = 
                `Total Skills: ${this.allSkills.length}`;
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }
    
    setupEventListeners() {
        // Sort by clicking headers
        document.querySelectorAll('th[data-column]').forEach(th => {
            const thContent = th.querySelector('.th-content');
            if (thContent) {
                thContent.addEventListener('click', (e) => {
                    // Don't trigger sort if clicking on select
                    if (e.target.tagName !== 'SELECT') {
                        this.handleSort(th.dataset.column);
                    }
                });
            }
        });
        
        // Filter dropdowns
        document.querySelectorAll('.filter-select').forEach(select => {
            select.addEventListener('change', (e) => {
                this.filters[e.target.dataset.column] = e.target.value;
                this.updateURL();
                this.applyFiltersAndSort();
            });
        });
        
        // Handle browser back/forward buttons
        window.addEventListener('popstate', () => {
            this.loadFiltersFromURL();
            this.setSelectValues();
            this.applyFiltersAndSort();
        });
        
        // Select all checkbox
        document.getElementById('select-all').addEventListener('change', (e) => {
            this.handleSelectAll(e.target.checked);
        });
        
        // Download button
        document.getElementById('download-btn').addEventListener('click', () => {
            this.downloadSelectedSkills();
        });
    }
    
    loadFiltersFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Load filter values from URL parameters
        const creator = urlParams.get('creator');
        const category = urlParams.get('category');
        const license = urlParams.get('license');
        
        if (creator) this.filters.creator = creator;
        if (category) this.filters.category = category;
        if (license) this.filters.license = license;
    }
    
    updateURL() {
        const params = new URLSearchParams();
        
        // Add active filters to URL
        if (this.filters.creator) params.set('creator', this.filters.creator);
        if (this.filters.category) params.set('category', this.filters.category);
        if (this.filters.license) params.set('license', this.filters.license);
        
        // Update URL without reloading the page
        const newURL = params.toString() 
            ? `${window.location.pathname}?${params.toString()}`
            : window.location.pathname;
        
        window.history.pushState({}, '', newURL);
    }
    
    populateFilters() {
        // Populate creator filter
        const creators = [...new Set(this.allSkills.map(s => s.creator))].sort();
        this.populateSelect('creator', creators);
        
        // Populate category filter (all unique tags)
        const allTags = new Set();
        this.allSkills.forEach(skill => {
            skill.category.forEach(tag => allTags.add(tag));
        });
        this.populateSelect('category', [...allTags].sort());
        
        // Populate license filter
        const licenses = [...new Set(this.allSkills.map(s => s.license))].sort();
        this.populateSelect('license', licenses);
    }
    
    populateSelect(column, values) {
        const select = document.querySelector(`.filter-select[data-column="${column}"]`);
        if (!select) return;
        
        values.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });
    }
    
    setSelectValues() {
        // Set the select dropdown values based on current filters
        Object.keys(this.filters).forEach(column => {
            const select = document.querySelector(`.filter-select[data-column="${column}"]`);
            if (select && this.filters[column]) {
                select.value = this.filters[column];
            }
        });
    }
    
    handleSort(column) {
        if (this.currentSort.column === column) {
            // Toggle direction
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // New column
            this.currentSort.column = column;
            this.currentSort.direction = 'asc';
        }
        
        this.updateSortIndicators();
        this.applyFiltersAndSort();
    }
    
    updateSortIndicators() {
        // Clear all indicators
        document.querySelectorAll('.sort-indicator').forEach(indicator => {
            indicator.classList.remove('active', 'asc', 'desc');
        });
        
        // Set active indicator
        if (this.currentSort.column) {
            const th = document.querySelector(`th[data-column="${this.currentSort.column}"]`);
            if (th) {
                const indicator = th.querySelector('.sort-indicator');
                indicator.classList.add('active', this.currentSort.direction);
            }
        }
    }
    
    applyFiltersAndSort() {
        // Apply filters
        this.filteredSkills = this.allSkills.filter(skill => {
            // Creator filter
            if (this.filters.creator && skill.creator !== this.filters.creator) {
                return false;
            }
            
            // Category filter
            if (this.filters.category && !skill.category.includes(this.filters.category)) {
                return false;
            }
            
            // License filter
            if (this.filters.license && skill.license !== this.filters.license) {
                return false;
            }
            
            return true;
        });
        
        // Apply sorting
        if (this.currentSort.column) {
            this.filteredSkills.sort((a, b) => {
                let aVal = a[this.currentSort.column];
                let bVal = b[this.currentSort.column];
                
                // Special handling for arrays (category)
                if (Array.isArray(aVal)) {
                    aVal = aVal.join(', ');
                    bVal = bVal.join(', ');
                }
                
                // Special handling for numbers (trust)
                if (this.currentSort.column === 'trust') {
                    aVal = parseInt(aVal) || 0;
                    bVal = parseInt(bVal) || 0;
                }
                
                // Compare
                let comparison = 0;
                if (aVal > bVal) comparison = 1;
                if (aVal < bVal) comparison = -1;
                
                return this.currentSort.direction === 'asc' ? comparison : -comparison;
            });
        }
        
        this.renderTable();
        this.updateFilteredCount();
    }
    
    renderTable() {
        const tbody = document.getElementById('skills-tbody');
        
        if (this.filteredSkills.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <p>No skills found</p>
                        <small>Try adjusting your filters</small>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = this.filteredSkills.map((skill, index) => `
            <tr>
                <td class="checkbox-column">
                    <input type="checkbox" 
                           class="skill-checkbox" 
                           data-skill-index="${index}"
                           ${this.selectedSkills.has(skill.name) ? 'checked' : ''}>
                </td>
                <td>${this.escapeHtml(skill.creator)}</td>
                <td>
                    ${skill.category.map(tag => 
                        `<span class="tag">${this.escapeHtml(tag)}</span>`
                    ).join('')}
                </td>
                <td>${this.escapeHtml(skill.summary)}</td>
                <td>
                    <a href="${this.escapeHtml(skill.url)}" target="_blank" rel="noopener noreferrer">
                        ${this.escapeHtml(skill.name)}
                    </a>
                </td>
                <td>${this.escapeHtml(skill.license)}</td>
                <td><span class="trust-stars">${this.formatNumber(skill.trust)}</span></td>
            </tr>
        `).join('');
        
        // Add event listeners to checkboxes
        document.querySelectorAll('.skill-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.skillIndex);
                const skill = this.filteredSkills[index];
                this.handleSkillSelection(skill, e.target.checked);
            });
        });
        
        this.updateSelectAllState();
    }
    
    updateFilteredCount() {
        const countEl = document.getElementById('filtered-count');
        if (this.filteredSkills.length !== this.allSkills.length) {
            countEl.textContent = `Showing ${this.filteredSkills.length} of ${this.allSkills.length} skills`;
        } else {
            countEl.textContent = '';
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatNumber(num) {
        return num.toLocaleString();
    }
    
    showError(message) {
        const tbody = document.getElementById('skills-tbody');
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <p style="color: #e74c3c;">⚠️ ${message}</p>
                </td>
            </tr>
        `;
    }
    
    handleSkillSelection(skill, isSelected) {
        if (isSelected) {
            this.selectedSkills.add(skill.name);
        } else {
            this.selectedSkills.delete(skill.name);
        }
        this.updateSelectionUI();
    }
    
    handleSelectAll(isSelected) {
        if (isSelected) {
            // Select all filtered skills
            this.filteredSkills.forEach(skill => {
                this.selectedSkills.add(skill.name);
            });
        } else {
            // Deselect all filtered skills
            this.filteredSkills.forEach(skill => {
                this.selectedSkills.delete(skill.name);
            });
        }
        
        // Update all checkboxes
        document.querySelectorAll('.skill-checkbox').forEach(checkbox => {
            checkbox.checked = isSelected;
        });
        
        this.updateSelectionUI();
    }
    
    updateSelectAllState() {
        const selectAllCheckbox = document.getElementById('select-all');
        const filteredSkillNames = this.filteredSkills.map(s => s.name);
        const selectedFilteredCount = filteredSkillNames.filter(name => 
            this.selectedSkills.has(name)
        ).length;
        
        if (selectedFilteredCount === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (selectedFilteredCount === this.filteredSkills.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }
    
    updateSelectionUI() {
        const count = this.selectedSkills.size;
        document.getElementById('selected-count').textContent = count;
        document.getElementById('download-btn').disabled = count === 0;
        this.updateSelectAllState();
    }
    
    async downloadSelectedSkills() {
        if (this.selectedSkills.size === 0) return;
        
        try {
            const zip = new JSZip();
            
            // Get selected skill objects
            const selectedSkillObjects = this.allSkills.filter(skill => 
                this.selectedSkills.has(skill.name)
            );
            
            // Show progress indicator
            const downloadBtn = document.getElementById('download-btn');
            const originalText = downloadBtn.innerHTML;
            downloadBtn.innerHTML = 'Preparing download...';
            downloadBtn.disabled = true;
            
            // Process skills with rate limiting to avoid 429 errors
            let successCount = 0;
            let failCount = 0;
            
            for (let i = 0; i < selectedSkillObjects.length; i++) {
                const skill = selectedSkillObjects[i];
                const folderName = skill.name;
                const folder = zip.folder(folderName);
                
                // Update progress
                downloadBtn.innerHTML = `Processing ${i + 1}/${selectedSkillObjects.length}...`;
                
                try {
                    // Convert GitHub blob URLs to raw URLs to avoid CORS
                    let fetchUrl = skill.url;
                    if (skill.url.includes('github.com') && skill.url.includes('/blob/')) {
                        fetchUrl = skill.url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
                    }
                    
                    // Fetch the SKILL.md content with timeout
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
                    
                    const response = await fetch(fetchUrl, { 
                        signal: controller.signal,
                        mode: 'cors'
                    });
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        const content = await response.text();
                        folder.file('SKILL.md', content);
                        
                        // Try to fetch LICENSE file
                        const skillDirUrl = fetchUrl.substring(0, fetchUrl.lastIndexOf('/'));
                        let licenseFileName = null;
                        
                        // Check if license mentions a specific LICENSE file (e.g., "LICENSE.txt", "LICENSE.md")
                        const licenseFileMatch = skill.license.match(/LICENSE\.[a-zA-Z0-9]+/i);
                        if (licenseFileMatch) {
                            licenseFileName = licenseFileMatch[0];
                        }
                        
                        // Try to fetch LICENSE file (with or without extension)
                        const licenseFilesToTry = licenseFileName 
                            ? [licenseFileName, 'LICENSE'] 
                            : ['LICENSE', 'LICENSE.txt', 'LICENSE.md'];
                        
                        for (const fileName of licenseFilesToTry) {
                            try {
                                const licenseUrl = `${skillDirUrl}/${fileName}`;
                                const licenseController = new AbortController();
                                const licenseTimeoutId = setTimeout(() => licenseController.abort(), 5000);
                                
                                const licenseResponse = await fetch(licenseUrl, {
                                    signal: licenseController.signal,
                                    mode: 'cors'
                                });
                                clearTimeout(licenseTimeoutId);
                                
                                if (licenseResponse.ok) {
                                    const licenseContent = await licenseResponse.text();
                                    folder.file(fileName, licenseContent);
                                    break; // Successfully fetched, stop trying
                                }
                            } catch (licenseError) {
                                // Try next filename
                                continue;
                            }
                        }
                        
                        successCount++;
                    } else {
                        throw new Error(`HTTP ${response.status}`);
                    }
                } catch (error) {
                    console.warn(`Could not fetch ${skill.name}:`, error.message);
                    // Create a reference file with metadata instead
                    const referenceContent = `# ${skill.name}

## Summary
${skill.summary}

## Details
- **Creator**: ${skill.creator}
- **Category**: ${skill.category.join(', ')}
- **License**: ${skill.license}
- **Trust Score**: ${skill.trust}

## Source
This skill could not be downloaded automatically due to access restrictions.
Please visit the URL below to view and download the skill manually:

${skill.url}

---
*This file was generated by OpenSkills Agency*
`;
                    folder.file('SKILL.md', referenceContent);
                    failCount++;
                }
                
                // Create URL link file (Windows .url format)
                const urlContent = `[InternetShortcut]\nURL=${skill.url}`;
                folder.file(`${skill.name}.url`, urlContent);
                
                // Add a web link file (cross-platform HTML)
                const htmlLinkContent = `<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="refresh" content="0; url=${skill.url}">
    <title>${skill.name}</title>
</head>
<body>
    <p>Redirecting to <a href="${skill.url}">${skill.name}</a>...</p>
</body>
</html>`;
                folder.file(`${skill.name}.html`, htmlLinkContent);
                
                // Rate limiting: add small delay between requests to avoid 429 errors
                if (i < selectedSkillObjects.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
                }
            }
            
            // Generate and download the zip file
            downloadBtn.innerHTML = 'Generating zip file...';
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `openskills-${selectedSkillObjects.length}-skills.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Restore button and show result
            downloadBtn.innerHTML = originalText;
            downloadBtn.disabled = false;
            
            // Show summary
            if (failCount > 0) {
                alert(`Download complete!\n\n✓ ${successCount} skills downloaded successfully\n⚠ ${failCount} skills created as reference files (access restricted)\n\nCheck the SKILL.md files in the zip for details.`);
            }
            
        } catch (error) {
            console.error('Error creating zip file:', error);
            alert('Error creating download. Please try again.');
            
            // Restore button
            const downloadBtn = document.getElementById('download-btn');
            downloadBtn.innerHTML = `Download Selected (<span id="selected-count">${this.selectedSkills.size}</span>)`;
            downloadBtn.disabled = false;
        }
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new SkillsTable();
});
