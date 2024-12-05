#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');
const { analyzeImports } = require('../lib/import-analyzer');

program
  .name('import-checker')
  .description('Analyze cross-feature imports in React projects')
  .argument('<directory>', 'Target directory to analyze')
  .option('-v, --verbose', 'Show detailed output')
  .option('--no-html', 'Skip HTML report generation')
  .action((directory, options) => {
    const targetDir = path.resolve(process.cwd(), directory);
    console.log(chalk.blue(`Analyzing imports in: ${targetDir}`));
    
    const imports = analyzeImports(targetDir, { generateHtml: options.html });
    
    if (imports.length === 0) {
      console.log(chalk.green('\n✓ No cross-feature imports found!'));
      return;
    }

    if (!options.html) {
      console.log(chalk.yellow('\nFound cross-directory imports:'));
      imports.forEach(importPath => {
        console.log(chalk.red(`• ${importPath}`));
      });
    }
    
    console.log(chalk.blue('\nGenerated JSON report: import-analysis-report.json'));
    if (options.html) {
      console.log(chalk.blue('Generated HTML report: import-analysis-report.html'));
    }
    
    if (options.verbose) {
      console.log(chalk.gray('\nThese imports should be moved to a shared location.'));
    }
  });

program.parse();
