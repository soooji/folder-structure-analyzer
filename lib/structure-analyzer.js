/* eslint-disable no-use-before-define */
const fs = require("fs-extra");
const path = require("path");

function analyzeStructure(
  targetDir,
  options = {
    skipDirectories: ["components"],
    hideHeader: false,
  },
) {
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Directory not found: ${targetDir}`);
  }

  const skipDirs = options.skipDirectories || ["components"];
  const violations = [];
  const processedDirs = new Set();

  // Find all directories recursively
  function processDirectory(dir) {
    if (processedDirs.has(dir)) return;
    processedDirs.add(dir);

    const stats = {
      directory: path.relative(process.cwd(), dir),
      componentFiles: [],
      subDirectories: [],
      hasViolation: false,
      violationType: null,
    };

    // Get all immediate subdirectories
    const items = fs.readdirSync(dir);

    // Find component files in current directory
    const componentFiles = items.filter((item) => {
      const fullPath = path.join(dir, item);
      return (
        fs.statSync(fullPath).isFile() &&
        (item.endsWith(".tsx") || item.endsWith(".jsx")) &&
        !item.startsWith("index.")
      );
    });

    if (componentFiles.length > 1) {
      const dirName = path.basename(dir);
      if (!skipDirs.includes(dirName)) {
        stats.hasViolation = true;
        stats.violationType = "multiple-components";
        stats.componentFiles = componentFiles;
        violations.push({
          type: "multiple-components",
          directory: path.relative(process.cwd(), dir),
          files: componentFiles,
          message: `Directory contains multiple component files: ${componentFiles.join(", ")}`,
        });
      }
    }

    // Process subdirectories
    items.forEach((item) => {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        stats.subDirectories.push(processDirectory(fullPath));
      }
    });

    // eslint-disable-next-line consistent-return
    return stats;
  }

  const analysisResult = {
    targetDirectory: targetDir,
    analyzedAt: new Date().toISOString(),
    skipDirectories: skipDirs,
    violations: violations,
    structure: processDirectory(targetDir),
  };

  // Generate reports if requested
  if (options.generateReports) {
    const reportsDir = path.join(
      options.outputDir || process.cwd(),
      `structure-analysis-${path.basename(targetDir)}`,
    );
    fs.ensureDirSync(reportsDir);

    // Save JSON report
    fs.writeFileSync(
      path.join(reportsDir, "structure-analysis.json"),
      JSON.stringify(analysisResult, null, 2),
    );

    // Generate HTML report
    if (options.generateHtml !== false) {
      const htmlReport = generateHtmlReport(analysisResult, {
        hideHeader: options.hideHeader,
      });
      fs.writeFileSync(
        path.join(reportsDir, "structure-analysis.html"),
        htmlReport,
      );
    }
  }

  return analysisResult;
}

function generateHtmlReport(data, options = { hideHeader: false }) {
  const template = `
    <!DOCTYPE html>
    <html class="dark">
    <head>
      <title>Structure Analysis Report</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        /* Custom scrollbar */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1F2937;
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #4B5563;
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #6B7280;
        }

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

        /* Tooltip */
        .tooltip {
          visibility: hidden;
          position: absolute;
          background: #1F2937;
          color: #E5E7EB;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          white-space: nowrap;
          z-index: 50;
          transform: translateY(-100%);
          top: -4px;
          left: 0;
          border: 1px solid #374151;
        }

        .tooltip-container:hover .tooltip {
          visibility: visible;
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
          <h1 class="text-xl font-bold text-white">Structure Analysis Report</h1>
          <button 
            onclick="downloadJson()"
            class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors flex items-center"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download JSON
          </button>
        </div>
      </header>
      `
          : ""
      }

      <div class="flex ${options.hideHeader ? "h-screen" : "h-[calc(100vh-64px)]"}">
        <!-- Left Sidebar -->
        <div id="sidebar" class="w-80 min-w-[200px] max-w-[600px] bg-dark-nav border-r border-gray-800">
          <div class="h-full custom-scrollbar overflow-y-auto">
            <div class="p-6">
              <div class="mb-4">
                <h2 class="text-lg font-bold text-white mb-2">Analysis Summary</h2>
                <div class="text-sm text-gray-400 space-y-1">
                  <p>Found ${data.violations.length} structure violations</p>
                  <p>Analyzed at: ${new Date(data.analyzedAt).toLocaleString()}</p>
                  <p>Skipped: ${data.skipDirectories.join(", ")}</p>
                </div>
              </div>

              <div class="border-t border-gray-800 pt-4">
                <h2 class="text-lg font-bold text-white mb-4">Directory Structure</h2>
                <div id="directoryTree">
                  ${generateTreeHtml(data.structure)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Resizer -->
        <div id="resizer" class="resizer"></div>

        <!-- Main Content Area -->
        <div class="flex-1 p-6 overflow-y-auto" id="detailsPanel">
          <div class="text-center text-gray-400 mt-20">
            Select a directory to view details
          </div>
        </div>
      </div>

      <script>
        const violations = ${JSON.stringify(data.violations)};
        const structure = ${JSON.stringify(data.structure)};

        function showDirectoryDetails(directory) {
          const detailsPanel = document.getElementById('detailsPanel');
          const violation = violations.find(v => v.directory === directory);
          const stats = findDirectoryStats(structure, directory);
          
          if (!stats) return;

          const content = '<div class="max-w-3xl mx-auto">' +
            '<h2 class="text-2xl font-bold text-white mb-4">' + directory + '</h2>' +
            '<div class="bg-dark-nav rounded-lg p-6 mb-6">' +
            '<h3 class="text-lg font-bold mb-3">Directory Stats</h3>' +
            '<div class="space-y-2 text-gray-300">' +
            '<p>Total Components: ' + stats.componentFiles.length + '</p>' +
            '<p>Sub-directories: ' + stats.subDirectories.length + '</p>' +
            (stats.hasViolation ? '<p class="text-red-400">Has structure violations</p>' : '') +
            '</div></div>' +
            (violation ? 
              '<div class="bg-dark-nav rounded-lg p-6 mb-6">' +
              '<h3 class="text-lg font-bold mb-3 text-red-400">Structure Violation</h3>' +
              '<div class="text-gray-300 mb-4">' + violation.message + '</div>' +
              '<div class="space-y-2">' +
              violation.files.map(file => 
                '<div class="bg-gray-900 p-3 rounded">' +
                '<div class="text-gray-300">' + file + '</div>' +
                '</div>'
              ).join('') +
              '</div></div>'
            : '') +
            (stats.componentFiles.length > 0 ?
              '<div class="bg-dark-nav rounded-lg p-6">' +
              '<h3 class="text-lg font-bold mb-3">Component Files</h3>' +
              '<div class="space-y-2">' +
              stats.componentFiles.map(file =>
                '<div class="bg-gray-900 p-3 rounded">' +
                '<div class="text-gray-300">' + file + '</div>' +
                '</div>'
              ).join('') +
              '</div></div>'
            : '') +
            '</div>';

          detailsPanel.innerHTML = content;
        }

        function findDirectoryStats(node, targetDir) {
          if (node.directory === targetDir) return node;
          
          for (const subDir of node.subDirectories) {
            const found = findDirectoryStats(subDir, targetDir);
            if (found) return found;
          }
          
          return null;
        }

        function downloadJson() {
          const jsonData = ${JSON.stringify(data)};
          const dataStr = JSON.stringify(jsonData, null, 2);
          const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
          
          const linkElement = document.createElement('a');
          linkElement.setAttribute('href', dataUri);
          linkElement.setAttribute('download', 'structure-analysis.json');
          document.body.appendChild(linkElement);
          linkElement.click();
          document.body.removeChild(linkElement);
        }

        // Toggle directory expansion and show details
        document.querySelectorAll('.directory').forEach(dir => {
          dir.addEventListener('click', (e) => {
            const content = dir.nextElementSibling;
            const arrow = dir.querySelector('svg');
            const directoryName = dir.querySelector('[data-directory]').dataset.directory;

            // Toggle expansion
            if (content) {
              content.classList.toggle('hidden');
              arrow.style.transform = content.classList.contains('hidden') ? '' : 'rotate(-90deg)';
            }

            // Show details
            showDirectoryDetails(directoryName);

            // Update active state
            document.querySelectorAll('.directory').forEach(d => 
              d.classList.remove('bg-gray-800'));
            dir.classList.add('bg-gray-800');
          });
        });

        // Add resizer functionality
        const resizer = document.getElementById('resizer');
        const sidebar = document.getElementById('sidebar');
        let isResizing = false;
        let lastDownX = 0;

        resizer.addEventListener('mousedown', (e) => {
          isResizing = true;
          lastDownX = e.clientX;
          resizer.classList.add('dragging');
        });

        document.addEventListener('mousemove', (e) => {
          if (!isResizing) return;

          const delta = e.clientX - lastDownX;
          lastDownX = e.clientX;
          
          const newWidth = sidebar.offsetWidth + delta;
          if (newWidth >= 200 && newWidth <= 600) {
            sidebar.style.width = newWidth + 'px';
          }
        });

        document.addEventListener('mouseup', () => {
          isResizing = false;
          resizer.classList.remove('dragging');
        });
      </script>
    </body>
    </html>
  `;

  return template;
}

