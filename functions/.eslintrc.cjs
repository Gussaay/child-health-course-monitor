/* eslint-env node */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  env: { es2022: true, node: true },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier"
  ],
  settings: {
    "import/resolver": {
      typescript: {
        // points to your tsconfig; omit if tsconfig.json is in the same dir
        project: "./tsconfig.json"
      }
    }
  },
  rules: {
    "eol-last": ["error", "always"],
    "no-trailing-spaces": "error",
    "import/order": [
      "warn",
      {
        groups: ["builtin", "external", "internal", ["parent", "sibling", "index"]],
        "newlines-between": "always"
      }
    ],
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
    ]
  },
  ignorePatterns: ["lib/**", "node_modules/**" /* , "index.js" (if you keep it) */]
};
