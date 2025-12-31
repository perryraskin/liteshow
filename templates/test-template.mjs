/**
 * Test script for template generation
 *
 * Usage: node test-template.mjs
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Recursively read all files from a directory
 */
async function readDirectoryRecursive(dir, baseDir = dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const subFiles = await readDirectoryRecursive(fullPath, baseDir);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      // Skip certain files
      if (entry.name === '.gitignore' || entry.name === 'pnpm-lock.yaml' || entry.name === 'package-lock.json') {
        continue;
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      const relativePath = path.relative(baseDir, fullPath);
      files.push({ relativePath, content });
    }
  }

  return files;
}

/**
 * Replace template variables in content
 */
function replaceTemplateVariables(content, variables) {
  let result = content;

  result = result.replace(/\{\{PROJECT_NAME\}\}/g, variables.PROJECT_NAME);
  result = result.replace(/\{\{PROJECT_SLUG\}\}/g, variables.PROJECT_SLUG);
  result = result.replace(/\{\{TURSO_DATABASE_URL\}\}/g, variables.TURSO_DATABASE_URL);
  result = result.replace(/\{\{TURSO_AUTH_TOKEN\}\}/g, variables.TURSO_AUTH_TOKEN);
  result = result.replace(/\{\{SITE_URL\}\}/g, variables.SITE_URL);

  return result;
}

/**
 * Test template generation
 */
async function testTemplate() {
  console.log('🧪 Testing template generation...\n');

  const templateDir = path.join(__dirname, 'astro');
  console.log('📁 Reading from:', templateDir);

  // Read all files
  const rawFiles = await readDirectoryRecursive(templateDir);
  console.log(`✅ Found ${rawFiles.length} template files\n`);

  // List all files
  console.log('📄 Template files:');
  rawFiles.forEach(({ relativePath }) => {
    console.log(`  - ${relativePath}`);
  });

  // Test variable replacement
  console.log('\n🔄 Testing variable replacement...');
  const variables = {
    PROJECT_NAME: 'Test Project',
    PROJECT_SLUG: 'test-project',
    TURSO_DATABASE_URL: 'libsql://test-project-db.turso.io',
    TURSO_AUTH_TOKEN: 'test_token_12345',
    SITE_URL: 'https://test-project.netlify.app',
  };

  const processedFiles = rawFiles.map(({ relativePath, content }) => ({
    path: relativePath,
    content: replaceTemplateVariables(content, variables),
  }));

  // Check a specific file for variable replacement
  const packageJsonFile = processedFiles.find(f => f.path === 'package.json');
  if (packageJsonFile) {
    console.log('\n✅ Variable replacement test:');
    const parsed = JSON.parse(packageJsonFile.content);
    console.log(`  Package name: ${parsed.name}`);
    console.log(`  Expected: liteshow-test-project`);
    console.log(`  Match: ${parsed.name === 'liteshow-test-project' ? '✅' : '❌'}`);
  }

  // Check README variable replacement
  const readmeFile = processedFiles.find(f => f.path === 'README.md');
  if (readmeFile) {
    const hasProjectName = readmeFile.content.includes('Test Project');
    const hasNoTemplateVars = !readmeFile.content.includes('{{');
    console.log(`\n  README has project name: ${hasProjectName ? '✅' : '❌'}`);
    console.log(`  README has no template vars: ${hasNoTemplateVars ? '✅' : '❌'}`);
  }

  console.log('\n✅ Template generation test complete!');
}

// Run test
testTemplate().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
