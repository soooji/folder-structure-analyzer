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
    <html class="dark">
    <head>
      <title>Import Analysis Dashboard - ${parentDirName}</title>
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
    </head>
    <body class="bg-dark-bg text-gray-200">
      <div class="flex h-screen">
        <div class="w-80 bg-dark-nav p-6 border-r border-gray-800 overflow-y-auto">
          <h1 class="text-2xl font-bold mb-6 text-white">${parentDirName} Analysis</h1>
          ${reports.map(report => `
            <div class="directory-item mb-2 group" onclick="showReport('${report.reportPath}')">
              <div class="flex items-center justify-between p-3 rounded-lg bg-gray-900 hover:bg-gray-800 cursor-pointer transition-colors">
                <span class="text-gray-200">${report.directory}</span>
                ${report.importCount > 0 ? 
                  `<span class="px-2 py-1 text-xs rounded-full bg-red-500 text-white">
                    ${report.importCount}
                  </span>` : 
                  ''}
              </div>
            </div>
          `).join('')}
        </div>
        <div class="flex-1">
          <iframe id="reportFrame" class="w-full h-full" src="about:blank"></iframe>
        </div>
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

  fs.writeFileSync(path.join(baseDir, 'index.html'), template);
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
