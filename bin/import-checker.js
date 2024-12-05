#!/usr/bin/env node
/* eslint-disable no-use-before-define */

const { program } = require("commander");
const chalk = require("chalk");
const path = require("path");
const fs = require("fs-extra");
const { analyzeImports } = require("../lib/import-analyzer");

function analyzeSiblingDirectories(parentDir, options) {
  if (!fs.existsSync(parentDir)) {
    console.error(chalk.red(`Directory not found: ${parentDir}`));
    return;
  }

  // Create reports directory with parent directory name
  const parentDirName = path.basename(parentDir);
  const reportsBaseDir = path.join(
    process.cwd(),
    `import-analysis-${parentDirName}`,
  );
  fs.ensureDirSync(reportsBaseDir);

  // Get all immediate subdirectories
  const directories = fs.readdirSync(parentDir).filter((dir) => {
    const fullPath = path.join(parentDir, dir);
    return fs.statSync(fullPath).isDirectory();
  });

  console.log(
    chalk.blue(`Found ${directories.length} directories in ${parentDir}`),
  );

  const allReports = [];

  // Analyze each directory
  directories.forEach((dir) => {
    const targetDir = path.join(parentDir, dir);
    console.log(chalk.yellow(`\nAnalyzing directory: ${dir}`));

    try {
      // Create directory for this report
      const reportDir = path.join(reportsBaseDir, dir);
      fs.ensureDirSync(reportDir);

      const baseName = `import-analysis`;

      const imports = analyzeImports(targetDir, {
        generateHtml: options.html,
        reportNamePrefix: baseName,
        outputDir: reportDir,
      });

      allReports.push({
        directory: dir,
        reportPath: path.join(dir, `${baseName}.html`),
        importCount: imports.length,
      });

      if (imports.length === 0) {
        console.log(chalk.green(`✓ No cross-feature imports found in ${dir}`));
        return;
      }

      if (!options.html) {
        console.log(chalk.yellow(`\nFound cross-directory imports in ${dir}:`));
        imports.forEach((importPath) => {
          console.log(chalk.red(`• ${importPath}`));
        });
      }

      console.log(chalk.blue(`\nGenerated reports in: ${reportDir}`));
    } catch (error) {
      console.error(chalk.red(`Error analyzing ${dir}:`, error.message));
    }
  });

  // Generate main dashboard
  if (options.html) {
    generateMainDashboard(reportsBaseDir, allReports, parentDirName);
    console.log(
      chalk.blue(
        `\nGenerated main dashboard: ${path.join(reportsBaseDir, "index.html")}`,
      ),
    );
  }
}