function generateTreeHtml(node, level = 0) {
  const padding = level * 20;
  let html = "";

  if (!node) return html;

  const hasViolation = node.hasViolation
    ? "border-l-4 border-red-500 pl-2"
    : "";

  const badgeColor = node.hasViolation ? "bg-red-500" : "bg-blue-500";
  const componentBadge =
    node.componentFiles.length > 0
      ? `<span class="ml-2 px-2 py-0.5 text-xs rounded-full ${badgeColor} text-white">${node.componentFiles.length}</span>`
      : "";

  const dirName = path.basename(node.directory);

  html = `
    <div class="py-1 ${hasViolation}" style="padding-left: ${padding}px">
      <div class="directory flex items-center cursor-pointer hover:text-white hover:bg-gray-800 rounded p-1">
        <svg class="w-4 h-4 mr-1 transition-transform" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
        <span class="tooltip-container relative">
          <span data-directory="${node.directory}">${dirName}</span>
          <span class="tooltip">${node.directory}</span>
        </span>
        ${componentBadge}
      </div>
      <div class="ml-4 hidden">
        ${node.subDirectories.map((subDir) => generateTreeHtml(subDir, level + 1)).join("")}
      </div>
    </div>
  `;

  return html;
}

module.exports = { analyzeStructure };
