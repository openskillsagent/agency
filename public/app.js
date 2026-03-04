const { createApp } = Vue;

createApp({
    data() {
        return {
            skills: [],
            loading: true,
            selectedSkills: new Set(),
            formData: {
                user: '',
                repo: '',
                path: ''
            },
            filters: {
                creator: '',
                category: '',
                license: ''
            },
            currentSort: {
                column: 'trust',
                direction: 'desc'
            }
        };
    },
    computed: {
        filteredSkills() {
            let filtered = [...this.skills];

            if (this.filters.creator) {
                filtered = filtered.filter(skill => skill.creator === this.filters.creator);
            }
            if (this.filters.category) {
                filtered = filtered.filter(skill => skill.category.includes(this.filters.category));
            }
            if (this.filters.license) {
                filtered = filtered.filter(skill => skill.license === this.filters.license);
            }

            return filtered;
        },
        displayedSkills() {
            const sorted = [...this.filteredSkills];
            const { column, direction } = this.currentSort;

            sorted.sort((a, b) => {
                let aVal, bVal;

                switch (column) {
                    case 'category':
                        aVal = a.category[0] || '';
                        bVal = b.category[0] || '';
                        break;
                    case 'cisco-ai-skill-scanner':
                        aVal = this.getCiscoScore(a);
                        bVal = this.getCiscoScore(b);
                        break;
                    case 'snyk-scanner':
                        aVal = this.getSnykScore(a);
                        bVal = this.getSnykScore(b);
                        break;
                    default:
                        aVal = a[column] || '';
                        bVal = b[column] || '';
                }

                if (typeof aVal === 'string') {
                    return direction === 'asc' 
                        ? aVal.localeCompare(bVal)
                        : bVal.localeCompare(aVal);
                } else {
                    return direction === 'asc' 
                        ? aVal - bVal
                        : bVal - aVal;
                }
            });

            return sorted;
        },
        uniqueCreators() {
            return [...new Set(this.skills.map(s => s.creator))].sort();
        },
        uniqueCategories() {
            const cats = new Set();
            this.skills.forEach(s => s.category.forEach(c => cats.add(c)));
            return [...cats].sort();
        },
        uniqueLicenses() {
            return [...new Set(this.skills.map(s => s.license))].sort();
        },
        statsText() {
            return `Skills by ${this.uniqueCreators.length} creators, with ${this.uniqueCategories.length} different categories and ${this.uniqueLicenses.length} licenses.`;
        },
        filteredCount() {
            const total = this.skills.length;
            const filtered = this.filteredSkills.length;
            return filtered < total ? `Showing ${filtered} of ${total} skills` : '';
        },
        isAllSelected() {
            return this.displayedSkills.length > 0 && 
                   this.displayedSkills.every(skill => this.selectedSkills.has(skill.name));
        },
        isIndeterminate() {
            const selectedCount = this.displayedSkills.filter(skill => 
                this.selectedSkills.has(skill.name)
            ).length;
            return selectedCount > 0 && selectedCount < this.displayedSkills.length;
        }
    },
    methods: {
        async loadSkills() {
            try {
                const response = await fetch('skills-data.json');
                this.skills = await response.json();
                this.loading = false;
            } catch (error) {
                console.error('Error loading skills:', error);
                this.loading = false;
            }
        },
        async handleSubmit() {
            const honeypot = document.querySelector('input[name="website"]').value;
            if (honeypot) {
                console.log('Bot detected');
                return;
            }

            const formData = new FormData();
            formData.append('user', this.formData.user);
            formData.append('repo', this.formData.repo);
            formData.append('path', this.formData.path);

            try {
                const response = await fetch('/.netlify/functions/submit', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    window.location.href = 'thank_you.html';
                } else {
                    alert('Submission failed. Please try again.');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred. Please try again.');
            }
        },
        toggleSkill(skillName) {
            if (this.selectedSkills.has(skillName)) {
                this.selectedSkills.delete(skillName);
            } else {
                this.selectedSkills.add(skillName);
            }
            this.selectedSkills = new Set(this.selectedSkills);
        },
        toggleSelectAll() {
            if (this.isAllSelected) {
                this.displayedSkills.forEach(skill => {
                    this.selectedSkills.delete(skill.name);
                });
            } else {
                this.displayedSkills.forEach(skill => {
                    this.selectedSkills.add(skill.name);
                });
            }
            this.selectedSkills = new Set(this.selectedSkills);
        },
        sortBy(column) {
            if (this.currentSort.column === column) {
                this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                this.currentSort.column = column;
                this.currentSort.direction = 'asc';
            }
        },
        getSortIcon(column) {
            if (this.currentSort.column !== column) return '↕';
            return this.currentSort.direction === 'asc' ? '↑' : '↓';
        },
        applyFilters() {
            // Filters are reactive, no need for explicit action
        },
        formatNumber(num) {
            return num.toLocaleString();
        },
        getCiscoScore(skill) {
            const scanner = skill['security-scanners']?.['cisco-ai-defense'];
            if (!scanner) return -1;
            if (scanner.error) return -2;
            if (scanner.is_safe === true) return 1;
            if (scanner.is_safe === false) return 0;
            return -1;
        },
        getSnykScore(skill) {
            const scanner = skill['security-scanners']?.snyk;
            if (!scanner) return -1;
            if (scanner.error) return -2;
            const sum = (scanner.is_public_sink || 0) + 
                       (scanner.destructive || 0) + 
                       (scanner.untrusted_content || 0) + 
                       (scanner.private_data || 0);
            return sum === 0 ? 1 : 0;
        },
        getCiscoScannerResult(skill) {
            const scanner = skill['security-scanners']?.['cisco-ai-defense'];
            if (!scanner) {
                return '<span class="text-gray-500 text-xs">not scanned</span>';
            }
            if (scanner.error) {
                return `<span class="text-yellow-500 text-xs" title="${scanner.error}">⚠️ error</span>`;
            }
            if (scanner.is_safe === true) {
                return '<span class="text-green-400 text-2xl" title="Safe">✓</span>';
            }
            if (scanner.is_safe === false) {
                const findingsText = scanner.findings?.map(f => f.severity || '').join(', ') || '';
                return `<span class="text-red-500 text-2xl" title="Findings: ${findingsText}">✗</span>`;
            }
            return '<span class="text-gray-500 text-xs">unknown</span>';
        },
        getSnykScannerResult(skill) {
            const scanner = skill['security-scanners']?.snyk;
            if (!scanner) {
                return '<span class="text-gray-500 text-xs">not scanned</span>';
            }
            if (scanner.error) {
                return `<span class="text-yellow-500 text-xs" title="${scanner.error}">⚠️ error</span>`;
            }

            const checks = {
                is_public_sink: scanner.is_public_sink || 0,
                destructive: scanner.destructive || 0,
                untrusted_content: scanner.untrusted_content || 0,
                private_data: scanner.private_data || 0
            };

            const allSafe = Object.values(checks).every(v => v === 0);
            
            if (allSafe) {
                return '<span class="text-green-400 text-2xl" title="All checks passed">✓</span>';
            }

            const failedChecks = Object.entries(checks)
                .filter(([_, v]) => v !== 0)
                .map(([k, _]) => k)
                .join(', ');

            return `<span class="text-red-500 text-2xl" title="Failed: ${failedChecks}">✗</span>`;
        },
        async downloadSelected() {
            if (this.selectedSkills.size === 0) return;

            const selectedData = this.skills.filter(skill => 
                this.selectedSkills.has(skill.name)
            );

            const zip = new JSZip();

            for (const skill of selectedData) {
                try {
                    const skillUrl = skill.url;
                    const rawUrl = skillUrl.replace('/blob/', '/raw/');
                    
                    const response = await fetch(rawUrl);
                    if (!response.ok) continue;
                    
                    const content = await response.text();
                    
                    const pathParts = skillUrl.split('/');
                    const fileName = pathParts[pathParts.length - 1];
                    const folderName = skill.name;
                    
                    zip.file(`${folderName}/${fileName}`, content);
                } catch (error) {
                    console.error(`Error downloading ${skill.name}:`, error);
                }
            }

            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'selected-skills.zip';
            a.click();
            URL.revokeObjectURL(url);
        }
    },
    mounted() {
        this.loadSkills();
    }
}).mount('#app');