function generateMainDashboard(baseDir, reports, parentDirName) {
  const template = `
    <!DOCTYPE html>
    <html class="dark">
    <head>
      <title>Import Analysis Dashboard - ${parentDirName}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <script src="https://d3js.org/d3.v7.min.js"></script>
      <script>
        tailwind.config = {
          darkMode: 'class',
          theme: {
            extend: {
              colors: {
                'dark-nav': '#0A0A0A',
                'dark-bg': '#111111'
              }
            }
          }
        }
      </script>
    </head>
    <body class="bg-dark-bg text-gray-200">
      <div class="flex h-screen">
        <!-- Tabs -->
        <div class="w-80 bg-dark-nav p-6 border-r border-gray-800 overflow-y-auto">
          <h1 class="text-2xl font-bold mb-6 text-white">${parentDirName} Analysis</h1>
          <div class="mb-4 border-b border-gray-700">
            <ul class="flex flex-wrap -mb-px text-sm font-medium">
              <li class="mr-2">
                <a href="#" class="tab-btn active inline-block p-4 rounded-t-lg border-b-2 border-blue-500 text-blue-500" data-tab="list">Directory List</a>
              </li>
              <li class="mr-2">
                <a href="#" class="tab-btn inline-block p-4 rounded-t-lg border-b-2 border-transparent hover:text-gray-300 hover:border-gray-300" data-tab="graph">Graph View</a>
              </li>
            </ul>
          </div>
          
          <!-- Directory List -->
          <div id="listView" class="tab-content">
            ${reports
              .map(
                (report) => `
              <div class="directory-item mb-2 group" onclick="showReport('${report.reportPath}')">
                <div class="flex items-center justify-between p-3 rounded-lg bg-gray-900 hover:bg-gray-800 cursor-pointer transition-colors">
                  <span class="text-gray-200">${report.directory}</span>
                  ${
                    report.importCount > 0
                      ? `<span class="px-2 py-1 text-xs rounded-full bg-red-500 text-white">
                      ${report.importCount}
                    </span>`
                      : ""
                  }
                </div>
              </div>
            `,
              )
              .join("")}
          </div>

          <!-- Graph Legend -->
          <div id="graphView" class="tab-content hidden">
            <div class="bg-gray-900 p-4 rounded-lg">
              <h3 class="text-sm font-medium mb-2">Legend</h3>
              <div class="flex items-center mb-2">
                <div class="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                <span class="text-sm">Directory</span>
              </div>
              <div class="text-xs text-gray-400 mt-2">
                • Drag nodes to rearrange<br>
                • Click connections to see imports<br>
                • Click directory to view details
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content Area -->
        <div class="flex-1 relative">
          <div id="reportFrame" class="w-full h-full"></div>
          <div id="graphContainer" class="hidden w-full h-full"></div>
        </div>
      </div>

      <!-- Import Details Modal -->
      <div id="importModal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50">
        <div class="bg-dark-nav rounded-lg max-w-2xl mx-auto mt-10 p-6 relative max-h-[calc(100vh-50px)] overflow-hidden flex flex-col">
          <button class="close absolute top-4 right-4 text-gray-400 hover:text-white">&times;</button>
          <h2 class="text-xl font-bold mb-4">Import Details</h2>
          <div id="modalContent" class="overflow-y-auto"></div>
        </div>
      </div>

      <script>
        const graphData = ${JSON.stringify(prepareGraphData(reports, baseDir))};

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = btn.dataset.tab;
            
            // Update button states
            document.querySelectorAll('.tab-btn').forEach(b => {
              b.classList.remove('active', 'border-blue-500', 'text-blue-500');
              b.classList.add('border-transparent');
            });
            btn.classList.add('active', 'border-blue-500', 'text-blue-500');
            
            // Show/hide content
            document.querySelectorAll('.tab-content').forEach(content => {
              content.classList.add('hidden');
            });
            document.getElementById(tabId + 'View').classList.remove('hidden');

            // Show/hide main content
            if (tabId === 'graph') {
              document.getElementById('reportFrame').classList.add('hidden');
              document.getElementById('graphContainer').classList.remove('hidden');
              if (!window.graphInitialized) {
                initializeGraph();
                window.graphInitialized = true;
              }
            } else {
              document.getElementById('reportFrame').classList.remove('hidden');
              document.getElementById('graphContainer').classList.add('hidden');
            }
          });
        });

        function showReport(path) {
          document.getElementById('reportFrame').innerHTML = \`<iframe src="\${path}" class="w-full h-full border-0"></iframe>\`;
        }

        function initializeGraph() {
          const width = document.getElementById('graphContainer').clientWidth;
          const height = document.getElementById('graphContainer').clientHeight;

          const svg = d3.select('#graphContainer')
            .append('svg')
            .attr('width', width)
            .attr('height', height);

          const simulation = d3.forceSimulation(graphData.nodes)
            .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(150))
            .force('charge', d3.forceManyBody().strength(-500))
            .force('center', d3.forceCenter(width / 2, height / 2));

          // Add arrow marker
          svg.append('defs').selectAll('marker')
            .data(['end'])
            .join('marker')
            .attr('id', 'arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 25)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('fill', '#4B5563')
            .attr('d', 'M0,-5L10,0L0,5');

          // Add hover labels group
          const labelGroup = svg.append('g')
            .attr('class', 'hover-labels')
            .style('pointer-events', 'none');

          const link = svg.append('g')
            .selectAll('line')
            .data(graphData.links)
            .join('line')
            .attr('stroke', '#4B5563')
            .attr('stroke-width', 3)
            .attr('marker-end', 'url(#arrow)')
            .attr('class', 'cursor-pointer')
            .on('mouseover', showLinkLabel)
            .on('mouseout', hideLinkLabel)
            .on('click', showLinkDetails);

          const node = svg.append('g')
            .selectAll('circle')
            .data(graphData.nodes)
            .join('circle')
            .attr('r', d => d.importCount > 0 ? 10 : 8)
            .attr('fill', '#60A5FA')
            .call(drag(simulation))
            .on('click', showDirectoryReport);

          const label = svg.append('g')
            .selectAll('text')
            .data(graphData.nodes)
            .join('text')
            .text(d => d.name)
            .attr('font-size', '12px')
            .attr('fill', '#D1D5DB')
            .attr('dx', 15)
            .attr('dy', 4);

          // Add hover label functions
          function showLinkLabel(event, d) {
            const midX = (d.source.x + d.target.x) / 2;
            const midY = (d.source.y + d.target.y) / 2;
            
            labelGroup.append('rect')
              .attr('class', 'hover-label-bg')
              .attr('x', midX)
              .attr('y', midY - 10)
              .attr('rx', 4)
              .attr('ry', 4)
              .attr('fill', '#1F2937')
              .attr('stroke', '#374151')
              .attr('stroke-width', 1);

            const text = labelGroup.append('text')
              .attr('class', 'hover-label')
              .attr('x', midX)
              .attr('y', midY)
              .attr('text-anchor', 'middle')
              .attr('dominant-baseline', 'middle')
              .attr('fill', '#E5E7EB')
              .attr('font-size', '12px')
              .text(\`\${d.imports.length} import\${d.imports.length > 1 ? 's' : ''}\`);

            // Adjust background rectangle to fit text
            const bbox = text.node().getBBox();
            labelGroup.select('.hover-label-bg')
              .attr('x', bbox.x - 6)
              .attr('y', bbox.y - 4)
              .attr('width', bbox.width + 12)
              .attr('height', bbox.height + 8);
          }

          function hideLinkLabel() {
            labelGroup.selectAll('*').remove();
          }

          simulation.on('tick', () => {
            link
              .attr('x1', d => d.source.x)
              .attr('y1', d => d.source.y)
              .attr('x2', d => d.target.x)
              .attr('y2', d => d.target.y);

            node
              .attr('cx', d => d.x)
              .attr('cy', d => d.y);

            label
              .attr('x', d => d.x)
              .attr('y', d => d.y);

            // Update hover labels positions if they exist
            labelGroup.selectAll('.hover-label, .hover-label-bg').each(function() {
              const label = d3.select(this);
              const d = d3.select(this.parentNode).datum();
              if (d) {
                const midX = (d.source.x + d.target.x) / 2;
                const midY = (d.source.y + d.target.y) / 2;
                if (label.classed('hover-label')) {
                  label.attr('x', midX).attr('y', midY);
                } else {
                  const textBBox = labelGroup.select('.hover-label').node().getBBox();
                  label
                    .attr('x', textBBox.x - 6)
                    .attr('y', textBBox.y - 4)
                    .attr('width', textBBox.width + 12)
                    .attr('height', textBBox.height + 8);
                }
              }
            });
          });

          function showDirectoryReport(event, d) {
            showReport(\`\${d.name}/import-analysis.html\`);
            document.querySelector('[data-tab="list"]').click();
          }

          function showLinkDetails(event, d) {
            event.stopPropagation();
            const modal = document.getElementById('importModal');
            const modalContent = document.getElementById('modalContent');
            
            modalContent.innerHTML = \`
              <div class="bg-gray-900 p-4 rounded">
                <div class="mb-4">
                  <div class="text-lg font-medium text-blue-400 mb-1">Directory Relationship</div>
                  <div class="bg-gray-800 p-3 rounded">
                    <div class="mb-2">
                      <strong class="text-blue-400">From:</strong> \${d.source.name}
                    </div>
                    <div>
                      <strong class="text-blue-400">To:</strong> \${d.target.name}
                    </div>
                  </div>
                </div>

                <div class="mb-4">
                  <div class="text-lg font-medium text-blue-400 mb-1">Affected Files</div>
                  <div class="bg-gray-800 p-3 rounded space-y-4">
                    \${d.imports.map(imp => {
                      const fileUrl = \`vscode://file/\${imp.absolutePath}\`;
                      return \`
                        <div class="border-l-2 border-gray-700 pl-3">
                          <div class="text-sm text-gray-300">
                            <div class="font-medium text-white mb-1">\${imp.absolutePath.split('/').pop()}</div>
                            <div class="mb-1">
                              <span class="text-gray-400">Importing from:</span> \${imp.importPath}
                            </div>
                            <div class="mb-2">
                              <span class="text-gray-400">Imported items:</span>
                              <ul class="list-disc pl-4 mt-1 space-y-1">
                                \${imp.importedItems.map(item => \`<li>\${item}</li>\`).join('')}
                              </ul>
                            </div>
                            <button class="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors" 
                              onclick="window.location.href='\${fileUrl}'">
                              Open in Editor
                            </button>
                          </div>
                        </div>
                      \`;
                    }).join('')}
                  </div>
                </div>
              </div>
            \`;
            
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
          }

          function drag(simulation) {
            function dragstarted(event) {
              if (!event.active) simulation.alphaTarget(0.3).restart();
              event.subject.fx = event.subject.x;
              event.subject.fy = event.subject.y;
            }
            
            function dragged(event) {
              event.subject.fx = event.x;
              event.subject.fy = event.y;
            }
            
            function dragended(event) {
              if (!event.active) simulation.alphaTarget(0);
              event.subject.fx = null;
              event.subject.fy = null;
            }
            
            return d3.drag()
              .on('start', dragstarted)
              .on('drag', dragged)
              .on('end', dragended);
          }
        }

        // Modal close handlers
        const modal = document.getElementById('importModal');
        const closeBtn = document.querySelector('.close');

        closeBtn.onclick = () => {
          modal.style.display = 'none';
          document.body.style.overflow = 'auto';
        };
        window.onclick = (e) => {
          if (e.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
          }
        };

        // Show first report by default
        const firstReport = ${JSON.stringify(reports[0])};
        if (firstReport) {
          showReport(firstReport.reportPath);
        }
      </script>
    </body>
    </html>
  `;

  fs.writeFileSync(path.join(baseDir, "index.html"), template);
}

