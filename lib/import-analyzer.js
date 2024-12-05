const fs = require("fs-extra");
const path = require("path");
const parser = require("@babel/parser");
const glob = require("glob");

function generateHtmlReport(jsonData) {
  const template = `
    <!DOCTYPE html>
    <html class="dark">
    <head>
      <title>Import Analysis Report</title>
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
    <body class="bg-dark-bg text-gray-200 min-h-screen">
      <div class="container mx-auto px-4 py-8">
        <h1 class="text-3xl font-bold mb-8 text-white">Import Analysis Report</h1>
        <div class="bg-dark-nav rounded-lg p-6 mb-8">
          <h3 class="text-xl mb-2">Analysis for: ${jsonData.targetDirectory}</h3>
          <p class="text-gray-400">Found ${jsonData.totalImports} cross-directory imports</p>
          <p class="text-gray-400">Analysis performed at: ${new Date(jsonData.analyzedAt).toLocaleString()}</p>
        </div>

        <div class="bg-dark-nav rounded-lg p-6">
          <h2 class="text-2xl font-bold mb-4">Directory Structure</h2>
          <div class="text-sm">
            ${generateTreeView(jsonData.structure)}
          </div>
        </div>
      </div>

      <!-- Import Details Modal -->
      <div id="importModal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50">
        <div class="bg-dark-nav rounded-lg max-w-2xl mx-auto mt-20 p-6 relative">
          <button class="close absolute top-4 right-4 text-gray-400 hover:text-white">&times;</button>
          <h2 class="text-xl font-bold mb-4">Import Details</h2>
          <div id="modalContent"></div>
        </div>
      </div>

      <script>
        // Store the structure data for modal usage
        const structureData = ${JSON.stringify(jsonData.structure)};
        const graphData = ${JSON.stringify(prepareGraphData(jsonData.structure))};

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

            // Initialize graph if switching to graph view
            if (tabId === 'graph' && !window.graphInitialized) {
              initializeGraph();
              window.graphInitialized = true;
            }
          });
        });

        // Graph initialization
        function initializeGraph() {
          const width = document.getElementById('graph').clientWidth;
          const height = document.getElementById('graph').clientHeight;

          const svg = d3.select('#graph')
            .append('svg')
            .attr('width', width)
            .attr('height', height);

          const simulation = d3.forceSimulation(graphData.nodes)
            .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2));

          // Add arrow marker
          svg.append('defs').selectAll('marker')
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

          const link = svg.append('g')
            .selectAll('line')
            .data(graphData.links)
            .join('line')
            .attr('stroke', '#4B5563')
            .attr('stroke-width', 2)
            .attr('marker-end', 'url(#arrow)')
            .on('mouseover', showLinkDetails)
            .on('mouseout', hideLinkDetails);

          const node = svg.append('g')
            .selectAll('circle')
            .data(graphData.nodes)
            .join('circle')
            .attr('r', 5)
            .attr('fill', d => d.type === 'file' ? '#60A5FA' : '#34D399')
            .call(drag(simulation));

          const label = svg.append('g')
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

          function showLinkDetails(event, d) {
            showImportDetails(d.source.id, d.imports);
          }

          function hideLinkDetails() {
            // Optionally hide the modal when mouse leaves the link
            // document.getElementById('importModal').style.display = 'none';
          }
        }

        // Toggle directory expansion
        document.querySelectorAll('.directory').forEach(dir => {
          dir.addEventListener('click', (e) => {
            const ul = dir.parentElement.nextElementSibling;
            const arrow = dir.querySelector('svg');
            if (ul && ul.tagName === 'UL') {
              ul.style.display = ul.style.display === 'none' ? 'block' : 'none';
              arrow.style.transform = ul.style.display === 'none' ? '' : 'rotate(-90deg)';
            }
          });
        });

        function showImportDetails(filePath, imports) {
          const modal = document.getElementById('importModal');
          const modalContent = document.getElementById('modalContent');
          
          modalContent.innerHTML = imports.map(imp => {
            const fileUrl = \`vscode://file/\${imp.absolutePath}\`;
            return \`
              <div class="border-l-4 border-red-500 bg-gray-900 rounded-r p-4 mb-4">
                <div class="import-path">
                  <div class="text-white font-medium mb-2">\${filePath}</div>
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
        }

        // Modal close handlers
        const modal = document.getElementById('importModal');
        const closeBtn = document.querySelector('.close');

        closeBtn.onclick = () => modal.style.display = 'none';
        window.onclick = (e) => {
          if (e.target === modal) modal.style.display = 'none';
        };
      </script>
    </body>
    </html>
  `;

  return template;
}

function prepareImportDetails(imports) {
  const details = {};

  imports.forEach((imp) => {
    const [filePath] = imp.split(" imports from");
    if (!details[filePath]) {
      details[filePath] = [];
    }
    details[filePath].push({
      message: imp,
      absolutePath: path.resolve(process.cwd(), filePath),
    });
  });

  return details;
}

