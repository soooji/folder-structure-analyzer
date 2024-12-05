const fs = require("fs-extra");
const path = require("path");
const parser = require("@babel/parser");
const glob = require("glob");

function generateHtmlReport(jsonData) {
  const template = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Import Analysis Report</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          margin: 2rem;
          background: #f5f5f5;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
          color: #2c3e50;
          border-bottom: 2px solid #eee;
          padding-bottom: 1rem;
        }
        .summary {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 4px;
          margin: 1rem 0;
        }
        /* Tree View Styles */
        .tree {
          margin: 0.5rem;
        }
        .tree, .tree ul {
          list-style: none;
          padding-left: 1rem;
        }
        .tree li {
          position: relative;
          padding: 0.2rem 0;
        }
        .directory {
          font-weight: bold;
          color: #2c3e50;
          cursor: pointer;
        }
        .file {
          color: #34495e;
          font-size: 0.9rem;
        }
        .count {
          display: inline-block;
          padding: 0.1rem 0.5rem;
          background: #e74c3c;
          color: white;
          border-radius: 12px;
          font-size: 0.8rem;
          margin-left: 0.5rem;
        }
        .details-btn {
          padding: 0.2rem 0.5rem;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin-left: 0.5rem;
          font-size: 0.8rem;
        }
        .details-btn:hover {
          background: #2980b9;
        }
        /* Modal Styles */
        .modal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.5);
          z-index: 1000;
        }
        .modal-content {
          position: relative;
          background: white;
          margin: 5% auto;
          padding: 2rem;
          width: 80%;
          max-width: 800px;
          border-radius: 8px;
          max-height: 80vh;
          overflow-y: auto;
        }
        .close {
          position: absolute;
          right: 1rem;
          top: 1rem;
          font-size: 1.5rem;
          cursor: pointer;
        }
        .import-item {
          padding: 1rem;
          border-left: 4px solid #e74c3c;
          background: #fff;
          margin: 1rem 0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .import-path {
          color: #2c3e50;
          font-weight: bold;
          margin-bottom: 0.5rem;
        }
        .import-details {
          color: #7f8c8d;
          font-size: 0.9rem;
          margin-bottom: 0.5rem;
          padding: 0.5rem;
          background: #f8f9fa;
          border-radius: 4px;
        }
        .imported-items {
          margin-top: 0.5rem;
        }
        .imported-items ul {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
          list-style-type: disc;
        }
        .imported-items li {
          color: #34495e;
          padding: 0.2rem 0;
        }
        .open-in-editor {
          padding: 0.2rem 0.5rem;
          background: #2ecc71;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin-left: 0.5rem;
          font-size: 0.8rem;
        }
        .open-in-editor:hover {
          background: #27ae60;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Import Analysis Report</h1>
        <div class="summary">
          <h3>Analysis for: ${jsonData.targetDirectory}</h3>
          <p>Found ${jsonData.totalImports} cross-directory imports</p>
          <p>Analysis performed at: ${new Date(jsonData.analyzedAt).toLocaleString()}</p>
        </div>
        
        <div class="tree-container">
          <h2>Directory Structure</h2>
          <div id="treeView" class="tree">
            ${generateTreeView(jsonData.structure)}
          </div>
        </div>
      </div>

      <div id="importModal" class="modal">
        <div class="modal-content">
          <span class="close">&times;</span>
          <h2>Import Details</h2>
          <div id="modalContent"></div>
        </div>
      </div>

      <script>
        // Store the structure data for modal usage
        const structureData = ${JSON.stringify(jsonData.structure)};

        // Toggle directory expansion
        document.querySelectorAll('.directory').forEach(dir => {
          dir.addEventListener('click', (e) => {
            const ul = dir.nextElementSibling;
            if (ul && ul.tagName === 'UL') {
              ul.style.display = ul.style.display === 'none' ? 'block' : 'none';
            }
          });
        });

        function showImportDetails(filePath, imports) {
          const modal = document.getElementById('importModal');
          const modalContent = document.getElementById('modalContent');
          
          modalContent.innerHTML = imports.map(imp => {
            const fileUrl = \`vscode://file/\${imp.absolutePath}\`;
            return \`
              <div class="import-item">
                <div class="import-path">
                  <strong>Source:</strong> \${filePath}
                </div>
                <div class="import-details">
                  <div><strong>Importing from:</strong> \${imp.importPath}</div>
                  <div><strong>Sibling Directory:</strong> \${imp.siblingDirectory}</div>
                  \${imp.importedItems.length > 0 ? \`
                  <div class="imported-items">
                    <strong>Imported Items:</strong>
                    <ul>
                      \${imp.importedItems.map(item => \`<li>\${item}</li>\`).join('')}
                    </ul>
                  </div>
                  \` : ''}
                </div>
                <button class="open-in-editor" onclick="window.location.href='\${fileUrl}'">
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
  
  imports.forEach(imp => {
    const [filePath] = imp.split(' imports from');
    if (!details[filePath]) {
      details[filePath] = [];
    }
    details[filePath].push({
      message: imp,
      absolutePath: path.resolve(process.cwd(), filePath)
    });
  });

  return details;
}

function generateTreeView(structure, parentPath = '') {
  let html = '<ul>';
  
  Object.entries(structure).forEach(([name, node]) => {
    const currentPath = parentPath ? `${parentPath}/${name}` : name;
    
    if (node.type === 'file') {
      const importCount = node.imports.length;
      const countBadge = importCount > 0 ? 
        `<span class="count">${importCount}</span>` : '';
      const detailsButton = importCount > 0 ? 
        `<button class="details-btn" onclick='showImportDetails("${currentPath}", ${JSON.stringify(node.imports)})'>Details</button>` : '';
      
      html += `<li class="file">${name}${countBadge}${detailsButton}</li>`;
    } else {
      const childrenHtml = generateTreeView(node.children, currentPath);
      const importCount = countTotalImports(node);
      const countBadge = importCount > 0 ? 
        `<span class="count">${importCount}</span>` : '';
      
      html += `
        <li>
          <span class="directory">${name}${countBadge}</span>
          ${childrenHtml}
        </li>
      `;
    }
  });
  
  return html + '</ul>';
}

function countTotalImports(node) {
  if (node.type === 'file') {
    return node.imports.length;
  }
  
  return Object.values(node.children).reduce((sum, child) => 
    sum + countTotalImports(child), 0
  );
}

function generateJsonReport(imports, targetDir) {
  const result = {
    targetDirectory: targetDir,
    analyzedAt: new Date().toISOString(),
    totalImports: imports.length,
    structure: {},
  };

  imports.forEach(imp => {
    // Example message: "src/file.ts imports from sibling directory 'auth': ../auth/file.ts (importing: func1, func2)"
    const [sourcePath, importInfo] = imp.split(' imports from sibling directory ');
    
    // Extract sibling directory and import path
    // Match pattern: 'directory-name': path/to/file
    const siblingMatch = importInfo.match(/'([^']+)':\s*([^(]+)/);
    const siblingDir = siblingMatch ? siblingMatch[1] : '';
    const importPath = siblingMatch ? siblingMatch[2].trim() : '';
    
    // Extract imported items
    const importMatch = imp.match(/\(importing: (.*?)\)/);
    const importedItems = importMatch ? importMatch[1].split(', ') : [];

    // Create nested structure based on directory path
    const parts = sourcePath.split(path.sep);
    let current = result.structure;

    parts.slice(0, -1).forEach(part => {
      if (!current[part]) {
        current[part] = {
          type: 'directory',
          children: {}
        };
      }
      current = current[part].children;
    });

    const fileName = parts[parts.length - 1];
    if (!current[fileName]) {
      current[fileName] = {
        type: 'file',
        imports: []
      };
    }

    current[fileName].imports.push({
      importPath,
      siblingDirectory: siblingDir,
      importedItems,
      absolutePath: path.resolve(process.cwd(), sourcePath)
    });
  });

  return result;
}

function analyzeImports(targetDir, options = {}) {
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
    if (node.specifiers.find(spec => spec.type === 'ImportDefaultSpecifier')) {
      const defaultImport = node.specifiers.find(spec => spec.type === 'ImportDefaultSpecifier');
      items.push(`default as ${defaultImport.local.name}`);
    }
    
    // Handle named imports (e.g., import { name1, name2 } from './path')
    const namedImports = node.specifiers
      .filter(spec => spec.type === 'ImportSpecifier')
      .map(spec => {
        // Handle renamed imports (e.g., import { original as renamed } from './path')
        if (spec.local.name !== spec.imported.name) {
          return `${spec.imported.name} as ${spec.local.name}`;
        }
        return spec.local.name;
      });
    
    items.push(...namedImports);
    
    // Handle namespace imports (e.g., import * as name from './path')
    const namespaceImport = node.specifiers.find(spec => spec.type === 'ImportNamespaceSpecifier');
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
          const importedItemsStr = importedItems.length > 0 
            ? ` (importing: ${importedItems.join(', ')})`
            : '';

          // Handle relative imports
          if (importPath.startsWith('.')) {
            const absoluteImportPath = path.resolve(fileDir, importPath);
            const relativeToParent = path.relative(parentDir, absoluteImportPath);
            const importDirName = relativeToParent.split(path.sep)[0];

            // Check if import is from a sibling directory
            if (siblingDirs.includes(importDirName)) {
              foundImports.add(
                `${relativePath} imports from sibling directory '${importDirName}': ${importPath} ${importedItemsStr}`
              );
            }
          } else {
            // Handle absolute imports
            const isSiblingImport = siblingDirs.some(sibDir => 
              importPath.includes(`/${sibDir}/`) || importPath === sibDir
            );

            if (isSiblingImport) {
              const siblingDir = siblingDirs.find(sibDir => 
                importPath.includes(`/${sibDir}/`) || importPath === sibDir
              );
              foundImports.add(
                `${relativePath} imports from sibling directory '${siblingDir}': ${importPath} ${importedItemsStr}`
              );
            }
          }
        }

        // Recursively visit all child nodes
        for (const key in node) {
          const child = node[key];
          if (child && typeof child === "object") {
            if (Array.isArray(child)) {
              child.forEach(item => {
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
      console.error(
        `Error parsing file ${relativePath}:`,
        error.message
      );
    }
  });

  const imports = Array.from(foundImports);
  
  // Generate JSON report
  const jsonReport = generateJsonReport(imports, targetDir);
  const jsonReportPath = path.join(process.cwd(), 'import-analysis-report.json');
  fs.writeFileSync(jsonReportPath, JSON.stringify(jsonReport, null, 2));
  
  // Generate HTML report if requested
  if (options.generateHtml !== false) {
    const htmlReport = generateHtmlReport(jsonReport); // Pass the JSON data directly
    const reportPath = path.join(process.cwd(), 'import-analysis-report.html');
    fs.writeFileSync(reportPath, htmlReport);
  }
  
  return imports;
}

module.exports = { analyzeImports };
