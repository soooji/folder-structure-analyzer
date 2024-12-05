#!/usr/bin/env node

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
    <html>
    <head>
      <title>Import Analysis Dashboard - ${parentDirName}</title>
      <style>
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          height: 100vh;
        }
        .sidebar {
          width: 300px;
          background: #f5f5f5;
          padding: 1rem;
          border-right: 1px solid #ddd;
          overflow-y: auto;
        }
        .main-content {
          flex: 1;
          padding: 0;
          overflow: hidden;
        }
        .directory-item {
          padding: 0.5rem;
          margin: 0.25rem 0;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 1px solid #ddd;
        }
        .directory-item:hover {
          background: #f0f0f0;
        }
        .directory-item.active {
          background: #e3f2fd;
          border-color: #2196f3;
        }
        .import-count {
          background: #ff5252;
          color: white;
          padding: 0.2rem 0.5rem;
          border-radius: 12px;
          font-size: 0.8rem;
        }
        h1 {
          margin: 0 0 1rem 0;
          font-size: 1.5rem;
          color: #2c3e50;
        }
        iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
        .no-report {
          padding: 2rem;
          text-align: center;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="sidebar">
        <h1>${parentDirName} Analysis</h1>
        ${reports
          .map(
            (report) => `
          <div class="directory-item" onclick="showReport('${report.reportPath}')">
            <span>${report.directory}</span>
            ${
              report.importCount > 0
                ? `<span class="import-count">${report.importCount}</span>`
                : ""
            }
          </div>
        `,
          )
          .join("")}
      </div>
      <div class="main-content">
        <iframe id="reportFrame" src="about:blank"></iframe>
      </div>

      <script>
        function showReport(path) {
          document.querySelectorAll('.directory-item').forEach(item => {
            item.classList.remove('active');
          });
          event.currentTarget.classList.add('active');
          document.getElementById('reportFrame').src = path;
        }

        // Show first report by default if exists
        const firstReport = ${JSON.stringify(reports[0])};
        if (firstReport) {
          showReport(firstReport.reportPath);
          document.querySelector('.directory-item').classList.add('active');
        }
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
  .action((directory, options) => {
    const targetDir = path.resolve(process.cwd(), directory);
    console.log(chalk.blue(`Analyzing imports in: ${targetDir}`));

    const imports = analyzeImports(targetDir, { generateHtml: options.html });

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