function generateTreeView(structure, parentPath = "") {
  let html = '<ul class="pl-4 space-y-1">';

  Object.entries(structure).forEach(([name, node]) => {
    const currentPath = parentPath ? `${parentPath}/${name}` : name;

    if (node.type === "file") {
      const importCount = node.imports.length;
      const countBadge = importCount > 0 
        ? `<span class="ml-2 px-2 py-0.5 text-xs rounded-full bg-red-500 text-white">${importCount}</span>` 
        : "";
      const detailsButton = importCount > 0
        ? `<button class="ml-2 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors" onclick='showImportDetails("${currentPath}", ${JSON.stringify(node.imports)})'>Details</button>`
        : "";

      html += `
        <li class="flex items-center py-1">
          <span class="text-gray-300">${name}</span>
          ${countBadge}
          ${detailsButton}
        </li>
      `;
    } else {
      const childrenHtml = generateTreeView(node.children, currentPath);
      const importCount = countTotalImports(node);
      const countBadge = importCount > 0 
        ? `<span class="ml-2 px-2 py-0.5 text-xs rounded-full bg-red-500 text-white">${importCount}</span>` 
        : "";

      html += `
        <li class="py-1">
          <div class="flex items-center">
            <span class="directory text-gray-200 font-medium hover:text-white cursor-pointer flex items-center">
              <svg class="w-4 h-4 mr-1 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
              ${name}
            </span>
            ${countBadge}
          </div>
          ${childrenHtml}
        </li>
      `;
    }
  });

  return html + "</ul>";
}

function countTotalImports(node) {
  if (node.type === "file") {
    return node.imports.length;
  }

  return Object.values(node.children).reduce(
    (sum, child) => sum + countTotalImports(child),
    0,
  );
}

function generateJsonReport(imports, targetDir) {
  const result = {
    targetDirectory: targetDir,
    analyzedAt: new Date().toISOString(),
    totalImports: imports.length,
    structure: {},
  };

  imports.forEach((imp) => {
    // Example message: "src/file.ts imports from sibling directory 'auth': ../auth/file.ts (importing: func1, func2)"
    const [sourcePath, importInfo] = imp.split(
      " imports from sibling directory ",
    );

    // Extract sibling directory and import path
    // Match pattern: 'directory-name': path/to/file
    const siblingMatch = importInfo.match(/'([^']+)':\s*([^(]+)/);
    const siblingDir = siblingMatch ? siblingMatch[1] : "";
    const importPath = siblingMatch ? siblingMatch[2].trim() : "";

    // Extract imported items
    const importMatch = imp.match(/\(importing: (.*?)\)/);
    const importedItems = importMatch ? importMatch[1].split(", ") : [];

    // Create nested structure based on directory path
    const parts = sourcePath.split(path.sep);
    let current = result.structure;

    parts.slice(0, -1).forEach((part) => {
      if (!current[part]) {
        current[part] = {
          type: "directory",
          children: {},
        };
      }
      current = current[part].children;
    });

    const fileName = parts[parts.length - 1];
    if (!current[fileName]) {
      current[fileName] = {
        type: "file",
        imports: [],
      };
    }

    current[fileName].imports.push({
      importPath,
      siblingDirectory: siblingDir,
      importedItems,
      absolutePath: path.resolve(process.cwd(), sourcePath),
    });
  });

  return result;
}

