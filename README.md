# Import Checker CLI

Maintain clean architecture in React/Next.js projects by analyzing cross-directory imports and component organization.

## Features

- Analyze imports between directories
- Generate HTML and JSON reports
- Support for JavaScript, TypeScript, JSX, TSX
- VS Code integration
- Enforce component directory structure

## Installation

```bash
# Global installation
npm install -g import-checker

# Local project installation
npm install --save-dev import-checker
```

## Commands

### 1. Single Directory Analysis

```bash
import-checker check <directory>
# Example: import-checker check src/features/user

# Options
-v, --verbose     Detailed output
--no-html         Skip HTML report
```

### 2. Sibling Directories Analysis

```bash
import-checker check-siblings <parent-directory>
# Example: import-checker check-siblings src/pages

# Options
-v, --verbose     Detailed output
--no-html         Skip HTML report
```

### 3. Structure Checker

```bash
import-checker check-structure <directory>
# Example: import-checker check-structure src/features

# Options
-s, --skip <directories>   Skip specific directories
-v, --verbose              Detailed output
--no-html                  Skip HTML report
```

### 4. Combined Analysis

```bash
import-checker check-all <directory>
# Example: import-checker check-all src/features

# Options
-s, --skip <directories>   Skip directories
-v, --verbose              Detailed output
--no-html                  Skip HTML report
-o, --output <path>        Custom output path
```

## Configuration

Create `.importcheckerrc.json`:

```json
{
  "baseUrl": ".",
  "outputDir": "./import-analysis",
  "aliases": {
    "@/*": "src/*",
    "@components/*": "src/components/*"
  }
}
```

## Reports

- Interactive HTML reports
- Detailed JSON analysis
- Import counts and file information
- VS Code file links

## Use Cases

- Feature isolation
- Code organization
- Dependency management
- Architectural compliance

## Visualization

<img src="./assets/ChordDiagram.png" width="600" alt="Import Diagram" />
<img src="./assets/ForceDirectedGraph.png" width="600" alt="Force Directed Graph" />

## Contributing

Contributions welcome! Please submit a Pull Request.

## License

MIT

## Contributing & Support

- Contributions welcome! Submit a Pull Request
- Report issues on GitHub
- License: MIT
