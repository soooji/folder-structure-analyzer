# Import Checker CLI

A command-line tool to analyze cross-directory imports in React/Next.js projects, helping maintain clean architecture and prevent unwanted dependencies between features.

## Features

- Analyze imports between sibling directories
- Support for JavaScript, TypeScript, JSX, and TSX files
- Generate detailed HTML reports with interactive visualizations
- Create JSON reports for further processing
- Analyze single directories or all sibling directories
- Interactive dashboard for multi-directory analysis
- VS Code integration for quick file navigation

## Installation

### Global Installation

```bash
npm install -g import-checker
```

### Local Project Installation

```bash
npm install --save-dev import-checker
```

## Usage

### Single Directory Analysis

Analyze imports for a single directory:

```bash
import-checker check <directory>
```

Example:

```bash
import-checker check src/features/user
```

Options:

- `-v, --verbose`: Show detailed output
- `--no-html`: Skip HTML report generation

### Sibling Directories Analysis

Analyze imports for all sibling directories within a parent directory:

```bash
import-checker check-siblings <parent-directory>
```

Example:

```bash
import-checker check-siblings src/pages
```

Options:

- `-v, --verbose`: Show detailed output
- `--no-html`: Skip HTML report generation

## Output

### Single Directory Analysis

Generates:

- `import-analysis-report.json`: Detailed JSON report of all imports
- `import-analysis-report.html`: Interactive HTML visualization (unless `--no-html` is specified)

### Sibling Directories Analysis

Creates a directory named `import-analysis-{parentDir}` containing:

- `index.html`: Main dashboard showing all analyzed directories
- Individual directory reports in separate folders

## Report Features

### HTML Reports

- Interactive tree view of directory structure
- Import counts for files and directories
- Detailed modal view with:
  - Source file path
  - Import path
  - Imported items (functions, components, etc.)
  - Direct links to open files in VS Code
- Collapsible directory structure
- Import count badges

### JSON Reports

Structured data including:

- Target directory information
- Analysis timestamp
- Total import count
- Detailed import information

## Use Cases

1. **Feature Isolation**: Ensure features remain independent
2. **Code Organization**: Identify when shared code should be moved
3. **Dependency Management**: Track dependencies between application parts
4. **Architectural Compliance**: Monitor cross-directory imports

## Example Directory Structure

```
src/
├── features/
│   ├── user/
│   │   ├── UserProfile.tsx
│   │   └── UserUtils.ts
│   └── auth/
│       ├── Login.tsx
│       └── AuthContext.ts
└── pages/
    ├── dashboard/
    │   └── index.tsx
    └── settings/
        └── index.tsx
```

## Alias Configuration

If your project uses import aliases (configured in tsconfig.json or jsconfig.json), you'll need to configure these aliases for the import-checker to properly analyze cross-directory imports.

Create a `.importcheckerrc.json` file in your project root:

```json
{
  "baseUrl": ".",
  "aliases": {
    "@/*": "src/*",
    "@components/*": "src/components/*",
    "@pages/*": "src/pages/*",
    "@features/*": "src/features/*",
    "@utils/*": "src/utils/*"
  }
}
```

### Configuration Options

- `baseUrl`: The base directory for resolving aliases (default: ".")
- `aliases`: An object mapping alias patterns to their actual paths
  - Keys should match your import aliases (with optional \* for wildcards)
  - Values should be the actual paths (with \* to match the wildcard if used in the key)

### Example Configurations

1. Next.js style configuration:

```json
{
  "baseUrl": ".",
  "aliases": {
    "@/*": "src/*"
  }
}
```

2. Custom paths configuration:

```json
{
  "baseUrl": ".",
  "aliases": {
    "~/*": "src/*",
    "lib/*": "src/lib/*",
    "components": "src/components",
    "@utils": "src/utils"
  }
}
```

Note: The alias patterns support both directory wildcards (with _) and exact matches (without _).

## Contributing

Contributions are welcome! Please submit a Pull Request.

## License

MIT

## Support

For issues and feature requests, please use the GitHub issue tracker.
