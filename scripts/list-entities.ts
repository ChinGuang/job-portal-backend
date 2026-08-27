/**
 * Lists every TypeORM entity's table name by scanning src for *.entity.ts
 * files and reading their @Entity(...) decorator, without booting Nest or
 * connecting to a database.
 *
 * Run: pnpm entities:list
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC_DIR = join(__dirname, '..', 'src');

function findEntityFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...findEntityFiles(fullPath));
    } else if (entry.endsWith('.entity.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractEntities(filePath: string): { className: string; tableName: string }[] {
  const content = readFileSync(filePath, 'utf8');
  const results: { className: string; tableName: string }[] = [];

  const entityDeclRegex = /@Entity\((?:['"]([^'"]+)['"])?\)/g;
  const classDeclRegex = /export\s+class\s+(\w+)/g;

  let entityMatch: RegExpExecArray | null;
  while ((entityMatch = entityDeclRegex.exec(content)) !== null) {
    const [, explicitName] = entityMatch;

    classDeclRegex.lastIndex = entityMatch.index;
    const classMatch = classDeclRegex.exec(content);
    if (!classMatch) continue;

    results.push({ className: classMatch[1], tableName: explicitName ?? classMatch[1] });
  }

  return results;
}

function main(): void {
  const entityFiles = findEntityFiles(SRC_DIR);
  const entities = entityFiles.flatMap(extractEntities);

  if (entities.length === 0) {
    console.log('No entities found under src/.');
    return;
  }

  entities.sort((a, b) => a.tableName.localeCompare(b.tableName));

  console.log(`Found ${entities.length} entit${entities.length === 1 ? 'y' : 'ies'}:\n`);
  for (const { className, tableName } of entities) {
    console.log(`  ${tableName.padEnd(24)} (${className})`);
  }
}

main();