function prepareGraphData(reports, baseDir) {
  const nodes = reports.map((report) => ({
    id: report.directory,
    name: report.directory,
    importCount: report.importCount,
  }));

  const links = [];
  reports.forEach((report) => {
    // Parse the JSON file to get import information
    const jsonPath = path.join(
      baseDir,
      report.directory,
      "import-analysis.json",
    );
    try {
      const reportData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

      // Process the structure to find imports
      // eslint-disable-next-line no-inner-declarations
      function processStructure(structure) {
        Object.values(structure).forEach((node) => {
          if (node.type === "file" && node.imports) {
            node.imports.forEach((imp) => {
              links.push({
                source: report.directory,
                target: imp.siblingDirectory,
                imports: [imp],
              });
            });
          }
          if (node.type === "directory" && node.children) {
            processStructure(node.children);
          }
        });
      }

      processStructure(reportData.structure);
    } catch (error) {
      console.error(
        `Error processing JSON for ${report.directory}:`,
        error.message,
      );
    }
  });

  return { nodes, links };
}

program
  .name("import-checker")
  .description("Analyze cross-feature imports in React projects");

// Original command for single directory analysis
program
  .command("check")
  .description("Analyze imports for a single directory")
  .argument("<directory>", "Target directory to analyze")
  .option("-v, --verbose", "Show detailed output")
  .option("--no-html", "Skip HTML report generation")
  .action((directory, options) => {
    const targetDir = path.resolve(process.cwd(), directory);
    console.log(chalk.blue(`Analyzing imports in: ${targetDir}`));

    const imports = analyzeImports(targetDir, {
      generateHtml: options.html,
      outputDir: process.cwd(),
    });

    if (imports.length === 0) {
      console.log(chalk.green("\n✓ No cross-feature imports found!"));
      return;
    }

    if (!options.html) {
      console.log(chalk.yellow("\nFound cross-directory imports:"));
      imports.forEach((importPath) => {
        console.log(chalk.red(`• ${importPath}`));
      });
    }

    console.log(
      chalk.blue("\nGenerated JSON report: import-analysis-report.json"),
    );
    if (options.html) {
      console.log(
        chalk.blue("Generated HTML report: import-analysis-report.html"),
      );
    }

    if (options.verbose) {
      console.log(
        chalk.gray("\nThese imports should be moved to a shared location."),
      );
    }
  });

// New command for analyzing all siblings
program
  .command("check-siblings")
  .description("Analyze imports for all sibling directories")
  .argument("<directory>", "Parent directory containing siblings to analyze")
  .option("-v, --verbose", "Show detailed output")
  .option("--no-html", "Skip HTML report generation")
  .action((directory, options) => {
    const parentDir = path.resolve(process.cwd(), directory);
    analyzeSiblingDirectories(parentDir, options);
  });

program.parse();