function analyzeImports(
  targetDir,
  options = {
    generateHtml: true,
    reportNamePrefix: "import-analysis-report",
    outputDir: process.cwd(),
  },
) {
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Directory not found: ${targetDir}`);
  }

  const parentDir = path.dirname(targetDir);
  const dirName = path.basename(targetDir);

  // Find sibling directories excluding the target directory
  const siblingDirs = fs
    .readdirSync(parentDir)
    .filter((dir) => {
      const fullPath = path.join(parentDir, dir);
      return fs.statSync(fullPath).isDirectory() && dir !== dirName;
    })
    .map((dir) => path.basename(dir));

  const foundImports = new Set();
  const processedFiles = new Set();

  // Recursively find all JS/JSX/TS/TSX files in the target directory
  const files = glob.sync(`${targetDir}/**/*.{js,jsx,ts,tsx}`);

  function getImportedItems(node) {
    const items = [];

    // Handle default imports (e.g., import Default from './path')
    if (
      node.specifiers.find((spec) => spec.type === "ImportDefaultSpecifier")
    ) {
      const defaultImport = node.specifiers.find(
        (spec) => spec.type === "ImportDefaultSpecifier",
      );
      items.push(`default as ${defaultImport.local.name}`);
    }

    // Handle named imports (e.g., import { name1, name2 } from './path')
    const namedImports = node.specifiers
      .filter((spec) => spec.type === "ImportSpecifier")
      .map((spec) => {
        // Handle renamed imports (e.g., import { original as renamed } from './path')
        if (spec.local.name !== spec.imported.name) {
          return `${spec.imported.name} as ${spec.local.name}`;
        }
        return spec.local.name;
      });

    items.push(...namedImports);

    // Handle namespace imports (e.g., import * as name from './path')
    const namespaceImport = node.specifiers.find(
      (spec) => spec.type === "ImportNamespaceSpecifier",
    );
    if (namespaceImport) {
      items.push(`* as ${namespaceImport.local.name}`);
    }

    return items;
  }

  files.forEach((file) => {
    if (processedFiles.has(file)) return;
    processedFiles.add(file);

    const fileContent = fs.readFileSync(file, "utf-8");
    const relativePath = path.relative(process.cwd(), file);
    const fileDir = path.dirname(file);
    const isTypeScript = /\.tsx?$/.test(file);
    const isJSX = /\.(jsx|tsx)$/.test(file);

    try {
      const ast = parser.parse(fileContent, {
        sourceType: "module",
        plugins: [
          isTypeScript && "typescript",
          isJSX && "jsx",
          "decorators-legacy",
        ].filter(Boolean),
      });

      function visitNode(node) {
        if (node.type === "ImportDeclaration") {
          const importPath = node.source.value;
          const importedItems = getImportedItems(node);
          const importedItemsStr =
            importedItems.length > 0
              ? ` (importing: ${importedItems.join(", ")})`
              : "";

          // Handle relative imports
          if (importPath.startsWith(".")) {
            const absoluteImportPath = path.resolve(fileDir, importPath);
            const relativeToParent = path.relative(
              parentDir,
              absoluteImportPath,
            );
            const importDirName = relativeToParent.split(path.sep)[0];

            // Check if import is from a sibling directory
            if (siblingDirs.includes(importDirName)) {
              foundImports.add(
                `${relativePath} imports from sibling directory '${importDirName}': ${importPath} ${importedItemsStr}`,
              );
            }
          } else {
            // Handle absolute imports
            const isSiblingImport = siblingDirs.some(
              (sibDir) =>
                importPath.includes(`/${sibDir}/`) || importPath === sibDir,
            );

            if (isSiblingImport) {
              const siblingDir = siblingDirs.find(
                (sibDir) =>
                  importPath.includes(`/${sibDir}/`) || importPath === sibDir,
              );
              foundImports.add(
                `${relativePath} imports from sibling directory '${siblingDir}': ${importPath} ${importedItemsStr}`,
              );
            }
          }
        }

        // Recursively visit all child nodes
        for (const key in node) {
          const child = node[key];
          if (child && typeof child === "object") {
            if (Array.isArray(child)) {
              child.forEach((item) => {
                if (item && typeof item === "object") {
                  visitNode(item);
                }
              });
            } else {
              visitNode(child);
            }
          }
        }
      }

      visitNode(ast);
    } catch (error) {
      console.error(`Error parsing file ${relativePath}:`, error.message);
    }
  });

  const imports = Array.from(foundImports);

  // Generate JSON report
  const jsonReport = generateJsonReport(imports, targetDir);
  const jsonReportPath = path.join(
    options.outputDir,
    `${options.reportNamePrefix || "import-analysis-report"}.json`,
  );
  fs.writeFileSync(jsonReportPath, JSON.stringify(jsonReport, null, 2));

  // Generate HTML report if requested
  if (options.generateHtml !== false) {
    const htmlReport = generateHtmlReport(jsonReport);
    const reportPath = path.join(
      options.outputDir,
      `${options.reportNamePrefix || "import-analysis-report"}.html`,
    );
    fs.writeFileSync(reportPath, htmlReport);
  }

  return imports;
}

function prepareGraphData(structure, parentPath = '') {
  const nodes = [];
  const links = [];
  const processedFiles = new Set();

  function processNode(node, name, currentPath) {
    const id = currentPath;
    
    if (!processedFiles.has(id)) {
      processedFiles.add(id);
      nodes.push({
        id,
        name,
        type: node.type
      });

      if (node.type === 'file' && node.imports && node.imports.length > 0) {
        node.imports.forEach(imp => {
          const targetPath = path.resolve(path.dirname(currentPath), imp.importPath);
          links.push({
            source: id,
            target: targetPath,
            imports: [imp]
          });
        });
      }

      if (node.type === 'directory' && node.children) {
        Object.entries(node.children).forEach(([childName, childNode]) => {
          const childPath = path.join(currentPath, childName);
          processNode(childNode, childName, childPath);
        });
      }
    }
  }

  Object.entries(structure).forEach(([name, node]) => {
    const currentPath = path.join(parentPath, name);
    processNode(node, name, currentPath);
  });

  return { nodes, links };
}

module.exports = { analyzeImports };
