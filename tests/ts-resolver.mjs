import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') {
    return nextResolve('next/server.js', context);
  }

  let target = specifier;

  if (target.startsWith('@/')) {
    target = path.resolve(process.cwd(), 'src', target.slice(2));
  } else if (context.parentURL && (target.startsWith('./') || target.startsWith('../'))) {
    const parentPath = fileURLToPath(context.parentURL);
    const parentDir = context.parentURL.endsWith('/') ? parentPath : path.dirname(parentPath);
    target = path.resolve(parentDir, target);
  }

  if (path.isAbsolute(target)) {
    if (!path.extname(target)) {
      if (fs.existsSync(target + '.ts')) {
        target = target + '.ts';
      } else if (fs.existsSync(path.join(target, 'index.ts'))) {
        target = path.join(target, 'index.ts');
      }
    }
    return nextResolve(pathToFileURL(target).href, context);
  }

  return nextResolve(specifier, context);
}

