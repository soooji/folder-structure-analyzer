#!/usr/bin/env node
/* eslint-disable no-use-before-define */

const { program } = require("commander");
const chalk = require("chalk");
const path = require("path");
const fs = require("fs-extra");
const { analyzeImports } = require("../lib/import-analyzer");
const { analyzeStructure } = require("../lib/structure-analyzer");

function analyzeSiblingDirectories(parentDir, options) {
  if (!fs.existsSync(parentDir)) {
    console.error(chalk.red(`Directory not found: ${parentDir}`));
    return;
  }

  // Create reports directory with parent directory name
  const parentDirName = path.basename(parentDir);
  const reportsBaseDir = path.join(
    options.outputDir,
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
    generateMainDashboard(reportsBaseDir, allReports, parentDirName, {
      hideHeader: options.hideHeader,
    });
    console.log(
      chalk.blue(
        `\nGenerated main dashboard: ${path.join(reportsBaseDir, "index.html")}`,
      ),
    );
  }
}

function prepareChordData(reports, baseDir) {
  // Create nodes array and index map
  const nodes = reports.map((r) => r.directory);
  const matrix = Array(nodes.length)
    .fill(0)
    .map(() => Array(nodes.length).fill(0));

  // Fill matrix with import counts
  reports.forEach((report) => {
    const jsonPath = path.join(
      baseDir,
      report.directory,
      "import-analysis.json",
    );
    try {
      const reportData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      const sourceIndex = nodes.indexOf(report.directory);

      // eslint-disable-next-line no-inner-declarations
      function processStructure(structure) {
        Object.values(structure).forEach((node) => {
          if (node.type === "file" && node.imports) {
            node.imports.forEach((imp) => {
              const targetIndex = nodes.indexOf(imp.siblingDirectory);
              if (targetIndex !== -1) {
                // eslint-disable-next-line no-plusplus
                matrix[sourceIndex][targetIndex]++;
              }
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

  return {
    nodes,
    matrix,
  };
}

function generateMainDashboard(
  baseDir,
  reports,
  parentDirName,
  options = { hideHeader: false },
) {
  const template = `
    <!DOCTYPE html>
    <html class="dark">
    <head>
      <title>Import Analysis Dashboard - ${parentDirName}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <script src="https://d3js.org/d3.v7.min.js"></script>
      <script src="https://d3js.org/d3-chord/3"></script>
      <style>
        /* Resizer */
        .resizer {
          width: 4px;
          cursor: col-resize;
          background: #1F2937;
          transition: background 0.2s;
        }
        
        .resizer:hover, .resizer.dragging {
          background: #3B82F6;
        }
      </style>
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
      ${
        !options.hideHeader
          ? `
      <!-- Header -->
      <header class="bg-dark-nav border-b border-gray-800 px-6 py-4">
        <div class="flex justify-between items-center">
          <h1 class="text-xl font-bold text-white">Import Checker</h1>
          <a href="https://www.npmjs.com/package/import-checker" target="_blank" class="text-blue-400 hover:text-blue-300 transition-colors">
            View on NPM
          </a>
        </div>
      </header>
      `
          : ""
      }

      <div class="flex ${options.hideHeader ? "h-screen" : "h-[calc(100vh-64px)]"}">
        <!-- Sidebar with Tabs -->
        <div id="sidebar" class="w-80 min-w-[200px] max-w-[600px] bg-dark-nav border-r border-gray-800">
          <div class="h-full overflow-y-auto">
            <div class="p-6">
              <h1 class="text-2xl font-bold mb-6 text-white">${parentDirName} Analysis</h1>
              <div class="mb-4 border-b border-gray-700">
                <ul class="flex flex-wrap -mb-px text-sm font-medium">
                  <li class="mr-2">
                    <button class="tab-btn inline-block p-4 rounded-t-lg border-b-2 border-blue-500 text-blue-500 hover:text-gray-300 hover:border-gray-300 transition-colors" data-tab="list">Directory List</button>
                  </li>
                  <li class="mr-2">
                    <button class="tab-btn inline-block p-4 rounded-t-lg border-b-2 border-transparent hover:text-gray-300 hover:border-gray-300 transition-colors" data-tab="graph">Graph View</button>
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
                <div class="bg-gray-900 p-4 rounded-lg mb-4">
                  <h3 class="text-sm font-medium mb-4">Visualization Type</h3>
                  <div class="space-y-2">
                    <button class="chart-type-btn w-full text-left px-3 py-2 rounded hover:bg-gray-800 transition-colors flex items-center text-blue-500 bg-gray-800" data-type="force">
                      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Force-Directed Graph
                    </button>
                    <button class="chart-type-btn w-full text-left px-3 py-2 rounded hover:bg-gray-800 transition-colors flex items-center" data-type="chord">
                      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" stroke-width="2"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v8M8 12h8"/>
                      </svg>
                      Chord Diagram
                    </button>
                  </div>
                </div>
                <div class="bg-gray-900 p-4 rounded-lg">
                  <h3 class="text-sm font-medium mb-2">Legend</h3>
                  <div class="flex items-center mb-2">
                    <div class="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                    <span class="text-sm">Directory</span>
                  </div>
                  <div class="text-xs text-gray-400 mt-2">
                    • Drag to pan the view<br>
                    • Scroll to zoom in/out<br>
                    • Click connections to see imports
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Resizer -->
        <div id="resizer" class="resizer"></div>

        <!-- Main Content Area -->
        <div class="flex-1 relative">
          <div id="reportFrame" class="w-full h-full"></div>
          <div id="graphContainer" class="hidden w-full h-full"></div>
        </div>
      </div>

      <script>
        // Move resizer code to the top of the script
        // Initialize resizer functionality immediately
        (function initResizer() {
          const resizer = document.getElementById('resizer');
          const sidebar = document.getElementById('sidebar');
          let isResizing = false;
          let lastDownX = 0;

          resizer.addEventListener('mousedown', function(e) {
            isResizing = true;
            lastDownX = e.clientX;
            resizer.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            
            // Prevent text selection while resizing
            document.body.style.userSelect = 'none';
          });

          document.addEventListener('mousemove', function(e) {
            if (!isResizing) return;

            const delta = e.clientX - lastDownX;
            lastDownX = e.clientX;
            
            const newWidth = sidebar.offsetWidth + delta;
            if (newWidth >= 200 && newWidth <= 600) {
              sidebar.style.width = newWidth + 'px';
            }
          });

          document.addEventListener('mouseup', function() {
            if (!isResizing) return;
            
            isResizing = false;
            resizer.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
          });
        })();

        const graphData = ${JSON.stringify(prepareGraphData(reports, baseDir))};
        const chordData = ${JSON.stringify(prepareChordData(reports, baseDir))};
        
        function initializeChordDiagram() {
          const width = document.getElementById('graphContainer').clientWidth;
          const height = document.getElementById('graphContainer').clientHeight;
          const radius = Math.min(width, height) * 0.4;

          // Clear previous content
          d3.select('#graphContainer').html('');

          const svg = d3.select('#graphContainer')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');

          // Create chord layout
          const chord = d3.chord()
            .padAngle(0.05);

          const chords = chord(chordData.matrix);

          // Add groups (arcs)
          const group = svg.append('g')
            .selectAll('g')
            .data(chords.groups)
            .join('g');

          group.append('path')
            .attr('fill', '#60A5FA')
            .attr('stroke', '#1F2937')
            .attr('d', d3.arc()
              .innerRadius(radius * 0.8)
              .outerRadius(radius)
            );

          // Add labels
          group.append('text')
            .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
            .attr('dy', '.35em')
            .attr('transform', d => 
              'translate(' + 
              Math.cos(d.angle - Math.PI / 2) * (radius + 10) + ',' +
              Math.sin(d.angle - Math.PI / 2) * (radius + 10) + ') ' +
              'rotate(' + (d.angle * 180 / Math.PI - 90) + ')' +
              (d.angle > Math.PI ? ' rotate(180)' : '')
            )
            .attr('text-anchor', d => d.angle > Math.PI ? 'end' : 'start')
            .text(d => chordData.nodes[d.index])
            .attr('fill', '#D1D5DB')
            .attr('font-size', '12px');

          // Add chords
          svg.append('g')
            .attr('fill-opacity', 0.5)
            .selectAll('path')
            .data(chords)
            .join('path')
            .attr('d', d3.ribbon().radius(radius * 0.8))
            .attr('fill', '#4B5563')
            .attr('stroke', '#1F2937')
            .attr('class', 'cursor-pointer')
            .on('mouseover', (event, d) => {
              d3.select(event.currentTarget)
                .attr('fill-opacity', 0.8)
                .attr('fill', '#60A5FA');
            })
            .on('mouseout', (event, d) => {
              d3.select(event.currentTarget)
                .attr('fill-opacity', 0.5)
                .attr('fill', '#4B5563');
            })
            .on('click', (event, d) => {
              const sourceId = chordData.nodes[d.source.index];
              const targetId = chordData.nodes[d.target.index];
              const linkData = graphData.links.find(l => 
                l.source === sourceId && l.target === targetId
              );
              if (linkData) {
                showLinkDetails(event, linkData);
              }
            });
        }

        // Chart type switching
        let currentChart = 'force';
        let currentChartInstance = null;

        document.querySelectorAll('.chart-type-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const chartType = btn.dataset.type;
            if (chartType === currentChart) return;

            // Update button states
            document.querySelectorAll('.chart-type-btn').forEach(b => {
              b.classList.remove('text-blue-500', 'bg-gray-800');
            });
            btn.classList.add('text-blue-500', 'bg-gray-800');

            // Clear previous chart
            d3.select('#graphContainer').selectAll('*').remove();
            
            // Initialize new chart
            currentChart = chartType;
            initializeChart(chartType);
          });
        });

        // Update tab switching logic
        document.querySelectorAll('.tab-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = btn.dataset.tab;
            
            // Update button states
            document.querySelectorAll('.tab-btn').forEach(b => {
              b.classList.remove('border-blue-500', 'text-blue-500');
              b.classList.add('border-transparent');
            });
            btn.classList.remove('border-transparent');
            btn.classList.add('border-blue-500', 'text-blue-500');
            
            // Show/hide content
            document.querySelectorAll('.tab-content').forEach(content => {
              content.classList.add('hidden');
            });
            document.getElementById(tabId + 'View').classList.remove('hidden');

            // Show/hide main content and initialize/reinitialize graph if needed
            if (tabId === 'graph') {
              document.getElementById('reportFrame').classList.add('hidden');
              document.getElementById('graphContainer').classList.remove('hidden');
              // Clear and reinitialize current chart
              d3.select('#graphContainer').selectAll('*').remove();
              initializeChart(currentChart);
            } else {
              document.getElementById('reportFrame').classList.remove('hidden');
              document.getElementById('graphContainer').classList.add('hidden');
            }
          });
        });

        function initializeChart(type) {
          switch(type) {
            case 'force':
              initializeForceGraph();
              break;
            case 'chord':
              initializeChordDiagram();
              break;
          }
        }

        // Add drag function
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

        // Initialize Force-Directed Graph
        function initializeForceGraph() {
          const width = document.getElementById('graphContainer').clientWidth;
          const height = document.getElementById('graphContainer').clientHeight;

          const svg = d3.select('#graphContainer')
            .append('svg')
            .attr('width', width)
            .attr('height', height);

          const g = svg.append('g');

          // Add zoom behavior
          const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
              g.attr('transform', event.transform);
            });

          svg.call(zoom);

          const simulation = d3.forceSimulation(graphData.nodes)
            .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2));

          // Add arrow marker
          g.append('defs').selectAll('marker')
            .data(['end'])
            .join('marker')
            .attr('id', 'arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 15)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('fill', '#4B5563')
            .attr('d', 'M0,-5L10,0L0,5');

          const link = g.append('g')
            .selectAll('line')
            .data(graphData.links)
            .join('line')
            .attr('stroke', '#4B5563')
            .attr('stroke-width', 2)
            .attr('marker-end', 'url(#arrow)')
            .attr('class', 'cursor-pointer')
            .on('click', (event, d) => {
              // Highlight clicked connection
              d3.selectAll('line').attr('stroke', '#4B5563');
              d3.select(event.currentTarget)
                .attr('stroke', '#60A5FA')
                .attr('stroke-width', 3);
              
              showLinkDetails(event, d);
            });

          const node = g.append('g')
            .selectAll('circle')
            .data(graphData.nodes)
            .join('circle')
            .attr('r', 5)
            .attr('fill', d => d.type === 'file' ? '#60A5FA' : '#34D399')
            .call(drag(simulation));

          const label = g.append('g')
            .selectAll('text')
            .data(graphData.nodes)
            .join('text')
            .text(d => d.name)
            .attr('font-size', '12px')
            .attr('fill', '#D1D5DB')
            .attr('dx', 8)
            .attr('dy', 4);

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
          });
        }

        function showReport(path) {
          document.getElementById('reportFrame').innerHTML = \`<iframe src="\${path}" class="w-full h-full border-0"></iframe>\`;
        }

        function initializeGraph() {
          const width = document.getElementById('graphContainer').clientWidth;
          const height = document.getElementById('graphContainer').clientHeight;

          // Create the main SVG container
          const svg = d3.select('#graphContainer')
            .append('svg')
            .attr('width', width)
            .attr('height', height);

          // Add zoom behavior
          const g = svg.append('g');
          
          const zoom = d3.zoom()
            .scaleExtent([0.1, 4]) // Allow zoom from 0.1x to 4x
            .on('zoom', (event) => {
              g.attr('transform', event.transform);
            });

          svg.call(zoom);
          
          // Add zoom controls
          const controls = d3.select('#graphContainer')
            .append('div')
            .attr('class', 'absolute top-4 right-4 flex gap-2');

          controls.append('button')
            .attr('class', 'p-2 bg-gray-800 hover:bg-gray-700 rounded text-white transition-colors')
            .html('<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>')
            .on('click', () => {
              svg.transition()
                .duration(500)
                .call(zoom.scaleBy, 1.5);
            });

          controls.append('button')
            .attr('class', 'p-2 bg-gray-800 hover:bg-gray-700 rounded text-white transition-colors')
            .html('<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/></svg>')
            .on('click', () => {
              svg.transition()
                .duration(500)
                .call(zoom.scaleBy, 0.75);
            });

          controls.append('button')
            .attr('class', 'p-2 bg-gray-800 hover:bg-gray-700 rounded text-white transition-colors')
            .html('<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-2V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>')
            .on('click', () => {
              svg.transition()
                .duration(500)
                .call(zoom.transform, d3.zoomIdentity);
            });

          const simulation = d3.forceSimulation(graphData.nodes)
            .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(150))
            .force('charge', d3.forceManyBody().strength(-500))
            .force('center', d3.forceCenter(width / 2, height / 2));

          // Add arrow marker
          g.append('defs').selectAll('marker')
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
          const labelGroup = g.append('g')
            .attr('class', 'hover-labels')
            .style('pointer-events', 'none');

          const link = g.append('g')
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

          const node = g.append('g')
            .selectAll('circle')
            .data(graphData.nodes)
            .join('circle')
            .attr('r', d => d.importCount > 0 ? 10 : 8)
            .attr('fill', '#60A5FA')
            .call(drag(simulation))
            .on('click', showDirectoryReport);

          const label = g.append('g')
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
            const modal = document.getElementById('importModal');
            const modalContent = document.getElementById('modalContent');
            
            modalContent.innerHTML = d.imports.map(imp => {
              const fileUrl = \`vscode://file/\${imp.absolutePath}\`;
              return \`
                <div class="border-l-4 border-red-500 bg-gray-900 rounded-r p-4 mb-4">
                  <div class="import-path">
                    <div class="text-white font-medium mb-2">\${d.source.id}</div>
                  </div>
                  <div class="bg-gray-800 rounded p-3 space-y-2 text-sm">
                    <div class="text-gray-300"><span class="text-gray-400">Importing from:</span> \${imp.importPath}</div>
                    <div class="text-gray-300"><span class="text-gray-400">Sibling Directory:</span> \${imp.siblingDirectory}</div>
                    \${imp.importedItems.length > 0 ? \`
                    <div class="mt-3">
                      <div class="text-gray-400 mb-1">Imported Items:</div>
                      <ul class="list-disc pl-4 space-y-1 text-gray-300">
                        \${imp.importedItems.map(item => \`<li>\${item}</li>\`).join('')}
                      </ul>
                    </div>
                    \` : ''}
                  </div>
                  <button class="mt-3 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors" onclick="window.location.href='\${fileUrl}'">
                    Open in Editor
                  </button>
                </div>
              \`;
            }).join('');
            
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';

            // Add modal close handlers
            const closeBtn = modal.querySelector('.close');
            closeBtn.onclick = () => {
              modal.style.display = 'none';
              document.body.style.overflow = 'auto';
              // Reset connection color when modal is closed
              d3.selectAll('line')
                .attr('stroke', '#4B5563')
                .attr('stroke-width', 2);
            };

            // Close on outside click
            modal.onclick = (e) => {
              if (e.target === modal) {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
                // Reset connection color when modal is closed
                d3.selectAll('line')
                  .attr('stroke', '#4B5563')
                  .attr('stroke-width', 2);
              }
            };
          }

          // Update the drag function to work with zoom
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
              .subject(d => d)
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

        // Initialize default chart when graph view is first shown
        if (document.getElementById('graphView').classList.contains('hidden')) {
          initializeChart('force');
        }

        // Link interaction handlers
        function showLinkDetails(event, d) {
          const modal = document.getElementById('importModal');
          const modalContent = document.getElementById('modalContent');
          
          modalContent.innerHTML = d.imports.map(imp => {
            const fileUrl = \`vscode://file/\${imp.absolutePath}\`;
            return \`
              <div class="border-l-4 border-red-500 bg-gray-900 rounded-r p-4 mb-4">
                <div class="import-path">
                  <div class="text-white font-medium mb-2">\${d.source.id}</div>
                </div>
                <div class="bg-gray-800 rounded p-3 space-y-2 text-sm">
                  <div class="text-gray-300"><span class="text-gray-400">Importing from:</span> \${imp.importPath}</div>
                  <div class="text-gray-300"><span class="text-gray-400">Sibling Directory:</span> \${imp.siblingDirectory}</div>
                  \${imp.importedItems.length > 0 ? \`
                  <div class="mt-3">
                    <div class="text-gray-400 mb-1">Imported Items:</div>
                    <ul class="list-disc pl-4 space-y-1 text-gray-300">
                      \${imp.importedItems.map(item => \`<li>\${item}</li>\`).join('')}
                    </ul>
                  </div>
                  \` : ''}
                </div>
                <button class="mt-3 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors" onclick="window.location.href='\${fileUrl}'">
                  Open in Editor
                </button>
              </div>
            \`;
          }).join('');
          
          modal.style.display = 'block';
          document.body.style.overflow = 'hidden';

          // Add modal close handlers
          const closeBtn = modal.querySelector('.close');
          closeBtn.onclick = () => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            // Reset connection color when modal is closed
            d3.selectAll('line')
              .attr('stroke', '#4B5563')
              .attr('stroke-width', 2);
          };

          // Close on outside click
          modal.onclick = (e) => {
            if (e.target === modal) {
              modal.style.display = 'none';
              document.body.style.overflow = 'auto';
              // Reset connection color when modal is closed
              d3.selectAll('line')
                .attr('stroke', '#4B5563')
                .attr('stroke-width', 2);
            }
          };
        }

        function hideLinkDetails() {
          // Optionally hide the modal when mouse leaves the link
          // document.getElementById('importModal').style.display = 'none';
        }
      </script>

      <!-- Import Details Modal -->
      <div id="importModal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50">
        <div class="bg-dark-nav rounded-lg max-w-2xl mx-auto mt-10 p-6 relative max-h-[calc(100vh-50px)] overflow-hidden flex flex-col">
          <button class="close absolute top-4 right-4 text-gray-400 hover:text-white">&times;</button>
          <h2 class="text-xl font-bold mb-4">Import Details</h2>
          <div id="modalContent" class="overflow-y-auto"></div>
        </div>
      </div>
    </body>
    </html>
  `;

  fs.writeFileSync(path.join(baseDir, "index.html"), template);
}

function prepareGraphData(reports, baseDir) {
  // Create nodes for each directory
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
              // Only add the link if both source and target are in our nodes list
              const sourceExists = nodes.some((n) => n.id === report.directory);
              const targetExists = nodes.some(
                (n) => n.id === imp.siblingDirectory,
              );

              if (sourceExists && targetExists) {
                // Check if this link already exists
                const existingLink = links.find(
                  (l) =>
                    l.source === report.directory &&
                    l.target === imp.siblingDirectory,
                );

                if (existingLink) {
                  // Merge imports into existing link
                  existingLink.imports.push(imp);
                } else {
                  // Create new link
                  links.push({
                    source: report.directory,
                    target: imp.siblingDirectory,
                    imports: [imp],
                  });
                }
              }
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

  // Debug log to check the data
  console.log("Graph Data:", { nodes, links });

  return { nodes, links };
}

function generateCombinedDashboard(baseDir, data) {
  const template = `
    <!DOCTYPE html>
    <html class="dark">
    <head>
      <title>Import Checker Analysis</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <script src="https://d3js.org/d3.v7.min.js"></script>
      <script src="https://d3js.org/d3-chord/3"></script>
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
      <!-- Header -->
      <header class="bg-dark-nav border-b border-gray-800 px-6 py-4">
        <div class="flex items-center space-x-8">
          <h1 class="text-xl font-bold text-white">Import Checker</h1>
          
          <!-- Analysis Type Tabs -->
          <div class="flex space-x-4">
            <button class="tab-btn px-4 py-2 text-blue-500 border-b-2 border-blue-500" data-tab="siblings">
              Sibling Imports
            </button>
            <button class="tab-btn px-4 py-2 text-gray-400 border-b-2 border-transparent hover:text-gray-300" data-tab="structure">
              Structure Analysis
            </button>
          </div>

          <a href="https://www.npmjs.com/package/import-checker" target="_blank" class="ml-auto text-blue-400 hover:text-blue-300 transition-colors">
            View on NPM
          </a>
        </div>
      </header>

      <!-- Content Areas -->
      <div class="h-[calc(100vh-64px)]">
        <div id="siblingsView" class="tab-content h-full">
          <iframe src="${data.dirName}/import-analysis/import-analysis-${data.dirName}/index.html" class="w-full h-full border-0"></iframe>
        </div>
        <div id="structureView" class="tab-content h-full hidden">
          <iframe src="${data.dirName}/structure-analysis/structure-analysis-${data.dirName}/structure-analysis.html" class="w-full h-full border-0"></iframe>
        </div>
      </div>

      <script>
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const tabId = btn.dataset.tab;
            
            // Update button states
            document.querySelectorAll('.tab-btn').forEach(b => {
              b.classList.remove('text-blue-500', 'border-blue-500');
              b.classList.add('text-gray-400', 'border-transparent');
            });
            btn.classList.remove('text-gray-400', 'border-transparent');
            btn.classList.add('text-blue-500', 'border-blue-500');
            
            // Show/hide content
            document.querySelectorAll('.tab-content').forEach(content => {
              content.classList.add('hidden');
            });
            document.getElementById(tabId + 'View').classList.remove('hidden');
          });
        });
      </script>
    </body>
    </html>
  `;

  fs.writeFileSync(path.join(baseDir, "index.html"), template);
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
  .option("-o, --output <path>", "Output directory path")
  .action((directory, options) => {
    const targetDir = path.resolve(process.cwd(), directory);
    console.log(chalk.blue(`Analyzing imports in: ${targetDir}`));

    // Get output directory from config or CLI option
    const configPath = path.join(process.cwd(), ".importcheckerrc.json");
    let configOutputDir = null;
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        configOutputDir = config.outputDir;
      } catch (error) {
        // Ignore config parsing errors
      }
    }

    const baseOutputDir =
      options.output || configOutputDir || "import-analysis";
    const outputDir = path.resolve(process.cwd(), baseOutputDir);

    const imports = analyzeImports(targetDir, {
      generateHtml: options.html,
      outputDir,
      reportNamePrefix: "import-analysis-report",
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
  .option("-o, --output <path>", "Output directory path")
  .action((directory, options) => {
    const parentDir = path.resolve(process.cwd(), directory);

    // Get output directory from config or CLI option
    const configPath = path.join(process.cwd(), ".importcheckerrc.json");
    let configOutputDir = null;
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        configOutputDir = config.outputDir;
      } catch (error) {
        // Ignore config parsing errors
      }
    }

    const baseOutputDir =
      options.output || configOutputDir || "import-analysis";
    const outputDir = path.resolve(process.cwd(), baseOutputDir);

    // Create the base output directory if it doesn't exist
    fs.ensureDirSync(outputDir);

    // Modify the analyzeSiblingDirectories function call
    analyzeSiblingDirectories(parentDir, {
      // eslint-disable-next-line node/no-unsupported-features/es-syntax
      ...options,
      outputDir,
    });
  });

// Add this new command after existing commands
program
  .command("check-structure")
  .description("Analyze directory structure for component organization")
  .argument("<directory>", "Target directory to analyze")
  .option(
    "-s, --skip <directories>",
    "Directories to skip in structure analysis",
    "components",
  )
  .option("-v, --verbose", "Show detailed output")
  .option("--no-html", "Skip HTML report generation")
  .option("-o, --output <path>", "Output directory path")
  .action((directory, options) => {
    const targetDir = path.resolve(process.cwd(), directory);
    console.log(chalk.blue(`Analyzing structure in: ${targetDir}`));

    const skipDirectories = options.skip.split(",").map((d) => d.trim());

    try {
      const baseOutputDir = options.output || "structure-analysis";
      const outputDir = path.resolve(process.cwd(), baseOutputDir);

      // Get directory name for the report folder
      const dirName = path.basename(targetDir);
      const reportDir = path.join(outputDir, `structure-analysis-${dirName}`);
      fs.ensureDirSync(reportDir);

      const result = analyzeStructure(targetDir, {
        skipDirectories,
        generateReports: true,
        generateHtml: options.html,
        outputDir: reportDir,
      });

      if (result.violations.length === 0) {
        console.log(chalk.green("\n✓ No structure violations found!"));
        return;
      }

      console.log(
        chalk.yellow(
          `\nFound ${result.violations.length} structure violations:`,
        ),
      );
      result.violations.forEach((violation) => {
        console.log(chalk.red(`\n• ${violation.directory}:`));
        console.log(chalk.gray(`  ${violation.message}`));
      });

      if (options.html) {
        console.log(
          chalk.blue(
            `\nGenerated HTML report: ${path.join(reportDir, "structure-analysis.html")}`,
          ),
        );
      }
    } catch (error) {
      console.error(chalk.red(`Error analyzing structure: ${error.message}`));
      process.exit(1);
    }
  });

// Add this new command
program
  .command("check-all")
  .description("Run both sibling imports and structure analysis")
  .argument("<directory>", "Target directory to analyze")
  .option("-v, --verbose", "Show detailed output")
  .option("--no-html", "Skip HTML report generation")
  .option("-o, --output <path>", "Output directory path")
  .option(
    "-s, --skip <directories>",
    "Directories to skip in structure analysis",
    "components",
  )
  .action((directory, options) => {
    const targetDir = path.resolve(process.cwd(), directory);
    console.log(chalk.blue(`Analyzing directory: ${targetDir}`));

    try {
      const baseOutputDir = options.output || "import-checker-analysis";
      const outputDir = path.resolve(process.cwd(), baseOutputDir);
      fs.ensureDirSync(outputDir);

      // Get directory name and create its folder
      const dirName = path.basename(targetDir);
      const dirOutputDir = path.join(outputDir, dirName);
      fs.ensureDirSync(dirOutputDir);

      // Create subdirectories for each analysis type
      const siblingsOutputDir = path.join(dirOutputDir, "import-analysis");
      const structureOutputDir = path.join(dirOutputDir, "structure-analysis");
      fs.ensureDirSync(siblingsOutputDir);
      fs.ensureDirSync(structureOutputDir);

      // Run structure analysis
      const skipDirectories = options.skip.split(",").map((d) => d.trim());
      const structureResult = analyzeStructure(targetDir, {
        skipDirectories,
        generateReports: true,
        generateHtml: true,
        outputDir: structureOutputDir,
        reportNamePrefix: "structure-analysis",
        hideHeader: true,
      });

      // Run sibling imports analysis with modified options
      const siblingsResult = analyzeSiblingDirectories(targetDir, {
        // eslint-disable-next-line node/no-unsupported-features/es-syntax
        ...options,
        outputDir: siblingsOutputDir,
        html: true,
        generateMainDashboard: true,
        reportNamePrefix: "index",
        hideHeader: true,
      });

      // Generate combined dashboard
      generateCombinedDashboard(outputDir, {
        structure: structureResult,
        siblings: siblingsResult,
        dirName,
      });

      console.log(
        chalk.blue(
          `\nGenerated combined report: ${path.join(outputDir, "index.html")}`,
        ),
      );
    } catch (error) {
      console.error(chalk.red(`Error analyzing directory: ${error.message}`));
      process.exit(1);
    }
  });

program.parse();
