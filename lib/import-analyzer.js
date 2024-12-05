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
      <style type="text/tailwindcss">
        @layer utilities {
          .content-auto {
            content-visibility: auto;
          }
        }
      </style>
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
          <div id="treeView" class="text-sm">
            ${generateTreeView(jsonData.structure)}
          </div>
        </div>
      </div>

      <div id="importModal" class="fixed inset-0 bg-black bg-opacity-50 hidden">
        <div class="bg-dark-nav rounded-lg max-w-2xl mx-auto mt-20 p-6 relative">
          <button class="close absolute top-4 right-4 text-gray-400 hover:text-white">&times;</button>
          <h2 class="text-xl font-bold mb-4">Import Details</h2>
          <div id="modalContent"></div>
        </div>
      </div>

      <script>
        // Store the structure data for modal usage
        const structureData = ${JSON.stringify(jsonData.structure)};

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

module.exports = { analyzeImports };
